---
sidebar_position: 3
---

## Connection Pools & PostgreSQL Internals

Understanding how database connections work, connection pooling strategies, and PostgreSQL's internal architecture is critical for building high-performance, scalable applications.

* * *

## Database Connections

### What is a Database Connection?

A database connection is a session between a client application and the database server. Each connection:
- Uses system resources (memory, file descriptors, TCP sockets)
- Has overhead for authentication and initialization
- Maintains transaction state and session variables
- Is expensive to create and destroy

### Cost of Creating Connections

```javascript
// Without pooling - creates new connection each time (SLOW)
async function queryDatabase() {
  const client = new Client({
    host: 'localhost',
    database: 'mydb',
    user: 'postgres',
    password: 'password'
  });

  await client.connect();  // ~50-200ms overhead!
  const result = await client.query('SELECT * FROM users WHERE id = $1', [1]);
  await client.end();

  return result;
}

// Typical overhead:
// - TCP handshake: 1-10ms
// - SSL negotiation: 10-50ms
// - Authentication: 10-50ms
// - Initial setup: 10-100ms
// Total: 50-200ms just to establish connection!
```

* * *

## Connection Pooling

Connection pooling reuses existing connections instead of creating new ones for each request.

### How Connection Pooling Works

```
Application Request Flow:
┌──────────┐
│ Request 1│──┐
└──────────┘  │
              ├──► ┌────────────────┐      ┌──────────────┐
┌──────────┐  │    │ Connection Pool│      │   Database   │
│ Request 2│──┼───►│ ┌──┐ ┌──┐ ┌──┐│◄────►│   Server     │
└──────────┘  │    │ │C1│ │C2│ │C3││      │              │
              │    │ └──┘ └──┘ └──┘│      └──────────────┘
┌──────────┐  │    │                │
│ Request 3│──┘    │ Idle: [C2, C3] │
└──────────┘       │ Active: [C1]   │
                   └────────────────┘

1. Request arrives, checkout connection from pool
2. Use connection to execute query
3. Return connection to pool (don't close!)
4. Connection ready for next request
```

### Benefits of Connection Pooling

1. **Performance**: Eliminates connection overhead (50-200ms saved per request)
2. **Resource Management**: Limits max connections to database
3. **Scalability**: Handles more concurrent requests with fewer connections
4. **Stability**: Prevents overwhelming the database with connections

* * *

## Connection Pooling in Node.js (pg)

### Basic Connection Pool

```javascript
const { Pool } = require('pg');

// Create pool with configuration
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  user: 'postgres',
  password: 'password',

  // Pool configuration
  max: 20,                    // Maximum pool size
  min: 5,                     // Minimum idle connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000,  // Wait 2s for available connection
});

// Use pool for queries
async function getUser(id) {
  // Pool automatically checks out & returns connection
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

// Explicit checkout (for multiple operations)
async function transferFunds(fromId, toId, amount) {
  const client = await pool.connect();  // Checkout connection

  try {
    await client.query('BEGIN');
    await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
    await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();  // Return to pool (IMPORTANT!)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();  // Close all connections
  process.exit(0);
});
```

* * *

## Connection Pool Internals — What Happens Under the Hood

When you execute `new Pool({...})`, here's exactly what happens internally in the pg (node-postgres) library.

### Step 1: Pool Initialization

```javascript
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  user: 'postgres',
  password: 'password',
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// What happens internally:
```

```
Pool Constructor Execution (synchronous):
┌────────────────────────────────────────────────────┐
│ new Pool(config) called                            │
└────────────────┬───────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────┐
│ Step 1: Initialize Pool State                     │
│                                                     │
│ this._clients = []        // Array of all clients  │
│ this._idle = []           // Queue of idle clients │
│ this._pendingQueue = []   // Waiting requests      │
│ this._pulseQueue = []     // Internal event queue  │
│                                                     │
│ this._connecting = false  // Connection in progress│
│ this._ended = false       // Pool shutdown flag    │
└────────────────┬───────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────┐
│ Step 2: Store Configuration                       │
│                                                     │
│ this.options = {                                   │
│   host: 'localhost',                               │
│   port: 5432,                                      │
│   database: 'mydb',                                │
│   user: 'postgres',                                │
│   password: 'password',                            │
│   max: 20,        ← Maximum pool size              │
│   min: 5,         ← Minimum idle connections       │
│   idleTimeoutMillis: 30000,                        │
│   connectionTimeoutMillis: 2000,                   │
│   ...defaults                                      │
│ }                                                  │
└────────────────┬───────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────┐
│ Step 3: Setup Event Emitter                       │
│                                                     │
│ Pool extends EventEmitter                          │
│                                                     │
│ Available events:                                  │
│  - 'connect'   (new client connected)              │
│  - 'acquire'   (client checked out)                │
│  - 'remove'    (client removed from pool)          │
│  - 'error'     (error on idle client)              │
└────────────────┬───────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────┐
│ Step 4: NO CONNECTIONS CREATED YET!                │
│                                                     │
│ Important: Pool is "lazy"                          │
│  - Connections created on-demand                   │
│  - First query triggers first connection           │
│  - min idle connections NOT created immediately    │
│                                                     │
│ Current state:                                     │
│  _clients: []        ← Empty!                      │
│  _idle: []           ← Empty!                      │
│  totalCount: 0                                     │
│  idleCount: 0                                      │
└────────────────────────────────────────────────────┘

Pool creation time: < 1ms (just JavaScript object initialization)
No network calls, no database connections yet!
```

### Step 2: First Query Triggers Connection Creation

```javascript
// First query after pool creation
const result = await pool.query('SELECT NOW()');
```

```
First Query Execution Flow:
┌────────────────────────────────────────────────────┐
│ pool.query('SELECT NOW()') called                  │
└────────────────┬───────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────┐
│ Step 1: Check for Idle Connection                 │
│                                                     │
│ if (_idle.length > 0) {                            │
│   client = _idle.pop()  // Get from idle queue     │
│   return client         // Reuse existing          │
│ }                                                  │
│                                                     │
│ Current: _idle = [] (empty)                        │
│ Result: No idle connection available               │
└────────────────┬───────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────┐
│ Step 2: Check Pool Capacity                       │
│                                                     │
│ if (_clients.length < max) {                       │
│   // Can create new connection                     │
│ } else {                                           │
│   // Pool exhausted, must wait                     │
│ }                                                  │
│                                                     │
│ Current: _clients.length = 0, max = 20             │
│ Result: Can create new connection ✓                │
└────────────────┬───────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────┐
│ Step 3: Create New Client                         │
│                                                     │
│ const client = new Client({                        │
│   host: 'localhost',                               │
│   port: 5432,                                      │
│   database: 'mydb',                                │
│   user: 'postgres',                                │
│   password: 'password'                             │
│ })                                                 │
│                                                     │
│ _clients.push(client)  // Add to pool              │
│ totalCount: 0 → 1                                  │
└────────────────┬───────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────┐
│ Step 4: Connect to Database (async)               │
│                                                     │
│ await client.connect()                             │
│                                                     │
│ Internally calls:                                  │
│  1. TCP socket connection                          │
│     net.createConnection(port, host)               │
│     Time: ~1-10ms                                  │
│                                                     │
│  2. SSL/TLS handshake (if enabled)                 │
│     tls.connect(socket, options)                   │
│     Time: ~10-50ms                                 │
│                                                     │
│  3. PostgreSQL startup packet                      │
│     Send: { user, database, options }              │
│     Time: ~5-10ms                                  │
│                                                     │
│  4. Authentication                                 │
│     - Server sends auth request                    │
│     - Client sends credentials                     │
│     - Server sends auth OK                         │
│     Time: ~10-50ms                                 │
│                                                     │
│  5. Ready for query message                        │
│     Server sends: 'Z' (ReadyForQuery)              │
│     Time: ~1-5ms                                   │
│                                                     │
│ Total connection time: ~50-200ms                   │
└────────────────┬───────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────┐
│ Step 5: Setup Client Event Handlers               │
│                                                     │
│ client.on('error', (err) => {                      │
│   // Remove from pool if error on idle client      │
│   _remove(client)                                  │
│   pool.emit('error', err, client)                  │
│ })                                                 │
│                                                     │
│ client.on('end', () => {                           │
│   // Connection closed, remove from pool           │
│   _remove(client)                                  │
│ })                                                 │
└────────────────┬───────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────┐
│ Step 6: Attach Pool Methods to Client             │
│                                                     │
│ client._poolUseCount = 0                           │
│ client._pool = pool  // Reference back to pool     │
│                                                     │
│ // Override release() method                       │
│ client.release = (err) => {                        │
│   if (err) {                                       │
│     _remove(client)  // Error, destroy connection  │
│   } else {                                         │
│     _idle.push(client)  // Return to idle queue    │
│     _pulseIdleTimeout(client)  // Start idle timer │
│   }                                                │
│   _attemptConnection()  // Try to fulfill pending  │
│ }                                                  │
└────────────────┬───────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────┐
│ Step 7: Emit 'connect' Event                      │
│                                                     │
│ pool.emit('connect', client)                       │
│                                                     │
│ User code can listen:                              │
│ pool.on('connect', (client) => {                   │
│   console.log('New connection created')            │
│ })                                                 │
└────────────────┬───────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────┐
│ Step 8: Execute Query                             │
│                                                     │
│ const result = await client.query('SELECT NOW()') │
│                                                     │
│ Query is sent over the TCP socket to PostgreSQL   │
└────────────────┬───────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────┐
│ Step 9: Auto-Release (pool.query)                 │
│                                                     │
│ Because we used pool.query() not pool.connect():  │
│                                                     │
│ client.release()  // Automatically called          │
│                                                     │
│ _idle.push(client)  // Client returned to pool     │
│                                                     │
│ Pool state:                                        │
│  _clients: [client1]  ← 1 total connection         │
│  _idle: [client1]     ← 1 idle connection          │
│  totalCount: 1                                     │
│  idleCount: 1                                      │
└────────────────────────────────────────────────────┘
```

### Pool State Management — Internal Data Structures

```javascript
// Simplified internal implementation of Pool class

class Pool extends EventEmitter {
  constructor(options) {
    super();

    // === Core State ===
    this._clients = [];        // All clients (idle + active)
    this._idle = [];           // Queue of idle clients (LIFO - stack)
    this._pendingQueue = [];   // Requests waiting for connection

    // === Configuration ===
    this.options = {
      max: options.max || 10,
      min: options.min || 0,
      idleTimeoutMillis: options.idleTimeoutMillis || 10000,
      connectionTimeoutMillis: options.connectionTimeoutMillis || 0,
      ...options
    };

    // === Flags ===
    this._connecting = false;  // Prevent concurrent connection creation
    this._ended = false;       // Pool has been shut down

    // === Timers ===
    this._idleTimeouts = new Map();  // Map<Client, TimeoutId>
  }

  // Get connection from pool
  async connect() {
    if (this._ended) {
      throw new Error('Pool has ended');
    }

    // 1. Try to get idle connection
    if (this._idle.length > 0) {
      const client = this._idle.pop();
      this._clearIdleTimeout(client);
      this.emit('acquire', client);
      return client;
    }

    // 2. Create new connection if below max
    if (this._clients.length < this.options.max) {
      return await this._createConnection();
    }

    // 3. Wait for available connection
    return await this._waitForConnection();
  }

  // Simplified query method
  async query(text, values) {
    const client = await this.connect();

    try {
      const result = await client.query(text, values);
      client.release();  // Return to pool
      return result;
    } catch (err) {
      client.release(err);  // Remove from pool on error
      throw err;
    }
  }

  // Create new connection
  async _createConnection() {
    this._connecting = true;

    try {
      const client = new Client(this.options);

      // Connect to database (TCP + auth)
      await client.connect();

      // Add to pool
      this._clients.push(client);

      // Setup error handling
      client.on('error', (err) => {
        this._remove(client);
        this.emit('error', err, client);
      });

      // Attach release method
      client.release = (err) => {
        if (err || client._ending) {
          this._remove(client);
        } else {
          this._idle.push(client);
          this._startIdleTimeout(client);
          this._attemptConnection();  // Try to fulfill pending requests
        }
      };

      this.emit('connect', client);
      this.emit('acquire', client);

      return client;

    } finally {
      this._connecting = false;
    }
  }

  // Wait for connection (when pool is full)
  async _waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = this.options.connectionTimeoutMillis;

      // Add to pending queue
      const pendingItem = { resolve, reject };
      this._pendingQueue.push(pendingItem);

      // Set timeout if configured
      if (timeout) {
        const timer = setTimeout(() => {
          this._pendingQueue = this._pendingQueue.filter(i => i !== pendingItem);
          reject(new Error('timeout acquiring client from pool'));
        }, timeout);

        pendingItem.timeout = timer;
      }
    });
  }

  // Try to fulfill pending requests
  _attemptConnection() {
    if (this._pendingQueue.length === 0) return;
    if (this._idle.length === 0) return;

    const client = this._idle.pop();
    const pending = this._pendingQueue.shift();

    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }

    this._clearIdleTimeout(client);
    this.emit('acquire', client);
    pending.resolve(client);
  }

  // Start idle timeout timer
  _startIdleTimeout(client) {
    if (!this.options.idleTimeoutMillis) return;

    const timeout = setTimeout(() => {
      this._removeIdleClient(client);
    }, this.options.idleTimeoutMillis);

    this._idleTimeouts.set(client, timeout);
  }

  // Clear idle timeout
  _clearIdleTimeout(client) {
    const timeout = this._idleTimeouts.get(client);
    if (timeout) {
      clearTimeout(timeout);
      this._idleTimeouts.delete(client);
    }
  }

  // Remove idle client (timeout expired)
  _removeIdleClient(client) {
    this._idle = this._idle.filter(c => c !== client);
    this._remove(client);
  }

  // Remove client from pool
  _remove(client) {
    this._clients = this._clients.filter(c => c !== client);
    this._idle = this._idle.filter(c => c !== client);
    this._clearIdleTimeout(client);

    client.end();  // Close connection
    this.emit('remove', client);
  }

  // Getters
  get totalCount() {
    return this._clients.length;
  }

  get idleCount() {
    return this._idle.length;
  }

  get waitingCount() {
    return this._pendingQueue.length;
  }

  // Shutdown pool
  async end() {
    this._ended = true;

    // Close all clients
    await Promise.all(this._clients.map(c => c.end()));

    this._clients = [];
    this._idle = [];

    // Reject pending requests
    this._pendingQueue.forEach(p => {
      if (p.timeout) clearTimeout(p.timeout);
      p.reject(new Error('Pool has ended'));
    });
    this._pendingQueue = [];
  }
}
```

### Visual: Pool State Over Time

```
Timeline of 5 concurrent requests:

T=0ms: Pool created
─────────────────────────────────────────
Pool state:
  _clients: []
  _idle: []
  _pendingQueue: []
  totalCount: 0
  idleCount: 0


T=10ms: Request 1 arrives (pool.query)
─────────────────────────────────────────
Pool state:
  _clients: []              ← No clients yet
  _idle: []
  _pendingQueue: []

Action: Create client1, connect to DB (50ms)


T=15ms: Request 2 arrives (pool.query)
─────────────────────────────────────────
Pool state:
  _clients: [client1]       ← Client1 connecting...
  _idle: []                 ← Not idle yet
  _pendingQueue: []

Action: Create client2, connect to DB (50ms)


T=20ms: Request 3 arrives (pool.query)
─────────────────────────────────────────
Pool state:
  _clients: [client1, client2]
  _idle: []
  _pendingQueue: []

Action: Create client3, connect to DB (50ms)


T=60ms: Client1 connected, query executed, released
─────────────────────────────────────────
Pool state:
  _clients: [client1, client2, client3]
  _idle: [client1]          ← Client1 now idle!
  _pendingQueue: []
  totalCount: 3
  idleCount: 1

Action: Start idle timeout for client1


T=65ms: Request 4 arrives (pool.query)
─────────────────────────────────────────
Pool state:
  _idle: [client1]          ← Reuse client1!

Action: Pop client1 from idle, execute query


T=65ms: Client2 connected, query executed, released
─────────────────────────────────────────
Pool state:
  _clients: [client1, client2, client3]
  _idle: [client2]          ← Client2 now idle
  _pendingQueue: []


T=70ms: Client3 connected, query executed, released
─────────────────────────────────────────
Pool state:
  _clients: [client1, client2, client3]
  _idle: [client2, client3] ← 2 idle connections
  _pendingQueue: []


T=75ms: Client1 query done, released
─────────────────────────────────────────
Pool state:
  _clients: [client1, client2, client3]
  _idle: [client2, client3, client1]  ← 3 idle (LIFO)
  _pendingQueue: []
  totalCount: 3
  idleCount: 3


T=100ms: Request 5 arrives
─────────────────────────────────────────
Action: Pop client1 from idle (last in, first out)
       Execute query immediately (no connection overhead!)


T=30100ms: Idle timeout expires (30 seconds later)
─────────────────────────────────────────
Pool state before:
  _idle: [client2, client3]
  totalCount: 3

Action: Close client2 and client3 (idle > 30s)

Pool state after:
  _clients: [client1]       ← Only active client remains
  _idle: []
  totalCount: 1
  idleCount: 0
```

### Connection Pool Exhaustion — What Happens

```
Scenario: max = 3, 5 concurrent requests

Request 1 → Create client1 (connecting...)
Request 2 → Create client2 (connecting...)
Request 3 → Create client3 (connecting...)
Request 4 → Pool full! Add to _pendingQueue
Request 5 → Pool full! Add to _pendingQueue

Pool state:
  _clients: [client1, client2, client3]
  _idle: []
  _pendingQueue: [promise4, promise5]
  totalCount: 3 (at max!)
  waitingCount: 2

─────────────────────────────────────────

Client1 finishes query, calls release():
  _idle.push(client1)
  _attemptConnection() called
    → Pop client1 from _idle
    → Resolve promise4 with client1
    → Request 4 now executing!

Pool state:
  _clients: [client1, client2, client3]
  _idle: []  ← client1 immediately reused
  _pendingQueue: [promise5]
  waitingCount: 1

─────────────────────────────────────────

Client2 finishes query, calls release():
  _idle.push(client2)
  _attemptConnection() called
    → Pop client2 from _idle
    → Resolve promise5 with client2
    → Request 5 now executing!

Pool state:
  _clients: [client1, client2, client3]
  _idle: []
  _pendingQueue: []
  waitingCount: 0

All requests fulfilled!
```

### Key Implementation Details

**1. Lazy Connection Creation:**
```javascript
const pool = new Pool({ max: 20, min: 5 });
// NO connections created yet!
// min: 5 is NOT enforced at creation time

// First query creates first connection
await pool.query('SELECT 1');
// Now: totalCount = 1

// More queries create more connections up to max
```

**2. LIFO (Last In, First Out) Idle Queue:**
```javascript
// Why LIFO? Better cache locality!
// Recently used connection → warmer CPU cache → faster

_idle = [client1, client2, client3]
         oldest   ↑        newest

pool.connect() → returns client3 (most recently used)
```

**3. Connection Timeout:**
```javascript
const pool = new Pool({
  max: 5,
  connectionTimeoutMillis: 2000  // Wait max 2s
});

// If pool exhausted for > 2s, throws error
try {
  await pool.query('SELECT 1');
} catch (err) {
  // Error: timeout acquiring client from pool
}
```

**4. Idle Timeout:**
```javascript
const pool = new Pool({
  idleTimeoutMillis: 30000  // Close idle connections after 30s
});

// Connection used → released → starts 30s timer
// If not reused within 30s → client.end() called
// Prevents holding idle connections indefinitely
```

**5. Error Handling:**
```javascript
// Error on active query → remove from pool
client.query('BAD SQL').catch(err => {
  client.release(err);  // err passed → removes from pool
});

// Error on idle connection → automatically removed
client.on('error', (err) => {
  pool._remove(client);
  pool.emit('error', err, client);
});
```

### Memory Layout

```
Pool Object in Memory:
┌────────────────────────────────────────┐
│ Pool Instance                          │
│  Size: ~500 bytes + client references  │
├────────────────────────────────────────┤
│ options: Object (200 bytes)            │
│  - max: 20                             │
│  - min: 5                              │
│  - idleTimeoutMillis: 30000            │
│  - connectionTimeoutMillis: 2000       │
│  - host, port, user, password, etc.    │
├────────────────────────────────────────┤
│ _clients: Array (8 bytes per ref)      │
│  [0] → Client1 (5-10 MB)               │
│  [1] → Client2 (5-10 MB)               │
│  [2] → Client3 (5-10 MB)               │
├────────────────────────────────────────┤
│ _idle: Array (references, not copies)  │
│  [0] → Client2 ─┐                      │
│  [1] → Client3 ─┤ Same objects as above│
│                 │                      │
├────────────────────────────────────────┤
│ _pendingQueue: Array                   │
│  [0] → Promise { resolve, reject }     │
│  [1] → Promise { resolve, reject }     │
├────────────────────────────────────────┤
│ _idleTimeouts: Map                     │
│  Client2 → TimeoutID                   │
│  Client3 → TimeoutID                   │
└────────────────────────────────────────┘

Total memory (with 3 connections):
- Pool object: ~500 bytes
- 3 clients × 8MB avg: ~24 MB
- Idle queue refs: 16 bytes
- Pending promises: ~100 bytes each
- TOTAL: ~25 MB
```

### Performance Characteristics

```
Operation               Time Complexity    Notes
──────────────────────────────────────────────────────
pool.query() (idle)     O(1)              Pop from _idle array
pool.query() (create)   O(1) + 50-200ms   Array push + TCP connect
pool.query() (wait)     O(n)              Wait in queue (n = waiting)
client.release()        O(1)              Push to _idle, update queue
pool.end()              O(n)              Close n connections

Memory:                 O(n)              n = totalCount (active + idle)
```

* * *

### Pool Configuration Deep Dive

```javascript
const pool = new Pool({
  // === Connection Settings ===
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  user: 'postgres',
  password: 'password',

  // === Pool Size ===
  max: 20,
  // Maximum connections in pool
  // Formula: max = (num_cores * 2) + effective_spindle_count
  // For CPU-bound: max = num_cores
  // For I/O-bound: max = num_cores * 2-4

  min: 5,
  // Minimum idle connections maintained
  // Keeps connections warm, reduces cold-start latency

  // === Timeouts ===
  idleTimeoutMillis: 30000,
  // Close idle connections after 30s
  // Prevents holding connections unnecessarily

  connectionTimeoutMillis: 2000,
  // Max wait time to acquire connection from pool
  // Throws error if no connection available

  // === Statement Timeout ===
  statement_timeout: 10000,
  // Abort queries that run longer than 10s
  // Prevents runaway queries

  // === Keep-alive ===
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Send TCP keep-alive packets
  // Prevents connection drops from firewalls/load balancers

  // === Query Timeout ===
  query_timeout: 5000,
  // Client-side query timeout (different from statement_timeout)
});
```

### Pool Sizing Guidelines

```javascript
// Small API (< 100 req/s)
const smallPool = new Pool({ max: 10, min: 2 });

// Medium API (100-1000 req/s)
const mediumPool = new Pool({ max: 20, min: 5 });

// Large API (> 1000 req/s)
const largePool = new Pool({ max: 50, min: 10 });

// Calculation Example:
// - Server has 8 cores
// - I/O-bound workload (typical web app)
// - Recommended max = 8 * 2 = 16-32 connections
```

**Important**: More connections ≠ better performance. Too many connections:
- Increase memory usage on database server
- Cause context switching overhead
- Lead to lock contention
- May overwhelm database

### Pool Events & Monitoring

```javascript
// Monitor pool activity
pool.on('connect', (client) => {
  console.log('New client connected to pool');
});

pool.on('acquire', (client) => {
  console.log('Client checked out from pool');
});

pool.on('remove', (client) => {
  console.log('Client removed from pool');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// Check pool stats
console.log('Total clients:', pool.totalCount);
console.log('Idle clients:', pool.idleCount);
console.log('Waiting requests:', pool.waitingCount);
```

* * *

## Connection Pooling in TypeORM

TypeORM uses the underlying driver's connection pooling.

```typescript
import { DataSource } from "typeorm";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "postgres",
  password: "password",
  database: "mydb",

  // Connection pool settings
  extra: {
    max: 20,                    // Maximum pool size
    min: 5,                     // Minimum idle connections
    idleTimeoutMillis: 30000,   // Idle timeout
    connectionTimeoutMillis: 2000,
  },

  // Other settings
  synchronize: false,
  logging: false,
  entities: ["src/entities/**/*.ts"],
});

// TypeORM manages pool automatically
const userRepository = AppDataSource.getRepository(User);
const users = await userRepository.find();  // Uses pooled connection
```

* * *

## External Connection Poolers

For production systems with many application instances, use external poolers.

### PgBouncer

PgBouncer is a lightweight connection pooler for PostgreSQL.

**Architecture:**
```
┌──────┐ ┌──────┐ ┌──────┐
│App 1 │ │App 2 │ │App 3 │
└──┬───┘ └──┬───┘ └──┬───┘
   │ 100    │ 100    │ 100  (Each app opens 100 connections)
   │conn    │conn    │conn
   └────┬───┴────┬───┴────
        │        │
    ┌───▼────────▼───┐
    │   PgBouncer    │
    │                │
    │  Pool: 50 conn │
    └────────┬───────┘
             │ 50 connections
    ┌────────▼───────┐
    │   PostgreSQL   │
    │                │
    └────────────────┘

Without PgBouncer: 300 database connections
With PgBouncer: 50 database connections
```

**Installation:**
```bash
# Ubuntu/Debian
sudo apt install pgbouncer

# macOS
brew install pgbouncer
```

**Configuration (pgbouncer.ini):**
```ini
[databases]
mydb = host=localhost port=5432 dbname=mydb

[pgbouncer]
listen_addr = *
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool mode
pool_mode = transaction  # or session, statement

# Pool size
max_client_conn = 1000   # Max client connections
default_pool_size = 25   # Connections per database
reserve_pool_size = 5    # Emergency reserve
max_db_connections = 50  # Hard limit per database

# Timeouts
server_idle_timeout = 600
server_connect_timeout = 15
```

**Pool Modes:**
- **Session**: Connection held for entire client session (default for compatibility)
- **Transaction**: Connection held only during transaction (recommended)
- **Statement**: Connection returned after each statement (rare use)

**Connect via PgBouncer:**
```javascript
const pool = new Pool({
  host: 'localhost',
  port: 6432,  // PgBouncer port (not 5432!)
  database: 'mydb',
  user: 'postgres',
  password: 'password',
  max: 100,  // Can be high since PgBouncer manages actual DB connections
});
```

### PgBouncer vs Application Pooling

**Use PgBouncer when:**
- Multiple application instances
- High connection count (>100)
- Microservices architecture
- Lambda/serverless functions

**Use Application Pooling when:**
- Single application instance
- Low connection count (<50)
- Full control needed over connection lifecycle

* * *

## PostgreSQL Process Model

### Architecture Overview

```
┌─────────────────────────────────────────────────┐
│          PostgreSQL Server Process              │
│                                                  │
│  ┌────────────────────────────────────────┐    │
│  │         Postmaster (Main Process)      │    │
│  │  - Listens for connections (port 5432) │    │
│  │  - Spawns backend processes            │    │
│  └──────────────┬─────────────────────────┘    │
│                 │                               │
│     Spawns backend per connection               │
│                 │                               │
│  ┌──────────────▼──────────────────────┐       │
│  │       Backend Processes             │       │
│  │  ┌─────┐  ┌─────┐  ┌─────┐         │       │
│  │  │Back │  │Back │  │Back │  ...    │       │
│  │  │end 1│  │end 2│  │end 3│         │       │
│  │  └─────┘  └─────┘  └─────┘         │       │
│  │   (One per client connection)       │       │
│  └─────────────────────────────────────┘       │
│                                                  │
│  ┌─────────────────────────────────────┐       │
│  │      Background Processes           │       │
│  │  - WAL Writer (Write-Ahead Log)     │       │
│  │  - Background Writer                │       │
│  │  - Autovacuum Workers               │       │
│  │  - Checkpointer                     │       │
│  │  - Stats Collector                  │       │
│  └─────────────────────────────────────┘       │
│                                                  │
│  ┌─────────────────────────────────────┐       │
│  │       Shared Memory                 │       │
│  │  - Shared Buffers (cache)           │       │
│  │  - WAL Buffers                      │       │
│  │  - Lock Tables                      │       │
│  └─────────────────────────────────────┘       │
└─────────────────────────────────────────────────┘
```

### Process-Per-Connection Model

PostgreSQL uses a **process-per-connection** model (not thread-based):

```sql
-- View active connections (backend processes)
SELECT
  pid,              -- Process ID
  usename,          -- Database user
  application_name,
  client_addr,
  state,
  query,
  backend_start
FROM pg_stat_activity;
```

**Why Processes, Not Threads?**
1. **Isolation**: Process crash doesn't affect others
2. **Security**: Memory isolation between connections
3. **Portability**: Works across all Unix-like systems
4. **Stability**: Easier to debug and manage

**Downside**: Higher memory overhead (each process uses 5-10MB)

### Connection Lifecycle

```
1. Client connects to port 5432
         ↓
2. Postmaster authenticates client
         ↓
3. Postmaster forks new backend process
         ↓
4. Backend process handles queries
         ↓
5. Client disconnects
         ↓
6. Backend process terminates
```

* * *

## How Application-Database Communication Works Under the Hood

Understanding exactly what happens when your application connects to a database and executes queries is critical for building high-performance systems.

### Complete Connection Flow — TCP to SQL

When you execute `pool.query('SELECT * FROM users WHERE id = 1')`, here's what happens step by step:

```
Application Layer (Node.js/TypeORM)
         │
         │ 1. Application requests connection from pool
         ↓
    ┌─────────────────┐
    │ Connection Pool │ ← Checks if idle connection available
    └────────┬────────┘
             │ 2a. If available: Return existing connection (0ms)
             │ 2b. If none available: Create new connection (50-200ms)
             ↓
    ─────────────────────────────────────
    Network Layer (TCP/IP)
    ─────────────────────────────────────
             │
             │ 3. TCP Connection (if new)
             ↓
    ┌──────────────────────────────────┐
    │ TCP 3-Way Handshake             │
    │  App → DB: SYN                  │
    │  DB → App: SYN-ACK              │
    │  App → DB: ACK                  │
    │  Time: ~1-10ms (local network)  │
    └────────┬─────────────────────────┘
             │
             │ 4. SSL/TLS Handshake (if enabled)
             ↓
    ┌──────────────────────────────────┐
    │ SSL Negotiation                 │
    │  - Certificate exchange          │
    │  - Cipher negotiation            │
    │  Time: ~10-50ms                  │
    └────────┬─────────────────────────┘
             │
             │ 5. PostgreSQL Authentication
             ↓
    ┌──────────────────────────────────┐
    │ Authentication Protocol         │
    │  - Send username/password        │
    │  - Server validates              │
    │  - Server sends auth OK          │
    │  Time: ~10-50ms                  │
    └────────┬─────────────────────────┘
             │
    ─────────────────────────────────────
    PostgreSQL Server
    ─────────────────────────────────────
             │
             │ 6. Postmaster spawns backend process
             ↓
    ┌──────────────────────────────────┐
    │ Postmaster (Main Process)       │
    │  - fork() creates new process    │
    │  - Assigns dedicated backend     │
    │  Time: ~5-10ms                   │
    └────────┬─────────────────────────┘
             │
             │ 7. Backend process initialization
             ↓
    ┌──────────────────────────────────┐
    │ Backend Process Setup           │
    │  - Allocate process memory       │
    │  - Set session variables         │
    │  - Connect to shared buffers     │
    │  Time: ~5-20ms                   │
    └────────┬─────────────────────────┘
             │
             │ CONNECTION ESTABLISHED ✓
             │ Total Time: 50-200ms (first time)
             │             0-5ms (pooled connection)
             │
             │ 8. Send SQL query
             ↓
    ┌──────────────────────────────────┐
    │ Query Text (over TCP)           │
    │  "SELECT * FROM users WHERE..." │
    └────────┬─────────────────────────┘
             │
             │ 9. Query parsing & planning
             ↓
    ┌──────────────────────────────────┐
    │ Parser                          │
    │  - Lexical analysis              │
    │  - Syntax validation             │
    │  - Build parse tree              │
    │  Time: ~0.1-1ms                  │
    └────────┬─────────────────────────┘
             │
             ↓
    ┌──────────────────────────────────┐
    │ Planner/Optimizer               │
    │  - Check statistics              │
    │  - Evaluate index usage          │
    │  - Generate execution plan       │
    │  Time: ~0.5-5ms                  │
    └────────┬─────────────────────────┘
             │
             │ 10. Query execution
             ↓
    ┌──────────────────────────────────┐
    │ Executor                        │
    │  - Check shared buffers (cache) │
    │  - Read from disk if needed      │
    │  - Apply WHERE filters           │
    │  - Return matching rows          │
    │  Time: ~1-100ms (depends on data)│
    └────────┬─────────────────────────┘
             │
             │ 11. Results sent back
             ↓
    ─────────────────────────────────────
    Network Layer
    ─────────────────────────────────────
             │
             │ 12. TCP packets with result rows
             ↓
    ┌──────────────────────────────────┐
    │ Result Set Transfer             │
    │  - Row data serialized           │
    │  - Sent over TCP connection      │
    │  Time: ~0.1-10ms per 1000 rows   │
    └────────┬─────────────────────────┘
             │
             ↓
    ─────────────────────────────────────
    Application Layer
    ─────────────────────────────────────
             │
             │ 13. Application receives results
             ↓
    ┌──────────────────────────────────┐
    │ pg Driver Parses Response       │
    │  - Deserialize binary data       │
    │  - Convert to JavaScript objects │
    │  Time: ~0.1-5ms per 1000 rows    │
    └────────┬─────────────────────────┘
             │
             │ 14. Return connection to pool
             ↓
    ┌─────────────────┐
    │ Connection Pool │ ← Connection marked as idle
    └─────────────────┘

TOTAL QUERY TIME (pooled connection):
- Parsing + Planning: ~1-6ms
- Execution: ~1-100ms (depends on data)
- Network transfer: ~0.2-15ms
- Total: ~2-121ms (typical: 5-20ms)
```

### Why Connection Pooling Saves So Much Time

```
WITHOUT POOLING (every request):
┌───────────────────────────────────────┐
│ Request 1                             │
│  TCP handshake:        5ms            │
│  SSL handshake:       20ms            │
│  Authentication:      30ms            │
│  Backend spawn:       10ms            │
│  Backend init:        15ms            │
│  ─────────────────────────            │
│  Connection setup:    80ms ← OVERHEAD │
│  Query execution:     10ms            │
│  TOTAL:              90ms             │
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│ Request 2                             │
│  TCP handshake:        5ms            │
│  SSL handshake:       20ms            │
│  Authentication:      30ms            │
│  Backend spawn:       10ms            │
│  Backend init:        15ms            │
│  ─────────────────────────            │
│  Connection setup:    80ms ← OVERHEAD │
│  Query execution:     10ms            │
│  TOTAL:              90ms             │
└───────────────────────────────────────┘

100 requests = 9000ms (9 seconds!)


WITH POOLING (reuse connections):
┌───────────────────────────────────────┐
│ Request 1 (first time)                │
│  Connection setup:    80ms            │
│  Query execution:     10ms            │
│  TOTAL:              90ms             │
│  → Return to pool                     │
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│ Request 2 (reuse connection)          │
│  Get from pool:        0ms            │
│  Query execution:     10ms            │
│  TOTAL:              10ms ← 9x faster!│
│  → Return to pool                     │
└───────────────────────────────────────┘

100 requests = 90ms + (99 × 10ms) = 1080ms (1 second!)

Performance improvement: 9000ms → 1080ms (8.3x faster!)
```

* * *

## How PostgreSQL Handles Concurrent Reads and Writes at Scale

The real challenge comes when hundreds or thousands of queries are happening simultaneously. Here's how PostgreSQL manages concurrent operations.

### Concurrent Query Execution Model

```
Timeline View: 5 Concurrent Queries

Time →
─────────────────────────────────────────────────────
                PostgreSQL Server
─────────────────────────────────────────────────────

Backend Process 1 (SELECT)
├─ T=0ms:    Receive query
├─ T=1ms:    Parse & plan
├─ T=2ms:    Check shared buffers (CACHE HIT)
├─ T=3ms:    Read data from cache
├─ T=4ms:    Send results ✓
└─ DONE (4ms total)

Backend Process 2 (SELECT - same data)
├─ T=0ms:    Receive query
├─ T=1ms:    Parse & plan
├─ T=2ms:    Check shared buffers (CACHE HIT)
├─ T=3ms:    Read data from cache
├─ T=4ms:    Send results ✓
└─ DONE (4ms total)

Backend Process 3 (INSERT)
├─ T=0ms:    BEGIN transaction
├─ T=1ms:    Parse & plan
├─ T=2ms:    Acquire ROW EXCLUSIVE lock on table
├─ T=3ms:    Write to WAL buffer
├─ T=4ms:    Update table page in shared buffers
├─ T=5ms:    COMMIT
├─ T=6ms:    Flush WAL to disk (fsync)
├─ T=7ms:    Release locks
├─ T=8ms:    Send ACK ✓
└─ DONE (8ms total)

Backend Process 4 (UPDATE)
├─ T=0ms:    BEGIN transaction
├─ T=1ms:    Parse & plan
├─ T=2ms:    Try to acquire ROW EXCLUSIVE lock
├─ T=3ms:    WAIT (Process 3 has lock)
├─ T=4ms:    WAIT
├─ T=5ms:    WAIT
├─ T=6ms:    WAIT
├─ T=7ms:    Lock acquired (Process 3 released)
├─ T=8ms:    Write to WAL buffer
├─ T=9ms:    Update table page
├─ T=10ms:   COMMIT & fsync
├─ T=11ms:   Release locks
├─ T=12ms:   Send ACK ✓
└─ DONE (12ms total, 4ms blocked by lock contention)

Backend Process 5 (SELECT with JOIN)
├─ T=0ms:    Receive query
├─ T=1ms:    Parse & plan (complex query)
├─ T=2ms:    Check shared buffers (PARTIAL HIT)
├─ T=3ms:    Read remaining from disk (I/O)
├─ T=5ms:    ... disk read continues ...
├─ T=10ms:   ... disk read continues ...
├─ T=15ms:   Data loaded, perform JOIN
├─ T=18ms:   Sort results
├─ T=20ms:   Send results ✓
└─ DONE (20ms total, slow due to disk I/O)

KEY INSIGHTS:
─────────────────────────────────────────────────────
1. READs don't block each other (MVCC)
2. WRITEs acquire locks (can block other writes)
3. Shared buffers = critical for read performance
4. Disk I/O = major bottleneck (15ms vs 2ms cached)
5. Lock contention = major bottleneck for writes
```

### MVCC: How Reads and Writes Don't Block Each Other

PostgreSQL uses **Multi-Version Concurrency Control (MVCC)** to allow reads and writes to happen concurrently without blocking.

```
Traditional Locking (NOT how PostgreSQL works):
─────────────────────────────────────────────────────
Transaction A                Transaction B
─────────────────────────────────────────────────────
BEGIN;
UPDATE users                 SELECT * FROM users;
SET name = 'Alice'           ← BLOCKED (waiting for A)
WHERE id = 1;                ← BLOCKED
                             ← BLOCKED
                             ← BLOCKED
COMMIT; ✓
                             ← Now can read ✓

Result: Writes block reads (BAD for performance!)


PostgreSQL MVCC (how it actually works):
─────────────────────────────────────────────────────
Transaction A                Transaction B
─────────────────────────────────────────────────────
BEGIN;
UPDATE users                 SELECT * FROM users
SET name = 'Alice'           WHERE id = 1;
WHERE id = 1;
                             Reads OLD version! ✓
                             Returns: Bob
[Old row: Bob]  ← Still visible to B
[New row: Alice] ← Only visible after A commits

COMMIT; ✓

                             SELECT * FROM users
                             WHERE id = 1;
                             Now returns: Alice ✓

Result: Writes don't block reads! (GOOD for performance!)
```

### Under the Hood: How MVCC Works with Transaction IDs

Every row in PostgreSQL has hidden columns that track versioning:

```sql
-- Actual table structure (simplified)
CREATE TABLE users (
  id INT,
  name TEXT,

  -- Hidden columns (PostgreSQL adds these automatically)
  xmin BIGINT,     -- Transaction ID that created this row
  xmax BIGINT,     -- Transaction ID that deleted/updated this row
  ctid TID         -- Physical location of row version
);
```

```
Step-by-step example:

Initial state:
┌────┬───────┬──────┬──────┐
│ id │ name  │ xmin │ xmax │
├────┼───────┼──────┼──────┤
│ 1  │ Bob   │ 100  │ 0    │ ← xmin=100 (created by txn 100)
└────┴───────┴──────┴──────┘    xmax=0 (not deleted/updated)

Transaction A (txn_id = 200) starts:
BEGIN;
UPDATE users SET name = 'Alice' WHERE id = 1;

After UPDATE (before COMMIT):
┌────┬───────┬──────┬──────┐
│ id │ name  │ xmin │ xmax │
├────┼───────┼──────┼──────┤
│ 1  │ Bob   │ 100  │ 200  │ ← Old version (xmax=200 = being deleted by txn 200)
│ 1  │ Alice │ 200  │ 0    │ ← New version (xmin=200 = created by txn 200)
└────┴───────┴──────┴──────┘

Transaction B (txn_id = 201) runs SELECT:
SELECT * FROM users WHERE id = 1;

Visibility rules:
- Old row (Bob):   xmin=100 (committed ✓), xmax=200 (not committed yet ✓)
  → VISIBLE to txn 201
- New row (Alice): xmin=200 (not committed ✗)
  → NOT VISIBLE to txn 201

Transaction B sees: Bob

Transaction A commits:
COMMIT; (txn 200 is now committed)

┌────┬───────┬──────┬──────┬────────┐
│ id │ name  │ xmin │ xmax │ Status │
├────┼───────┼──────┼──────┼────────┤
│ 1  │ Bob   │ 100  │ 200  │ DEAD   │ ← Will be cleaned by VACUUM
│ 1  │ Alice │ 200  │ 0    │ LIVE   │ ← Now visible to new transactions
└────┴───────┴──────┴──────┴────────┘

Transaction C (txn_id = 202) runs SELECT:
SELECT * FROM users WHERE id = 1;

Visibility rules:
- Old row (Bob):   xmin=100 (committed ✓), xmax=200 (committed ✓ = deleted)
  → NOT VISIBLE
- New row (Alice): xmin=200 (committed ✓), xmax=0
  → VISIBLE

Transaction C sees: Alice
```

### Scaling Concurrent Reads

```
Read-Heavy Workload (typical web application):
─────────────────────────────────────────────────────
1000 requests/second, 90% reads, 10% writes

PostgreSQL handles reads efficiently:
┌─────────────────────────────────────────┐
│ Shared Buffers (RAM Cache)             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ Page │ │ Page │ │ Page │ │ Page │  │
│  │  1   │ │  2   │ │  3   │ │  4   │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
│                                         │
│ Multiple backend processes can read     │
│ the same cached page simultaneously     │
│ without any locking! (MVCC magic)       │
└─────────────────────────────────────────┘
              ↑           ↑           ↑
         Backend 1   Backend 2   Backend 3
         (SELECT)    (SELECT)    (SELECT)

All 3 reads happen in parallel: ~2-5ms each

Cache Hit Rate = Critical Metric:
- 99% hit rate:  2ms per query
- 90% hit rate:  2ms × 0.9 + 15ms × 0.1 = 3.3ms
- 50% hit rate:  2ms × 0.5 + 15ms × 0.5 = 8.5ms

At 1000 req/s with 50% cache hit rate:
- 500 queries: 2ms each (cached)
- 500 queries: 15ms each (disk I/O)
- Disk IOPS required: 500 IOPS

Scaling strategy:
1. Increase shared_buffers (more cache)
2. Add read replicas (distribute read load)
3. Use Redis/Memcached (application-level cache)
```

### Scaling Concurrent Writes

Writes are more challenging because they need locks:

```
Write-Heavy Workload:
─────────────────────────────────────────────────────
100 writes/second to same table

Without row-level locking (table-level lock):
┌────────────────────────────────────────┐
│ Table: users (locked)                  │
│                                         │
│ Write 1: IN PROGRESS (2ms)             │
│ Write 2: WAITING                        │
│ Write 3: WAITING                        │
│ Write 4: WAITING                        │
│ ...                                     │
│ Write 100: WAITING                      │
└────────────────────────────────────────┘

Throughput: ~500 writes/second (serialize all writes)


With row-level locking (PostgreSQL's approach):
┌────────────────────────────────────────┐
│ Table: users                           │
│                                         │
│ Row 1: Write A (2ms)                   │
│ Row 2: Write B (2ms) ← Parallel!       │
│ Row 3: Write C (2ms) ← Parallel!       │
│ Row 4: Write D (2ms) ← Parallel!       │
│ ...                                     │
└────────────────────────────────────────┘

Throughput: ~2000+ writes/second (parallel writes to different rows)


Bottleneck: Writing to SAME row
┌────────────────────────────────────────┐
│ Row 1:                                 │
│  Write A: IN PROGRESS (2ms)            │
│  Write B: WAITING (same row!)          │
│  Write C: WAITING (same row!)          │
└────────────────────────────────────────┘

This is called "lock contention" or "hot row problem"
```

### Hot Row Problem at Scale

```
Real-world example: E-commerce inventory

Table: products
┌────┬──────────┬───────┐
│ id │ name     │ stock │
├────┼──────────┼───────┤
│ 1  │ iPhone   │ 100   │ ← HOT ROW (popular product)
└────┴──────────┴───────┘

Black Friday: 1000 purchases/second

Each purchase runs:
BEGIN;
UPDATE products
SET stock = stock - 1
WHERE id = 1;  ← Tries to lock row 1
COMMIT;

Timeline (simplified):
T=0ms:   Purchase 1 acquires lock on row 1
T=0ms:   Purchase 2 tries lock → BLOCKED
T=0ms:   Purchase 3 tries lock → BLOCKED
T=0ms:   Purchase 4 tries lock → BLOCKED
         ... 996 more purchases BLOCKED ...
T=2ms:   Purchase 1 commits, releases lock
T=2ms:   Purchase 2 acquires lock
T=2ms:   Purchase 3 tries lock → BLOCKED
         ... still blocking ...
T=4ms:   Purchase 2 commits, releases lock
T=4ms:   Purchase 3 acquires lock
         ... serialized, slow!

Result: 1000 purchases take ~2000ms (2 seconds!)
Throughput: 500 updates/second on a SINGLE row

Solutions:
──────────────────────────────────────────

1. Pessimistic Locking with FOR UPDATE SKIP LOCKED
   (Job queue pattern - see Transactions & ACID docs)

2. Optimistic Locking with Version Number
   (Retry on conflict)

3. Eventual Consistency - Decrement Later
   (Accept order, update stock async)

4. Sharding/Partitioning
   (Distribute hot rows across multiple tables)

5. Application-Level Semaphore
   (Rate limit writes to hot rows)

6. Denormalization
   (Separate inventory by warehouse to reduce contention)
```

### Complete Example: Handling 10,000 Concurrent Connections

```
Scenario:
- Web application with 10,000 concurrent users
- Peak: 5,000 queries/second
- Mix: 80% reads, 20% writes

Architecture:

┌──────────────────────────────────────────┐
│ Application Layer (100 instances)       │
│                                          │
│ Each instance:                           │
│  - Pool size: 10 connections             │
│  - Total: 100 × 10 = 1000 connections    │
└────────────┬─────────────────────────────┘
             │
             │ 1000 app connections
             ↓
┌──────────────────────────────────────────┐
│ PgBouncer (Transaction Mode)            │
│                                          │
│ Config:                                  │
│  - max_client_conn: 2000                 │
│  - default_pool_size: 100                │
│  - pool_mode: transaction                │
│                                          │
│ Result: 1000 app connections →           │
│         100 database connections         │
└────────────┬─────────────────────────────┘
             │
             │ 100 database connections
             ↓
┌──────────────────────────────────────────┐
│ PostgreSQL Primary (Writes)             │
│                                          │
│ Config:                                  │
│  - max_connections: 200                  │
│  - shared_buffers: 8GB (25% of 32GB RAM)│
│  - work_mem: 32MB                        │
│  - effective_cache_size: 24GB            │
│                                          │
│ Handles:                                 │
│  - All writes: 1000/s                    │
│  - Some reads: 1000/s                    │
└────────────┬─────────────────────────────┘
             │
             │ Streaming replication
             ↓
┌──────────────────────────────────────────┐
│ PostgreSQL Read Replicas (×3)           │
│                                          │
│ Each replica handles:                    │
│  - Reads only: ~1000/s                   │
│  - Same config as primary                │
│                                          │
│ Total read capacity: 3000/s              │
└──────────────────────────────────────────┘

Performance Breakdown:
──────────────────────────────────────────
Writes (1000/s):
- All go to primary
- Average latency: 5ms (cached) to 20ms (with fsync)
- Lock contention: minimal (different rows)

Reads (4000/s):
- 1000/s from primary
- 3000/s from replicas (load balanced)
- Average latency: 2-5ms (99% cache hit rate)
- No blocking (MVCC)

Total throughput: 5000 queries/second ✓

Resource usage:
- Primary: ~60% CPU, 12GB RAM used
- Replicas: ~30% CPU each, 10GB RAM used
- PgBouncer: ~5% CPU, 500MB RAM

Why it works:
1. Connection pooling prevents overwhelming database
2. PgBouncer reduces connection overhead (1000 → 100)
3. Read replicas distribute read load
4. Shared buffers cache hot data
5. Row-level locks allow parallel writes
6. MVCC allows reads during writes
```

### Performance Impact: Sequential vs Parallel Query Execution

```
Scenario: Process 1000 orders

Sequential (single connection):
┌────────────────────────────────────────┐
│ Single Backend Process                 │
│                                         │
│ Query 1:   ████ (4ms)                  │
│ Query 2:       ████ (4ms)              │
│ Query 3:           ████ (4ms)          │
│ ...                                     │
│ Query 1000:                      ████  │
│                                         │
│ Total time: 1000 × 4ms = 4000ms (4s)  │
└────────────────────────────────────────┘


Parallel (10 connections from pool):
┌────────────────────────────────────────┐
│ Backend 1:  ████ ████ ████ ... (100 queries) │
│ Backend 2:  ████ ████ ████ ... (100 queries) │
│ Backend 3:  ████ ████ ████ ... (100 queries) │
│ Backend 4:  ████ ████ ████ ... (100 queries) │
│ Backend 5:  ████ ████ ████ ... (100 queries) │
│ Backend 6:  ████ ████ ████ ... (100 queries) │
│ Backend 7:  ████ ████ ████ ... (100 queries) │
│ Backend 8:  ████ ████ ████ ... (100 queries) │
│ Backend 9:  ████ ████ ████ ... (100 queries) │
│ Backend 10: ████ ████ ████ ... (100 queries) │
│                                         │
│ Total time: (1000/10) × 4ms = 400ms    │
└────────────────────────────────────────┘

Speedup: 10x faster!

But there's a limit:

Parallel (1000 connections - too many!):
┌────────────────────────────────────────┐
│ 1000 backend processes competing for:  │
│  - CPU (context switching overhead)     │
│  - Shared buffers (lock contention)     │
│  - Disk I/O (limited IOPS)              │
│                                         │
│ Overhead becomes bottleneck:            │
│  - Context switch: 0.1ms × 1000 = 100ms│
│  - Lock wait: 50ms avg                  │
│  - Cache thrashing: slower queries      │
│                                         │
│ Total time: ~1000ms (2.5x slower!)     │
└────────────────────────────────────────┘

Sweet spot: 2-4× CPU cores for connection pool
```

### Key Takeaways

**Connection Establishment:**
- First connection: expensive (50-200ms)
- Pooled connection: fast (0-5ms)
- Always use connection pooling in production

**Concurrent Reads:**
- Don't block each other (MVCC)
- Limited by: CPU, disk I/O, cache size
- Scale with: read replicas, bigger cache, better indexes

**Concurrent Writes:**
- Block on same row (row-level locks)
- Don't block on different rows
- Limited by: disk I/O (WAL writes), lock contention
- Scale with: partition data, optimize transactions, use queues

**At Scale:**
- Use PgBouncer for 100+ connections
- Monitor: cache hit rate, lock waits, disk I/O
- Optimize hot paths: index properly, denormalize carefully
- Add read replicas before vertical scaling

* * *

## PostgreSQL Memory Architecture

### Shared Memory

Memory shared across all processes:

```
┌─────────────────────────────────────────┐
│         Shared Memory Regions           │
├─────────────────────────────────────────┤
│  Shared Buffers (default: 128MB)       │
│  - Caches table & index pages           │
│  - LRU eviction policy                  │
│  - Recommended: 25% of RAM              │
├─────────────────────────────────────────┤
│  WAL Buffers (default: 16MB)            │
│  - Write-Ahead Log buffer               │
│  - Flushes to disk on commit            │
├─────────────────────────────────────────┤
│  Lock Tables                            │
│  - Manages table/row locks              │
└─────────────────────────────────────────┘
```

**Configure in postgresql.conf:**
```conf
# Shared Buffers (cache)
shared_buffers = 4GB  # 25% of total RAM (for dedicated DB server)

# WAL Buffers
wal_buffers = 16MB    # Default is usually fine

# Effective cache (OS + PG cache)
effective_cache_size = 12GB  # 50-75% of total RAM
```

### Per-Process Memory

Each backend process has its own memory:

```
┌─────────────────────────────────────────┐
│      Per-Backend Process Memory         │
├─────────────────────────────────────────┤
│  work_mem (default: 4MB)                │
│  - Memory for sorts, hashes, joins      │
│  - Per operation, not per connection!   │
│  - If query has 3 sorts, uses 3×work_mem│
├─────────────────────────────────────────┤
│  maintenance_work_mem (default: 64MB)   │
│  - For VACUUM, CREATE INDEX, etc.       │
├─────────────────────────────────────────┤
│  temp_buffers (default: 8MB)            │
│  - For temporary tables                 │
└─────────────────────────────────────────┘
```

**Configure in postgresql.conf:**
```conf
# Per-operation memory for sorts/hashes
work_mem = 16MB
# Formula: (Total RAM - shared_buffers) / (max_connections * 2-3)

# Maintenance operations
maintenance_work_mem = 256MB

# Temporary tables
temp_buffers = 8MB
```

**Example Calculation:**
```
Server: 16GB RAM, max_connections = 100

shared_buffers = 4GB (25% of RAM)
Remaining RAM = 12GB

work_mem = 12GB / (100 connections × 3 operations avg)
         = 12GB / 300
         = 40MB

Set work_mem = 32MB (conservative)
```

* * *

## Write-Ahead Logging (WAL)

WAL ensures durability and enables crash recovery.

### How WAL Works

```
Write Transaction Flow:
┌──────────────────────────────────────────────┐
│ 1. Client: BEGIN; UPDATE users SET ...;     │
│                                               │
│ 2. PostgreSQL writes changes to WAL buffer   │
│    (in memory)                                │
│         ↓                                     │
│ 3. Client: COMMIT;                           │
│         ↓                                     │
│ 4. PostgreSQL flushes WAL buffer to disk     │
│    (fsync - guarantees durability)            │
│         ↓                                     │
│ 5. COMMIT acknowledged to client             │
│         ↓                                     │
│ 6. Background writer eventually writes       │
│    actual data pages to disk (lazy)          │
└──────────────────────────────────────────────┘

Key Point: WAL written BEFORE data pages!
This allows fast recovery after crash.
```

### WAL Configuration

```conf
# WAL Settings (postgresql.conf)

# WAL level (amount of info logged)
wal_level = replica  # minimal, replica, or logical

# Synchronous commit (durability vs performance)
synchronous_commit = on
# on: Wait for WAL flush to disk (safe, slower)
# off: Don't wait (fast, risk losing last few transactions)
# local: Wait for local flush only

# WAL segment size
wal_segment_size = 16MB  # Usually don't change

# Checkpoint settings
checkpoint_timeout = 5min        # Max time between checkpoints
max_wal_size = 1GB               # Trigger checkpoint if WAL exceeds
min_wal_size = 80MB

# WAL buffers
wal_buffers = 16MB
```

### Checkpoints

Checkpoints flush dirty pages to disk and mark WAL position:

```
Timeline:
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ Changes │ Changes │ Changes │CHECKPOINT│ Changes │
│   to    │   to    │   to    │  Flush  │   to    │
│  WAL    │  WAL    │  WAL    │  all    │  WAL    │
│         │         │         │ dirty   │         │
│         │         │         │ pages   │         │
└─────────┴─────────┴─────────┴─────────┴─────────┘
   ^                             ^
   │                             │
   └─────── Can discard ─────────┘
   after checkpoint completes
```

**Checkpoint Tuning:**
```conf
# Spread checkpoint over time to reduce I/O spikes
checkpoint_completion_target = 0.9  # 90% of checkpoint_timeout

# Monitor checkpoints
SELECT * FROM pg_stat_bgwriter;
```

* * *

## Vacuum & Autovacuum

PostgreSQL uses MVCC (Multi-Version Concurrency Control), which creates dead tuples.

### Dead Tuples

```sql
-- Initial row
INSERT INTO users (id, name) VALUES (1, 'Alice');
-- Physical row: [id=1, name='Alice']

-- Update row
UPDATE users SET name = 'Alice Smith' WHERE id = 1;
-- Old row marked dead: [id=1, name='Alice'] ← DEAD TUPLE
-- New row created: [id=1, name='Alice Smith']

-- Both rows exist in table until VACUUM cleans up!
```

### Vacuum Process

```
┌─────────────────────────────────────┐
│          VACUUM Process             │
│                                      │
│  1. Scan table for dead tuples      │
│  2. Mark dead tuples as reusable    │
│  3. Update indexes                  │
│  4. Update statistics               │
│  5. Truncate empty pages (VACUUM FULL)│
└─────────────────────────────────────┘
```

**Manual Vacuum:**
```sql
-- Basic vacuum
VACUUM users;

-- Vacuum and analyze (update stats)
VACUUM ANALYZE users;

-- Full vacuum (rewrites table, locks table)
VACUUM FULL users;

-- Vacuum entire database
VACUUM;
```

### Autovacuum

Autovacuum runs automatically in background:

```conf
# postgresql.conf
autovacuum = on  # Enable autovacuum

# Trigger vacuum when...
autovacuum_vacuum_threshold = 50       # Base threshold
autovacuum_vacuum_scale_factor = 0.2   # 20% of table size

# Formula: threshold + (scale_factor × table_size)
# Example: 50 + (0.2 × 1000 rows) = 250 dead tuples triggers vacuum

# Max workers
autovacuum_max_workers = 3

# Vacuum delay (throttle to reduce I/O impact)
autovacuum_vacuum_cost_delay = 2ms
```

### Monitor Vacuum

```sql
-- Check last vacuum/autovacuum
SELECT
  schemaname,
  relname,
  last_vacuum,
  last_autovacuum,
  n_dead_tup,
  n_live_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;

-- Check autovacuum activity
SELECT * FROM pg_stat_progress_vacuum;
```

* * *

## Monitoring Connection Performance

### Check Active Connections

```sql
-- Current connection count
SELECT count(*) FROM pg_stat_activity;

-- Connections by state
SELECT state, count(*)
FROM pg_stat_activity
GROUP BY state;

-- Long-running queries
SELECT
  pid,
  now() - query_start AS duration,
  state,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - query_start > interval '5 minutes'
ORDER BY duration DESC;

-- Kill long-running query
SELECT pg_terminate_backend(12345);  -- Replace with pid
```

### Check Connection Limits

```sql
-- Max connections
SHOW max_connections;

-- Current usage
SELECT count(*) as current_connections,
       current_setting('max_connections')::int as max_connections,
       (count(*)::float / current_setting('max_connections')::int * 100)::numeric(5,2) as pct_used
FROM pg_stat_activity;
```

### Monitor Pool Stats (Application-side)

```javascript
// pg pool stats
setInterval(() => {
  console.log({
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    usage: `${((pool.totalCount - pool.idleCount) / pool.totalCount * 100).toFixed(1)}%`
  });
}, 10000);  // Every 10 seconds
```

* * *

## Performance Best Practices

### 1. Right-Size Your Pool

```javascript
// Bad: Pool too large
const badPool = new Pool({ max: 200 });
// Creates 200 connections, overwhelming database

// Good: Reasonable pool size
const goodPool = new Pool({
  max: 20,  // Based on server capacity
  min: 5    // Keep warm connections
});
```

### 2. Always Release Connections

```javascript
// Bad: Connection leak
async function badQuery() {
  const client = await pool.connect();
  const result = await client.query('SELECT * FROM users');
  // Forgot to release! Connection lost forever.
  return result.rows;
}

// Good: Always release
async function goodQuery() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users');
    return result.rows;
  } finally {
    client.release();  // Always release!
  }
}
```

### 3. Use Prepared Statements

```javascript
// Prevents SQL injection + potential performance boost
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  ['user@example.com']
);
```

### 4. Connection Timeout

```javascript
const pool = new Pool({
  connectionTimeoutMillis: 2000,  // Fail fast if no connection
});
```

### 5. Monitor & Alert

```javascript
// Alert if pool exhausted
if (pool.waitingCount > 10) {
  console.error('Pool exhausted! Waiting:', pool.waitingCount);
  // Send alert to monitoring system
}
```

### 6. Graceful Shutdown

```javascript
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();  // Close all connections
  process.exit(0);
});
```

### 7. Use PgBouncer for Many Apps

```
Multiple app instances? Use PgBouncer
Single app? Use application pool
```

### 8. Set Statement Timeouts

```sql
-- Prevent runaway queries
SET statement_timeout = '10s';

-- Or in postgresql.conf
statement_timeout = 10000  # milliseconds
```

* * *

## Troubleshooting

### Problem: "Too Many Connections"

```
Error: sorry, too many clients already
```

**Solutions:**
1. Increase `max_connections` (not recommended first)
2. Use connection pooling (recommended)
3. Use PgBouncer (recommended for multiple apps)
4. Find connection leaks in application

```sql
-- Check current connections
SELECT count(*), usename FROM pg_stat_activity GROUP BY usename;

-- Increase max_connections (requires restart)
ALTER SYSTEM SET max_connections = 200;
```

### Problem: Connection Pool Exhausted

```
Error: timeout acquiring client from pool
```

**Solutions:**
1. Increase pool size (if database can handle it)
2. Reduce connection timeout for faster failure
3. Find slow queries blocking connections
4. Check for connection leaks

```javascript
// Increase pool
pool.max = 30;

// Find leaks
console.log('Total:', pool.totalCount);
console.log('Idle:', pool.idleCount);
console.log('Active:', pool.totalCount - pool.idleCount);
// If active doesn't decrease, you have leaks!
```

### Problem: Slow Queries

```sql
-- Enable slow query logging (postgresql.conf)
log_min_duration_statement = 1000  # Log queries > 1s

-- Find slow queries
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Problem: High Memory Usage

```sql
-- Check shared memory usage
SHOW shared_buffers;

-- Check per-connection memory
SHOW work_mem;

-- Calculate total possible memory
-- = shared_buffers + (max_connections × work_mem × avg_operations)
```

* * *

## Further Reading

- [PostgreSQL](./PostgreSQL.md) - Core PostgreSQL concepts
- [TypeORM](./TypeORM.md) - ORM with connection pooling
- [Query Optimization](./Query%20Optimization.md) - Query performance
- [Replication & Scaling](./Replication%20&%20Scaling.md) - Scaling strategies

**External Resources:**
- PostgreSQL Documentation: https://www.postgresql.org/docs/current/runtime-config-connection.html
- PgBouncer Documentation: https://www.pgbouncer.org/
- node-postgres (pg): https://node-postgres.com/
