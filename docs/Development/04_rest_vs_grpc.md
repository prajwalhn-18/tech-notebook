---
sidebar_position: 4
---

# REST vs gRPC

When building APIs and microservices, choosing the right communication protocol is a foundational decision. REST and gRPC are two dominant approaches — each with distinct trade-offs in performance, developer experience, and use-case fit.

---

## What is REST?

**REST (Representational State Transfer)** is an architectural style for distributed hypermedia systems, defined by Roy Fielding in 2000. It uses standard HTTP methods and treats everything as a resource identified by a URL.

### Core Principles

- **Stateless**: Each request carries all necessary context; the server stores no session state.
- **Resource-based**: Entities are modeled as resources (`/users/42`, `/orders/99`).
- **Uniform interface**: Interactions use standard HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
- **Layered system**: Clients interact with the API without knowing if there are proxies, caches, or load balancers in between.
- **Cacheable**: Responses can be cached using standard HTTP headers.

### A Simple REST Example

```http
GET /users/42 HTTP/1.1
Host: api.example.com
Accept: application/json
```

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 42,
  "name": "Alice",
  "email": "alice@example.com"
}
```

---

## What is gRPC?

**gRPC** (Google Remote Procedure Call) is a high-performance, open-source RPC framework developed by Google in 2015. It uses **Protocol Buffers (protobuf)** as its interface definition language (IDL) and data serialization format, and runs over **HTTP/2**.

### Core Principles

- **Contract-first**: APIs are defined in `.proto` files; code is generated for client and server.
- **Binary serialization**: Data is encoded as compact binary (protobuf), not JSON.
- **HTTP/2**: Supports multiplexing, header compression, and full-duplex streaming.
- **Strongly typed**: The schema is the source of truth — no ambiguity in data shapes.
- **Polyglot**: Code generation supports Go, Java, Python, C++, Node.js, Rust, and more.

### A Simple gRPC Example

**Proto definition:**

```protobuf
syntax = "proto3";

service UserService {
  rpc GetUser (GetUserRequest) returns (User);
}

message GetUserRequest {
  int32 id = 1;
}

message User {
  int32 id = 1;
  string name = 2;
  string email = 3;
}
```

**Generated client call (Go):**

```go
resp, err := client.GetUser(ctx, &pb.GetUserRequest{Id: 42})
```

---

## Head-to-Head Comparison

| Feature | REST | gRPC |
|---|---|---|
| Protocol | HTTP/1.1 or HTTP/2 | HTTP/2 (required) |
| Data format | JSON (text) | Protocol Buffers (binary) |
| Schema / Contract | Optional (OpenAPI) | Required (`.proto` file) |
| Streaming | Limited (SSE, WebSockets) | Native (4 modes) |
| Browser support | Native | Requires gRPC-Web proxy |
| Code generation | Optional | Built-in |
| Human readability | High (JSON) | Low (binary) |
| Performance | Moderate | High |
| Learning curve | Low | Medium |
| Ecosystem maturity | Very mature | Mature, growing |

---

## Performance

gRPC significantly outperforms REST in most benchmarks:

- **Serialization**: Protobuf is 3–10x smaller than equivalent JSON and faster to encode/decode.
- **Transport**: HTTP/2 multiplexes multiple requests over a single connection, reducing latency.
- **No parsing overhead**: Binary format skips the JSON string parsing step entirely.

**When does it matter?**

Performance differences are most pronounced in:
- High-throughput internal microservice communication
- Mobile clients where bandwidth is limited
- Real-time systems with tight latency requirements

For a public-facing CRUD API with moderate traffic, the difference is often negligible.

---

## Streaming

This is where gRPC clearly leads. gRPC supports **four communication patterns**:

### 1. Unary RPC
One request, one response — equivalent to a standard REST call.

```protobuf
rpc GetUser (GetUserRequest) returns (User);
```

### 2. Server Streaming
One request, a stream of responses. Useful for live feeds, log tailing, or large dataset pagination.

```protobuf
rpc ListUsers (ListUsersRequest) returns (stream User);
```

### 3. Client Streaming
A stream of requests, one response. Useful for file uploads or batch writes.

```protobuf
rpc UploadLogs (stream LogEntry) returns (UploadSummary);
```

### 4. Bidirectional Streaming
Both sides stream simultaneously. Useful for real-time chat, collaborative editing, or telemetry.

```protobuf
rpc Chat (stream Message) returns (stream Message);
```

REST has no native equivalent for client or bidirectional streaming. Workarounds like WebSockets exist but sit outside the REST model.

---

## API Contract & Type Safety

**gRPC** enforces a strict contract through `.proto` files. The schema is:
- Version-controlled
- Used to auto-generate client/server stubs
- Validated at compile time

This eliminates an entire class of integration bugs: mismatched field names, wrong types, missing required fields.

**REST** can achieve similar guarantees with **OpenAPI/Swagger**, but it's opt-in. Many REST APIs ship without a formal schema, leading to:
- Inconsistent field naming (camelCase vs snake_case)
- Undocumented nullable fields
- Breaking changes discovered at runtime

If you want REST-level type safety, tools like [zod](https://github.com/colinhacks/zod), [io-ts](https://github.com/gcanti/io-ts), or OpenAPI code generators can help — but they require discipline to maintain.

---

## Error Handling

### REST
Uses HTTP status codes for error signaling:

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": "user_not_found",
  "message": "No user with id 42"
}
```

Standard codes (`200`, `400`, `401`, `403`, `404`, `409`, `422`, `500`) are well understood by clients, browsers, and proxies. However, teams often disagree on which code to use (e.g., `400` vs `422` for validation errors).

### gRPC
Uses a [canonical set of status codes](https://grpc.github.io/grpc/core/md_doc_statuscodes.html):

| Code | Meaning |
|---|---|
| `OK` | Success |
| `NOT_FOUND` | Resource does not exist |
| `INVALID_ARGUMENT` | Bad client input |
| `UNAUTHENTICATED` | Missing or invalid credentials |
| `PERMISSION_DENIED` | Authorized but forbidden |
| `INTERNAL` | Server-side error |
| `UNAVAILABLE` | Service temporarily down |

gRPC also supports rich error details via the `google.rpc.Status` proto, allowing structured error metadata beyond a simple message string.

---

## Browser & Tooling Support

This is REST's biggest advantage. Every browser, HTTP client (`curl`, Postman, Insomnia), and CDN understands REST natively.

gRPC runs over HTTP/2 with binary framing that browsers cannot access directly. Solutions exist but add complexity:

- **gRPC-Web**: A modified protocol + Envoy proxy, works in browsers but loses server and client streaming.
- **gRPC Gateway**: Transcodes gRPC to a REST/JSON interface, letting you expose both from one server.
- **Connect protocol**: A newer alternative by Buf that works in browsers without a proxy.

For public APIs intended for browser consumption, REST remains significantly simpler to adopt.

---

## Versioning

### REST
Common approaches:
- **URL versioning**: `/v1/users`, `/v2/users` — explicit but leads to code duplication.
- **Header versioning**: `Accept: application/vnd.myapi.v2+json` — cleaner but less visible.
- **No versioning**: Rely on additive, backward-compatible changes only.

### gRPC
Protobuf is designed for backward compatibility:
- **Adding fields**: New fields with new field numbers are ignored by old clients.
- **Removing fields**: Old field numbers should be marked `reserved` to prevent reuse.
- **Package versioning**: Use proto package names like `myapp.users.v1` for major breaks.

gRPC's versioning story is more structured, but breaking changes (renaming fields, changing types) still require careful coordination.

---

## Security

Both REST and gRPC support:
- **TLS** for transport encryption
- **OAuth 2.0 / JWT** for authentication
- **API keys** via headers or metadata

gRPC uses **metadata** (analogous to HTTP headers) for auth tokens:

```go
md := metadata.Pairs("authorization", "Bearer "+token)
ctx := metadata.NewOutgoingContext(ctx, md)
```

REST benefits from decades of battle-tested security patterns (CORS, CSRF tokens, cookie-based auth) that are natively understood by browsers and proxies.

---

## When to Use REST

Choose REST when:

- Building a **public API** consumed by third parties or browsers
- Your team values **simplicity and fast iteration** over raw performance
- You need **broad tooling support** (API gateways, CDNs, monitoring, mocking)
- The domain maps naturally to **CRUD operations on resources**
- You want low onboarding friction for new developers

**Good fits**: Public web APIs, mobile backends, webhook receivers, CRUD microservices.

---

## When to Use gRPC

Choose gRPC when:

- Building **internal microservice communication** where both sides are under your control
- **Performance and bandwidth** are critical (IoT devices, mobile, high-frequency services)
- You need **bidirectional streaming** (real-time telemetry, chat, collaborative features)
- You want **strict schema enforcement** and auto-generated clients across multiple languages
- Your system is **polyglot** and you want a single contract shared across all services

**Good fits**: Internal service meshes, real-time data pipelines, ML model inference, inter-datacenter communication.

---

## Hybrid Approach: Use Both

Many production systems use REST and gRPC together:

- **External-facing API**: REST (broad compatibility, cacheability, easy documentation)
- **Internal service mesh**: gRPC (performance, streaming, type safety)

Tools like **gRPC-Gateway** let you write one gRPC service and automatically expose a REST+JSON interface alongside it — giving you the best of both worlds without duplication.

```
Client (browser) → REST/JSON → gRPC Gateway → gRPC → Backend Services
                                                   ↕
                                         Internal gRPC calls
```

---

## Quick Decision Guide

```
Is this a public API or browser-facing?
├── Yes → REST
└── No (internal service)
    ├── Need real-time streaming?
    │   └── Yes → gRPC
    ├── High throughput / low latency critical?
    │   └── Yes → gRPC
    ├── Multiple languages in the stack?
    │   └── Yes → gRPC (protobuf codegen)
    └── Simple CRUD, small team, fast iteration?
        └── REST
```

---

## Summary

| | REST | gRPC |
|---|---|---|
| **Best for** | Public APIs, browser clients | Internal services, high-performance systems |
| **Data format** | JSON (human-readable) | Protobuf (binary, compact) |
| **Streaming** | Limited | Native (4 modes) |
| **Type safety** | Optional (OpenAPI) | Enforced (.proto) |
| **Performance** | Good | Excellent |
| **Browser support** | Native | Needs proxy |
| **Learning curve** | Low | Medium |

Neither REST nor gRPC is universally superior. The right choice depends on your consumers, performance requirements, and how much you value schema enforcement vs. simplicity. In complex systems, using both — REST at the edge and gRPC internally — is often the pragmatic answer.
