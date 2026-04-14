---
sidebar_position: 3
---

## Integration Testing

Integration tests verify that **multiple components work correctly together** — your service with the real database, your API with real middleware, your code with the real Redis client.

Unit tests tell you the logic is right. Integration tests tell you the **wiring is right**.

* * *

Why Integration Tests?
=======================

Unit tests with mocks can pass even when:

*   Your SQL query has a typo
*   The DB schema doesn't match what the code expects
*   A foreign key constraint prevents your insert
*   Your Redis key format is wrong
*   Your HTTP route is misconfigured
*   A middleware runs in the wrong order

Integration tests catch all of this. They're slower but provide a fundamentally different kind of confidence.

* * *

What to Integration Test
=========================

| Layer | What to test |
|---|---|
| **Repository → DB** | Queries return correct data, constraints work, indexes are used |
| **Service → Repository** | End-to-end business logic with real persistence |
| **HTTP → Service** | Request routing, middleware, response shape, status codes |
| **Service → Redis** | Cache reads/writes/invalidation |
| **Service → Queue** | Jobs are enqueued correctly |

* * *

Testing the Repository Layer
=============================

Use a real test database — not a mock.

```bash
# .env.test
DATABASE_URL=postgres://localhost:5432/myapp_test
```

```js
// repositories/orderRepository.integration.test.js
import { Pool } from 'pg';
import { PostgresOrderRepository } from './PostgresOrderRepository.js';

let pool;
let repo;

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  repo = new PostgresOrderRepository(pool);
  // Run migrations on the test DB
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL,
      total NUMERIC NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
});

afterEach(async () => {
  // Clean between tests
  await pool.query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

test('create inserts order and returns it with id', async () => {
  const order = await repo.create({ userId: 'user1', total: 500, status: 'PENDING' });

  expect(order.id).toBeDefined();
  expect(order.total).toBe('500'); // Postgres returns numeric as string
  expect(order.status).toBe('PENDING');
});

test('findById returns null when order does not exist', async () => {
  const order = await repo.findById(999);
  expect(order).toBeNull();
});

test('findByUserId returns all orders for a user', async () => {
  await repo.create({ userId: 'user1', total: 100 });
  await repo.create({ userId: 'user1', total: 200 });
  await repo.create({ userId: 'user2', total: 300 }); // different user

  const orders = await repo.findByUserId('user1');

  expect(orders).toHaveLength(2);
  expect(orders.every(o => o.userId === 'user1' || o.user_id === 'user1')).toBe(true);
});

test('update modifies specific fields', async () => {
  const created = await repo.create({ userId: 'user1', total: 500 });
  const updated = await repo.update(created.id, { status: 'SHIPPED' });

  expect(updated.status).toBe('SHIPPED');
  expect(updated.total).toBe(created.total); // unchanged
});
```

* * *

Testing HTTP Endpoints with Supertest
=======================================

```bash
npm install --save-dev supertest
```

Supertest starts your Express app and fires real HTTP requests against it — without binding a port.

```js
// app.js
import express from 'express';
import { orderRouter } from './routes/orders.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use('/orders', orderRouter);
app.use(errorHandler);

export default app;
```

```js
// routes/orders.integration.test.js
import request from 'supertest';
import app from '../app.js';
import { pool } from '../db.js';

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');

  // Seed a test user
  await pool.query(
    'INSERT INTO users (id, email) VALUES ($1, $2)',
    ['user1', 'test@example.com']
  );
});

afterAll(async () => {
  await pool.end();
});

describe('POST /orders', () => {
  test('creates order and returns 201', async () => {
    const res = await request(app)
      .post('/orders')
      .set('Authorization', 'Bearer test-token')
      .send({
        userId: 'user1',
        items: [{ productId: 'P1', qty: 2, price: 100 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.total).toBe(200);
    expect(res.headers.location).toMatch(/\/orders\/\d+/);
  });

  test('returns 400 when items array is empty', async () => {
    const res = await request(app)
      .post('/orders')
      .set('Authorization', 'Bearer test-token')
      .send({ userId: 'user1', items: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 401 when Authorization header is missing', async () => {
    const res = await request(app)
      .post('/orders')
      .send({ userId: 'user1', items: [{ productId: 'P1', qty: 1, price: 50 }] });

    expect(res.status).toBe(401);
  });
});

describe('GET /orders/:id', () => {
  test('returns order when it exists', async () => {
    // Arrange — create an order directly in DB
    const { rows } = await pool.query(
      'INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING *',
      ['user1', 500, 'PENDING']
    );
    const orderId = rows[0].id;

    // Act
    const res = await request(app)
      .get(`/orders/${orderId}`)
      .set('Authorization', 'Bearer test-token');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(String(orderId));
    expect(res.body.data.total).toBe('500');
  });

  test('returns 404 when order does not exist', async () => {
    const res = await request(app)
      .get('/orders/99999')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
```

* * *

Testing with Auth Middleware
=============================

Don't mock auth in integration tests — test the real middleware.

```js
// helpers/testAuth.js
import jwt from 'jsonwebtoken';

export function generateTestToken(user = { id: 'user1', role: 'user' }) {
  return jwt.sign(user, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}
```

```js
// In tests
const token = generateTestToken({ id: 'user1', role: 'admin' });

const res = await request(app)
  .delete('/users/42')
  .set('Authorization', `Bearer ${token}`);

expect(res.status).toBe(200);
```

```js
// Test role-based access
test('returns 403 when non-admin tries to delete user', async () => {
  const token = generateTestToken({ id: 'user1', role: 'user' }); // not admin

  const res = await request(app)
    .delete('/users/42')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(403);
});
```

* * *

Database Test Strategy
=======================

### Option 1: Shared test database (simple)

One `myapp_test` database. Truncate tables between tests.

```js
afterEach(async () => {
  await pool.query('TRUNCATE TABLE orders, users, inventory RESTART IDENTITY CASCADE');
});
```

**Pro:** Simple setup.
**Con:** Tests can interfere if run in parallel.

### Option 2: Transactions with rollback (fast)

Wrap each test in a transaction and roll it back.

```js
let client;

beforeEach(async () => {
  client = await pool.connect();
  await client.query('BEGIN');
  // pass client to repo instead of pool
  repo = new PostgresOrderRepository({ query: (...args) => client.query(...args) });
});

afterEach(async () => {
  await client.query('ROLLBACK');
  client.release();
});
```

**Pro:** Super fast — no truncation, no data cleanup.
**Con:** Requires injectable DB client.

### Option 3: Separate DB per test file (parallel safe)

```js
// jest.config.js
module.exports = {
  globalSetup:    './tests/globalSetup.js',    // create test DBs
  globalTeardown: './tests/globalTeardown.js', // drop test DBs
};
```

Each worker gets its own database. Full parallelism, no interference.

* * *

Testing Redis Integration
==========================

```js
// services/cacheService.integration.test.js
import { createClient } from 'redis';
import { CacheService } from './cacheService.js';

let client;
let cache;

beforeAll(async () => {
  client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  await client.connect();
  cache = new CacheService(client);
});

afterEach(async () => {
  await client.flushDb(); // clear all test data
});

afterAll(async () => {
  await client.quit();
});

test('stores and retrieves a value', async () => {
  await cache.set('user:1', { name: 'Prajwal' }, 60);
  const value = await cache.get('user:1');
  expect(value).toEqual({ name: 'Prajwal' });
});

test('returns null for expired key', async () => {
  await cache.set('session:1', { userId: '42' }, 1); // 1 second TTL
  await new Promise(r => setTimeout(r, 1100));       // wait for expiry
  const value = await cache.get('session:1');
  expect(value).toBeNull();
});

test('invalidates cache on update', async () => {
  await cache.set('user:1', { name: 'Old Name' }, 60);
  await cache.invalidate('user:1');
  const value = await cache.get('user:1');
  expect(value).toBeNull();
});
```

* * *

Seeding Test Data
==================

For complex scenarios, use a seed helper:

```js
// tests/helpers/seed.js
export async function seedUser(pool, overrides = {}) {
  const user = {
    id:    overrides.id    || `user_${Date.now()}`,
    email: overrides.email || `test_${Date.now()}@example.com`,
    role:  overrides.role  || 'user',
  };
  await pool.query(
    'INSERT INTO users (id, email, role) VALUES ($1, $2, $3)',
    [user.id, user.email, user.role]
  );
  return user;
}

export async function seedOrder(pool, userId, overrides = {}) {
  const { rows } = await pool.query(
    'INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING *',
    [userId, overrides.total || 500, overrides.status || 'PENDING']
  );
  return rows[0];
}
```

```js
// In tests
const user  = await seedUser(pool, { role: 'admin' });
const order = await seedOrder(pool, user.id, { status: 'PAID' });

const res = await request(app)
  .post(`/orders/${order.id}/ship`)
  .set('Authorization', `Bearer ${generateTestToken(user)}`);

expect(res.status).toBe(200);
```

* * *

Separating Unit and Integration Tests
======================================

Keep them in separate directories and run them separately.

```
src/
  services/
    orderService.js
    orderService.test.js          ← unit tests (fast, always run)
  repositories/
    PostgresOrderRepository.js
tests/
  integration/
    orders.integration.test.js    ← integration tests (slower, run in CI)
    users.integration.test.js
  helpers/
    seed.js
    testAuth.js
```

```json
// package.json
{
  "scripts": {
    "test":            "jest src --testPathPattern='.test.js'",
    "test:integration": "jest tests/integration --runInBand"
  }
}
```

`--runInBand` runs integration tests sequentially to avoid DB conflicts.

* * *

When to use Integration vs Unit Tests
=======================================

| Scenario | Unit | Integration |
|---|---|---|
| Discount calculation logic | ✅ | — |
| SQL query returns correct rows | — | ✅ |
| Middleware runs in correct order | — | ✅ |
| Business rule: can't ship unpaid order | ✅ | ✅ (both) |
| Cache invalidation on update | — | ✅ |
| Error response shape (400/401/404) | — | ✅ |
| Complex domain logic with many branches | ✅ | — |
| DB constraint prevents duplicates | — | ✅ |

* * *

Interview definition (short answer)
=====================================

> "Integration tests verify that components work together correctly — your service with a real database, your API with real middleware. They use real infrastructure (test DB, Redis) and are slower than unit tests, but catch wiring bugs that mocks cannot. Use Supertest for HTTP layer tests, and real test DBs with truncation between tests."
