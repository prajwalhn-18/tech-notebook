---
sidebar_position: 1
---

## PostgreSQL

PostgreSQL is a powerful, open-source object-relational database system with over 35 years of active development. It's known for its reliability, feature robustness, and performance.

* * *

## Installation & Setup

### Installing PostgreSQL

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download installer from [postgresql.org](https://www.postgresql.org/download/)

### Accessing PostgreSQL

```bash
# Connect as default user
psql -U postgres

# Connect to specific database
psql -U username -d database_name -h localhost -p 5432

# Connect with URI
psql postgresql://username:password@localhost:5432/database_name
```

* * *

## Basic psql Commands

```sql
-- List databases
\l

-- Connect to database
\c database_name

-- List tables
\dt

-- Describe table structure
\d table_name

-- List all schemas
\dn

-- List users
\du

-- Execute SQL from file
\i /path/to/file.sql

-- Toggle expanded display
\x

-- Quit psql
\q
```

* * *

## Database & Schema Management

### Creating Databases

```sql
-- Create database
CREATE DATABASE myapp;

-- Create database with encoding
CREATE DATABASE myapp
  ENCODING 'UTF8'
  LC_COLLATE 'en_US.UTF-8'
  LC_CTYPE 'en_US.UTF-8'
  TEMPLATE template0;

-- Drop database
DROP DATABASE myapp;
```

### Schema Management

```sql
-- Create schema
CREATE SCHEMA app_schema;

-- Set search path
SET search_path TO app_schema, public;

-- Show current schema
SELECT current_schema();

-- Drop schema
DROP SCHEMA app_schema CASCADE;
```

* * *

## Data Types

### Numeric Types

```sql
-- Integer types
SMALLINT        -- 2 bytes (-32,768 to 32,767)
INTEGER or INT  -- 4 bytes (-2 billion to 2 billion)
BIGINT          -- 8 bytes (very large numbers)
SERIAL          -- Auto-incrementing integer
BIGSERIAL       -- Auto-incrementing bigint

-- Decimal types
DECIMAL(p,s) or NUMERIC(p,s)  -- Exact precision
REAL                           -- 4 bytes floating point
DOUBLE PRECISION               -- 8 bytes floating point

-- Example
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  price NUMERIC(10,2),  -- 10 digits, 2 after decimal
  weight REAL
);
```

### Character Types

```sql
CHAR(n)         -- Fixed length, padded with spaces
VARCHAR(n)      -- Variable length with limit
TEXT            -- Unlimited variable length (preferred)

-- Example
CREATE TABLE users (
  username VARCHAR(50),
  bio TEXT,
  country_code CHAR(2)
);
```

### Date/Time Types

```sql
DATE            -- Date only (YYYY-MM-DD)
TIME            -- Time only (HH:MM:SS)
TIMESTAMP       -- Date and time
TIMESTAMPTZ     -- Timestamp with timezone (recommended)
INTERVAL        -- Time interval

-- Example
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  start_time TIMESTAMPTZ NOT NULL,
  duration INTERVAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage
INSERT INTO events (name, start_time, duration)
VALUES ('Meeting', '2026-08-24 14:00:00+00', '2 hours');

-- Date functions
SELECT NOW();                    -- Current timestamp with timezone
SELECT CURRENT_DATE;             -- Current date
SELECT CURRENT_TIME;             -- Current time
SELECT AGE(TIMESTAMP '2000-01-01', TIMESTAMP '1990-01-01');  -- Interval
```

### Boolean Type

```sql
BOOLEAN  -- TRUE, FALSE, or NULL

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title TEXT,
  completed BOOLEAN DEFAULT FALSE
);
```

### JSON Types

```sql
JSON     -- Text-based JSON (slower)
JSONB    -- Binary JSON (faster, supports indexing)

CREATE TABLE api_logs (
  id SERIAL PRIMARY KEY,
  request_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert JSON
INSERT INTO api_logs (request_data)
VALUES ('{"user_id": 123, "action": "login", "ip": "192.168.1.1"}');

-- Query JSON
SELECT request_data->>'user_id' as user_id FROM api_logs;
SELECT * FROM api_logs WHERE request_data->>'action' = 'login';
SELECT * FROM api_logs WHERE request_data @> '{"action": "login"}';
```

### Array Types

```sql
-- Define array column
CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  title TEXT,
  tags TEXT[],
  scores INTEGER[]
);

-- Insert arrays
INSERT INTO articles (title, tags, scores)
VALUES ('PostgreSQL Guide', ARRAY['database', 'sql', 'tutorial'], ARRAY[5,4,5]);

-- Alternative syntax
INSERT INTO articles (title, tags)
VALUES ('Another Post', '{"postgres", "advanced"}');

-- Query arrays
SELECT * FROM articles WHERE 'database' = ANY(tags);
SELECT * FROM articles WHERE tags @> ARRAY['sql'];  -- Contains
SELECT * FROM articles WHERE tags && ARRAY['database', 'nosql'];  -- Overlap
```

### UUID Type

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL
);

INSERT INTO users (email) VALUES ('user@example.com');
```

* * *

## Tables & Constraints

### Creating Tables

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  age INTEGER CHECK (age >= 18),
  balance NUMERIC(10,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Primary Keys

```sql
-- Single column
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  total NUMERIC(10,2)
);

-- Composite primary key
CREATE TABLE order_items (
  order_id INTEGER,
  product_id INTEGER,
  quantity INTEGER,
  PRIMARY KEY (order_id, product_id)
);
```

### Foreign Keys

```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  total NUMERIC(10,2),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Cascade options
ON DELETE CASCADE    -- Delete child rows when parent deleted
ON DELETE SET NULL   -- Set foreign key to NULL
ON DELETE RESTRICT   -- Prevent deletion if children exist
ON UPDATE CASCADE    -- Update foreign key when parent key changes
```

### Constraints

```sql
-- NOT NULL
CREATE TABLE products (
  name TEXT NOT NULL
);

-- UNIQUE
ALTER TABLE users ADD CONSTRAINT unique_email UNIQUE (email);

-- CHECK
CREATE TABLE employees (
  salary NUMERIC CHECK (salary > 0),
  age INTEGER CHECK (age >= 18 AND age <= 100)
);

-- EXCLUSION (PostgreSQL specific)
CREATE TABLE meetings (
  room_id INTEGER,
  time_range TSTZRANGE,
  EXCLUDE USING GIST (room_id WITH =, time_range WITH &&)
);
```

### Modifying Tables

```sql
-- Add column
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Drop column
ALTER TABLE users DROP COLUMN phone;

-- Rename column
ALTER TABLE users RENAME COLUMN username TO user_name;

-- Change column type
ALTER TABLE users ALTER COLUMN age TYPE BIGINT;

-- Set default
ALTER TABLE users ALTER COLUMN is_active SET DEFAULT TRUE;

-- Add constraint
ALTER TABLE users ADD CONSTRAINT check_age CHECK (age >= 0);

-- Drop constraint
ALTER TABLE users DROP CONSTRAINT check_age;

-- Rename table
ALTER TABLE users RENAME TO app_users;
```

* * *

## CRUD Operations

### INSERT

```sql
-- Single row
INSERT INTO users (username, email, age)
VALUES ('john_doe', 'john@example.com', 25);

-- Multiple rows
INSERT INTO users (username, email, age) VALUES
  ('alice', 'alice@example.com', 30),
  ('bob', 'bob@example.com', 28),
  ('charlie', 'charlie@example.com', 35);

-- Insert from SELECT
INSERT INTO users_backup SELECT * FROM users WHERE created_at < '2025-01-01';

-- Insert and return
INSERT INTO users (username, email, age)
VALUES ('david', 'david@example.com', 27)
RETURNING id, created_at;

-- Insert or do nothing on conflict
INSERT INTO users (username, email)
VALUES ('existing_user', 'existing@example.com')
ON CONFLICT (email) DO NOTHING;

-- Insert or update on conflict (UPSERT)
INSERT INTO users (id, username, email, balance)
VALUES (1, 'john', 'john@example.com', 100.00)
ON CONFLICT (id)
DO UPDATE SET
  balance = users.balance + EXCLUDED.balance,
  updated_at = NOW();
```

### SELECT

```sql
-- Basic select
SELECT * FROM users;
SELECT username, email FROM users;

-- WHERE clause
SELECT * FROM users WHERE age > 25;
SELECT * FROM users WHERE age >= 25 AND is_active = TRUE;
SELECT * FROM users WHERE username IN ('alice', 'bob', 'charlie');
SELECT * FROM users WHERE email LIKE '%@example.com';
SELECT * FROM users WHERE created_at BETWEEN '2025-01-01' AND '2026-01-01';

-- NULL handling
SELECT * FROM users WHERE phone IS NULL;
SELECT * FROM users WHERE phone IS NOT NULL;

-- DISTINCT
SELECT DISTINCT country FROM users;

-- ORDER BY
SELECT * FROM users ORDER BY created_at DESC;
SELECT * FROM users ORDER BY age DESC, username ASC;

-- LIMIT and OFFSET (pagination)
SELECT * FROM users ORDER BY id LIMIT 10 OFFSET 20;

-- CASE expressions
SELECT
  username,
  age,
  CASE
    WHEN age < 18 THEN 'Minor'
    WHEN age >= 18 AND age < 65 THEN 'Adult'
    ELSE 'Senior'
  END as age_group
FROM users;
```

### UPDATE

```sql
-- Basic update
UPDATE users SET is_active = FALSE WHERE id = 1;

-- Update multiple columns
UPDATE users
SET
  username = 'new_username',
  updated_at = NOW()
WHERE id = 1;

-- Update with calculation
UPDATE users SET balance = balance + 100 WHERE id = 1;

-- Update from another table
UPDATE orders o
SET total = (SELECT SUM(price * quantity) FROM order_items WHERE order_id = o.id);

-- Update and return
UPDATE users SET balance = balance + 50 WHERE id = 1 RETURNING *;
```

### DELETE

```sql
-- Delete specific rows
DELETE FROM users WHERE id = 1;

-- Delete with condition
DELETE FROM users WHERE created_at < '2020-01-01';

-- Delete all rows
DELETE FROM users;  -- Slower, can be rolled back
TRUNCATE users;     -- Faster, resets sequences

-- Delete and return
DELETE FROM users WHERE id = 1 RETURNING *;
```

* * *

## Joins

### INNER JOIN

```sql
-- Returns only matching rows from both tables
SELECT
  orders.id,
  users.username,
  orders.total
FROM orders
INNER JOIN users ON orders.user_id = users.id;
```

### LEFT JOIN (LEFT OUTER JOIN)

```sql
-- Returns all rows from left table, matching rows from right
SELECT
  users.username,
  COUNT(orders.id) as order_count
FROM users
LEFT JOIN orders ON users.id = orders.user_id
GROUP BY users.id, users.username;
```

### RIGHT JOIN (RIGHT OUTER JOIN)

```sql
-- Returns all rows from right table, matching rows from left
SELECT
  orders.id,
  users.username
FROM orders
RIGHT JOIN users ON orders.user_id = users.id;
```

### FULL OUTER JOIN

```sql
-- Returns all rows from both tables
SELECT
  users.username,
  orders.id as order_id
FROM users
FULL OUTER JOIN orders ON users.id = orders.user_id;
```

### CROSS JOIN

```sql
-- Cartesian product (every row combined with every row)
SELECT
  colors.name as color,
  sizes.name as size
FROM colors
CROSS JOIN sizes;
```

### Self Join

```sql
-- Join table to itself
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  manager_id INTEGER REFERENCES employees(id)
);

SELECT
  e.name as employee,
  m.name as manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;
```

* * *

## Aggregate Functions & Grouping

### Basic Aggregates

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(DISTINCT country) FROM users;
SELECT SUM(total) FROM orders;
SELECT AVG(age) FROM users;
SELECT MIN(created_at), MAX(created_at) FROM users;

-- String aggregation
SELECT string_agg(username, ', ') FROM users;
SELECT array_agg(username) FROM users;
```

### GROUP BY

```sql
-- Count users by country
SELECT country, COUNT(*) as user_count
FROM users
GROUP BY country;

-- Average order total by user
SELECT
  user_id,
  COUNT(*) as order_count,
  AVG(total) as avg_total,
  SUM(total) as total_spent
FROM orders
GROUP BY user_id;

-- Multiple grouping columns
SELECT
  country,
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as signups
FROM users
GROUP BY country, DATE_TRUNC('month', created_at)
ORDER BY country, month;
```

### HAVING

```sql
-- Filter groups (WHERE filters rows, HAVING filters groups)
SELECT
  user_id,
  COUNT(*) as order_count
FROM orders
GROUP BY user_id
HAVING COUNT(*) > 5;

-- Combined with WHERE
SELECT
  country,
  COUNT(*) as user_count
FROM users
WHERE is_active = TRUE
GROUP BY country
HAVING COUNT(*) >= 100;
```

### GROUPING SETS, ROLLUP, CUBE

```sql
-- Multiple grouping combinations
SELECT country, city, COUNT(*)
FROM users
GROUP BY GROUPING SETS (
  (country, city),
  (country),
  ()
);

-- ROLLUP (hierarchical aggregation)
SELECT country, city, COUNT(*)
FROM users
GROUP BY ROLLUP (country, city);

-- CUBE (all combinations)
SELECT country, city, COUNT(*)
FROM users
GROUP BY CUBE (country, city);
```

* * *

## Subqueries

### Scalar Subquery

```sql
-- Returns single value
SELECT
  username,
  (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as order_count
FROM users;
```

### IN / NOT IN Subquery

```sql
-- Find users who have placed orders
SELECT * FROM users
WHERE id IN (SELECT DISTINCT user_id FROM orders);

-- Find users who haven't placed orders
SELECT * FROM users
WHERE id NOT IN (SELECT user_id FROM orders WHERE user_id IS NOT NULL);
```

### EXISTS / NOT EXISTS

```sql
-- More efficient than IN for large datasets
SELECT * FROM users u
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);

-- Users without orders
SELECT * FROM users u
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);
```

### Subquery in FROM (Derived Table)

```sql
SELECT avg_age
FROM (
  SELECT AVG(age) as avg_age
  FROM users
  GROUP BY country
) as country_averages;
```

* * *

## Common Table Expressions (CTEs)

### Basic CTE

```sql
-- Improved readability over subqueries
WITH active_users AS (
  SELECT * FROM users WHERE is_active = TRUE
)
SELECT
  au.username,
  COUNT(o.id) as order_count
FROM active_users au
LEFT JOIN orders o ON au.id = o.user_id
GROUP BY au.id, au.username;
```

### Multiple CTEs

```sql
WITH
  high_value_orders AS (
    SELECT * FROM orders WHERE total > 1000
  ),
  vip_users AS (
    SELECT user_id, COUNT(*) as order_count
    FROM high_value_orders
    GROUP BY user_id
    HAVING COUNT(*) > 5
  )
SELECT
  u.username,
  vu.order_count
FROM vip_users vu
JOIN users u ON vu.user_id = u.id;
```

### Recursive CTE

```sql
-- Organizational hierarchy
WITH RECURSIVE org_tree AS (
  -- Base case: top-level managers
  SELECT id, name, manager_id, 1 as level
  FROM employees
  WHERE manager_id IS NULL

  UNION ALL

  -- Recursive case: employees reporting to previous level
  SELECT e.id, e.name, e.manager_id, ot.level + 1
  FROM employees e
  JOIN org_tree ot ON e.manager_id = ot.id
)
SELECT * FROM org_tree ORDER BY level, name;

-- Generate series
WITH RECURSIVE date_series AS (
  SELECT DATE '2026-01-01' as date
  UNION ALL
  SELECT date + INTERVAL '1 day'
  FROM date_series
  WHERE date < DATE '2026-12-31'
)
SELECT * FROM date_series;
```

* * *

## Views

### Creating Views

```sql
-- Simple view
CREATE VIEW active_users AS
SELECT id, username, email
FROM users
WHERE is_active = TRUE;

-- Use view
SELECT * FROM active_users;

-- View with joins
CREATE VIEW user_order_summary AS
SELECT
  u.id,
  u.username,
  COUNT(o.id) as order_count,
  COALESCE(SUM(o.total), 0) as total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.username;
```

### Materialized Views

```sql
-- Stores query results physically (faster but needs refresh)
CREATE MATERIALIZED VIEW daily_sales AS
SELECT
  DATE(created_at) as sale_date,
  COUNT(*) as order_count,
  SUM(total) as total_sales
FROM orders
GROUP BY DATE(created_at);

-- Query materialized view
SELECT * FROM daily_sales WHERE sale_date = CURRENT_DATE;

-- Refresh materialized view
REFRESH MATERIALIZED VIEW daily_sales;

-- Concurrent refresh (allows reads during refresh)
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales;

-- Drop view
DROP VIEW IF EXISTS active_users;
DROP MATERIALIZED VIEW IF EXISTS daily_sales;
```

* * *

## Window Functions

Window functions perform calculations across rows related to the current row.

### ROW_NUMBER, RANK, DENSE_RANK

```sql
SELECT
  username,
  score,
  ROW_NUMBER() OVER (ORDER BY score DESC) as row_num,
  RANK() OVER (ORDER BY score DESC) as rank,
  DENSE_RANK() OVER (ORDER BY score DESC) as dense_rank
FROM players;

-- Partition by category
SELECT
  category,
  product_name,
  price,
  ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) as rank_in_category
FROM products;
```

### Aggregate Window Functions

```sql
-- Running total
SELECT
  date,
  amount,
  SUM(amount) OVER (ORDER BY date) as running_total
FROM transactions;

-- Moving average
SELECT
  date,
  sales,
  AVG(sales) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as moving_avg_7d
FROM daily_sales;

-- Percentage of total
SELECT
  product_name,
  revenue,
  revenue / SUM(revenue) OVER () * 100 as pct_of_total
FROM product_sales;
```

### LAG and LEAD

```sql
-- Compare with previous/next row
SELECT
  date,
  price,
  LAG(price) OVER (ORDER BY date) as prev_price,
  LEAD(price) OVER (ORDER BY date) as next_price,
  price - LAG(price) OVER (ORDER BY date) as price_change
FROM stock_prices;
```

### FIRST_VALUE, LAST_VALUE, NTH_VALUE

```sql
SELECT
  employee,
  department,
  salary,
  FIRST_VALUE(salary) OVER (PARTITION BY department ORDER BY salary DESC) as highest_in_dept,
  LAST_VALUE(salary) OVER (PARTITION BY department ORDER BY salary DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as lowest_in_dept
FROM employees;
```

* * *

## Indexes (Performance)

See the dedicated [Indexing](./Indexing.md) guide for comprehensive coverage.

### Quick Reference

```sql
-- B-Tree index (default)
CREATE INDEX idx_users_email ON users(email);

-- Unique index
CREATE UNIQUE INDEX idx_users_username ON users(username);

-- Multi-column index
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);

-- Partial index
CREATE INDEX idx_active_users ON users(username) WHERE is_active = TRUE;

-- Expression index
CREATE INDEX idx_users_lower_email ON users(LOWER(email));

-- GIN index for JSONB
CREATE INDEX idx_logs_data ON api_logs USING GIN (request_data);

-- GiST index for full-text search
CREATE INDEX idx_articles_search ON articles USING GiST (to_tsvector('english', content));

-- List indexes
\di

-- Drop index
DROP INDEX idx_users_email;
```

* * *

## Transactions

### Basic Transactions

```sql
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;

-- Rollback on error
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  -- Error occurs
ROLLBACK;
```

### Savepoints

```sql
BEGIN;
  INSERT INTO logs (message) VALUES ('Starting transaction');

  SAVEPOINT before_update;
  UPDATE users SET balance = balance - 100 WHERE id = 1;

  -- Oops, let's undo that
  ROLLBACK TO SAVEPOINT before_update;

  -- Try something else
  UPDATE users SET balance = balance - 50 WHERE id = 1;
COMMIT;
```

### Isolation Levels

```sql
-- Set isolation level
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

BEGIN ISOLATION LEVEL SERIALIZABLE;
  -- Your queries
COMMIT;
```

See [Transactions & ACID](./Transactions%20&%20ACID.md) for detailed coverage.

* * *

## Functions & Stored Procedures

### Creating Functions

```sql
-- Simple function
CREATE FUNCTION add_numbers(a INTEGER, b INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN a + b;
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT add_numbers(5, 3);  -- Returns 8

-- Function returning table
CREATE FUNCTION get_high_value_orders(min_total NUMERIC)
RETURNS TABLE(id INTEGER, user_id INTEGER, total NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.user_id, o.total
  FROM orders o
  WHERE o.total >= min_total
  ORDER BY o.total DESC;
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT * FROM get_high_value_orders(1000);
```

### Functions with Default Parameters

```sql
CREATE FUNCTION greet(name TEXT, greeting TEXT DEFAULT 'Hello')
RETURNS TEXT AS $$
BEGIN
  RETURN greeting || ', ' || name || '!';
END;
$$ LANGUAGE plpgsql;

SELECT greet('Alice');              -- "Hello, Alice!"
SELECT greet('Bob', 'Hi');          -- "Hi, Bob!"
```

### Exception Handling

```sql
CREATE FUNCTION safe_divide(numerator NUMERIC, denominator NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
  RETURN numerator / denominator;
EXCEPTION
  WHEN division_by_zero THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### Drop Function

```sql
DROP FUNCTION IF EXISTS add_numbers(INTEGER, INTEGER);
```

* * *

## Triggers

Triggers automatically execute functions in response to events.

### Creating Triggers

```sql
-- Create function for trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

-- Test
UPDATE users SET username = 'new_name' WHERE id = 1;
-- updated_at is automatically set to NOW()
```

### Audit Logging Trigger

```sql
-- Audit table
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT,
  operation TEXT,
  old_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by TEXT DEFAULT CURRENT_USER
);

-- Audit function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, operation, new_data)
    VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, operation, old_data, new_data)
    VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, operation, old_data)
    VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply to table
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();
```

### Validation Trigger

```sql
CREATE OR REPLACE FUNCTION validate_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format: %', NEW.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_email
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_email();
```

### Managing Triggers

```sql
-- Disable trigger
ALTER TABLE users DISABLE TRIGGER update_users_updated_at;

-- Enable trigger
ALTER TABLE users ENABLE TRIGGER update_users_updated_at;

-- Drop trigger
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
```

* * *

## Full-Text Search

### Basic Full-Text Search

```sql
-- Create table
CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  title TEXT,
  content TEXT,
  search_vector TSVECTOR
);

-- Insert data
INSERT INTO articles (title, content) VALUES
  ('PostgreSQL Tutorial', 'Learn PostgreSQL database management system'),
  ('Advanced SQL', 'Master complex queries and optimization');

-- Create search vector
UPDATE articles
SET search_vector = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''));

-- Search
SELECT title, content
FROM articles
WHERE search_vector @@ to_tsquery('english', 'postgresql & database');

-- Search with ranking
SELECT
  title,
  ts_rank(search_vector, query) as rank
FROM articles, to_tsquery('english', 'postgresql | sql') query
WHERE search_vector @@ query
ORDER BY rank DESC;
```

### Auto-Update Search Vector with Trigger

```sql
CREATE FUNCTION articles_search_trigger() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_search_update
  BEFORE INSERT OR UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION articles_search_trigger();

-- Create GIN index for performance
CREATE INDEX idx_articles_search ON articles USING GIN (search_vector);
```

* * *

## Advanced JSONB Operations

### Querying JSONB

```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  data JSONB
);

INSERT INTO events (data) VALUES
  ('{"user_id": 1, "action": "login", "metadata": {"ip": "192.168.1.1", "device": "mobile"}}'),
  ('{"user_id": 2, "action": "purchase", "amount": 99.99, "items": ["item1", "item2"]}');

-- Extract values
SELECT data->>'user_id' as user_id FROM events;  -- Text
SELECT data->'metadata'->>'ip' as ip FROM events;  -- Nested
SELECT (data->>'user_id')::INTEGER as user_id FROM events;  -- Cast to integer

-- Check existence
SELECT * FROM events WHERE data ? 'amount';  -- Has key
SELECT * FROM events WHERE data->'metadata' ? 'ip';  -- Nested key

-- Containment
SELECT * FROM events WHERE data @> '{"action": "login"}';
SELECT * FROM events WHERE data->'metadata' @> '{"device": "mobile"}';

-- Array operations
SELECT * FROM events WHERE data->'items' ? 'item1';
SELECT jsonb_array_elements_text(data->'items') FROM events;
```

### Updating JSONB

```sql
-- Update field
UPDATE events SET data = jsonb_set(data, '{amount}', '129.99') WHERE id = 1;

-- Add field
UPDATE events SET data = data || '{"processed": true}';

-- Remove field
UPDATE events SET data = data - 'processed';

-- Deep update
UPDATE events
SET data = jsonb_set(data, '{metadata, ip}', '"10.0.0.1"')
WHERE id = 1;
```

### JSONB Indexes

```sql
-- GIN index for general queries
CREATE INDEX idx_events_data ON events USING GIN (data);

-- Index specific path
CREATE INDEX idx_events_user_id ON events ((data->>'user_id'));

-- Expression index
CREATE INDEX idx_events_action ON events ((data->>'action')) WHERE data->>'action' = 'purchase';
```

* * *

## Performance Tips

### EXPLAIN ANALYZE

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT u.username, COUNT(o.id)
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.username;

-- Look for:
-- - Sequential Scans (add indexes)
-- - High cost numbers
-- - Actual time vs estimated rows
```

### Batch Operations

```sql
-- Instead of multiple single inserts
INSERT INTO users (username) VALUES ('user1');
INSERT INTO users (username) VALUES ('user2');

-- Use batch insert
INSERT INTO users (username) VALUES ('user1'), ('user2'), ('user3');
```

### Connection Pooling

Use connection pooling libraries:
- Node.js: `pg` with `pg-pool`
- Python: `psycopg2` with `psycopg2.pool`
- Java: HikariCP

### Vacuum

```sql
-- Manual vacuum
VACUUM users;

-- Vacuum with analyze (update statistics)
VACUUM ANALYZE users;

-- Full vacuum (more aggressive, locks table)
VACUUM FULL users;

-- Enable autovacuum (usually on by default)
-- Check postgresql.conf
```

* * *

## Useful Extensions

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Fuzzy string matching
CREATE EXTENSION IF NOT EXISTS "hstore";        -- Key-value store
CREATE EXTENSION IF NOT EXISTS "postgis";       -- Geographic data
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- Cryptographic functions

-- List installed extensions
\dx

-- pg_trgm example (fuzzy search)
CREATE INDEX idx_users_username_trgm ON users USING GIN (username gin_trgm_ops);
SELECT * FROM users WHERE username % 'jhon';  -- Finds "john"

-- Similarity search
SELECT username, similarity(username, 'jhon') as sim
FROM users
WHERE username % 'jhon'
ORDER BY sim DESC;
```

* * *

## Backup & Restore

### Using pg_dump

```bash
# Backup single database
pg_dump -U postgres -d myapp > backup.sql

# Backup with compression
pg_dump -U postgres -d myapp | gzip > backup.sql.gz

# Backup specific tables
pg_dump -U postgres -d myapp -t users -t orders > tables_backup.sql

# Custom format (faster restore, compressed)
pg_dump -U postgres -d myapp -F c -f backup.dump

# Directory format (parallel dump)
pg_dump -U postgres -d myapp -F d -j 4 -f backup_dir/
```

### Restore

```bash
# Restore from SQL file
psql -U postgres -d myapp < backup.sql

# Restore from compressed
gunzip -c backup.sql.gz | psql -U postgres -d myapp

# Restore custom format
pg_restore -U postgres -d myapp backup.dump

# Restore with parallel jobs
pg_restore -U postgres -d myapp -F d -j 4 backup_dir/
```

### Backup All Databases

```bash
# Backup all databases
pg_dumpall -U postgres > all_databases.sql

# Backup only globals (roles, tablespaces)
pg_dumpall -U postgres --globals-only > globals.sql
```

* * *

## Security Best Practices

### User & Role Management

```sql
-- Create user
CREATE USER app_user WITH PASSWORD 'secure_password';

-- Create role
CREATE ROLE readonly;

-- Grant privileges
GRANT CONNECT ON DATABASE myapp TO app_user;
GRANT USAGE ON SCHEMA public TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;

-- Grant role to user
GRANT readonly TO app_user;

-- Revoke privileges
REVOKE SELECT ON users FROM app_user;

-- Change password
ALTER USER app_user WITH PASSWORD 'new_password';

-- Drop user
DROP USER app_user;
```

### Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY user_documents ON documents
  FOR ALL
  TO app_user
  USING (owner_id = current_user_id());

-- Create function for current user
CREATE FUNCTION current_user_id() RETURNS INTEGER AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::INTEGER;
$$ LANGUAGE SQL STABLE;

-- Set user context in application
SET app.user_id = 123;
```

### Prepared Statements (Prevent SQL Injection)

```javascript
// Node.js with pg library
const { Client } = require('pg');
const client = new Client();

// Bad - SQL injection vulnerable
client.query(`SELECT * FROM users WHERE id = ${req.params.id}`);

// Good - Parameterized query
client.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
```

* * *

## Common Patterns

### Pagination

```sql
-- Offset pagination (simple but slow for large offsets)
SELECT * FROM users
ORDER BY id
LIMIT 20 OFFSET 40;  -- Page 3

-- Cursor pagination (faster, more scalable)
SELECT * FROM users
WHERE id > 1234  -- last_seen_id
ORDER BY id
LIMIT 20;
```

### Soft Delete

```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- Soft delete
UPDATE users SET deleted_at = NOW() WHERE id = 1;

-- Query active only
SELECT * FROM users WHERE deleted_at IS NULL;

-- Create view for active records
CREATE VIEW active_users AS
SELECT * FROM users WHERE deleted_at IS NULL;
```

### Optimistic Locking

```sql
ALTER TABLE products ADD COLUMN version INTEGER DEFAULT 1;

-- Update with version check
UPDATE products
SET stock = stock - 1, version = version + 1
WHERE id = 1 AND version = 5;

-- Check affected rows to detect conflicts
```

### Hierarchical Data (Adjacency List)

```sql
-- Categories tree
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  parent_id INTEGER REFERENCES categories(id)
);

-- Query with recursive CTE
WITH RECURSIVE category_tree AS (
  SELECT id, name, parent_id, 1 as level, ARRAY[id] as path
  FROM categories
  WHERE parent_id IS NULL

  UNION ALL

  SELECT c.id, c.name, c.parent_id, ct.level + 1, ct.path || c.id
  FROM categories c
  JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT * FROM category_tree ORDER BY path;
```

* * *

## Monitoring & Maintenance

### Query Statistics

```sql
-- Enable pg_stat_statements
CREATE EXTENSION pg_stat_statements;

-- View slow queries
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Reset statistics
SELECT pg_stat_statements_reset();
```

### Database Size

```sql
-- Database size
SELECT pg_size_pretty(pg_database_size('myapp'));

-- Table sizes
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;

-- Index sizes
SELECT
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Active Connections

```sql
-- Current connections
SELECT
  datname,
  count(*) as connections
FROM pg_stat_activity
GROUP BY datname;

-- Active queries
SELECT
  pid,
  usename,
  state,
  query,
  query_start
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

-- Kill connection
SELECT pg_terminate_backend(pid);
```

* * *

## Further Reading

- [Query Optimization](./Query%20Optimization.md)
- [Indexing](./Indexing.md)
- [Transactions & ACID](./Transactions%20&%20ACID.md)
- [Replication & Scaling](./Replication%20&%20Scaling.md)
- [Schema Design](./Schema%20Design.md)

PostgreSQL Documentation: https://www.postgresql.org/docs/
