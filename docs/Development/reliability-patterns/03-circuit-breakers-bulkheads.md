---
sidebar_position: 3
---

# Circuit Breakers and Bulkheads

Understanding circuit breakers for preventing retry storms and bulkheads for isolating failures in production systems.

---

## Table of Contents

1. [Circuit Breaker Pattern](#circuit-breaker-pattern)
2. [Circuit Breaker States](#circuit-breaker-states)
3. [Circuit Breaker Configuration](#circuit-breaker-configuration)
4. [Bulkhead Pattern](#bulkhead-pattern)
5. [Implementation Strategies](#implementation-strategies)
6. [Monitoring and Observability](#monitoring-and-observability)
7. [Production Patterns](#production-patterns)

---

## Circuit Breaker Pattern

### The Problem

When a service fails, clients continue calling it:
- Each call times out (e.g., 5 seconds)
- Retries amplify the problem
- Resources exhausted waiting for timeouts
- Failed service is overwhelmed by retry traffic
- Service can't recover under load

**Circuit breaker stops calling failed services.**

### Electrical Circuit Analogy

Like an electrical circuit breaker:
- Monitors current flow (requests)
- Trips when current too high (too many failures)
- Stops flow until manual reset (or automatic after timeout)
- Prevents damage to circuit (prevents cascade failure)

### How Circuit Breakers Work

**Monitor requests** - Track success/failure rate.

**Open circuit** - When failure threshold exceeded, stop calling service.

**Fast fail** - Return error immediately instead of calling service.

**Automatic recovery test** - After timeout, allow limited requests to test recovery.

**Close circuit** - If test requests succeed, resume normal operation.

### Benefits

**Prevents cascade failures** - Failure contained to one service.

**Faster failures** - Fail immediately instead of waiting for timeout.

**Reduces load on failed service** - Gives service time to recover.

**Clear failure indication** - Circuit state indicates service health.

**Automatic recovery** - Service automatically back in rotation when healthy.

---

## Circuit Breaker States

### Closed State

**Normal operation.** Circuit is closed, requests flow through.

**Behavior:**
- All requests sent to service
- Track success/failure rate
- If failure rate exceeds threshold, open circuit

**Monitoring:**
- Count failures in rolling window
- Calculate failure percentage
- Compare to threshold

**Transition to Open:**
- Failure rate > threshold (e.g., 50% failures in 10 requests)
- Consecutive failures > threshold (e.g., 5 consecutive failures)

### Open State

**Circuit tripped.** Service is considered failed.

**Behavior:**
- All requests fail immediately without calling service
- Return error (CircuitBreakerOpenError)
- Start timeout timer

**Error Response:**
```
ServiceUnavailableError: Circuit breaker open for PaymentService.
Service has failed and is temporarily unavailable.
Will retry in 30 seconds.
```

**Transition to Half-Open:**
- After timeout period (e.g., 30 seconds)
- Ready to test if service recovered

### Half-Open State

**Testing recovery.** Allow limited requests to test service.

**Behavior:**
- Allow N requests through (e.g., 1-5 requests)
- Remaining requests fail immediately
- Track success rate of test requests

**Transition to Closed:**
- If test requests succeed (e.g., 3/3 succeed)
- Service recovered, resume normal operation

**Transition to Open:**
- If test requests fail (e.g., 1 or more fail)
- Service still unhealthy, open circuit again
- Reset timeout (possibly with backoff)

### State Transitions

```
Closed → Open: Failure threshold exceeded
Open → Half-Open: Timeout expired
Half-Open → Closed: Test requests succeeded
Half-Open → Open: Test requests failed
```

### State Duration

**Closed:** Indefinite (until failures exceed threshold)

**Open:** Fixed timeout (30s - 60s typical)

**Half-Open:** Brief (until test requests complete, 1-5 seconds)

---

## Circuit Breaker Configuration

### Failure Threshold

**Percentage-based:**
- Open circuit if 50% of requests fail in rolling window
- Window: last 10-20 requests
- Good for moderate traffic

**Count-based:**
- Open circuit if 5 consecutive failures
- Doesn't require minimum request volume
- Good for low traffic

**Hybrid:**
- Require minimum request volume (e.g., 10 requests)
- And failure percentage threshold (e.g., 50%)
- Prevents opening on small samples

### Window Types

**Sliding Window:**
- Track last N requests
- New request pushes oldest out
- Continuously updated
- More responsive but more complex

**Tumbling Window:**
- Fixed time windows (e.g., 10 second windows)
- Reset at window boundary
- Simpler but less responsive

### Timeout Configuration

**Open Circuit Timeout:**
- How long to wait before testing recovery
- Typical: 30-60 seconds
- Too short: test before service recovered
- Too long: slow to detect recovery

**Exponential Backoff:**
- First open: 30 seconds
- Second open: 60 seconds
- Third open: 120 seconds
- Gives persistently failing service more recovery time

### Test Request Configuration

**Test Request Count:**
- How many requests in half-open state
- Typical: 1-5 requests
- Too few: unreliable test
- Too many: overwhelm recovering service

**Success Threshold:**
- How many test requests must succeed
- Typical: all or most (e.g., 3/3 or 4/5)
- Conservative: require all to succeed
- Permissive: require most to succeed

### Error Classification

Not all errors should count toward circuit breaker:

**Count as Failure:**
- Timeout errors
- Connection errors
- 500 Internal Server Error
- 503 Service Unavailable
- 502 Bad Gateway
- 504 Gateway Timeout

**Don't Count:**
- 400 Bad Request (client error)
- 401 Unauthorized (auth error)
- 403 Forbidden (permission error)
- 404 Not Found (resource doesn't exist)
- 422 Unprocessable Entity (validation error)

Client errors indicate problems with request, not service health.

### Per-Operation Configuration

Different operations may need different settings:

**Critical path (checkout):**
- Failure threshold: 30% (sensitive)
- Timeout: 30 seconds (quick recovery test)
- Test requests: 1 (single test)

**Non-critical (recommendations):**
- Failure threshold: 70% (tolerant)
- Timeout: 60 seconds (longer recovery)
- Test requests: 5 (thorough test)

**Read operations:**
- More tolerant thresholds
- Can often use cache as fallback

**Write operations:**
- More sensitive thresholds
- Critical to detect failures quickly

---

## Bulkhead Pattern

### The Problem

Failure in one dependency can exhaust all resources:

**Scenario:**
- Payment service is slow
- All connection pool threads wait for payment service
- New requests (even non-payment) can't get threads
- Entire service becomes unresponsive

**Without isolation, one dependency failure brings down everything.**

### Ship Bulkhead Analogy

Ships have bulkheads (watertight compartments):
- Breach in one compartment doesn't sink ship
- Other compartments remain intact
- Ship can limp to port

Software bulkheads isolate failures similarly.

### Resource Isolation

Allocate separate resource pools per dependency:

**Example: Thread Pools**
- Payment service: 10 threads
- Inventory service: 10 threads
- Shipping service: 10 threads
- Other operations: 20 threads

Payment failure exhausts only its 10 threads. Other operations unaffected.

### Types of Bulkheads

**Thread Pool Bulkheads:**
- Separate thread pool per dependency
- Limits concurrent requests to each dependency

**Semaphore Bulkheads:**
- Limit concurrent requests with semaphores
- Lighter weight than threads
- Good for async operations

**Connection Pool Bulkheads:**
- Separate connection pools per service
- Prevents one service from exhausting all connections

**CPU/Memory Bulkheads:**
- Container resource limits
- Separate processes for critical vs non-critical work

### Bulkhead Benefits

**Failure Isolation** - One dependency failure doesn't affect others.

**Predictable Degradation** - Service degrades gracefully under partial failure.

**Resource Guarantees** - Critical operations guaranteed resources.

**Clear Failure Modes** - Easy to identify which dependency is failing.

### Bulkhead Trade-offs

**Resource Inefficiency:**
- Idle pools can't be used by other operations
- May need more total resources

**Configuration Complexity:**
- Must size each pool appropriately
- Requires understanding traffic patterns

**Monitoring Complexity:**
- More metrics to track
- More alerts to configure

### Sizing Bulkheads

**Based on concurrency:**
```
Expected concurrency = requests/sec * latency

If payment receives 100 req/s and latency is 100ms:
Concurrency = 100 * 0.1 = 10 threads
```

Add buffer for spikes (e.g., 10 * 1.5 = 15 threads).

**Based on percentages:**
- Critical operations: 40% of resources
- Normal operations: 30% of resources
- Non-critical operations: 20% of resources
- Reserve: 10% for emergencies

**Dynamic sizing:**
- Start with estimates
- Monitor utilization
- Adjust based on actual patterns

### Queue-Based Bulkheads

Combine thread pools with queues:

**Configuration:**
- Thread pool: 10 threads
- Queue depth: 50 requests

**Behavior:**
- 10 requests executing concurrently
- 50 requests waiting in queue
- Request 61 rejected immediately

Queue provides buffer for burst traffic while maintaining limits.

### Bulkhead Patterns

**Per-Service Bulkheads:**
- One pool per external service
- Isolates each service dependency

**Per-Operation Bulkheads:**
- Separate pools for read vs write
- Separate pools for critical vs non-critical

**Per-User Bulkheads:**
- Prevent one user from exhausting resources
- Limit concurrent requests per user

**Per-Tenant Bulkheads:**
- In multi-tenant systems
- Guarantee resources per tenant

---

## Implementation Strategies

### Circuit Breaker Libraries

**resilience4j (Java):**
- Comprehensive resilience library
- Circuit breaker, bulkhead, retry, rate limiter
- Spring Boot integration

**Hystrix (Java):**
- Netflix library (now in maintenance mode)
- Circuit breaker and bulkhead
- Dashboard for monitoring

**Polly (.NET):**
- Resilience and transient fault handling
- Circuit breaker, retry, timeout, bulkhead

**cockatiel (Node.js):**
- Resilience library inspired by Polly
- TypeScript support

**go-kit/circuitbreaker (Go):**
- Circuit breaker implementations
- Gobreaker for simple cases

### Custom Implementation Considerations

If implementing custom circuit breaker:

**State Management:**
- Thread-safe state transitions
- Atomic operations for counters
- Lock-free data structures if possible

**Persistence:**
- In-memory state (lost on restart)
- Or persistent (Redis, database)

**Distributed Systems:**
- Per-instance circuit breakers (independent)
- Or shared circuit breakers (coordinated via Redis)

**Metrics:**
- Track state transitions
- Track request counts by result
- Export metrics for monitoring

### Integration Patterns

**Decorator Pattern:**
```
Original: httpClient.get(url)
With Circuit Breaker: circuitBreaker.execute(() => httpClient.get(url))
```

**Proxy Pattern:**
```
interface PaymentService {
  charge(amount)
}

class CircuitBreakerProxy implements PaymentService {
  charge(amount) {
    return circuitBreaker.execute(() => realService.charge(amount))
  }
}
```

**Middleware Pattern:**
```
HTTP middleware:
- Check circuit state
- If open, return error
- If closed/half-open, proceed
- Record result
```

### Per-Instance vs Cluster-Wide

**Per-Instance Circuit Breakers:**
- Each service instance has own circuit breaker
- Independent state
- Simpler but less coordinated

**Cluster-Wide Circuit Breakers:**
- Shared state across instances (via Redis)
- Coordinated response
- More complex but faster cluster-wide reaction

**Hybrid Approach:**
- Per-instance breakers for fast local response
- Aggregate signals to coordinated management system
- Management system can force-open circuits

### Fallback Strategies

When circuit is open, implement fallbacks:

**Cached Response:**
```
try:
  result = circuitBreaker.execute(operation)
except CircuitOpenError:
  result = cache.get(key)
```

**Default Value:**
```
try:
  recommendations = circuitBreaker.execute(getRecommendations)
except CircuitOpenError:
  recommendations = getPopularItems()  # Default
```

**Degraded Functionality:**
```
try:
  fullProfile = circuitBreaker.execute(getFullProfile)
except CircuitOpenError:
  basicProfile = getBasicProfileFromCache()
```

**Error Response:**
```
try:
  payment = circuitBreaker.execute(chargePayment)
except CircuitOpenError:
  return "Payment service temporarily unavailable. Please try again."
```

---

## Monitoring and Observability

### Circuit Breaker Metrics

**State:**
- Current state (closed/open/half-open)
- State transition frequency
- Time in each state

**Requests:**
- Success count
- Failure count
- Rejection count (circuit open)
- Latency by result

**State Transitions:**
- Time of last transition
- Reason for transition
- Failed/successful test requests

### Dashboards

Create dashboards showing:
- Circuit breaker state per dependency
- Request success rate per dependency
- Circuit open/close events
- Request latency percentiles

### Alerts

**Circuit Opened:**
```
Alert: PaymentService circuit breaker opened
Severity: High
Description: Payment service experiencing failures
Action: Check payment service health
```

**Circuit Repeatedly Opening:**
```
Alert: PaymentService circuit breaker opened 5 times in 10 minutes
Severity: Critical
Description: Payment service unstable
Action: Investigate root cause
```

**Circuit Open Duration:**
```
Alert: PaymentService circuit breaker open for 5 minutes
Severity: High
Description: Payment service still failing
Action: Manual intervention may be required
```

### Logging

Log circuit breaker events:

**State Transitions:**
```
[2024-01-15 10:30:45] INFO CircuitBreaker state changed:
  service=PaymentService
  from=Closed
  to=Open
  reason=FailureThresholdExceeded
  failures=15/20
```

**Test Requests:**
```
[2024-01-15 10:31:15] INFO CircuitBreaker testing recovery:
  service=PaymentService
  state=HalfOpen
  testRequests=3
```

**Recovery:**
```
[2024-01-15 10:31:18] INFO CircuitBreaker recovered:
  service=PaymentService
  from=HalfOpen
  to=Closed
  downtime=33s
```

### Distributed Tracing

Include circuit breaker information in traces:
- Was request rejected due to circuit breaker?
- Circuit breaker state at time of request
- Time spent waiting for circuit breaker

This helps diagnose cascade failures.

---

## Production Patterns

### Bulkhead Sizing Strategy

**Conservative Approach:**
1. Start with separate pools for each dependency
2. Size based on expected concurrency
3. Monitor pool utilization
4. Adjust sizes based on actual patterns

**Metrics to Track:**
- Pool utilization (active / total threads)
- Queue depth
- Rejection rate
- Latency when pool saturated

### Circuit Breaker Testing

**Chaos Engineering:**
- Deliberately fail dependencies
- Verify circuit breaker opens
- Verify fallback behavior
- Verify automatic recovery

**Load Testing:**
- Test circuit breaker under load
- Verify thresholds are appropriate
- Verify fallbacks maintain acceptable performance

**Manual Testing:**
- Force circuit breaker open/closed
- Test application behavior in each state
- Verify monitoring and alerts

### Gradual Rollout

When introducing circuit breakers:

**Phase 1: Observe**
- Deploy circuit breakers in "observe only" mode
- Don't open circuits, just track metrics
- Tune thresholds based on observations

**Phase 2: Notify**
- Log when circuit would open
- Alert on-call engineers
- Prepare fallback strategies

**Phase 3: Engage**
- Enable circuit breaker
- Monitor closely for unexpected behavior
- Roll back if issues

### Circuit Breaker Anti-Patterns

**Too Sensitive:**
- Opens on transient errors
- Frequent false positives
- Service unavailable unnecessarily

**Too Tolerant:**
- Doesn't open when it should
- Failure cascade before opening
- Defeats purpose

**Ignore Circuit State:**
- Application doesn't handle CircuitOpenError
- Users see confusing errors
- No fallback behavior

**No Monitoring:**
- Circuit breaker present but not monitored
- Issues go unnoticed
- Defeats observability benefit

### Multi-Level Circuit Breakers

Implement circuit breakers at multiple levels:

**Client-Level:**
- Each client has circuit breaker for dependencies
- Fast local response

**Service-Level:**
- API gateway has circuit breaker
- Prevents bad traffic from reaching services

**Infrastructure-Level:**
- Load balancer health checks
- Remove unhealthy instances from rotation

Each level provides different protection.

### Circuit Breaker and Caching

Combine circuit breaker with cache:

**Normal Operation:**
- Fetch fresh data
- Update cache

**Circuit Open:**
- Serve from cache (even if stale)
- Better than complete failure

**Cache Warming:**
- Proactively refresh cache
- Circuit breaker can open without cache miss

### Documentation

Document circuit breaker behavior:
- Which services have circuit breakers
- Thresholds and timeouts configured
- Fallback behaviors
- How to manually open/close circuits
- Runbooks for circuit breaker alerts

This helps team respond to incidents effectively.
