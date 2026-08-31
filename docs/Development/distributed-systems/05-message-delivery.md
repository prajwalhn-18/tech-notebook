---
sidebar_position: 5
---

# Message Delivery and Ordering

Understanding message delivery guarantees, ordering, duplicates, and time in distributed systems.

---

## Table of Contents

1. [Message Delivery Guarantees](#message-delivery-guarantees)
2. [Ordering Guarantees](#ordering-guarantees)
3. [Duplicate Messages](#duplicate-messages)
4. [Exactly-Once Semantics](#exactly-once-semantics)
5. [Time and Clocks](#time-and-clocks)
6. [Practical Patterns](#practical-patterns)

---

## Message Delivery Guarantees

### The Three Guarantees

**At-most-once:** Message delivered zero or one time. May be lost, never duplicated.

**At-least-once:** Message delivered one or more times. Never lost, may be duplicated.

**Exactly-once:** Message delivered exactly one time. Never lost, never duplicated.

**Reality:** Exactly-once is extremely difficult (some argue impossible) in distributed systems.

### At-Most-Once Delivery

**Implementation:**
```
Send message
Don't retry on failure
Don't acknowledge receipt
```

**Characteristics:**
- Simplest implementation
- Best performance (no retries, no dedup)
- Messages may be lost

**Use cases:**
- Metrics (loss of few data points acceptable)
- Monitoring (approximate values acceptable)
- Video streaming (dropped frames acceptable)
- Real-time gaming (old state irrelevant)

**Example: UDP**
```
UDP packets have at-most-once semantics:
- No acknowledgment
- No retries
- Packets may be lost
- No duplicates
```

**When acceptable:**
- Data is not critical
- Loss of messages doesn't break system
- Simplicity and performance matter more than reliability

### At-Least-Once Delivery

**Implementation:**
```
1. Send message
2. Wait for acknowledgment
3. If no ack or error, retry
4. Repeat until ack received
```

**Characteristics:**
- Reliable delivery (messages not lost)
- May duplicate messages
- Requires idempotent operations

**Use cases:**
- Order processing (must not lose)
- Payment transactions (must not lose)
- Email delivery (duplicates okay)
- Any critical operation

**Example: TCP**
```
TCP provides at-least-once semantics:
- Acknowledgments
- Retransmissions
- Guaranteed delivery (if connection succeeds)
```

**Retry strategy:**
```
attempts = 0
max_attempts = 5

while attempts < max_attempts:
  try:
    send_message()
    wait_for_ack(timeout=5s)
    return success
  except Timeout:
    attempts += 1
    backoff(attempts)

return failure
```

**Challenges:**
- Duplicate messages possible
- Must handle duplicates at receiver
- Requires idempotent operations

### Exactly-Once Delivery

**The hard truth:** True exactly-once delivery is impossible in distributed systems with failures.

**Why impossible:**
```
Scenario:
1. Producer sends message
2. Broker receives and processes message
3. Broker crashes before sending acknowledgment
4. Producer doesn't know if message was processed
5. Producer must choose:
   - Retry: May duplicate (at-least-once)
   - Don't retry: May lose message (at-most-once)

Cannot distinguish between:
- Message lost
- Acknowledgment lost
- Broker slow
```

**What "exactly-once" really means:**

**Exactly-once processing:** Message may be delivered multiple times, but processed exactly once.

**Implementation requires:**
1. At-least-once delivery (reliability)
2. Idempotent processing (duplicate handling)
3. Deduplication (detect duplicates)

**Exactly-once = At-least-once + Idempotency**

### Exactly-Once Processing

**Idempotent operations:**
```
Message: Set user_status = "active"
Process once: status = "active"
Process again: status = "active" (same result)
Idempotent: ✓
```

**Deduplication:**
```
Message has unique ID
Check if ID already processed:
  if processed:
    skip (duplicate)
  else:
    process message
    mark ID as processed
```

**Transactional deduplication:**
```
BEGIN TRANSACTION
  if not exists(select 1 from processed where id = message_id):
    insert into processed (id) values (message_id)
    process_message()
COMMIT
```

If transaction succeeds, message processed exactly once.
If transaction fails, retry (idempotent).

**State machine approach:**
```
Current state: order_status = "pending"
Message: transition to "paid"

Process:
  if order_status == "pending":
    order_status = "paid"
  elif order_status == "paid":
    no-op (already paid, duplicate message)
```

---

## Ordering Guarantees

### Why Ordering Matters

**Example: Bank transactions**
```
Account balance = $100

Operation 1: Deposit $50 → Balance = $150
Operation 2: Withdraw $100 → Balance = $50

Correct order: Deposit then withdraw → $50 ✓
Wrong order: Withdraw then deposit → Overdraft ✗
```

**Example: State machine**
```
Order states: created → paid → shipped

Message 1: Transition to paid
Message 2: Transition to shipped

Correct order: paid → shipped ✓
Wrong order: shipped → paid → Error (invalid transition) ✗
```

### Ordering Levels

**No ordering guarantee:**
- Messages delivered in any order
- Fastest, simplest
- Application must handle any order

**Per-partition ordering:**
- Messages in same partition ordered
- Messages across partitions not ordered
- Common in distributed queues (Kafka)

**Per-producer ordering:**
- Messages from same producer ordered
- Messages from different producers not ordered

**Total ordering:**
- All messages delivered in same order to all consumers
- Hardest to achieve
- Requires consensus or single leader

### FIFO Ordering

**First-In-First-Out:** Messages delivered in send order.

**Per-connection FIFO:**
```
Producer → Broker connection
Messages sent: M1, M2, M3
Messages delivered: M1, M2, M3 (same order)
```

**Challenges:**
- Multiple connections break FIFO
- Retries break FIFO
- Parallel processing breaks FIFO

**Maintaining FIFO with retries:**
```
Problem:
Send M1
Send M2
M1 fails, retry M1
M2 succeeds
M1 succeeds
Delivered order: M2, M1 (wrong!)

Solution:
- Wait for M1 ack before sending M2
- Or use sequence numbers and reorder at receiver
```

### Causal Ordering

**Causality:** If A causes B, deliver A before B.

**Example: Social media**
```
Alice posts: "I got engaged!" (M1)
Bob comments: "Congratulations!" (M2)

M2 causally depends on M1.
Must deliver M1 before M2.

Carol posts: "Nice weather today" (M3)
M3 concurrent with M1, M2.
M3 can be delivered in any order relative to M1, M2.
```

**Vector clocks track causality:**
```
Alice: [1, 0, 0] → posts (increments own counter)
Bob: [1, 1, 0] → comments (increments own, inherits Alice's)
Carol: [0, 0, 1] → posts (independent)

Bob's message [1, 1, 0] dominates Alice's [1, 0, 0]
  → Bob's message causally after Alice's
Carol's message [0, 0, 1] doesn't dominate either
  → Concurrent
```

**Implementing causal order:**
- Attach vector clock to each message
- Buffer messages until dependencies delivered
- Deliver when all causal dependencies satisfied

### Total Order Broadcast

**All nodes deliver messages in same order.**

**Implementation:**
- Use consensus algorithm (Paxos, Raft)
- Or use single leader (serialization point)

**Process:**
```
Proposer proposes message
Consensus ensures all nodes agree on order
All nodes deliver in agreed order
```

**Use cases:**
- Replicated state machines
- Distributed databases
- Coordination services

**Cost:**
- High latency (consensus overhead)
- Reduced throughput (serialization)

### Kafka Partitioning

**Kafka guarantees:**
- Messages in same partition delivered in order
- Messages across partitions not ordered

**Partition key:**
```
send_message(topic="orders", key=user_id, value=order_data)

All messages with same user_id go to same partition.
Orders for each user are ordered.
Orders across users are concurrent.
```

**Trade-offs:**
- More partitions → Better parallelism, less ordering
- Fewer partitions → More ordering, less parallelism

**Hot partition problem:**
```
If key distribution skewed:
  Most messages → Partition 1 (overloaded)
  Few messages → Partitions 2, 3, 4 (underutilized)

Solution: Choose good partition key (uniform distribution)
```

---

## Duplicate Messages

### Sources of Duplicates

**Producer retries:**
```
Producer sends message
Broker receives and processes
Acknowledgment lost
Producer times out, resends
Broker receives duplicate
```

**Broker replication:**
```
Message replicated to followers
Leader crashes
New leader promoted
May have duplicate messages
```

**Network issues:**
```
TCP retransmissions
Packet duplicates
Load balancer retries
```

**Consumer retries:**
```
Consumer processes message
Consumer crashes before committing offset
Consumer restarts, reprocesses message
```

### Detecting Duplicates

**Message IDs:**
```
Each message has unique ID
Track processed IDs:
  if id in processed_ids:
    skip (duplicate)
  else:
    process(message)
    add id to processed_ids
```

**Deduplication window:**
```
Can't store all IDs forever
Keep IDs for time window (e.g., 24 hours)

Assumption: Duplicates arrive within window
Older duplicates not detected (rare)
```

**Bloom filters:**
```
Space-efficient probabilistic data structure
Fast membership test
Small false positive rate
No false negatives

Use for first-level dedup:
  if bloom_filter.contains(id):
    check database (may be false positive)
  else:
    definitely new message
```

**Database unique constraints:**
```
CREATE UNIQUE INDEX idx_message_id
ON processed_messages(message_id);

INSERT INTO processed_messages (message_id, ...)
VALUES (:id, ...);

Duplicate insert fails with unique constraint violation.
```

### Idempotent Operations

**Design operations to be safe to repeat:**

**Set operations (idempotent):**
```
SET user_status = "active"
Repeat: Still "active" (same result)
```

**Increment operations (not idempotent):**
```
INCREMENT counter
Repeat: Different result each time
```

**Making increment idempotent:**
```
Instead of: INCREMENT counter BY 5
Use: SET counter = counter + 5 WHERE last_update_id < message_id
```

**Conditional updates (idempotent):**
```
UPDATE orders
SET status = "shipped"
WHERE order_id = 123 AND status = "paid";

Repeat: No effect if already shipped (idempotent)
```

---

## Exactly-Once Semantics

### Transactional Outbox Pattern

**Problem:** Writing to database and sending message not atomic.

**Pattern:**
```
BEGIN TRANSACTION
  -- Application write
  INSERT INTO orders (...) VALUES (...)

  -- Outbox write
  INSERT INTO outbox (event_type, payload)
  VALUES ('order_created', '...')
COMMIT

Separate process:
  Read from outbox
  Send to message broker
  Delete from outbox
```

**Guarantees:**
- Database write and outbox write are atomic
- Message guaranteed to be sent (eventually)
- Idempotent message processing handles duplicates

### Transactional Inbox Pattern

**Problem:** Processing message and updating state not atomic.

**Pattern:**
```
BEGIN TRANSACTION
  -- Check if already processed
  IF NOT EXISTS (SELECT 1 FROM inbox WHERE message_id = :id):
    -- Process message
    UPDATE orders SET status = "paid" WHERE order_id = :order_id

    -- Record processing
    INSERT INTO inbox (message_id) VALUES (:id)
COMMIT
```

**Guarantees:**
- Processing and dedup check are atomic
- No duplicate processing
- Exactly-once processing achieved

### Kafka Transactions

**Kafka supports transactions across multiple partitions:**

```
BEGIN TRANSACTION
  Send message to topic A, partition 1
  Send message to topic B, partition 2
  Commit consumer offsets for topic C
COMMIT TRANSACTION

All or nothing: Either all succeed or all fail.
```

**Exactly-once stream processing:**
```
read from input topic
process message
write to output topic
commit input offset
All in single transaction
```

**Requirements:**
- Producer must have transactional.id
- Consumer must set isolation.level=read_committed
- All reads/writes in transaction scope

### Database Change Data Capture (CDC)

**Capture database changes as events:**
```
Application writes to database
CDC tool (Debezium) tails database log
Publishes changes as events to Kafka
Consumers process events
```

**Benefits:**
- Single source of truth (database)
- No dual writes problem
- Guaranteed event delivery
- Ordered per record

---

## Time and Clocks

### Clock Types

**Physical clocks (wall-clock time):**
- Reports current date/time
- Synchronized with NTP
- Can go backward
- Subject to drift

**Logical clocks:**
- Lamport timestamps
- Vector clocks
- Track causality, not wall time

**Monotonic clocks:**
- Always move forward
- Measure elapsed time
- Not synchronized across machines

### Clock Synchronization Problems

**Clock drift:**
```
Server A: 10:00:00
Server B: 10:00:03 (3 seconds ahead)

Can cause:
- Incorrect ordering
- Lease expiry issues
- Inconsistent timestamps
```

**Clock skew:**
```
Server A: 10:00:00
Server B: 9:59:50 (10 seconds behind)

Can cause:
- Causality violations
- Incorrect timeouts
- Wrong event ordering
```

**NTP adjustments:**
```
Clock running fast: NTP slows it down (or steps backward)
Clock running slow: NTP speeds it up

Backward adjustments cause:
- Timestamps going backward
- Leases appearing to expire early
- Duplicate work
```

### Time-Based Ordering

**Last-Write-Wins (LWW) using timestamps:**
```
Write 1: value=A, timestamp=10:00:01.100
Write 2: value=B, timestamp=10:00:01.200

B wins (later timestamp)
```

**Problems:**
```
Node A: timestamp=10:00:01.300, clock fast
Node B: timestamp=10:00:01.200, clock slow

A's write wins due to clock skew, not actual order!
```

**Better approach: Logical clocks**
```
Use Lamport timestamps or vector clocks
These track causality, independent of wall time
```

### Hybrid Logical Clocks (HLC)

**Combine physical time with logical counters:**

**Structure:** (physical_time, logical_counter)

**Properties:**
- Resembles physical time (useful for humans)
- Provides logical clock guarantees
- Tracks causality

**Algorithm:**
```
On local event:
  physical = current_time()
  if physical > clock.physical:
    clock = (physical, 0)
  else:
    clock = (clock.physical, clock.logical + 1)

On receive message with timestamp T:
  physical = current_time()
  clock.physical = max(physical, T.physical)
  if clock.physical == T.physical:
    clock.logical = max(clock.logical, T.logical) + 1
  else:
    clock.logical = 0
```

**Benefits:**
- Bounded deviation from physical time
- Causality tracking
- No need for perfect clock synchronization

### Google Spanner TrueTime

**TrueTime API:**
```
TT.now() returns interval [earliest, latest]
True time is guaranteed to be in this interval
```

**Implementation:**
- GPS and atomic clocks
- Multiple time sources
- Bounded uncertainty (typically <7ms)

**Use:**
```
Start transaction
Wait until TT.now().earliest > transaction_start_time
Commit

Ensures all transactions see consistent ordering
```

**Key insight:** Explicitly model clock uncertainty.

### Timestamps in Distributed Systems

**Generating timestamps:**

**Option 1: Local clock (problematic)**
```
timestamp = Date.now()
Issues: Clock skew, drift, backward jumps
```

**Option 2: Centralized timestamp server**
```
timestamp = timestamp_server.get_timestamp()
Issues: Single point of failure, bottleneck
```

**Option 3: Logical clocks**
```
timestamp = lamport_clock.tick()
Benefits: No clock sync needed, tracks causality
```

**Option 4: Hybrid clocks**
```
timestamp = HLC.now()
Benefits: Physical time + causality
```

### Leases and Time

**Time-bounded leases:**
```
acquire_lease(resource, duration=30s)

Must renew before expiry:
  every 10s: renew_lease(resource, duration=30s)

If lease expires: automatically released
```

**Clock skew impact:**
```
Server A (clock fast): Acquires lease, thinks it has 30s
Server B (clock slow): Lease expires early from B's view

A thinks it still has lease
B gives lease to someone else
Split ownership!
```

**Solution: Clock-bound leases**
```
Lease duration >> max clock skew
Example: 30s lease, 1s max skew
Wait 1s after expiry before reuse
```

---

## Practical Patterns

### At-Least-Once with Idempotency

**Standard pattern for reliable processing:**

**Producer:**
```
while True:
  try:
    send_message(id=uuid, data=...)
    wait_for_ack()
    break
  except Timeout:
    retry
```

**Consumer:**
```
while True:
  message = receive()
  if not already_processed(message.id):
    process(message)
    mark_processed(message.id)
  ack(message)
```

### Exactly-Once with Transactions

**Atomic processing:**

```
BEGIN TRANSACTION
  -- Check deduplication
  IF NOT EXISTS (SELECT 1 FROM processed WHERE id = message.id):
    -- Process
    UPDATE orders SET status = "shipped"
    -- Record processed
    INSERT INTO processed (id) VALUES (message.id)
COMMIT

If transaction succeeds: Processed exactly once
If transaction fails: Retry (idempotent)
```

### Ordered Processing

**Maintain order with sequence numbers:**

```
expected_seq = get_last_seq() + 1

while True:
  message = receive()
  if message.seq < expected_seq:
    skip (duplicate)
  elif message.seq > expected_seq:
    buffer (out of order)
  else:
    process(message)
    expected_seq += 1
    process_buffered_messages()
```

### Time-Insensitive Design

**Avoid relying on wall-clock time:**

**Bad:**
```
if timestamp1 < timestamp2:
  # Depends on clock synchronization
```

**Good:**
```
if version1 < version2:
  # Explicit version numbers
```

**Bad:**
```
lease_expiry = now() + 30s
# Clock skew issues
```

**Good:**
```
lease_expiry = monotonic_clock() + 30s
# Use monotonic clock for durations
```

### Monitoring

**Track message metrics:**
- Delivery latency (p50, p95, p99)
- Processing latency
- Retry rate
- Duplicate rate
- Out-of-order rate

**Track clock metrics:**
- Clock skew across servers
- NTP offset
- Clock drift rate

**Alert on:**
- High retry rate (reliability issues)
- High duplicate rate (idempotency issues)
- Clock skew exceeding thresholds
- Message latency spikes
