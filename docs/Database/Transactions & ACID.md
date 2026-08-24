---
sidebar_position: 5
---

## Transactions & ACID

A **transaction** is a sequence of operations that the database treats as a single unit — either all succeed or all fail. Without transactions, a partial failure (power cut, crash, network drop) leaves your data in an inconsistent state.

* * *

What is ACID?
=============

ACID is a set of guarantees that a database transaction must satisfy.

### A — Atomicity

All operations in a transaction succeed together, or none of them do.

```sql
BEGIN;
  UPDATE accounts SET balance = balance - 1000 WHERE id = 'alice';
  UPDATE accounts SET balance = balance + 1000 WHERE id = 'bob';
COMMIT;
```

If the second UPDATE fails (Bob's account doesn't exist), the first UPDATE is also rolled back. Alice's money is never lost.

Without atomicity: Alice's ₹1000 disappears from her account but never appears in Bob's.

### C — Consistency

A transaction takes the database from one **valid state** to another valid state. All constraints, rules, and cascades are enforced.

```sql
-- Constraint: balance cannot go negative
ALTER TABLE accounts ADD CONSTRAINT balance_positive CHECK (balance >= 0);

BEGIN;
  UPDATE accounts SET balance = balance - 5000 WHERE id = 'alice';  -- alice has ₹1000
  -- This violates the CHECK constraint → entire transaction is rolled back
COMMIT;
```

Consistency ensures your business rules (foreign keys, unique constraints, check constraints) are never violated by a transaction.

### I — Isolation

Concurrent transactions don't interfere with each other. Each transaction sees a consistent snapshot of the database.

Without isolation, one transaction can see partial results of another in-progress transaction — causing bizarre bugs.

### D — Durability

Once a transaction is committed, it's permanent — even if the server crashes immediately after.

Databases achieve durability via **Write-Ahead Logging (WAL)**: every change is written to a log on disk before being applied to the data files. On crash, the log is replayed.

* * *

Isolation Levels
=================

Isolation is a spectrum. Stronger isolation = fewer anomalies but more locking = lower throughput. Choose the level that matches your use case.

### The Anomalies

**Dirty Read** — reading uncommitted data from another transaction.

```
Transaction A                      Transaction B
BEGIN;
UPDATE orders SET total = 500
WHERE id = 1;
-- not yet committed
                                   SELECT total FROM orders WHERE id = 1;
                                   -- reads 500 (dirty! A hasn't committed)
ROLLBACK;
-- A rolled back, 500 was wrong
                                   -- B used wrong data
```

**Non-Repeatable Read** — reading the same row twice in a transaction and getting different values (because another committed transaction changed it).

```
Transaction A                      Transaction B
BEGIN;
SELECT total FROM orders
WHERE id = 1;  -- returns 200

                                   BEGIN;
                                   UPDATE orders SET total = 500 WHERE id = 1;
                                   COMMIT;

SELECT total FROM orders
WHERE id = 1;  -- returns 500 (changed!)
-- A got two different values for the same read
```

**Phantom Read** — a query returns different rows when re-run within the same transaction (because another committed transaction inserted/deleted rows).

```
Transaction A                      Transaction B
BEGIN;
SELECT COUNT(*) FROM orders
WHERE status = 'PENDING';  -- 10

                                   BEGIN;
                                   INSERT INTO orders (status) VALUES ('PENDING');
                                   COMMIT;

SELECT COUNT(*) FROM orders
WHERE status = 'PENDING';  -- 11 (phantom row appeared!)
```

### Isolation Levels and What They Prevent

| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read |
|---|---|---|---|
| **Read Uncommitted** | Possible | Possible | Possible |
| **Read Committed** | Prevented | Possible | Possible |
| **Repeatable Read** | Prevented | Prevented | Possible (prevented in MySQL) |
| **Serializable** | Prevented | Prevented | Prevented |

### Read Uncommitted

No isolation. Transactions can see uncommitted changes of others. Almost never used — the risks outweigh any performance benefit.

### Read Committed (default in PostgreSQL)

Each statement sees only committed data. The most common default.

```sql
-- Set for a session
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

Good for: most web application workloads.

### Repeatable Read (default in MySQL InnoDB)

Once a row is read in a transaction, re-reading it always returns the same value — even if another transaction commits a change.

```sql
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```

Good for: financial calculations where you need consistent reads within a transaction (calculating totals, generating reports).

### Serializable

The strictest level. Transactions execute as if they were run one after another (serially), even if they run concurrently.

```sql
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
```

Good for: bank transfers, inventory reservation, anywhere correctness is critical and you can't afford anomalies.

**Cost:** More locking and contention, lower throughput. Use only where necessary.

* * *

Pessimistic vs Optimistic Locking
===================================

### Pessimistic Locking

Lock the row at read time. No one else can modify it until your transaction commits.

```sql
BEGIN;

-- Lock the row — other transactions block until we commit
SELECT * FROM orders WHERE id = 123 FOR UPDATE;

-- Safe to update — we own the lock
UPDATE orders SET status = 'PROCESSING' WHERE id = 123;

COMMIT;
```

`FOR UPDATE` — exclusive lock, blocks readers and writers.
`FOR SHARE` — shared lock, blocks writers but allows readers.

**Use when:** The contention is high and you need guaranteed exclusive access (inventory reservation, seat booking).

**Downside:** Blocked transactions wait → potential deadlocks, lower throughput.

### Optimistic Locking

Don't lock at read time. Before updating, check that nothing changed since you read it.

```sql
-- Add a version column
ALTER TABLE orders ADD COLUMN version INT DEFAULT 1;
```

```sql
-- Read the record
SELECT id, total, version FROM orders WHERE id = 123;
-- Returns: { id: 123, total: 500, version: 4 }

-- Try to update — only succeed if version hasn't changed
UPDATE orders
SET total = 600, version = version + 1
WHERE id = 123 AND version = 4;  -- conditional on version

-- Check rows affected
-- 1 row affected → success, no concurrent modification
-- 0 rows affected → someone else changed it, retry
```

```js
// Application code
async function updateOrder(orderId, newTotal) {
  const order = await db.query('SELECT id, total, version FROM orders WHERE id = $1', [orderId]);

  const result = await db.query(
    'UPDATE orders SET total = $1, version = version + 1 WHERE id = $2 AND version = $3',
    [newTotal, orderId, order.version]
  );

  if (result.rowCount === 0) {
    throw new ConflictError('Order was modified by another process. Please retry.');
  }
}
```

**Use when:** Contention is low and retries are acceptable. Reads are frequent, writes are rare.

**Downside:** Must handle retry logic. Bad for high-contention scenarios (you'd retry constantly).

* * *

Deadlocks
==========

A deadlock occurs when two transactions each hold a lock the other needs.

```
Transaction A                      Transaction B
BEGIN;
Lock row: orders WHERE id = 1

                                   BEGIN;
                                   Lock row: orders WHERE id = 2

UPDATE orders WHERE id = 2;        -- Waiting for A to release lock on row 2
(waiting for B)

                                   UPDATE orders WHERE id = 1;
                                   -- Waiting for A to release lock on row 1
                                   (waiting for A)

-- DEADLOCK! Both are waiting for each other.
```

The database detects deadlocks and kills one transaction (rolls it back). The surviving transaction completes.

### How to prevent deadlocks

**1. Consistent ordering** — always acquire locks in the same order.

```js
// Bad — A locks order 1 then 2, B locks order 2 then 1 → deadlock possible
async function transferStock(fromId, toId, qty) {
  await lockRow(fromId);
  await lockRow(toId);
  // ...
}

// Good — always lock the lower ID first → consistent order, no deadlock
async function transferStock(fromId, toId, qty) {
  const [first, second] = [fromId, toId].sort();
  await lockRow(first);
  await lockRow(second);
  // ...
}
```

**2. Keep transactions short** — the less time a transaction holds locks, the lower the chance of conflict.

**3. Retry on deadlock** — catch the deadlock error and retry the transaction.

```js
async function withRetryOnDeadlock(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isDeadlock = err.code === '40P01'; // PostgreSQL deadlock error code
      if (isDeadlock && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 100)); // back off
        continue;
      }
      throw err;
    }
  }
}
```

**4. Use `SELECT FOR UPDATE SKIP LOCKED`** — skip rows already locked instead of waiting.

```sql
-- Useful for job queues — each worker picks an unlocked job
SELECT * FROM jobs
WHERE status = 'PENDING'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

* * *

Common Transaction Patterns
============================

### The Unit of Work pattern

Wrap multiple repository operations in a single transaction.

```js
async function placeOrder(userId, items) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create the order
    const { rows: [order] } = await client.query(
      'INSERT INTO orders (user_id, status, total) VALUES ($1, $2, $3) RETURNING *',
      [userId, 'PENDING', calculateTotal(items)]
    );

    // Insert order items
    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, qty, price) VALUES ($1, $2, $3, $4)',
        [order.id, item.productId, item.qty, item.price]
      );
    }

    // Decrement inventory
    for (const item of items) {
      const { rowCount } = await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1',
        [item.qty, item.productId]
      );
      if (rowCount === 0) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
    }

    await client.query('COMMIT');
    return order;

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

If inventory is insufficient, the entire transaction rolls back — no order created, no partial items inserted.

### Savepoints

Partial rollback within a transaction.

```sql
BEGIN;
  INSERT INTO orders (...) VALUES (...);

  SAVEPOINT before_notification;

  INSERT INTO notifications (...) VALUES (...);  -- this might fail (email invalid)

  -- If notification fails, rollback only to savepoint
  ROLLBACK TO SAVEPOINT before_notification;

  -- Order is still intact, notification skipped
COMMIT;
```

* * *

Two-Phase Commit (2PC) — Distributed Transactions
===================================================

When a transaction spans **multiple databases or services**, you need distributed coordination.

```
Coordinator
    ↓
Phase 1 — PREPARE
    → Ask all participants: "Can you commit?"
    → DB1: "Yes, I'm ready" (locks resources, writes to WAL)
    → DB2: "Yes, I'm ready" (same)

Phase 2 — COMMIT
    → All said yes → send COMMIT to all
    → All commit simultaneously
    → If any said No → send ROLLBACK to all
```

**Problem:** If the coordinator crashes between Phase 1 and 2, participants are stuck holding locks.

**In practice:** 2PC is used internally by distributed databases. For microservices, use the **Saga Pattern** instead — a sequence of local transactions with compensating actions on failure.

* * *

Interview definition (short answer)
=====================================

> "ACID guarantees Atomicity (all-or-nothing), Consistency (constraints always hold), Isolation (concurrent transactions don't interfere), and Durability (committed data survives crashes). Isolation level is a tradeoff between anomaly prevention and throughput — Read Committed is the practical default, Serializable for critical financial operations. Deadlocks are prevented by consistent lock ordering and short transactions."
