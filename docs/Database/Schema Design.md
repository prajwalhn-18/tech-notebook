---
sidebar_position: 8
---

## Schema Design

A good schema is one you barely think about years later. A bad schema becomes the technical debt that haunts every feature — migrations that take hours, queries that can't be indexed, relationships that don't make sense.

Schema design decisions are among the hardest to reverse. Get them right early.

* * *

Data Types — Choose Carefully
==============================

Choosing the right data type matters for storage, performance, and correctness.

### IDs

```sql
-- Bad: sequential integer (guessable, exhausts at ~2.1 billion)
id SERIAL PRIMARY KEY

-- Better: BIGSERIAL (exhausts at ~9.2 quintillion)
id BIGSERIAL PRIMARY KEY

-- Best for distributed systems: UUID (globally unique, not sequential)
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- Best for time-ordered UUIDs (UUIDv7) — sortable, unique, Postgres 17+
id UUID PRIMARY KEY DEFAULT uuidv7()
```

**UUID tradeoffs:**
- Not sequential → random B-tree insertions → more page splits → index fragmentation
- Much larger than INT (16 bytes vs 4 bytes)
- Not human-readable

For most applications: `BIGSERIAL` for internal tables, `UUID` for IDs exposed to clients (prevents enumeration attacks).

### Text

```sql
-- VARCHAR(n): enforces maximum length, slight overhead for variable length
name VARCHAR(255)

-- TEXT: unlimited length, no overhead — preferred in PostgreSQL
description TEXT

-- CHAR(n): fixed length, pads with spaces — rarely useful
code CHAR(3)  -- only for truly fixed-length codes like country codes
```

In PostgreSQL, `TEXT` and `VARCHAR` have identical performance. Use `TEXT` unless you genuinely need to enforce a max length.

### Numbers

```sql
-- NUMERIC/DECIMAL: exact, arbitrary precision — for money
price NUMERIC(10, 2)  -- 10 digits total, 2 decimal places

-- FLOAT/DOUBLE: approximate — NEVER for money
price FLOAT  -- 0.1 + 0.2 = 0.30000000000000004 ← catastrophic for finance

-- INT: 4 bytes, up to 2.1 billion
-- BIGINT: 8 bytes, up to 9.2 quintillion
-- SMALLINT: 2 bytes, up to 32,767
```

**Rule:** Always use `NUMERIC` for money. Floating point arithmetic has rounding errors.

### Timestamps

```sql
-- TIMESTAMP: stores date+time, no timezone — avoid
created_at TIMESTAMP

-- TIMESTAMPTZ: stores in UTC, displays in session timezone — use this
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- DATE: date only, no time
birth_date DATE

-- Never store timestamps as integers (Unix epoch in application code)
-- Let the DB handle timezone conversion
```

### Booleans

```sql
-- Good
is_active BOOLEAN NOT NULL DEFAULT TRUE

-- Bad — using 0/1 integers or 'Y'/'N' strings for booleans
is_active INT     -- ambiguous
is_active CHAR(1) -- 'Y', 'N', 'y', 'yes'... nightmare to query
```

* * *

Normalization
==============

Normalization organizes a schema to reduce data redundancy and improve integrity.

### First Normal Form (1NF)

Each column contains atomic values — no arrays or repeating groups in a single column.

```sql
-- Bad: comma-separated values in a single column
CREATE TABLE orders (
  id INT,
  product_ids TEXT  -- '101,102,103' — can't index, can't join
);

-- Good: separate table
CREATE TABLE order_items (
  id INT PRIMARY KEY,
  order_id INT REFERENCES orders(id),
  product_id INT REFERENCES products(id),
  qty INT NOT NULL
);
```

### Second Normal Form (2NF)

Every non-key column depends on the **entire** primary key (no partial dependencies). Relevant when the primary key is composite.

```sql
-- Bad: order_date depends only on order_id, not the full composite key
CREATE TABLE order_items (
  order_id INT,
  product_id INT,
  order_date DATE,  -- depends on order_id only, not (order_id, product_id)
  qty INT,
  PRIMARY KEY (order_id, product_id)
);

-- Good: separate order-level data into the orders table
CREATE TABLE orders (
  id INT PRIMARY KEY,
  order_date DATE NOT NULL
);

CREATE TABLE order_items (
  order_id INT REFERENCES orders(id),
  product_id INT REFERENCES products(id),
  qty INT NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
```

### Third Normal Form (3NF)

No transitive dependencies — non-key columns depend only on the primary key, not on other non-key columns.

```sql
-- Bad: city and postal_code both determine each other (transitive)
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR,
  postal_code VARCHAR,
  city VARCHAR  -- city is determined by postal_code, not by user id
);

-- Good: extract to a separate table
CREATE TABLE postal_codes (
  code VARCHAR PRIMARY KEY,
  city VARCHAR NOT NULL
);

CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR,
  postal_code VARCHAR REFERENCES postal_codes(code)
);
```

### Practical rule

**Normalize by default. Denormalize intentionally for performance.**

A 3NF schema is the correct starting point. Only denormalize when you have measured query performance problems and a JOIN is the bottleneck.

* * *

Relationships
==============

### One-to-Many (most common)

```sql
-- One user has many orders
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Always index the FK column
CREATE INDEX idx_orders_user_id ON orders (user_id);
```

`ON DELETE RESTRICT` — prevent deleting a user who has orders.
`ON DELETE CASCADE` — delete orders when user is deleted.
`ON DELETE SET NULL` — set FK to null when parent is deleted.

### Many-to-Many

```sql
-- Products can be in many categories; categories have many products
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- Junction/bridge table
CREATE TABLE product_categories (
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

-- The composite PK creates an index on (product_id, category_id)
-- Also add a reverse index for queries starting from category
CREATE INDEX idx_product_categories_category ON product_categories (category_id);
```

### One-to-One

```sql
-- User settings in a separate table (rarely queried, large JSON blob)
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL
);

CREATE TABLE user_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  avatar_url TEXT,
  preferences JSONB
);
```

Use one-to-one to:
- Separate rarely-accessed large data from the hot table
- Support optional data without nullable columns on the main table

* * *

Soft Deletes
=============

Instead of physically deleting rows, mark them as deleted.

```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- Soft delete
UPDATE users SET deleted_at = NOW() WHERE id = 42;

-- Query active users
SELECT * FROM users WHERE deleted_at IS NULL;

-- Query deleted users
SELECT * FROM users WHERE deleted_at IS NOT NULL;
```

**Index with a partial index to keep active queries fast:**

```sql
CREATE INDEX idx_users_active_email ON users (email) WHERE deleted_at IS NULL;
```

**Pros:** Audit trail, data recovery, referential integrity (FKs don't break).
**Cons:** Every query must filter `deleted_at IS NULL`. Easy to forget. Table grows unboundedly.

**Alternative:** Move deleted rows to an archive table.

```sql
-- Archive instead of soft delete
INSERT INTO users_archive SELECT * FROM users WHERE id = 42;
DELETE FROM users WHERE id = 42;
```

* * *

JSONB — When to Use It
=======================

PostgreSQL's `JSONB` stores semi-structured data with indexing support.

```sql
ALTER TABLE products ADD COLUMN attributes JSONB;

-- Insert
INSERT INTO products (name, attributes)
VALUES ('Laptop', '{"brand": "Apple", "ram": 16, "storage": 512, "color": "silver"}');

-- Query
SELECT * FROM products WHERE attributes->>'brand' = 'Apple';
SELECT * FROM products WHERE (attributes->>'ram')::int > 8;

-- Index on a specific key
CREATE INDEX idx_products_brand ON products ((attributes->>'brand'));

-- GIN index for general JSONB queries
CREATE INDEX idx_products_attributes ON products USING GIN(attributes);

-- Query with GIN index
SELECT * FROM products WHERE attributes @> '{"brand": "Apple", "ram": 16}';
```

**Use JSONB for:**
- Truly variable attributes (e-commerce product specs — laptops vs shoes vs food)
- Configuration / settings that vary per tenant
- Audit logs (flexible event payload)

**Don't use JSONB for:**
- Data you always query by — put it in a proper column
- Data that needs foreign key constraints
- When you know all the fields upfront — just use columns

* * *

Migrations — Best Practices
=============================

Schema changes in production are dangerous. Follow these rules.

### Always use a migration tool

```bash
# Node.js — Knex
knex migrate:make add_status_to_orders
knex migrate:latest

# Node.js — Prisma
prisma migrate dev --name add_status_to_orders
prisma migrate deploy
```

Never run raw DDL in production manually. Migrations must be:
- Version controlled (committed to git)
- Reversible (have an `up` and `down`)
- Run as part of deployment

### Safe migration patterns

**Adding a column:** Always safe.

```sql
-- Safe: new nullable column
ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMPTZ;

-- Safe: new column with default
ALTER TABLE orders ADD COLUMN priority INT NOT NULL DEFAULT 0;
```

**Adding a NOT NULL column without default:** Dangerous — rewrites the whole table.

```sql
-- Bad: locks the table for the entire rewrite
ALTER TABLE orders ADD COLUMN channel VARCHAR NOT NULL;

-- Good: three-step approach
-- Step 1: add nullable (deploy)
ALTER TABLE orders ADD COLUMN channel VARCHAR;

-- Step 2: backfill (run separately, can be slow)
UPDATE orders SET channel = 'web' WHERE channel IS NULL;

-- Step 3: add NOT NULL constraint (deploy after backfill)
ALTER TABLE orders ALTER COLUMN channel SET NOT NULL;
```

**Renaming a column:** Never rename directly — breaks running code.

```sql
-- Step 1: add new column
ALTER TABLE orders ADD COLUMN customer_id BIGINT;

-- Step 2: copy data
UPDATE orders SET customer_id = user_id;

-- Step 3: deploy code that uses customer_id
-- Step 4: drop old column (after old code is gone)
ALTER TABLE orders DROP COLUMN user_id;
```

**Adding an index:** Use `CONCURRENTLY` to avoid locking.

```sql
-- Bad: locks the table
CREATE INDEX idx_orders_status ON orders (status);

-- Good: runs without locking (takes longer but doesn't block reads/writes)
CREATE INDEX CONCURRENTLY idx_orders_status ON orders (status);
```

* * *

Naming Conventions
==================

Consistent naming makes the schema self-documenting.

```sql
-- Tables: snake_case, plural
orders
order_items
user_profiles
product_categories

-- Columns: snake_case
user_id
created_at
deleted_at
is_active

-- Primary keys: always `id`
id BIGSERIAL PRIMARY KEY

-- Foreign keys: {referenced_table_singular}_id
user_id       REFERENCES users(id)
product_id    REFERENCES products(id)
order_id      REFERENCES orders(id)

-- Indexes: idx_{table}_{columns}
idx_orders_user_id
idx_orders_status_created_at
idx_users_lower_email

-- Timestamps: created_at, updated_at, deleted_at (never `timestamp`)
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

* * *

Audit Columns — Every Table Should Have Them

```sql
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,

  -- Business columns
  user_id BIGINT NOT NULL REFERENCES users(id),
  total NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',

  -- Audit columns — on every table
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT REFERENCES users(id),  -- who created it
  deleted_at TIMESTAMPTZ                   -- soft delete
);

-- Auto-update updated_at on every change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

* * *

Interview definition (short answer)
=====================================

> "Good schema design starts with correct data types (NUMERIC for money, TIMESTAMPTZ not TIMESTAMP, TEXT not VARCHAR), normalization to 3NF, proper foreign keys with indexes, and soft deletes where audit trails matter. Schema changes in production must be done in backward-compatible steps — add columns nullable first, backfill, then add constraints. Never drop columns or rename them in the same deploy as the code change."
