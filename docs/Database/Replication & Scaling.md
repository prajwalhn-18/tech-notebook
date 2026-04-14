---
sidebar_position: 4
---

## Replication & Scaling

A single database server has limits: CPU, memory, disk I/O, and network. As your application grows, you need strategies to scale beyond a single node — both for **performance** and **availability**.

* * *

Why Scale the Database?
========================

*   **Read throughput** — too many reads overwhelming one server
*   **Write throughput** — too many writes for one server to handle
*   **Availability** — single point of failure; if the DB goes down, everything goes down
*   **Latency** — users geographically far from your DB server
*   **Data volume** — dataset too large for one machine's disk

Each problem has a different solution.

* * *

Replication
============

**Replication** copies data from one database server (primary) to one or more others (replicas). All writes go to the primary. Replicas stay in sync and can serve reads.

```
               ┌─────────────┐
Writes ──────▶ │   Primary   │
               └──────┬──────┘
                      │ WAL stream / binlog
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Replica1 │ │ Replica2 │ │ Replica3 │
    └──────────┘ └──────────┘ └──────────┘
Reads ──▶              ──▶              ──▶
```

### Synchronous Replication

Primary waits for at least one replica to confirm it has received and written the data before acknowledging the write to the client.

```
Write → Primary → Replica confirms → Client gets success
```

**Pros:** Zero data loss on primary failure — replica has everything.
**Cons:** Higher write latency (must wait for replica acknowledgment).

**Use when:** Financial data, audit logs — you cannot lose a single committed transaction.

### Asynchronous Replication

Primary acknowledges the write immediately. Replica catches up in the background.

```
Write → Primary → Client gets success
              ↘ (async) → Replica syncs later
```

**Pros:** Low write latency — no waiting for replica.
**Cons:** If primary crashes before replica receives the data, that data is lost. Replica may be slightly behind (**replication lag**).

**Use when:** Most web applications — a few milliseconds of lag is acceptable.

### Replication Lag

The delay between a write on the primary and that write appearing on replicas.

```
Primary:  [write at T=0ms]
Replica:  [receives at T=50ms] ← 50ms lag
```

**Problem:** A user writes data, then immediately reads from a replica — they see stale data.

```js
// Naive routing — can serve stale data
async function getOrder(orderId) {
  return readReplica.query('SELECT * FROM orders WHERE id = $1', [orderId]);
}
```

**Solutions:**

```js
// 1. Read your own writes — route reads to primary for a short window after writes
async function createOrder(data) {
  const order = await primary.query('INSERT INTO orders ...', data);

  // Cache that this user just wrote — route reads to primary for 1 second
  await redis.set(`recent_write:${data.userId}`, '1', 1);

  return order;
}

async function getOrder(orderId, userId) {
  const recentWrite = await redis.get(`recent_write:${userId}`);
  const db = recentWrite ? primary : replica;
  return db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
}

// 2. Sticky sessions — always route a user to the same replica
// 3. Accept eventual consistency — document the behavior
```

* * *

Read Replicas in Practice
==========================

Route read-heavy queries to replicas to offload the primary.

```js
// Connection setup
const primary = new Pool({ host: process.env.DB_PRIMARY_HOST });
const replica  = new Pool({ host: process.env.DB_REPLICA_HOST });

// Service layer
class OrderRepository {
  async create(data) {
    return primary.query('INSERT INTO orders ...', data);  // always write to primary
  }

  async findById(id) {
    return replica.query('SELECT * FROM orders WHERE id = $1', [id]);  // read from replica
  }

  async getAnalytics(dateRange) {
    return replica.query('SELECT ... FROM orders WHERE ...', dateRange); // heavy read → replica
  }
}
```

**What to route to replicas:**
- Report generation
- Analytics queries
- Background job reads
- Search queries

**What must go to primary:**
- Any read that immediately follows a write
- Financial reads (balance checks, inventory checks before purchase)
- Admin operations

* * *

Sharding (Horizontal Partitioning)
=====================================

When a single server (even with replicas) can't handle write throughput or data volume, you split the data across multiple independent database instances — each called a **shard**.

```
                  ┌─────────────────┐
 Application ────▶│  Shard Router   │
                  └────────┬────────┘
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐  ┌────────┐  ┌────────┐
         │Shard 0 │  │Shard 1 │  │Shard 2 │
         │user 0-33%│ │34-66% │  │67-100% │
         └────────┘  └────────┘  └────────┘
```

Each shard is a fully independent database with its own primary and replicas.

### Sharding Strategies

#### Range-based sharding

Divide by range of a key.

```
Shard 0: user_id 1 – 1,000,000
Shard 1: user_id 1,000,001 – 2,000,000
Shard 2: user_id 2,000,001 – 3,000,000
```

**Pro:** Range queries are efficient (all data for user_id 500,000–600,000 is on Shard 0).
**Con:** Hotspots — if most traffic is on new users, the latest shard bears all the load.

#### Hash-based sharding

Apply a hash function to the key and use modulo.

```js
function getShard(userId, numShards) {
  return hash(userId) % numShards;
}

// user_id=42 → hash(42) % 3 = 0 → Shard 0
// user_id=99 → hash(99) % 3 = 1 → Shard 1
```

**Pro:** Even distribution — no hotspots.
**Con:** Range queries are impossible (user_id 1–1000 is spread across all shards). Adding shards requires redistributing all data (**resharding**).

#### Directory-based sharding

A lookup table maps each key to its shard.

```
Lookup table:
  user_id 42  → Shard 2
  user_id 99  → Shard 0
  user_id 1   → Shard 1
```

**Pro:** Flexible — can move specific tenants between shards.
**Con:** Lookup table is a single point of failure and a bottleneck.

### Sharding Challenges

**Cross-shard queries:** Joining data across shards requires application-level aggregation — very complex.

```js
// Can't do this across shards:
SELECT * FROM orders JOIN users ON orders.user_id = users.id WHERE users.country = 'IN';

// Must query each shard separately:
const results = await Promise.all(shards.map(shard =>
  shard.query('SELECT o.* FROM orders o JOIN users u ON o.user_id = u.id WHERE u.country = $1', ['IN'])
));
const allOrders = results.flat();
```

**No cross-shard transactions:** You can't have an ACID transaction that spans shards without complex distributed transaction protocols.

**Resharding:** Adding shards means moving data around — this is operationally complex and usually requires downtime or careful migration strategies.

> Sharding should be a last resort. Most companies with hundreds of millions of rows don't need it. Try vertical scaling, read replicas, caching, and query optimization first.

* * *

Table Partitioning
===================

Partitioning splits a single **logical table** into multiple **physical segments** — all on the same server. The database routes queries to the right partition automatically.

Unlike sharding, partitioning is transparent to the application.

### Range Partitioning (by time)

The most common pattern — partition by date.

```sql
-- PostgreSQL declarative partitioning
CREATE TABLE events (
  id BIGSERIAL,
  user_id INT NOT NULL,
  type VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE events_2024_01 PARTITION OF events
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE events_2024_02 PARTITION OF events
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE events_2024_03 PARTITION OF events
  FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
```

```sql
-- Query automatically routed to the right partition
SELECT * FROM events WHERE created_at = '2024-02-15';
-- Only scans events_2024_02, not all partitions
```

**Benefits:**
- **Partition pruning** — queries only scan relevant partitions
- **Archival** — drop old partition in milliseconds (vs DELETE which is slow)
- **Index size** — indexes are per-partition, smaller and faster to maintain

```sql
-- Archiving old data: drop a partition instantly
DROP TABLE events_2022_01;  -- removes all January 2022 data instantly, no DELETE scan
```

### Hash Partitioning

```sql
CREATE TABLE orders (
  id BIGSERIAL,
  user_id INT NOT NULL,
  total NUMERIC NOT NULL
) PARTITION BY HASH (user_id);

CREATE TABLE orders_p0 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE orders_p1 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE orders_p2 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE orders_p3 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

Evenly distributes rows across 4 partitions. Good for spreading I/O across disks.

* * *

Vertical Scaling vs Horizontal Scaling
========================================

### Vertical Scaling (Scale Up)

Get a bigger server — more CPU, RAM, faster disk.

**Pros:** Simple, no application changes, works immediately.
**Cons:** Has hard limits. Expensive. Single point of failure.

**When to use:** First option. Most databases can handle surprising load on modern hardware. A 64-core, 256GB RAM instance handles enormous traffic.

### Horizontal Scaling (Scale Out)

Add more servers — read replicas, sharding.

**Pros:** Theoretically unlimited scale. Better fault tolerance.
**Cons:** Complex application code, no cross-node transactions, harder operations.

**When to use:** After vertical scaling is maxed out, or when availability requirements demand multiple nodes.

* * *

CAP Theorem
============

In a distributed database, you can only guarantee two of three:

```
        Consistency
            /\
           /  \
          /    \
         /  CA  \
        /──────────\
       / CP  │  AP  \
      /──────┴───────\
Partition Tolerance ── Availability
```

**C — Consistency:** Every read returns the most recent write.
**A — Availability:** Every request gets a response (not necessarily the latest data).
**P — Partition Tolerance:** The system continues operating even when network partitions occur.

Since network partitions **always happen** in distributed systems, you must choose between C and A when a partition occurs:

**CP (Consistent + Partition Tolerant):** Returns an error during a partition rather than stale data.
- PostgreSQL, HBase, Zookeeper
- Use for: financial data, inventory

**AP (Available + Partition Tolerant):** Returns the best available data (possibly stale) during a partition.
- Cassandra, DynamoDB, CouchDB
- Use for: user feeds, analytics, shopping carts

* * *

Interview definition (short answer)
=====================================

> "Read replicas handle read scaling by distributing reads across replicas — writes still go to the primary. Beware of replication lag for read-your-own-writes scenarios. Partitioning splits a table into physical segments on the same server for query pruning and easy archival. Sharding splits data across separate servers for write scaling — it's operationally complex and should be a last resort. CAP theorem means in a partition, you choose between consistency and availability."
