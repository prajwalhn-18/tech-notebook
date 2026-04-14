---
sidebar_position: 2
---

## API Design

A well-designed API is a **contract** between your service and its consumers. Bad API design creates breaking changes, confuses clients, and costs weeks of backward-compatibility work. Good API design ages gracefully.

* * *

REST Principles
===============

REST (Representational State Transfer) is an architectural style, not a protocol. The key constraints:

### 1. Resources, not actions

URLs identify **things** (nouns), not operations (verbs).

```
# Bad — verbs in URL
POST /createOrder
GET  /getUser?id=42
POST /deleteProduct/99

# Good — nouns, HTTP method carries the action
POST   /orders
GET    /users/42
DELETE /products/99
```

### 2. HTTP methods have meaning

| Method | Purpose | Idempotent? | Safe? |
|--------|---------|-------------|-------|
| `GET` | Read a resource | Yes | Yes |
| `POST` | Create a resource | No | No |
| `PUT` | Replace a resource entirely | Yes | No |
| `PATCH` | Partially update a resource | No | No |
| `DELETE` | Remove a resource | Yes | No |

**Idempotent** — calling it multiple times has the same effect as calling it once.
**Safe** — calling it has no side effects (read-only).

* * *

URL Structure
=============

```
# Collection
GET    /orders          → list all orders
POST   /orders          → create a new order

# Single resource
GET    /orders/123      → get order 123
PUT    /orders/123      → replace order 123
PATCH  /orders/123      → update fields of order 123
DELETE /orders/123      → delete order 123

# Nested resources (use sparingly — max 2 levels)
GET    /users/42/orders         → orders belonging to user 42
POST   /users/42/orders         → create order for user 42
GET    /users/42/orders/123     → specific order of user 42

# Actions that don't fit CRUD (use sub-resources)
POST   /orders/123/cancel       → cancel an order
POST   /orders/123/ship         → ship an order
POST   /payments/123/refund     → refund a payment
```

**Rules:**
- Lowercase, hyphen-separated: `/order-items` not `/orderItems`
- Plural nouns for collections: `/orders` not `/order`
- No trailing slash: `/users/42` not `/users/42/`
- Avoid deep nesting beyond 2 levels

* * *

HTTP Status Codes
==================

Use the right status code — it's part of the contract.

```
2xx — Success
  200 OK              → successful GET, PATCH, PUT
  201 Created         → successful POST (include Location header)
  204 No Content      → successful DELETE, or PATCH with no body

4xx — Client error (caller's fault)
  400 Bad Request     → invalid input, validation failed
  401 Unauthorized    → not authenticated (missing/invalid token)
  403 Forbidden       → authenticated but not allowed
  404 Not Found       → resource doesn't exist
  409 Conflict        → state conflict (duplicate email, optimistic lock)
  410 Gone            → resource permanently deleted
  422 Unprocessable   → syntactically valid but semantically wrong
  429 Too Many Req    → rate limit exceeded

5xx — Server error (your fault)
  500 Internal Error  → unexpected server error
  502 Bad Gateway     → upstream service failed
  503 Unavailable     → service down, overloaded
  504 Gateway Timeout → upstream timed out
```

Never return `200 OK` with `{ "error": "not found" }` in the body. That breaks every HTTP client and monitoring tool.

* * *

Error Response Format
======================

Consistent, parseable error responses.

```js
// Standard error shape
{
  "error": {
    "code": "VALIDATION_ERROR",      // machine-readable, stable
    "message": "Validation failed",  // human-readable summary
    "details": [                     // optional, field-level detail
      { "field": "email", "message": "Must be a valid email address" },
      { "field": "qty",   "message": "Must be a positive integer" }
    ],
    "requestId": "req_abc123"        // for log correlation
  }
}
```

```js
// Express error handler
function errorHandler(err, req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.details,
        requestId,
      }
    });
  }

  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `${err.resource} not found`,
        requestId,
      }
    });
  }

  // Unknown — don't leak internals
  console.error({ requestId, err });
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    }
  });
}
```

* * *

Request & Response Design
==========================

### Wrap responses in a consistent envelope

```js
// Single resource
GET /orders/123
{
  "data": {
    "id": "123",
    "status": "SHIPPED",
    "total": 2499,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}

// Collection
GET /orders
{
  "data": [...],
  "pagination": {
    "total": 1540,
    "page": 1,
    "pageSize": 20,
    "hasNextPage": true
  }
}

// Creation
POST /orders → 201 Created
Location: /orders/124
{
  "data": { "id": "124", ... }
}
```

This makes it easy to add metadata (pagination, warnings) without breaking existing clients.

* * *

Pagination
===========

### Offset-based (simple but problematic at scale)

```
GET /orders?page=2&pageSize=20
GET /orders?offset=40&limit=20
```

```js
{
  "data": [...],
  "pagination": {
    "total": 1540,
    "page": 2,
    "pageSize": 20,
    "totalPages": 77,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

**Problem:** If a record is inserted/deleted while paginating, results skip or duplicate. Fine for admin dashboards, bad for feeds.

### Cursor-based (scalable, stable)

```
GET /orders?limit=20
GET /orders?limit=20&cursor=eyJpZCI6IjEyMyJ9
```

```js
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6IjE0MyJ9",  // base64 encoded { id: "143" }
    "hasNextPage": true
  }
}
```

**Advantages:** Consistent results even with inserts/deletes. Works with indexed columns. No `COUNT(*)` query.

**Use cursor-based** for: feeds, timelines, large datasets, infinite scroll.

* * *

Filtering, Sorting, Field Selection
=====================================

```
# Filtering
GET /orders?status=SHIPPED&userId=42
GET /orders?createdAfter=2024-01-01&createdBefore=2024-02-01

# Sorting
GET /orders?sort=createdAt&order=desc
GET /products?sort=price&order=asc

# Field selection (sparse fieldsets)
GET /users/42?fields=id,name,email

# Search
GET /products?q=wireless+headphones
```

Implement only what clients actually need. Don't over-engineer.

* * *

Idempotency
============

**Idempotency** means calling an operation multiple times has the same effect as calling it once.

Critical for: payments, order creation, any non-GET operation that must not duplicate.

### Idempotency Keys

Client sends a unique key per request. Server deduplicates.

```
POST /orders
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

{ "userId": "42", "items": [...] }
```

```js
async function createOrder(req, res) {
  const idempotencyKey = req.headers['idempotency-key'];

  if (idempotencyKey) {
    const cached = await redis.get(`idempotency:${idempotencyKey}`);
    if (cached) {
      // Return the same response as the original request
      return res.status(200).json(JSON.parse(cached));
    }
  }

  const order = await orderService.create(req.body);

  if (idempotencyKey) {
    // Cache for 24 hours
    await redis.set(
      `idempotency:${idempotencyKey}`,
      JSON.stringify({ data: order }),
      86400
    );
  }

  res.status(201).json({ data: order });
}
```

Now if the client retries due to a network timeout, they won't create a duplicate order.

* * *

API Versioning
==============

APIs change. Versioning lets you evolve without breaking existing clients.

### URL versioning (most common)

```
/api/v1/orders
/api/v2/orders
```

```js
// Express routing
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);
```

Simple, visible, easy to route and cache. Most REST APIs use this.

### Header versioning

```
GET /orders
API-Version: 2024-01-15
```

Cleaner URLs but harder to test in a browser.

### When to bump the version

**Breaking changes** require a new version:
- Removing a field
- Renaming a field
- Changing a field's type
- Changing HTTP status codes
- Removing an endpoint

**Non-breaking changes** don't:
- Adding new optional fields to responses
- Adding new endpoints
- Adding new optional query parameters

* * *

Request Validation
===================

Validate at the API boundary. Don't let bad data reach your business logic.

```js
import Joi from 'joi';

const createOrderSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  items: Joi.array().items(
    Joi.object({
      productId: Joi.string().required(),
      qty: Joi.number().integer().min(1).max(100).required(),
    })
  ).min(1).required(),
  deliveryAddress: Joi.object({
    line1:   Joi.string().max(255).required(),
    city:    Joi.string().max(100).required(),
    country: Joi.string().length(2).uppercase().required(), // ISO 3166
    pincode: Joi.string().pattern(/^\d{6}$/).required(),
  }).required(),
});

router.post('/orders', validate(createOrderSchema), asyncHandler(createOrder));
```

* * *

API Security Essentials
========================

### Authentication

```
Authorization: Bearer <jwt-token>
```

- Use JWTs for stateless auth
- Short-lived access tokens (15min) + long-lived refresh tokens (7d)
- Rotate refresh tokens on use (token rotation)

### Never expose internals

```js
// Bad — leaks DB structure
{ "id": 1, "user_id": 42, "postgres_table": "orders_2024" }

// Good — clean API shape
{ "id": "ord_abc123", "userId": "usr_xyz789" }
```

Use opaque IDs (`ord_abc123`) instead of sequential integers — prevents enumeration attacks.

### Rate limiting headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1705320000
Retry-After: 60   (on 429)
```

* * *

HATEOAS (know the concept, rarely implement fully)
===================================================

Hypermedia as the Engine of Application State — responses include links to related actions.

```js
{
  "data": {
    "id": "123",
    "status": "PENDING"
  },
  "_links": {
    "self":   { "href": "/orders/123" },
    "pay":    { "href": "/orders/123/pay",    "method": "POST" },
    "cancel": { "href": "/orders/123/cancel", "method": "POST" }
  }
}
```

Clients discover available actions from the response — no hardcoded URLs.

In practice: few APIs implement full HATEOAS. But including `_links` for related resources is a good pattern.

* * *

API Documentation
==================

Good documentation is part of the API.

### OpenAPI / Swagger

```yaml
# openapi.yaml
openapi: 3.0.0
info:
  title: Orders API
  version: 2.0.0

paths:
  /orders:
    post:
      summary: Create a new order
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
      responses:
        '201':
          description: Order created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '400':
          $ref: '#/components/responses/ValidationError'
        '401':
          $ref: '#/components/responses/Unauthorized'
```

Auto-generates interactive docs (Swagger UI) and client SDKs.

* * *

When to use REST vs other paradigms
=====================================

| Paradigm | Best for |
|---|---|
| **REST** | Public APIs, CRUD resources, external integrations |
| **GraphQL** | Complex queries, mobile (bandwidth sensitive), BFF pattern |
| **gRPC** | Internal service-to-service (high performance, binary) |
| **WebSocket** | Real-time bidirectional (chat, live updates) |
| **Webhooks** | Async notifications to external systems |

* * *

Interview definition (short answer)
=====================================

> "Good API design means: stable resource-based URLs, correct HTTP semantics, consistent error shapes, versioning strategy, idempotency for mutations, and validation at the boundary. An API is a public contract — breaking changes must be versioned."
