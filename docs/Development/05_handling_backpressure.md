---
sidebar_position: 5
---

# Handling Backpressure

When your system produces data faster than it can consume it, you have a backpressure problem. Left unhandled, it causes memory exhaustion, dropped messages, cascading failures, and eventual process crashes. This guide covers what backpressure is, how it manifests in Node.js, and how to solve it properly using RabbitMQ.

---

## What is Backpressure?

Backpressure is the buildup of unprocessed work when a **producer** sends data faster than a **consumer** can handle it.

```
Producer → [buffer overflows] → Consumer

Fast Publisher  ──────────────────────────────►  Slow Worker
   1000 msg/s                                      50 msg/s
                        ↓
               Buffer fills → OOM crash / dropped messages
```

This is not just a theoretical concern. It appears in:
- HTTP servers receiving more requests than downstream services can process
- Stream pipelines where a transform step is slower than the source
- Message queues with consumers that lag behind producers
- Database write paths where inserts outpace disk I/O

---

## How Backpressure Manifests in Node.js

Node.js is single-threaded and event-loop driven. Backpressure shows up in several ways:

### 1. Unbounded In-Memory Queues

```js
// Anti-pattern: messages pile up in memory
const queue = [];
producer.on('data', (msg) => queue.push(msg)); // grows unboundedly

setInterval(() => {
  const msg = queue.shift();
  if (msg) slowProcess(msg); // can't keep up
}, 100);
```

### 2. Node.js Stream `highWaterMark` Exceeded

Node.js streams have a built-in backpressure mechanism via `highWaterMark`. When the internal buffer fills, `write()` returns `false` — signaling the producer to pause. Ignoring this signal causes buffering in userland.

```js
const writable = fs.createWriteStream('output.log');

readable.on('data', (chunk) => {
  const ok = writable.write(chunk);
  if (!ok) {
    // Anti-pattern: ignoring the signal and continuing to push
    console.log('Buffer full, but pushing anyway...');
  }
});
```

### 3. Event Loop Lag

A slow consumer blocks the event loop, causing timers, I/O callbacks, and health checks to be delayed — making the service appear unresponsive even though it's still running.

---

## Why RabbitMQ Solves This

RabbitMQ acts as a **durable, external buffer** between producers and consumers. It decouples production rate from consumption rate and gives you fine-grained control over how consumers pull work.

```
Producer → RabbitMQ Exchange → Queue → Consumer (controlled rate)
                                  ↓
                           Messages persist on disk
                           No memory pressure on app
```

Key mechanisms RabbitMQ provides for backpressure control:
- **`prefetch` (QoS)**: Limits how many unacknowledged messages a consumer holds at once
- **Acknowledgements**: Messages are only removed from the queue after confirmed processing
- **Dead Letter Queues (DLQ)**: Failed messages are routed elsewhere instead of lost
- **Queue length limits**: Producers are blocked or messages are dropped at the queue level

---

## Setup

### Prerequisites

```bash
# Start RabbitMQ with management UI
docker run -d \
  --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management
```

Management UI: `http://localhost:15672` (guest/guest)

### Install the AMQP client

```bash
npm install amqplib
```

---

## Core Pattern: Producer / Consumer with Prefetch

### Connection Helper

```js
// lib/rabbitmq.js
const amqp = require('amqplib');

let connection = null;
let channel = null;

async function connect(url = 'amqp://localhost') {
  connection = await amqp.connect(url);

  connection.on('error', (err) => {
    console.error('RabbitMQ connection error:', err.message);
  });

  connection.on('close', () => {
    console.warn('RabbitMQ connection closed. Reconnecting...');
    setTimeout(() => connect(url), 5000);
  });

  channel = await connection.createChannel();
  return channel;
}

async function getChannel() {
  if (!channel) await connect();
  return channel;
}

module.exports = { connect, getChannel };
```

### Producer

```js
// producer.js
const { getChannel } = require('./lib/rabbitmq');

const QUEUE = 'task_queue';

async function publish(message) {
  const ch = await getChannel();

  // Declare queue as durable — survives broker restarts
  await ch.assertQueue(QUEUE, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'dlx',         // route failures to DLQ
      'x-max-length': 10000,                    // max queue depth
      'x-overflow': 'reject-publish',           // block producers when full
    },
  });

  const payload = Buffer.from(JSON.stringify(message));

  // persistent: true ensures the message survives a broker restart
  const sent = ch.sendToQueue(QUEUE, payload, { persistent: true });

  if (!sent) {
    // Channel's write buffer is full — apply backpressure to upstream
    console.warn('Channel buffer full. Producer should slow down.');
    await drainChannel(ch);
  }
}

function drainChannel(ch) {
  return new Promise((resolve) => ch.once('drain', resolve));
}

// Simulate a producer sending 500 messages
(async () => {
  for (let i = 0; i < 500; i++) {
    await publish({ id: i, task: 'process_image', timestamp: Date.now() });
    console.log(`Published message ${i}`);
  }
  process.exit(0);
})();
```

**Key points:**
- `durable: true` persists the queue across RabbitMQ restarts.
- `x-max-length` + `x-overflow: reject-publish` puts hard backpressure on the producer at the broker level — the producer gets a `false` from `sendToQueue` when the queue is full.
- Listening to `drain` before continuing prevents memory from growing unboundedly in the amqplib write buffer.

---

## Consumer with Prefetch (The Key to Backpressure Control)

```js
// consumer.js
const { getChannel } = require('./lib/rabbitmq');

const QUEUE = 'task_queue';
const PREFETCH_COUNT = 5; // process at most 5 messages concurrently

async function startConsumer() {
  const ch = await getChannel();

  await ch.assertQueue(QUEUE, { durable: true });

  // THIS is the backpressure knob:
  // RabbitMQ will not send more than PREFETCH_COUNT unacked messages
  // to this consumer at any time.
  ch.prefetch(PREFETCH_COUNT);

  console.log(`Consumer started. Prefetch: ${PREFETCH_COUNT}`);

  ch.consume(QUEUE, async (msg) => {
    if (!msg) return; // consumer was cancelled

    const data = JSON.parse(msg.content.toString());
    console.log(`Processing message ${data.id}`);

    try {
      await processTask(data);

      // Acknowledge: tell RabbitMQ this message is done
      ch.ack(msg);
    } catch (err) {
      console.error(`Failed to process message ${data.id}:`, err.message);

      const shouldRequeue = isTransientError(err);

      // nack: negative acknowledgement
      // requeue=true  → put back in queue for retry
      // requeue=false → route to Dead Letter Queue
      ch.nack(msg, false, shouldRequeue);
    }
  });
}

async function processTask(data) {
  // Simulate variable processing time
  const delay = Math.random() * 2000 + 500; // 500ms – 2500ms
  await new Promise((resolve) => setTimeout(resolve, delay));
  console.log(`Finished task ${data.id}`);
}

function isTransientError(err) {
  // Retry network/timeout errors; send permanent failures to DLQ
  return err.code === 'ETIMEDOUT' || err.message.includes('temporary');
}

startConsumer();
```

### How Prefetch Creates Backpressure

```
RabbitMQ Queue: [msg1, msg2, msg3, msg4, msg5, msg6, msg7 ...]
                    ↓ prefetch=5
Consumer receives: [msg1, msg2, msg3, msg4, msg5]
                    ↓ (msg6 and beyond are NOT sent until an ack is received)

Consumer processes msg1 → acks → RabbitMQ sends msg6
Consumer processes msg2 → acks → RabbitMQ sends msg7
...
```

Without `prefetch`, RabbitMQ pushes **all queued messages** to the consumer at once, which defeats the entire purpose of a queue and causes your Node.js process to buffer thousands of messages in memory.

---

## Dead Letter Queue (DLQ) Setup

Messages that fail processing should not be silently dropped or loop forever. Route them to a DLQ for inspection and replay.

```js
// setup-dlq.js
const { getChannel } = require('./lib/rabbitmq');

async function setupDeadLetterInfrastructure() {
  const ch = await getChannel();

  // 1. Declare the dead letter exchange
  await ch.assertExchange('dlx', 'direct', { durable: true });

  // 2. Declare the dead letter queue
  await ch.assertQueue('dead_letter_queue', {
    durable: true,
    arguments: {
      // Optional: messages in DLQ expire after 7 days
      'x-message-ttl': 7 * 24 * 60 * 60 * 1000,
    },
  });

  // 3. Bind DLQ to the exchange
  await ch.bindQueue('dead_letter_queue', 'dlx', 'task_queue');

  // 4. Declare the main queue pointing to the DLX
  await ch.assertQueue('task_queue', {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'dlx',
      'x-dead-letter-routing-key': 'task_queue',
    },
  });

  console.log('DLQ infrastructure ready');
  process.exit(0);
}

setupDeadLetterInfrastructure();
```

**Message lifecycle with DLQ:**

```
task_queue → Consumer fails → nack(msg, false, false)
                                     ↓
                              dlx exchange
                                     ↓
                         dead_letter_queue (inspect / replay later)
```

---

## Retry with Exponential Backoff

Immediate retry on failure can hammer a downstream service that's already struggling. Use a delay queue pattern for exponential backoff.

```js
// lib/retry.js
const { getChannel } = require('./rabbitmq');

const MAX_RETRIES = 5;

async function publishWithRetry(queue, message, attempt = 0) {
  const ch = await getChannel();

  if (attempt >= MAX_RETRIES) {
    console.error(`Max retries reached for message. Sending to DLQ.`);
    await ch.sendToQueue(
      'dead_letter_queue',
      Buffer.from(JSON.stringify({ ...message, failedAt: new Date() })),
      { persistent: true }
    );
    return;
  }

  const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s, 16s
  const retryQueue = `retry_${delayMs}ms`;

  // Declare a per-delay retry queue with TTL.
  // When TTL expires, the message routes back to the main queue via DLX.
  await ch.assertQueue(retryQueue, {
    durable: true,
    arguments: {
      'x-message-ttl': delayMs,
      'x-dead-letter-exchange': '',          // default exchange
      'x-dead-letter-routing-key': queue,
    },
  });

  const payload = {
    ...message,
    _retry: { attempt: attempt + 1, nextDelay: delayMs * 2 },
  };

  ch.sendToQueue(retryQueue, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });

  console.log(`Message scheduled for retry in ${delayMs}ms (attempt ${attempt + 1})`);
}

module.exports = { publishWithRetry };
```

**Consumer using retry:**

```js
const { publishWithRetry } = require('./lib/retry');

ch.consume(QUEUE, async (msg) => {
  const data = JSON.parse(msg.content.toString());
  const attempt = data._retry?.attempt ?? 0;

  try {
    await processTask(data);
    ch.ack(msg);
  } catch (err) {
    ch.ack(msg); // remove from queue before scheduling retry
    await publishWithRetry(QUEUE, data, attempt);
  }
});
```

**Retry flow:**

```
Consumer fails (attempt 0)
  → publish to retry_1000ms queue (TTL: 1s)
  → after 1s, message routes back to task_queue
  → Consumer fails (attempt 1)
  → publish to retry_2000ms queue (TTL: 2s)
  → ...
  → attempt 5 → dead_letter_queue
```

---

## Scaling Consumers Dynamically

When the queue depth grows, spin up more consumers. When it shrinks, scale down.

```js
// autoscaler.js
const amqp = require('amqplib');

const QUEUE = 'task_queue';
const SCALE_UP_THRESHOLD = 1000;    // messages
const SCALE_DOWN_THRESHOLD = 100;   // messages
const CHECK_INTERVAL_MS = 10_000;

async function getQueueDepth(ch) {
  const info = await ch.checkQueue(QUEUE);
  return info.messageCount;
}

async function monitorAndScale() {
  const conn = await amqp.connect('amqp://localhost');
  const ch = await conn.createChannel();

  setInterval(async () => {
    const depth = await getQueueDepth(ch);
    console.log(`Queue depth: ${depth}`);

    if (depth > SCALE_UP_THRESHOLD) {
      console.log('Scaling UP: queue depth exceeded threshold');
      // In production: trigger Kubernetes HPA, ECS task update, etc.
      // execSync('kubectl scale deployment consumer --replicas=10');
    } else if (depth < SCALE_DOWN_THRESHOLD) {
      console.log('Scaling DOWN: queue depth below threshold');
      // execSync('kubectl scale deployment consumer --replicas=2');
    }
  }, CHECK_INTERVAL_MS);
}

monitorAndScale();
```

In production, integrate with:
- **Kubernetes KEDA**: Scales pods based on RabbitMQ queue depth natively
- **AWS SQS + Lambda**: Auto-scales consumers based on queue size
- **PM2 cluster**: Spawn/kill worker processes on the same machine

---

## Monitoring Backpressure

You can't fix what you can't see. Key metrics to track:

### Via RabbitMQ Management HTTP API

```js
// monitor.js
async function getQueueStats() {
  const res = await fetch('http://localhost:15672/api/queues/%2F/task_queue', {
    headers: {
      Authorization: 'Basic ' + Buffer.from('guest:guest').toString('base64'),
    },
  });

  const data = await res.json();

  return {
    messages: data.messages,
    messagesReady: data.messages_ready,
    messagesUnacked: data.messages_unacknowledged,
    publishRate: data.message_stats?.publish_details?.rate ?? 0,
    deliverRate: data.message_stats?.deliver_details?.rate ?? 0,
    ackRate: data.message_stats?.ack_details?.rate ?? 0,
    consumers: data.consumers,
  };
}

setInterval(async () => {
  const stats = await getQueueStats();
  console.table(stats);

  // Alert if queue depth is growing (publish > ack rate)
  if (stats.publishRate > stats.ackRate * 1.5) {
    console.warn('WARNING: Producer is outpacing consumers by 50%+');
  }
}, 5000);
```

### Key Metrics to Alert On

| Metric | Warning Threshold | Critical Threshold |
|---|---|---|
| Queue depth | > 5,000 messages | > 50,000 messages |
| Consumer count | < expected | 0 |
| Publish rate / Ack rate | > 1.2x | > 2x |
| Unacknowledged messages | > prefetch × consumers | growing unboundedly |
| DLQ depth | > 0 (investigate) | > 100 |

---

## Backpressure in Node.js Streams + RabbitMQ

When consuming from RabbitMQ and piping into a downstream stream (e.g., writing to a file or database), combine both backpressure mechanisms:

```js
const { Writable } = require('stream');
const { getChannel } = require('./lib/rabbitmq');

class RabbitMQWritable extends Writable {
  constructor(channel, options = {}) {
    super({ objectMode: true, highWaterMark: 16, ...options });
    this.channel = channel;
  }

  async _write(msg, _encoding, callback) {
    try {
      const data = JSON.parse(msg.content.toString());
      await processTask(data);
      this.channel.ack(msg);
      callback(); // signal: ready for next message
    } catch (err) {
      this.channel.nack(msg, false, true);
      callback(err);
    }
  }
}

async function start() {
  const ch = await getChannel();
  ch.prefetch(10);

  const writable = new RabbitMQWritable(ch);

  writable.on('error', (err) => {
    console.error('Stream error:', err.message);
  });

  ch.consume('task_queue', (msg) => {
    if (!msg) return;
    writable.write(msg);
    // prefetch is the primary flow control here;
    // the Writable highWaterMark handles downstream pressure
  });
}
```

In practice, **prefetch is the correct mechanism** for controlling flow between RabbitMQ and a Node.js consumer. Node.js stream backpressure applies when piping the consumed data further downstream (to disk, a database write stream, etc.).

---

## Common Mistakes

### 1. Not setting prefetch

```js
// Wrong: RabbitMQ floods the consumer with all queued messages
ch.consume(QUEUE, handler);

// Right: cap in-flight messages
ch.prefetch(10);
ch.consume(QUEUE, handler);
```

### 2. Acking before processing

```js
// Wrong: message is lost if processing fails after ack
ch.consume(QUEUE, async (msg) => {
  ch.ack(msg);            // acked immediately
  await processTask(msg); // crashes here → message is gone forever
});

// Right: ack only after successful processing
ch.consume(QUEUE, async (msg) => {
  await processTask(msg);
  ch.ack(msg);
});
```

### 3. Nacking with requeue=true on permanent failures

```js
// Wrong: a corrupt message loops forever
ch.nack(msg, false, true);  // requeues indefinitely

// Right: detect permanent failures and route to DLQ
ch.nack(msg, false, false); // routes to dead letter queue
```

### 4. Ignoring channel drain events on the producer

```js
// Wrong: memory grows as the write buffer fills
for (const msg of messages) {
  ch.sendToQueue(QUEUE, msg);
}

// Right: respect backpressure from amqplib
for (const msg of messages) {
  const ok = ch.sendToQueue(QUEUE, msg);
  if (!ok) await new Promise((r) => ch.once('drain', r));
}
```

### 5. Sharing one channel across producers and consumers

AMQP channels are not thread-safe and mixing publish/consume on the same channel causes unexpected behavior. Use separate channels per logical role.

```js
// Right: one channel per role
const producerChannel = await connection.createChannel();
const consumerChannel = await connection.createChannel();
```

---

## Full Example: Image Processing Pipeline

A realistic scenario tying everything together: an API receives image upload requests and processes them asynchronously.

```
POST /upload → Producer → [task_queue] → Worker (resize, compress) → S3
                                ↓
                        [dead_letter_queue] → Alert / manual replay
```

```js
// api.js — Express endpoint (producer)
const express = require('express');
const { getChannel } = require('./lib/rabbitmq');

const app = express();
app.use(express.json());

app.post('/upload', async (req, res) => {
  const { imageUrl, userId } = req.body;

  if (!imageUrl || !userId) {
    return res.status(400).json({ error: 'imageUrl and userId are required' });
  }

  const ch = await getChannel();
  const job = { imageUrl, userId, requestedAt: Date.now() };

  const sent = ch.sendToQueue(
    'image_processing',
    Buffer.from(JSON.stringify(job)),
    { persistent: true }
  );

  if (!sent) {
    // Queue is full — propagate backpressure to the HTTP client
    return res.status(503).json({
      error: 'Service busy. Please retry shortly.',
      retryAfter: 5,
    });
  }

  res.status(202).json({ message: 'Image queued for processing' });
});

app.listen(3000, () => console.log('API running on :3000'));
```

```js
// worker.js — Consumer
const { getChannel } = require('./lib/rabbitmq');
const { publishWithRetry } = require('./lib/retry');

async function startWorker() {
  const ch = await getChannel();

  await ch.assertQueue('image_processing', {
    durable: true,
    arguments: { 'x-dead-letter-exchange': 'dlx' },
  });

  ch.prefetch(3); // process 3 images concurrently per worker instance

  ch.consume('image_processing', async (msg) => {
    if (!msg) return;

    const job = JSON.parse(msg.content.toString());
    const attempt = job._retry?.attempt ?? 0;

    console.log(`Processing image for user ${job.userId} (attempt ${attempt})`);

    try {
      await resizeAndUploadToS3(job.imageUrl, job.userId);
      ch.ack(msg);
      console.log(`Done: ${job.imageUrl}`);
    } catch (err) {
      console.error(`Failed: ${err.message}`);
      ch.ack(msg);
      await publishWithRetry('image_processing', job, attempt);
    }
  });

  console.log('Worker started');
}

async function resizeAndUploadToS3(imageUrl, userId) {
  // Simulate variable processing time
  await new Promise((r) => setTimeout(r, Math.random() * 3000 + 1000));

  if (Math.random() < 0.1) {
    throw new Error('temporary: S3 upload timeout');
  }
}

startWorker();
```

---

## Summary

| Concept | Mechanism | When to apply |
|---|---|---|
| Limit consumer concurrency | `ch.prefetch(N)` | Always — first line of defense |
| Handle failures gracefully | `ch.nack()` + DLQ | Prevent infinite retry loops |
| Retry with backoff | Delay queues + TTL | Transient errors (network, timeouts) |
| Propagate to producer | `sendToQueue` returns `false` | Slow down publisher at queue capacity |
| Monitor queue health | Management API metrics | Alert on depth, rate mismatch |
| Scale consumers | Queue depth thresholds | Autoscalers, KEDA, ECS |

Backpressure is not a feature to bolt on later — it's a property of a correctly designed system. With RabbitMQ's `prefetch`, durable queues, dead-letter routing, and sensible acknowledgement patterns, Node.js services can handle load spikes gracefully without memory exhaustion or data loss.
