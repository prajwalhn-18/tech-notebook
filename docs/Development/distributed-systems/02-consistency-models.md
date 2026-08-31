---
sidebar_position: 2
---

# Consistency Models and Eventual Consistency

Understanding the spectrum of consistency models and the practical reality of eventual consistency in distributed systems.

---

## Table of Contents

1. [Consistency Model Spectrum](#consistency-model-spectrum)
2. [Strong Consistency Models](#strong-consistency-models)
3. [Weak Consistency Models](#weak-consistency-models)
4. [Eventual Consistency](#eventual-consistency)
5. [Conflict Resolution](#conflict-resolution)
6. [Read and Write Patterns](#read-and-write-patterns)
7. [Consistency in Practice](#consistency-in-practice)

---

## Consistency Model Spectrum

### The Hierarchy

Consistency models form a spectrum from strongest to weakest:

**Strongest (Most Expensive):**
1. Linearizability (Strict Consistency)
2. Sequential Consistency
3. Causal Consistency
4. Eventual Consistency
5. Weak Consistency (No Guarantees)
**Weakest (Least Expensive)**

Stronger consistency provides better guarantees but requires more coordination and has higher latency.

### Consistency vs Performance Trade-off

**Strong consistency:**
- Easier to reason about (behaves like single machine)
- Higher latency (coordination overhead)
- Lower throughput (sequential operations)
- Lower availability (requires majority)

**Weak consistency:**
- Harder to reason about (must handle conflicts)
- Lower latency (less coordination)
- Higher throughput (concurrent operations)
- Higher availability (works during partitions)

**Choose based on requirements, not preference.**

### Consistency and Scale

As systems scale:
- More nodes mean more coordination
- Geographic distribution increases latency
- Network partitions become more likely
- Strong consistency becomes prohibitively expensive

**Large-scale systems inevitably move toward eventual consistency.**

---

## Strong Consistency Models

### Linearizability

**Definition:** Strongest consistency model. System appears as if there's only one copy of data, and all operations occur atomically at some point between invocation and response.

**Guarantee:** Operations have total order that respects real-time ordering.

**Example:**
```
Timeline:
[--------write(X=1)--------]     (completes at t1)
                   [---read(X)---] → returns 1 (happens after t1)

Read must return 1 or later value, never older value.
```

**Characteristics:**
- Reads always see most recent write
- Operations appear instantaneous
- Strong real-time guarantees

**Cost:**
- Requires consensus protocol (Raft, Paxos)
- High latency (multiple round trips)
- Reduced availability (requires majority)

**Use cases:**
- Distributed locks
- Leader election
- Configuration management
- Coordination services (ZooKeeper, etcd)

### Sequential Consistency

**Definition:** Operations appear to execute in some sequential order, consistent with program order on each process.

**Weaker than linearizability:** No real-time ordering guarantees.

**Example:**
```
Process 1: write(X=1), write(X=2)
Process 2: read(X) → 2, read(X) → 2  ✓ Valid (sequential)
Process 2: read(X) → 1, read(X) → 2  ✓ Valid (saw both writes)
Process 2: read(X) → 2, read(X) → 1  ✗ Invalid (violates order)
```

**Characteristics:**
- Preserves program order per process
- No global time ordering
- Simpler than linearizability

**Cost:**
- Still requires coordination
- Moderate latency overhead

**Use cases:**
- Replicated state machines
- Distributed snapshots

### Causal Consistency

**Definition:** Causally related operations seen in same order by all processes. Concurrent operations may be seen in different orders.

**Causality:** If operation A might have caused operation B, all processes must see A before B.

**Example:**
```
Alice: write(X=1)  →  write(Y=2) (Y depends on X)
Bob: read(X) → 1, read(Y) → 2  ✓ (sees cause before effect)
Bob: read(X) → 0, read(Y) → 2  ✗ (sees effect without cause)

Carol: write(Z=3) (concurrent with Alice's writes)
Bob might see: X=1, Y=2, Z=3 or Z=3, X=1, Y=2 (both valid)
```

**Characteristics:**
- Preserves causality
- Allows concurrent operations to be reordered
- Weaker than sequential consistency

**Implementing causality:**
- Vector clocks
- Lamport timestamps
- Dependency tracking

**Cost:**
- Moderate overhead (tracking causality)
- Better performance than sequential consistency

**Use cases:**
- Social media (comments depend on posts)
- Collaborative editing
- Email threads

### Read-Your-Writes Consistency

**Definition:** A process reads what it wrote, but may not see others' writes immediately.

**Guarantee:** Your own writes are immediately visible to you.

**Example:**
```
User1: write(profile=X)
User1: read(profile) → X ✓ (sees own write)
User2: read(User1.profile) → old value (may not see User1's write yet)
```

**Characteristics:**
- Provides good user experience
- Users don't see their actions "disappear"
- Doesn't guarantee seeing others' writes

**Implementation:**
- Read from same node you wrote to
- Or use session tokens to route reads
- Or use versioning to request minimum version

**Use cases:**
- User profiles
- Settings/preferences
- Any user-facing updates

### Monotonic Reads

**Definition:** If a process reads value X, subsequent reads return X or later values, never older.

**Guarantee:** Time doesn't go backward from reader's perspective.

**Example:**
```
read(X) → 5
read(X) → 7  ✓ (moved forward)
read(X) → 7  ✓ (same value)
read(X) → 3  ✗ (went backward, violates monotonic reads)
```

**Implementation:**
- Sticky sessions (read from same replica)
- Version numbers (require minimum version)
- Read-after-write consistency

**Use cases:**
- Caching
- News feeds
- Message threads

---

## Weak Consistency Models

### Eventual Consistency

**Definition:** If no new updates, all replicas eventually converge to the same value.

**No guarantee when convergence happens.**

**Characteristics:**
- Very weak guarantees
- Can return arbitrarily stale data
- Will eventually be consistent
- No bound on staleness

**Advantages:**
- High availability
- Low latency
- Works during partitions
- Scales well

**Challenges:**
- Application must handle inconsistency
- Users may see stale data
- Conflicting updates possible

Covered in detail below.

### Best-Effort Consistency

**Definition:** System tries to provide consistency but makes no guarantees.

**Example:** UDP-based systems, gossip protocols.

**Use cases:**
- Metrics/monitoring (approximate values acceptable)
- Logging (some loss acceptable)
- Real-time video (dropped frames acceptable)

---

## Eventual Consistency

### How It Works

**Write propagation:**
1. Write accepted on one node
2. Acknowledgment returned immediately
3. Write asynchronously propagated to other nodes
4. Eventually all nodes have the write

**No coordination during writes → fast writes, high availability.**

### Convergence Time

**Factors affecting convergence:**
- Network latency between nodes
- Replication load
- System health
- Number of replicas

**Typical convergence times:**
- Same datacenter: milliseconds to seconds
- Cross-region: seconds to minutes
- Under load: may be longer

**No upper bound guaranteed.**

### Conflicts

**Conflicting writes:**
```
Time  Node A    Node B    Conflict?
0     X=5       X=5       No
1     X=10      X=5       Diverged
2     X=10      X=20      Conflict! (both modified X)
3     X=?       X=?       Must resolve conflict
```

Both nodes think they have the latest value. Conflict resolution needed.

### Detecting Conflicts

**Version numbers:**
```
Write to A: X=10, version=2
Write to B: X=20, version=2

Both have version 2 but different values → conflict detected.
```

**Vector clocks:**
```
Node A: {A:2, B:1} → knows about 2 ops from A, 1 from B
Node B: {A:1, B:2} → knows about 1 op from A, 2 from B

Neither vector dominates → concurrent writes → conflict.
```

**Last-modified timestamps:**
```
Node A: X=10, modified=10:00:01.234
Node B: X=20, modified=10:00:01.567

B's timestamp later → B wins (last-write-wins strategy).
```

### Conflict Resolution Strategies

**Last-Write-Wins (LWW):**
- Use timestamp to determine winner
- Simple but loses data
- Common in Cassandra, DynamoDB

**Example:**
```
A: X=10, timestamp=100
B: X=20, timestamp=150
Result: X=20 (B wins, A's write lost)
```

**Application-level resolution:**
- Return both versions to application
- Application decides how to merge
- Preserves all data but complex

**Example:**
```
Shopping cart:
A: cart=[item1, item2]
B: cart=[item2, item3]
Resolution: cart=[item1, item2, item3] (union)
```

**CRDTs (Conflict-Free Replicated Data Types):**
- Data structures with built-in conflict resolution
- Mathematically guarantee convergence
- No application logic needed

**Examples:**
- G-Counter (grow-only counter)
- PN-Counter (increment/decrement counter)
- G-Set (grow-only set)
- OR-Set (add/remove set)

**Multi-value:**
- Keep all conflicting values
- Let user choose
- Common in Riak

**Example:**
```
Conflict detected: profile_name has two values
- "John Smith" (version A)
- "John Doe" (version B)
Present both to user, let them pick.
```

### Read Repair

**Problem:** Replicas may have different values even after convergence time.

**Read repair:** On read, check multiple replicas and repair inconsistencies.

**Process:**
1. Read from multiple replicas
2. Compare values and versions
3. If mismatch, determine correct value
4. Write correct value to stale replicas

**Advantages:**
- Fixes inconsistencies lazily
- No extra write overhead
- Works well for read-heavy workloads

**Disadvantages:**
- Slower reads (query multiple replicas)
- Doesn't help write-heavy workloads

### Anti-Entropy

**Problem:** Replicas can diverge permanently without intervention.

**Anti-entropy:** Background process that synchronizes replicas.

**Mechanisms:**
- Merkle trees (efficient comparison of large datasets)
- Hash-based comparison
- Gossip protocols

**Process:**
1. Periodically compare replica states
2. Identify differences
3. Synchronize missing or divergent data

**Cassandra's approach:**
- Maintain Merkle tree per table
- Periodically run repair
- Compare tree hashes to find differences

### Monitoring Staleness

**Track consistency metrics:**
- Replication lag (time behind primary)
- Divergence rate (how often conflicts occur)
- Convergence time (time to consistent state)

**Example metrics:**
```
replication_lag_ms: 150
conflicts_per_minute: 5
convergence_time_p99_ms: 2000
```

**Alert when:**
- Replication lag exceeds threshold (e.g., 5 seconds)
- Conflict rate increases significantly
- Convergence time degrades

---

## Conflict Resolution

### Designing for Eventual Consistency

**Idempotent operations:**
- Operations that can be safely retried
- Multiple applications have same effect as one

**Example:**
```
Set balance to $100 (idempotent)
vs
Add $10 to balance (not idempotent)
```

**Commutative operations:**
- Order doesn't matter
- A then B equals B then A

**Example:**
```
Add item1 to cart, add item2 to cart (commutative)
vs
Apply 10% discount, apply $5 discount (not commutative)
```

**Associative operations:**
- Grouping doesn't matter
- (A + B) + C equals A + (B + C)

**Example:**
```
Counter increments (associative)
Max value (associative)
```

### CRDTs in Depth

**G-Counter (Grow-Only Counter):**
```
Each node maintains its own count.
Read: Sum all counts.
Increment: Increment own count.

Node A: {A:5, B:3} → sum = 8
Node B: {A:5, B:3} → sum = 8

After A increments:
Node A: {A:6, B:3} → sum = 9

Merge: Take max of each node's count.
```

**OR-Set (Observed-Remove Set):**
```
Track (element, unique_id) pairs.
Add: Add (element, new_unique_id).
Remove: Remove all pairs with element.

Node A: {("apple", id1)}
Node B: {("apple", id1)}

A adds apple again: {("apple", id1), ("apple", id2)}
B removes apple: {}

Merge: Union of both sets → {("apple", id2)}
(B only removed id1, not id2)
```

### Timestamps and Clocks

**Problems with wall-clock time:**
- Clocks drift
- Clocks can go backward (NTP adjustments)
- No global time in distributed systems

**Logical clocks (Lamport timestamps):**
- Increment on every operation
- On receive message, take max(local, message) + 1
- Provides partial ordering

**Vector clocks:**
- Each node tracks its own counter
- Also tracks counters from other nodes
- Can detect concurrent updates

**Hybrid logical clocks:**
- Combine physical time with logical counters
- Provides time-like properties with logical guarantees

---

## Read and Write Patterns

### Quorum Reads and Writes

**Configuration:**
- N = total replicas
- W = write quorum (nodes that must acknowledge write)
- R = read quorum (nodes queried for read)

**Consistency guarantee:**
If W + R > N, reads are consistent (will see latest write).

**Examples:**
```
N=3, W=2, R=2 → W+R=4 > 3 → Consistent
N=3, W=1, R=3 → W+R=4 > 3 → Consistent
N=3, W=1, R=1 → W+R=2 < 3 → Eventually consistent
```

**Trade-offs:**
- Higher W: Slower writes, more durable
- Higher R: Slower reads, more consistent
- Lower W, R: Faster but less consistent

### Sloppy Quorum

**Problem:** During partition, may not reach W nodes.

**Sloppy quorum:** Accept writes on any W nodes (even ones not normally responsible).

**Process:**
1. Write to any W available nodes (including "handoff" nodes)
2. Mark write as "hinted handoff"
3. When partition heals, transfer data to correct nodes

**Advantage:** Higher availability during partitions.

**Disadvantage:** Temporarily inconsistent (until handoff completes).

### Read/Write Patterns

**Write-heavy workload:**
- W=1 (fast writes)
- R=N (read all replicas for consistency)

**Read-heavy workload:**
- W=N (write to all replicas)
- R=1 (fast reads, already consistent)

**Balanced:**
- W=R=quorum (balance of consistency and performance)

---

## Consistency in Practice

### Designing for Weak Consistency

**Strategies:**

**Version display:**
```
Show users: "Last updated 5 minutes ago"
Set expectations about freshness.
```

**Optimistic UI:**
```
Update UI immediately (assume success).
Show "Saving..." until confirmed.
Revert if write fails.
```

**Conflict notification:**
```
"Your change conflicts with recent update.
Would you like to overwrite or merge?"
```

**Grace periods:**
```
Allow edit for 5 minutes.
After 5 minutes, conflicts less likely (most replicas updated).
```

### Testing Consistency

**Consistency tests:**
- Inject network partitions
- Verify convergence time
- Test conflict resolution
- Measure staleness

**Chaos engineering:**
- Randomly partition nodes
- Delay messages
- Drop messages
- Verify system behavior

### Monitoring

**Key metrics:**
- Staleness: How old is data?
- Conflict rate: How often do conflicts occur?
- Convergence time: How long until consistent?
- Repair success rate: How often does repair work?

### Documentation

**Document consistency guarantees:**
- Which data has strong consistency?
- Which has eventual consistency?
- Expected staleness windows
- Conflict resolution strategies

**User communication:**
- Set user expectations about consistency
- Explain why they might see stale data
- Provide freshness indicators

### Migration Strategies

**Moving from strong to eventual consistency:**

**Phase 1:** Maintain strong consistency, measure staleness if it were eventual.

**Phase 2:** Implement conflict resolution logic, test thoroughly.

**Phase 3:** Roll out eventual consistency gradually (percentage of traffic).

**Phase 4:** Monitor conflicts and staleness, adjust as needed.

**Phase 5:** Remove strong consistency mechanisms if successful.
