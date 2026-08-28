---
sidebar_position: 4
---

# Rate Limiting and Load Shedding

Understanding rate limiting for preventing abuse and load shedding for maintaining service quality under overload.

---

## Table of Contents

1. [Rate Limiting](#rate-limiting)
2. [Rate Limiting Algorithms](#rate-limiting-algorithms)
3. [Load Shedding](#load-shedding)
4. [Graceful Degradation](#graceful-degradation)
5. [Backpressure](#backpressure)
6. [Implementation Strategies](#implementation-strategies)
7. [Production Considerations](#production-considerations)

---

## Rate Limiting

### What Is Rate Limiting

Rate limiting controls the rate of requests a client can make. It prevents:
- Resource exhaustion from excessive requests
- Abuse and denial of service attacks
- Unfair resource allocation
- Cascading failures from traffic spikes

### Why Rate Limit

**Protect System Resources:**
- Prevent any single client from overwhelming system
- Ensure resources available for all users
- Maintain consistent performance

**Cost Control:**
- Limit expensive operations
- Prevent runaway costs from API usage
- Enforce usage tiers

**Fair Usage:**
- Ensure no user monopolizes resources
- Provide baseline service level for all users

**Security:**
- Slow down brute force attacks
- Prevent credential stuffing
- Mitigate DDoS attempts

### Rate Limiting Dimensions

**Per User:**
- Limit requests per authenticated user
- Most common for APIs

**Per IP Address:**
- Limit requests per source IP
- Good for anonymous/public endpoints
- Beware: NAT and proxies share IPs

**Per API Key:**
- Limit requests per API key
- Standard for external APIs

**Per Endpoint:**
- Different limits for different endpoints
- Expensive operations get lower limits

**Per Resource:**
- Limit operations on specific resources
- Example: 5 login attempts per account per minute

**Global:**
- Total requests across all clients
- Prevents system-wide overload

### Rate Limit Responses

When limit exceeded:

**HTTP 429 Too Many Requests:**
```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1610000000

{
  "error": "Rate limit exceeded",
  "message": "You have exceeded 100 requests per minute. Please wait 60 seconds.",
  "retryAfter": 60
}
```

**Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)
- `Retry-After`: Seconds to wait before retrying

### Rate Limit Tiers

Different tiers for different users:

**Free Tier:**
- 100 requests/minute
- 10,000 requests/day

**Basic Tier:**
- 1,000 requests/minute
- 100,000 requests/day

**Premium Tier:**
- 10,000 requests/minute
- 1,000,000 requests/day

**Enterprise:**
- Custom limits
- Dedicated resources

### Dynamic Rate Limiting

Adjust limits based on:
- System load
- User behavior
- Time of day
- Subscription tier

**Example:** During high traffic, reduce limits to maintain service quality. During low traffic, allow higher limits.

---

## Rate Limiting Algorithms

### Fixed Window Counter

Count requests in fixed time windows.

**Algorithm:**
```
window = floor(now / windowSize)
key = userId + ":" + window
count = increment(key)
if count > limit:
  reject request
```

**Example:**
- Limit: 100 requests per minute
- Window: 10:00:00 - 10:01:00
- Window: 10:01:00 - 10:02:00

**Advantages:**
- Simple to implement
- Memory efficient
- Easy to understand

**Disadvantages:**
- Boundary problem: 200 requests in 2 seconds across window boundary
  - 100 at 10:00:59
  - 100 at 10:01:00
- Traffic spikes at window boundaries

### Sliding Window Log

Track timestamp of each request.

**Algorithm:**
```
key = userId
timestamps = getTimestamps(key)
removeOlderThan(now - windowSize)
if timestamps.length >= limit:
  reject request
add(now)
```

**Advantages:**
- No boundary problem
- Accurate request rate
- Smooth enforcement

**Disadvantages:**
- Memory intensive (store all timestamps)
- Expensive at high volume

### Sliding Window Counter

Hybrid of fixed window and sliding window.

**Algorithm:**
```
currentWindow = floor(now / windowSize)
previousWindow = currentWindow - 1

currentCount = getCount(currentWindow)
previousCount = getCount(previousWindow)

percentageOfPreviousWindow = (windowSize - (now % windowSize)) / windowSize
estimatedCount = previousCount * percentageOfPreviousWindow + currentCount

if estimatedCount >= limit:
  reject request
```

**Advantages:**
- Memory efficient (only two counters)
- Mitigates boundary problem
- Good approximation

**Disadvantages:**
- Approximate, not exact
- Slightly more complex

### Token Bucket

Bucket holds tokens. Tokens added at fixed rate. Requests consume tokens.

**Algorithm:**
```
tokensPerSecond = limit / windowSize
tokens = getBucketTokens()
timeSinceLastRefill = now - lastRefill

newTokens = timeSinceLastRefill * tokensPerSecond
tokens = min(tokens + newTokens, bucketCapacity)

if tokens >= 1:
  tokens -= 1
  allow request
else:
  reject request
```

**Advantages:**
- Handles bursts (up to bucket capacity)
- Smooth long-term rate
- Flexible

**Disadvantages:**
- More complex
- Requires floating-point arithmetic
- Bucket capacity needs tuning

**Bucket capacity determines burst tolerance:**
- Small bucket: strict rate, small bursts
- Large bucket: allows larger bursts

### Leaky Bucket

Requests enter bucket. Requests leave at fixed rate.

**Algorithm:**
```
queue.add(request)
if queue.size > bucketCapacity:
  reject request

processRequests at fixed rate
```

**Advantages:**
- Smooth output rate
- Simple conceptually

**Disadvantages:**
- Adds latency (queuing)
- Need queue management
- Doesn't handle bursts well

### Comparison

**Fixed Window:** Simple, but boundary problem.

**Sliding Log:** Accurate, but memory intensive.

**Sliding Counter:** Good balance of accuracy and efficiency.

**Token Bucket:** Flexible, handles bursts, most common in production.

**Leaky Bucket:** Smooth rate, but adds latency.

**Recommendation:** Token bucket for most use cases. Sliding window counter for simplicity.

---

## Load Shedding

### What Is Load Shedding

Load shedding intentionally drops requests when system is overloaded. Better to serve some requests well than all requests poorly.

### Why Shed Load

**Maintain Quality:**
- High load degrades performance for all users
- Better to reject some requests than slow down all
- Users prefer fast errors to slow success

**Prevent Cascade:**
- Overload in one service cascades to dependencies
- Shedding load prevents cascade
- System remains partially functional

**Cost Control:**
- Computing resources have limits
- Rejecting requests is cheaper than processing them
- Prevent infrastructure costs from spiking

### When to Shed Load

Trigger load shedding when:
- CPU utilization > 80%
- Memory utilization > 85%
- Event loop lag > 100ms
- Request queue depth > 1000
- Response time p99 > 2x normal
- Error rate > 1%

Don't wait for complete failure. Shed load proactively.

### What to Shed

**Priority-Based:**
- Shed low-priority requests first
- Maintain high-priority operations
- Examples:
  - High: checkout, payments
  - Medium: product viewing
  - Low: recommendations, analytics

**User-Based:**
- Shed free tier users before paid users
- Maintain service for premium customers

**Operation-Based:**
- Shed expensive operations (complex queries, reports)
- Maintain cheap operations (cache reads)

**Randomized:**
- Randomly shed percentage of requests
- Simple but doesn't differentiate importance

### Load Shedding Strategies

**Percentage-Based:**
- Shed 10% of requests at 70% capacity
- Shed 50% of requests at 90% capacity
- Shed 90% of requests at 95% capacity

**Queue-Based:**
- Reject new requests when queue full
- Process queued requests first
- Simple and effective

**Latency-Based:**
- Shed requests if processing would exceed timeout
- Better to reject immediately than waste resources on doomed requests

**Adaptive:**
- Adjust shedding rate based on observed impact
- Increase shedding if latency still high
- Decrease shedding as system recovers

### Load Shedding Response

Return clear errors for shed requests:

```
HTTP/1.1 503 Service Unavailable
Retry-After: 10

{
  "error": "Service overloaded",
  "message": "Service is currently experiencing high load. Please retry in 10 seconds.",
  "retryAfter": 10
}
```

### Admission Control

Reject requests at the boundary before consuming resources:

**API Gateway:**
- Check system health before routing
- Reject if unhealthy
- Prevents load from reaching backend

**Load Balancer:**
- Health checks on backend services
- Don't route to unhealthy instances

**Service Entrance:**
- Check resource availability before processing
- Reject if insufficient resources

### Concurrency Limits

Limit concurrent requests to prevent overload:

```
maxConcurrent = 1000
currentConcurrent = getConcurrentRequests()

if currentConcurrent >= maxConcurrent:
  reject request with 503
else:
  process request
```

This naturally sheds load when system at capacity.

---

## Graceful Degradation

### What Is Graceful Degradation

Gradually reduce functionality under stress instead of complete failure.

**Full Functionality:** All features available, optimal performance.

**Degraded Mode:** Some features disabled, acceptable performance.

**Minimal Mode:** Only critical features, degraded performance.

**Complete Failure:** Nothing works.

Goal: Stay in degraded mode, avoid complete failure.

### Degradation Strategies

**Disable Non-Critical Features:**
- Disable recommendations under load
- Disable reviews and ratings
- Disable social features
- Maintain core functionality (browsing, checkout)

**Reduce Quality:**
- Lower image resolution
- Simpler search algorithms
- Fewer search results
- Cached data instead of fresh

**Increase Cache TTL:**
- Serve slightly stale data
- Reduce database load
- Users tolerate stale data better than unavailability

**Async Processing:**
- Queue non-critical writes
- Process later when load decreases
- Confirm request accepted, process asynchronously

### Feature Flags for Degradation

Use feature flags to control degradation:

```
if systemLoad > 80%:
  disableRecommendations()
  disableReviews()
  increaseCacheTTL()

if systemLoad > 90%:
  disableSocialFeatures()
  disableAnalytics()
  serveStaticContentOnly()

if systemLoad < 70%:
  enableAllFeatures()
```

### Communicating Degradation

Tell users about degraded service:

**Banner:**
```
"We're experiencing high traffic. Some features may be temporarily unavailable."
```

**Feature-Specific:**
```
"Recommendations temporarily unavailable. Browse our popular items."
```

**Status Page:**
```
Service Status: Degraded
- Core features: Operational
- Recommendations: Disabled
- Expected resolution: 15 minutes
```

### Graceful vs Ungraceful Degradation

**Ungraceful:**
- Random features break
- Inconsistent errors
- Poor user experience
- Confusing failure modes

**Graceful:**
- Predictable degradation path
- Clear error messages
- Core functionality maintained
- Users understand situation

---

## Backpressure

### What Is Backpressure

Backpressure signals upstream to slow down when downstream can't keep up.

**Without Backpressure:**
- Upstream produces faster than downstream consumes
- Queues grow unbounded
- Memory exhaustion
- System crash

**With Backpressure:**
- Downstream signals "I'm full"
- Upstream slows production
- Queues remain bounded
- System stable

### Backpressure Mechanisms

**Explicit Signaling:**
- Downstream returns "slow down" signal
- Upstream reduces rate

**Blocking:**
- Downstream blocks when full
- Upstream waits
- Simple but can cause issues

**Rate Adjustment:**
- Monitor queue depth
- Increase rate if queue low
- Decrease rate if queue high

**Timeout-Based:**
- If operation takes too long, assume overload
- Reduce rate

### Queue-Based Backpressure

Monitor queue depth:

```
if queueDepth < 10%:
  normalRate()

if queueDepth > 50%:
  reduceRate(50%)

if queueDepth > 90%:
  reduceRate(90%)

if queueDepth == 100%:
  rejectRequests()
```

### TCP Backpressure

TCP has built-in backpressure:
- Receive window controls flow
- If receiver's buffer full, window shrinks
- Sender slows down automatically

HTTP/2 builds on this with flow control.

### Stream Backpressure

For stream processing:
- Consumer signals when buffer full
- Producer pauses production
- Consumer signals when ready for more

Node.js streams implement this automatically.

### Backpressure vs Load Shedding

**Backpressure:** Signal upstream to slow down. Cooperative.

**Load Shedding:** Reject requests. Defensive.

Use both:
- Backpressure for internal systems
- Load shedding for external clients

---

## Implementation Strategies

### Rate Limiting Implementation

**In-Memory:**
- Fast
- Lost on restart
- Per-instance only
- Good for: low-traffic or non-critical limits

**Redis:**
- Shared across instances
- Persistent
- Slightly higher latency
- Good for: production systems

**API Gateway:**
- Centralized enforcement
- Built into many gateways (Kong, AWS API Gateway)
- Good for: external APIs

### Redis Rate Limiting

Using Redis with Lua scripts for atomicity:

```lua
-- Token bucket in Redis
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  last_refill = now
end

local elapsed = now - last_refill
local new_tokens = elapsed * rate
tokens = math.min(capacity, tokens + new_tokens)

if tokens >= 1 then
  tokens = tokens - 1
  redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
  redis.call('EXPIRE', key, 3600)
  return 1  -- allowed
else
  return 0  -- rejected
end
```

### Load Shedding Implementation

**Middleware:**
```
function loadSheddingMiddleware(req, res, next) {
  const load = getCurrentLoad()
  const sheddingPercentage = calculateSheddingPercentage(load)

  if (Math.random() < sheddingPercentage) {
    return res.status(503).json({
      error: 'Service overloaded',
      retryAfter: 10
    })
  }

  next()
}
```

**Priority-Based:**
```
function priorityLoadShedding(req, res, next) {
  const priority = req.user?.tier || 'free'
  const load = getCurrentLoad()

  if (shouldShedLoad(priority, load)) {
    return res.status(503).json({
      error: 'Service overloaded',
      retryAfter: 10
    })
  }

  next()
}

function shouldShedLoad(priority, load) {
  if (load < 70) return false
  if (load > 95) return true

  const thresholds = {
    free: 70,
    basic: 80,
    premium: 90,
    enterprise: 95
  }

  return load > thresholds[priority]
}
```

### Concurrency Limiting

Using semaphores:

```
const maxConcurrent = 1000
const semaphore = new Semaphore(maxConcurrent)

async function processRequest(req, res) {
  const acquired = await semaphore.tryAcquire(timeout = 100ms)

  if (!acquired) {
    return res.status(503).json({
      error: 'Too many concurrent requests'
    })
  }

  try {
    const result = await handleRequest(req)
    res.json(result)
  } finally {
    semaphore.release()
  }
}
```

---

## Production Considerations

### Rate Limit Testing

Test rate limiting behavior:
- Verify limits enforced correctly
- Verify headers returned correctly
- Verify burst handling
- Test near boundary conditions
- Test distributed rate limiting consistency

### Monitoring

Track metrics:
- Rate limit hits per endpoint
- Rate limit hits per user
- Percentage of requests rate limited
- Load shedding percentage
- Rejected request rate

Alert on:
- High rate limit hit rate (may need limit adjustment)
- Sustained load shedding (capacity issue)
- Rate limiting errors (implementation bug)

### Configuration

Make limits configurable:
- Per-environment limits
- Per-user tier limits
- Per-endpoint limits
- Dynamic adjustment based on metrics

Don't hardcode limits in application code.

### User Experience

**Communicate Limits:**
- Document limits in API docs
- Return limit information in headers
- Provide clear error messages

**Progressive Enhancement:**
- Cache responses client-side
- Implement client-side rate limiting
- Batch requests where possible
- Use webhooks instead of polling

### Rate Limit Bypass

Provide bypass mechanisms for:
- Health checks (don't rate limit)
- Internal services (different limits)
- Emergency operations (bypass temporarily)

Use separate tokens or IP whitelisting.

### Distributed Rate Limiting Challenges

**Clock Synchronization:**
- Servers may have slightly different times
- Use centralized time source
- Or accept minor inconsistency

**Consistency:**
- Different instances may have different counts
- Use centralized store (Redis) for consistency
- Or accept eventual consistency

**Performance:**
- Network latency to centralized store
- Cache limits locally with sync
- Balance consistency vs performance

### Gradual Rollout

When implementing load shedding:

**Phase 1: Monitor**
- Track when load shedding would trigger
- Don't actually shed load
- Tune thresholds

**Phase 2: Warn**
- Log when load is shed
- Alert team
- Continue serving requests

**Phase 3: Engage**
- Actually shed load
- Monitor user impact
- Adjust thresholds based on feedback

### Documentation

Document for users:
- Rate limits for each endpoint
- How to handle rate limit errors
- How to request limit increases
- Burst allowances

Document for operations:
- How load shedding works
- When it triggers
- How to adjust thresholds
- Emergency bypass procedures
