---
sidebar_position: 1
---

# CAP Theorem and Trade-offs

Understanding the fundamental impossibility result that shapes all distributed systems design decisions.

---

## Table of Contents

1. [The CAP Theorem](#the-cap-theorem)
2. [Consistency](#consistency)
3. [Availability](#availability)
4. [Partition Tolerance](#partition-tolerance)
5. [CAP Trade-offs](#cap-trade-offs)
6. [PACELC Extension](#pacelc-extension)
7. [Real-World Systems](#real-world-systems)
8. [Design Decisions](#design-decisions)

---

## The CAP Theorem

### The Theorem

The CAP theorem, proven by Eric Brewer, states that a distributed system can provide at most two of three guarantees:

**Consistency (C):** All nodes see the same data at the same time. Every read receives the most recent write.

**Availability (A):** Every request receives a response (success or failure). The system remains operational.

**Partition Tolerance (P):** The system continues operating despite network partitions. Messages between nodes may be lost or delayed.

**You cannot have all three simultaneously.**

### Why This Matters

CAP theorem is not theoretical—it's a practical constraint affecting every distributed system:
- Database choice
- API design
- Error handling
- User experience
- Business trade-offs

Understanding CAP helps you make informed trade-offs rather than hoping problems won't occur.

### The Proof (Simplified)

Consider a distributed system with two nodes:

**Normal operation (no partition):**
- Node A writes value X = 5
- Node B reads X → gets 5
- Both consistency and availability achieved

**Network partition occurs:**
- Client writes X = 10 to Node A
- Network partition prevents A from communicating with B
- Client reads from Node B

**Now you must choose:**

**Choice 1: Consistency**
- B doesn't have latest value
- B refuses to respond (unavailable)
- Consistency maintained, availability sacrificed

**Choice 2: Availability**
- B responds with stale value (X = 5)
- Availability maintained, consistency sacrificed

**You cannot have both during partition.**

### Misconceptions

**"CAP means pick 2 of 3"**
- Not quite. Partition tolerance is not optional in distributed systems.
- Reality: You must choose between consistency and availability during partitions.

**"CP means always consistent"**
- CP systems sacrifice availability during partitions, not always.
- During normal operation, they can be both consistent and available.

**"AP means no consistency"**
- AP systems sacrifice strong consistency, not all consistency.
- They typically offer eventual consistency.

---

## Consistency

### Strong Consistency (Linearizability)

**Definition:** After a write completes, all subsequent reads see that write or later writes.

**Guarantee:** System appears as if there is only one copy of data.

**Example:**
```
Time  Client1        Client2        Storage
0     write(X=5)     -             X=5
1     ack            -             X=5
2     -              read(X)       X=5
3     -              → returns 5   X=5
```

Client2 is guaranteed to see X=5 or later value, never stale value.

### Sequential Consistency

**Definition:** Operations appear to execute in some sequential order consistent with program order on each node.

**Weaker than linearizability:** No real-time guarantees.

**Example:**
```
Client1: write(X=1), write(X=2)
Client2: read(X) → 1, read(X) → 2  ✓ Valid
Client2: read(X) → 2, read(X) → 1  ✗ Invalid (violates order)
Client2: read(X) → 0, read(X) → 2  ✓ Valid (missed middle write)
```

### Causal Consistency

**Definition:** Causally related operations seen by all nodes in the same order. Concurrent operations may be seen in different orders.

**If A causes B, all nodes see A before B.**

**Example:**
```
Alice posts: "I'm getting married!"
Bob comments on Alice's post: "Congratulations!"

Everyone sees Alice's post before Bob's comment (causal).
Other unrelated posts can be seen in any order (concurrent).
```

### Eventual Consistency

**Definition:** If no new updates, eventually all nodes converge to same value.

**No guarantee when convergence happens.**

**Example:**
```
Time  Node A    Node B    Consistent?
0     X=5       X=5       Yes
1     X=10      X=5       No (diverged)
2     X=10      X=5       No (not synced)
3     X=10      X=10      Yes (converged)
```

---

## Availability

### Definition of Availability

**Availability:** Every request to a non-failing node receives a response.

**Key points:**
- Response must be in bounded time
- Response must be meaningful (not just "I don't know")
- Failing nodes are excluded

### High Availability

**Multiple nines:**
- 99% (two nines) = 3.65 days downtime/year
- 99.9% (three nines) = 8.76 hours downtime/year
- 99.99% (four nines) = 52.56 minutes downtime/year
- 99.999% (five nines) = 5.26 minutes downtime/year

Achieving high availability requires:
- Redundancy (no single point of failure)
- Fast failure detection
- Automatic failover
- Data replication

### Availability During Partitions

**CP System (sacrifices availability):**
- Detects partition
- Minority partition becomes unavailable
- Refuses to respond to maintain consistency
- Returns errors or timeouts

**AP System (sacrifices consistency):**
- Detects partition
- Both partitions remain available
- Both respond with potentially inconsistent data
- Resolve conflicts after partition heals

### Split Brain

When partition occurs and both sides think they're the only working system:

**Problem:**
- Both sides accept writes
- Conflicting data
- When partition heals, conflict resolution needed

**Prevention:**
- Quorum-based writes
- Leader election
- Fencing tokens

---

## Partition Tolerance

### What Is a Partition

**Network partition:** Network failure prevents communication between nodes.

**Causes:**
- Network switch failure
- Router failure
- Fiber cut
- Network congestion
- Misconfiguration

**Reality:** Partitions will happen. Not if, but when.

### Partition Detection

How nodes detect partitions:

**Heartbeats:** Nodes send periodic heartbeats. Missing heartbeats indicate partition.

**Timeout-based:** If no response within timeout, assume partition.

**Problem:** Can't distinguish between:
- Network partition
- Slow network
- Slow node
- Dead node

This ambiguity makes distributed systems hard.

### Partition Handling

**CP Systems:**
- Use quorum (majority rule)
- Minority partition becomes unavailable
- Majority partition continues operating

**AP Systems:**
- Both partitions continue operating
- Accept writes on both sides
- Resolve conflicts later (conflict-free replicated data types, last-write-wins, manual resolution)

---

## CAP Trade-offs

### CP Systems (Consistency + Partition Tolerance)

**Choose:** Strong consistency over availability during partitions.

**Behavior:**
- Normal operation: Available and consistent
- During partition: Unavailable to maintain consistency

**Use when:**
- Correctness is critical
- Stale data is unacceptable
- Short unavailability is tolerable

**Examples:**
- Banking systems (can't show wrong balance)
- Inventory systems (can't oversell)
- Ticket booking (can't double-book)

**Technologies:**
- Relational databases with replication (PostgreSQL in sync mode)
- Etcd, ZooKeeper
- HBase

### AP Systems (Availability + Partition Tolerance)

**Choose:** Availability over strong consistency during partitions.

**Behavior:**
- Normal operation: Available and eventually consistent
- During partition: Both partitions available, may return stale data

**Use when:**
- Availability is critical
- Temporary inconsistency is acceptable
- User experience matters more than perfect correctness

**Examples:**
- Social media feeds (stale posts acceptable)
- Shopping cart (stale items acceptable, validated at checkout)
- DNS (stale records acceptable)
- Content delivery (stale content acceptable)

**Technologies:**
- Cassandra, DynamoDB
- Riak
- CouchDB

### CA Systems (Consistency + Availability)

**In theory:** Consistent and available, but not partition tolerant.

**In practice:** Impossible in distributed systems. Networks partition.

**Single-node systems:**
- Traditional single-server databases
- Not distributed, so CAP doesn't apply
- If distributed, must handle partitions

---

## PACELC Extension

### PACELC Theorem

CAP theorem extended by Daniel Abadi:

**IF partition (P), choose availability (A) or consistency (C).**

**ELSE (no partition), choose latency (L) or consistency (C).**

### The Extension

CAP only addresses partition scenario. What about normal operation?

**Even without partitions, trade-off between consistency and latency exists.**

**Strong consistency requires coordination:**
- Synchronous replication
- Consensus protocols
- Waiting for acknowledgments

**This coordination adds latency.**

### PACELC Examples

**PA/EL (Prioritize availability and latency):**
- DynamoDB, Cassandra
- Choose availability during partitions
- Choose low latency during normal operation
- Eventual consistency

**PC/EC (Prioritize consistency):**
- Traditional databases, ZooKeeper
- Choose consistency during partitions (unavailable)
- Choose consistency during normal operation (higher latency)

**PA/EC (Mixed):**
- MongoDB (depends on configuration)
- Available during partitions but
- Strong consistency during normal operation

### Tunable Consistency

Some systems offer tunable consistency:

**Cassandra:**
```
Write: W nodes must acknowledge
Read: R nodes must respond
If W + R > N (total nodes), guaranteed consistency
```

**Example:**
- N = 3 nodes
- W = 2 (write acknowledged by 2 nodes)
- R = 2 (read from 2 nodes)
- W + R = 4 > 3 → Consistent reads

Trade-off: Higher W or R increases latency.

---

## Real-World Systems

### PostgreSQL (CP)

**Default configuration:**
- Synchronous replication
- Strong consistency
- During partition: minority unavailable

**Trade-off:** Lower availability for consistency.

### Cassandra (AP)

**Default configuration:**
- Asynchronous replication
- Eventual consistency
- During partition: all nodes remain available

**Trade-off:** Temporary inconsistency for availability.

### MongoDB (Tunable)

**Configuration options:**
- Single-master with read preference
- Can configure CP (strong consistency) or AP (eventual consistency)

**Write concern:**
- w=1: Acknowledged by primary (faster, less safe)
- w=majority: Acknowledged by majority (slower, safer)

**Read preference:**
- primary: Read from primary (consistent)
- secondary: Read from secondary (faster, potentially stale)

### DynamoDB (AP)

**Eventually consistent by default:**
- All replicas eventually converge
- Low latency
- High availability

**Strongly consistent reads available:**
- Opt-in per read
- Higher latency
- May be unavailable during partitions

### Redis (CP with async replication)

**Single master:**
- Writes go to master
- Replication is asynchronous
- During partition: writes to master only (if accessible)

**Sentinel for HA:**
- Detects master failure
- Promotes replica to master
- Brief unavailability during failover

---

## Design Decisions

### Choosing CP vs AP

**Choose CP when:**
- Financial transactions (no dirty reads)
- Inventory management (no overselling)
- Configuration management (no conflicting configs)
- Strong consistency required by business logic

**Choose AP when:**
- Social media (stale content acceptable)
- Caching (stale cache acceptable)
- Metrics/analytics (approximate values acceptable)
- User experience prioritized over perfect consistency

### Hybrid Approaches

**Different consistency for different data:**
- User profiles: AP (eventual consistency)
- Account balance: CP (strong consistency)
- Shopping cart: AP (eventually consistent)
- Order placement: CP (must be consistent)

**Geographic distribution:**
- Within region: CP (low latency, strong consistency)
- Cross-region: AP (high latency, eventual consistency)

### Business Trade-offs

**Understand business requirements:**
- What's the cost of showing stale data?
- What's the cost of being unavailable?
- What's the user experience impact?

**Example: E-commerce**
- Browsing: AP (availability matters)
- Checkout: CP (consistency matters)
- Order status: Eventual consistency acceptable

### Multi-Region Considerations

**Cross-region replication:**
- High latency (100ms+)
- Network partitions more likely
- Must choose AP (synchronous replication too slow)

**Conflict resolution:**
- Last-write-wins (simple but loses data)
- Vector clocks (complex but preserves causality)
- CRDTs (automatic conflict resolution)
- Application logic (custom resolution)

### Measuring Trade-offs

**Consistency:**
- Staleness duration
- Conflict rate
- Convergence time

**Availability:**
- Uptime percentage
- Request success rate
- Time to failover

**Latency:**
- p50, p95, p99 latency
- Cross-region latency
- Replication lag

### Evolving Requirements

Systems evolve:
- Start simple (single node)
- Add read replicas (eventual consistency)
- Add write scaling (partitioning, eventual consistency)
- Add multi-region (definitely eventual consistency)

**Each step trades consistency for scale.**

### Testing CAP Trade-offs

**Chaos engineering:**
- Simulate network partitions
- Verify system behavior matches expectations
- Test conflict resolution
- Measure impact on users

**Scenarios to test:**
- What happens during partition?
- How long until consistency restored?
- Are errors user-friendly?
- Can system recover automatically?

### Documentation

Document your CAP choices:
- Which systems are CP vs AP
- Consistency guarantees for each data type
- Expected behavior during partitions
- Conflict resolution strategies

This helps team understand system behavior and make appropriate decisions.
