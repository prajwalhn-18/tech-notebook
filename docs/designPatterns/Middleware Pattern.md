---
sidebar_position: 5
---

## Middleware Pattern in JS

The **Middleware Pattern** (also called **Chain of Responsibility**) passes a request through a **pipeline of handlers** — each handler can process, transform, or short-circuit the request.

Think of it like this:

> "Every request passes through a **chain of checkpoints**. Each checkpoint can do its job, pass it along, or stop it."

* * *

What is Middleware Pattern?
============================

It is a **behavioral design pattern** where:

*   a request travels through a **sequence of handlers**
*   each handler can act on the request, modify it, or stop the chain
*   handlers are **independent** and can be added/removed/reordered without affecting others

You use this pattern **every day** — it's the core of Express, Koa, Fastify, and most HTTP frameworks.

* * *

Real-world analogy
==================

Think of **airport security**:

1.  Ticket check — are you on the flight?
2.  ID check — is your identity valid?
3.  Baggage scan — anything suspicious?
4.  Body scan — final check

Each step is independent. If any step fails, you don't continue. If all pass, you board.

* * *

How Express Middleware Works
=============================

```js
app.use((req, res, next) => {
  // do something
  next(); // pass to next middleware
});
```

*   `req` — the incoming request
*   `res` — the response object
*   `next` — call to pass control to the next handler

This is the Middleware Pattern.

* * *

Building Your Own Middleware Pipeline
======================================

Understanding the internals helps you build custom pipelines beyond HTTP.

### The pipeline

```js
function createPipeline(middlewares) {
  return async function (context) {
    let index = 0;

    async function next() {
      if (index >= middlewares.length) return;
      const middleware = middlewares[index++];
      await middleware(context, next);
    }

    await next();
    return context;
  };
}
```

### Middlewares

```js
async function logger(ctx, next) {
  console.log(`[${new Date().toISOString()}] Processing: ${ctx.action}`);
  await next();
  console.log(`[done] ${ctx.action}`);
}

async function authenticate(ctx, next) {
  if (!ctx.user) throw new Error('Unauthenticated');
  await next();
}

async function authorize(requiredRole) {
  return async (ctx, next) => {
    if (ctx.user.role !== requiredRole) throw new Error('Forbidden');
    await next();
  };
}

async function validate(schema) {
  return async (ctx, next) => {
    const { error } = schema.validate(ctx.body);
    if (error) throw new Error(`Validation: ${error.message}`);
    await next();
  };
}
```

### Usage

```js
const pipeline = createPipeline([
  logger,
  authenticate,
  await authorize('admin'),
]);

const ctx = {
  action: 'deleteUser',
  user: { id: 1, role: 'admin' },
  body: { userId: 42 },
};

await pipeline(ctx);
```

* * *

Practical Express Middleware Examples
======================================

1) Request Logger
------------------

```js
// middleware/logger.js
export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      JSON.stringify({
        method:   req.method,
        path:     req.path,
        status:   res.statusCode,
        duration: `${duration}ms`,
        ip:       req.ip,
        userId:   req.user?.id,
      })
    );
  });

  next();
}
```

```js
app.use(requestLogger);
```

* * *

2) Authentication Middleware
-----------------------------

```js
// middleware/auth.js
import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

```js
// Apply to specific routes
router.get('/orders', authenticate, getOrders);
router.post('/orders', authenticate, createOrder);
```

* * *

3) Role-Based Authorization
----------------------------

```js
// middleware/authorize.js
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Requires one of: ${roles.join(', ')}`,
      });
    }

    next();
  };
}
```

```js
// Combine auth + role check
router.delete('/users/:id',  authenticate, authorize('admin'), deleteUser);
router.post('/reports',      authenticate, authorize('admin', 'manager'), createReport);
```

* * *

4) Request Validation Middleware
---------------------------------

```js
// middleware/validate.js
import Joi from 'joi';

export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message),
      });
    }

    req.body = value; // use validated + sanitized value
    next();
  };
}
```

```js
// schemas/order.js
import Joi from 'joi';

export const createOrderSchema = Joi.object({
  userId:  Joi.string().uuid().required(),
  items:   Joi.array().items(
    Joi.object({
      productId: Joi.string().required(),
      qty:       Joi.number().integer().min(1).required(),
    })
  ).min(1).required(),
});
```

```js
router.post('/orders',
  authenticate,
  validate(createOrderSchema),
  createOrder
);
```

* * *

5) Rate Limiter Middleware
---------------------------

```js
// middleware/rateLimit.js
const requestCounts = new Map(); // userId → { count, resetAt }

export function rateLimit({ maxRequests = 100, windowMs = 60_000 } = {}) {
  return (req, res, next) => {
    const key  = req.user?.id || req.ip;
    const now  = Date.now();
    const data = requestCounts.get(key);

    if (!data || now > data.resetAt) {
      requestCounts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (data.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((data.resetAt - now) / 1000),
      });
    }

    data.count++;
    next();
  };
}
```

```js
// Apply globally or per-route
app.use(rateLimit({ maxRequests: 200, windowMs: 60_000 }));

// Stricter limit on sensitive routes
router.post('/login', rateLimit({ maxRequests: 5, windowMs: 60_000 }), login);
```

* * *

6) Error Handling Middleware
-----------------------------

Express error middleware takes 4 arguments — Express detects this signature.

```js
// middleware/errorHandler.js
export function errorHandler(err, req, res, next) {
  console.error({
    message: err.message,
    stack:   err.stack,
    path:    req.path,
    method:  req.method,
    userId:  req.user?.id,
  });

  // Known app errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === 'NotFoundError') {
    return res.status(404).json({ error: err.message });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Unknown errors — don't leak internals
  res.status(500).json({ error: 'Internal server error' });
}
```

```js
// Must be registered LAST
app.use(errorHandler);
```

* * *

7) Async Error Wrapper
-----------------------

Async route handlers don't automatically forward errors to `next`. Wrap them:

```js
// middleware/asyncHandler.js
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

```js
// Without wrapper — uncaught async errors
router.get('/orders/:id', async (req, res) => {
  const order = await orderService.getOrder(req.params.id); // throws → unhandled
  res.json(order);
});

// With wrapper — errors reach errorHandler middleware
router.get('/orders/:id', asyncHandler(async (req, res) => {
  const order = await orderService.getOrder(req.params.id);
  res.json(order);
}));
```

* * *

Composing Middleware in a Consistent Pattern
=============================================

```js
// controllers/orderController.js
import { authenticate }    from '../middleware/auth.js';
import { authorize }       from '../middleware/authorize.js';
import { validate }        from '../middleware/validate.js';
import { asyncHandler }    from '../middleware/asyncHandler.js';
import { createOrderSchema } from '../schemas/order.js';

const orderMiddleware = [
  authenticate,
  authorize('user', 'admin'),
  validate(createOrderSchema),
];

router.post('/orders',
  ...orderMiddleware,
  asyncHandler(async (req, res) => {
    const order = await orderService.placeOrder(req.user.id, req.body.items);
    res.status(201).json(order);
  })
);
```

Every concern is its own middleware. The route handler contains **only business logic**.

* * *

Non-HTTP Use Cases
==================

Middleware pattern isn't just for HTTP. Use it for:

### Job Queue Pipeline

```js
async function processJob(job) {
  const pipeline = createPipeline([
    logJob,
    validateJobPayload,
    deduplicateJob,
    executeJob,
    markJobComplete,
  ]);

  await pipeline({ job });
}
```

### Event Processing Pipeline

```js
const eventPipeline = createPipeline([
  enrichEventWithUserData,
  filterSpamEvents,
  transformEventSchema,
  publishToKafka,
]);

await eventPipeline({ event: incomingEvent });
```

### Data Import Pipeline

```js
const importPipeline = createPipeline([
  parseCsv,
  validateRows,
  deduplicateRows,
  enrichWithExternalData,
  batchInsertToDb,
  sendSummaryEmail,
]);

await importPipeline({ filePath: 'orders.csv' });
```

* * *

Benefits
========

1\. **Separation of concerns** — each middleware does one thing.

2\. **Composable** — mix and match middlewares across routes.

3\. **Reusable** — `authenticate` and `rateLimit` work on any route.

4\. **Testable** — test each middleware in isolation.

```js
test('authenticate rejects missing token', () => {
  const req  = { headers: {} };
  const res  = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  authenticate(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});
```

5\. **Short-circuit on failure** — any handler can stop the chain (return without calling `next()`).

* * *

When to use Middleware Pattern
================================

*   HTTP request lifecycle (auth, validation, logging, rate limiting)
*   Processing pipelines (ETL, event processing, job queues)
*   Plugin systems where external code hooks into your flow
*   Anywhere you have a sequence of independent processing steps

* * *

When NOT to use it
==================

*   when steps have complex dependencies and must share state in non-obvious ways
*   when the sequence is fixed and simple — just call functions sequentially
*   when the indirection makes it hard to trace the execution flow

* * *

Interview definition (short answer)
=====================================

> "Middleware Pattern (Chain of Responsibility) passes a request through a pipeline of handlers. Each handler can process the request, modify it, or stop the chain. It decouples the sender from the handlers and makes behavior composable."

* * *

Formula:

```
Request → [Middleware1 → Middleware2 → Middleware3 → ...] → Response
                          ↑ any can short-circuit
```
