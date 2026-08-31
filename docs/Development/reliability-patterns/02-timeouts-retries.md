---
sidebar_position: 2
---

# Timeouts, Retries, and Backoff Strategies

Deep dive into timeout strategies, retry patterns, exponential backoff, and jitter for production systems.

---

## Table of Contents

1. [Timeouts](#timeouts)
2. [Retry Strategies](#retry-strategies)
3. [Exponential Backoff](#exponential-backoff)
4. [Jitter](#jitter)
5. [Idempotency](#idempotency)
6. [Combining Patterns](#combining-patterns)
7. [Production Considerations](#production-considerations)

---

## Timeouts

### Why Timeouts Are Essential

Without timeouts, a single slow or hung operation can:
- Hold resources indefinitely (threads, connections, memory)
- Prevent other requests from using those resources
- Lead to resource exhaustion
- Cause cascading failures

**Every external operation must have a timeout.** This is non-negotiable for production systems.

### Types of Timeouts

**Connection Timeout** - Time to establish connection.
- How long to wait for TCP handshake
- Typically 2-5 seconds
- Should be shorter than request timeout

**Request Timeout** - Total time for request/response.
- Includes connection time, request processing, response transfer
- Typically 5-30 seconds depending on operation
- Should account for expected latency plus buffer

**Read Timeout** - Time to read response after connection established.
- How long to wait for bytes from server
- Typically same as request timeout minus connection timeout

**Write Timeout** - Time to write request to server.
- Usually short (1-5 seconds)
- Rarely the bottleneck

**Idle Timeout** - Time connection can be idle before closing.
- For connection pools and keep-alive connections
- Typically minutes (e.g., 60 seconds)

### Setting Appropriate Timeouts

**Too Short:**
- Legitimate requests timeout prematurely
- Increased retry traffic
- Poor user experience

**Too Long:**
- Resources held during failures
- Slow error detection
- Cascade failures

**Guidelines:**

**Latency-Sensitive Operations** (user-facing APIs):
- Connection: 2-3 seconds
- Request: 5-10 seconds
- Be aggressive—users won't wait long

**Batch Operations** (background processing):
- Connection: 5 seconds
- Request: 30-60 seconds
- Can be more tolerant

**Database Queries:**
- Simple queries: 1-5 seconds
- Complex queries: 10-30 seconds
- Analytical queries: 60+ seconds

**External APIs:**
- Check API documentation for recommended timeouts
- Add buffer for network latency
- Typical: 10-30 seconds

### Timeout Implementation Patterns

**Per-Operation Timeout:**
```
timeout = 5 seconds for query
```

**Total Request Timeout:**
```
totalTimeout = 10 seconds for entire request
- 3 seconds for auth call
- 5 seconds for main operation
- 2 seconds for logging
```

**Remaining Time Budget:**
```
startTime = now()
timeout = 10 seconds

operation1(timeout: 10s - elapsed)
operation2(timeout: 10s - elapsed)
operation3(timeout: 10s - elapsed)
```

Each operation gets the remaining budget.

### Timeout Hierarchies

Set timeouts at multiple levels:

**Client Timeout** - Application sets overall timeout.

**Load Balancer Timeout** - LB enforces timeout to backend.

**API Gateway Timeout** - Gateway enforces timeout.

**Service Timeout** - Service enforces internal timeouts.

Each level should have progressively shorter timeouts to fail fast at the right level.

### Timeout Errors

When timeout occurs:
- Return clear error message
- Include timeout value in error
- Log timeout for monitoring
- Clean up resources (close connections)
- Don't retry automatically (let caller decide)

**Good Error:**
```
ServiceTimeoutError: Payment service did not respond within 5000ms
```

**Bad Error:**
```
Error: timeout
```

### Dynamic Timeouts

Adjust timeouts based on observed latency:
- Track p99 latency for operations
- Set timeout to p99 + buffer
- Adjust periodically based on metrics

This handles seasonal variations and gradual performance changes.

### Deadline Propagation

In request chains (API → Service A → Service B), propagate deadline:

**Request enters at API:**
- Deadline = now + 10 seconds

**API calls Service A:**
- Remaining = deadline - now = 8 seconds
- Set timeout to 7 seconds (leave buffer)

**Service A calls Service B:**
- Remaining = deadline - now = 5 seconds
- Set timeout to 4 seconds

Each service respects the overall deadline.

---

## Retry Strategies

### When to Retry

**Retry transient failures:**
- Network errors (connection refused, timeout)
- Server errors (503 Service Unavailable, 502 Bad Gateway)
- Temporary resource exhaustion
- Database deadlocks

**Don't retry:**
- Validation errors (400 Bad Request)
- Authentication errors (401 Unauthorized)
- Permission errors (403 Forbidden)
- Not found errors (404)
- Client errors (4xx generally)
- Permanent server errors (500 on non-idempotent operations)

### Retry Budget

Limit total retries to prevent amplification:

**Without budget:**
- Original request fails
- Retry 3 times
- Each retry has 3 retries
- 1 + 3 + 9 + 27 = 40 requests for 1 user request

**With budget:**
- Set retry budget (e.g., 3 total retries across all operations)
- Track retries across entire request chain
- Stop retrying when budget exhausted

### Retry After Headers

Servers can indicate when to retry:
```
Retry-After: 60
```
This tells client to wait 60 seconds before retrying.

Respect Retry-After headers. Don't retry sooner than indicated.

### Retry Strategies

**Immediate Retry:**
- Retry immediately after failure
- Only for very transient errors (e.g., temporary network glitch)
- Rarely appropriate

**Fixed Delay Retry:**
- Wait fixed time between retries
- Example: retry after 1 second, then 1 second, then 1 second
- Better than immediate but can still overwhelm

**Linear Backoff:**
- Increase delay linearly
- Example: 1s, 2s, 3s, 4s
- Still too aggressive for most cases

**Exponential Backoff:**
- Double delay each retry
- Example: 1s, 2s, 4s, 8s
- Standard approach (covered in detail below)

### Maximum Retry Attempts

Limit retry attempts to prevent infinite loops:

**Typical limits:**
- Interactive operations: 2-3 retries
- Background jobs: 5-10 retries
- Critical operations: 10+ retries with exponential backoff

After max retries:
- Return error to caller
- Log failure for investigation
- Consider dead letter queue for later processing

### Circuit Breaker Integration

Retries should respect circuit breaker state:
- Circuit closed → retry normally
- Circuit open → don't retry, fail immediately
- Circuit half-open → limited retries

This prevents retry storms against failing services.

### Retry Metrics

Track retry metrics:
- Retry rate (retries per request)
- Success rate after retries
- Retries by error type
- Time spent retrying

High retry rate indicates:
- Unreliable dependencies
- Aggressive retry strategy
- Timeouts too short

---

## Exponential Backoff

### The Algorithm

Exponential backoff doubles delay between retries:

```
Attempt 1: Immediate
Attempt 2: Wait 1 second
Attempt 3: Wait 2 seconds
Attempt 4: Wait 4 seconds
Attempt 5: Wait 8 seconds
Attempt 6: Wait 16 seconds
```

Formula: `delay = baseDelay * (2 ^ attempt)`

### Why Exponential

**Early failures may be transient** - Retry quickly.

**Sustained failures indicate problem** - Back off to avoid overwhelming.

**Gives service time to recover** - Long delays allow recovery without retry traffic.

### Base Delay Selection

**Short base (100ms-500ms):**
- For very transient errors
- When service usually recovers quickly
- Risk: still generates significant retry traffic

**Medium base (1s-2s):**
- Standard choice for most operations
- Good balance between retry speed and overload prevention

**Long base (5s-10s):**
- For operations that rarely succeed on retry
- When you want to be very conservative

### Maximum Delay Cap

Cap maximum delay to prevent excessively long waits:

```
delay = min(baseDelay * (2 ^ attempt), maxDelay)
```

Typical caps: 30-60 seconds

Without cap, delays grow unbounded (512s, 1024s, etc).

### Maximum Time Budget

Also cap total time spent retrying:

```
totalTime = sum of all delays + request times
if totalTime > maxTotalTime:
  stop retrying
```

Prevents waiting hours for unlikely success.

### Exponential Backoff with Capped Delay

Practical implementation:
- Base delay: 1 second
- Max delay: 60 seconds
- Max attempts: 10
- Max total time: 5 minutes

```
Attempt 1: 0s (immediate)
Attempt 2: 1s
Attempt 3: 2s
Attempt 4: 4s
Attempt 5: 8s
Attempt 6: 16s
Attempt 7: 32s
Attempt 8: 60s (capped)
Attempt 9: 60s (capped)
Attempt 10: 60s (capped)
Total: ~4 minutes
```

### Full vs Truncated Binary Exponential Backoff

**Full Binary Exponential Backoff:**
- Doubles every time
- 1s, 2s, 4s, 8s, 16s, 32s...

**Truncated:**
- Caps at maximum
- 1s, 2s, 4s, 8s, 16s, 32s, 32s, 32s...

Truncated is more practical for production systems.

---

## Jitter

### The Thundering Herd Problem

Without jitter, synchronized clients create load spikes:

**Scenario:**
- Service goes down at time 0
- 1000 clients all timeout at 5 seconds
- All 1000 retry at exactly 5 seconds
- Service receives 1000 simultaneous requests
- Service is overwhelmed and fails
- All 1000 timeout again
- All retry at 10 seconds
- Cycle repeats

This is the thundering herd problem.

### What Is Jitter

Jitter randomizes retry delays to desynchronize clients.

Instead of all retrying at exactly 2 seconds, retry between 1-3 seconds (2s ± 50%).

This spreads retry traffic over time instead of sharp spikes.

### Types of Jitter

**Full Jitter:**
```
delay = random(0, exponentialDelay)
```
Delay is uniformly random between 0 and calculated delay.

**Decorrelated Jitter:**
```
delay = random(baseDelay, previousDelay * 3)
```
Each delay based on previous, but decorrelated from other clients.

**Equal Jitter:**
```
delay = exponentialDelay/2 + random(0, exponentialDelay/2)
```
Half fixed, half random.

### Jitter Comparison

**Full Jitter** - Maximum randomization, spreads load most evenly. Can result in very short delays.

**Equal Jitter** - Balance between predictability and randomization. Still get reasonable delays.

**Decorrelated Jitter** - Good mathematical properties. Avoids both very short and very long delays.

**Recommendation:** Use decorrelated or equal jitter for production systems.

### Implementing Jitter

**Full Jitter:**
```
baseDelay = 1000ms
attempt = 3
exponentialDelay = 1000 * (2^3) = 8000ms
actualDelay = random(0, 8000ms)
→ anywhere from 0ms to 8000ms
```

**Equal Jitter:**
```
exponentialDelay = 8000ms
actualDelay = 4000ms + random(0, 4000ms)
→ between 4000ms and 8000ms
```

**Decorrelated Jitter:**
```
previousDelay = 4000ms
baseDelay = 1000ms
actualDelay = random(baseDelay, previousDelay * 3)
→ between 1000ms and 12000ms
```

### Jitter Benefits

**Avoids thundering herd** - Requests spread over time.

**Faster recovery** - Some clients retry earlier, service recovers gradually.

**Even load distribution** - No synchronized spikes.

**Critical for shared failures** - When all clients affected by same failure, jitter is essential.

### Jitter Amount

**Low jitter (10-20%)** - Delays mostly predictable.

**Medium jitter (30-50%)** - Good balance.

**High jitter (up to 100%)** - Maximum desynchronization.

For most systems, 50% jitter (equal jitter) is appropriate.

---

## Idempotency

### Why Idempotency Matters

Retries can duplicate operations:
- Charge customer twice
- Create duplicate orders
- Send duplicate emails

Idempotent operations can be safely retried without side effects.

### Naturally Idempotent Operations

**GET requests** - Reading data doesn't change state.

**PUT requests** - Setting absolute values: `set(x, 5)` results in x=5 regardless of how many times called.

**DELETE requests** - Deleting already-deleted resource is idempotent.

**Queries** - Database queries don't modify data.

### Non-Idempotent Operations

**POST requests** - Creating resources: each request creates new resource.

**Increment operations** - `increment(x)` changes value each time.

**Append operations** - `append(list, item)` adds item each time.

**Payments** - Charging credit card multiple times.

**Sending messages** - Email/SMS sent multiple times.

### Making Operations Idempotent

**Idempotency Keys:**

Client generates unique key for operation:
```
POST /orders
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

{
  "items": [...],
  "total": 100
}
```

Server logic:
1. Check if key seen before
2. If yes, return cached response
3. If no, process request and cache response with key
4. Store key and response for 24 hours

Retries with same key are safe.

**Database Constraints:**

Use unique constraints to prevent duplicates:
```sql
CREATE UNIQUE INDEX idx_order_idempotency
ON orders(customer_id, idempotency_key);
```

Duplicate insert attempts fail with unique constraint violation.

**State Machines:**

Design operations as state transitions:
```
Order: draft → pending_payment → paid → shipped

Transition to 'paid' is idempotent.
If already 'paid', transition succeeds (no-op).
```

**Versioning:**

Use optimistic locking:
```
UPDATE orders SET status = 'paid', version = version + 1
WHERE id = 123 AND version = 5
```

Retry fails if version already updated.

### Idempotency Key Expiration

Keys must eventually expire:
- Storage space is limited
- Keys should be unique per operation, not globally
- Typical: 24-48 hours

After expiration, same key treated as new operation.

### Idempotency for Background Jobs

Background jobs must be idempotent:
- Job queue may deliver message multiple times
- Worker crash during processing requires retry
- Network issues may cause duplicate delivery

Design jobs to be safely retried:
- Check if work already done before starting
- Use database transactions for atomicity
- Use status flags to prevent concurrent processing

---

## Combining Patterns

### Timeout + Retry + Backoff + Jitter

Complete pattern for resilient operations:

```
Configuration:
- Connection timeout: 2s
- Request timeout: 5s
- Max retries: 3
- Base delay: 1s
- Max delay: 10s
- Jitter: 50% (equal jitter)

Attempt 1:
- Request with 5s timeout
- Fails after 5s

Attempt 2:
- Wait: 1s + random(0, 1s) = 1.4s
- Request with 5s timeout
- Fails after 5s

Attempt 3:
- Wait: 2s + random(0, 2s) = 3.2s
- Request with 5s timeout
- Fails after 5s

Attempt 4:
- Wait: 4s + random(0, 4s) = 5.7s
- Request with 5s timeout
- Succeeds

Total time: ~25s
```

### Retry Budget Across Services

In multi-service calls, budget retries:

```
Client → API Gateway → Service A → Service B

Total budget: 3 retries

API Gateway uses 1 retry
Service A uses 1 retry
Service B uses 1 retry

Total: 3 retries, budget exhausted
```

Each service gets a portion of budget. Track remaining budget in request headers.

### Circuit Breaker Integration

Circuit breaker controls retry behavior:

**Circuit Closed:**
- Normal retry strategy
- Use configured retries and backoff

**Circuit Open:**
- No retries
- Fail immediately
- Don't waste resources on known-failed service

**Circuit Half-Open:**
- Limited retries
- One retry to test service recovery
- Open circuit if retry fails

### Timeout vs Circuit Breaker

**Timeouts** protect you from individual slow requests.

**Circuit Breakers** protect you from repeatedly calling failing services.

Both are needed:
- Timeout catches hung requests
- Circuit breaker catches systemic failures

---

## Production Considerations

### Configuration Management

Don't hardcode timeout and retry values. Make them configurable:
- Environment variables
- Configuration service
- Feature flags

This allows tuning without code deployment.

### Per-Dependency Configuration

Different dependencies need different settings:

**Fast internal service:**
- Timeout: 2s
- Retries: 3
- Base delay: 500ms

**Slow external API:**
- Timeout: 30s
- Retries: 5
- Base delay: 2s

**Database:**
- Timeout: 5s
- Retries: 3 (deadlocks only)
- Base delay: 100ms

### Monitoring and Alerting

Track metrics:
- Timeout rate (per dependency)
- Retry rate (per dependency)
- Success rate after retries
- Latency percentiles (p95, p99)

Alert on:
- Timeout rate above threshold (e.g., 5%)
- Success rate below threshold (e.g., 95%)
- p99 latency above threshold

### Client Libraries

Use well-tested client libraries that implement these patterns:
- Axios (JavaScript, timeout support)
- Polly (C#, comprehensive retry policies)
- resilience4j (Java, circuit breaker and retry)
- go-retryablehttp (Go, HTTP client with retries)
- tenacity (Python, comprehensive retry library)

Don't implement from scratch unless necessary.

### Testing Retry Logic

Test retry behavior:
- Mock flaky dependencies
- Verify retry attempts and delays
- Verify idempotency
- Test maximum retry limit
- Test backoff calculations
- Verify jitter randomization

### Gradual Rollout

When changing timeout or retry configuration:
- Change gradually (e.g., 10% of traffic)
- Monitor metrics closely
- Increase percentage if metrics good
- Rollback if metrics degrade

Sudden changes can cause unexpected behavior.

### Documentation

Document retry behavior in API docs:
- Which operations are idempotent
- Recommended retry strategies
- Expected error codes for retry vs no-retry

This helps client developers implement correct retry logic.
