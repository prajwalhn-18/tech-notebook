# DNS (Domain Name System)

## What is DNS?

DNS is the **"phonebook of the internet"** - it translates human-readable domain names into IP addresses.

```
google.com → 142.250.185.46
```

## Why DNS Exists

Computers use IP addresses (142.250.185.46), but humans prefer names (google.com).

**Without DNS**:
- Remember numerical addresses for every website
- Difficult to change server IPs
- No intuitive naming

## DNS Hierarchy

DNS is a **distributed, hierarchical database**:

```
                    [Root]
                      .
                      |
        ┌─────────────┼─────────────┐
        |             |             |
      [.com]        [.org]        [.net]     (TLD)
        |
    ┌───┴───┐
    |       |
[google] [amazon]                            (Second-level domain)
    |
    ├─── www
    ├─── mail
    └─── drive                               (Subdomains)
```

### DNS Components

1. **Root Level** (`.`)
   - 13 root server systems (a-m.root-servers.net)
   - Knows about TLD servers
   - Operated by various organizations

2. **Top-Level Domains (TLDs)**
   - Generic: .com, .org, .net, .edu, .gov
   - Country Code: .uk, .jp, .in, .de
   - New gTLDs: .app, .dev, .xyz, .io

3. **Second-Level Domains**
   - google.com
   - amazon.co.uk
   - github.io

4. **Subdomains**
   - www.google.com
   - mail.google.com
   - drive.google.com

## Fully Qualified Domain Name (FQDN)

Complete domain name including all levels:

```
www.example.com.
 │    │      │  │
 │    │      │  └─ Root (usually implicit)
 │    │      └──── TLD
 │    └─────────── Second-level domain
 └──────────────── Subdomain
```

## DNS Resolution Process

### Example: Resolving www.example.com

```
1. User enters "www.example.com" in browser
2. Browser checks its cache
3. OS checks its cache
4. Query sent to Recursive DNS Resolver (usually ISP)

Recursive Resolver queries:
5. Root server → "Ask .com TLD server"
6. .com TLD server → "Ask example.com authoritative server"
7. example.com authoritative server → "192.0.2.1"

8. Resolver caches result
9. Returns IP to user
10. Browser connects to 192.0.2.1
```

### Detailed Flow

```
Client → Resolver → Root → TLD → Authoritative → Back to Client

[Client]
    ↓ "What is www.example.com?"
[Recursive Resolver]
    ↓ "Who handles .com?"
[Root Server]
    ↓ "Ask 192.5.6.30 (.com TLD)"
[.com TLD Server]
    ↓ "Ask 192.0.2.1 (example.com)"
[Authoritative Server for example.com]
    ↓ "www.example.com = 93.184.216.34"
[Recursive Resolver] (caches result)
    ↓ Returns IP
[Client]
```

## DNS Record Types

### Common Record Types

#### A (Address) Record
**IPv4 address mapping**

```
example.com.    IN  A    192.0.2.1
www.example.com. IN  A    192.0.2.1
```

#### AAAA Record
**IPv6 address mapping**

```
example.com.    IN  AAAA  2001:db8::1
```

#### CNAME (Canonical Name) Record
**Alias for another domain**

```
blog.example.com.  IN  CNAME  example.com.
www.example.com.   IN  CNAME  example.com.
```

**Note**: CNAME can't coexist with other records at same name

#### MX (Mail Exchange) Record
**Mail server for domain**

```
example.com.  IN  MX  10  mail1.example.com.
example.com.  IN  MX  20  mail2.example.com.
```

Lower priority number = higher preference

#### NS (Name Server) Record
**Authoritative DNS servers for domain**

```
example.com.  IN  NS  ns1.example.com.
example.com.  IN  NS  ns2.example.com.
```

#### TXT Record
**Arbitrary text data**

**Uses**:
- SPF records (email authentication)
- Domain verification
- DKIM keys
- DMARC policies

```
example.com.  IN  TXT  "v=spf1 include:_spf.google.com ~all"
```

#### SOA (Start of Authority) Record
**Authoritative information about domain**

```
example.com.  IN  SOA  ns1.example.com. admin.example.com. (
                       2023010101 ; Serial
                       3600       ; Refresh
                       1800       ; Retry
                       604800     ; Expire
                       86400      ; Minimum TTL
                       )
```

#### PTR (Pointer) Record
**Reverse DNS lookup (IP to domain)**

```
1.2.0.192.in-addr.arpa.  IN  PTR  example.com.
```

#### SRV (Service) Record
**Service location**

```
_service._protocol.domain.  IN  SRV  priority weight port target
_http._tcp.example.com.     IN  SRV  10 60 80 server1.example.com.
```

#### CAA (Certification Authority Authorization)
**Specify which CAs can issue certificates**

```
example.com.  IN  CAA  0 issue "letsencrypt.org"
```

## TTL (Time to Live)

**How long DNS records should be cached**

```
example.com.  3600  IN  A  192.0.2.1
              ^^^^
              TTL in seconds (1 hour)
```

**Common TTL values**:
- 300 (5 minutes) - Before DNS changes
- 3600 (1 hour) - Typical default
- 86400 (24 hours) - Stable records

**Trade-offs**:
- Low TTL: Faster propagation, more DNS queries
- High TTL: Fewer queries, slower changes

## DNS Caching

### Cache Levels

1. **Browser cache**
   - Very short duration
   - Chrome: chrome://net-internals/#dns

2. **Operating system cache**
   - Each OS maintains DNS cache
   - Can be flushed manually

3. **Recursive resolver cache**
   - ISP or public DNS server
   - Respects TTL values

4. **TLD server cache**
   - Caches NS records for domains

### Flush DNS Cache

```bash
# Windows
ipconfig /flushdns

# macOS
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Linux
sudo systemd-resolve --flush-caches
```

## DNS Servers

### Types of DNS Servers

#### 1. Recursive Resolvers
Perform full resolution on behalf of clients

**Popular Public Recursive Resolvers**:
```
Google Public DNS:     8.8.8.8, 8.8.4.4
Cloudflare:           1.1.1.1, 1.0.0.1
Quad9:                9.9.9.9
OpenDNS:              208.67.222.222, 208.67.220.220
```

#### 2. Authoritative Servers
Provide definitive answers for domains they manage

#### 3. Root Servers
13 root server systems (a-m.root-servers.net)

#### 4. TLD Servers
Manage top-level domains (.com, .org, etc.)

## DNS Query Types

### 1. Recursive Query
Resolver does all the work

```
Client → Resolver: "Find www.example.com"
Resolver → Client: "Here's the IP: 192.0.2.1"
```

### 2. Iterative Query
Resolver asks, servers give referrals

```
Resolver → Root: "Who has example.com?"
Root → Resolver: "Ask .com server"
Resolver → .com: "Who has example.com?"
.com → Resolver: "Ask example.com server"
```

### 3. Non-Recursive Query
Answer already in cache

## DNS Security

### Problems with DNS

1. **No encryption**: Queries visible to ISP
2. **No authentication**: Responses can be spoofed
3. **Cache poisoning**: Attacker injects fake records
4. **DDoS attacks**: Overwhelm DNS servers

### Security Solutions

#### DNSSEC (DNS Security Extensions)
**Cryptographically signs DNS records**

```
example.com.  IN  DNSKEY  (public key)
example.com.  IN  RRSIG   (signature)
example.com.  IN  DS      (delegation signer)
```

**How it works**:
1. Domain owner signs records with private key
2. Publishes public key in DNSKEY record
3. Resolver verifies signature with public key
4. Chain of trust from root to domain

#### DNS over HTTPS (DoH)
**Encrypts DNS queries using HTTPS**

```
https://cloudflare-dns.com/dns-query?name=example.com
```

**Port**: 443 (HTTPS)

#### DNS over TLS (DoT)
**Encrypts DNS queries using TLS**

**Port**: 853

**Difference from DoH**:
- DoT: Dedicated protocol on port 853
- DoH: Uses standard HTTPS port 443

## DNS Load Balancing

### Methods

#### 1. Round Robin
Multiple A records, rotated

```
example.com.  IN  A  192.0.2.1
example.com.  IN  A  192.0.2.2
example.com.  IN  A  192.0.2.3
```

#### 2. GeoDNS
Return different IPs based on user location

```
US users →     192.0.2.1 (US server)
EU users →     203.0.113.1 (EU server)
Asia users →   198.51.100.1 (Asia server)
```

#### 3. Health-Check Based
Only return IPs of healthy servers

## DNS Tools and Commands

### Query DNS records

```bash
# nslookup
nslookup example.com
nslookup -type=MX example.com

# dig (more detailed)
dig example.com
dig example.com MX
dig @8.8.8.8 example.com    # Query specific server
dig +trace example.com       # Show full resolution path
dig +short example.com       # Brief output

# host
host example.com
host -t MX example.com
```

### Check DNS propagation

```bash
# Query multiple DNS servers
dig @8.8.8.8 example.com
dig @1.1.1.1 example.com

# Online tools
# whatsmydns.net
# dnschecker.org
```

### Reverse DNS lookup

```bash
dig -x 192.0.2.1
host 192.0.2.1
nslookup 192.0.2.1
```

## Common DNS Issues

### 1. DNS Resolution Failure
- Check internet connection
- Try different DNS server
- Flush DNS cache

### 2. Slow DNS Resolution
- Use faster DNS servers (1.1.1.1, 8.8.8.8)
- Check for DNS server issues
- Network congestion

### 3. DNS Propagation Delay
- Wait for TTL to expire
- Lower TTL before making changes
- Check multiple DNS servers

### 4. NXDOMAIN (Non-Existent Domain)
- Domain doesn't exist
- Typo in domain name
- DNS not fully propagated
