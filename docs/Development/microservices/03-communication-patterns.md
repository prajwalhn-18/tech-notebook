---
sidebar_position: 3
---

# Service Communication and API Gateway

Understanding communication patterns, API Gateway architecture, and building stateless services for microservices systems.

---

## Table of Contents

1. [Communication Patterns](#communication-patterns)
2. [Stateless Services](#stateless-services)
3. [API Gateway Pattern](#api-gateway-pattern)
4. [Service Mesh](#service-mesh)
5. [Synchronous Communication](#synchronous-communication)
6. [Asynchronous Communication](#asynchronous-communication)
7. [Event-Driven Architecture](#event-driven-architecture)
8. [Resilience Patterns](#resilience-patterns)

---

## Communication Patterns

### Direct Service-to-Service

Services communicate directly with each other without intermediaries. Each service knows about and calls other services directly.

**Advantages:**
- Simple to understand
- Low latency (no intermediary hops)
- Clear dependencies

**Disadvantages:**
- Tight coupling between services
- Hard to change service locations
- No central control or monitoring
- Each service implements cross-cutting concerns

Use for internal service-to-service communication within trusted boundaries.

### API Gateway Pattern

A single entry point for external clients. Gateway routes requests to appropriate backend services.

**Advantages:**
- Single entry point for clients
- Centralized cross-cutting concerns (auth, logging, rate limiting)
- Backend services hidden from clients
- Protocol translation (REST to gRPC)

**Disadvantages:**
- Single point of failure
- Potential bottleneck
- Additional network hop
- Complexity in gateway logic

Essential for client-facing APIs in microservices.

### Service Mesh

Infrastructure layer handling service-to-service communication. Provides observability, security, and reliability features.

**Advantages:**
- Consistent observability across services
- Automatic retries and circuit breaking
- Mutual TLS for security
- Traffic management (canary, blue-green)

**Disadvantages:**
- Operational complexity
- Resource overhead (sidecar proxies)
- Learning curve
- Debugging complexity

Consider when you have many services and need sophisticated traffic management.

### Backend for Frontend (BFF)

Separate backends for different client types (web, mobile, IoT). Each BFF tailored to specific client needs.

**Advantages:**
- Optimized for each client type
- Reduces over-fetching and under-fetching
- Client teams can own their BFF

**Disadvantages:**
- Code duplication across BFFs
- More services to maintain
- Potential consistency issues

Useful when clients have significantly different needs.

---

## Stateless Services

### What Is Statelessness

A stateless service doesn't retain client session state between requests. Each request contains all information needed to process it.

State lives in:
- Client (cookies, local storage)
- External stores (database, cache)
- Request payload (tokens)

Not in service memory.

### Why Stateless Matters

**Scalability** - Any instance can handle any request. No session affinity needed. Easy to add/remove instances.

**Resilience** - Instance failures don't lose state. Requests can be retried on different instances.

**Simplicity** - No session synchronization. No sticky sessions. Load balancing is straightforward.

**Deployment** - Rolling updates and restarts don't affect users. No session migration needed.

### Making Services Stateless

**Externalize Sessions** - Store session data in Redis, Memcached, or database. All instances access shared session store.

**Use Tokens** - JWT tokens contain session data. Services validate tokens without maintaining state.

**Idempotent Operations** - Design operations to be safely retried. Use idempotency keys for non-idempotent operations (payments, orders).

**Pass State in Requests** - Include necessary context in each request. Don't rely on previous requests.

### Managing Stateful Requirements

Some requirements appear to need state but can be handled statelessly:

**Shopping Carts** - Store in Redis with user ID key or send cart contents with each request.

**Multi-Step Workflows** - Use workflow engine (Temporal, Cadence) or store workflow state in database.

**WebSocket Connections** - Stateful by nature. Use sticky sessions or message broker for cross-instance communication.

**File Uploads** - Stream directly to object storage. Don't buffer in service memory.

### Caching in Stateless Services

Local caching appears stateful but is acceptable when:
- Cache invalidation is handled properly
- Stale data is acceptable
- Cache is populated on demand

Distributed cache (Redis) is preferable when consistency matters.

### Configuration as State

Configuration is a form of state. Handle by:
- External configuration service
- Environment variables
- Configuration files mounted in containers
- Feature flags from central service

Don't hardcode configuration. Services should be configurable without code changes.

---

## API Gateway Pattern

### Gateway Responsibilities

**Request Routing** - Direct requests to appropriate backend services based on path, headers, or other criteria.

**Protocol Translation** - Convert between external protocols (HTTP REST) and internal protocols (gRPC, GraphQL).

**Authentication and Authorization** - Verify client identity and permissions before routing to services.

**Rate Limiting** - Enforce rate limits per client, preventing abuse and ensuring fair usage.

**Request/Response Transformation** - Modify requests and responses (add headers, filter fields, aggregate responses).

**Caching** - Cache responses at the gateway level to reduce backend load.

**Monitoring and Logging** - Centralized logging and metrics for all API traffic.

**SSL Termination** - Handle TLS encryption/decryption at the gateway.

### Implementation Approaches

**Kong** - Open-source API gateway with plugin ecosystem. Good for general-purpose API management.

**AWS API Gateway** - Managed service integrating with AWS ecosystem. Easy setup but vendor lock-in.

**Nginx/OpenResty** - High-performance reverse proxy with Lua scripting. Flexible but requires more configuration.

**Envoy** - Modern proxy designed for cloud-native applications. Often used in service meshes.

**Traefik** - Cloud-native gateway with automatic service discovery. Good for Kubernetes.

**Custom Gateway** - Build on Express, Fastify, or Go. Maximum flexibility but more maintenance.

### Authentication Strategies

**API Keys** - Simple but not secure for sensitive operations. Use for read-only public APIs.

**OAuth 2.0** - Industry standard for delegated authorization. Complex but comprehensive.

**JWT Tokens** - Self-contained tokens with claims. Services validate without external calls.

**Mutual TLS** - Certificate-based authentication. Strong security for service-to-service communication.

**Session-Based** - Traditional session cookies. Works but limits scalability.

### Gateway Anti-Patterns

**Business Logic in Gateway** - Gateway should route and enforce policy, not contain business logic.

**Tight Coupling to Services** - Gateway shouldn't know service internals. Use generic routing rules.

**Single Gateway Bottleneck** - Run multiple gateway instances behind load balancer. Scale horizontally.

**Excessive Transformation** - Avoid complex request/response manipulation. Let services return appropriate formats.

**Synchronous Aggregation** - Calling multiple services synchronously increases latency. Use BFF or client-side aggregation.

### Gateway Security

**Input Validation** - Validate and sanitize all inputs at gateway. Prevent injection attacks.

**Rate Limiting** - Per-client rate limits prevent abuse and DDoS attacks.

**IP Whitelisting** - Restrict access to known IP ranges when appropriate.

**Request Size Limits** - Prevent memory exhaustion from large payloads.

**Timeout Enforcement** - Set timeouts to prevent hanging requests.

**Security Headers** - Add headers like HSTS, CSP, X-Frame-Options.

### Gateway Patterns for Resilience

**Circuit Breaker** - Stop routing to failing services. Return cached responses or errors immediately.

**Retry Logic** - Retry failed requests with exponential backoff. Only for idempotent operations.

**Timeout Management** - Set aggressive timeouts at gateway. Don't let slow services affect others.

**Fallback Responses** - Return cached or default responses when services are unavailable.

**Health Checking** - Monitor backend service health. Route only to healthy instances.

---

## Service Mesh

### Service Mesh Architecture

Service mesh provides infrastructure layer for service-to-service communication:

**Data Plane** - Sidecar proxies deployed alongside each service. Handle actual traffic.

**Control Plane** - Manages and configures proxies. Provides centralized control and monitoring.

### Popular Service Meshes

**Istio** - Feature-rich, integrates well with Kubernetes. Complex but powerful.

**Linkerd** - Lightweight, easier to operate. Good for simpler use cases.

**Consul Connect** - From HashiCorp. Integrates with Consul service discovery.

**AWS App Mesh** - Managed service mesh for AWS environments.

### Service Mesh Benefits

**Automatic Observability** - Distributed tracing, metrics, and logging without code changes.

**Security** - Mutual TLS between services automatically. No application code changes.

**Traffic Management** - Sophisticated routing (canary, blue-green, A/B testing) without application changes.

**Resilience** - Circuit breaking, retries, timeouts configured centrally.

**Service Discovery** - Automatic service discovery and load balancing.

### When to Use Service Mesh

Consider service mesh when you have:
- Many microservices (20+)
- Complex traffic management requirements
- Strong security requirements (mTLS everywhere)
- Need for detailed observability
- Multiple teams deploying services

Don't use service mesh for:
- Small number of services
- Simple architectures
- Teams without operational maturity
- Cost-sensitive projects

### Service Mesh Trade-offs

**Advantages:**
- Consistent cross-cutting concerns
- Language-agnostic (works with any language)
- Centralized configuration

**Disadvantages:**
- Resource overhead (CPU, memory for proxies)
- Operational complexity
- Debugging difficulty
- Learning curve
- Latency overhead from proxy hops

---

## Synchronous Communication

### REST APIs

**HTTP REST** is the most common synchronous communication pattern.

**Advantages:**
- Universal support
- Human-readable
- Cacheable
- Well-understood

**Disadvantages:**
- Verbose (JSON overhead)
- Schema not enforced
- Versioning complexity

**Best Practices:**
- Use standard HTTP methods correctly (GET, POST, PUT, DELETE)
- Proper status codes
- HATEOAS for discoverability
- API versioning strategy
- Comprehensive documentation

### gRPC

Binary protocol using Protocol Buffers. Efficient for service-to-service communication.

**Advantages:**
- Efficient binary format
- Strong typing with .proto files
- Streaming support
- Multiple languages

**Disadvantages:**
- Not human-readable
- Limited browser support
- More complex debugging

**When to Use:**
- Internal service-to-service communication
- High-performance requirements
- Strong typing desired
- Streaming needed

### GraphQL

Query language for APIs. Clients request exactly the data they need.

**Advantages:**
- No over-fetching or under-fetching
- Single endpoint
- Strong typing
- Self-documenting

**Disadvantages:**
- Complex queries can be expensive
- Caching is harder
- N+1 query problem
- Learning curve

**When to Use:**
- Complex data relationships
- Multiple client types with different needs
- Frontend teams need flexibility

### Request-Reply Challenges

**Timeouts** - Set appropriate timeouts. Too short causes premature failures. Too long wastes resources.

**Retries** - Only retry idempotent operations. Use exponential backoff with jitter.

**Circuit Breaking** - Stop calling failing services. Return errors immediately or use fallbacks.

**Cascading Failures** - One slow service can cascade to others. Use timeouts and circuit breakers.

---

## Asynchronous Communication

### Message Queues

Messages sent to queues. Consumers process messages asynchronously.

**Advantages:**
- Decoupling (publisher doesn't know consumers)
- Buffering (handle traffic spikes)
- Retry logic built-in
- Guaranteed delivery

**Disadvantages:**
- Eventual consistency
- Debugging complexity
- Message ordering challenges
- Duplicate handling

**Technologies:**
- RabbitMQ (feature-rich, complex)
- Apache Kafka (high-throughput, log-based)
- AWS SQS (managed, simple)
- Google Pub/Sub (managed, scalable)
- Azure Service Bus (managed, enterprise features)

### Publish-Subscribe

Publishers emit events. Multiple subscribers receive events independently.

**Use Cases:**
- Broadcasting notifications
- Data replication
- Triggering workflows
- Analytics and monitoring

**Patterns:**
- Topic-based (subscribe to topics)
- Content-based (filter by content)
- Fanout (all subscribers receive all messages)

### Work Queues

Tasks distributed across workers. Each message processed by one worker.

**Use Cases:**
- Background processing
- Task distribution
- Load leveling

**Considerations:**
- Idempotency (messages may be delivered multiple times)
- Error handling (dead letter queues)
- Ordering (usually not guaranteed)
- Monitoring (queue depth, processing time)

### Message Patterns

**Fire and Forget** - Sender doesn't wait for acknowledgment. Fast but no delivery guarantee.

**Request-Response** - Sender waits for response. Use correlation IDs to match responses.

**Saga Pattern** - Coordinate transactions across services with compensating actions.

**Event Sourcing** - Store events, derive state from events. Complete audit trail.

### Asynchronous Trade-offs

**Advantages:**
- Better scalability and resilience
- Loose coupling
- Natural load leveling

**Disadvantages:**
- Complexity
- Eventual consistency
- Debugging difficulty
- Operational overhead

---

## Event-Driven Architecture

### Domain Events

Events representing business occurrences:
- OrderPlaced
- PaymentProcessed
- ItemShipped
- UserRegistered

Events are past tense—they happened. They're facts, not commands.

### Event Sourcing

Store events as the source of truth. Current state derived by replaying events.

**Advantages:**
- Complete audit trail
- Time travel (replay to any point)
- Event-driven analytics
- Easy to add new views

**Disadvantages:**
- Complexity
- Event schema evolution challenges
- Storage growth
- Eventual consistency

### CQRS (Command Query Responsibility Segregation)

Separate models for writes (commands) and reads (queries).

**Command Side:**
- Handles writes
- Validates business rules
- Emits events

**Query Side:**
- Handles reads
- Optimized for queries
- Eventually consistent with command side

**When to Use:**
- Complex domain logic
- Different read/write performance needs
- Event sourcing

**When to Avoid:**
- Simple CRUD applications
- Strong consistency required
- Small teams without experience

### Event Schemas

Define event schemas carefully:
- Include event type
- Include timestamp
- Include relevant data (avoid requiring lookups)
- Version schemas
- Use standard formats (JSON, Protobuf)

**Schema Evolution:**
- Add optional fields (backward compatible)
- Don't remove fields (use deprecation)
- Version events when breaking changes needed

### Eventual Consistency

In event-driven systems, changes propagate asynchronously. System is eventually consistent but not immediately.

**Handling Eventual Consistency:**
- Design UI to show pending state
- Use optimistic updates
- Implement idempotency
- Communicate delays to users

---

## Resilience Patterns

### Circuit Breaker

Stop calling failing services. Three states:

**Closed** - Normal operation. Requests pass through.

**Open** - Too many failures. Requests immediately fail without calling service.

**Half-Open** - Testing if service recovered. Limited requests pass through.

**Configuration:**
- Failure threshold to open circuit
- Timeout before trying half-open
- Success threshold to close circuit

### Retry with Exponential Backoff

Retry failed operations with increasing delays:
- First retry: 1 second
- Second retry: 2 seconds
- Third retry: 4 seconds
- Fourth retry: 8 seconds

Add jitter (randomization) to prevent thundering herd.

Only retry transient failures (network errors, timeouts). Don't retry validation errors.

### Timeout Strategy

Set timeouts at multiple levels:
- Connection timeout (how long to establish connection)
- Request timeout (total time for request/response)
- Gateway timeout (overall timeout including retries)

Timeouts should be realistic but aggressive. Better to fail fast than hang.

### Bulkhead Pattern

Isolate resources to prevent cascading failures:
- Separate thread pools per service
- Separate connection pools per service
- Separate circuit breakers per service

Failure in one service doesn't exhaust shared resources.

### Fallback Strategies

When service unavailable:
- Return cached data
- Return default values
- Degrade functionality gracefully
- Return error message with retry guidance

Design fallbacks during normal development, not during incidents.

### Health Checks

Implement health check endpoints:
- Liveness (is service alive?)
- Readiness (can service handle requests?)
- Dependency checks (are dependencies available?)

Load balancers and orchestrators use health checks to route traffic.
