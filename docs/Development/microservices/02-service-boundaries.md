---
sidebar_position: 2
---

# Service Boundaries and Domain-Driven Design

Understanding how to identify proper service boundaries using domain-driven design principles and bounded contexts.

---

## Table of Contents

1. [Defining Service Boundaries](#defining-service-boundaries)
2. [Domain-Driven Design Fundamentals](#domain-driven-design-fundamentals)
3. [Bounded Contexts](#bounded-contexts)
4. [Identifying Service Boundaries](#identifying-service-boundaries)
5. [Context Mapping](#context-mapping)
6. [Anti-Patterns](#anti-patterns)
7. [Refactoring Boundaries](#refactoring-boundaries)
8. [Practical Guidelines](#practical-guidelines)

---

## Defining Service Boundaries

### What Makes a Good Boundary

A good service boundary encapsulates a cohesive business capability with:

**High Cohesion** - Related functionality grouped together. Things that change together stay together.

**Loose Coupling** - Minimal dependencies on other services. Services can evolve independently.

**Business Alignment** - Boundary reflects business domain, not technical layers.

**Clear Ownership** - Single team owns the service and its data.

**Stable Interface** - API changes infrequently. Most changes are internal.

### Cohesion vs Coupling

**Cohesion** measures how related functionality within a service is. High cohesion means the service does one thing well. Low cohesion means unrelated functionality is bundled together.

**Coupling** measures dependencies between services. Loose coupling means services can change independently. Tight coupling means changes cascade across services.

Goal: High cohesion within services, loose coupling between services.

### Decomposition Challenges

The hardest part of microservices is getting boundaries right. Poor boundaries lead to:
- Frequent cross-service changes
- Complex coordination between teams
- Performance issues from chatty services
- Data consistency challenges

Better to start with larger services and split later than to start with wrong boundaries.

### Evolutionary Design

Service boundaries are not set in stone. As understanding of the domain evolves, boundaries should evolve too.

Expect to refactor boundaries based on:
- Changing business requirements
- Performance bottlenecks
- Team structure changes
- Technology constraints

Design for change rather than trying to get boundaries perfect upfront.

---

## Domain-Driven Design Fundamentals

### Ubiquitous Language

Establish a common vocabulary shared between technical and business teams. Use the same terms in code, conversations, and documentation.

In an e-commerce domain:
- "Order" means the same thing to developers and business people
- "Inventory" has a precise, shared definition
- "Customer" vs "User" distinction is clear

Ambiguous language leads to misaligned implementations. Invest in developing ubiquitous language.

### Strategic Design

Strategic design focuses on high-level structure—identifying bounded contexts and their relationships. This is where service boundaries are defined.

Key patterns:
- Bounded contexts (service boundaries)
- Context maps (relationships between contexts)
- Core domain (most valuable parts)
- Subdomains (different areas of the business)

### Tactical Design

Tactical design focuses on modeling within a bounded context—entities, value objects, aggregates, domain events.

These patterns help structure code within services but don't directly define service boundaries.

### Core, Supporting, and Generic Subdomains

**Core Domain** - Provides competitive advantage. Where you differentiate from competitors. Invest heavily here.

**Supporting Subdomain** - Necessary but not differentiating. Build custom because off-the-shelf doesn't fit needs.

**Generic Subdomain** - Common functionality available off-the-shelf. Use existing solutions (authentication, payments, email).

Allocate resources accordingly. Focus best engineers on core domain. Use junior engineers or outsourcing for supporting subdomains. Buy generic subdomains.

### Domain Events

Domain events represent meaningful business occurrences:
- OrderPlaced
- PaymentReceived
- InventoryReserved
- ShipmentDispatched

Events are the language of business processes. They reveal how the domain actually works and help identify bounded contexts.

---

## Bounded Contexts

### What Is a Bounded Context

A bounded context is a boundary within which a particular model is defined and applicable. Outside that boundary, different models may apply.

The same term can mean different things in different contexts. "Customer" in sales context is different from "User" in support context.

Bounded contexts are natural candidates for service boundaries. Each bounded context can become a microservice.

### Context Boundaries

Boundaries define:
- What is inside the context (models, rules, data)
- What is outside the context (other models)
- How context interacts with outside (APIs, events)

Clear boundaries prevent model confusion and enable independent evolution.

### Example: E-Commerce Bounded Contexts

**Sales Context:**
- Concepts: Catalog, Product, ShoppingCart, Order, Payment
- Focus: Helping customers purchase products
- Data: Product details optimized for browsing and buying

**Fulfillment Context:**
- Concepts: Shipment, Package, Delivery, Warehouse
- Focus: Getting orders to customers
- Data: Shipping details, warehouse locations

**Inventory Context:**
- Concepts: Stock, Reservation, Reorder, Supplier
- Focus: Managing product availability
- Data: Stock levels, supplier information

Same "Product" appears in multiple contexts but has different attributes and behaviors in each.

### Context Independence

Bounded contexts should be as independent as possible. Changes within one context shouldn't ripple to others.

Independence enables:
- Separate teams working on different contexts
- Different technology choices per context
- Independent deployment schedules
- Localized changes and experiments

### Shared Kernel

Sometimes contexts need to share common models. Shared kernel is code shared between contexts, but it creates coupling.

Use sparingly. Shared kernels require coordination between teams for changes. Consider published language (well-defined API) instead.

### Published Language

A well-defined API or event schema that contexts use to communicate. The API is stable even as internal models evolve.

Published language enables independence. Internal changes don't affect consumers as long as API remains backward compatible.

---

## Identifying Service Boundaries

### Event Storming

Event storming is a workshop technique for discovering domain events and boundaries:

1. Identify domain events (things that happen in the business)
2. Arrange events in temporal order
3. Identify commands that trigger events
4. Identify aggregates (entities) that process commands
5. Identify bounded contexts (where events naturally cluster)

Events naturally group around bounded contexts. Clusters reveal potential service boundaries.

### Business Capability Mapping

Identify distinct business capabilities:
- User Management
- Product Catalog
- Order Processing
- Inventory Management
- Shipping and Fulfillment
- Customer Support

Each capability is a candidate for a service. Capabilities are stable even as implementation changes.

### Data Flow Analysis

Trace how data flows through the system:
- Where is data created?
- How is it transformed?
- Who consumes it?
- What's the lifecycle?

Data that flows together should probably live together. Boundaries should minimize data flow across services.

### Change Frequency Analysis

Analyze what changes together:
- Features that change together
- Code that's modified together
- Teams that work together

Things that change together should be in the same service. Boundaries should minimize coordinated changes.

### Team Structure Analysis

Consider existing or desired team structure (Conway's Law):
- How many teams do you have?
- What are their skills and focus areas?
- How do teams communicate?

Service boundaries should align with team boundaries. One team per service (or one team managing multiple related services).

### Performance and Scalability

Consider performance characteristics:
- What needs to scale independently?
- What has different performance requirements?
- Where are the performance bottlenecks?

Boundaries can separate parts with different scaling needs. But don't let performance drive all decisions—business alignment is more important.

---

## Context Mapping

### Relationship Patterns

Context mapping describes relationships between bounded contexts:

**Partnership** - Two contexts cooperate. Changes are coordinated. Teams work closely together.

**Shared Kernel** - Contexts share common code/models. Changes require mutual agreement. Highest coupling.

**Customer-Supplier** - Upstream context (supplier) provides API. Downstream context (customer) depends on it. Supplier's needs take priority.

**Conformist** - Downstream context conforms to upstream's model. No influence on upstream. Accept the model as-is.

**Anti-Corruption Layer** - Downstream context translates upstream's model to its own. Prevents upstream's model from polluting downstream.

**Open Host Service** - Context provides well-defined API for many consumers. API is stable and documented.

**Published Language** - Shared communication format (API schema, event format). Enables interoperability without shared models.

**Separate Ways** - Contexts have no relationship. Complete independence. Duplicate functionality if needed.

### Context Map Visualization

Create a visual map showing:
- All bounded contexts
- Relationships between them
- Direction of dependencies
- Type of relationship

This reveals:
- Which contexts are central vs peripheral
- Where coupling exists
- Opportunities to reduce coupling
- Clear boundaries for services

### Dependency Direction

Pay attention to dependency direction:

**Upstream context** - Consumed by others. Changes may impact many downstream contexts.

**Downstream context** - Consumes others. Dependent on upstream changes.

Minimize downstream dependencies. Prefer events over synchronous calls to invert dependencies.

### Anti-Corruption Layers

When integrating with external systems or legacy systems, use anti-corruption layers:

The layer translates between your clean domain model and the external system's model. This prevents external models from leaking into your domain.

Example: Legacy system calls users "CUST_REC". Your domain uses "Customer". Anti-corruption layer translates between them.

---

## Anti-Patterns

### Distributed Monolith

Services that appear independent but are tightly coupled:
- Changes require coordinated deployments
- Services share databases
- Circular dependencies between services
- Services communicate synchronously for every operation

You get all the complexity of distribution with none of the benefits of independence.

### Anemic Services

Services that are just thin wrappers around database tables (CRUD operations). No business logic. No real boundaries.

This is procedural programming with extra network calls. Not microservices.

### Chatty Services

Services that make many fine-grained calls to each other for single operations. Leads to:
- Poor performance (network latency)
- Complex coordination
- Cascade failures

Indicates boundaries are wrong. Related functionality is split across services.

### Wrong Decomposition Axis

Splitting by technical layers instead of business capabilities:
- UI service
- Business logic service
- Data service

This creates coupling across all services for any feature change. Boundaries should be vertical (business capabilities), not horizontal (technical layers).

### Over-Fragmentation

Too many tiny services. Results in:
- Operational complexity
- Difficulty understanding system flow
- Performance issues
- Complex deployments

Bigger services are okay. Don't split for the sake of splitting.

### Shared Database

Multiple services accessing the same database. Creates tight coupling:
- Schema changes affect multiple services
- No clear data ownership
- Can't change database independently
- Violates bounded context principle

Each service should own its data. Access through APIs, not direct database access.

---

## Refactoring Boundaries

### When to Refactor

Refactor boundaries when:
- Frequent cross-service changes indicate coupling
- Services are too large and teams can't work independently
- Performance suffers from chatty communication
- Business capabilities have evolved and boundaries don't match

Don't refactor prematurely. Wait for clear signals.

### Splitting Services

To split a service:
1. Identify the boundary within the service
2. Create new service with extracted functionality
3. Duplicate data needed by new service
4. Gradually move logic to new service
5. Update callers to use new service
6. Remove old code from original service
7. Decommission duplicated data

Use feature flags to switch between old and new implementations safely.

### Merging Services

To merge services:
1. Identify services to merge
2. Combine into single service
3. Unify data stores
4. Update callers to use merged service
5. Decommission old services

Merging is simpler than splitting. Don't be afraid to merge if boundaries were wrong.

### Data Migration

Moving data between services is challenging:
1. Replicate data to new service
2. Keep both in sync during transition
3. Update consumers to read from new service
4. Verify data consistency
5. Stop sync and decommission old data

This may take weeks or months for large datasets. Plan carefully.

### Zero-Downtime Migration

For production systems, use patterns like:
- Parallel run (both old and new implementations)
- Dark launch (new implementation runs but results aren't used)
- Canary deployment (gradual traffic shift)
- Feature flags (toggle between implementations)

These enable safe migration with rollback capability.

---

## Practical Guidelines

### Start Coarse, Refine Later

Begin with larger services (bounded contexts). Split into smaller services when clear need arises.

It's easier to split services than merge them, but don't split prematurely. Learn your domain first.

### Business Capability Focus

Always define boundaries around business capabilities, not technical concerns:
- Good: Order Management, Inventory, Shipping
- Bad: Database Access, Business Logic, API Layer

### Single Team Ownership

Each service should be owned by one team. If multiple teams work on one service, consider splitting.

If one team owns multiple services, that's okay. Services can be grouped by team capability.

### Autonomous Data

Each service owns its data exclusively. No shared databases between services.

Services expose APIs for data access. Other services request data through APIs, not direct database queries.

### Minimize Synchronous Calls

Prefer asynchronous communication (events) over synchronous API calls. This reduces coupling and improves resilience.

Use synchronous calls only when immediate response is needed.

### Consider Non-Functional Requirements

Boundaries should consider:
- Security (sensitive data isolation)
- Compliance (data residency, audit requirements)
- Performance (latency, throughput)
- Scalability (independent scaling needs)

These may override pure business alignment in some cases.

### Document Boundaries and Rationale

Maintain documentation explaining:
- Why each boundary exists
- What belongs in each service
- What doesn't belong and why
- Relationships between services

This prevents drift and helps new team members understand the architecture.

### Accept Imperfection

Perfect boundaries don't exist. Every boundary involves trade-offs.

Accept that boundaries will evolve. Design for change rather than trying to achieve perfection upfront.

### Use Automated Testing

Comprehensive automated tests enable confident refactoring of boundaries:
- Unit tests for service logic
- Integration tests for service interactions
- Contract tests for API compatibility
- End-to-end tests for critical flows

Tests give confidence that refactoring preserves behavior.
