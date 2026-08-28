---
sidebar_position: 5
---

# Health Checks and Graceful Shutdown

Understanding health checks, readiness vs liveness probes, and graceful shutdown patterns for production microservices.

---

## Table of Contents

1. [Health Checks](#health-checks)
2. [Readiness vs Liveness](#readiness-vs-liveness)
3. [Health Check Implementation](#health-check-implementation)
4. [Graceful Shutdown](#graceful-shutdown)
5. [Connection Draining](#connection-draining)
6. [Startup and Initialization](#startup-and-initialization)
7. [Production Patterns](#production-patterns)

---

## Health Checks

### What Are Health Checks

Health checks are endpoints that report service health. Load balancers, orchestrators, and monitoring systems use them to:
- Route traffic only to healthy instances
- Detect failures quickly
- Trigger automatic restarts
- Alert on-call engineers

**Without health checks, failed instances continue receiving traffic.**

### Types of Health

**Liveness:** Is the process alive and not deadlocked?

**Readiness:** Can the process handle requests right now?

**Startup:** Has the process finished initialization?

Each serves a different purpose in the service lifecycle.

### Health Check Endpoints

Standard patterns:

**General health:**
```
GET /health
GET /healthz
GET /_health
```

**Detailed health:**
```
GET /health/liveness
GET /health/readiness
GET /health/startup
```

**Kubernetes standard:**
```
GET /healthz (liveness)
GET /readyz (readiness)
```

### Health Check Responses

**Healthy:**
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "version": "1.2.3"
}
```

**Unhealthy:**
```
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "database": "unhealthy",
    "cache": "healthy"
  },
  "error": "Database connection failed"
}
```

**Degraded:**
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "degraded",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "database": "healthy",
    "cache": "unhealthy"
  },
  "warning": "Cache unavailable, using fallback"
}
```

### Shallow vs Deep Health Checks

**Shallow:**
- Check only process health
- Is the HTTP server responding?
- Fast (< 10ms)
- Use for high-frequency checks

**Deep:**
- Check dependencies (database, cache, etc.)
- Comprehensive health picture
- Slower (100ms+)
- Use for detailed diagnostics

**Production practice:** Shallow for load balancer checks (frequent), deep for monitoring (infrequent).

---

## Readiness vs Liveness

### Liveness Checks

**Purpose:** Detect if process is alive or deadlocked.

**Question:** "Should this process be restarted?"

**Failure Action:** Restart the process.

**What to Check:**
- Is HTTP server responsive?
- Is event loop not blocked?
- Are critical threads running?
- Is memory not completely exhausted?

**What NOT to Check:**
- Database connectivity (not a reason to restart)
- External API availability (not a reason to restart)
- Temporary resource exhaustion

**Simple is Better:**
```
GET /health/liveness
→ 200 OK if process alive
→ No response or 5xx if process dead
```

### Readiness Checks

**Purpose:** Detect if process can handle requests.

**Question:** "Should this instance receive traffic?"

**Failure Action:** Remove from load balancer rotation. Don't restart.

**What to Check:**
- Can connect to database?
- Can connect to cache?
- Can connect to critical dependencies?
- Are connection pools available?
- Is initialization complete?

**Failure Examples:**
- Database down → Not ready, but process is alive
- Cache unavailable → Not ready (if critical)
- High event loop lag → Not ready, process overwhelmed

**Comprehensive Check:**
```
GET /health/readiness

Check:
1. Database connection
2. Cache connection
3. Message queue connection
4. Connection pool availability
5. Event loop lag < 100ms

Return 200 only if ALL checks pass
```

### Startup Probes

**Purpose:** Detect when slow-starting processes are ready.

**Question:** "Has initialization completed?"

**Failure Action:** Restart if initialization takes too long.

**Use Case:**
- Large applications with slow startup (30+ seconds)
- Prevents liveness probe from killing during startup
- Kubernetes-specific feature

**Configuration:**
```
Startup probe:
- Check every 5 seconds
- Timeout after 5 minutes
- Once passes, switch to liveness/readiness probes
```

### Why Separate Probes

**Scenario without separation:**
- Database goes down
- Health check fails (includes database check)
- Orchestrator restarts instance
- New instance also can't reach database
- Also restarted
- Restart loop

**With separate probes:**
- Database goes down
- Readiness check fails
- Liveness check passes
- Instance removed from rotation but not restarted
- Database recovers
- Readiness check passes
- Instance added back to rotation
- No restart needed

**Separation prevents unnecessary restarts.**

### Probe Configuration

**Liveness:**
- Frequency: 10-30 seconds
- Timeout: 3 seconds
- Failure threshold: 3 consecutive failures

**Readiness:**
- Frequency: 5-10 seconds (more frequent)
- Timeout: 5 seconds
- Failure threshold: 2 consecutive failures
- Success threshold: 1 success (quick recovery)

**Startup:**
- Frequency: 5 seconds
- Timeout: 5 seconds
- Failure threshold: 60 attempts (5 minutes total)

---

## Health Check Implementation

### Basic Health Check

```javascript
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION
  })
})
```

### Liveness Check

```javascript
app.get('/health/liveness', (req, res) => {
  // Check only process-level health
  const eventLoopLag = measureEventLoopLag()

  if (eventLoopLag > 1000) { // 1 second
    // Event loop severely blocked
    return res.status(503).json({
      status: 'unhealthy',
      reason: 'Event loop blocked',
      lag: eventLoopLag
    })
  }

  res.status(200).json({
    status: 'healthy'
  })
})
```

### Readiness Check

```javascript
app.get('/health/readiness', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    cache: await checkCache(),
    messageQueue: await checkMessageQueue()
  }

  const allHealthy = Object.values(checks).every(c => c.healthy)

  if (!allHealthy) {
    return res.status(503).json({
      status: 'not_ready',
      checks,
      timestamp: new Date().toISOString()
    })
  }

  res.status(200).json({
    status: 'ready',
    checks,
    timestamp: new Date().toISOString()
  })
})

async function checkDatabase() {
  try {
    await db.query('SELECT 1')
    return { healthy: true }
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    }
  }
}
```

### Detailed Health Check

```javascript
app.get('/health/detailed', async (req, res) => {
  const checks = await Promise.all([
    checkComponent('database', checkDatabase),
    checkComponent('cache', checkCache),
    checkComponent('messageQueue', checkMessageQueue),
    checkComponent('externalAPI', checkExternalAPI)
  ])

  const criticalFailed = checks.some(c =>
    c.critical && !c.healthy
  )

  const status = criticalFailed ? 503 : 200
  const overallStatus = criticalFailed ? 'unhealthy' :
    checks.some(c => !c.healthy) ? 'degraded' : 'healthy'

  res.status(status).json({
    status: overallStatus,
    checks: checks.reduce((acc, check) => {
      acc[check.name] = {
        healthy: check.healthy,
        latency: check.latency,
        error: check.error
      }
      return acc
    }, {}),
    timestamp: new Date().toISOString()
  })
})

async function checkComponent(name, checkFn) {
  const start = Date.now()
  try {
    await checkFn()
    return {
      name,
      healthy: true,
      latency: Date.now() - start
    }
  } catch (error) {
    return {
      name,
      healthy: false,
      latency: Date.now() - start,
      error: error.message
    }
  }
}
```

### Health Check Timeouts

Set aggressive timeouts for health checks:

```javascript
async function checkDatabase() {
  return Promise.race([
    db.query('SELECT 1'),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 2000)
    )
  ])
}
```

Health checks should never hang. If dependency is slow, report unhealthy.

### Cached Health Status

For expensive checks, cache results:

```javascript
let cachedHealthStatus = null
let lastHealthCheck = 0
const CACHE_TTL = 5000 // 5 seconds

app.get('/health', async (req, res) => {
  const now = Date.now()

  if (cachedHealthStatus && now - lastHealthCheck < CACHE_TTL) {
    return res.status(cachedHealthStatus.status)
      .json(cachedHealthStatus.body)
  }

  const health = await performHealthCheck()
  cachedHealthStatus = health
  lastHealthCheck = now

  res.status(health.status).json(health.body)
})
```

This prevents health checks from overwhelming dependencies.

### Health Check Authentication

Health check endpoints should generally be unauthenticated:
- Load balancers need quick access
- Don't want authentication failures to affect health
- Not exposing sensitive information

If needed, use IP whitelisting instead of authentication.

---

## Graceful Shutdown

### Why Graceful Shutdown

**Without graceful shutdown:**
- In-flight requests are dropped
- Client errors
- Data loss
- Incomplete transactions

**With graceful shutdown:**
- Complete in-flight requests
- Reject new requests
- Clean up resources
- No client errors

### Shutdown Signals

**SIGTERM (15):**
- Polite shutdown request
- Application should clean up and exit
- Default signal from orchestrators
- Gives time for cleanup (30 seconds in Kubernetes)

**SIGINT (2):**
- Interrupt signal (Ctrl+C)
- Should trigger graceful shutdown

**SIGKILL (9):**
- Immediate termination
- Cannot be caught or handled
- No cleanup possible
- Last resort

**Always handle SIGTERM. Don't rely on SIGKILL.**

### Shutdown Sequence

**Phase 1: Stop accepting new connections**
- Stop listening on port
- Or start returning 503 for new requests

**Phase 2: Complete in-flight requests**
- Wait for active requests to finish
- Set maximum wait time (e.g., 30 seconds)

**Phase 3: Close connections**
- Close keep-alive connections
- Close database connections
- Close message queue connections

**Phase 4: Cleanup**
- Flush logs
- Save state if needed
- Release file handles

**Phase 5: Exit**
- Exit process with code 0

### Implementation

```javascript
const server = app.listen(port)

// Track in-flight requests
let inFlightRequests = 0

app.use((req, res, next) => {
  inFlightRequests++
  res.on('finish', () => {
    inFlightRequests--
  })
  next()
})

// Graceful shutdown handler
async function shutdown(signal) {
  console.log(`Received ${signal}, starting graceful shutdown`)

  // Phase 1: Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed')
  })

  // Phase 2: Wait for in-flight requests
  const shutdownTimeout = 30000 // 30 seconds
  const start = Date.now()

  while (inFlightRequests > 0) {
    if (Date.now() - start > shutdownTimeout) {
      console.log(`Shutdown timeout, forcing exit with ${inFlightRequests} requests in flight`)
      break
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log('All requests completed')

  // Phase 3: Close connections
  await database.close()
  await cache.disconnect()
  await messageQueue.close()

  // Phase 4: Cleanup
  await flushLogs()

  // Phase 5: Exit
  console.log('Graceful shutdown complete')
  process.exit(0)
}

// Register signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
```

### Shutdown Timeout

Always set a maximum shutdown time:

```javascript
const SHUTDOWN_TIMEOUT = 30000 // 30 seconds

function shutdown(signal) {
  const forceShutdown = setTimeout(() => {
    console.error('Graceful shutdown timeout, forcing exit')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT)

  // Perform graceful shutdown
  performGracefulShutdown()
    .then(() => {
      clearTimeout(forceShutdown)
      process.exit(0)
    })
}
```

If graceful shutdown hangs, force exit after timeout.

### Rejecting New Requests

During shutdown, reject new requests:

```javascript
let isShuttingDown = false

app.use((req, res, next) => {
  if (isShuttingDown) {
    res.set('Connection', 'close')
    return res.status(503).json({
      error: 'Service shutting down',
      message: 'This instance is shutting down. Please retry.'
    })
  }
  next()
})

function shutdown() {
  isShuttingDown = true
  // ... rest of shutdown logic
}
```

---

## Connection Draining

### What Is Connection Draining

Connection draining is the process of closing long-lived connections gracefully during shutdown or removal from load balancer rotation.

### Load Balancer Connection Draining

When removing instance from rotation:

**Phase 1: Stop sending new requests**
- Load balancer stops routing new requests to instance
- Existing connections remain open

**Phase 2: Drain existing connections**
- Allow time for active requests to complete
- Typical: 30-300 seconds

**Phase 3: Force close remaining**
- After drain timeout, close remaining connections
- Instance can terminate

Configure drain timeout based on expected request duration.

### WebSocket Connection Draining

WebSocket connections are long-lived:

```javascript
const WebSocket = require('ws')
const wss = new WebSocket.Server({ server })

const connections = new Set()

wss.on('connection', (ws) => {
  connections.add(ws)

  ws.on('close', () => {
    connections.delete(ws)
  })
})

async function shutdown() {
  // Send close frame to all connections
  for (const ws of connections) {
    ws.send(JSON.stringify({
      type: 'shutdown',
      message: 'Server shutting down, please reconnect'
    }))
    ws.close(1001, 'Server shutting down')
  }

  // Wait for connections to close
  const timeout = 10000
  const start = Date.now()

  while (connections.size > 0 && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Force close remaining
  for (const ws of connections) {
    ws.terminate()
  }
}
```

### Database Connection Draining

Close database connections cleanly:

```javascript
async function shutdown() {
  // Stop accepting new connections
  pool.pause()

  // Wait for active queries to complete
  await waitForActiveQueries(30000)

  // Close all connections
  await pool.end()
}

async function waitForActiveQueries(timeout) {
  const start = Date.now()

  while (pool.activeConnections > 0) {
    if (Date.now() - start > timeout) {
      console.warn('Query timeout, forcing connection close')
      break
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}
```

### Stream Draining

For streaming responses:

```javascript
app.get('/stream', (req, res) => {
  const stream = createDataStream()

  // Clean shutdown: let stream finish
  stream.pipe(res)

  // On shutdown signal
  process.on('SIGTERM', () => {
    // Don't start new streams
    // Let existing streams complete or timeout
    setTimeout(() => {
      stream.destroy()
    }, 30000)
  })
})
```

---

## Startup and Initialization

### Startup Health

During startup, service may not be ready immediately:
- Connecting to database
- Loading configuration
- Warming caches
- Initializing connections

**Don't mark ready until initialization complete.**

### Initialization Pattern

```javascript
let isReady = false

async function initialize() {
  console.log('Starting initialization')

  // Connect to database
  await database.connect()

  // Connect to cache
  await cache.connect()

  // Load configuration
  await loadConfiguration()

  // Warm caches
  await warmCaches()

  isReady = true
  console.log('Initialization complete')
}

// Health checks
app.get('/health/liveness', (req, res) => {
  // Always healthy (process is alive)
  res.status(200).json({ status: 'healthy' })
})

app.get('/health/readiness', (req, res) => {
  if (!isReady) {
    return res.status(503).json({
      status: 'not_ready',
      message: 'Still initializing'
    })
  }

  res.status(200).json({ status: 'ready' })
})

// Start server
const server = app.listen(port, async () => {
  console.log('HTTP server started')
  await initialize()
})
```

### Fast vs Complete Initialization

**Fast Initialization:**
- Start HTTP server immediately
- Initialize dependencies in background
- Mark ready once critical dependencies initialized
- Continue warming caches after marked ready

**Complete Initialization:**
- Initialize everything before starting HTTP server
- Mark ready immediately on startup
- Longer startup time but fully prepared

Trade-off: Fast startup vs fully prepared service.

### Readiness Gates

Multiple initialization stages:

```javascript
const readinessChecks = {
  database: false,
  cache: false,
  configuration: false
}

async function initialize() {
  await database.connect()
  readinessChecks.database = true

  await cache.connect()
  readinessChecks.cache = true

  await loadConfiguration()
  readinessChecks.configuration = true
}

app.get('/health/readiness', (req, res) => {
  const allReady = Object.values(readinessChecks)
    .every(check => check === true)

  if (!allReady) {
    return res.status(503).json({
      status: 'not_ready',
      checks: readinessChecks
    })
  }

  res.status(200).json({
    status: 'ready',
    checks: readinessChecks
  })
})
```

---

## Production Patterns

### Rolling Deployments

For zero-downtime deployments:

**Phase 1: Deploy new version**
- New instances start
- Pass readiness checks
- Added to load balancer

**Phase 2: Shift traffic**
- Gradually route traffic to new version
- Monitor error rates and latency

**Phase 3: Drain old version**
- Remove old instances from load balancer
- Drain connections
- Shutdown gracefully

Health checks are critical for this to work.

### Blue-Green Deployments

Run old and new versions simultaneously:

**Setup:**
- Blue: current version
- Green: new version

**Switch:**
- Deploy green version
- Wait for health checks to pass
- Switch load balancer to green
- Keep blue running briefly for rollback

**Rollback:**
- If issues, switch back to blue immediately
- No deployment needed

### Canary Deployments

Gradually roll out to subset of traffic:

**Phase 1: Deploy canary**
- Deploy new version to small percentage (5%)
- Health checks pass
- Route 5% of traffic to canary

**Phase 2: Monitor**
- Compare error rates: canary vs stable
- Compare latency: canary vs stable
- Compare business metrics

**Phase 3: Expand or rollback**
- If good: expand to 25%, 50%, 100%
- If bad: rollback immediately

### Health Check Best Practices

**Keep it fast:** Health checks should complete in < 1 second ideally.

**Cache expensive checks:** Don't query database on every health check.

**Separate probes:** Liveness separate from readiness.

**Don't cascade:** Don't check health of dependencies of dependencies.

**Fail clearly:** Return specific errors for debugging.

**Monitor health checks:** Track health check failures and response times.

### Shutdown Best Practices

**Handle SIGTERM:** Always implement graceful shutdown for SIGTERM.

**Set timeout:** Force shutdown after maximum time.

**Reject new work:** Start returning 503 immediately on shutdown signal.

**Clean up resources:** Close connections, flush buffers, release locks.

**Coordinated shutdown:** In clustered systems, coordinate shutdown across instances.

### Testing

**Test health checks:**
- Verify correct responses
- Verify dependency failure detected
- Verify performance under load

**Test graceful shutdown:**
- Send SIGTERM during active requests
- Verify requests complete
- Verify resources cleaned up
- Verify no errors to clients

**Chaos testing:**
- Kill instances randomly
- Verify traffic shifts correctly
- Verify no user impact

### Monitoring

Track metrics:
- Health check success rate
- Time to become ready after startup
- Graceful shutdown duration
- Requests dropped during shutdown
- Connection drain time

Alert on:
- Repeated readiness failures
- Slow initialization
- Shutdown timeouts
- Dropped requests during shutdown
