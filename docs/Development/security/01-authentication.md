---
sidebar_position: 1
---

# Authentication in Microservices

Understanding OAuth2, JWT, OIDC, API keys, and mTLS for securing microservices at scale.

---

## Table of Contents

1. [Authentication Fundamentals](#authentication-fundamentals)
2. [OAuth 2.0](#oauth-20)
3. [JWT (JSON Web Tokens)](#jwt-json-web-tokens)
4. [OpenID Connect (OIDC)](#openid-connect-oidc)
5. [API Keys](#api-keys)
6. [Mutual TLS (mTLS)](#mutual-tls-mtls)
7. [Service-to-Service Authentication](#service-to-service-authentication)
8. [Best Practices](#best-practices)

---

## Authentication Fundamentals

### Authentication vs Authorization

**Authentication:** Verifying identity. "Who are you?"

**Authorization:** Verifying permissions. "What can you do?"

**Example:**
```
Authentication: User provides username/password, proves they're Alice
Authorization: Check if Alice can access resource /admin/users
```

**Always separate these concerns in your architecture.**

### Authentication Types

**User authentication:** End users authenticating to access application.

**Service authentication:** Services authenticating to each other.

**API authentication:** External clients authenticating to APIs.

Each requires different mechanisms and trade-offs.

### Security Requirements

**Confidentiality:** Credentials not exposed.

**Integrity:** Credentials not tampered with.

**Non-repudiation:** Can prove who performed action.

**Defense in depth:** Multiple layers of security.

---

## OAuth 2.0

### What Is OAuth 2.0

**OAuth 2.0:** Authorization framework allowing applications to obtain limited access to user accounts.

**Key concept:** Delegate authorization without sharing passwords.

**Example:** "Login with Google" - App gets access to your Google account without seeing your password.

### OAuth 2.0 Roles

**Resource Owner:** User who owns the data (you).

**Client:** Application requesting access (mobile app, web app).

**Authorization Server:** Issues access tokens (Google, Auth0, Keycloak).

**Resource Server:** API hosting protected resources (your microservice).

### OAuth 2.0 Flows

**Authorization Code Flow (Most secure):**

```
1. User clicks "Login"
2. Client redirects to Authorization Server
3. User authenticates and consents
4. Auth Server redirects back with authorization code
5. Client exchanges code for access token (backend call)
6. Client uses access token to access Resource Server
```

**Why secure:** Access token never exposed to browser.

**Use for:** Web applications with backend.

**Client Credentials Flow (Service-to-service):**

```
1. Service authenticates with client_id and client_secret
2. Auth Server returns access token
3. Service uses token to access other services
```

**Use for:** Backend services calling other backend services.

**Implicit Flow (Deprecated):**

```
1. User clicks "Login"
2. Client redirects to Authorization Server
3. User authenticates
4. Auth Server redirects back with access token in URL
```

**Why deprecated:** Access token exposed in browser history and logs.

**Don't use.** Use Authorization Code Flow with PKCE instead.

**Password Grant (Deprecated):**

```
1. Client collects username/password
2. Client sends credentials to Auth Server
3. Auth Server returns access token
```

**Why deprecated:** Client sees user password (defeats OAuth purpose).

**Don't use** unless absolutely necessary (first-party apps only).

### Access Tokens

**Opaque tokens:**
- Random string
- Meaning only known to authorization server
- Requires token introspection (API call to validate)

**JWT tokens:**
- Self-contained (includes claims)
- Can be validated locally (no API call)
- Common in microservices

### Refresh Tokens

**Problem:** Access tokens expire (short-lived, e.g., 1 hour).

**Solution:** Refresh tokens (long-lived, e.g., 30 days).

**Flow:**
```
1. User authenticates, receives access token + refresh token
2. Access token expires
3. Client sends refresh token to Auth Server
4. Auth Server issues new access token
5. Repeat
```

**Security:**
- Refresh tokens stored securely (encrypted, httpOnly cookies)
- Can be revoked if compromised
- Rotation: Issue new refresh token on each use

### OAuth 2.0 Scopes

**Scopes:** Permissions requested by client.

**Example:**
```
Scope: "read:profile write:posts"
Meaning: Read user profile, write posts
```

**Best practices:**
- Principle of least privilege (request minimum scopes)
- Fine-grained scopes (not "admin" for everything)
- Document required scopes per endpoint

### OAuth 2.0 in Microservices

**API Gateway pattern:**
```
1. API Gateway validates OAuth token
2. Gateway extracts user info from token
3. Gateway forwards request to backend services
4. Backend services trust Gateway (don't revalidate)
```

**Distributed validation:**
```
1. Each service validates token independently
2. Cache token validation results
3. Services trust authorization server
```

**Token forwarding:**
```
Client → Service A (validates token)
Service A → Service B (forwards token)
Service B → Service C (forwards token)
Each service validates same user token
```

### Common Pitfalls

**Storing tokens in localStorage:** Vulnerable to XSS attacks.
- Use httpOnly cookies instead.

**No token expiration:** Stolen tokens valid forever.
- Always set expiration (1-24 hours typical).

**Client secret in frontend:** Anyone can extract from JavaScript.
- Never put secrets in frontend code.

**No state parameter:** Vulnerable to CSRF attacks.
- Always use state parameter in OAuth flows.

---

## JWT (JSON Web Tokens)

### JWT Structure

**Three parts separated by dots:**
```
header.payload.signature

Example:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**Header:**
```json
{
  "alg": "RS256",
  "typ": "JWT"
}
```

**Payload (Claims):**
```json
{
  "sub": "1234567890",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "admin",
  "iat": 1516239022,
  "exp": 1516242622
}
```

**Signature:**
```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

### Standard Claims

**iss (Issuer):** Who created the token.

**sub (Subject):** Who the token is about (user ID).

**aud (Audience):** Who the token is for (service name).

**exp (Expiration):** When token expires (Unix timestamp).

**iat (Issued At):** When token was created.

**nbf (Not Before):** Token not valid before this time.

**jti (JWT ID):** Unique token identifier.

### Signing Algorithms

**Symmetric (HMAC):**
- HS256, HS384, HS512
- Same secret for signing and verification
- Fast, simple
- Secret must be shared (problematic in microservices)

**Asymmetric (RSA/ECDSA):**
- RS256, RS384, RS512 (RSA)
- ES256, ES384, ES512 (ECDSA)
- Private key signs, public key verifies
- Public key can be shared safely
- Preferred for microservices

**Recommendation:** Use RS256 or ES256 for microservices.

### JWT Validation

**Must verify:**
1. Signature is valid
2. Token not expired (check exp)
3. Token not used before valid time (check nbf)
4. Issuer is trusted (check iss)
5. Audience matches (check aud)
6. Algorithm is expected (no algorithm confusion)

**Validation flow:**
```
1. Extract JWT from Authorization header
2. Decode header and payload (don't trust yet)
3. Get public key for issuer
4. Verify signature using public key
5. Check exp, iss, aud claims
6. Extract user info from payload
7. Proceed with authorized request
```

### JWT Best Practices

**Keep tokens small:**
- Large tokens increase bandwidth
- Don't put entire user object in token
- Include only essential claims (user ID, roles)

**Set appropriate expiration:**
- Access tokens: 15 minutes to 1 hour
- Refresh tokens: Days to weeks
- Balance security vs user experience

**Don't store sensitive data:**
- Tokens are base64 encoded (not encrypted)
- Anyone can decode and read payload
- Never put passwords, SSNs, etc. in tokens

**Use HTTPS always:**
- Tokens sent in clear text
- HTTPS encrypts in transit
- Never send tokens over HTTP

**Validate algorithms:**
```
Expected: RS256
Received: HS256
Attack: Attacker uses public key as HMAC secret

Protection: Explicitly check algorithm matches expected
```

### Token Revocation

**Problem:** JWTs are stateless, can't be revoked easily.

**Solutions:**

**Short expiration:**
- Tokens expire quickly (e.g., 15 minutes)
- Stolen tokens have limited window

**Blacklist:**
- Maintain list of revoked token IDs (jti claim)
- Check blacklist on each request
- Defeats stateless benefit

**Versioning:**
```
Include user_version in token
Check if user_version changed:
  if token.user_version < current_user_version:
    reject (user logged out all sessions)
```

**Event-based:**
```
On password change/logout:
  Broadcast "invalidate tokens for user X"
  Services cache invalidation for duration
```

### JWT in Microservices

**Gateway validates, services trust:**
```
API Gateway:
  - Validates JWT signature
  - Checks expiration
  - Extracts user info
  - Adds user context to headers

Backend Services:
  - Trust gateway headers
  - Don't revalidate JWT
  - Focus on business logic
```

**Each service validates:**
```
Each Service:
  - Validates JWT independently
  - Caches public keys (refresh periodically)
  - Makes authorization decisions
  - More secure but more overhead
```

---

## OpenID Connect (OIDC)

### What Is OIDC

**OIDC:** Authentication layer on top of OAuth 2.0.

**OAuth 2.0:** Authorization (what you can access).

**OIDC:** Authentication (who you are) + Authorization.

**Key addition:** ID Token (JWT with user identity).

### OIDC Tokens

**Access Token:** Used to access APIs (OAuth 2.0).

**ID Token:** Contains user identity (OIDC specific).

**Refresh Token:** Get new tokens (OAuth 2.0).

**ID Token example:**
```json
{
  "iss": "https://accounts.google.com",
  "sub": "1234567890",
  "aud": "my-app-client-id",
  "exp": 1516242622,
  "iat": 1516239022,
  "name": "John Doe",
  "email": "john@example.com",
  "email_verified": true,
  "picture": "https://example.com/john.jpg"
}
```

### OIDC Flow

```
1. User clicks "Login"
2. Client redirects to Authorization Server
   Scope: "openid profile email"
3. User authenticates
4. Auth Server redirects with authorization code
5. Client exchanges code for tokens:
   - Access token
   - ID token
   - Refresh token
6. Client validates ID token, extracts user info
7. Client uses access token for API requests
```

### UserInfo Endpoint

**Alternative to ID Token:**
```
GET /userinfo
Authorization: Bearer {access_token}

Response:
{
  "sub": "1234567890",
  "name": "John Doe",
  "email": "john@example.com",
  "email_verified": true
}
```

**Use when:**
- Need latest user info (ID token may be stale)
- Want smaller ID tokens
- Need additional claims not in ID token

### OIDC Discovery

**Well-known endpoint:**
```
GET /.well-known/openid-configuration

Response:
{
  "issuer": "https://accounts.example.com",
  "authorization_endpoint": "https://accounts.example.com/oauth/authorize",
  "token_endpoint": "https://accounts.example.com/oauth/token",
  "userinfo_endpoint": "https://accounts.example.com/oauth/userinfo",
  "jwks_uri": "https://accounts.example.com/.well-known/jwks.json"
}
```

**Benefits:**
- Auto-configure OIDC clients
- No hardcoded URLs
- Easy to update endpoints

### OIDC in Practice

**Single Sign-On (SSO):**
```
User logs in once
Multiple applications use same OIDC provider
Seamless experience across apps
```

**Social login:**
```
"Login with Google/Facebook/GitHub"
Uses provider's OIDC implementation
No password management for your app
```

---

## API Keys

### What Are API Keys

**API Key:** Simple authentication mechanism using static token.

**Structure:**
```
API-Key: sk_live_abc123def456ghi789jkl
```

**How it works:**
1. Generate unique key for each client
2. Client includes key in requests
3. Server validates key against database
4. Server authorizes based on key permissions

### API Key Formats

**Prefixed keys:**
```
pk_live_...  (public key for frontend)
sk_live_...  (secret key for backend)
pk_test_...  (test environment public)
sk_test_...  (test environment secret)
```

**Benefits:**
- Identify key type quickly
- Prevent mixing test/prod keys
- Aid in key management

### API Key Transmission

**Authorization header (preferred):**
```
GET /api/resources
Authorization: Bearer sk_live_abc123...
```

**Custom header:**
```
GET /api/resources
X-API-Key: sk_live_abc123...
```

**Query parameter (avoid):**
```
GET /api/resources?api_key=sk_live_abc123...
```

**Why avoid query parameters:**
- Logged in server logs
- Visible in browser history
- Sent to analytics
- Cached by CDNs

### API Key Security

**Hashing:**
```
Storage: hash(api_key) → store hash
Validation: hash(provided_key) == stored_hash
```

**Never store plain text keys.**

**Key rotation:**
```
Support multiple active keys per client
Client rotates keys without downtime:
  1. Generate new key
  2. Deploy new key to systems
  3. Delete old key
```

**Rate limiting:**
```
Per-key rate limits prevent abuse
Track usage per key for quotas
```

**Scopes/Permissions:**
```
Each key has associated permissions
Key 1: read:users write:posts
Key 2: read:users (read-only)
```

### API Keys vs OAuth

**API Keys:**
- Simple implementation
- No expiration (long-lived)
- Hard to revoke (need key rotation)
- No fine-grained permissions
- Good for server-to-server

**OAuth:**
- Complex implementation
- Expiring tokens
- Easy revocation
- Fine-grained scopes
- Good for user delegation

**Use API keys for:**
- Internal services
- Simple integrations
- Machine-to-machine
- When OAuth overhead not justified

**Use OAuth for:**
- User authentication
- Third-party integrations
- Fine-grained permissions
- Token rotation requirements

---

## Mutual TLS (mTLS)

### What Is mTLS

**TLS:** Server proves identity to client (certificate).

**mTLS:** Both client and server prove identity (mutual authentication).

**Use case:** Service-to-service authentication in microservices.

### How mTLS Works

**TLS handshake with mutual authentication:**

```
1. Client initiates connection to Server
2. Server sends its certificate
3. Client validates Server certificate
4. Server requests Client certificate
5. Client sends its certificate
6. Server validates Client certificate
7. Both parties verify certificates
8. Encrypted connection established
```

**Certificate validation:**
```
- Certificate issued by trusted CA
- Certificate not expired
- Certificate not revoked (CRL/OCSP)
- Common Name matches expected identity
```

### Certificate Management

**Certificate Authority (CA):**
- Issues certificates
- Signs certificates with private key
- Clients/servers trust CA public key

**Self-signed vs CA-signed:**

**Self-signed:**
- Generate your own CA
- Issue certificates from your CA
- Good for internal services
- No cost

**CA-signed:**
- Use public CA (Let's Encrypt, DigiCert)
- Widely trusted
- Required for public services
- May have cost

### mTLS in Microservices

**Service Mesh pattern:**
```
Istio, Linkerd, Consul Connect:
- Automatic mTLS between services
- Sidecar proxies handle TLS
- Certificate rotation automated
- No application code changes
```

**Manual mTLS:**
```
Each service:
- Has its own certificate
- Validates peer certificates
- Application handles TLS
- More control but more work
```

### Certificate Rotation

**Problem:** Certificates expire.

**Solution:** Automated rotation.

**Rotation strategy:**
```
1. Generate new certificate before expiry
2. Distribute new certificate to services
3. Services accept both old and new (overlap period)
4. Services switch to using new certificate
5. Old certificate expires
```

**Short-lived certificates:**
- 1-7 days validity
- Automated rotation required
- Limits blast radius if compromised
- Standard in service meshes

### mTLS Benefits

**Strong authentication:**
- Cryptographic proof of identity
- Difficult to forge
- No shared secrets

**Encryption:**
- All traffic encrypted
- Man-in-the-middle prevention
- Data confidentiality

**No application changes:**
- With service mesh
- Transparent to applications
- Centralized security policy

### mTLS Challenges

**Certificate management complexity:**
- Issuing certificates
- Distribution
- Rotation
- Revocation

**Performance overhead:**
- TLS handshake latency
- Encryption/decryption CPU cost
- Typically negligible with modern hardware

**Debugging difficulty:**
- Encrypted traffic harder to inspect
- Need proper logging and tracing

---

## Service-to-Service Authentication

### Authentication Patterns

**Shared secrets:**
```
Service A → Service B
Authorization: Bearer shared_secret_abc123
```

**Simple but problematic:**
- Secrets must be shared
- Rotation is difficult
- No identity verification

**JWT tokens:**
```
Service A:
  Generate JWT signed with A's private key
  Include service identity in claims

Service B:
  Verify JWT with A's public key
  Check service identity
```

**mTLS:**
```
Both services have certificates
Mutual verification
Strong authentication
```

**OAuth Client Credentials:**
```
Service A → Auth Server (client credentials flow)
Auth Server → Service A (access token)
Service A → Service B (with access token)
Service B validates token
```

### Service Identity

**Service name in token:**
```json
{
  "iss": "service-a",
  "aud": "service-b",
  "sub": "service-a",
  "exp": 1234567890
}
```

**Certificate CN (Common Name):**
```
CN=service-a.default.svc.cluster.local
```

**Service Account:**
```
Kubernetes Service Account
Automatically mounted in pods
Used for identity
```

### Trust Models

**All services trust auth server:**
```
Auth Server issues tokens
Services validate tokens with auth server
Centralized trust
```

**Peer-to-peer trust:**
```
Each service has key pair
Services exchange public keys
Direct trust relationships
```

**CA-based trust:**
```
All services trust common CA
CA issues certificates
Services validate certificates
Hierarchical trust
```

---

## Best Practices

### Defense in Depth

**Multiple layers:**
1. Authentication (who are you)
2. Authorization (what can you do)
3. Rate limiting (slow down attacks)
4. Input validation (reject bad data)
5. Encryption (protect in transit)
6. Monitoring (detect attacks)

**No single point of failure.**

### Principle of Least Privilege

**Grant minimum permissions necessary:**
- Service needs read access → give read, not read+write
- Service needs one endpoint → scope to that endpoint
- User needs viewer role → don't give admin

**Review permissions regularly.**

### Token Hygiene

**Short lifetimes:**
- Access tokens: 15-60 minutes
- Refresh tokens: Days to weeks
- Reduces window if compromised

**Secure storage:**
- httpOnly cookies (browser)
- Encrypted at rest (server)
- Never in localStorage (XSS vulnerable)

**Rotation:**
- Rotate refresh tokens on use
- Rotate secrets periodically
- Automate rotation

### Monitoring and Alerting

**Track authentication metrics:**
- Failed login attempts
- Token validation failures
- Unusual access patterns
- Geographic anomalies

**Alert on:**
- Spike in failed authentications
- Token validation errors
- Credential stuffing attempts
- Brute force attacks

### Security Headers

**Set security headers:**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'self'
```

**Prevents common attacks.**

### Testing

**Test authentication:**
- Valid credentials succeed
- Invalid credentials fail
- Expired tokens rejected
- Revoked tokens rejected
- Permission boundaries enforced

**Penetration testing:**
- Regular security audits
- Third-party testing
- Bug bounty programs

### Documentation

**Document authentication:**
- Which mechanisms used where
- How to obtain credentials
- Token format and claims
- Expiration policies
- Rotation procedures

**Critical for ops team and users.**
