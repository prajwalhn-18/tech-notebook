---
sidebar_position: 4
---

# Coordination Primitives: Locks and Leader Election

Understanding distributed locks, leader election, and race conditions in distributed systems.

---

## Table of Contents

1. [Distributed Locks](#distributed-locks)
2. [Leader Election](#leader-election)
3. [Race Conditions](#race-conditions)
4. [Consensus Algorithms](#consensus-algorithms)
5. [Coordination Services](#coordination-services)
6. [Practical Patterns](#practical-patterns)

---

## Distributed Locks

### Why Distributed Locks

**Need for coordination:**
- Ensure only one process modifies resource
- Prevent duplicate work
- Serialize access to shared state
- Coordinate distributed operations

**Cannot use local locks:**
- Processes on different machines
- No shared memory
- Need coordination service

### Lock Properties

**Safety:** At most one process holds lock at any time.

**Liveness:** System eventually makes progress (no deadlocks).

**Fault tolerance:** Lock continues working despite node failures.

**Additional desirable properties:**
- **Reentrant:** Same process can acquire lock multiple times
- **Fair:** Processes acquire lock in order of requests
- **Timeout:** Locks auto-release if holder crashes

### Lock Implementations

**Redis-based locking:**

Simple lock:
```
SET lock_key unique_value NX PX 30000

NX: Only set if not exists
PX 30000: Expire after 30 seconds
unique_value: Identify lock holder
```

Unlock:
```
if redis.get("lock_key") == unique_value:
  redis.del("lock_key")

Must check value to avoid releasing someone else's lock.
```

**Problem:** Single Redis instance isn't safe.
- Redis crashes → lock lost
- Network partition → split brain

**Redlock algorithm:**

Multiple Redis masters (typically 5):
```
1. Get current time
2. Try to acquire lock on all instances sequentially
3. If acquired majority (3 of 5) and time elapsed < lock validity:
   Lock acquired successfully
4. If failed, release all locks
```

Release:
```
Release on all instances (even ones we didn't acquire)
```

**Controversy:** Martin Kleppmann and others argue Redlock is unsafe. Prefer coordination services like ZooKeeper.

### ZooKeeper-based Locking

**Recipe:**
```
1. Create ephemeral sequential node: /locks/resource_123_0000001
2. Get children of /locks
3. If your node has lowest sequence number: acquired lock
4. If not, watch the node before yours
5. When that node deleted, retry step 2
```

**Properties:**
- Safe (no split brain)
- Fair (ordered by sequence number)
- Fault tolerant (ephemeral nodes deleted on disconnect)

**Example:**
```
Process A creates: /locks/resource_0000001
Process B creates: /locks/resource_0000002
Process C creates: /locks/resource_0000003

Process A has lowest → acquired lock
Process B watches 0000001
Process C watches 0000002

A releases → 0000001 deleted
B notified → B acquires lock
C still watches 0000002
```

### Fencing Tokens

**Problem:** Lock holder may think it has lock after it expired.

**Scenario:**
```
Process 1: Acquires lock (expires after 10s)
Process 1: Slow (GC pause, network delay)
Lock expires (10s passed)
Process 2: Acquires lock
Process 1: Wakes up, thinks it still has lock
Both processes think they have lock!
```

**Solution: Fencing tokens**

**Each lock acquisition gets monotonically increasing token:**
```
Process 1: Acquires lock, gets token=33
Process 2: Acquires lock, gets token=34

Storage system:
- Accepts write with token=34 ✓
- Rejects write with token=33 ✗ (older token)
```

**Implementation:**
```
Resource stores: last_accepted_token = 34

Process with token=33 tries to write:
if token <= last_accepted_token:
  reject (stale lock)
```

**Requirements:**
- Storage system must support token checking
- Tokens must be monotonically increasing
- No gaps allowed in token sequence

### Lock Timeouts

**Lock timeout:** Lock auto-releases after duration.

**Why necessary:**
- Holder crashes without releasing
- Holder stuck in infinite loop
- Network partition

**Choosing timeout:**
- Too short: Lock released while still needed
- Too long: Long wait if holder crashes

**Typical values:**
- Short operations: 5-30 seconds
- Long operations: 1-5 minutes
- Background jobs: 10-30 minutes

**Keep-alive (heartbeat):**
```
While holding lock:
  Every N seconds, extend lock timeout
  If operation takes longer, lock remains valid
```

**Implementation:**
```
Acquire lock with timeout=30s
Every 10s: extend timeout by 30s
If process crashes, lock expires in 30s
```

### Lock Granularity

**Coarse-grained locks:**
- Lock entire table/resource
- Simple but limits concurrency

**Fine-grained locks:**
- Lock individual records
- Better concurrency but more complex

**Row-level locking:**
```
lock_key = "order:" + order_id
Locks specific order, not all orders
```

**Partition locks:**
```
partition = hash(resource_id) % num_partitions
lock_key = "partition:" + partition
Reduces contention by partitioning
```

---

## Leader Election

### Why Leader Election

**Single leader needed for:**
- Coordinating distributed operations
- Serializing writes
- Assigning work to workers
- Managing cluster membership

**Cannot have multiple leaders:**
- Conflicting decisions
- Split-brain scenarios
- Inconsistent state

### Leader Election Requirements

**Safety:** At most one leader at any time.

**Liveness:** Eventually elect a leader (if majority available).

**Term/Epoch:** Each leader has unique identifier (term number).

**Lease-based:** Leadership is time-bounded, must renew.

### ZooKeeper Leader Election

**Recipe:**
```
1. All candidates create ephemeral sequential nodes: /election/candidate_XXXXXX
2. Get all children of /election
3. Candidate with lowest sequence number is leader
4. Other candidates watch the node before them
5. When leader node deleted, next candidate becomes leader
```

**Example:**
```
Node A creates: /election/candidate_0000001
Node B creates: /election/candidate_0000002
Node C creates: /election/candidate_0000003

Node A: I'm the leader (lowest sequence)
Node B: Watch candidate_0000001, I'm next in line
Node C: Watch candidate_0000002

Node A crashes → candidate_0000001 deleted
Node B notified → becomes leader
Node C now watches candidate_0000002
```

**Properties:**
- Deterministic (lowest sequence wins)
- Fair (first come, first served)
- No thundering herd (each watches only one node)

### Consensus-Based Leader Election

**Raft leader election:**

**Terms:** Each election cycle has unique term number.

**Process:**
```
1. Follower timeout (no heartbeat from leader)
2. Follower transitions to candidate
3. Increment term
4. Vote for self
5. Request votes from other nodes
6. If receive majority votes: become leader
7. Send heartbeats to establish authority
```

**Voting rules:**
- Each node votes for at most one candidate per term
- Vote for first candidate that requests vote
- Only vote if candidate's log is at least as up-to-date

**Election timeout:**
- Randomized (150-300ms typical)
- Prevents split votes
- Node with shortest timeout likely wins

**Heartbeats:**
- Leader sends periodic heartbeats
- Resets follower timeouts
- Prevents unnecessary elections

### Split Brain Prevention

**Split brain:** Multiple nodes think they're leader.

**Causes:**
- Network partition
- Slow leader (appears dead)
- Clock skew

**Prevention mechanisms:**

**Quorum:**
- Require majority votes to become leader
- At most one majority can exist
- Minority partition cannot elect leader

**Epochs/Terms:**
- Each leader has unique epoch number
- Higher epoch supersedes lower
- Nodes reject commands from stale leader

**Fencing:**
- Leader must prove it's current leader
- Use epoch numbers for fencing
- Storage rejects commands from old epoch

**Example:**
```
Leader A with epoch=5
Network partition
Node B thinks A is dead, starts election
Node B becomes leader with epoch=6

Partition heals
Node A tries to write with epoch=5
Storage rejects (epoch=6 is current)
Node A steps down
```

### Leader Lease

**Problem:** Leader may not realize it's no longer leader.

**Solution: Time-bounded leadership**

**Lease-based leadership:**
```
Leader acquires lease for duration T
Leader must renew lease before expiry
If lease expires, leader must step down
```

**Clock synchronization requirement:**
- Leader's clock drift < lease duration
- Use NTP for clock synchronization
- Typical lease: 10-30 seconds

**Safe operations:**
```
Check lease validity before each operation:
if now() < lease_expiry:
  perform operation
else:
  step down, don't perform operation
```

---

## Race Conditions

### What Are Race Conditions

**Race condition:** Outcome depends on timing/ordering of operations.

**In distributed systems, races are everywhere:**
- Network delays
- Concurrent operations
- Asynchronous communication

### Common Race Conditions

**Check-Then-Act:**
```
if balance >= 100:
  # Another process deducts here
  deduct(100)
  # Overdraft!
```

**Two processes check simultaneously, both deduct, balance goes negative.**

**Read-Modify-Write:**
```
value = read()
new_value = value + 1
write(new_value)
```

**Two processes read same value, both increment, one update lost.**

**Example:**
```
Process A: read() → 5
Process B: read() → 5
Process A: write(6)
Process B: write(6)

Final: 6 (should be 7, one increment lost)
```

**Double Execution:**
```
if not exists("processed_" + message_id):
  # Another process checks here
  process(message)
  mark_processed(message_id)
```

**Both processes see message as not processed, both process it.**

### Preventing Races

**Atomic operations:**
```
Use database atomic operations:
- INCR (Redis)
- UPDATE ... WHERE
- Compare-and-swap (CAS)
```

**Example:**
```sql
-- Atomic decrement with check
UPDATE accounts
SET balance = balance - 100
WHERE account_id = 123 AND balance >= 100;

If UPDATE affects 0 rows, insufficient balance.
```

**Locks:**
```
acquire_lock("account_123")
try:
  if balance >= 100:
    deduct(100)
finally:
  release_lock("account_123")
```

**Optimistic locking (versioning):**
```
Read: (balance=500, version=7)
Compute: new_balance=400

Write:
UPDATE accounts
SET balance=400, version=8
WHERE account_id=123 AND version=7;

If UPDATE affects 0 rows, version changed, retry.
```

**Idempotency:**
```
Use unique message ID:
if not exists_atomic("processed_" + message_id):
  process(message)

exists_atomic is single atomic operation (Redis SETNX).
```

**Distributed transactions:**
- Use 2PC or sagas
- Ensure all-or-nothing semantics

### Test-And-Set

**Atomic test-and-set operation:**
```
old_value = test_and_set(key, new_value)
if old_value == expected:
  success
else:
  conflict, retry
```

**Redis implementation:**
```
SET key new_value GET

Returns old value and sets new value atomically.
```

**Use case: Distributed flag**
```
if test_and_set("job_processing", "in_progress") == "idle":
  # We acquired the flag
  process_job()
  set("job_processing", "idle")
else:
  # Someone else processing
  return
```

### Linearizable Stores

**Linearizable storage guarantees:**
- Operations appear atomic
- Total order consistent with real time
- No race conditions if using linearizable operations

**Examples:**
- etcd (linearizable key-value store)
- ZooKeeper (linearizable operations)
- Strongly consistent databases

**Trade-off:** Higher latency for strong guarantees.

---

## Consensus Algorithms

### Paxos

**Classic consensus algorithm.**

**Guarantees:**
- Agre

ement: All participants agree on same value
- Validity: Agreed value was proposed by some participant
- Termination: Eventually reach decision (if majority available)

**Phases:**
1. **Prepare:** Proposer sends prepare request with proposal number
2. **Promise:** Acceptors promise not to accept lower proposal numbers
3. **Accept:** Proposer sends accept request with value
4. **Accepted:** Acceptors accept value

**Challenges:**
- Complex to understand
- Difficult to implement correctly
- Multiple rounds for fault tolerance

### Raft

**Consensus algorithm designed for understandability.**

**Components:**
- **Leader:** Handles all client requests
- **Followers:** Replicate leader's log
- **Candidates:** Compete during elections

**Log replication:**
```
1. Client sends command to leader
2. Leader appends to its log
3. Leader replicates to followers
4. When majority replicated, leader commits
5. Leader applies to state machine
6. Leader notifies followers to commit
```

**Properties:**
- Simpler than Paxos
- Strong leader (all writes through leader)
- Clear leader election algorithm

**Use cases:**
- etcd (Kubernetes coordination)
- Consul (service discovery)
- Distributed databases

### Practical Byzantine Fault Tolerance (PBFT)

**Tolerates Byzantine failures:**
- Malicious behavior
- Corrupted messages
- Arbitrary failures

**Requirements:**
- 3f+1 replicas to tolerate f failures
- More expensive than crash-fault tolerance

**Use case:** Blockchain systems (untrusted participants).

---

## Coordination Services

### ZooKeeper

**Distributed coordination service.**

**Features:**
- Hierarchical namespace (like filesystem)
- Atomic operations
- Sequential nodes
- Ephemeral nodes (deleted on disconnect)
- Watches (notifications on changes)

**Common recipes:**
- Distributed locks
- Leader election
- Configuration management
- Group membership

**Guarantees:**
- Linearizable writes
- FIFO client order
- Eventually consistent reads (or sync() for linearizable)

### etcd

**Distributed key-value store using Raft.**

**Features:**
- Simple key-value API
- Watch for changes
- Leases (time-bounded keys)
- Transactions

**Use case:** Kubernetes uses etcd for all cluster state.

**Advantages over ZooKeeper:**
- Simpler API
- Better performance
- gRPC-based (modern protocol)

### Consul

**Service mesh and coordination service.**

**Features:**
- Service discovery
- Health checking
- Key-value store (using Raft)
- Multi-datacenter support

**Use case:** Service discovery and configuration in microservices.

---

## Practical Patterns

### Lock-Free Algorithms

**Avoid locks when possible:**
- Use atomic operations
- CAS (compare-and-swap)
- Optimistic concurrency control

**Example: Counter without locks**
```
do:
  old_value = read_counter()
  new_value = old_value + 1
while not CAS(counter, old_value, new_value)
```

**Advantages:**
- No deadlocks
- Better performance (no blocking)

**Disadvantages:**
- More complex
- May spin on contention

### Lease-Based Coordination

**Time-bounded ownership:**
```
1. Acquire lease for duration T
2. Perform work while lease valid
3. Renew lease periodically
4. Release lease when done
```

**Safety:**
- Must stop work when lease expires
- Clock synchronization required
- Grace period for network delays

### Work Stealing

**Distribute work without central coordinator:**
```
Each worker:
1. Has local work queue
2. Processes items from own queue
3. When queue empty, steal from other workers
```

**Advantages:**
- No central coordinator (no bottleneck)
- Automatic load balancing

**Implementation:**
- Use atomic operations for queue access
- Steal from end, process from front (reduces contention)

### Distributed Rate Limiting

**Coordinate rate limits across instances:**

**Centralized counter (Redis):**
```
count = INCR("rate_limit:" + user_id)
if count == 1:
  EXPIRE("rate_limit:" + user_id, 60)

if count > limit:
  reject request
```

**Token bucket (distributed):**
```
Maintain token bucket in Redis
Use Lua scripts for atomic operations
Each instance shares same bucket
```

### Testing Coordination

**Jepsen testing:**
- Framework for testing distributed systems
- Induces network partitions, crashes
- Verifies linearizability, consistency

**Chaos engineering:**
- Randomly kill leader
- Partition network
- Delay messages
- Verify system remains correct

### Monitoring

**Track coordination metrics:**
- Lock acquisition time
- Lock hold time
- Lock contention (failed acquisitions)
- Leader election frequency
- Time without leader

**Alert on:**
- Lock hold time exceeds threshold
- High lock contention
- Frequent leader elections
- Extended time without leader

### Debugging

**Common issues:**
- Deadlocks (circular waits)
- Split brain (multiple leaders)
- Lock expiry (timeout too short)
- Stale locks (holder crashed)

**Debugging techniques:**
- Distributed tracing
- Lock holder identification
- Leader epoch tracking
- Timeout tuning
