---
sidebar_position: 3
---

## Query Optimization

A slow query in production doesn't just slow down one user — it holds database connections, blocks other queries, and can cascade into an outage. Understanding how the database executes queries and where to intervene is a core senior engineering skill.

* * *

How the Query Optimizer Works
==============================

When you run a SQL query, the database doesn't execute it literally. The **query optimizer**:

1. Parses the SQL into a query tree
2. Generates multiple equivalent execution plans
3. Estimates the cost of each plan (using table statistics)
4. Picks the cheapest plan and executes it

The optimizer uses **statistics** (row counts, column cardinality, histogram of values) to estimate costs. Stale statistics lead to bad plans.

```sql
-- PostgreSQL: update statistics manually
ANALYZE orders;

-- MySQL: update statistics
ANALYZE TABLE orders;
```

* * *

EXPLAIN — Reading Execution Plans
===================================

`EXPLAIN` shows the plan without running the query. `EXPLAIN ANALYZE` runs it and shows actual times.

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

```
Limit  (cost=1234.56..1234.61 rows=20)
  → Sort  (cost=1234.56..1235.06 rows=200 width=72)
      Sort Key: o.created_at DESC
      → Hash Join  (cost=120.00..1225.00 rows=200 width=72)
          Hash Cond: (o.user_id = u.id)
          → Index Scan using idx_orders_status_created on orders o
              Index Cond: (status = 'PENDING')
              Filter: (created_at > (now() - '7 days'))
          → Hash  (cost=80.00..80.00 rows=3200 width=40)
              → Seq Scan on users u
```

### What to look for

| Node | Concern |
|------|---------|
| `Seq Scan` on large table | Missing index — check if WHERE/JOIN columns are indexed |
| `Hash Join` | Good for large tables, bad if one side is huge (memory spill) |
| `Nested Loop` | Good if inner side is small; catastrophic if both sides are large |
| `Sort` without index | Expensive for large datasets; consider index on ORDER BY column |
| High `rows` estimate vs actual | Stale statistics — run `ANALYZE` |
| `Filter` after index scan | Index filters some rows, but rows fail the additional filter — consider composite index |

* * *

The N+1 Query Problem
======================

The most common performance bug in web applications. You run 1 query to fetch a list, then N more queries to fetch related data for each row.

```js
// Bad — N+1
const orders = await db.query('SELECT * FROM orders WHERE user_id = $1', [userId]);
// ↑ 1 query

for (const order of orders) {
  order.items = await db.query(
    'SELECT * FROM order_items WHERE order_id = $1', [order.id]
  );
  // ↑ N queries — 1 per order
}

// If there are 50 orders → 51 total queries
```

### Fix 1: JOIN

```sql
SELECT o.id, o.total, oi.product_id, oi.qty, oi.price
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.user_id = $1;
```

One query. Combine in application code:

```js
const rows = await db.query(joinQuery, [userId]);
const orders = groupBy(rows, 'id'); // group order_items by order id
```

### Fix 2: Two queries with IN clause (batch fetch)

Better when the JOIN produces too many rows (many-to-many, large result sets).

```js
// Query 1: get orders
const orders = await db.query('SELECT * FROM orders WHERE user_id = $1', [userId]);
const orderIds = orders.map(o => o.id);

// Query 2: get all items in one shot
const items = await db.query(
  'SELECT * FROM order_items WHERE order_id = ANY($1)', [orderIds]
);

// Combine in memory
const itemsByOrderId = groupBy(items, 'order_id');
for (const order of orders) {
  order.items = itemsByOrderId[order.id] || [];
}
```

2 queries instead of N+1. This is the DataLoader pattern (used in GraphQL).

### Fix 3: ORM eager loading

```js
// Sequelize
const orders = await Order.findAll({
  where: { userId },
  include: [{ model: OrderItem }],  // generates a JOIN or separate batch query
});

// Prisma
const orders = await prisma.order.findMany({
  where: { userId },
  include: { items: true },
});
```

* * *

Pagination — Offset vs Cursor
==============================

### Offset pagination — the hidden performance problem

```sql
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 10000;
```

The database must scan and discard 10,000 rows before returning 20. At page 500 of a 10M row table, this becomes catastrophically slow.

Also inconsistent: if a row is inserted or deleted between page requests, items skip or duplicate.

### Cursor-based pagination — the right way

```sql
-- First page
SELECT * FROM orders
WHERE created_at < NOW()
ORDER BY created_at DESC
LIMIT 20;

-- Next page — use the last row's created_at as cursor
SELECT * FROM orders
WHERE created_at < '2024-01-15 10:30:00'  -- cursor from last row
ORDER BY created_at DESC
LIMIT 20;
```

```js
async function getOrders(cursor, limit = 20) {
  const query = cursor
    ? 'SELECT * FROM orders WHERE created_at < $1 ORDER BY created_at DESC LIMIT $2'
    : 'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1';

  const params = cursor ? [cursor, limit] : [limit];
  const rows = await db.query(query, params);

  return {
    data: rows,
    nextCursor: rows.length === limit
      ? rows[rows.length - 1].created_at
      : null,
  };
}
```

**No OFFSET** — the index on `created_at` jumps directly to the cursor position. Performance is identical whether you're on page 1 or page 10,000.

* * *

Avoiding Common Slow Query Patterns
=====================================

### Functions on indexed columns break the index

```sql
-- Bad — YEAR() wraps the column, index on created_at is not used
WHERE YEAR(created_at) = 2024

-- Good — use a range that the index can satisfy
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'
```

```sql
-- Bad — LOWER() wraps the column
WHERE LOWER(email) = 'user@example.com'

-- Good — create a functional index, or store email in lowercase
CREATE INDEX idx_users_lower_email ON users (LOWER(email));
```

### Implicit type conversion

```sql
-- Bad — user_id is INT, '42' is a string → implicit cast, index skipped
WHERE user_id = '42'

-- Good — match the column type
WHERE user_id = 42
```

### SELECT * fetches unnecessary data

```sql
-- Bad — fetches all columns including large text/blob columns
SELECT * FROM products WHERE category_id = 5;

-- Good — fetch only what you need
SELECT id, name, price, thumbnail_url FROM products WHERE category_id = 5;
```

Especially important when you have `TEXT`, `JSONB`, or `BYTEA` columns — `SELECT *` forces the DB to deserialize everything.

### Unbounded queries

```sql
-- Bad — could return millions of rows
SELECT * FROM events WHERE user_id = 42;

-- Good — always add LIMIT for list queries
SELECT * FROM events WHERE user_id = 42 ORDER BY created_at DESC LIMIT 100;
```

### COUNT(*) on large tables

```sql
-- Slow on large tables — full scan
SELECT COUNT(*) FROM orders;

-- Use approximate count for display purposes
SELECT reltuples::BIGINT FROM pg_class WHERE relname = 'orders';

-- Or maintain a counter table
UPDATE counters SET value = value + 1 WHERE name = 'total_orders';
```

* * *

Query Optimization Techniques
================================

### Use EXISTS instead of COUNT for existence checks

```sql
-- Bad — counts all matching rows, then checks if > 0
SELECT COUNT(*) FROM orders WHERE user_id = 42 > 0;

-- Good — stops at first match
SELECT EXISTS(SELECT 1 FROM orders WHERE user_id = 42);
```

### Batch writes instead of row-by-row inserts

```sql
-- Bad — 1000 round trips
for each item:
  INSERT INTO order_items (order_id, product_id, qty) VALUES (1, ?, ?);

-- Good — 1 round trip
INSERT INTO order_items (order_id, product_id, qty)
VALUES (1, 'P1', 2), (1, 'P2', 1), (1, 'P3', 5), ...;
```

```js
// Node.js batch insert
const values = items.map((item, i) =>
  `($1, $${i * 2 + 2}, $${i * 2 + 3})`
).join(', ');

const params = [orderId, ...items.flatMap(i => [i.productId, i.qty])];

await db.query(`INSERT INTO order_items (order_id, product_id, qty) VALUES ${values}`, params);
```

### Use CTEs for readable multi-step queries

```sql
WITH
pending_orders AS (
  SELECT * FROM orders WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '24 hours'
),
affected_users AS (
  SELECT DISTINCT user_id FROM pending_orders
)
SELECT u.email, COUNT(po.id) as stuck_orders
FROM users u
JOIN affected_users au ON au.user_id = u.id
JOIN pending_orders po ON po.user_id = u.id
GROUP BY u.email;
```

### UPSERT instead of SELECT + INSERT/UPDATE

```sql
-- Bad — two round trips, race condition between SELECT and INSERT
SELECT * FROM product_views WHERE product_id = $1 AND user_id = $2;
-- If not exists:
INSERT INTO product_views ...;
-- If exists:
UPDATE product_views SET count = count + 1 ...;

-- Good — atomic UPSERT
INSERT INTO product_views (product_id, user_id, count)
VALUES ($1, $2, 1)
ON CONFLICT (product_id, user_id)
DO UPDATE SET count = product_views.count + 1;
```

* * *

Connection Pooling
===================

Database connections are expensive — each one uses memory on the DB server and involves TCP handshakes. Never open a new connection per request.

```js
// Bad — new connection per request
app.get('/orders', async (req, res) => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const result = await client.query('SELECT * FROM orders');
  await client.end();
  res.json(result.rows);
});

// Good — shared pool
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,          // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

app.get('/orders', async (req, res) => {
  const result = await pool.query('SELECT * FROM orders');
  res.json(result.rows);
});
```

### Pool sizing formula

```
pool_size = Ncpu * 2 + 1   (PostgreSQL recommendation by PgBouncer team)

For a server with 4 CPUs:
pool_size = 4 * 2 + 1 = 9
```

Too many connections hurt performance (context switching, memory). Most Postgres instances support 100–200 connections. Use **PgBouncer** as a connection pooler when you have many app servers.

* * *

Slow Query Log
===============

Find slow queries automatically.

**PostgreSQL:**

```sql
-- Log queries slower than 100ms
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();

-- Or per session
SET log_min_duration_statement = 100;
```

**MySQL:**

```sql
SET GLOBAL slow_query_log = 1;
SET GLOBAL long_query_time = 0.1;  -- 100ms
```

Use tools like **pgBadger** (PostgreSQL) or **pt-query-digest** (MySQL) to analyze slow query logs.

* * *

Interview definition (short answer)
=====================================

> "Query optimization starts with EXPLAIN ANALYZE to understand the execution plan. The most common issues are: missing indexes, N+1 queries (fixed with JOINs or batch fetching), offset pagination (fixed with cursor-based), and functions wrapping indexed columns. Always use connection pooling, batch writes, and SELECT specific columns instead of SELECT *."
