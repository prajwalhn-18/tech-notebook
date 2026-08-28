---
sidebar_position: 3
---

# Distributed Transactions

Understanding distributed transactions, two-phase commit, saga pattern, and idempotency for maintaining consistency across services.

---

## Table of Contents

1. [The Distributed Transaction Problem](#the-distributed-transaction-problem)
2. [Two-Phase Commit](#two-phase-commit)
3. [Three-Phase Commit](#three-phase-commit)
4. [Saga Pattern](#saga-pattern)
5. [Idempotency](#idempotency)
6. [Transaction Patterns](#transaction-patterns)
7. [Practical Considerations](#practical-considerations)

---

## The Distributed Transaction Problem

### ACID in Monoliths

**ACID Transactions:**
- **Atomicity:** All operations succeed or all fail
- **Consistency:** Database remains in valid state
- **Isolation:** Concurrent transactions don't interfere
- **Durability:** Committed changes persist

**Single database:** ACID provided by database management system.

### The Distributed Challenge

**Microservices architecture:**
- Each service owns its database
- No shared transaction coordinator
- Network failures possible
- Partial failures common

**Problem:** How to maintain consistency across multiple databases?

### Example: E-Commerce Order

**Operation:** Place order

**Steps:**
1. Order Service: Create order
2. Payment Service: Charge payment
3. Inventory Service: Reserve items
4. Shipping Service: Create shipment

**Failure scenarios:**
- Payment fails: Must cancel order
- Inventory unavailable: Must refund payment
- Shipping fails: Must refund and restock
- Network partition: Some operations succeed, others fail

**All-or-nothing atomicity needed across services.**

### Why Traditional Transactions Don't Work

**2PC (Two-Phase Commit) problems:**
- Blocking (locks held during coordination)
- Coordinator is single point of failure
- Poor performance across services
- Doesn't work across organizational boundaries

**XA transactions problems:**
- Requires all services to support XA
- Locks databases during commit
- Performance penalty
- Most modern systems don't support XA

**Reality:** Traditional distributed transactions don't scale in microservices.

---

## Two-Phase Commit

### How 2PC Works

**Participants:** Multiple databases/services.

**Coordinator:** Orchestrates transaction.

**Phase 1 (Prepare/Voting):**
1. Coordinator asks all participants: "Can you commit?"
2. Participants lock resources and vote YES or NO
3. Participants write vote to log (for crash recovery)

**Phase 2 (Commit/Abort):**
1. If all voted YES, coordinator sends COMMIT
2. If any voted NO, coordinator sends ABORT
3. Participants commit or abort
4. Participants release locks
5. Participants send ACK

**Phase 2 completion:**
- Coordinator waits for all ACKs
- Only then transaction is complete

### 2PC Example

```
Scenario: Transfer $100 from Account A to Account B (different databases)

Phase 1 (Prepare):
Coordinator → DB1: "Prepare to deduct $100 from A"
DB1: Locks Account A, verifies balance sufficient
DB1 → Coordinator: "YES"

Coordinator → DB2: "Prepare to add $100 to B"
DB2: Locks Account B
DB2 → Coordinator: "YES"

Phase 2 (Commit):
Coordinator → DB1: "COMMIT"
DB1: Deducts $100, releases lock
DB1 → Coordinator: "ACK"

Coordinator → DB2: "COMMIT"
DB2: Adds $100, releases lock
DB2 → Coordinator: "ACK"

Coordinator: Transaction complete
```

### 2PC Problems

**Blocking:**
- Locks held during entire protocol
- If coordinator fails, participants blocked indefinitely
- Participants can't release locks until coordinator decides

**Scenario:**
```
Phase 1 completes (all vote YES, resources locked)
Coordinator crashes before Phase 2
Participants stuck waiting (locks held, can't proceed)
```

**Single Point of Failure:**
- Coordinator crash blocks entire transaction
- Requires timeout and recovery mechanisms
- Recovery is complex

**Performance:**
- Multiple round trips (high latency)
- Locks held for duration
- Synchronous protocol (can't do other work)
- Doesn't scale to many participants

**Availability:**
- If any participant unavailable, transaction aborts
- Reduces overall availability

### When 2PC Is Appropriate

**Rarely in microservices.** Use only when:
- Services in same datacenter
- Low latency network
- High reliability needed
- Number of participants is small (2-3)
- Services under single organizational control

**Common uses:**
- Single database distributed transactions
- Within tightly coupled system boundaries
- Where strong consistency is absolute requirement

**Avoid for:**
- Cross-service transactions in microservices
- Long-running operations
- External services (third parties)
- High-scale systems

---

## Three-Phase Commit

### Improvements Over 2PC

**3PC adds a "Pre-Commit" phase between Prepare and Commit.**

**Phases:**
1. **Prepare:** Can you commit? (vote YES/NO)
2. **Pre-Commit:** All voted YES, prepare to commit
3. **Commit:** Actually commit

**Key difference:** Pre-commit phase allows recovery without blocking.

### How 3PC Works

**Phase 1 (Prepare):**
- Coordinator asks all participants: "Can you commit?"
- Participants vote YES or NO

**Phase 2 (Pre-Commit):**
- If all YES, coordinator sends PRE-COMMIT
- Participants acknowledge PRE-COMMIT
- All participants now know all voted YES

**Phase 3 (Commit):**
- Coordinator sends COMMIT
- Participants commit
- Send ACK

### 3PC Advantage

**Non-blocking recovery:**

If coordinator fails after Pre-Commit:
- Participants know all voted YES
- Can elect new coordinator
- New coordinator can safely commit

If coordinator fails before Pre-Commit:
- Participants haven't received Pre-Commit
- New coordinator can safely abort

**3PC eliminates indefinite blocking of 2PC.**

### 3PC Problems

**Network partitions:**
- 3PC assumes synchronous network
- Can't distinguish crash from slow network
- Network partition can cause split-brain

**Scenario:**
```
Coordinator sends Pre-Commit to Participant A
Network partition prevents message to Participant B
Participant A thinks transaction will commit
Participant B thinks transaction will abort
Coordinator timeout → abort
A commits, B aborts → Inconsistent!
```

**More complex:**
- Extra phase means extra latency
- More failure scenarios to handle
- More complex recovery logic

**Reality:** 3PC rarely used in practice. Benefits don't outweigh complexity.

---

## Saga Pattern

### What Is a Saga

**Saga:** Sequence of local transactions, each updating single service.

**Key idea:** Instead of single atomic transaction, use sequence of transactions that can be undone.

**If failure occurs:** Execute compensating transactions to undo completed steps.

### Saga Example

**Order placement saga:**

**Forward transactions:**
1. Order Service: Create order
2. Payment Service: Charge payment
3. Inventory Service: Reserve items
4. Shipping Service: Create shipment

**Compensating transactions (if failure):**
1. Shipping Service: Cancel shipment
2. Inventory Service: Release items
3. Payment Service: Refund payment
4. Order Service: Cancel order

### Choreography-Based Saga

**No central coordinator.** Services coordinate through events.

**Process:**
1. Order Service creates order → emits OrderCreated event
2. Payment Service listens, charges payment → emits PaymentSucceeded event
3. Inventory Service listens, reserves inventory → emits InventoryReserved event
4. Shipping Service listens, creates shipment → emits ShipmentCreated event

**Failure handling:**
- Inventory Service fails to reserve
- Emits InventoryReservationFailed event
- Payment Service listens, refunds payment → emits PaymentRefunded event
- Order Service listens, cancels order → emits OrderCancelled event

**Advantages:**
- Simple for basic flows
- No single point of failure
- Loose coupling

**Disadvantages:**
- Hard to understand overall flow
- Difficult to track saga state
- Cyclic dependencies possible
- Complex error handling logic

### Orchestration-Based Saga

**Central orchestrator coordinates saga.**

**Process:**
1. Orchestrator calls Order Service: Create order
2. Orchestrator calls Payment Service: Charge payment
3. Orchestrator calls Inventory Service: Reserve inventory
4. Orchestrator calls Shipping Service: Create shipment

**Failure handling:**
- If Inventory Service fails
- Orchestrator calls Payment Service: Refund payment
- Orchestrator calls Order Service: Cancel order

**Advantages:**
- Clear flow and control
- Easy to track saga state
- Simple error handling
- No cyclic dependencies

**Disadvantages:**
- Orchestrator is centralized component
- Orchestrator knows about all services
- More coupled architecture

**Recommendation:** Use orchestration for complex sagas. Better clarity and control.

### Saga Guarantees

**Sagas provide:**
- **Atomicity:** Either all transactions complete or all are compensated
- **Eventually consistent:** System becomes consistent after compensation

**Sagas don't provide:**
- **Isolation:** Intermediate states are visible
- **Atomicity in face of failures:** Compensation may fail

### Isolation Problems

**Dirty reads:**
```
Saga: Transfer $100 from A to B
T1: Deduct $100 from A (completed)
T2: Add $100 to B (pending)

Meanwhile:
Another transaction reads A → sees deducted amount
Saga fails, compensates → adds $100 back to A
Other transaction saw incorrect intermediate state
```

**Lost updates:**
```
Saga 1: Update inventory quantity to 10
Saga 2: Concurrently updates quantity to 15

Both read quantity=20
Saga 1 writes 10
Saga 2 writes 15
Saga 1's update lost
```

**Non-repeatable reads:**
```
Transaction reads inventory=10
Saga modifies inventory=5
Transaction reads again, sees inventory=5
Different value on second read
```

### Isolation Solutions

**Semantic locks:**
- Application-level locking
- Flag records as "being updated"
- Other transactions check flag

**Pessimistic locking:**
- Lock resources in first step
- Hold locks until saga completes
- Reduces concurrency

**Optimistic locking:**
- Use version numbers
- Check version hasn't changed before update
- Retry if version changed

**Commutative updates:**
- Design operations to be order-independent
- Example: increment/decrement rather than set value

**Reread and verify:**
- Reread values before final commit
- Verify values haven't changed
- Retry if changed

### Compensating Transactions

**Requirements:**
- **Idempotent:** Can be retried safely
- **Eventually succeed:** Must not fail permanently
- **Undo semantic effect:** Not necessarily undo exact state changes

**Example: Refund payment**
```
Forward: Charge $100 from credit card
Compensate: Refund $100 to credit card (not undo the charge)

Semantic: Customer has $100 again (not same transaction state)
```

**Challenges:**
- Some operations hard to compensate (sent email, called external API)
- Compensation may fail (network issues, service down)
- Must retry compensation until succeeds

**Design principle:** Make compensating transactions as simple and reliable as possible.

---

## Idempotency

### Why Idempotency Matters

**Distributed systems reality:**
- Messages may be delivered multiple times
- Retries on failures
- Network duplicates
- Saga compensation may retry

**Non-idempotent operations cause problems:**
- Charge customer twice
- Create duplicate orders
- Send duplicate notifications

**Idempotent operations can be safely retried.**

### Naturally Idempotent Operations

**Setting absolute values:**
```
Set account balance to $100
Retry: Still $100 (idempotent)
```

**DELETE operations:**
```
Delete record with ID=123
Retry: Record still deleted (idempotent)
```

**GET operations:**
```
Read data (no state change)
Retry: Same result (idempotent)
```

### Making Operations Idempotent

**Idempotency keys:**

Client provides unique key for operation:
```
POST /payments
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
{
  "amount": 100,
  "currency": "USD"
}
```

Server logic:
1. Check if key seen before
2. If yes, return cached result
3. If no, process request and cache result with key
4. Store key-result mapping for 24-48 hours

**Idempotency key generation:**
- UUID v4 (random)
- Hash of request parameters
- Combination of user ID + operation + timestamp

**Storage:**
- Database table (key → result)
- Redis/Memcached (key → result with TTL)

**Database constraints:**

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  amount DECIMAL NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX idx_idempotency
ON payments(user_id, idempotency_key);
```

Duplicate requests violate unique constraint → rejected.

**State machines:**

```
Order states: draft → pending_payment → paid → shipped

Operation: Mark as paid
- If state = pending_payment, transition to paid ✓
- If state = paid, no-op (already paid) ✓ (idempotent)
- If state = shipped, error (invalid transition)
```

**Conditional updates:**

```sql
UPDATE orders
SET status = 'paid'
WHERE id = 123 AND status = 'pending_payment';
```

If already paid, UPDATE affects 0 rows → idempotent.

**Versioning (optimistic locking):**

```sql
UPDATE orders
SET status = 'paid', version = version + 1
WHERE id = 123 AND version = 5;
```

Retry fails if version already incremented → prevents duplicate updates.

### Idempotency at Scale

**Key distribution:**
- Must check idempotency across all instances
- Use shared storage (Redis, database)
- Or use consistent hashing to route same keys to same instance

**Key expiration:**
- Can't store keys forever
- Typical TTL: 24-48 hours
- After expiration, same key is treated as new operation

**Performance:**
- Idempotency check adds latency
- Cache hot keys for performance
- Consider async idempotency check for non-critical operations

---

## Transaction Patterns

### Try-Confirm/Cancel (TCC)

**Three phases:**
1. **Try:** Reserve resources, don't commit
2. **Confirm:** Commit reservation (if all try succeed)
3. **Cancel:** Release reservation (if any try fails)

**Example:**
```
Try:
- Reserve $100 in account A
- Reserve inventory for product X

Confirm (all try succeeded):
- Deduct $100 from account A
- Deduct 1 from inventory X

Cancel (any try failed):
- Release $100 reservation in account A
- Release inventory reservation for product X
```

**Characteristics:**
- More complex than sagas
- Better isolation (resources reserved)
- Requires service support for try/confirm/cancel

### Best-Effort Transactions

**Attempt operations, accept failures.**

**Pattern:**
1. Attempt all operations
2. If some fail, log and continue
3. Background process retries failures
4. Eventually reaches consistent state

**Use when:**
- Perfect consistency not required
- User doesn't need immediate confirmation
- Operations can be retried indefinitely

**Example:**
- Analytics updates (eventual consistency acceptable)
- Notification sending (retry until delivered)

### Event Sourcing

**Store events as source of truth, not current state.**

**Pattern:**
1. Store immutable event log
2. Replay events to derive current state
3. Compensation = new event (not delete/modify)

**Advantages:**
- Complete audit trail
- Time travel (replay to any point)
- Natural compensation model (add compensating event)

**Disadvantages:**
- Complex to implement
- Event schema evolution challenges
- Replay can be slow

---

## Practical Considerations

### Choosing a Pattern

**Use 2PC when:**
- Services in same datacenter
- Low latency critical
- Strong consistency required
- Small number of participants

**Use sagas when:**
- Cross-service transactions
- Microservices architecture
- Long-running operations
- External services involved

**Use TCC when:**
- Need better isolation than sagas
- All services can implement try/confirm/cancel
- Performance overhead acceptable

**Use best-effort when:**
- Eventual consistency acceptable
- Operations naturally retryable
- User doesn't need immediate confirmation

### Saga Implementation

**Orchestration tools:**
- Temporal/Cadence (workflow orchestration)
- Camunda (BPMN workflow engine)
- Custom orchestrator service

**State persistence:**
- Orchestrator must persist saga state
- Enables recovery from orchestrator failures
- Database or durable workflow engine

**Timeout handling:**
- Set timeouts for each step
- If timeout, execute compensation
- Don't wait indefinitely for responses

**Compensation failures:**
- Compensation can fail
- Must retry until succeeds
- Exponential backoff
- Alert if compensation consistently fails

### Testing Distributed Transactions

**Happy path testing:**
- All steps succeed
- Verify end-to-end correctness

**Failure scenarios:**
- Each step fails
- Verify compensation executes correctly
- Verify final state is consistent

**Chaos testing:**
- Inject random failures
- Network partitions
- Service crashes during transaction
- Verify system recovers correctly

### Monitoring

**Track saga metrics:**
- Success rate
- Failure rate by step
- Compensation rate
- Duration (p50, p95, p99)

**Alert on:**
- High failure rate
- Compensation failures
- Long-running sagas
- Stuck sagas (not progressing)

### Documentation

**Document transaction boundaries:**
- Which operations are atomic
- Which use sagas
- Compensation logic for each step
- Expected behavior during failures

**Runbooks:**
- How to identify stuck sagas
- How to manually compensate
- How to resume failed sagas
- Emergency procedures
