# Observability: Metrics, Events, Traces, and Logs

Observability is the ability to understand the internal state of a system by examining its outputs. Modern observability is built on three pillars: metrics, traces, and logs, with events as a fourth emerging pillar.

## The Three Pillars of Observability

```
┌─────────────────────────────────────────────┐
│         OBSERVABILITY PLATFORM              │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ METRICS  │  │ TRACES   │  │  LOGS    │ │
│  │          │  │          │  │          │ │
│  │ Numbers  │  │ Journeys │  │ Records  │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │         EVENTS (Emerging)          │    │
│  │     Structured State Changes       │    │
│  └────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## 1. Metrics

Metrics are numerical measurements over time that represent the health and performance of your system.

### Types of Metrics

#### Counters
Monotonically increasing values (only go up, reset on restart).

```javascript
// Prometheus example
const { Counter } = require('prom-client');

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'status', 'endpoint']
});

// Increment counter
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestsTotal.inc({
      method: req.method,
      status: res.statusCode,
      endpoint: req.route?.path || 'unknown'
    });
  });
  next();
});
```

#### Gauges
Values that can go up or down (current state).

```javascript
const { Gauge } = require('prom-client');

const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active database connections'
});

const memoryUsage = new Gauge({
  name: 'memory_usage_bytes',
  help: 'Current memory usage in bytes'
});

// Update gauge
setInterval(() => {
  activeConnections.set(pool.activeCount);
  memoryUsage.set(process.memoryUsage().heapUsed);
}, 5000);
```

#### Histograms
Distribution of values (e.g., request duration, response sizes).

```javascript
const { Histogram } = require('prom-client');

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'status', 'endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5] // Define buckets for grouping
});

// Measure duration
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.observe(
      {
        method: req.method,
        status: res.statusCode,
        endpoint: req.route?.path || 'unknown'
      },
      duration
    );
  });
  next();
});
```

#### Summaries
Similar to histograms but calculate quantiles on the client side.

```javascript
const { Summary } = require('prom-client');

const responseSize = new Summary({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['endpoint'],
  percentiles: [0.5, 0.9, 0.95, 0.99]
});
```

### Key Metrics to Track

#### Application Metrics

```javascript
// RED Method: Rate, Errors, Duration
class ApplicationMetrics {
  constructor() {
    // Rate: Request rate
    this.requestRate = new Counter({
      name: 'app_requests_total',
      help: 'Total requests',
      labelNames: ['service', 'endpoint', 'method']
    });

    // Errors: Error rate
    this.errorRate = new Counter({
      name: 'app_errors_total',
      help: 'Total errors',
      labelNames: ['service', 'type', 'endpoint']
    });

    // Duration: Response time
    this.requestDuration = new Histogram({
      name: 'app_request_duration_seconds',
      help: 'Request duration',
      labelNames: ['service', 'endpoint'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
    });
  }

  trackRequest(service, endpoint, method, duration, error = null) {
    this.requestRate.inc({ service, endpoint, method });
    this.requestDuration.observe({ service, endpoint }, duration);

    if (error) {
      this.errorRate.inc({
        service,
        type: error.constructor.name,
        endpoint
      });
    }
  }
}
```

#### Infrastructure Metrics

```javascript
// USE Method: Utilization, Saturation, Errors
class InfrastructureMetrics {
  constructor() {
    // CPU Utilization
    this.cpuUtilization = new Gauge({
      name: 'cpu_utilization_percent',
      help: 'CPU utilization percentage'
    });

    // Memory Utilization
    this.memoryUtilization = new Gauge({
      name: 'memory_utilization_percent',
      help: 'Memory utilization percentage'
    });

    // Disk I/O Saturation
    this.diskIOQueue = new Gauge({
      name: 'disk_io_queue_length',
      help: 'Disk I/O queue length'
    });

    // Network Errors
    this.networkErrors = new Counter({
      name: 'network_errors_total',
      help: 'Total network errors',
      labelNames: ['interface', 'type']
    });
  }

  collectSystemMetrics() {
    const usage = process.cpuUsage();
    const mem = process.memoryUsage();

    this.cpuUtilization.set(
      (usage.user + usage.system) / 1000000 // microseconds to seconds
    );

    this.memoryUtilization.set(
      (mem.heapUsed / mem.heapTotal) * 100
    );
  }
}
```

#### Business Metrics

```javascript
class BusinessMetrics {
  constructor() {
    this.ordersProcessed = new Counter({
      name: 'orders_processed_total',
      help: 'Total orders processed',
      labelNames: ['status', 'payment_method']
    });

    this.revenue = new Counter({
      name: 'revenue_total',
      help: 'Total revenue',
      labelNames: ['currency', 'product_category']
    });

    this.activeUsers = new Gauge({
      name: 'active_users',
      help: 'Number of active users',
      labelNames: ['tier']
    });

    this.cartConversionRate = new Gauge({
      name: 'cart_conversion_rate',
      help: 'Percentage of carts that convert to orders'
    });
  }

  trackOrder(order) {
    this.ordersProcessed.inc({
      status: order.status,
      payment_method: order.paymentMethod
    });

    this.revenue.inc(
      { currency: order.currency, product_category: order.category },
      order.amount
    );
  }
}
```

### Metrics Aggregation and PromQL

```promql
# Average request duration over 5 minutes
rate(http_request_duration_seconds_sum[5m]) /
rate(http_request_duration_seconds_count[5m])

# 95th percentile response time
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket[5m])
)

# Error rate percentage
(
  rate(http_requests_total{status=~"5.."}[5m]) /
  rate(http_requests_total[5m])
) * 100

# Top 5 slowest endpoints
topk(5,
  rate(http_request_duration_seconds_sum[5m]) /
  rate(http_request_duration_seconds_count[5m])
) by (endpoint)

# Requests per second by service
sum(rate(http_requests_total[1m])) by (service)
```

## 2. Distributed Tracing

Tracing tracks requests as they flow through distributed systems, showing the journey and timing of each operation.

### OpenTelemetry Tracing

```javascript
const opentelemetry = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

// Initialize tracer
const sdk = new opentelemetry.NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: 'http://localhost:14268/api/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Manual instrumentation
const { trace } = require('@opentelemetry/api');

class UserService {
  async getUser(userId) {
    const tracer = trace.getTracer('user-service');

    return tracer.startActiveSpan('getUser', async (span) => {
      try {
        // Set attributes
        span.setAttribute('user.id', userId);
        span.setAttribute('service.name', 'user-service');

        // Database query (auto-instrumented)
        const user = await this.db.findUser(userId);

        // Add events
        span.addEvent('user_found', {
          username: user.username
        });

        // Nested span
        await tracer.startActiveSpan('enrichUserData', async (childSpan) => {
          user.profile = await this.getProfile(userId);
          childSpan.end();
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return user;

      } catch (error) {
        // Record exception
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

### Span Context and Propagation

```javascript
// Express middleware for trace context propagation
const { context, propagation, trace } = require('@opentelemetry/api');

function tracingMiddleware(req, res, next) {
  const tracer = trace.getTracer('api-gateway');

  // Extract context from incoming request headers
  const parentContext = propagation.extract(
    context.active(),
    req.headers
  );

  const span = tracer.startSpan(
    `${req.method} ${req.path}`,
    {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.host': req.hostname,
        'http.user_agent': req.get('user-agent')
      }
    },
    parentContext
  );

  // Inject context into outgoing requests
  const headers = {};
  propagation.inject(
    trace.setSpan(context.active(), span),
    headers
  );

  // Make span available to request handlers
  req.span = span;
  req.traceHeaders = headers;

  res.on('finish', () => {
    span.setAttribute('http.status_code', res.statusCode);
    span.end();
  });

  next();
}
```

### Distributed Trace Example

```javascript
// Service A: API Gateway
async function handleRequest(req, res) {
  const tracer = trace.getTracer('api-gateway');

  await tracer.startActiveSpan('handleOrder', async (span) => {
    span.setAttribute('order.id', req.body.orderId);

    try {
      // Call Service B
      const user = await callUserService(req.body.userId, req.traceHeaders);
      span.addEvent('user_retrieved');

      // Call Service C
      const payment = await callPaymentService(
        req.body.paymentInfo,
        req.traceHeaders
      );
      span.addEvent('payment_processed');

      // Call Service D
      const inventory = await callInventoryService(
        req.body.items,
        req.traceHeaders
      );
      span.addEvent('inventory_reserved');

      res.json({ success: true, orderId: req.body.orderId });
    } catch (error) {
      span.recordException(error);
      res.status(500).json({ error: error.message });
    } finally {
      span.end();
    }
  });
}

// Helper for making traced HTTP calls
async function makeTracedRequest(url, data, traceHeaders) {
  const tracer = trace.getTracer('api-gateway');

  return tracer.startActiveSpan('http_request', async (span) => {
    span.setAttribute('http.url', url);
    span.setAttribute('http.method', 'POST');

    try {
      const response = await axios.post(url, data, {
        headers: {
          ...traceHeaders,
          'Content-Type': 'application/json'
        }
      });

      span.setAttribute('http.status_code', response.status);
      return response.data;
    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### Trace Analysis Patterns

```javascript
// Analyzing trace data
class TraceAnalyzer {
  // Find slow spans
  findSlowSpans(trace, threshold = 1000) {
    return trace.spans.filter(span =>
      span.duration > threshold
    );
  }

  // Calculate critical path
  getCriticalPath(trace) {
    const spans = trace.spans.sort((a, b) =>
      a.startTime - b.startTime
    );

    let currentEnd = 0;
    const criticalPath = [];

    for (const span of spans) {
      if (span.startTime >= currentEnd) {
        criticalPath.push(span);
        currentEnd = span.startTime + span.duration;
      }
    }

    return criticalPath;
  }

  // Identify bottlenecks
  identifyBottlenecks(traces) {
    const spanDurations = new Map();

    traces.forEach(trace => {
      trace.spans.forEach(span => {
        if (!spanDurations.has(span.name)) {
          spanDurations.set(span.name, []);
        }
        spanDurations.get(span.name).push(span.duration);
      });
    });

    // Calculate p95 for each span type
    const bottlenecks = [];
    spanDurations.forEach((durations, spanName) => {
      const p95 = this.percentile(durations, 0.95);
      if (p95 > 500) { // 500ms threshold
        bottlenecks.push({ spanName, p95 });
      }
    });

    return bottlenecks.sort((a, b) => b.p95 - a.p95);
  }

  percentile(values, p) {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }
}
```

## 3. Structured Logging

Logs provide detailed records of events that occur in your system.

### Structured Logging with Winston

```javascript
const winston = require('winston');

// Create structured logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'user-service',
    version: '1.0.0',
    environment: process.env.NODE_ENV
  },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // File output
    new winston.transports.File({
      filename: 'error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'combined.log'
    })
  ]
});

// Usage examples
logger.info('User login', {
  userId: '12345',
  username: 'john.doe',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});

logger.error('Database connection failed', {
  error: error.message,
  stack: error.stack,
  database: 'users-db',
  host: 'db.example.com',
  retryAttempt: 3
});

logger.warn('High memory usage', {
  memoryUsed: process.memoryUsage().heapUsed,
  memoryTotal: process.memoryUsage().heapTotal,
  percentage: 85
});
```

### Context-Aware Logging

```javascript
const { AsyncLocalStorage } = require('async_hooks');
const asyncLocalStorage = new AsyncLocalStorage();

// Middleware to create request context
function requestContextMiddleware(req, res, next) {
  const requestId = req.get('X-Request-ID') || generateId();
  const traceId = req.span?.spanContext().traceId;

  const context = {
    requestId,
    traceId,
    userId: req.user?.id,
    path: req.path,
    method: req.method
  };

  asyncLocalStorage.run(context, () => {
    next();
  });
}

// Enhanced logger that includes context
class ContextLogger {
  log(level, message, meta = {}) {
    const context = asyncLocalStorage.getStore() || {};

    logger.log(level, message, {
      ...context,
      ...meta,
      timestamp: new Date().toISOString()
    });
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  error(message, meta) {
    this.log('error', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  debug(message, meta) {
    this.log('debug', message, meta);
  }
}

const contextLogger = new ContextLogger();

// Usage - automatically includes request context
app.get('/api/users/:id', async (req, res) => {
  contextLogger.info('Fetching user', { userId: req.params.id });

  try {
    const user = await userService.getUser(req.params.id);
    contextLogger.info('User fetched successfully');
    res.json(user);
  } catch (error) {
    contextLogger.error('Failed to fetch user', {
      error: error.message
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Log Levels and Sampling

```javascript
// Dynamic log level adjustment
class DynamicLogger {
  constructor() {
    this.baseLevel = 'info';
    this.rules = [];
  }

  addRule(condition, level) {
    this.rules.push({ condition, level });
  }

  shouldLog(level, context) {
    // Check rules
    for (const rule of this.rules) {
      if (rule.condition(context)) {
        return this.compareLevels(level, rule.level);
      }
    }

    // Default to base level
    return this.compareLevels(level, this.baseLevel);
  }

  compareLevels(level, threshold) {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(threshold);
  }
}

const dynamicLogger = new DynamicLogger();

// Log everything for specific users
dynamicLogger.addRule(
  (ctx) => ctx.userId === 'debug-user',
  'debug'
);

// Log only errors in production
dynamicLogger.addRule(
  (ctx) => process.env.NODE_ENV === 'production',
  'error'
);

// Sample logs (only log 10% of info logs)
class SamplingLogger {
  constructor(baseLogger, sampleRate = 0.1) {
    this.baseLogger = baseLogger;
    this.sampleRate = sampleRate;
  }

  info(message, meta) {
    if (Math.random() < this.sampleRate || meta.important) {
      this.baseLogger.info(message, meta);
    }
  }

  // Always log errors and warnings
  error(message, meta) {
    this.baseLogger.error(message, meta);
  }

  warn(message, meta) {
    this.baseLogger.warn(message, meta);
  }
}
```

## 4. Events

Events represent discrete state changes or significant occurrences in your system.

### Event Schema

```javascript
// Standardized event structure
class SystemEvent {
  constructor(type, data) {
    this.id = generateUUID();
    this.type = type;
    this.timestamp = new Date().toISOString();
    this.data = data;
    this.metadata = {
      service: process.env.SERVICE_NAME,
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION
    };
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      data: this.data,
      metadata: this.metadata
    };
  }
}

// Event types
const EventTypes = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  ORDER_PLACED: 'order.placed',
  ORDER_FULFILLED: 'order.fulfilled',
  PAYMENT_PROCESSED: 'payment.processed',
  SYSTEM_ERROR: 'system.error',
  PERFORMANCE_DEGRADATION: 'performance.degradation'
};
```

### Event Bus Implementation

```javascript
class EventBus {
  constructor() {
    this.handlers = new Map();
    this.eventStore = [];
  }

  subscribe(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }

  async publish(event) {
    // Store event
    this.eventStore.push(event);

    // Emit metrics
    eventCounter.inc({ type: event.type });

    // Log event
    logger.info('Event published', {
      eventId: event.id,
      eventType: event.type,
      data: event.data
    });

    // Execute handlers
    const handlers = this.handlers.get(event.type) || [];
    await Promise.all(
      handlers.map(handler =>
        this.executeHandler(handler, event)
      )
    );
  }

  async executeHandler(handler, event) {
    try {
      await handler(event);
    } catch (error) {
      logger.error('Event handler failed', {
        eventId: event.id,
        eventType: event.type,
        error: error.message,
        handler: handler.name
      });
    }
  }

  getEvents(filter = {}) {
    return this.eventStore.filter(event => {
      if (filter.type && event.type !== filter.type) {
        return false;
      }
      if (filter.since && new Date(event.timestamp) < filter.since) {
        return false;
      }
      return true;
    });
  }
}

const eventBus = new EventBus();

// Subscribe to events
eventBus.subscribe(EventTypes.ORDER_PLACED, async (event) => {
  await sendOrderConfirmationEmail(event.data);
});

eventBus.subscribe(EventTypes.ORDER_PLACED, async (event) => {
  await updateInventory(event.data.items);
});

// Publish events
async function placeOrder(orderData) {
  const order = await createOrder(orderData);

  const event = new SystemEvent(EventTypes.ORDER_PLACED, {
    orderId: order.id,
    userId: order.userId,
    items: order.items,
    totalAmount: order.totalAmount
  });

  await eventBus.publish(event);

  return order;
}
```

## 5. Unified Observability

### Correlation Between Pillars

```javascript
class ObservabilityContext {
  constructor() {
    this.traceId = generateTraceId();
    this.requestId = generateRequestId();
    this.userId = null;
  }

  // Create logger with trace context
  getLogger() {
    return logger.child({
      traceId: this.traceId,
      requestId: this.requestId,
      userId: this.userId
    });
  }

  // Create span with request context
  startSpan(name) {
    const span = tracer.startSpan(name);
    span.setAttribute('request.id', this.requestId);
    span.setAttribute('trace.id', this.traceId);
    if (this.userId) {
      span.setAttribute('user.id', this.userId);
    }
    return span;
  }

  // Record metric with context labels
  recordMetric(metric, value) {
    metric.observe(
      {
        traceId: this.traceId,
        userId: this.userId || 'anonymous'
      },
      value
    );
  }

  // Publish event with context
  async publishEvent(eventType, data) {
    const event = new SystemEvent(eventType, data);
    event.metadata.traceId = this.traceId;
    event.metadata.requestId = this.requestId;
    event.metadata.userId = this.userId;

    await eventBus.publish(event);
  }
}

// Usage
app.use((req, res, next) => {
  const obsContext = new ObservabilityContext();
  obsContext.userId = req.user?.id;
  req.obs = obsContext;
  next();
});

app.post('/api/orders', async (req, res) => {
  const { obs } = req;
  const log = obs.getLogger();

  const span = obs.startSpan('createOrder');
  const startTime = Date.now();

  try {
    log.info('Creating order', { items: req.body.items });

    const order = await orderService.create(req.body);

    await obs.publishEvent(EventTypes.ORDER_PLACED, order);

    const duration = (Date.now() - startTime) / 1000;
    obs.recordMetric(orderDurationMetric, duration);

    log.info('Order created successfully', { orderId: order.id });
    res.json(order);

  } catch (error) {
    log.error('Order creation failed', { error: error.message });
    span.recordException(error);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    span.end();
  }
});
```

## 6. Alerting and Dashboards

### Alert Rules

```yaml
# Prometheus alerting rules
groups:
  - name: application
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[5m])) /
            sum(rate(http_requests_total[5m]))
          ) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # Slow response time
      - alert: SlowResponseTime
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket[5m])
          ) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow response time (p95 > 2s)"

      # High memory usage
      - alert: HighMemoryUsage
        expr: memory_utilization_percent > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage: {{ $value }}%"
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Application Observability",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (service)"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) by (service) / sum(rate(http_requests_total[5m])) by (service)"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Active Users",
        "targets": [
          {
            "expr": "active_users"
          }
        ]
      }
    ]
  }
}
```

## Best Practices

### 1. Cardinality Management
```javascript
// BAD: High cardinality labels
userMetric.inc({ userId: userId }); // Could be millions of users

// GOOD: Low cardinality labels
userMetric.inc({ userTier: 'premium' }); // Only a few tiers
```

### 2. Consistent Naming
```javascript
// Follow naming conventions
// Metrics: <namespace>_<subsystem>_<name>_<unit>
http_server_requests_total
http_server_request_duration_seconds
db_connection_pool_size

// Logs: Use consistent fields
logger.info('message', {
  service: 'user-service',
  operation: 'getUser',
  userId: '123',
  duration: 45
});
```

### 3. Sampling for High-Volume Systems
```javascript
// Sample traces
const sampler = new TraceIdRatioBasedSampler(0.1); // 10% sampling

// Sample logs
if (Math.random() < 0.01 || isImportant(event)) {
  logger.info(message);
}
```

### 4. Avoid Over-Instrumentation
```javascript
// Don't instrument every single line
// Focus on:
// - Service boundaries
// - External calls
// - Critical business logic
// - Error paths
```

## Tools and Platforms

- **Metrics**: Prometheus, Grafana, Datadog, New Relic
- **Tracing**: Jaeger, Zipkin, Tempo, AWS X-Ray
- **Logging**: ELK Stack, Loki, Splunk, Datadog
- **All-in-One**: Datadog, New Relic, Dynatrace, Honeycomb
- **Open Source**: OpenTelemetry, Prometheus, Grafana Stack

## Summary

Effective observability requires:
1. **Metrics** for aggregate system health
2. **Traces** for request flow understanding
3. **Logs** for detailed debugging
4. **Events** for state change tracking
5. **Correlation** between all signals
6. **Alerting** for proactive issue detection
7. **Dashboards** for visualization
