---
sidebar_position: 7
---

## Replication & Scaling

A single database server has limits: CPU, memory, disk I/O, and network. As your application grows, you need strategies to scale beyond a single node — both for **performance** and **availability**.

**Why This Matters:**
- A single database server is a **single point of failure** (SPOF)
- One server can only handle ~10K-50K queries/second
- User growth means more concurrent requests than one server can handle
- Geographic distribution requires data closer to users
- Scaling decisions made early save millions in infrastructure costs

* * *

## Why Scale the Database?

Each scaling problem has a different solution. Understanding which problem you're solving is critical.

### Performance Problems

**1. Read Throughput — Too Many Reads**

```
Symptoms:
- Database CPU at 100% from SELECT queries
- Queries are fast individually, but too many concurrent
- Read-heavy workload (reports, analytics, user queries)

Example:
├─ 50,000 concurrent users
├─ Each makes 1 read query/second
└─ Total: 50,000 reads/second

Single PostgreSQL server maxes out at ~20K reads/second
```

**Solution**: Read replicas (covered below)

**2. Write Throughput — Too Many Writes**

```
Symptoms:
- Database struggling with INSERTs/UPDATEs/DELETEs
- Write-heavy workload (event logging, real-time data)
- WAL (Write-Ahead Log) becoming bottleneck

Example:
├─ IoT sensors logging data
├─ 10,000 sensors × 10 events/second
└─ Total: 100,000 writes/second

Single server can't keep up
```

**Solution**: Sharding (split writes across multiple databases)

**3. Data Volume — Dataset Too Large**

```
Symptoms:
- Table has billions of rows
- Queries slow even with proper indexes
- Backups take hours
- Disk running out of space

Example:
├─ Events table: 10 billion rows
├─ 5 TB of data
└─ Index scans still slow (too much data)
```

**Solution**: Table partitioning or sharding

### Availability Problems

**Single Point of Failure (SPOF)**

```
Scenario: Primary database crashes
         ↓
All writes fail immediately
         ↓
All reads fail immediately
         ↓
Application goes down
         ↓
Revenue loss + user frustration
```

**Solution**: Replication with automatic failover

### Latency Problems

**Geographic Distance**

```
User in Sydney accessing database in Virginia:
├─ Network latency: ~200ms per query
├─ Render homepage: 10 queries
└─ Total added latency: 2 seconds

Unacceptable user experience!
```

**Solution**: Multi-region replicas (data close to users)

* * *

## Replication — Deep Dive

**Replication** copies data from one database server (primary/master) to one or more others (replicas/slaves). This is the foundation of database scaling.

### How Replication Works

```
┌──────────────────────────────────────────┐
│         Primary Database                 │
│                                           │
│  1. Client writes INSERT/UPDATE/DELETE   │
│     ↓                                     │
│  2. Execute query, modify data            │
│     ↓                                     │
│  3. Write change to WAL (Write-Ahead Log) │
│     ↓                                     │
│  4. Return success to client             │
│     ↓                                     │
│  5. Stream WAL to replicas (async/sync)  │
└──────────────┬───────────────────────────┘
               │ WAL stream
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐
│Replica1│ │Replica2│ │Replica3│
│        │ │        │ │        │
│ Applies│ │ Applies│ │ Applies│
│  WAL   │ │  WAL   │ │  WAL   │
│ changes│ │ changes│ │ changes│
└────────┘ └────────┘ └────────┘
    ↑          ↑          ↑
  Reads      Reads      Reads
```

**Key Points:**
- **Primary**: Accepts all writes (INSERT/UPDATE/DELETE)
- **Replicas**: Receive changes from primary, serve reads
- **WAL (Write-Ahead Log)**: Sequential log of all database changes
- **Streaming**: Primary continuously sends WAL to replicas

### Synchronous Replication - Zero Data Loss

Primary waits for at least one replica to confirm it has received and written the data before acknowledging the write to the client.

#### How It Works - Step by Step

```
Timeline of a synchronous write:

T=0ms:   Client sends INSERT to primary
         ↓
T=1ms:   Primary writes to its WAL
         ↓
T=2ms:   Primary sends WAL entry to Replica1
         ↓
T=5ms:   Replica1 receives WAL entry
         ↓
T=6ms:   Replica1 writes to its WAL
         ↓
T=7ms:   Replica1 sends ACK to primary
         ↓
T=8ms:   Primary receives ACK
         ↓
T=9ms:   Primary returns SUCCESS to client ✓

Total latency: 9ms (includes replica confirmation)
```

**Configuration (PostgreSQL):**

```sql
-- postgresql.conf
synchronous_standby_names = 'replica1'  -- Wait for this replica

-- On primary
ALTER SYSTEM SET synchronous_commit = 'on';
SELECT pg_reload_conf();
```

**Pros:**
- **Zero data loss**: If primary crashes after commit, replica has the data
- **Consistency**: Read-your-own-writes guaranteed if routing to replica that ACKed
- **Audit compliance**: Financial/medical data requirements

**Cons:**
- **Higher write latency**: Must wait for network round-trip to replica
  - Same datacenter: +2-5ms
  - Cross-region: +50-200ms
- **Reduced availability**: If replica is down, writes block or fail
- **Throughput impact**: Fewer writes/second possible

**When to Use:**
- Financial transactions (payments, transfers)
- Audit logs (regulatory compliance)
- Critical data that cannot be lost
- User account changes (passwords, permissions)

**Real-World Example:**

```js
// Payment processing - requires synchronous replication
async function processPayment(userId, amount) {
  // This write MUST reach replica before confirming
  await db.query(`
    INSERT INTO payments (user_id, amount, status)
    VALUES ($1, $2, 'completed')
  `, [userId, amount]);

  // If primary crashes here, replica has the record ✓
  return { success: true };
}
```

### Asynchronous Replication - Low Latency

Primary acknowledges the write immediately without waiting for replicas. Replicas catch up in the background.

#### How It Works - Step by Step

```
Timeline of an asynchronous write:

T=0ms:   Client sends INSERT to primary
         ↓
T=1ms:   Primary writes to its WAL
         ↓
T=2ms:   Primary returns SUCCESS to client ✓
         ↓
T=3ms:   Primary sends WAL entry to Replica1 (async)
         ↓
T=5ms:   Replica1 receives WAL entry
         ↓
T=6ms:   Replica1 writes to its WAL
         ↓
         Replica is now in sync

Total latency: 2ms (no wait for replica)
Replication lag: 4ms (time until replica catches up)
```

**Configuration (PostgreSQL):**

```sql
-- postgresql.conf
synchronous_commit = 'off'  -- Don't wait for replica ACK

-- Replicas stream WAL automatically
```

**Pros:**
- **Low write latency**: No waiting for replica acknowledgment
  - Typical: 1-5ms per write
- **High throughput**: More writes/second possible
- **Availability**: Primary continues even if replicas are down
- **Works across regions**: Async handles high network latency

**Cons:**
- **Potential data loss**: If primary crashes, last few seconds of writes may be lost
  - Typical loss window: 0-10 seconds of data
- **Replication lag**: Replicas may be slightly behind primary
- **Read-your-own-writes problem**: User may not see their just-written data

**When to Use:**
- Most web applications (acceptable to lose last few seconds on crash)
- High-throughput scenarios (event logging, analytics)
- Cross-region replication (network latency too high for sync)
- Non-critical data (social posts, comments, likes)

**Real-World Example:**

```js
// Social media post - async replication is fine
async function createPost(userId, content) {
  // Fast write, don't wait for replicas
  const result = await db.query(`
    INSERT INTO posts (user_id, content, created_at)
    VALUES ($1, $2, NOW())
    RETURNING id
  `, [userId, content]);

  // If primary crashes here, post might be lost
  // (but that's acceptable for social media)
  return result.rows[0];
}
```

### Replication Lag - The Hidden Problem

**Replication lag** is the delay between a write on the primary and that write appearing on replicas.

#### Measuring Replication Lag

```sql
-- PostgreSQL: Check replication lag
SELECT
  client_addr,
  state,
  sent_lsn,
  write_lsn,
  flush_lsn,
  replay_lsn,
  sync_state,
  -- Calculate lag in bytes
  pg_wal_lsn_diff(sent_lsn, replay_lsn) AS lag_bytes,
  -- Calculate lag in seconds (estimated)
  EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp())) AS lag_seconds
FROM pg_stat_replication;
```

**Example output:**

```
client_addr  | state      | lag_bytes | lag_seconds
-------------|------------|-----------|-------------
10.0.1.50    | streaming  |   1048576 |        2.5
10.0.1.51    | streaming  |    524288 |        1.2
```

#### The Read-Your-Own-Writes Problem

```
User's perspective:
1. User submits form (writes to primary)
2. Redirect to confirmation page (reads from replica)
3. Data not there yet! (replica is 500ms behind)
4. User sees error or old data
5. User panics, submits again
6. Duplicate data created!
```

**Visual Timeline:**

```
Time    Primary         Replica         User
T=0     Write order     (no data yet)
T=100                                   Write success!
T=150                   Replicating...
T=200                                   Refresh page
T=250                                   Read from replica
T=300                   Still behind    ERROR: Order not found!
T=500   ✓               ✓               (too late, user already confused)
```

#### Solutions to Read-Your-Own-Writes

**Solution 1: Read from Primary for Short Window**

```js
// Track recent writes per user in Redis
async function createOrder(userId, items) {
  // Write to primary
  const order = await primary.query(
    'INSERT INTO orders (user_id, items, total) VALUES ($1, $2, $3) RETURNING *',
    [userId, JSON.stringify(items), calculateTotal(items)]
  );

  // Mark this user as having recent write (1 second TTL)
  await redis.set(`recent_write:user:${userId}`, '1', 'EX', 1);

  return order.rows[0];
}

async function getOrder(orderId, userId) {
  // Check if user wrote recently
  const recentWrite = await redis.get(`recent_write:user:${userId}`);

  // If recent write, read from primary (guaranteed to have data)
  const db = recentWrite ? primary : replica;

  return db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
}
```

**Performance:**
```
Without solution: 10% of reads fail (stale data)
With solution:    5% reads go to primary (reduces replica load slightly)
                  0% failures ✓
```

**Solution 2: Sticky Sessions (User → Same Replica)**

```js
// Load balancer: hash user_id to pick replica
function getReplicaForUser(userId, replicas) {
  const index = hash(userId) % replicas.length;
  return replicas[index];
}

// Application code
const replica = getReplicaForUser(req.user.id, replicaPool);
const data = await replica.query('SELECT ...');
```

**Pros**: Eventual consistency works if user always hits same replica
**Cons**: Doesn't help for first read after write

**Solution 3: Monotonic Reads (Track LSN)**

```js
// After write, return the WAL LSN (Log Sequence Number)
async function createOrder(userId, items) {
  const order = await primary.query('INSERT INTO orders ... RETURNING *');

  // Get current WAL position
  const lsn = await primary.query('SELECT pg_current_wal_lsn()');

  return {
    order: order.rows[0],
    lsn: lsn.rows[0].pg_current_wal_lsn  // e.g., '0/1234ABCD'
  };
}

// On read, ensure replica has caught up to this LSN
async function getOrder(orderId, minLSN) {
  // Wait until replica has replayed up to minLSN
  await replica.query(
    'SELECT pg_wal_replay_wait($1)',
    [minLSN]
  );

  // Now read (guaranteed to include our write)
  return replica.query('SELECT * FROM orders WHERE id = $1', [orderId]);
}
```

**Solution 4: Accept Eventual Consistency**

Sometimes it's okay to show stale data!

```js
// Social media feed - eventual consistency is fine
async function getUserFeed(userId) {
  // Read from replica (might be slightly stale)
  return replica.query(`
    SELECT * FROM posts
    WHERE user_id IN (SELECT following_id FROM follows WHERE user_id = $1)
    ORDER BY created_at DESC
    LIMIT 50
  `, [userId]);
}

// User's new post might not appear in feed for 1-2 seconds
// This is acceptable UX for social media
```

* * *

## Read Replicas in Practice

Route read-heavy queries to replicas to offload the primary.

### Connection Setup

```js
// Separate connection pools for primary and replicas
import { Pool } from 'pg';

const primary = new Pool({
  host: process.env.DB_PRIMARY_HOST,  // e.g., primary.db.internal
  port: 5432,
  database: 'myapp',
  max: 20
});

const replica1 = new Pool({
  host: process.env.DB_REPLICA1_HOST,  // e.g., replica1.db.internal
  port: 5432,
  database: 'myapp',
  max: 50  // Can be higher since replicas only serve reads
});

const replica2 = new Pool({
  host: process.env.DB_REPLICA2_HOST,
  port: 5432,
  database: 'myapp',
  max: 50
});

// Round-robin load balancing across replicas
const replicas = [replica1, replica2];
let replicaIndex = 0;

function getReadReplica() {
  const replica = replicas[replicaIndex];
  replicaIndex = (replicaIndex + 1) % replicas.length;
  return replica;
}
```

### Repository Pattern with Read/Write Split

```js
class OrderRepository {
  // WRITES - always go to primary
  async create(userId, items) {
    return primary.query(
      'INSERT INTO orders (user_id, items, total, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, JSON.stringify(items), calculateTotal(items), 'pending']
    );
  }

  async updateStatus(orderId, newStatus) {
    return primary.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
      [newStatus, orderId]
    );
  }

  // READS - go to replicas
  async findById(id) {
    const replica = getReadReplica();
    return replica.query('SELECT * FROM orders WHERE id = $1', [id]);
  }

  async findByUser(userId, limit = 100) {
    const replica = getReadReplica();
    return replica.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
  }

  // Heavy analytics queries - definitely use replica
  async getRevenueByDay(startDate, endDate) {
    const replica = getReadReplica();
    return replica.query(`
      SELECT
        DATE(created_at) as day,
        SUM(total) as revenue,
        COUNT(*) as order_count
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY day DESC
    `, [startDate, endDate]);
  }
}
```

### What to Route to Replicas

**✅ Safe for Replicas:**
- Report generation (daily/weekly reports)
- Analytics queries (charts, dashboards)
- Search functionality (product search, user search)
- Public data (blog posts, product listings)
- Background job reads (email generation, notifications)
- Audit log reads
- Historical data queries

**❌ Must Go to Primary:**
- Any read immediately after a write
  ```js
  await createOrder(); // Write
  const order = await getOrder(); // Must read from primary!
  ```
- Financial/inventory checks before writes
  ```js
  const balance = await getBalance(userId); // Must be current!
  if (balance >= amount) {
    await deductBalance(userId, amount); // Write
  }
  ```
- Admin operations (modifying critical data)
- Real-time collaborative editing (need latest version)
- Race-condition-sensitive operations
  ```js
  const currentStock = await getStock(productId); // Must be exact!
  if (currentStock > 0) {
    await decrementStock(productId);
  }
  ```

### Automatic Failover

When the primary crashes, promote a replica to become the new primary.

```
Before failover:
┌─────────┐
│ Primary │ ← All writes
└────┬────┘
     │ WAL stream
  ┌──┴──┐
  ▼     ▼
┌────┐ ┌────┐
│ R1 │ │ R2 │ ← All reads
└────┘ └────┘

Primary crashes!
      ↓
┌───────────────────┐
│ Failover Process  │
│ 1. Detect crash   │
│ 2. Pick R1        │
│ 3. Promote R1     │
│ 4. Update DNS     │
└───────────────────┘
      ↓
After failover:
┌──────────┐
│ Primary  │ ← R1 promoted, now accepts writes
│ (was R1) │
└────┬─────┘
     │ WAL stream
     ▼
  ┌────┐
  │ R2 │ ← Still serves reads
  └────┘
```

**Tools for automatic failover:**
- **Patroni** (PostgreSQL HA)
- **repmgr** (PostgreSQL replication manager)
- **AWS RDS Multi-AZ** (managed failover)
- **Google Cloud SQL** (managed failover)

**Failover time:**
```
Detection:    5-30 seconds (health check frequency)
Promotion:    5-10 seconds (promote replica)
DNS update:   1-60 seconds (TTL dependent)
Total:        ~15-90 seconds of downtime
```

* * *

## Sharding (Horizontal Partitioning)

When a single server (even with replicas) can't handle write throughput or data volume, split the data across multiple independent database instances — each called a **shard**.

### When You Need Sharding

**Indicators you need sharding:**
- ✅ Single server can't handle write load (>50K writes/second)
- ✅ Dataset is massive (>5 TB, billions of rows)
- ✅ Queries slow even with perfect indexes
- ✅ Vertical scaling maxed out (largest instance still insufficient)

**Don't shard if:**
- ❌ Haven't optimized queries
- ❌ Haven't added proper indexes
- ❌ Haven't tried read replicas
- ❌ Can still vertically scale

> **Warning**: Sharding is complex and should be a last resort. Most companies with hundreds of millions of rows don't need it.

### Sharding Architecture

```
                  ┌───────────────────────┐
 Application ────▶│   Sharding Router     │
                  │ (determines which shard│
                  │  based on shard key)  │
                  └──────────┬────────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         ┌────────┐     ┌────────┐     ┌────────┐
         │Shard 0 │     │Shard 1 │     │Shard 2 │
         │        │     │        │     │        │
         │users   │     │users   │     │users   │
         │0-33%   │     │34-66%  │     │67-100% │
         └───┬────┘     └───┬────┘     └───┬────┘
             │              │              │
     ┌───────┴───┐   ┌──────┴───┐   ┌──────┴───┐
     ▼           ▼   ▼          ▼   ▼          ▼
  ┌────┐     ┌────┐┌────┐   ┌────┐┌────┐   ┌────┐
  │ R1 │     │ R2 ││ R3 │   │ R4 ││ R5 │   │ R6 │
  └────┘     └────┘└────┘   └────┘└────┘   └────┘
  (replicas for high availability per shard)
```

Each shard is a fully independent database with its own primary and replicas.

### Sharding Strategies

#### 1. Hash-Based Sharding

Apply a hash function to the shard key and use modulo.

```js
// Shard key: user_id
function getShard(userId, numShards) {
  // Use consistent hash function (e.g., MurmurHash, CRC32)
  const hashValue = hash(userId);  // e.g., hash(42) = 87342634
  return hashValue % numShards;     // 87342634 % 3 = 1 → Shard 1
}

// Examples:
getShard(42, 3);   // → Shard 1
getShard(99, 3);   // → Shard 0
getShard(100, 3);  // → Shard 2
```

**Query routing:**

```js
async function getUserOrders(userId) {
  const shardIndex = getShard(userId, shards.length);
  const shard = shards[shardIndex];

  return shard.query(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
}

async function createOrder(userId, items) {
  const shardIndex = getShard(userId, shards.length);
  const shard = shards[shardIndex];

  return shard.query(
    'INSERT INTO orders (user_id, items, total) VALUES ($1, $2, $3) RETURNING *',
    [userId, JSON.stringify(items), calculateTotal(items)]
  );
}
```

**Distribution:**

```
With 3 shards and 9 users:
Shard 0: [user_id: 3, 6, 9]       (33%)
Shard 1: [user_id: 1, 4, 7]       (33%)
Shard 2: [user_id: 2, 5, 8]       (33%)

Even distribution! ✓
```

**Pros:**
- **Even distribution**: Hash function spreads data uniformly
- **No hotspots**: Load is balanced across shards
- **Simple routing**: Hash determines shard in O(1)

**Cons:**
- **Range queries impossible**: Users 1-1000 spread across all shards
  ```js
  // Can't do this efficiently:
  SELECT * FROM users WHERE user_id BETWEEN 1 AND 1000;
  // Must query ALL shards and merge results
  ```
- **Resharding is hard**: Adding shards requires redistributing data
  ```
  Hash with 3 shards: hash(user_id) % 3
  Hash with 4 shards: hash(user_id) % 4
  ↑ Same user_id now maps to different shard!
  Must move ~75% of data to new shards
  ```

**When to use**: Most sharding scenarios, especially user-scoped data

#### 2. Range-Based Sharding

Divide by range of the shard key.

```
Shard 0: user_id 1 – 1,000,000
Shard 1: user_id 1,000,001 – 2,000,000
Shard 2: user_id 2,000,001 – 3,000,000
Shard 3: user_id 3,000,001 – 4,000,000
```

**Query routing:**

```js
const shardRanges = [
  { shard: 0, minId: 1, maxId: 1000000 },
  { shard: 1, minId: 1000001, maxId: 2000000 },
  { shard: 2, minId: 2000001, maxId: 3000000 },
];

function getShard(userId) {
  for (const range of shardRanges) {
    if (userId >= range.minId && userId <= range.maxId) {
      return shards[range.shard];
    }
  }
  throw new Error('User ID out of range');
}
```

**Pros:**
- **Range queries efficient**: All data for user_id 500,000–600,000 is on Shard 0
  ```sql
  -- Only queries Shard 0
  SELECT * FROM users WHERE user_id BETWEEN 500000 AND 600000;
  ```
- **Easy to add shards**: Just assign new range
  ```
  Add Shard 4: user_id 4,000,001 – 5,000,000
  No data movement needed! ✓
  ```

**Cons:**
- **Hotspots**: If most traffic is on new users, latest shard bears all load
  ```
  Shard 0 (old users):  100 req/sec
  Shard 1 (old users):  120 req/sec
  Shard 3 (new users):  5000 req/sec ← HOTSPOT!
  ```
- **Manual rebalancing**: Must manually split hot shards

**When to use**: Time-series data, sequential IDs, need range queries

#### 3. Directory-Based Sharding (Lookup Table)

A central lookup table maps each key to its shard.

```sql
-- Lookup table (centralized)
CREATE TABLE user_shard_map (
  user_id BIGINT PRIMARY KEY,
  shard_id INT NOT NULL
);

-- Examples:
user_id | shard_id
--------|----------
   42   |    2
   99   |    0
  100   |    1
  500   |    2
```

**Query routing:**

```js
async function getShard(userId) {
  // Lookup which shard this user is on
  const result = await lookupDB.query(
    'SELECT shard_id FROM user_shard_map WHERE user_id = $1',
    [userId]
  );

  const shardId = result.rows[0].shard_id;
  return shards[shardId];
}

async function getUserOrders(userId) {
  const shard = await getShard(userId);
  return shard.query('SELECT * FROM orders WHERE user_id = $1', [userId]);
}
```

**Pros:**
- **Flexible**: Can move specific users/tenants between shards
  ```sql
  -- Move user 42 from Shard 2 to Shard 1
  UPDATE user_shard_map SET shard_id = 1 WHERE user_id = 42;
  ```
- **Load balancing**: Manually balance load by moving hot users
- **Works for multi-tenancy**: Each tenant can have its own shard

**Cons:**
- **Extra query**: Every request requires lookup table query first
  ```
  Latency: lookup (5ms) + actual query (10ms) = 15ms total
  ```
- **Lookup table is SPOF**: If it goes down, entire system down
- **Lookup table is bottleneck**: All requests hit same table
- **Must cache aggressively**: Use Redis to cache mappings

**When to use**: Multi-tenant SaaS, need to move users between shards

### Sharding Challenges - The Hard Parts

#### 1. Cross-Shard Queries

**Problem**: Can't JOIN across shards

```js
// Impossible with sharding:
SELECT orders.*, users.name
FROM orders
JOIN users ON orders.user_id = users.id
WHERE orders.status = 'pending';

// Why? orders and users might be on different shards!
```

**Solution**: Query each shard, merge in application

```js
async function getPendingOrdersWithUserNames() {
  // Query ALL shards in parallel
  const promises = shards.map(shard =>
    shard.query(`
      SELECT orders.*, users.name
      FROM orders
      JOIN users ON orders.user_id = users.id
      WHERE orders.status = 'pending'
    `)
  );

  const results = await Promise.all(promises);

  // Merge results from all shards
  const allOrders = results.flatMap(r => r.rows);

  // Sort by created_at (each shard returned sorted, now merge-sort)
  return allOrders.sort((a, b) => b.created_at - a.created_at);
}
```

**Performance impact:**
```
Without sharding: 1 query,  20ms
With 10 shards:   10 queries in parallel, 50ms + merge overhead
```

#### 2. Cross-Shard Transactions

**Problem**: No ACID transactions across shards

```js
// Impossible with sharding:
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;  // Shard 0
  UPDATE accounts SET balance = balance + 100 WHERE user_id = 2;  // Shard 1
COMMIT;

// Can't have atomic transaction across shards!
```

**Solution 1**: Two-Phase Commit (2PC) — Complex, slow, fragile

```js
// 2PC protocol (simplified)
async function transferBetweenShards(fromUserId, toUserId, amount) {
  const shard1 = getShard(fromUserId);
  const shard2 = getShard(toUserId);

  // Phase 1: PREPARE
  await shard1.query('BEGIN; UPDATE accounts SET balance = balance - $1 WHERE user_id = $2', [amount, fromUserId]);
  await shard2.query('BEGIN; UPDATE accounts SET balance = balance + $1 WHERE user_id = $2', [amount, toUserId]);

  // Phase 2: COMMIT
  try {
    await shard1.query('COMMIT');
    await shard2.query('COMMIT');
  } catch (err) {
    // If any COMMIT fails, ROLLBACK all
    await shard1.query('ROLLBACK');
    await shard2.query('ROLLBACK');
    throw err;
  }
}

// Problem: If coordinator crashes between PREPARE and COMMIT,
// shards are left in uncertain state!
```

**Solution 2**: Saga Pattern — Compensating transactions

```js
async function transferBetweenShards(fromUserId, toUserId, amount) {
  try {
    // Step 1: Deduct from sender
    await getShard(fromUserId).query(
      'UPDATE accounts SET balance = balance - $1 WHERE user_id = $2',
      [amount, fromUserId]
    );

    // Step 2: Add to recipient
    await getShard(toUserId).query(
      'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2',
      [amount, toUserId]
    );
  } catch (err) {
    // Compensation: Rollback step 1
    await getShard(fromUserId).query(
      'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2',
      [amount, fromUserId]
    );
    throw err;
  }
}
```

**Solution 3**: Avoid cross-shard transactions (best!)

- Design schema so transactions are always within one shard
- Shard by user_id → all user data on same shard → transactions work!

#### 3. Resharding - Adding/Removing Shards

**Problem**: Adding shards requires data migration

```
Original: 3 shards, hash(user_id) % 3
User 42: hash(42) % 3 = 1 → Shard 1

After adding 4th shard: hash(user_id) % 4
User 42: hash(42) % 4 = 2 → Shard 2

User 42's data must move from Shard 1 to Shard 2!
```

**Naive approach**: Recompute every row's shard

```
Result: Must move ~75% of all data!
Time: Hours to days for large datasets
Downtime: Required
```

**Better approach**: Consistent Hashing

```
Hash ring (360°):
0°   ── Shard 0
120° ── Shard 1
240° ── Shard 2

User 42: hash(42) → 156° → Shard 1

Add Shard 3 at 180°:
0°   ── Shard 0
120° ── Shard 1
180° ── Shard 3 (NEW)
240° ── Shard 2

User 42: hash(42) → 156° → Shard 1 (still same shard!)

Only data in range 120°-180° moves (much less!)
```

**Implementation**:
- Use libraries like `hashring` (Node.js)
- Or managed services (AWS DynamoDB, Google Spanner)

* * *

## Table Partitioning - Sharding Lite

Partitioning splits a single **logical table** into multiple **physical segments** — all on the same server. The database routes queries to the right partition automatically.

**Key difference from sharding:**
- **Partitioning**: Multiple tables on same server, transparent to application
- **Sharding**: Multiple databases on different servers, application must route

### Range Partitioning (Time-Based)

Most common pattern — partition by date.

```sql
-- PostgreSQL declarative partitioning
CREATE TABLE events (
  id BIGSERIAL,
  user_id INT NOT NULL,
  event_type VARCHAR NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE events_2024_01 PARTITION OF events
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE events_2024_02 PARTITION OF events
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE events_2024_03 PARTITION OF events
  FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

-- Indexes are per-partition (smaller, faster!)
CREATE INDEX ON events_2024_01 (user_id);
CREATE INDEX ON events_2024_02 (user_id);
CREATE INDEX ON events_2024_03 (user_id);
```

#### Partition Pruning (Automatic Optimization)

```sql
-- Query only February data
SELECT * FROM events
WHERE created_at BETWEEN '2024-02-01' AND '2024-02-28'
  AND user_id = 42;

-- PostgreSQL automatically scans ONLY events_2024_02 partition!
-- Doesn't touch events_2024_01 or events_2024_03

EXPLAIN output:
Seq Scan on events_2024_02  (cost=0.00..100.00 rows=50)
  Filter: (created_at >= '2024-02-01' AND created_at < '2024-03-01' AND user_id = 42)

-- Without partitioning:
Seq Scan on events  (cost=0.00..50000.00 rows=50)
  Filter: (created_at >= '2024-02-01' AND created_at < '2024-03-01' AND user_id = 42)

500x less work! ✓
```

#### Benefits of Partitioning

**1. Faster Queries (Partition Pruning)**

```sql
-- Query last 7 days
SELECT * FROM events WHERE created_at > NOW() - INTERVAL '7 days';

-- Only scans current month's partition
-- vs scanning entire 10-year table
```

**2. Easy Archival (Drop Old Partitions)**

```sql
-- Archive old data: Drop partition instantly
DROP TABLE events_2022_01;

-- vs without partitioning:
DELETE FROM events WHERE created_at < '2022-02-01';
-- Takes hours, locks table, bloats WAL
```

**3. Smaller Indexes**

```
Without partitioning:
events table: 10 billion rows
Index on user_id: 50 GB

With monthly partitions (120 partitions):
events_2024_01: 83 million rows, index: 420 MB
events_2024_02: 83 million rows, index: 420 MB
...

Queries on current month only scan 420 MB index vs 50 GB!
```

**4. Maintenance Parallelization**

```sql
-- Vacuum each partition separately (in parallel)
VACUUM events_2024_01;
VACUUM events_2024_02;
VACUUM events_2024_03;
-- vs VACUUM entire 10-year table (takes hours)
```

### Hash Partitioning

Distribute rows evenly across N partitions.

```sql
CREATE TABLE orders (
  id BIGSERIAL,
  user_id INT NOT NULL,
  total NUMERIC NOT NULL
) PARTITION BY HASH (user_id);

-- Create 4 partitions
CREATE TABLE orders_p0 PARTITION OF orders
  FOR VALUES WITH (MODULUS 4, REMAINDER 0);

CREATE TABLE orders_p1 PARTITION OF orders
  FOR VALUES WITH (MODULUS 4, REMAINDER 1);

CREATE TABLE orders_p2 PARTITION OF orders
  FOR VALUES WITH (MODULUS 4, REMAINDER 2);

CREATE TABLE orders_p3 PARTITION OF orders
  FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

**Use case**: Spread I/O across multiple disks

```
Disk 1: orders_p0
Disk 2: orders_p1
Disk 3: orders_p2
Disk 4: orders_p3

Parallel I/O = 4x throughput!
```

### List Partitioning

Partition by specific values (e.g., country, region).

```sql
CREATE TABLE users (
  id BIGSERIAL,
  email VARCHAR NOT NULL,
  country VARCHAR(2) NOT NULL
) PARTITION BY LIST (country);

CREATE TABLE users_us PARTITION OF users
  FOR VALUES IN ('US');

CREATE TABLE users_eu PARTITION OF users
  FOR VALUES IN ('UK', 'DE', 'FR', 'IT', 'ES');

CREATE TABLE users_asia PARTITION OF users
  FOR VALUES IN ('IN', 'JP', 'CN', 'SG');

CREATE TABLE users_other PARTITION OF users
  DEFAULT;  -- Catch-all for other countries
```

**Use case**: Data locality (EU users on EU server for GDPR)

* * *

## Vertical Scaling vs Horizontal Scaling

### Vertical Scaling (Scale Up) - Bigger Server

Add more resources to a single server:
- More CPU cores (4 → 16 → 64)
- More RAM (16 GB → 128 GB → 512 GB)
- Faster disk (HDD → SSD → NVMe)

**Cost comparison:**

| Instance | vCPUs | RAM | Storage | Cost/month | Max Connections |
|----------|-------|-----|---------|------------|-----------------|
| db.t3.medium | 2 | 4 GB | 100 GB | $60 | 500 |
| db.m5.2xlarge | 8 | 32 GB | 1 TB | $500 | 2000 |
| db.m5.12xlarge | 48 | 192 GB | 5 TB | $3000 | 10,000 |
| db.r5.24xlarge | 96 | 768 GB | 10 TB | $8000 | 20,000 |

**Pros:**
- **Simple**: No code changes, just resize server
- **Works immediately**: Upgrade, restart, done
- **No distributed complexity**: Single source of truth
- **Transactions work**: Full ACID guarantees
- **Queries work**: JOINs, aggregations, everything

**Cons:**
- **Hard limits**: Largest instance is still finite
  - AWS RDS max: 96 vCPUs, 768 GB RAM
  - GCP Cloud SQL max: 96 vCPUs, 624 GB RAM
- **Expensive**: Quadratic cost increase
  - 2x resources ≈ 3-4x cost
- **Single point of failure**: Still need replication for HA
- **Downtime for upgrades**: Must restart to resize

**When to use:** First option! Most apps never outgrow it.

### Horizontal Scaling (Scale Out) - More Servers

Add more servers:
- Read replicas (for read scaling)
- Sharding (for write scaling + data volume)

**Cost comparison:**

| Setup | Servers | Total vCPUs | Total RAM | Cost/month | Max Throughput |
|-------|---------|-------------|-----------|------------|----------------|
| 1 large | 1 | 48 | 192 GB | $3000 | 50K req/s |
| 3 medium + replicas | 9 | 72 | 288 GB | $4500 | 200K req/s |
| 10 shards + replicas | 30 | 240 | 960 GB | $15,000 | 1M req/s |

**Pros:**
- **Theoretically unlimited**: Just add more servers
- **Better fault tolerance**: Failure of one server doesn't bring down system
- **Geographic distribution**: Replicas close to users
- **Cost-effective at scale**: Linear cost vs quadratic for vertical

**Cons:**
- **Complex application code**: Must route queries to correct shard
- **No cross-shard JOINs**: Application-level aggregation
- **No cross-shard transactions**: Sagas or eventual consistency
- **Harder operations**: Deploy, backup, monitor 30 databases vs 1
- **Data skew**: Some shards may be hotter than others

**When to use:** After vertical scaling is maxed, or when geographic distribution needed

* * *

## CAP Theorem - Choosing Your Tradeoffs

In a distributed database, you can only guarantee two of three:

```
        Consistency
            /\
           /  \
          /    \
         /  CA  \
        /────────\
       / CP  │  AP \
      /──────┴──────\
Partition Tolerance ── Availability
```

### The Three Guarantees

**C — Consistency**
Every read returns the most recent write (or an error).

```
User writes: balance = $100
Every subsequent read returns $100 (not $50, not $0)
```

**A — Availability**
Every request gets a response (not necessarily the latest data).

```
Even if half the servers are down, you get a response
(might be stale data, but you get SOMETHING)
```

**P — Partition Tolerance**
System continues operating even when network splits servers.

```
        ┌───────────┐
        │  Server 1 │
        └───────────┘
              │
        Network partition!
        (servers can't communicate)
              │
        ┌───────────┐
        │  Server 2 │
        └───────────┘
```

### Why P is Mandatory

Network partitions **always happen** in distributed systems:
- Switch failures
- Cable cuts
- DNS issues
- Firewall rules
- Cloud provider outages

So the real choice is: **CP or AP?**

### CP (Consistent + Partition Tolerant)

Returns an error during a partition rather than stale data.

```
Scenario: Network partition between primary and replica

Client: "What's the balance?"
System: "ERROR: Can't guarantee consistency, partition detected"

vs returning potentially stale $50 when real balance is $100
```

**Examples:**
- **PostgreSQL** (with synchronous replication)
- **HBase**
- **MongoDB** (with WriteConcern majority)
- **Zookeeper**

**Use for:**
- Financial data (balance, payments, transfers)
- Inventory (stock levels)
- Authentication (passwords, permissions)
- Critical business logic

**Behavior during partition:**
```
If primary can't reach majority of replicas:
├─ Writes: REJECTED (error)
├─ Reads: REJECTED (error) or from last known good state
└─ User experience: Errors, retries needed
```

### AP (Available + Partition Tolerant)

Returns the best available data (possibly stale) during a partition.

```
Scenario: Network partition between primary and replica

Client: "What's the balance?"
System: "$50" (stale, real balance is $100 on primary)

But at least you got a response!
```

**Examples:**
- **Cassandra**
- **DynamoDB**
- **CouchDB**
- **Riak**

**Use for:**
- Social media (posts, likes, comments)
- Analytics (view counts, clicks)
- Caching (user preferences, settings)
- Shopping carts (eventual consistency acceptable)

**Behavior during partition:**
```
If primary can't reach replicas:
├─ Writes: ACCEPTED on primary (replica will catch up later)
├─ Reads: SERVED from replica (might be stale)
└─ User experience: Everything works, data eventually consistent
```

### Real-World Example

**E-commerce Checkout:**

```js
// CP approach (guarantee correctness):
async function checkout(userId, items) {
  // Begin transaction
  await db.query('BEGIN');

  // Check inventory (must be current!)
  const stock = await db.query(
    'SELECT stock FROM products WHERE id = $1 FOR UPDATE',
    [productId]
  );

  if (stock.rows[0].stock < quantity) {
    await db.query('ROLLBACK');
    throw new Error('Out of stock');
  }

  // Deduct inventory
  await db.query(
    'UPDATE products SET stock = stock - $1 WHERE id = $2',
    [quantity, productId]
  );

  // Create order
  await db.query(
    'INSERT INTO orders (user_id, items) VALUES ($1, $2)',
    [userId, JSON.stringify(items)]
  );

  await db.query('COMMIT');

  return { success: true };
}

// During partition: REJECTS checkout to prevent overselling ✓
```

```js
// AP approach (prioritize availability):
async function addToCart(userId, productId) {
  // Add to cart (always succeeds, even if replica is stale)
  await db.query(
    'INSERT INTO cart_items (user_id, product_id) VALUES ($1, $2)',
    [userId, productId]
  );

  // During partition:
  // - Still adds to cart ✓
  // - Might add out-of-stock item (resolve at checkout)
}
```

**Hybrid approach** (most real systems):
- Critical paths: CP (checkout, payment)
- Non-critical paths: AP (add to cart, view products)

* * *

## Summary - Scaling Decision Tree

```
Is your database slow?
├─ Yes
│  ├─ Add indexes? → DO THIS FIRST
│  ├─ Optimize queries? → DO THIS SECOND
│  ├─ Connection pooling? → DO THIS THIRD
│  ├─ Cache frequently accessed data? (Redis) → DO THIS FOURTH
│  └─ Still slow?
│     ├─ Read-heavy?
│     │  ├─ Add read replicas (easy wins)
│     │  └─ Still slow? → Consider caching layer
│     └─ Write-heavy?
│        ├─ Vertical scaling (easier)
│        └─ Maxed out vertical scaling? → Sharding (complex)
└─ No, but want HA
   └─ Add replication with automatic failover
```

**Golden Rules:**
1. **Optimize first**: 80% of problems are solved by indexes and query optimization
2. **Vertical scaling before horizontal**: Simpler, works immediately
3. **Read replicas before sharding**: Easy to implement, handles 90% of scale needs
4. **Sharding is a last resort**: Only when vertical + replicas aren't enough
5. **Measure before optimizing**: Use EXPLAIN, slow query logs, metrics

* * *

## Interview Definition (Short Answer)

> "Read replicas handle read scaling by distributing reads across replicas while writes go to the primary. Beware of replication lag for read-your-own-writes scenarios—solutions include routing recent writers to primary or using LSN tracking. Table partitioning splits a table into physical segments on the same server for query pruning and easy archival (DROP partition vs slow DELETE). Sharding splits data across separate servers for write scaling—it requires application-level query routing, makes cross-shard JOINs impossible, and should be a last resort. CAP theorem means during a network partition, choose consistency (CP: error rather than stale data, for finance) or availability (AP: stale data rather than errors, for social media). Most real systems use both: CP for critical paths, AP for non-critical."
