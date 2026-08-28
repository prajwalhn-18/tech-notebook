---
sidebar_position: 4
---

# Service Infrastructure

Understanding service discovery, configuration management, and dependency management for production microservices systems.

---

## Table of Contents

1. [Service Discovery](#service-discovery)
2. [Configuration Management](#configuration-management)
3. [Dependency Management](#dependency-management)
4. [Service Registry](#service-registry)
5. [Load Balancing](#load-balancing)
6. [Secrets Management](#secrets-management)
7. [Feature Flags](#feature-flags)
8. [Infrastructure as Code](#infrastructure-as-code)

---

## Service Discovery

### The Problem

In dynamic environments, service instances come and go:
- Auto-scaling adds/removes instances
- Deployments replace instances
- Failures take instances down
- Container orchestration moves instances

Hard-coded service locations don't work. Services need to discover each other dynamically.

### Client-Side Discovery

Clients query service registry to find available instances. Client chooses instance and makes request directly.

**Flow:**
1. Client queries service registry for "order-service"
2. Registry returns list of instances
3. Client selects instance (load balancing logic in client)
4. Client makes request to selected instance

**Advantages:**
- Simple architecture
- Client controls load balancing
- No intermediary hop

**Disadvantages:**
- Discovery logic in every client
- Clients must handle failures
- Multiple language implementations needed

**Technologies:** Eureka, Consul (client mode), etcd

### Server-Side Discovery

Clients make requests to load balancer. Load balancer queries registry and forwards request to available instance.

**Flow:**
1. Client makes request to load balancer
2. Load balancer queries service registry
3. Load balancer selects instance
4. Load balancer forwards request

**Advantages:**
- Discovery logic centralized
- Language-agnostic
- Consistent load balancing

**Disadvantages:**
- Additional hop (latency)
- Load balancer is potential bottleneck/SPOF
- More infrastructure complexity

**Technologies:** Kubernetes Services, AWS ELB, HAProxy + Consul

### DNS-Based Discovery

Services registered in DNS. Clients use DNS lookups to find instances.

**Advantages:**
- Universal (all languages support DNS)
- Simple client implementation
- Existing infrastructure

**Disadvantages:**
- DNS caching issues
- No load balancing details
- Health checking limitations
- Slow updates

**Technologies:** Kubernetes DNS, Consul DNS, CoreDNS

### Self-Registration

Services register themselves with registry on startup and deregister on shutdown.

**Advantages:**
- Service controls its registration
- Accurate registration (service knows when it's ready)

**Disadvantages:**
- Registration logic in every service
- Services may fail without deregistering
- Tight coupling to registry

### Third-Party Registration

Separate registrar component monitors services and handles registration.

**Advantages:**
- Services don't need registration logic
- Reliable deregistration even on crashes
- Centralized registration logic

**Disadvantages:**
- Additional component to maintain
- Registrar must detect service health

**Example:** Kubernetes automatically registers pods as service endpoints.

### Health Checking

Registry must track which instances are healthy:

**Active Health Checks** - Registry periodically pings services.

**Passive Health Checks** - Registry monitors request failures.

**Self-Reported Health** - Services report their own health.

Services should provide health endpoints that check:
- Service is running
- Dependencies are available
- Resources are not exhausted

### Service Discovery Patterns

**Pattern 1: Kubernetes Services** - Built-in service discovery via DNS and iptables/IPVS.

**Pattern 2: Consul + Envoy** - Consul for registry, Envoy for service mesh with discovery.

**Pattern 3: Eureka + Ribbon** - Netflix stack, client-side discovery with load balancing.

**Pattern 4: API Gateway** - Gateway handles all discovery, services don't discover each other.

---

## Configuration Management

### Configuration Principles

**Externalized Configuration** - Configuration outside code. Same code runs in all environments with different config.

**Environment-Specific** - Different values for dev, staging, production without code changes.

**Dynamic Updates** - Change configuration without redeploying services.

**Versioned and Auditable** - Track configuration changes, roll back if needed.

**Secure** - Sensitive configuration (passwords, keys) protected.

### Configuration Sources

**Environment Variables** - Simple, universally supported. Good for simple configuration.

**Configuration Files** - YAML, JSON, properties files. Good for complex configuration.

**Configuration Service** - Centralized service (Consul, etcd, Spring Cloud Config). Good for dynamic updates.

**Command-Line Arguments** - Override defaults. Good for development.

**Secrets Manager** - Dedicated service for sensitive data (AWS Secrets Manager, Vault).

### Configuration Hierarchy

Apply configuration in order of precedence:
1. Command-line arguments (highest precedence)
2. Environment variables
3. Configuration files
4. Configuration service
5. Default values (lowest precedence)

This allows overriding at each level while providing sensible defaults.

### Configuration Patterns

**Configuration per Environment** - Separate config files for dev, staging, production.

**Configuration per Service** - Each service has its own configuration namespace in shared config service.

**Shared Configuration** - Common configuration (database URLs, timeouts) shared across services.

**Dynamic Configuration** - Configuration changes without restart. Services watch for updates.

### Configuration Service Design

**Hierarchical Structure** - Organize by environment, service, component.

**Default Values** - Provide defaults so services work out-of-box.

**Validation** - Validate configuration on startup. Fail fast with clear errors.

**Encryption** - Encrypt sensitive values in transit and at rest.

**Audit Trail** - Log who changed what and when.

### Configuration Technologies

**Consul** - Key-value store with service discovery. Good for dynamic configuration.

**etcd** - Distributed key-value store. Used by Kubernetes.

**Spring Cloud Config** - Configuration server for Spring applications. Backed by Git.

**AWS AppConfig** - Managed configuration service with deployment strategies.

**HashiCorp Vault** - Secrets management with encryption, audit, access control.

### Configuration Anti-Patterns

**Hard-Coded Values** - Never hard-code configuration. Makes changes require code deployment.

**Different Code per Environment** - Don't branch code by environment. Use configuration instead.

**Secrets in Code** - Never commit secrets to version control. Use secrets management.

**No Defaults** - Provide reasonable defaults. Don't require configuration for everything.

**Manual Configuration** - Automate configuration deployment. Manual processes are error-prone.

### Feature Flags in Configuration

Feature flags control feature availability without code deployment:

**Types:**
- Release flags (enable new features gradually)
- Operational flags (kill switches for problematic features)
- Experimental flags (A/B testing)
- Permission flags (feature access by user role)

Store feature flags in configuration service for dynamic updates.

---

## Dependency Management

### Types of Dependencies

**Runtime Dependencies** - Other services your service calls. Must be available for your service to function.

**Build Dependencies** - Libraries and tools needed to build your service.

**Infrastructure Dependencies** - Databases, caches, message queues your service needs.

**Transitive Dependencies** - Dependencies of your dependencies.

### Dependency Mapping

Maintain clear dependency maps:
- What services does each service depend on?
- What's the dependency chain?
- Are there circular dependencies?
- What's the criticality of each dependency?

Tools: Service mesh observability, distributed tracing, architecture diagrams.

### Managing Runtime Dependencies

**Circuit Breakers** - Prevent cascading failures when dependencies fail.

**Timeouts** - Don't wait forever for responses. Fail fast.

**Retries** - Retry transient failures with exponential backoff.

**Fallbacks** - Gracefully degrade when dependencies unavailable.

**Bulkheads** - Isolate failures. Don't let one dependency exhaust all resources.

### Dependency Versions

**API Versioning** - Dependencies may have multiple API versions. Track which version you use.

**Backward Compatibility** - Dependencies should maintain backward compatibility or provide migration paths.

**Dependency Updates** - Keep dependencies updated for security and features. But test thoroughly.

**Deprecation Process** - Dependencies should communicate deprecation well in advance.

### Circular Dependencies

Avoid circular dependencies between services:
- Service A calls Service B
- Service B calls Service A

This creates tight coupling and deployment complexity.

**Solutions:**
- Extract shared functionality to separate service
- Use events instead of synchronous calls
- Rethink service boundaries

### Dependency Inversion

High-level services shouldn't depend on low-level services. Both should depend on abstractions.

Use events to invert dependencies:
- Instead of Service A calling Service B
- Service B emits events
- Service A subscribes to events

This decouples services and makes them more independent.

### Shared Libraries

Shared libraries create implicit dependencies. Changes to library require updating all services.

**Guidelines:**
- Keep shared libraries minimal
- Version libraries carefully
- Use semantic versioning
- Maintain backward compatibility
- Document breaking changes clearly

### Dependency Testing

**Contract Testing** - Verify your service works with dependencies' APIs. Test against contracts, not live services.

**Consumer-Driven Contracts** - Consumers define contracts. Providers test against consumer expectations.

**Integration Testing** - Test with real dependencies in test environment.

**Chaos Engineering** - Test behavior when dependencies fail.

### Monitoring Dependencies

Track dependency health metrics:
- Request rate to each dependency
- Error rate per dependency
- Latency per dependency
- Circuit breaker state
- Timeout rate

Alert when dependencies degrade before your service fails.

---

## Service Registry

### Registry Responsibilities

**Service Registration** - Services register their location (IP, port).

**Service Lookup** - Clients query registry to find services.

**Health Monitoring** - Track which instances are healthy.

**Load Balancing** - Distribute requests across healthy instances.

**Service Metadata** - Store additional info (version, capabilities, tags).

### Registry Technologies

**Consul** - Service mesh with service discovery, health checking, key-value store.

**Eureka** - Netflix service registry. Client-side discovery.

**etcd** - Distributed key-value store. Used by Kubernetes.

**ZooKeeper** - Distributed coordination service. Older but proven.

**Kubernetes Services** - Built-in service registry via API server.

### Registry Data Model

**Service Name** - Logical service name (order-service, user-service).

**Instance ID** - Unique identifier for each instance.

**Instance Location** - IP address and port.

**Health Status** - Healthy, unhealthy, starting, stopping.

**Metadata** - Version, region, tags, capabilities.

**Registration Time** - When instance registered.

**Last Heartbeat** - When last health check succeeded.

### Registry Consistency

**Strong Consistency** - All clients see the same data immediately. Higher latency.

**Eventual Consistency** - Clients may see stale data briefly. Lower latency.

For service discovery, eventual consistency is usually acceptable. Brief staleness is better than high latency or unavailability.

### Registry High Availability

Service registry is critical infrastructure. It must be highly available:

**Clustering** - Run multiple registry instances. Clients can query any instance.

**Data Replication** - Replicate data across instances. Survive instance failures.

**Client-Side Caching** - Clients cache registry data. Continue operating if registry is temporarily unavailable.

**Multi-Region** - Deploy registry in multiple regions for disaster recovery.

### Registry Security

**Authentication** - Services must authenticate to register.

**Authorization** - Services can only register themselves, not others.

**TLS** - Encrypt communication with registry.

**Network Segmentation** - Registry on private network, not exposed to internet.

**Audit Logging** - Log all registration changes.

---

## Load Balancing

### Load Balancing Layers

**DNS Load Balancing** - Multiple A records for domain. Simple but inflexible.

**L4 Load Balancing** - TCP/UDP level. Fast but limited routing options.

**L7 Load Balancing** - HTTP level. Slower but sophisticated routing.

**Client-Side Load Balancing** - Client chooses instance. No intermediary hop.

### Load Balancing Algorithms

**Round Robin** - Distribute evenly across instances. Simple and effective.

**Least Connections** - Route to instance with fewest active connections. Good for variable request duration.

**Weighted Round Robin** - Instances with higher weights receive more traffic. Good for heterogeneous capacity.

**Random** - Choose instance randomly. Simpler than round robin, similar results.

**IP Hash** - Hash client IP to choose instance. Provides session affinity.

**Consistent Hashing** - Advanced hashing for cache affinity. Minimizes disruption when instances change.

### Session Affinity

Route requests from same client to same instance. Enables session state in instance memory.

**Implementations:**
- Cookie-based (load balancer sets cookie)
- IP-based (hash client IP)
- Header-based (route by custom header)

**Disadvantages:**
- Limits scalability
- Complicates deployment
- Session lost on instance failure

Prefer stateless services with external session storage.

### Health-Based Routing

Don't route to unhealthy instances:

**Active Health Checks** - Load balancer pings instances periodically.

**Passive Health Checks** - Load balancer monitors request failures.

**Gradual Removal** - Don't immediately remove instance on first failure. Wait for multiple failures.

**Gradual Addition** - Don't immediately add instance when healthy. Wait for sustained health.

### Load Balancing Technologies

**Nginx** - Popular, performant, widely used.

**HAProxy** - High-performance, reliable, complex configuration.

**AWS ELB/ALB** - Managed service, integrates with AWS.

**Envoy** - Modern proxy, used in service meshes.

**Traefik** - Cloud-native, automatic service discovery.

---

## Secrets Management

### What Are Secrets

Sensitive configuration that must be protected:
- Database passwords
- API keys
- TLS certificates
- Encryption keys
- OAuth tokens

Secrets require special handling beyond regular configuration.

### Secrets Anti-Patterns

**Hard-Coded Secrets** - Never hard-code secrets in source code. They end up in version control.

**Environment Variables** - Better than hard-coding but visible in process listings and logs.

**Configuration Files** - Better than environment variables but files may be exposed.

**Version Control** - Never commit secrets to version control, even private repos.

### Secrets Management Solutions

**HashiCorp Vault** - Industry-standard secrets management. Encryption, audit, dynamic secrets.

**AWS Secrets Manager** - Managed service for AWS. Automatic rotation, integration with AWS services.

**Azure Key Vault** - Managed service for Azure. HSM-backed, integrated with Azure.

**Google Secret Manager** - Managed service for GCP. Versioning, audit logging.

**Kubernetes Secrets** - Built-in secrets for Kubernetes. Base64 encoding, not encrypted by default.

### Secrets Lifecycle

**Generation** - Generate strong, random secrets. Don't use weak or default passwords.

**Storage** - Encrypt at rest and in transit. Access controls prevent unauthorized access.

**Distribution** - Inject secrets at runtime. Don't bundle in container images.

**Rotation** - Regularly rotate secrets. Automate rotation where possible.

**Revocation** - Immediately revoke compromised secrets. Have process to rotate all secrets quickly.

**Audit** - Log all secret access. Alert on unusual patterns.

### Dynamic Secrets

Generate secrets on-demand with short TTLs:

**Database Credentials** - Generate unique credentials per service instance. Expire after TTL.

**API Tokens** - Generate tokens with limited scope and lifetime.

**TLS Certificates** - Issue short-lived certificates. Automatic renewal.

Dynamic secrets limit blast radius of compromise. Expired credentials can't be used even if leaked.

### Secrets Injection

**Environment Variables** - Secret manager injects at container startup. Simple but visible.

**Volume Mounts** - Secrets mounted as files. Better than environment variables.

**API Calls** - Service queries secret manager at startup. Most flexible.

**Sidecar Pattern** - Sidecar container handles secret retrieval and rotation.

### Secrets Rotation

Regular rotation limits compromise impact:

**Automated Rotation** - Secrets manager rotates automatically. Services must handle rotation gracefully.

**Zero-Downtime Rotation** - Support multiple valid secrets during rotation. Old and new both work briefly.

**Rotation Testing** - Test rotation regularly. Don't wait for production issues.

**Break-Glass Process** - Emergency process to rotate all secrets quickly if compromise suspected.

---

## Feature Flags

### Feature Flag Purposes

**Release Management** - Deploy code with features disabled. Enable when ready.

**A/B Testing** - Show different features to different user segments.

**Operational Toggles** - Kill switches to disable problematic features.

**Gradual Rollout** - Enable features for increasing percentages of users.

**Permission Flags** - Control feature access by user role or subscription.

### Feature Flag Lifecycle

**Development** - Create flag for new feature.

**Testing** - Test both enabled and disabled states.

**Gradual Rollout** - Enable for 1%, 10%, 50%, 100%.

**Stabilization** - Monitor metrics, roll back if issues.

**Removal** - Remove flag and dead code after full rollout.

### Feature Flag Storage

**Configuration Service** - Store flags centrally. Change without deployment.

**Database** - Store in database for per-user flags.

**Code** - Temporary flags can be in code. Must be removed eventually.

### Feature Flag Best Practices

**Short-Lived Flags** - Most flags should be temporary. Remove after feature fully rolled out.

**Long-Lived Flags** - Operational flags and permission flags can be permanent.

**Technical Debt** - Old flags create technical debt. Schedule removal.

**Avoid Nested Flags** - Don't nest flags deeply. Creates combinatorial complexity.

**Test Both States** - Test feature enabled and disabled.

**Monitor Flag State** - Track which flags are on/off in production.

### Feature Flag Technologies

**LaunchDarkly** - Commercial solution. Sophisticated targeting, analytics.

**Unleash** - Open-source. Self-hosted, good features.

**Flagsmith** - Open-source. Simple, effective.

**Custom Solution** - Configuration service + conditional logic. Simplest but limited.

---

## Infrastructure as Code

### Principles

**Version Controlled** - Infrastructure definitions in version control.

**Declarative** - Describe desired state, not steps to achieve it.

**Idempotent** - Running multiple times produces same result.

**Reviewable** - Infrastructure changes reviewed like code changes.

**Automated** - Infrastructure provisioned automatically, not manually.

### Technologies

**Terraform** - Cloud-agnostic. Wide provider support. Good for multi-cloud.

**AWS CloudFormation** - AWS-specific. Deep AWS integration.

**Pulumi** - Infrastructure as code in general-purpose languages (TypeScript, Python, Go).

**Ansible** - Configuration management. Can also provision infrastructure.

**Kubernetes YAML** - Declarative configuration for Kubernetes resources.

### Infrastructure Components

**Networks** - VPCs, subnets, routing tables, NAT gateways.

**Compute** - Instances, containers, auto-scaling groups.

**Storage** - Volumes, object storage, databases.

**Load Balancers** - ELB, ALB, NLB.

**DNS** - Route53, Cloud DNS.

**Monitoring** - CloudWatch, Stackdriver.

**IAM** - Roles, policies, service accounts.

### State Management

Terraform and similar tools maintain state:

**Remote State** - Store state in S3, GCS, Terraform Cloud. Enables team collaboration.

**State Locking** - Prevent concurrent modifications. Use DynamoDB, Consul.

**Sensitive Data** - State contains sensitive data. Encrypt and restrict access.

**State Backup** - Back up state regularly. Disaster recovery.

### Environment Management

**Separate Environments** - Dev, staging, production as separate infrastructure.

**Environment Parity** - Keep environments similar. Catch issues in lower environments.

**Environment-Specific Configuration** - Use variables or separate state files.

**Promotion Process** - Test changes in dev, promote to staging, then production.

### Infrastructure Testing

**Validation** - Validate syntax before applying.

**Dry Run** - Preview changes before applying.

**Automated Tests** - Test infrastructure code with tools like Terratest.

**Compliance Checks** - Ensure infrastructure meets security and compliance requirements.
