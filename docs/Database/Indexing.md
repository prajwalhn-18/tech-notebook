---
sidebar_position: 4
---

## Indexing

An index is a **separate data structure** that the database maintains to speed up queries. Without indexes, every query scans every row in the table — a **sequential scan** (O(n)). With the right index, the database jumps directly to matching rows (O(log n)).

Indexes are the single biggest performance lever in a relational database. Most slow queries are fixed by a missing or wrong index.

* * *

How B-Tree Indexes Work
========================

The default index type in PostgreSQL, MySQL, and most relational DBs is a **B-Tree (Balanced Tree)**.

```
                    [50]
                  /       \
           [25]               [75]
          /    \             /    \
      [10,20] [30,40]   [60,70] [80,90]
```

- Each node contains sorted keys with pointers to children
- Leaf nodes contain the actual row pointers (or the data itself for clustered indexes)
- Tree stays balanced — every leaf is at the same depth
- Search is O(log n) — a table with 1 million rows requires ~20 comparisons

**Supports:** `=`, `<`, `>`, `<=`, `>=`, `BETWEEN`, `ORDER BY`, `LIKE 'prefix%'`

**Does NOT support:** `LIKE '%suffix'`, case-insensitive search without a special index, full-text search

* * *

Types of Indexes
=================

### Primary Key Index

Automatically created on the primary key. In most DBs, the table is physically sorted by the primary key (clustered index in MySQL InnoDB; heap-based in Postgres).

```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,  -- index created automatically
  user_id INT NOT NULL,
  total NUMERIC NOT NULL
);
```

### Secondary Index

Any additional index you create.

```sql
CREATE INDEX idx_orders_user_id ON orders (user_id);
```

Now `WHERE user_id = 42` uses the index instead of a full scan.

### Composite Index (Multi-Column)

An index on multiple columns.

```sql
CREATE INDEX idx_orders_user_status ON orders (user_id, status);
```

**Column order matters.** The leftmost column is the most selective. This index works for:

```sql
WHERE user_id = 42                       -- ✅ uses index
WHERE user_id = 42 AND status = 'PAID'  -- ✅ uses both columns
WHERE status = 'PAID'                    -- ❌ cannot use index (skips user_id)
```

This is the **leftmost prefix rule** — you can only use a composite index starting from the left.

### Covering Index

An index that contains all columns a query needs — the database never needs to touch the main table.

```sql
-- Query
SELECT user_id, status, total FROM orders WHERE user_id = 42;

-- Covering index for this query
CREATE INDEX idx_orders_covering ON orders (user_id, status, total);
```

The index has all needed columns — **zero table lookups**. Very fast.

### Partial Index

An index over a subset of rows — much smaller, faster to maintain.

```sql
-- Only index pending orders (ignore delivered/cancelled)
CREATE INDEX idx_orders_pending ON orders (created_at)
WHERE status = 'PENDING';

-- Only index non-deleted records
CREATE INDEX idx_users_active_email ON users (email)
WHERE deleted_at IS NULL;
```

If you only query active/pending records, this is far more efficient than a full index.

### Unique Index

Enforces uniqueness AND enables fast lookups.

```sql
CREATE UNIQUE INDEX idx_users_email ON users (email);
```

### Expression / Functional Index

Index on a computed expression.

```sql
-- Query uses LOWER() for case-insensitive search
SELECT * FROM users WHERE LOWER(email) = LOWER('User@Example.com');

-- Index on the expression
CREATE INDEX idx_users_lower_email ON users (LOWER(email));
```

Without this, the index on `email` would not be used because the query applies `LOWER()`.

* * *

How to Know if an Index is Being Used
=======================================

Use `EXPLAIN` (or `EXPLAIN ANALYZE` to also run the query).

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 42 AND status = 'PAID';
```

```
Index Scan using idx_orders_user_status on orders
  (cost=0.43..8.45 rows=3 width=64)
  (actual time=0.031..0.035 rows=3 loops=1)
  Index Cond: ((user_id = 42) AND (status = 'PAID'))
```

### Key terms in EXPLAIN output

| Term | Meaning |
|------|---------|
| `Seq Scan` | Full table scan — no index used |
| `Index Scan` | Uses index to find rows, then fetches from table |
| `Index Only Scan` | Uses index only — covering index, no table access |
| `Bitmap Heap Scan` | Collects matching rows from index, then batch-fetches from table |
| `cost=X..Y` | Estimated cost (X = startup, Y = total) |
| `rows=N` | Estimated number of rows |
| `actual time` | Real execution time (only with ANALYZE) |

```sql
-- Full table scan — needs an index
Seq Scan on orders  (cost=0.00..45231.00 rows=2000000 width=64)

-- After adding index
Index Scan using idx_orders_user_id on orders  (cost=0.43..8.45 rows=3)
```

* * *

Index Selectivity
==================

**Selectivity** = how many distinct values an index column has. High selectivity = few rows per value = index is useful.

```sql
-- High selectivity — good candidate for index
email         → millions of unique values, 1 row per value
order_id      → unique
transaction_id → unique

-- Low selectivity — index often not worth it
status        → 5 values (PENDING, PAID, SHIPPED, DELIVERED, CANCELLED)
is_active     → 2 values (true/false)
country       → ~200 values
```

For low-selectivity columns, a full table scan is often faster than using the index (because the index lookup + table fetch overhead is worse than just scanning).

**Exception:** Partial indexes can make low-selectivity columns worthwhile.

```sql
-- status alone is low selectivity, but filtering on one status with a date range is selective
CREATE INDEX idx_orders_pending_created ON orders (created_at)
WHERE status = 'PENDING';
```

* * *

When Indexes Hurt
==================

Indexes aren't free:

1. **Write overhead** — every `INSERT`, `UPDATE`, `DELETE` must update all indexes on that table. A table with 10 indexes pays 10x the write cost.

2. **Storage** — indexes take disk space (sometimes as much as the table itself).

3. **Maintenance** — indexes become fragmented over time. Postgres auto-vacuums; MySQL requires `OPTIMIZE TABLE`.

### The write vs read tradeoff

| Workload | Index strategy |
|---|---|
| Read-heavy (reporting, search) | More indexes, optimize reads |
| Write-heavy (event ingestion, logs) | Fewer indexes, minimize write overhead |
| Mixed OLTP | Index only what queries actually use |

* * *

Common Indexing Mistakes
=========================

### Over-indexing

```sql
-- Bad: index on every column "just in case"
CREATE INDEX ON orders (user_id);
CREATE INDEX ON orders (status);
CREATE INDEX ON orders (total);
CREATE INDEX ON orders (created_at);
CREATE INDEX ON orders (delivery_address);
-- Result: inserts are 5x slower, indexes rarely used together
```

### Wrong column order in composite index

```sql
-- Query
WHERE status = 'PAID' AND user_id = 42

-- Wrong — status first (low selectivity)
CREATE INDEX idx ON orders (status, user_id);

-- Better — user_id first (high selectivity)
CREATE INDEX idx ON orders (user_id, status);
```

### Indexing a column used in a function without a functional index

```sql
-- No index used — YEAR() wraps the column
WHERE YEAR(created_at) = 2024

-- Fix: rewrite the query to use a range
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'
-- Now the index on created_at is used
```

### Implicit type conversion breaks indexes

```sql
-- user_id is INT, but queried with a string — implicit cast, index skipped
WHERE user_id = '42'   -- ❌ string vs int

-- Fix: use the correct type
WHERE user_id = 42     -- ✅
```

* * *

Index for Common Query Patterns
=================================

```sql
-- Pagination on large tables — index on sort column
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);

-- Soft deletes — partial index
CREATE INDEX idx_users_active ON users (email) WHERE deleted_at IS NULL;

-- Foreign key — always index FKs (prevents full scans on joins)
CREATE INDEX idx_order_items_order_id ON order_items (order_id);

-- Multi-tenant — composite with tenant first
CREATE INDEX idx_orders_tenant_user ON orders (tenant_id, user_id);

-- Full-text search
CREATE INDEX idx_products_fts ON products USING GIN(to_tsvector('english', name || ' ' || description));
```

* * *

Finding Missing Indexes
========================

```sql
-- PostgreSQL: find sequential scans on large tables
SELECT schemaname, tablename, seq_scan, seq_tup_read, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC;

-- Find unused indexes (wasteful for write performance)
SELECT indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelname NOT LIKE 'pg_%';

-- Find slow queries (requires pg_stat_statements)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

* * *

Interview definition (short answer)
=====================================

> "Indexes are B-tree data structures that allow O(log n) lookups instead of O(n) sequential scans. Composite index column order follows the leftmost prefix rule. Covering indexes eliminate table fetches entirely. Partial indexes reduce size and maintenance. Indexes trade write performance for read performance — index only what your queries actually need."
