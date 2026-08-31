---
sidebar_position: 5
---

# Versioning, Compatibility, and Distributed Transactions

Understanding API versioning strategies, maintaining backward compatibility, and managing transactions across microservices.

---

## Table of Contents

1. [API Versioning](#api-versioning)
2. [Backward Compatibility](#backward-compatibility)
3. [Schema Evolution](#schema-evolution)
4. [Distributed Transactions](#distributed-transactions)
5. [Saga Pattern](#saga-pattern)
6. [Event Sourcing and CQRS](#event-sourcing-and-cqrs)
7. [Data Consistency Patterns](#data-consistency-patterns)
8. [Migration Strategies](#migration-strategies)

---

## API Versioning

### Why Version APIs

APIs are contracts between services. Changes can break consumers. Versioning allows:
- Introducing breaking changes without breaking existing consumers
- Supporting old and new consumers simultaneously
- Gradual migration to new versions
- Clear communication about changes

### URI Versioning

Version in the URL path:
- /v1/users
- /v2/users
- /v3/users

**Advantages:**
- Explicit and visible
- Easy to route different versions to different implementations
- Simple to understand

**Disadvantages:**
- URLs are resource identifiers—version isn't part of resource identity
- Caching complications
- Multiple URLs for same resource

**Use when:** You need clear, explicit versioning and routing is important.

### Header Versioning

Version in Accept or custom header:
```
Accept: application/vnd.myapi.v1+json
X-API-Version: 2
```

**Advantages:**
- Clean URLs
- Version not part of resource identifier
- Follows REST principles better

**Disadvantages:**
- Less visible
- Harder to test (can't just click a link)
- Routing is more complex

**Use when:** RESTful principles are important and you have sophisticated clients.

### Media Type Versioning

Version in media type:
```
Accept: application/vnd.myapi+json;version=1
```

**Advantages:**
- Follows REST principles
- Content negotiation built into HTTP

**Disadvantages:**
- Complex media type strings
- Not as common or well-understood

**Use when:** You're strictly following REST principles.

### Query Parameter Versioning

Version as query parameter:
- /users?version=1
- /users?api-version=2

**Advantages:**
- Simple to implement
- Easy to test
- Optional parameter allows defaults

**Disadvantages:**
- Query parameters are for filtering, not versioning
- Can be accidentally omitted
- Caching complications

**Use when:** You want simplicity and don't need strict REST compliance.

### Versioning Strategy Selection

**Factors to consider:**
- Team familiarity
- Client capabilities
- Routing requirements
- REST principles importance
- Tooling support

Most organizations use URI versioning for simplicity and visibility, despite theoretical REST concerns.

### Version Lifecycle

**Introduction** - New version released. Old version supported.

**Deprecation** - Old version marked deprecated. Migration encouraged.

**Sunset** - Old version removed. Only new version supported.

**Timeline:** Provide ample time between phases. 6-12 months minimum for public APIs.

### Breaking vs Non-Breaking Changes

**Non-Breaking (Safe):**
- Adding new endpoints
- Adding optional fields to requests
- Adding fields to responses
- Adding optional headers
- Relaxing validations

**Breaking (Unsafe):**
- Removing endpoints
- Removing fields from responses
- Adding required fields to requests
- Changing field types
- Changing error codes
- Stricter validations

Avoid breaking changes when possible. When necessary, introduce new version.

---

## Backward Compatibility

### Compatibility Definition

Backward compatibility means new service version works with old consumers without changes.

**Backward Compatible:** Old clients work with new service.

**Forward Compatible:** New clients work with old service.

**Two-Way Compatible:** Both directions work.

### Designing for Compatibility

**Additive Changes Only** - Add new fields, don't remove old ones. Mark old fields deprecated.

**Optional Fields** - New fields should be optional. Existing clients don't send them.

**Default Values** - Provide sensible defaults for optional fields.

**Ignore Unknown Fields** - Clients should ignore fields they don't understand. Enables adding fields without breaking clients.

**Extensibility** - Design APIs with extension in mind. Use extensible formats (JSON allows adding fields).

### Expansion and Contraction

Pattern for evolving schemas:

**Expansion Phase:**
1. Add new field alongside old field
2. Service writes both fields
3. Service reads from both fields (prefer new)
4. Deploy new service

**Contraction Phase:**
5. Update clients to use new field
6. Verify all clients migrated
7. Remove old field from service
8. Deploy updated service

This ensures zero-downtime transitions.

### Versioning Responses

Include version information in responses:
```json
{
  "version": "2.0",
  "data": {...}
}
```

Clients can handle responses differently based on version.

### Deprecation Process

**Announce Early** - Communicate deprecation well in advance (6-12 months).

**Provide Migration Guide** - Document how to migrate to new version.

**Add Deprecation Warnings** - Return warnings in responses from deprecated endpoints.

**Monitor Usage** - Track deprecated endpoint usage. Contact remaining users.

**Sunset Date** - Set firm date for removal. Stick to it unless major blockers.

**Remove** - Actually remove deprecated endpoints. Don't leave them indefinitely.

### Client Responsibility

Clients should be resilient:
- Ignore unknown fields
- Handle optional fields being absent
- Don't rely on undocumented behavior
- Expect responses to have additional fields
- Handle graceful degradation

### Semantic Versioning

Use semantic versioning for libraries and internal services:
- Major: Breaking changes (1.0.0 → 2.0.0)
- Minor: New features, backward compatible (1.0.0 → 1.1.0)
- Patch: Bug fixes, backward compatible (1.0.0 → 1.0.1)

This communicates impact of changes clearly.

---

## Schema Evolution

### Schema Definition

Define schemas explicitly:
- OpenAPI (Swagger) for REST APIs
- Protocol Buffers for gRPC
- GraphQL schema for GraphQL
- JSON Schema for JSON payloads
- Avro for event streams

Explicit schemas enable validation and evolution strategies.

### Schema Registry

Centralized registry for schemas:
- Stores schema versions
- Validates schema compatibility
- Enables schema evolution checks
- Provides schema documentation

**Technologies:** Confluent Schema Registry, AWS Glue Schema Registry.

### Compatibility Modes

**Backward Compatibility** - New schema can read data written with old schema.

**Forward Compatibility** - Old schema can read data written with new schema.

**Full Compatibility** - Both backward and forward compatible.

**None** - No compatibility guarantees. Breaking changes allowed.

Choose mode based on requirements. Full compatibility is safest but most restrictive.

### Protocol Buffers Evolution

Protocol Buffers handle evolution well:

**Rules:**
- Don't change field numbers (they're the identifier)
- Don't change field types
- Don't remove required fields
- Can add optional fields
- Can remove optional fields (mark reserved)
- Can add repeated fields

Following these rules maintains compatibility.

### JSON Schema Evolution

JSON is flexible but requires discipline:

**Safe Changes:**
- Add new optional properties
- Remove optional properties (if consumers ignore unknowns)
- Make required properties optional (with defaults)
- Relax validations (remove restrictions)

**Unsafe Changes:**
- Remove required properties
- Change property types
- Make optional properties required
- Add stricter validations

### Avro Evolution

Avro is designed for schema evolution:

**Reader Schema** - Schema used by consumer to read data.

**Writer Schema** - Schema used by producer to write data.

Avro resolves differences between schemas:
- Fields in writer schema but not reader schema are ignored
- Fields in reader schema but not writer schema use default values

This enables independent evolution of producers and consumers.

### Event Schema Evolution

Events persist forever. Schema evolution is critical:

**Version Events** - Include schema version in events.

**Store Schema with Event** - Self-describing events include schema.

**Schema Registry** - Events reference schema in registry by ID.

**Never Remove Event Types** - Old events may still be replayed. Support reading all historical event types.

---

## Distributed Transactions

### The Problem

Transactions in monoliths use ACID database transactions. All changes commit or rollback together.

In microservices, data is distributed. No single database transaction spans services. How to maintain consistency?

### ACID vs BASE

**ACID:**
- Atomicity: All or nothing
- Consistency: Valid state always
- Isolation: Transactions don't interfere
- Durability: Committed changes persist

**BASE:**
- Basically Available: System appears available even with failures
- Soft state: State may change without input (eventual consistency)
- Eventual consistency: System becomes consistent over time

Microservices typically use BASE model.

### Two-Phase Commit (2PC)

Traditional distributed transaction protocol:

**Phase 1 (Prepare):**
- Coordinator asks participants to prepare
- Participants lock resources and vote yes/no
- If all yes, proceed to phase 2

**Phase 2 (Commit/Abort):**
- Coordinator sends commit or abort
- Participants commit or rollback
- Release locks

**Problems:**
- Blocking: Locks held during coordination
- Coordinator is single point of failure
- Poor performance in distributed systems
- Not practical for microservices

### Three-Phase Commit (3PC)

Enhanced 2PC with non-blocking properties. Still impractical for microservices due to complexity and performance.

### Distributed Transaction Reality

Don't use distributed transactions in microservices. They don't scale and create tight coupling.

Instead:
- Use eventual consistency
- Saga pattern
- Event-driven coordination
- Idempotent operations
- Compensating transactions

---

## Saga Pattern

### Saga Fundamentals

A saga is a sequence of local transactions. Each service performs its transaction and publishes event. Next service reacts to event.

If a step fails, saga executes compensating transactions to undo previous steps.

### Example: Order Saga

1. Order Service creates order (status: pending)
2. Payment Service charges customer
3. Inventory Service reserves items
4. Shipping Service creates shipment
5. Order Service updates order (status: confirmed)

If any step fails, compensating transactions undo previous steps.

### Choreography-Based Saga

Services coordinate through events. No central coordinator.

**Flow:**
1. Order Service creates order, emits OrderCreated event
2. Payment Service listens, charges payment, emits PaymentProcessed event
3. Inventory Service listens, reserves inventory, emits InventoryReserved event
4. Shipping Service listens, creates shipment, emits ShipmentCreated event

**Advantages:**
- Simple for basic flows
- No single point of failure
- Loose coupling

**Disadvantages:**
- Difficult to understand overall flow
- Hard to test and debug
- Cyclic dependencies possible
- Complex error handling

### Orchestration-Based Saga

Central coordinator orchestrates saga steps.

**Flow:**
1. Client calls Saga Orchestrator
2. Orchestrator calls Payment Service
3. Orchestrator calls Inventory Service
4. Orchestrator calls Shipping Service
5. Orchestrator updates Order Service

**Advantages:**
- Clear flow and control
- Easy to understand and test
- Simpler error handling
- No cyclic dependencies

**Disadvantages:**
- Central orchestrator can be bottleneck
- Orchestrator has knowledge of all services
- More coupled architecture

### Compensating Transactions

When saga step fails, compensate previous steps:

1. Order created ✓
2. Payment charged ✓
3. Inventory reservation failed ✗

**Compensation:**
1. Refund payment
2. Cancel order

Compensating transactions must be:
- Idempotent (safe to retry)
- Eventually successful (can't fail permanently)

### Handling Failures

**Backward Recovery** - Compensate completed steps. Saga aborts.

**Forward Recovery** - Retry failed step until success. Saga completes (may take time).

Choose based on use case:
- Critical operations: Forward recovery (retry until success)
- Non-critical operations: Backward recovery (compensate and abort)

### Saga Isolation

Sagas don't have ACID isolation. Partial results visible to other transactions.

**Problems:**
- Dirty reads: Reading uncommitted changes
- Lost updates: Concurrent sagas overwrite changes
- Non-repeatable reads: Data changes between reads

**Solutions:**
- Semantic locks (application-level locking)
- Optimistic locking (version numbers)
- Pessimistic locking (database locks)
- Re-read and verify values
- Version-based ordering

### Saga Technologies

**Custom Implementation** - Build saga coordination in application code.

**Temporal/Cadence** - Workflow orchestration engines. Handle saga state, retries, compensation.

**Camunda** - BPM engine that can orchestrate sagas.

**Axon Framework** - CQRS/Event Sourcing framework with saga support.

---

## Event Sourcing and CQRS

### Event Sourcing

Store events as source of truth, not current state.

**Traditional:** Store current state in database.
- User: {id: 1, name: "John", email: "john@example.com", balance: 100}

**Event Sourcing:** Store events that happened.
- UserCreated(id: 1, name: "John", email: "john@example.com")
- DepositMade(id: 1, amount: 100)
- WithdrawalMade(id: 1, amount: 20)
- EmailChanged(id: 1, newEmail: "john.doe@example.com")

Current state derived by replaying events.

### Event Sourcing Benefits

**Complete Audit Trail** - Every change is recorded with timestamp and reason.

**Temporal Queries** - Query state at any point in time by replaying events up to that point.

**Event-Driven Integration** - Other services subscribe to events. Natural integration point.

**Debugging** - Reproduce bugs by replaying events.

**Analytics** - Rich event history for business intelligence.

### Event Sourcing Challenges

**Complexity** - More complex than CRUD operations.

**Event Schema Evolution** - Old events must be readable forever. Careful schema design needed.

**Querying** - Queries require replaying events. Slow for complex queries.

**Learning Curve** - Paradigm shift for developers used to CRUD.

**Storage Growth** - Events accumulate over time. Snapshot and archive old events.

### CQRS (Command Query Responsibility Segregation)

Separate models for writing (commands) and reading (queries).

**Command Side:**
- Handles writes
- Validates business rules
- Produces events
- May use event sourcing

**Query Side:**
- Handles reads
- Optimized for queries
- Eventually consistent with command side
- May use denormalized views

### CQRS Benefits

**Optimized Read and Write Models** - Design each for its specific purpose.

**Scalability** - Scale read and write sides independently.

**Multiple Read Models** - Create different projections for different query needs.

**Simplified Queries** - Denormalized views make queries simpler and faster.

### CQRS Challenges

**Complexity** - Two models instead of one.

**Eventual Consistency** - Query side lags behind command side.

**Synchronization** - Keep query models in sync with command side.

**More Code** - Separate models mean more code to maintain.

### When to Use Event Sourcing and CQRS

**Use when:**
- Audit trail is critical (compliance, financial systems)
- Complex business processes with compensation
- Event-driven architecture
- Temporal queries needed
- High read/write scalability needs different

**Don't use when:**
- Simple CRUD application
- Team lacks experience
- Immediate consistency required
- Domain is simple and unlikely to change

### Projection Management

Query models are projections of events.

**Building Projections:**
1. Consume events from event store
2. Update projection based on event
3. Store in query database

**Rebuilding Projections:**
- Delete projection
- Replay all events
- Rebuild from scratch

This enables fixing bugs in projections or adding new projections.

---

## Data Consistency Patterns

### Eventual Consistency

Changes propagate asynchronously. System becomes consistent eventually, not immediately.

**Example:** Order placed → Payment processed (5 seconds later) → Inventory reserved (10 seconds later)

Users see "pending" state until consistency achieved.

### Consistency Levels

**Strong Consistency** - Reads always return latest write. Achieved with distributed transactions or single database.

**Eventual Consistency** - Reads may return stale data briefly. Eventually all reads return latest write.

**Causal Consistency** - Causally related operations seen in order. Unrelated operations may be out of order.

**Read-Your-Writes Consistency** - User always sees their own writes. May not see other users' writes immediately.

### Idempotency

Operations can be repeated safely. Multiple identical requests have same effect as single request.

**Idempotent Operations:**
- Set value: set(x, 5) → Always results in x=5
- Delete: delete(x) → Multiple deletes have same effect
- GET requests (should not modify state)

**Non-Idempotent Operations:**
- Increment: increment(x) → Each call increases value
- Append: append(x, item) → Each call adds item
- POST requests (typically create new resources)

### Idempotency Keys

For non-idempotent operations, use idempotency keys:

**Client:**
1. Generate unique key (UUID)
2. Include key in request
3. Retry with same key if request fails

**Server:**
1. Check if key seen before
2. If yes, return cached response
3. If no, process request, cache response with key

This makes non-idempotent operations idempotent.

### Optimistic Locking

Assume conflicts are rare. Detect conflicts when they occur.

**Pattern:**
1. Read data with version number
2. Modify data locally
3. Write data with version check
4. If version changed, conflict detected. Retry.

```sql
UPDATE orders SET status = 'shipped', version = version + 1
WHERE id = 123 AND version = 5
```

If version is not 5, update fails. Retry transaction.

### Pessimistic Locking

Assume conflicts are common. Prevent conflicts with locks.

**Pattern:**
1. Acquire lock
2. Read and modify data
3. Write data
4. Release lock

Locks reduce concurrency but prevent conflicts.

### Distributed Locking

Locks across multiple services:

**Technologies:** Redis (Redlock), ZooKeeper, etcd, Consul

**Pattern:**
1. Acquire distributed lock with TTL
2. Perform operation
3. Release lock (or let TTL expire)

Use sparingly—distributed locks reduce scalability and increase coupling.

---

## Migration Strategies

### Strangler Fig Pattern

Gradually migrate functionality to new service. New requests routed to new service. Old requests to old service. Eventually old service fully replaced.

**Steps:**
1. Build new service with subset of functionality
2. Route new requests to new service
3. Gradually move more functionality to new service
4. Migrate remaining requests
5. Decommission old service

### Parallel Run

Run old and new implementations simultaneously. Compare results. Build confidence before cutover.

**Steps:**
1. Implement new service
2. Route requests to both old and new services
3. Use old service result
4. Compare old and new results
5. Fix discrepancies
6. Cut over to new service when results match

### Feature Flags for Migration

Use feature flags to control traffic between old and new implementations.

**Steps:**
1. Build new implementation
2. Deploy behind feature flag (off)
3. Enable for internal users (testing)
4. Enable for 1% of users (canary)
5. Gradually increase percentage
6. Enable for 100%
7. Remove old implementation and flag

### Data Migration

Migrating data is often the hardest part.

**Live Migration:**
1. Set up replication from old to new database
2. New writes go to both databases
3. Verify data consistency
4. Cut over reads to new database
5. Stop replication
6. Decommission old database

**Dual Writes:**
1. Application writes to both old and new databases
2. Application reads from old database
3. Verify consistency
4. Switch reads to new database
5. Stop writing to old database

### API Versioning for Migration

Support both old and new APIs during migration:
1. Deploy v2 API alongside v1
2. Migrate clients from v1 to v2
3. Deprecate v1
4. Remove v1

Use API gateway to route v1 and v2 requests appropriately.

### Zero-Downtime Migration

Essential for production systems:

**Requirements:**
- Maintain backward compatibility
- Support multiple versions simultaneously
- Gradual traffic shifting
- Quick rollback capability

**Techniques:**
- Blue-green deployment
- Canary releases
- Feature flags
- Database replication
- API versioning
