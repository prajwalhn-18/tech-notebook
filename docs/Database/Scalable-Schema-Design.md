---
sidebar_position: 9
---

## Scalable Schema Design - From Startup to Scale

Designing a database schema is about making the right tradeoffs at each stage of growth. What works for 100 users fails at 100,000. What's over-engineered for an MVP becomes essential at scale.

This guide walks through schema design evolution from a small product to a large-scale system, with real examples and migration strategies.

**Why This Matters:**
- Wrong early decisions can cost millions in re-architecture later
- Right early decisions can support 10,000x growth without major rewrites
- Understanding scaling patterns helps you make informed tradeoffs
- Most performance issues stem from schema design, not code

* * *

## The Three Stages of Schema Evolution

```
Stage 1: MVP (0-10K users)
├─ Goal: Ship fast, validate product
├─ Complexity: Low
├─ Data volume: <1 GB
└─ Focus: Simplicity, flexibility

Stage 2: Growth (10K-1M users)
├─ Goal: Scale without breaking
├─ Complexity: Medium
├─ Data volume: 1-100 GB
└─ Focus: Performance, reliability

Stage 3: Scale (1M+ users)
├─ Goal: Handle massive load
├─ Complexity: High
├─ Data volume: 100 GB - 100 TB
└─ Focus: Distribution, optimization
```

* * *

## Stage 1: MVP Schema Design (0-10K Users)

### Design Principles for MVP

**DO:**
- ✅ Keep schema simple and normalized (3NF)
- ✅ Use foreign keys for referential integrity
- ✅ Add basic indexes on foreign keys and common queries
- ✅ Use standard data types (avoid premature optimization)
- ✅ Design for feature completeness, not performance

**DON'T:**
- ❌ Denormalize data "for performance" (you don't have scale yet)
- ❌ Shard/partition prematurely (adds complexity for zero benefit)
- ❌ Over-index (every index slows down writes)
- ❌ Use NoSQL "because it scales" (SQL scales plenty for MVP)

### Example: E-commerce MVP Schema

```sql
-- Users table
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  category VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  total NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items (many-to-many relationship)
CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL, -- Price at time of order
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic indexes (only what you need now)
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

**Why this works at MVP stage:**

```
Data volume estimate:
├─ 10,000 users
├─ 5,000 products
├─ 20,000 orders (2 orders per user)
├─ 40,000 order items (2 items per order)
└─ Total: ~75K rows, ~10 MB

Performance:
├─ All queries: < 10ms
├─ Join queries: < 50ms
├─ No need for optimization
└─ Single database server handles easily
```

### MVP Schema Checklist

```sql
-- ✅ Essential columns on every table
created_at TIMESTAMPTZ DEFAULT NOW()  -- When was this created?
updated_at TIMESTAMPTZ DEFAULT NOW()  -- When was this last modified?

-- ✅ Soft delete support (add when needed)
deleted_at TIMESTAMPTZ  -- NULL = active, timestamp = soft deleted

-- ✅ Foreign keys for data integrity
user_id BIGINT REFERENCES users(id) ON DELETE CASCADE

-- ✅ Indexes on foreign keys
CREATE INDEX idx_table_foreign_key ON table(foreign_key_column);

-- ✅ Unique constraints where needed
email VARCHAR(255) UNIQUE NOT NULL
```

### When to Add Features

**Add immediately (MVP):**
- Foreign key constraints
- NOT NULL constraints
- Unique constraints
- Basic indexes on foreign keys
- created_at, updated_at timestamps

**Add when you see the need (Growth stage):**
- Soft deletes (deleted_at)
- Audit trails (who changed what)
- Full-text search indexes
- Composite indexes for specific queries
- JSONB columns for flexible data

**Add when you hit scale (Scale stage):**
- Partitioning
- Read replicas
- Sharding
- Denormalization for performance

* * *

## Stage 2: Growth Schema Optimizations (10K-1M Users)

At this stage, you start seeing real traffic patterns. Time to optimize based on actual data.

### Problem 1: Slow Product Listings

**Initial naive query:**

```sql
-- This query becomes slow with 100K products
SELECT * FROM products
WHERE category = 'Electronics'
ORDER BY created_at DESC
LIMIT 20;

-- EXPLAIN shows Seq Scan
Seq Scan on products  (cost=0.00..5432.00 rows=5000)
  Filter: (category = 'Electronics')
```

**Solution: Add composite index**

```sql
-- Category is used in WHERE, created_at in ORDER BY
CREATE INDEX idx_products_category_created
  ON products(category, created_at DESC);

-- Now uses Index Scan
Index Scan using idx_products_category_created  (cost=0.42..125.34 rows=5000)
  Index Cond: (category = 'Electronics')

-- Performance: 500ms → 15ms
```

**Why this works:**

```
Before index:
1. Scan all 100K products
2. Filter to 5K Electronics products
3. Sort 5K products by created_at
4. Return top 20
Total: 500ms

After index:
1. Index lookup on (category='Electronics')
2. Already sorted by created_at (in index)
3. Return first 20 from index
Total: 15ms
```

### Problem 2: User Order History is Slow

**Growing data volume:**

```
Original: 20,000 orders total
Now: 500,000 orders total
User with most orders: 500 orders

Query time: 5ms → 200ms (40x slower!)
```

**Issue identification:**

```sql
EXPLAIN ANALYZE
SELECT o.*, COUNT(oi.id) as item_count
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.user_id = 12345
GROUP BY o.id
ORDER BY o.created_at DESC
LIMIT 20;

-- Output shows:
GroupAggregate  (cost=850.34..1250.67 rows=500)
  → Nested Loop Left Join
      → Index Scan on orders using idx_orders_user_id  (rows=500)
      → Index Scan on order_items using idx_order_items_order_id  (rows=2)
```

**The problem:** Joining 500 orders with 1000 order_items

**Solution 1: Denormalize item count**

```sql
-- Add column to orders table
ALTER TABLE orders ADD COLUMN item_count INTEGER DEFAULT 0;

-- Update existing data
UPDATE orders o
SET item_count = (
  SELECT COUNT(*) FROM order_items WHERE order_id = o.id
);

-- Create trigger to maintain count
CREATE FUNCTION update_order_item_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE orders SET item_count = item_count + 1 WHERE id = NEW.order_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE orders SET item_count = item_count - 1 WHERE id = OLD.order_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_items_count
  AFTER INSERT OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_order_item_count();

-- Now simple query without JOIN
SELECT id, total, item_count, created_at
FROM orders
WHERE user_id = 12345
ORDER BY created_at DESC
LIMIT 20;

-- Performance: 200ms → 5ms
```

**Tradeoff:**
- ✅ Faster reads (200ms → 5ms)
- ❌ Slightly slower writes (trigger overhead)
- ✅ Worth it! Reads far exceed writes in this case

### Problem 3: Product Search is Slow

Users want to search products by name/description.

**Naive approach (doesn't work):**

```sql
-- LIKE query with wildcards
SELECT * FROM products
WHERE name LIKE '%laptop%' OR description LIKE '%laptop%';

-- Cannot use index (wildcard at start)
-- Scans all 100K products: 800ms
```

**Solution: Full-text search**

```sql
-- Add tsvector column for search
ALTER TABLE products ADD COLUMN search_vector tsvector;

-- Populate search vector
UPDATE products
SET search_vector =
  to_tsvector('english',
    coalesce(name, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(category, '')
  );

-- Create GIN index for fast search
CREATE INDEX idx_products_search ON products USING GIN(search_vector);

-- Create trigger to auto-update on changes
CREATE FUNCTION products_search_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.category, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_search_update
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION products_search_trigger();

-- Search query
SELECT id, name, price,
  ts_rank(search_vector, query) AS rank
FROM products,
  to_tsquery('english', 'laptop') AS query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 20;

-- Performance: 800ms → 20ms
```

### Problem 4: Order Status Updates Create Bottleneck

**Issue:** Every order status change queries multiple tables

```sql
-- Current: One UPDATE triggers multiple lookups
UPDATE orders SET status = 'shipped' WHERE id = 12345;

-- Application then needs to:
-- 1. Get order details
-- 2. Get user details
-- 3. Get order items
-- 4. Send notification
-- Total: 4 queries per status update
```

**Solution: Event sourcing pattern**

```sql
-- Create order events table
CREATE TABLE order_events (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id),
  event_type VARCHAR(50) NOT NULL, -- 'created', 'paid', 'shipped', etc.
  event_data JSONB NOT NULL,        -- Snapshot of relevant data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100)           -- Who triggered this event
);

CREATE INDEX idx_order_events_order_id ON order_events(order_id, created_at DESC);
CREATE INDEX idx_order_events_type ON order_events(event_type, created_at DESC);

-- When order ships, insert event with all relevant data
INSERT INTO order_events (order_id, event_type, event_data, created_by)
VALUES (
  12345,
  'shipped',
  jsonb_build_object(
    'user_id', 5678,
    'user_email', 'user@example.com',
    'order_total', 150.00,
    'items', (SELECT jsonb_agg(
      jsonb_build_object('product_name', p.name, 'quantity', oi.quantity)
    ) FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = 12345),
    'shipping_address', '123 Main St'
  ),
  'system'
);

-- Background worker processes events asynchronously
-- No need to join multiple tables on write
```

**Benefits:**
- ✅ Complete audit trail of all state changes
- ✅ Can replay events to rebuild state
- ✅ Async processing moves work off critical path
- ✅ Easy to add new event handlers without changing core logic

### Growth Stage: Schema Metrics to Track

```sql
-- 1. Table sizes (identify bloat)
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- 2. Index usage (drop unused indexes)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%pkey%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 3. Slow queries (from pg_stat_statements)
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 4. Most written tables (where to optimize)
SELECT
  schemaname,
  tablename,
  n_tup_ins + n_tup_upd + n_tup_del AS total_writes,
  n_tup_ins AS inserts,
  n_tup_upd AS updates,
  n_tup_del AS deletes
FROM pg_stat_user_tables
ORDER BY total_writes DESC;
```

* * *

## Stage 3: Large Scale Schema Design (1M+ Users)

At massive scale, single-server limitations force architectural changes.

### Scale Indicators

You're hitting scale when:
- ✅ Database server at 80%+ CPU constantly
- ✅ Single table exceeds 100M rows
- ✅ Database size exceeds 500 GB
- ✅ Write throughput exceeds 10K writes/second
- ✅ Queries slow despite perfect indexes
- ✅ Backups take hours
- ✅ Replication lag consistently > 1 second

### Pattern 1: Time-Series Data (Partitioning)

**Problem:** Events table with billions of rows

```sql
-- Original schema
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- After 2 years:
-- 5 billion rows
-- 2 TB size
-- Queries slow even with indexes
-- Vacuum takes 8 hours
```

**Solution: Partition by time**

```sql
-- Recreate as partitioned table
CREATE TABLE events (
  id BIGSERIAL,
  user_id BIGINT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE events_2024_01 PARTITION OF events
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE events_2024_02 PARTITION OF events
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- ... create all needed partitions

-- Indexes per partition (much smaller!)
CREATE INDEX ON events_2024_01(user_id);
CREATE INDEX ON events_2024_01(event_type);

-- Automated partition creation
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
  start_date TEXT;
  end_date TEXT;
BEGIN
  -- Create partition for next month
  partition_date := date_trunc('month', NOW() + INTERVAL '1 month');
  partition_name := 'events_' || to_char(partition_date, 'YYYY_MM');
  start_date := partition_date::TEXT;
  end_date := (partition_date + INTERVAL '1 month')::TEXT;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );

  EXECUTE format('CREATE INDEX ON %I(user_id)', partition_name);
  EXECUTE format('CREATE INDEX ON %I(event_type)', partition_name);
END;
$$ LANGUAGE plpgsql;

-- Schedule to run daily
SELECT create_monthly_partition();
```

**Benefits:**

```
Query performance:
Before: SELECT * FROM events WHERE created_at > '2024-06-01'
        Scans 5 billion rows, 45 seconds

After:  Scans only events_2024_06 (200M rows), 2 seconds
        22x faster!

Archival:
Before: DELETE FROM events WHERE created_at < '2022-01-01'
        Takes 8 hours, locks table, bloats WAL

After:  DROP TABLE events_2021_12;
        Instant, no locks, no WAL

Maintenance:
Before: VACUUM events (entire 2 TB table)
        Takes 8 hours

After:  VACUUM events_2024_06 (only current partition)
        Takes 20 minutes
```

### Pattern 2: User-Scoped Data (Sharding)

**Problem:** 10M users, each user's data isolated, single database can't handle write load

**Multi-tenant SaaS example:**

```sql
-- Original: All tenants in one database
CREATE TABLE tenants (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tenant_users (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id),
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tenant_documents (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id),
  title VARCHAR(255) NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Problem at scale:
-- 100,000 tenants
-- 10,000,000 users
-- 500,000,000 documents
-- Single database overwhelmed
```

**Solution: Shard by tenant_id**

```
Shard Architecture:
┌──────────────┐
│ Shard Router │ (application layer)
└──────┬───────┘
       │
   ┌───┴────────┬────────┬────────┐
   ▼            ▼        ▼        ▼
┌──────┐   ┌──────┐ ┌──────┐ ┌──────┐
│Shard0│   │Shard1│ │Shard2│ │Shard3│
│      │   │      │ │      │ │      │
│Tenant│   │Tenant│ │Tenant│ │Tenant│
│ 0-25K│   │25-50K│ │50-75K│ │75-100K│
└──────┘   └──────┘ └──────┘ └──────┘

Each shard: Same schema, different tenant data
```

**Implementation:**

```javascript
// Tenant routing table (single database)
CREATE TABLE tenant_shards (
  tenant_id BIGINT PRIMARY KEY,
  shard_id INTEGER NOT NULL
);

// Application: Shard router
class ShardRouter {
  constructor() {
    this.shards = [
      new Pool({ host: 'shard0.db.internal', database: 'app' }),
      new Pool({ host: 'shard1.db.internal', database: 'app' }),
      new Pool({ host: 'shard2.db.internal', database: 'app' }),
      new Pool({ host: 'shard3.db.internal', database: 'app' }),
    ];

    this.routingDB = new Pool({ host: 'routing.db.internal', database: 'routing' });
    this.routingCache = new Map(); // In-memory cache
  }

  async getShardForTenant(tenantId) {
    // Check cache first
    if (this.routingCache.has(tenantId)) {
      return this.shards[this.routingCache.get(tenantId)];
    }

    // Query routing table
    const result = await this.routingDB.query(
      'SELECT shard_id FROM tenant_shards WHERE tenant_id = $1',
      [tenantId]
    );

    const shardId = result.rows[0].shard_id;
    this.routingCache.set(tenantId, shardId); // Cache for 1 hour

    return this.shards[shardId];
  }

  async queryTenant(tenantId, sql, params) {
    const shard = await this.getShardForTenant(tenantId);
    return shard.query(sql, params);
  }
}

// Usage
const router = new ShardRouter();

app.get('/api/documents', async (req, res) => {
  const tenantId = req.user.tenantId;

  const documents = await router.queryTenant(
    tenantId,
    'SELECT * FROM tenant_documents WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 20',
    [tenantId]
  );

  res.json(documents.rows);
});
```

**Shard assignment strategy:**

```javascript
// Option 1: Round-robin (even distribution)
function assignShard(tenantId, numShards) {
  return tenantId % numShards;
}

// Option 2: Hash-based (consistent distribution)
function assignShard(tenantId, numShards) {
  const hash = require('crypto')
    .createHash('md5')
    .update(tenantId.toString())
    .digest('hex');
  return parseInt(hash, 16) % numShards;
}

// Option 3: Manual (control tenant placement)
// Store in tenant_shards table, assign based on:
// - Tenant size (large tenants get dedicated shard)
// - Geographic location (GDPR compliance)
// - Plan tier (premium tenants on faster hardware)
```

### Pattern 3: Hot vs Cold Data (Data Tiering)

**Problem:** Recent data accessed frequently, old data rarely accessed but must be kept

```
Access pattern analysis:
├─ Last 7 days: 80% of all queries
├─ Last 30 days: 15% of all queries
├─ Last 90 days: 4% of all queries
└─ Older than 90 days: 1% of all queries

But all data in same table, slowing down hot queries!
```

**Solution: Separate hot and cold data**

```sql
-- Hot data (frequently accessed)
CREATE TABLE orders_hot (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status VARCHAR(50) NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Constraint: only recent data
  CHECK (created_at > NOW() - INTERVAL '90 days')
);

-- Indexes optimized for hot queries
CREATE INDEX idx_orders_hot_user_status ON orders_hot(user_id, status);
CREATE INDEX idx_orders_hot_created ON orders_hot(created_at DESC);

-- Cold data (archive)
CREATE TABLE orders_cold (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status VARCHAR(50) NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- Minimal indexes (rarely queried)
CREATE INDEX idx_orders_cold_user ON orders_cold(user_id);

-- View that combines both (for queries that need all data)
CREATE VIEW orders AS
  SELECT * FROM orders_hot
  UNION ALL
  SELECT id, user_id, status, total, created_at, updated_at
  FROM orders_cold;

-- Automated archival (run daily)
CREATE FUNCTION archive_old_orders()
RETURNS void AS $$
BEGIN
  -- Move orders older than 90 days to cold storage
  INSERT INTO orders_cold (id, user_id, status, total, created_at, updated_at)
  SELECT id, user_id, status, total, created_at, updated_at
  FROM orders_hot
  WHERE created_at < NOW() - INTERVAL '90 days';

  DELETE FROM orders_hot WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
```

**Benefits:**

```
Hot table performance:
Before: 50M rows, queries scan 50M rows
After:  5M rows (only 90 days), queries scan 5M rows
        10x faster!

Storage optimization:
Cold storage can use:
├─ Cheaper disk (slow but large)
├─ Higher compression
├─ Less frequent backups
└─ Different database instance (read replica for analytics)
```

### Pattern 4: Denormalization for Read Performance

**When to denormalize:** Read-heavy workload, same JOIN repeated constantly

**Example: User feed generation**

```sql
-- Original normalized schema
CREATE TABLE posts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE follows (
  follower_id BIGINT NOT NULL REFERENCES users(id),
  following_id BIGINT NOT NULL REFERENCES users(id),
  PRIMARY KEY (follower_id, following_id)
);

-- Feed query (slow with 1M users)
SELECT
  p.id,
  p.content,
  p.created_at,
  u.username,
  u.avatar_url
FROM posts p
JOIN users u ON u.id = p.user_id
WHERE p.user_id IN (
  SELECT following_id FROM follows WHERE follower_id = 12345
)
ORDER BY p.created_at DESC
LIMIT 50;

-- At scale:
-- User follows 500 people
-- Each followed user has 100 posts
-- Join of 50,000 posts: 800ms
```

**Solution: Denormalize user data into posts**

```sql
-- Add denormalized columns
ALTER TABLE posts ADD COLUMN username VARCHAR(100);
ALTER TABLE posts ADD COLUMN avatar_url TEXT;

-- Populate existing data
UPDATE posts p
SET
  username = u.username,
  avatar_url = u.avatar_url
FROM users u
WHERE u.id = p.user_id;

-- Trigger to keep denormalized data in sync
CREATE FUNCTION sync_post_user_data()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT username, avatar_url INTO NEW.username, NEW.avatar_url
    FROM users WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_user_data_sync
  BEFORE INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION sync_post_user_data();

-- Also trigger on user updates
CREATE FUNCTION update_posts_on_user_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts
  SET
    username = NEW.username,
    avatar_url = NEW.avatar_url
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_update_posts
  AFTER UPDATE OF username, avatar_url ON users
  FOR EACH ROW EXECUTE FUNCTION update_posts_on_user_change();

-- Now feed query (no JOIN!)
SELECT
  id,
  content,
  username,
  avatar_url,
  created_at
FROM posts
WHERE user_id IN (
  SELECT following_id FROM follows WHERE follower_id = 12345
)
ORDER BY created_at DESC
LIMIT 50;

-- Performance: 800ms → 50ms (16x faster!)
```

**Tradeoffs:**
- ✅ Massive read performance improvement
- ❌ More storage (duplicated username/avatar)
- ❌ Write complexity (triggers to maintain consistency)
- ❌ Risk of data inconsistency if triggers fail

**When it's worth it:**
- Read:Write ratio > 100:1
- Same JOIN appears in many queries
- Joined data changes infrequently
- Performance gain justifies complexity

* * *

## Real-World Schema Evolution: Social Media Platform

Let's walk through how a social media platform's schema evolves from MVP to scale.

### Phase 1: MVP (Month 0-6, 0-10K users)

```sql
-- Simple, normalized schema
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE posts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE likes (
  user_id BIGINT NOT NULL REFERENCES users(id),
  post_id BIGINT NOT NULL REFERENCES posts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
```

**Why this works:**
- 10K users, 50K posts, 200K likes, 100K comments
- Total: ~360K rows, ~50 MB
- All queries < 10ms
- Single Postgres instance: $50/month

### Phase 2: Product-Market Fit (Month 6-12, 10K-100K users)

**New problem:** Feed generation is slow

```sql
-- Original feed query (becoming slow)
SELECT p.*, u.username, COUNT(l.user_id) as like_count
FROM posts p
JOIN users u ON u.id = p.user_id
LEFT JOIN likes l ON l.post_id = p.id
WHERE p.user_id IN (SELECT following_id FROM follows WHERE follower_id = 12345)
GROUP BY p.id, u.username
ORDER BY p.created_at DESC
LIMIT 20;

-- At 100K users: 1.2 seconds
```

**Solution 1: Add like_count to posts**

```sql
ALTER TABLE posts ADD COLUMN like_count INTEGER DEFAULT 0;

-- Backfill
UPDATE posts p
SET like_count = (SELECT COUNT(*) FROM likes WHERE post_id = p.id);

-- Trigger to maintain count
CREATE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER likes_update_count
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_post_like_count();
```

**Solution 2: Cache feeds in Redis**

```javascript
// Generate feed and cache for 5 minutes
async function getUserFeed(userId) {
  const cacheKey = `feed:${userId}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  // Generate feed from database
  const feed = await db.query(`
    SELECT p.id, p.content, p.like_count, p.created_at, u.username
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id IN (
      SELECT following_id FROM follows WHERE follower_id = $1
    )
    ORDER BY p.created_at DESC
    LIMIT 50
  `, [userId]);

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(feed.rows));

  return feed.rows;
}
```

**Results:**
- Feed generation: 1.2s → 80ms (database)
- Feed with cache: 80ms → 2ms (cache hit)
- Cache hit rate: 85%
- Database load: Reduced by 85%

### Phase 3: Viral Growth (Month 12-18, 100K-1M users)

**New problems:**
1. Influencers have millions of followers (celebrity problem)
2. Trending posts get thousands of likes/second (hotspot)
3. Database CPU constantly at 90%

**Solution 1: Fan-out write pattern for feeds**

Instead of querying on read (fan-out read), pre-compute feeds on write (fan-out write).

```sql
-- Feed cache table (pre-computed feeds)
CREATE TABLE feed_items (
  user_id BIGINT NOT NULL,
  post_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

-- Partition by user_id range for better performance
CREATE TABLE feed_items (
  user_id BIGINT NOT NULL,
  post_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
) PARTITION BY HASH (user_id);

-- Create 16 partitions
CREATE TABLE feed_items_p0 PARTITION OF feed_items
  FOR VALUES WITH (MODULUS 16, REMAINDER 0);
-- ... create partitions 1-15

CREATE INDEX ON feed_items_p0(user_id, created_at DESC);
```

**Background job: Fan out posts to followers**

```javascript
// When user creates post, fan out to all followers
async function publishPost(userId, content) {
  // 1. Create post
  const post = await db.query(
    'INSERT INTO posts (user_id, content) VALUES ($1, $2) RETURNING *',
    [userId, content]
  );

  // 2. Queue fan-out job (async)
  await queue.add('fanout-post', {
    postId: post.rows[0].id,
    authorId: userId
  });

  return post.rows[0];
}

// Background worker
async function fanoutPost({ postId, authorId }) {
  // Get all followers (could be millions for celebrity)
  const followers = await db.query(
    'SELECT follower_id FROM follows WHERE following_id = $1',
    [authorId]
  );

  // Batch insert into feed_items
  const values = followers.rows.map(f =>
    `(${f.follower_id}, ${postId}, NOW())`
  ).join(',');

  await db.query(`
    INSERT INTO feed_items (user_id, post_id, created_at)
    VALUES ${values}
  `);
}

// Read feed (now super fast!)
async function getUserFeed(userId, limit = 20) {
  return db.query(`
    SELECT p.id, p.content, p.like_count, u.username, fi.created_at
    FROM feed_items fi
    JOIN posts p ON p.id = fi.post_id
    JOIN users u ON u.id = p.user_id
    WHERE fi.user_id = $1
    ORDER BY fi.created_at DESC
    LIMIT $2
  `, [userId, limit]);
}
```

**Results:**
- Feed read: 80ms → 5ms
- Celebrity post (1M followers): Fans out in background over 30 seconds
- User experience: Instant post creation, feed updates within seconds

**Tradeoff:**
- ✅ Blazing fast reads
- ✅ Scales to millions of followers
- ❌ Huge storage (duplicate post IDs in every follower's feed)
- ❌ Complex write path (background jobs)

**Storage calculation:**

```
Original (fan-out read):
├─ 1M users
├─ Each follows 200 people
└─ Storage: follows table only (1M × 200 = 200M rows)

Fan-out write:
├─ 1M users
├─ Average user sees 200 × 10 posts/day = 2000 posts/day
├─ Keep last 30 days in feed
└─ Storage: 1M users × 60K posts = 60B feed_items rows

But: Feed reads are 16x faster, worth the storage cost
```

**Solution 2: Hybrid approach for celebrities**

```javascript
// Don't fan out for users with > 100K followers
async function publishPost(userId, content) {
  const post = await db.query(
    'INSERT INTO posts (user_id, content) VALUES ($1, $2) RETURNING *',
    [userId, content]
  );

  // Check follower count
  const followerCount = await db.query(
    'SELECT COUNT(*) FROM follows WHERE following_id = $1',
    [userId]
  );

  if (followerCount.rows[0].count < 100000) {
    // Regular user: fan out to followers
    await queue.add('fanout-post', { postId: post.rows[0].id, authorId: userId });
  } else {
    // Celebrity: mark as celebrity post, merge at read time
    await db.query(
      'UPDATE posts SET is_celebrity_post = true WHERE id = $1',
      [post.rows[0].id]
    );
  }

  return post.rows[0];
}

// Feed: merge pre-computed + celebrity posts
async function getUserFeed(userId, limit = 20) {
  // Get pre-computed feed
  const feedItems = await db.query(`
    SELECT p.id, p.content, p.like_count, u.username, fi.created_at
    FROM feed_items fi
    JOIN posts p ON p.id = fi.post_id
    JOIN users u ON u.id = p.user_id
    WHERE fi.user_id = $1
    ORDER BY fi.created_at DESC
    LIMIT $2
  `, [userId, limit]);

  // Get celebrity posts from followed celebrities
  const celebrityPosts = await db.query(`
    SELECT p.id, p.content, p.like_count, u.username, p.created_at
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.is_celebrity_post = true
      AND p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
      AND p.created_at > NOW() - INTERVAL '7 days'
  `, [userId]);

  // Merge and sort by created_at
  const merged = [...feedItems.rows, ...celebrityPosts.rows]
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);

  return merged;
}
```

### Phase 4: Massive Scale (Month 18+, 1M+ users)

**New problems:**
1. Database size: 5 TB
2. Backups take 6 hours
3. Single database can't handle write load
4. Need to support multiple regions

**Solution: Multi-region, sharded architecture**

```
Architecture:
┌────────────────────────────────────┐
│          Global Layer              │
├────────────────────────────────────┤
│ - User account data (not sharded)  │
│ - Authentication                   │
│ - Routing table                    │
└────────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│Region  │  │Region  │  │Region  │
│US-East │  │EU-West │  │Asia    │
└───┬────┘  └───┬────┘  └───┬────┘
    │           │           │
┌───┴──────┐ ┌──┴─────┐ ┌──┴─────┐
│ Shards:  │ │Shards: │ │Shards: │
│ - Posts  │ │- Posts │ │- Posts │
│ - Feeds  │ │- Feeds │ │- Feeds │
│ - Likes  │ │- Likes │ │- Likes │
└──────────┘ └────────┘ └────────┘
```

**User → Region assignment:**

```sql
-- Global database
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  home_region VARCHAR(20) NOT NULL, -- 'us-east', 'eu-west', 'asia'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Application routes traffic based on home_region
```

**Within each region: Shard by user_id**

```javascript
class RegionalShardRouter {
  constructor(region) {
    this.region = region;
    this.shards = this.loadRegionalShards(region);
  }

  getShardForUser(userId) {
    // Hash-based sharding within region
    const shardIndex = this.hash(userId) % this.shards.length;
    return this.shards[shardIndex];
  }

  async createPost(userId, content) {
    const shard = this.getShardForUser(userId);
    return shard.query(
      'INSERT INTO posts (user_id, content) VALUES ($1, $2) RETURNING *',
      [userId, content]
    );
  }

  async getUserPosts(userId, limit = 20) {
    const shard = this.getShardForUser(userId);
    return shard.query(
      'SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
  }
}

// Cross-region queries (rare, slow)
async function getCrossRegionData(userId) {
  const user = await globalDB.query(
    'SELECT home_region FROM users WHERE id = $1',
    [userId]
  );

  const regionRouter = getRouterForRegion(user.rows[0].home_region);
  return regionRouter.getUserPosts(userId);
}
```

**Results:**
- Write throughput: 50K writes/sec
- Read throughput: 500K reads/sec
- Query latency: <10ms (within region)
- Cross-region queries: 100-300ms (rare)
- Database size per shard: 200 GB (manageable)
- Backups per shard: 20 minutes

* * *

## Migration Strategies

### Strategy 1: Add Column (Zero Downtime)

```sql
-- Step 1: Add nullable column (instant, no lock)
ALTER TABLE orders ADD COLUMN priority INTEGER;

-- Step 2: Add default for new rows (instant)
ALTER TABLE orders ALTER COLUMN priority SET DEFAULT 1;

-- Step 3: Backfill in batches (prevents long locks)
DO $$
DECLARE
  batch_size INTEGER := 10000;
  updated INTEGER;
BEGIN
  LOOP
    UPDATE orders
    SET priority = 1
    WHERE priority IS NULL
    AND id IN (
      SELECT id FROM orders
      WHERE priority IS NULL
      LIMIT batch_size
    );

    GET DIAGNOSTICS updated = ROW_COUNT;
    EXIT WHEN updated = 0;

    -- Sleep between batches to avoid overwhelming DB
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;

-- Step 4: Add NOT NULL constraint (after backfill complete)
ALTER TABLE orders ALTER COLUMN priority SET NOT NULL;
```

### Strategy 2: Rename Column (Backwards Compatible)

```sql
-- DON'T do this (breaks running code):
ALTER TABLE users RENAME COLUMN name TO full_name;

-- DO this instead:

-- Step 1: Add new column
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);

-- Step 2: Copy data
UPDATE users SET full_name = name WHERE full_name IS NULL;

-- Step 3: Deploy code that writes to BOTH columns
-- Application code:
UPDATE users SET name = $1, full_name = $1 WHERE id = $2

-- Step 4: After all code deployed, drop old column
ALTER TABLE users DROP COLUMN name;
```

### Strategy 3: Split Table (Complex)

```sql
-- Original: users table has profile data mixed with auth data
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goal: Split into users (auth) and profiles (profile data)

-- Step 1: Create new profiles table
CREATE TABLE profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id),
  bio TEXT,
  avatar_url TEXT,
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Copy data to new table
INSERT INTO profiles (user_id, bio, avatar_url, preferences, created_at)
SELECT id, bio, avatar_url, preferences, created_at
FROM users;

-- Step 3: Deploy code that reads from BOTH tables
-- Old code can still read from users table
-- New code reads from users + profiles

-- Step 4: Trigger to keep in sync during transition
CREATE FUNCTION sync_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO profiles (user_id, bio, avatar_url, preferences)
    VALUES (NEW.id, NEW.bio, NEW.avatar_url, NEW.preferences);
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE profiles
    SET bio = NEW.bio, avatar_url = NEW.avatar_url, preferences = NEW.preferences
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_profile_sync
  AFTER INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION sync_user_profile();

-- Step 5: After all code migrated, drop columns from users
ALTER TABLE users DROP COLUMN bio;
ALTER TABLE users DROP COLUMN avatar_url;
ALTER TABLE users DROP COLUMN preferences;

-- Step 6: Drop trigger
DROP TRIGGER users_profile_sync ON users;
DROP FUNCTION sync_user_profile();
```

### Strategy 4: Change Sharding Key (Very Complex)

This requires careful planning and often a maintenance window.

**Approach: Dual-write period**

```javascript
// Phase 1: Dual-write to both old and new sharding schemes
async function createPost(userId, content) {
  // Write to old shard (by user_id)
  const oldShard = getShardByUserId(userId);
  const oldPost = await oldShard.query(
    'INSERT INTO posts (user_id, content) VALUES ($1, $2) RETURNING *',
    [userId, content]
  );

  // Also write to new shard (by region + user_id)
  const newShard = getShardByRegionAndUserId(user.region, userId);
  await newShard.query(
    'INSERT INTO posts (id, user_id, content, created_at) VALUES ($1, $2, $3, $4)',
    [oldPost.rows[0].id, userId, content, oldPost.rows[0].created_at]
  );

  return oldPost.rows[0];
}

// Phase 2: Backfill old data to new shards
async function backfillToNewShards() {
  // For each old shard
  for (const oldShard of oldShards) {
    // Get all data
    const posts = await oldShard.query('SELECT * FROM posts');

    // Redistribute to new shards
    for (const post of posts.rows) {
      const newShard = getShardByRegionAndUserId(post.user_region, post.user_id);
      await newShard.query(
        'INSERT INTO posts (...) VALUES (...) ON CONFLICT DO NOTHING'
      );
    }
  }
}

// Phase 3: Switch reads to new shards (feature flag)
async function getUserPosts(userId, useNewShards = false) {
  if (useNewShards || featureFlags.newSharding) {
    const newShard = getShardByRegionAndUserId(user.region, userId);
    return newShard.query('SELECT * FROM posts WHERE user_id = $1', [userId]);
  } else {
    const oldShard = getShardByUserId(userId);
    return oldShard.query('SELECT * FROM posts WHERE user_id = $1', [userId]);
  }
}

// Phase 4: After validation, stop dual-writes and decomm old shards
```

* * *

## Anti-Patterns to Avoid

### 1. God Tables (EAV Pattern)

```sql
-- BAD: Entity-Attribute-Value pattern
CREATE TABLE entity_attributes (
  entity_id BIGINT NOT NULL,
  attribute_name VARCHAR(100) NOT NULL,
  attribute_value TEXT,
  PRIMARY KEY (entity_id, attribute_name)
);

-- Storing:
INSERT INTO entity_attributes VALUES (1, 'name', 'iPhone');
INSERT INTO entity_attributes VALUES (1, 'price', '999');
INSERT INTO entity_attributes VALUES (1, 'color', 'black');

-- Problems:
-- ❌ No type safety (everything is TEXT)
-- ❌ No foreign keys
-- ❌ Queries are nightmare
-- ❌ Can't index efficiently

-- Query hell:
SELECT
  e1.entity_id,
  e1.attribute_value AS name,
  e2.attribute_value AS price
FROM entity_attributes e1
JOIN entity_attributes e2 ON e2.entity_id = e1.entity_id AND e2.attribute_name = 'price'
WHERE e1.attribute_name = 'name'
  AND e1.attribute_value LIKE '%iPhone%';

-- GOOD: Use proper columns, or JSONB for truly variable data
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  attributes JSONB  -- For truly variable attributes
);

-- Query is simple:
SELECT * FROM products
WHERE name LIKE '%iPhone%'
  AND price < 1000;
```

### 2. Polymorphic Associations

```sql
-- BAD: Polymorphic foreign key (can't enforce integrity)
CREATE TABLE comments (
  id BIGSERIAL PRIMARY KEY,
  commentable_type VARCHAR(50) NOT NULL,  -- 'Post', 'Photo', 'Video'
  commentable_id BIGINT NOT NULL,         -- id in that table
  content TEXT NOT NULL
);

-- Problems:
-- ❌ Can't use foreign key constraint
-- ❌ Orphaned data when parent deleted
-- ❌ Must validate in application code
-- ❌ Query joins are complex

-- GOOD: Separate tables or explicit foreign keys
CREATE TABLE post_comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL
);

CREATE TABLE photo_comments (
  id BIGSERIAL PRIMARY KEY,
  photo_id BIGINT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  content TEXT NOT NULL
);

-- Or if truly polymorphic, use nullable foreign keys:
CREATE TABLE comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  photo_id BIGINT REFERENCES photos(id) ON DELETE CASCADE,
  video_id BIGINT REFERENCES videos(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  CHECK (
    (post_id IS NOT NULL)::INTEGER +
    (photo_id IS NOT NULL)::INTEGER +
    (video_id IS NOT NULL)::INTEGER = 1
  )
);
```

### 3. UUID as Primary Key (Performance Impact)

```sql
-- BAD: UUID as clustered primary key on high-write table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  event_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Problems:
-- ❌ Random UUIDs cause index fragmentation
-- ❌ 16 bytes vs 8 bytes (BIGINT) = 2x storage
-- ❌ Page splits on every insert (not sequential)

-- With 100M rows, insert performance degrades significantly

-- GOOD: BIGSERIAL for internal PKs, UUID for external IDs
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,              -- Internal, sequential, fast
  external_id UUID NOT NULL DEFAULT gen_random_uuid(),  -- External, for API
  user_id BIGINT NOT NULL,
  event_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_events_external_id ON events(external_id);

-- Or use UUIDv7 (sequential, time-ordered)
-- Available in PostgreSQL 17+
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),  -- Sequential UUID
  user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. NOT NULL Defaults on Large Tables

```sql
-- BAD: Adding NOT NULL column with default on large table (locks table!)
ALTER TABLE orders ADD COLUMN priority INTEGER NOT NULL DEFAULT 1;

-- On 100M row table:
-- PostgreSQL rewrites entire table
-- Table locked for hours
-- Application downtime

-- GOOD: Three-step approach
-- Step 1: Add nullable
ALTER TABLE orders ADD COLUMN priority INTEGER;

-- Step 2: Backfill in batches
UPDATE orders SET priority = 1 WHERE priority IS NULL;

-- Step 3: Add NOT NULL constraint
ALTER TABLE orders ALTER COLUMN priority SET NOT NULL;
ALTER TABLE orders ALTER COLUMN priority SET DEFAULT 1;
```

* * *

## Summary Checklist

### MVP Stage Checklist
- [ ] Normalize to 3NF
- [ ] Add foreign keys with ON DELETE
- [ ] Index all foreign keys
- [ ] Add created_at, updated_at to all tables
- [ ] Use BIGSERIAL for PKs
- [ ] Use TIMESTAMPTZ (not TIMESTAMP)
- [ ] Use NUMERIC for money (not FLOAT)
- [ ] Add basic monitoring

### Growth Stage Checklist
- [ ] Monitor slow queries (pg_stat_statements)
- [ ] Add composite indexes for common query patterns
- [ ] Implement connection pooling
- [ ] Add caching layer (Redis) for hot data
- [ ] Denormalize aggregates (counts, sums)
- [ ] Set up read replicas
- [ ] Add full-text search indexes
- [ ] Implement soft deletes if needed
- [ ] Set up automated backups

### Scale Stage Checklist
- [ ] Partition time-series tables
- [ ] Separate hot/cold data
- [ ] Implement sharding strategy
- [ ] Multi-region replication
- [ ] Event sourcing for critical paths
- [ ] Fan-out writes for feeds
- [ ] Async job processing
- [ ] Database metrics and alerting
- [ ] Load testing at 10x current scale

### Migration Safety Checklist
- [ ] Test migration on production snapshot
- [ ] Measure migration time
- [ ] Plan rollback strategy
- [ ] Batch large updates (< 10K rows at a time)
- [ ] Avoid long-running locks
- [ ] Use dual-write period for schema changes
- [ ] Feature flags for behavior changes
- [ ] Monitor error rates during rollout

* * *

## Further Reading

- [PostgreSQL](./PostgreSQL.md) - Core PostgreSQL features
- [Schema Design](./Schema%20Design.md) - Schema design fundamentals
- [Query Optimization](./Query%20Optimization.md) - Making queries fast
- [Replication & Scaling](./Replication%20&%20Scaling.md) - Scaling strategies
- [Indexing](./Indexing.md) - Index design patterns

**External Resources:**
- PostgreSQL Performance Tuning: https://wiki.postgresql.org/wiki/Performance_Optimization
- Instagram's Sharding Story: https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c
- Discord's Scaling Journey: https://discord.com/blog/how-discord-stores-billions-of-messages
