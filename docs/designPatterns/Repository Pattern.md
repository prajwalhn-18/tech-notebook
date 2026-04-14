---
sidebar_position: 2
---

## Repository Pattern in JS

The **Repository Pattern** creates an **abstraction layer** between your business logic and your data access code.

Think of it like this:

> "My service shouldn't know whether data comes from Postgres, MongoDB, or Redis. It just asks — **give me the user with id 42**."

* * *

What is Repository Pattern?
============================

It is a **structural/architectural pattern** where:

*   you define a **repository interface** (the contract for data operations)
*   concrete repositories implement that contract for specific databases
*   services depend on the interface, not the concrete implementation
*   the database can be swapped without changing service code

* * *

Real-world analogy
==================

Think of a **library system**:

*   You ask the librarian: "I need the book '1984'"
*   You don't care if it's on shelf A, shelf B, the digital archive, or on loan
*   The librarian (repository) handles the details

* * *

The problem without Repository Pattern
=======================================

```js
// Bad — DB logic leaks into service
class OrderService {
  async getOrder(orderId) {
    // Direct DB query in business logic
    const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    return rows[0];
  }

  async getUserOrders(userId) {
    const { rows } = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  }
}
```

Problems:
- SQL scattered across services
- Can't switch from Postgres to Mongo without touching service files
- Can't unit test without a real DB

* * *

Repository Pattern Solution
============================

### Step 1: Define the contract

```js
/**
 * @typedef {Object} OrderRepository
 * @property {function(string): Promise<Object>} findById
 * @property {function(string): Promise<Object[]>} findByUserId
 * @property {function(Object): Promise<Object>} create
 * @property {function(string, Object): Promise<Object>} update
 * @property {function(string): Promise<void>} delete
 */
```

In JS you express the contract via JSDoc or just convention. All repositories must implement these methods.

* * *

### Step 2: Concrete repository — PostgreSQL

```js
// repositories/postgres/PostgresOrderRepository.js
export class PostgresOrderRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findById(orderId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );
    return rows[0] || null;
  }

  async findByUserId(userId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  }

  async create(orderData) {
    const { rows } = await this.pool.query(
      'INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING *',
      [orderData.userId, orderData.total, orderData.status || 'PENDING']
    );
    return rows[0];
  }

  async update(orderId, updates) {
    const fields = Object.keys(updates)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');

    const values = Object.values(updates);

    const { rows } = await this.pool.query(
      `UPDATE orders SET ${fields}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [orderId, ...values]
    );
    return rows[0];
  }

  async delete(orderId) {
    await this.pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
  }

  async findByStatus(status) {
    const { rows } = await this.pool.query(
      'SELECT * FROM orders WHERE status = $1',
      [status]
    );
    return rows;
  }
}
```

* * *

### Step 3: Concrete repository — MongoDB

```js
// repositories/mongo/MongoOrderRepository.js
export class MongoOrderRepository {
  constructor(db) {
    this.collection = db.collection('orders');
  }

  async findById(orderId) {
    return this.collection.findOne({ _id: orderId });
  }

  async findByUserId(userId) {
    return this.collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async create(orderData) {
    const result = await this.collection.insertOne({
      ...orderData,
      status: orderData.status || 'PENDING',
      createdAt: new Date(),
    });
    return { ...orderData, _id: result.insertedId };
  }

  async update(orderId, updates) {
    const result = await this.collection.findOneAndUpdate(
      { _id: orderId },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result;
  }

  async delete(orderId) {
    await this.collection.deleteOne({ _id: orderId });
  }

  async findByStatus(status) {
    return this.collection.find({ status }).toArray();
  }
}
```

* * *

### Step 4: In-memory repository for testing

```js
// repositories/InMemoryOrderRepository.js
export class InMemoryOrderRepository {
  #orders = new Map();
  #nextId = 1;

  async findById(orderId) {
    return this.#orders.get(orderId) || null;
  }

  async findByUserId(userId) {
    return [...this.#orders.values()]
      .filter(o => o.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async create(orderData) {
    const id = String(this.#nextId++);
    const order = { ...orderData, id, status: orderData.status || 'PENDING', createdAt: new Date() };
    this.#orders.set(id, order);
    return order;
  }

  async update(orderId, updates) {
    const order = this.#orders.get(orderId);
    if (!order) return null;
    const updated = { ...order, ...updates, updatedAt: new Date() };
    this.#orders.set(orderId, updated);
    return updated;
  }

  async delete(orderId) {
    this.#orders.delete(orderId);
  }

  async findByStatus(status) {
    return [...this.#orders.values()].filter(o => o.status === status);
  }

  // Test helpers
  clear() { this.#orders.clear(); }
  count() { return this.#orders.size; }
}
```

* * *

### Step 5: Service depends on the repository — not the DB

```js
// services/OrderService.js
export class OrderService {
  constructor(orderRepository) {
    this.orderRepo = orderRepository;
  }

  async getOrder(orderId) {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    return order;
  }

  async getUserOrders(userId) {
    return this.orderRepo.findByUserId(userId);
  }

  async placeOrder(userId, items) {
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

    return this.orderRepo.create({
      userId,
      items,
      total,
      status: 'PENDING',
    });
  }

  async shipOrder(orderId) {
    const order = await this.getOrder(orderId);
    if (order.status !== 'PAID') throw new Error('Order must be paid before shipping');
    return this.orderRepo.update(orderId, { status: 'SHIPPED' });
  }

  async getPendingOrders() {
    return this.orderRepo.findByStatus('PENDING');
  }
}
```

The service has **zero DB knowledge**. It works the same whether the repo talks to Postgres, Mongo, or an in-memory map.

* * *

### Step 6: Wiring it up

```js
// Production
import { Pool } from 'pg';
import { PostgresOrderRepository } from './repositories/postgres/PostgresOrderRepository.js';
import { OrderService } from './services/OrderService.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const orderRepo    = new PostgresOrderRepository(pool);
const orderService = new OrderService(orderRepo);

export { orderService };
```

```js
// Tests — no real DB
import { InMemoryOrderRepository } from './repositories/InMemoryOrderRepository.js';
import { OrderService } from './services/OrderService.js';

const orderRepo    = new InMemoryOrderRepository();
const orderService = new OrderService(orderRepo);

test('placeOrder creates a PENDING order', async () => {
  const order = await orderService.placeOrder('USER1', [
    { productId: 'P1', price: 100, qty: 2 },
  ]);

  expect(order.total).toBe(200);
  expect(order.status).toBe('PENDING');
});

test('shipOrder fails if order is not PAID', async () => {
  const order = await orderService.placeOrder('USER1', [{ price: 50, qty: 1 }]);
  await expect(orderService.shipOrder(order.id)).rejects.toThrow('must be paid');
});
```

No database setup, no mocking `pg`, no fixtures. Just pure logic tests.

* * *

Adding a caching layer with Repository
========================================

Because services only talk to the repository interface, you can add a **caching repository** that wraps another:

```js
// repositories/CachedOrderRepository.js
export class CachedOrderRepository {
  constructor(innerRepository, cache) {
    this.repo  = innerRepository;
    this.cache = cache;
  }

  async findById(orderId) {
    const key    = `order:${orderId}`;
    const cached = await this.cache.get(key);
    if (cached) return JSON.parse(cached);

    const order = await this.repo.findById(orderId);
    if (order) await this.cache.set(key, JSON.stringify(order), 300);
    return order;
  }

  async create(orderData) {
    return this.repo.create(orderData);
  }

  async update(orderId, updates) {
    const order = await this.repo.update(orderId, updates);
    // Invalidate cache on update
    await this.cache.del(`order:${orderId}`);
    return order;
  }

  async delete(orderId) {
    await this.repo.delete(orderId);
    await this.cache.del(`order:${orderId}`);
  }

  async findByUserId(userId) {
    return this.repo.findByUserId(userId);
  }

  async findByStatus(status) {
    return this.repo.findByStatus(status);
  }
}
```

```js
// Wiring: DB repo → Cache repo → Service
const pgRepo     = new PostgresOrderRepository(pool);
const cachedRepo = new CachedOrderRepository(pgRepo, redis);
const service    = new OrderService(cachedRepo);
```

The service doesn't know caching exists. This is the **Decorator** applied to the **Repository**.

* * *

Folder structure
================

```
src/
  repositories/
    interfaces/         ← JSDoc typedefs (contracts)
      OrderRepository.js
    postgres/
      PostgresOrderRepository.js
      PostgresUserRepository.js
    mongo/
      MongoOrderRepository.js
    InMemoryOrderRepository.js   ← for tests
    CachedOrderRepository.js     ← caching layer
  services/
    OrderService.js
    UserService.js
  controllers/
    orderController.js
```

* * *

Benefits
========

1\. **Testability** — swap the real DB for an in-memory repo in tests. No mocking frameworks needed.

2\. **Swappable storage** — migrate from Postgres to MongoDB by writing a new repo, not touching services.

3\. **Single place for queries** — all SQL/Mongo queries in one file. Easy to audit, optimize, index.

4\. **Separation of concerns** — services contain business rules, repositories contain data access.

5\. **Layering** — add caching, read replicas, audit logging as repo wrappers.

* * *

When to use Repository Pattern
================================

*   medium to large Node.js services with significant business logic
*   when you want services that are unit-testable without a real DB
*   when you might need to switch databases or use multiple storage backends
*   when you want to add caching as a transparent layer

* * *

When NOT to use it
==================

*   simple CRUD apps where an ORM like Prisma/Drizzle already gives you the abstraction
*   very small scripts where the overhead isn't worth it
*   when it becomes a `thin wrapper` that adds no value (just re-exports ORM methods)

> Tip: If your repository methods are 1-liners that just call `prisma.order.findUnique`, reconsider whether you need the pattern at all. The pattern pays off when queries have real complexity.

* * *

Interview definition (short answer)
=====================================

> "Repository Pattern abstracts data access behind an interface, so business logic doesn't depend on the database implementation. Services interact with the repository contract, making them testable and storage-agnostic."

* * *

Formula:

```
Service → Repository Interface → { PostgresRepo | MongoRepo | InMemoryRepo | CachedRepo }
```
