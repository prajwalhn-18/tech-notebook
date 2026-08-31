---
sidebar_position: 6
---

## Query Optimization

A slow query in production doesn't just slow down one user — it holds database connections, blocks other queries, and can cascade into an outage. Understanding how the database executes queries and where to intervene is a core senior engineering skill.

**Why This Matters:**
- A single slow query can bring down your entire application
- Database optimization is often the **highest ROI** performance work
- Proper indexing alone can turn a 30-second query into 10 milliseconds
- Connection exhaustion from slow queries causes cascading failures

* * *

## How the Query Optimizer Works - Deep Dive

When you run a SQL query, the database doesn't execute it literally. Understanding the optimization process helps you write better queries and diagnose problems.

### The Optimization Pipeline

```
Your SQL Query
      ↓
┌─────────────────────┐
│  1. Parser          │  Syntax check, build parse tree
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  2. Rewriter        │  Apply view definitions, rules
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  3. Optimizer       │  Generate execution plans
│                     │  • Sequential scan vs index scan
│                     │  • Join order (A→B→C vs C→A→B)
│                     │  • Join type (hash, nested loop, merge)
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  4. Cost Estimator  │  Calculate cost for each plan
│                     │  Uses: table statistics, row counts,
│                     │        index selectivity, disk I/O cost
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  5. Pick Best Plan  │  Choose lowest estimated cost
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  6. Executor        │  Actually run the chosen plan
└─────────────────────┘
```

### Why Statistics Matter

The query optimizer relies on **statistics** to make decisions. These statistics include:

- **Row count** per table
- **Column cardinality** (number of distinct values)
- **Value distribution histogram** (which values are common/rare)
- **Index correlation** (how ordered the physical rows are)

**Example:** If the optimizer thinks a table has 100 rows but it actually has 10 million rows, it will choose a terrible plan (like a sequential scan instead of an index scan).

```sql
-- PostgreSQL: update statistics manually
-- Run this after bulk inserts/updates or when query plans look wrong
ANALYZE orders;

-- MySQL: update statistics
ANALYZE TABLE orders;

-- Check when table was last analyzed
SELECT
  schemaname,
  tablename,
  last_analyze,
  last_autoanalyze,
  n_live_tup
FROM pg_stat_user_tables
WHERE tablename = 'orders';
```

**Real-world impact:**
- Stale statistics → optimizer thinks table has 1000 rows, actually has 10M → chooses sequential scan
- Sequential scan on 10M rows = 30 seconds
- Index scan would take 0.01 seconds
- 3000x performance difference!

* * *

## EXPLAIN — Reading Execution Plans

`EXPLAIN` is your window into how PostgreSQL will execute a query. `EXPLAIN ANALYZE` actually runs the query and shows real timings.

### Basic Example

```sql
EXPLAIN ANALYZE
SELECT o.id, u.name, o.total
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'PENDING'
AND o.created_at > NOW() - INTERVAL '7 days'
ORDER BY o.created_at DESC
LIMIT 20;
```

### Understanding the Output

```
Limit  (cost=1234.56..1234.61 rows=20 width=72) (actual time=5.234..5.267 rows=20 loops=1)
  → Sort  (cost=1234.56..1235.06 rows=200 width=72) (actual time=5.230..5.240 rows=200 loops=1)
      Sort Key: o.created_at DESC
      Sort Method: quicksort  Memory: 45kB
      → Hash Join  (cost=120.00..1225.00 rows=200 width=72) (actual time=2.100..4.850 rows=200 loops=1)
          Hash Cond: (o.user_id = u.id)
          → Index Scan using idx_orders_status_created on orders o  (cost=0.43..1100.25 rows=200 width=48)
              Index Cond: (status = 'PENDING')
              Filter: (created_at > (now() - '7 days'))
              Rows Removed by Filter: 50
          → Hash  (cost=80.00..80.00 rows=3200 width=40) (actual time=1.950..1.950 rows=3200 loops=1)
              Buckets: 4096  Batches: 1  Memory Usage: 245kB
              → Seq Scan on users u  (cost=0.00..80.00 rows=3200 width=40) (actual time=0.010..0.950 rows=3200 loops=1)

Planning Time: 0.523 ms
Execution Time: 5.345 ms
```

### Decoding Each Part

**1. Node Types**

| Node | What It Means | When It's Good | When It's Bad |
|------|---------------|----------------|---------------|
| **Seq Scan** | Reads every row in table | Small tables (<1000 rows) | Large tables (>10K rows), especially if indexed |
| **Index Scan** | Uses index to find rows, fetches from table | Selective queries (returns <10% of table) | Returning most rows (index overhead not worth it) |
| **Index Only Scan** | Gets all data from index, no table access | Covering index exists | N/A - always good! |
| **Bitmap Heap Scan** | Index finds many rows, batch-fetches from table | Moderate selectivity (10-50% of table) | N/A - optimizer's choice |
| **Hash Join** | Builds hash table of smaller table, probes with larger | Most joins | One side is huge (>1GB), causes memory spill |
| **Nested Loop** | For each row in outer table, scan inner table | Inner side has index, returns few rows | Both sides are large without index |
| **Merge Join** | Sorted merge of two tables | Both sides already sorted | Unsorted data requiring sort |
| **Sort** | Sorts rows in memory or disk | Small result set (<1000 rows), no index on ORDER BY | Large result set, no index - consider adding index |

**2. Cost Numbers**

```
cost=1234.56..1235.06
  ↑            ↑
  Startup     Total
  cost        cost
```

- **Startup cost**: Work before first row can be returned (e.g., sorting all rows)
- **Total cost**: Estimated cost to return all rows
- **Units**: Arbitrary (typically, 1.0 = one sequential page read)
- **Not wall-clock time**: Just for comparing plans

**3. Actual vs Estimated**

```
rows=200                    (estimated)
actual time=5.230..5.240    (real time in milliseconds)
rows=200                    (actual row count)
loops=1                     (how many times this node executed)
```

**🚨 Red flag**: Large difference between estimated and actual rows means stale statistics!

```
Seq Scan on orders  (cost=0.00..100.00 rows=1000)
                    (actual time=0.050..15234.123 rows=5000000 loops=1)
                     ↑                               ↑
                  Expected 1000                Got 5 million!

→ RUN ANALYZE orders;
```

**4. Filter vs Index Cond**

```
Index Scan using idx_orders_status on orders
  Index Cond: (status = 'PENDING')      ← Index helped here
  Filter: (created_at > NOW() - '7 days')  ← Applied AFTER index scan
  Rows Removed by Filter: 5000          ← Wasted work!
```

**Fix**: Create a composite index:
```sql
CREATE INDEX idx_orders_status_created ON orders (status, created_at);
```

Now both conditions use the index:
```
Index Cond: ((status = 'PENDING') AND (created_at > (now() - '7 days')))
Filter: (none)
```

### What to Look For in EXPLAIN Output

#### 1. Sequential Scans on Large Tables
```
Seq Scan on orders  (cost=0.00..145231.00 rows=2000000)
```
**Problem**: Reading all 2M rows
**Fix**: Add index on WHERE clause columns

#### 2. High Startup Cost on Sort
```
Sort  (cost=125000.50..127500.50 rows=1000000)
  Sort Method: external merge  Disk: 245000kB
```
**Problem**: Sorting 1M rows, spilled to disk
**Fix**: Add index on ORDER BY column or reduce result set with WHERE

#### 3. Nested Loop with Large Tables
```
Nested Loop  (cost=0.43..150000.00 rows=500000)
  → Seq Scan on orders o  (cost=0.00..80000.00 rows=100000)
  → Index Scan using idx_users_pkey on users u  (cost=0.43..8.45 rows=1)
        Index Cond: (id = o.user_id)
```
**Problem**: 100K outer rows × index scan per row = 100K index lookups
**Fix**: Often okay if inner side is indexed. But consider Hash Join if both sides are large.

#### 4. Estimated vs Actual Mismatch
```
Hash Join  (cost=120.00..1225.00 rows=5)
           (actual time=2.100..8234.567 rows=50000 loops=1)
```
**Problem**: Expected 5 rows, got 50K! Optimizer's plan is wrong.
**Fix**: `ANALYZE` the tables

* * *

## The N+1 Query Problem - Detailed Analysis

The most common performance bug in web applications. This pattern appears innocent but causes exponential slowdown.

### The Problem - Step by Step

```js
// Step 1: Fetch orders (1 query)
const orders = await db.query(
  'SELECT * FROM orders WHERE user_id = $1',
  [userId]
);
// Returns 50 orders

// Step 2: For each order, fetch items (50 queries!)
for (const order of orders) {
  order.items = await db.query(
    'SELECT * FROM order_items WHERE order_id = $1',
    [order.id]
  );
}

// Total: 1 + 50 = 51 database round trips
```

**Why This Is Catastrophic:**

```
Each query has overhead:
├─ Network latency: ~5ms (same datacenter)
├─ Query parse/plan: ~1ms
├─ Execution: ~2ms
├─ Result transfer: ~1ms
└─ Total per query: ~9ms

1 query:     9ms
51 queries:  51 × 9ms = 459ms
500 orders:  501 × 9ms = 4.5 seconds!
```

Even with fast queries, the **round-trip latency** kills you.

### Fix 1: JOIN - Single Query

```sql
-- Single query that returns everything
SELECT
  o.id as order_id,
  o.total,
  o.created_at,
  oi.id as item_id,
  oi.product_id,
  oi.qty,
  oi.price
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.user_id = $1
ORDER BY o.id, oi.id;
```

**Result format:**
```
order_id | total | item_id | product_id | qty | price
---------|-------|---------|------------|-----|-------
   101   | 500   |   1     |    P1      |  2  | 100
   101   | 500   |   2     |    P2      |  1  | 300
   102   | 200   |   3     |    P3      |  1  | 200
   103   | 150   |   4     |    P1      |  1  | 100
   103   | 150   |   5     |    P4      |  1  |  50
```

**Application code to restructure:**
```js
const rows = await db.query(joinQuery, [userId]);

// Group by order_id
const orders = {};
for (const row of rows) {
  if (!orders[row.order_id]) {
    orders[row.order_id] = {
      id: row.order_id,
      total: row.total,
      created_at: row.created_at,
      items: []
    };
  }

  if (row.item_id) {  // LEFT JOIN might have NULL items
    orders[row.order_id].items.push({
      id: row.item_id,
      product_id: row.product_id,
      qty: row.qty,
      price: row.price
    });
  }
}

return Object.values(orders);
```

**Performance:**
```
Before (N+1):  51 queries, 459ms
After (JOIN):  1 query, 15ms
Improvement:   30x faster!
```

**When JOIN Gets Problematic:**

If you have many-to-many relationships or multiple nested levels:

```sql
-- This explodes: orders × items × reviews × tags
SELECT *
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
JOIN product_reviews pr ON pr.product_id = p.id
JOIN product_tags pt ON pt.product_id = p.id;

-- Result set becomes massive (cartesian explosion)
-- 10 orders × 5 items each × 3 reviews each × 2 tags each = 300 rows
-- Original data: 10 orders, but 300 rows transferred!
```

### Fix 2: Batch Fetching (2 Queries)

Better when JOINs create too much duplicate data.

```js
// Query 1: Get orders (1 query)
const orders = await db.query(
  'SELECT * FROM orders WHERE user_id = $1',
  [userId]
);
// Returns: [{ id: 101, total: 500 }, { id: 102, total: 200 }, ...]

// Extract all order IDs
const orderIds = orders.map(o => o.id);  // [101, 102, 103, ...]

// Query 2: Get ALL items for ALL orders in one query
const items = await db.query(
  'SELECT * FROM order_items WHERE order_id = ANY($1)',
  [orderIds]
);
// Returns: [
//   { id: 1, order_id: 101, product_id: 'P1', qty: 2 },
//   { id: 2, order_id: 101, product_id: 'P2', qty: 1 },
//   { id: 3, order_id: 102, product_id: 'P3', qty: 1 },
//   ...
// ]

// Group items by order_id in memory
const itemsByOrder = {};
for (const item of items) {
  if (!itemsByOrder[item.order_id]) {
    itemsByOrder[item.order_id] = [];
  }
  itemsByOrder[item.order_id].push(item);
}

// Attach items to orders
for (const order of orders) {
  order.items = itemsByOrder[order.id] || [];
}

return orders;
```

**Performance:**
```
N+1 approach:      51 queries, 459ms
Batch approach:    2 queries, 20ms
Improvement:       23x faster!
```

**This is the DataLoader pattern** used in GraphQL to solve N+1 automatically.

### Fix 3: ORM Eager Loading

Most ORMs provide this out of the box:

```js
// TypeORM
const orders = await orderRepository.find({
  where: { userId },
  relations: ['items']  // Automatically does JOIN or batch fetch
});

// Prisma
const orders = await prisma.order.findMany({
  where: { userId },
  include: { items: true }  // Separate query under the hood
});

// Sequelize
const orders = await Order.findAll({
  where: { userId },
  include: [{ model: OrderItem }]
});
```

**Under the hood**, ORMs use either:
- **JOIN strategy**: Single query with JOIN
- **Batch strategy**: 2 queries with IN clause

Check your ORM's SQL output to verify!

* * *

## Pagination — Offset vs Cursor (The Right Way)

### The Problem with OFFSET

```sql
-- Page 1 (first 20 rows)
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 0;

-- Page 500 (rows 9980-10000)
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 9980;
```

**What happens internally:**

```
Page 500 execution:
1. Scan through 9980 rows
2. Discard all 9980 rows
3. Return next 20 rows
4. Total work: processed 10,000 rows to return 20
```

**Performance degradation:**

| Page | Offset | Rows Scanned | Query Time |
|------|--------|--------------|------------|
| 1    | 0      | 20           | 5ms        |
| 10   | 180    | 200          | 8ms        |
| 100  | 1980   | 2000         | 45ms       |
| 500  | 9980   | 10,000       | 180ms      |
| 1000 | 19,980 | 20,000       | 350ms      |

**Exponential slowdown** as you paginate deeper!

**Additional problems:**
- **Inconsistent results**: If rows are inserted/deleted between page requests, items skip or duplicate
- **Memory usage**: All skipped rows still consume memory during scan

### Cursor-Based Pagination - The Solution

Instead of counting rows, use a **cursor** (the last seen value) to find the next page.

```sql
-- Page 1: Get first 20 rows
SELECT * FROM orders
WHERE created_at < NOW()
ORDER BY created_at DESC
LIMIT 20;

-- Result: [..., last row has created_at = '2024-01-15 10:30:00']

-- Page 2: Use last row's created_at as cursor
SELECT * FROM orders
WHERE created_at < '2024-01-15 10:30:00'  -- ← Cursor from page 1
ORDER BY created_at DESC
LIMIT 20;

-- Page 3: Use last row from page 2 as cursor
SELECT * FROM orders
WHERE created_at < '2024-01-10 08:15:30'  -- ← New cursor
ORDER BY created_at DESC
LIMIT 20;
```

**How it works:**

```
Index on created_at (B-tree, descending):
[2024-01-20] ← Start here (page 1)
[2024-01-19]
[2024-01-18]
   ...
[2024-01-15 10:30:00] ← Cursor from page 1
[2024-01-15 09:45:12] ← Start page 2 here
[2024-01-15 08:22:33]
   ...
```

**The index jumps directly to the cursor position!**
- No scanning through previous rows
- No discarding 9,980 rows
- Same performance for page 1 and page 1000

**Performance comparison:**

| Page | OFFSET Method | Cursor Method |
|------|---------------|---------------|
| 1    | 5ms           | 5ms           |
| 100  | 45ms          | 5ms           |
| 500  | 180ms         | 5ms           |
| 1000 | 350ms         | 5ms           |
| 5000 | 1800ms        | 5ms           |

**Constant time regardless of page number!**

### Implementation

```js
async function getOrders(cursor = null, limit = 20) {
  let query, params;

  if (cursor) {
    // Subsequent pages: use cursor
    query = `
      SELECT id, created_at, total, status
      FROM orders
      WHERE created_at < $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    params = [cursor, limit];
  } else {
    // First page: no cursor
    query = `
      SELECT id, created_at, total, status
      FROM orders
      ORDER BY created_at DESC
      LIMIT $1
    `;
    params = [limit];
  }

  const rows = await db.query(query, params);

  return {
    data: rows,
    nextCursor: rows.length === limit
      ? rows[rows.length - 1].created_at  // Last row's timestamp
      : null  // No more pages
  };
}

// Usage
const page1 = await getOrders();
// { data: [...20 orders...], nextCursor: '2024-01-15T10:30:00Z' }

const page2 = await getOrders(page1.nextCursor);
// { data: [...20 more orders...], nextCursor: '2024-01-10T08:15:30Z' }

const page3 = await getOrders(page2.nextCursor);
// etc.
```

### Handling Non-Unique Cursor Columns

If your cursor column has duplicates (e.g., multiple orders with same `created_at`), add a unique tiebreaker:

```sql
-- Use created_at + id for cursor
SELECT * FROM orders
WHERE
  created_at < $1
  OR (created_at = $1 AND id < $2)  -- Tiebreaker for same timestamp
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

```js
return {
  data: rows,
  nextCursor: rows.length === limit
    ? {
        created_at: rows[rows.length - 1].created_at,
        id: rows[rows.length - 1].id
      }
    : null
};
```

**Create a composite index:**
```sql
CREATE INDEX idx_orders_created_id ON orders (created_at DESC, id DESC);
```

* * *

## Avoiding Common Slow Query Patterns

### 1. Functions on Indexed Columns Break the Index

**The Problem:**

```sql
-- This query is SLOW even with index on created_at
SELECT * FROM orders WHERE YEAR(created_at) = 2024;

-- Why? The function YEAR() wraps the column
-- Index stores: [2024-01-15, 2024-02-20, 2023-12-01, ...]
-- Query needs: [2024, 2024, 2023, ...]
-- Index can't help! Must scan every row and call YEAR() on each.
```

**The Fix - Rewrite as Range:**

```sql
-- Index CAN help with ranges
SELECT * FROM orders
WHERE created_at >= '2024-01-01'
  AND created_at < '2025-01-01';

-- Index stores timestamps, query uses timestamps → perfect match!
```

**Performance difference:**
```
YEAR(created_at) = 2024:  Seq Scan, 5000ms (10M rows)
Range query:              Index Scan, 50ms (same result)
100x faster!
```

**Other examples:**

```sql
-- Bad: function on column
WHERE LOWER(email) = 'user@example.com'
WHERE SUBSTRING(name, 1, 3) = 'Jon'
WHERE DATE(created_at) = '2024-01-15'

-- Good: rewrite without function
WHERE email = 'user@example.com'  -- Store emails lowercase
WHERE name LIKE 'Jon%'
WHERE created_at >= '2024-01-15' AND created_at < '2024-01-16'
```

**When you MUST use a function** → Create a functional index:

```sql
-- Create index on the expression
CREATE INDEX idx_users_lower_email ON users (LOWER(email));

-- Now this query uses the index
SELECT * FROM users WHERE LOWER(email) = 'user@example.com';
```

### 2. Implicit Type Conversion Disables Index

```sql
-- Bad: user_id is INT, but queried with STRING
SELECT * FROM orders WHERE user_id = '42';
                                     ↑
                              String literal

-- PostgreSQL must convert every row: user_id::TEXT = '42'
-- Index on user_id can't be used!
```

**Fix: Match the column type:**

```sql
-- Good: INT column, INT literal
SELECT * FROM orders WHERE user_id = 42;
```

**How to spot this:**

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = '42';

-- Output shows:
Seq Scan on orders  (cost=0.00..10000.00 rows=5000)
  Filter: ((user_id)::text = '42'::text)
            ↑
    Type conversion! Index bypassed!
```

### 3. SELECT * Fetches Unnecessary Data

**The Problem:**

```sql
-- Bad: fetches ALL columns including large ones
SELECT * FROM products WHERE category_id = 5;

-- Table structure:
-- id INT
-- name VARCHAR(100)
-- price NUMERIC
-- description TEXT       ← 5KB average
-- specs JSONB            ← 10KB average
-- images BYTEA           ← 500KB average
-- created_at TIMESTAMP
```

**What happens:**

```
50 matching products:
├─ Small columns (id, name, price): 50 × 120 bytes = 6 KB
├─ description: 50 × 5 KB = 250 KB
├─ specs: 50 × 10 KB = 500 KB
├─ images: 50 × 500 KB = 25,000 KB (25 MB!)
└─ Total transfer: ~26 MB for 50 products!
```

**Performance impact:**
- **Network transfer**: 26 MB takes 200ms on 1 Gbps
- **Memory**: All 26 MB held in app memory
- **Serialization**: JSON encoding costs CPU

**Fix: Select only what you need:**

```sql
-- Good: only columns actually used
SELECT id, name, price, thumbnail_url
FROM products
WHERE category_id = 5;

-- Transfer: 50 × 150 bytes = 7.5 KB
-- 3,500x less data!
```

**Real-world example:**

```js
// Bad: Fetches everything
const users = await db.query('SELECT * FROM users');
// Returns: { id, email, password_hash, preferences (10KB JSONB),
//           avatar (200KB), bio, created_at, updated_at, ... }

// Good: Only what the API needs
const users = await db.query(`
  SELECT id, email, first_name, last_name
  FROM users
`);
```

**Bonus: Covering Index Possible**

```sql
-- With SELECT *, covering index is impossible
SELECT * FROM orders WHERE user_id = 42 ORDER BY created_at;

-- Index must: lookup rows → fetch full rows from table

-- With specific columns, covering index is possible
SELECT id, total, created_at
FROM orders
WHERE user_id = 42
ORDER BY created_at;

-- Covering index: all needed columns in the index
CREATE INDEX idx_orders_covering ON orders (user_id, created_at, id, total);
-- Now: Index Only Scan → no table access needed → 10x faster!
```

### 4. Unbounded Queries (No LIMIT)

```sql
-- Dangerous: could return millions of rows
SELECT * FROM events WHERE user_id = 42;

-- What if user has 1 million events?
-- App crashes with OOM!
```

**Always add LIMIT for list queries:**

```sql
-- Safe: bounded result
SELECT * FROM events
WHERE user_id = 42
ORDER BY created_at DESC
LIMIT 100;
```

**For APIs, enforce max page size:**

```js
async function getEvents(userId, limit = 20) {
  // Enforce maximum
  const safeLimit = Math.min(limit, 100);

  return db.query(
    'SELECT * FROM events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, safeLimit]
  );
}
```

### 5. COUNT(*) on Large Tables

```sql
-- This is SLOW on large tables (>10M rows)
SELECT COUNT(*) FROM orders;

-- Why? PostgreSQL's MVCC means it must scan all rows
-- (different transactions see different row versions)
-- No shortcut! 10M rows = 5-10 seconds
```

**Solutions:**

**Option 1: Approximate count (fast, good enough for UI)**

```sql
-- PostgreSQL: use table statistics
SELECT reltuples::BIGINT AS estimate
FROM pg_class
WHERE relname = 'orders';

-- Returns: ~9,876,543 (estimate, updated by ANALYZE)
-- Time: < 1ms
```

**Option 2: Maintain a counter table**

```sql
CREATE TABLE counters (
  name VARCHAR PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0
);

INSERT INTO counters (name, value) VALUES ('total_orders', 0);

-- Increment on insert
INSERT INTO orders (...) VALUES (...);
UPDATE counters SET value = value + 1 WHERE name = 'total_orders';

-- Decrement on delete
DELETE FROM orders WHERE id = 123;
UPDATE counters SET value = value - 1 WHERE name = 'total_orders';

-- Get count instantly
SELECT value FROM counters WHERE name = 'total_orders';
-- Time: < 1ms, always exact
```

**Option 3: Cache the count**

```js
// Compute once per hour, cache in Redis
async function getOrderCount() {
  const cached = await redis.get('order_count');
  if (cached) return parseInt(cached);

  const { rows } = await db.query('SELECT COUNT(*) FROM orders');
  await redis.set('order_count', rows[0].count, 'EX', 3600); // 1 hour TTL
  return rows[0].count;
}
```

* * *

## Query Optimization Techniques

### 1. Use EXISTS Instead of COUNT for Existence Checks

**Bad - Counts all rows:**

```sql
-- This scans ALL matching rows
SELECT COUNT(*) FROM orders WHERE user_id = 42;
-- Returns: 500
-- Then check: 500 > 0? → Yes

-- Wasted work: counted 499 extra rows
```

**Good - Stops at first match:**

```sql
-- This stops immediately after finding first row
SELECT EXISTS(SELECT 1 FROM orders WHERE user_id = 42);
-- Returns: true (after finding 1st row)

-- Scanned only 1 row instead of 500!
```

**Performance difference:**

```
COUNT(*):  Scans 50,000 matching rows, 120ms
EXISTS():  Scans 1 row, 2ms
60x faster!
```

**Application code:**

```js
// Bad
const { rows } = await db.query('SELECT COUNT(*) FROM orders WHERE user_id = $1', [userId]);
const hasOrders = parseInt(rows[0].count) > 0;

// Good
const { rows } = await db.query('SELECT EXISTS(SELECT 1 FROM orders WHERE user_id = $1)', [userId]);
const hasOrders = rows[0].exists;
```

### 2. Batch Writes Instead of Row-by-Row Inserts

**Bad - 1000 round trips:**

```js
for (const item of items) {
  await db.query(
    'INSERT INTO order_items (order_id, product_id, qty) VALUES ($1, $2, $3)',
    [orderId, item.productId, item.qty]
  );
}

// Network latency: 1000 × 5ms = 5000ms
// Total time: ~5 seconds
```

**Good - 1 round trip:**

```sql
-- Single batch insert
INSERT INTO order_items (order_id, product_id, qty)
VALUES
  (1, 'P1', 2),
  (1, 'P2', 1),
  (1, 'P3', 5),
  ... -- all 1000 rows
;

-- Time: ~100ms (50x faster!)
```

**Node.js implementation:**

```js
// Build VALUES clause dynamically
const valueStrings = items.map((_, i) =>
  `($1, $${i * 2 + 2}, $${i * 2 + 3})`
).join(', ');

const values = items.flatMap(item => [item.productId, item.qty]);

await db.query(
  `INSERT INTO order_items (order_id, product_id, qty) VALUES ${valueStrings}`,
  [orderId, ...values]
);
```

**Multi-row UPDATE alternative:**

```sql
-- Update multiple rows with CASE
UPDATE products
SET stock = CASE
  WHEN id = 1 THEN stock - 5
  WHEN id = 2 THEN stock - 3
  WHEN id = 3 THEN stock - 10
END
WHERE id IN (1, 2, 3);
```

### 3. UPSERT Instead of SELECT + INSERT/UPDATE

**Bad - Race condition + 2 round trips:**

```js
// Step 1: Check if exists
const existing = await db.query(
  'SELECT * FROM product_views WHERE product_id = $1 AND user_id = $2',
  [productId, userId]
);

// Step 2: Insert or update
if (existing.rows.length === 0) {
  await db.query(
    'INSERT INTO product_views (product_id, user_id, count) VALUES ($1, $2, 1)',
    [productId, userId]
  );
} else {
  await db.query(
    'UPDATE product_views SET count = count + 1 WHERE product_id = $1 AND user_id = $2',
    [productId, userId]
  );
}

// Problems:
// - 2 database round trips
// - Race condition: two requests can both see "not exists" and both insert
```

**Good - Atomic UPSERT:**

```sql
-- PostgreSQL: ON CONFLICT
INSERT INTO product_views (product_id, user_id, count)
VALUES ($1, $2, 1)
ON CONFLICT (product_id, user_id)
DO UPDATE SET count = product_views.count + 1;

-- MySQL: ON DUPLICATE KEY UPDATE
INSERT INTO product_views (product_id, user_id, count)
VALUES (?, ?, 1)
ON DUPLICATE KEY UPDATE count = count + 1;
```

**Performance:**
```
SELECT + INSERT/UPDATE: 2 queries, 15ms, race condition possible
UPSERT:                 1 query, 5ms, atomic ✓
```

* * *

## Connection Pooling - Critical for Performance

Database connections are expensive resources. **Never** create a new connection per request.

### Why Connections Are Expensive

Each connection involves:

```
1. TCP handshake (3-way)          ~1-5ms
2. SSL negotiation                ~10-50ms
3. Authentication                 ~10-50ms
4. PostgreSQL backend fork        ~5-20ms
5. Memory allocation              ~5-10 MB per connection
   Total:                         ~50-200ms + memory
```

**Example disaster:**

```js
// BAD: New connection every request
app.get('/orders', async (req, res) => {
  const client = new pg.Client({ connectionString });
  await client.connect();  // ← 100ms overhead!
  const result = await client.query('SELECT * FROM orders LIMIT 10');  // ← 5ms
  await client.end();
  res.json(result.rows);
});

// Result: 105ms per request, 95% wasted on connection overhead!
```

### Using Connection Pools

```js
// GOOD: Shared pool across all requests
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Max connections in pool
  min: 5,                     // Min idle connections (kept warm)
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000,  // Error if can't get connection in 2s
});

app.get('/orders', async (req, res) => {
  // Pool automatically checks out & returns connection
  const result = await pool.query('SELECT * FROM orders LIMIT 10');
  res.json(result.rows);
});

// Connection is reused for next request!
// No connection overhead → 5ms per request
```

**How the pool works:**

```
Request 1: Borrows connection #1 → runs query → returns connection #1 to pool
Request 2: Borrows connection #1 (reused!) → runs query → returns
Request 3: Borrows connection #1 again (reused!) → ...
```

### Pool Sizing Formula

```
Recommended pool size = (CPU cores × 2) + effective_spindle_count

For a 4-core server:
pool size = (4 × 2) + 1 = 9

For I/O-bound workload (typical web app):
pool size = cores × 2 to cores × 4
```

**Why not just set max = 1000?**

More connections ≠ better performance:

```
Too few:  Requests wait for available connection
Too many: Database overwhelmed
          - Context switching overhead
          - Memory pressure (10 MB × 1000 = 10 GB)
          - Lock contention increases
```

**Optimal is usually 10-50 connections per application instance.**

### External Pooler: PgBouncer

For multiple application servers:

```
Without PgBouncer:
App1: 20 connections ─┐
App2: 20 connections  ├─► PostgreSQL (60 connections)
App3: 20 connections ─┘

With PgBouncer:
App1: 100 connections ─┐
App2: 100 connections  ├─► PgBouncer ─► PostgreSQL (20 connections)
App3: 100 connections ─┘

Apps can have large pools for fast checkout,
but PgBouncer limits actual DB connections.
```

* * *

## Slow Query Log - Find Problems Automatically

Don't wait for users to complain. Log slow queries automatically.

### PostgreSQL Setup

```sql
-- Log queries slower than 100ms
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();

-- Or set per session
SET log_min_duration_statement = 100;

-- Check setting
SHOW log_min_duration_statement;
```

**Log output:**

```
LOG: duration: 1234.567 ms  statement: SELECT * FROM orders WHERE status = 'PENDING' ORDER BY created_at DESC
```

### Analyze Logs with pgBadger

```bash
# Install pgBadger
sudo apt install pgbadger

# Analyze logs
pgbadger /var/log/postgresql/postgresql.log -o report.html

# Open report.html
# Shows:
# - Slowest queries
# - Most frequent queries
# - Queries by duration
# - Temporal distribution (time of day)
```

### PostgreSQL pg_stat_statements Extension

```sql
-- Enable extension
CREATE EXTENSION pg_stat_statements;

-- View slowest queries
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Reset statistics
SELECT pg_stat_statements_reset();
```

**Example output:**

```
query                               | calls | mean_exec_time | max_exec_time
------------------------------------|-------|----------------|---------------
SELECT * FROM orders WHERE status...|  5000 |       245.3 ms |      1234.5 ms
UPDATE products SET stock...        | 10000 |       123.4 ms |       567.8 ms
```

**Find queries to optimize:**
1. **High mean_exec_time** → needs optimization (add index, rewrite)
2. **High calls × mean_exec_time** → optimize for biggest impact
3. **High max_exec_time** → occasional slow execution (stale stats? lock contention?)

* * *

## Summary - Query Optimization Checklist

**Before deploying:**
- [ ] Run `EXPLAIN ANALYZE` on all queries
- [ ] No sequential scans on tables > 10K rows
- [ ] Add indexes on all foreign keys
- [ ] Add indexes on WHERE/JOIN/ORDER BY columns
- [ ] Use covering indexes where possible
- [ ] Use cursor pagination, not OFFSET
- [ ] No N+1 queries (use JOINs or batch fetching)
- [ ] Connection pooling configured
- [ ] Slow query log enabled

**When optimizing:**
1. Use `EXPLAIN ANALYZE` to find the bottleneck
2. Check if statistics are stale (`ANALYZE` the table)
3. Look for missing indexes
4. Rewrite functions on columns as ranges
5. Consider denormalization only after all else fails

**Remember:**
- 80% of slow queries are fixed by adding the right index
- N+1 queries are the #1 application-level problem
- OFFSET pagination breaks at scale; use cursor-based
- Connection pooling is not optional

* * *

## Interview Definition (Short Answer)

> "Query optimization starts with EXPLAIN ANALYZE to understand the execution plan. The most common issues are: missing indexes (look for Seq Scan), N+1 queries (fixed with JOINs or batch fetching with IN clause), offset pagination (use cursor-based instead), and functions wrapping indexed columns (rewrite as ranges or use functional indexes). Always use connection pooling, batch writes over loops, and SELECT specific columns instead of SELECT *. The query optimizer uses table statistics, so run ANALYZE after bulk changes."
