# Internet Security

## Threat Landscape

### Common Threats

1. **Man-in-the-Middle (MITM)**
   - Attacker intercepts communication
   - Can read/modify data

2. **DDoS (Distributed Denial of Service)**
   - Overwhelm server with traffic
   - Makes service unavailable

3. **Packet Sniffing**
   - Capture unencrypted network traffic
   - Steal passwords, data

4. **IP Spoofing**
   - Fake source IP address
   - Bypass filters, hide identity

5. **DNS Attacks**
   - Cache poisoning
   - DNS hijacking
   - DDoS on DNS servers

6. **Session Hijacking**
   - Steal session cookies
   - Impersonate user

7. **Port Scanning**
   - Find open ports
   - Identify vulnerabilities

## Encryption

### Symmetric Encryption

**Same key for encryption and decryption**

```
Key: "secret123"

Plaintext  →  [Encrypt]  →  Ciphertext
Ciphertext →  [Decrypt]  →  Plaintext
```

**Algorithms**:
- AES (Advanced Encryption Standard)
- ChaCha20
- 3DES (legacy)

**Pros**: Fast
**Cons**: Key distribution problem

### Asymmetric Encryption

**Different keys: public (encrypt) and private (decrypt)**

```
Public Key:  Share with everyone
Private Key: Keep secret

Alice's Public Key  →  [Encrypt]  →  Ciphertext
Alice's Private Key →  [Decrypt]  →  Plaintext
```

**Algorithms**:
- RSA
- ECC (Elliptic Curve Cryptography)
- Diffie-Hellman (key exchange)

**Pros**: Secure key exchange
**Cons**: Slower than symmetric

### How HTTPS Uses Both

```
1. Asymmetric encryption (RSA/ECC)
   └─ Exchange symmetric key securely

2. Symmetric encryption (AES)
   └─ Encrypt actual data (fast)
```

## TLS/SSL Certificates

### What is a Certificate?

A digital document that proves identity and enables encryption.

### Certificate Contents

```
- Domain name (example.com)
- Organization name
- Public key
- Certificate Authority (CA) signature
- Expiration date
- Serial number
```

### Certificate Authority (CA)

**Trusted third party that issues certificates**

**Major CAs**:
- Let's Encrypt (free)
- DigiCert
- GlobalSign
- Sectigo

### Certificate Chain

```
Root CA Certificate
    └─ Intermediate CA Certificate
        └─ End-entity Certificate (example.com)
```

**Chain of Trust**: Browser trusts Root CA → Intermediate → Your cert

### Certificate Types

1. **Domain Validated (DV)**
   - Validates domain ownership only
   - Quick, automated, cheap/free
   - Let's Encrypt

2. **Organization Validated (OV)**
   - Validates organization details
   - Shows organization name
   - More expensive

3. **Extended Validation (EV)**
   - Extensive validation
   - Shows green address bar (older browsers)
   - Most expensive

### Certificate Formats

- **PEM**: Base64 encoded (most common)
  - `.crt`, `.cer`, `.pem`
- **DER**: Binary format
- **PFX/P12**: Contains private key + certificate
- **JKS**: Java KeyStore

## Firewalls

### What is a Firewall?

**Network security system that monitors and controls traffic**

### Types of Firewalls

#### 1. Packet Filtering Firewall
- Examines packet headers
- Allows/blocks based on rules
- Fast but basic

#### 2. Stateful Firewall
- Tracks connection state
- More intelligent than packet filtering
- Most common type

#### 3. Application Layer Firewall (WAF)
- Inspects application data (HTTP, FTP)
- Can block specific attacks
- More overhead

#### 4. Next-Generation Firewall (NGFW)
- Deep packet inspection
- Intrusion prevention
- Application awareness

### Firewall Rules Example

```bash
# Allow incoming HTTP
iptables -A INPUT -p tcp --dport 80 -j ACCEPT

# Allow incoming HTTPS
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Drop everything else
iptables -A INPUT -j DROP
```

## VPN (Virtual Private Network)

### What is a VPN?

**Creates encrypted tunnel over public internet**

```
[Your Device]
    ↓ Encrypted Tunnel
[VPN Server]
    ↓ Regular Internet
[Destination Server]
```

### Benefits

1. **Privacy**: Hide IP address, encrypt traffic
2. **Security**: Protect on public Wi-Fi
3. **Access**: Bypass geo-restrictions
4. **Remote Access**: Connect to corporate network

### VPN Protocols

- **OpenVPN**: Open-source, very secure
- **WireGuard**: Modern, fast, simple
- **IPsec**: Secure but complex
- **L2TP/IPsec**: Good security
- **PPTP**: Legacy, weak (avoid)

### VPN Types

1. **Remote Access VPN**
   - Connect individual device to network
   - Common for remote workers

2. **Site-to-Site VPN**
   - Connect entire networks
   - Branch offices to headquarters

## Network Security Best Practices

### 1. Use Encryption

- **HTTPS** for all websites
- **SSH** instead of Telnet
- **SFTP/SCP** instead of FTP
- **VPN** on public Wi-Fi

### 2. Keep Software Updated

- Patch security vulnerabilities
- Enable automatic updates
- Monitor security advisories

### 3. Use Strong Authentication

- Strong passwords
- Two-factor authentication (2FA)
- SSH keys instead of passwords
- Certificate-based authentication

### 4. Principle of Least Privilege

- Only open necessary ports
- Restrict permissions
- Separate networks (DMZ)
- Use private IPs behind NAT

### 5. Monitor and Log

- Enable logging
- Monitor for suspicious activity
- Use intrusion detection systems (IDS)
- Security Information and Event Management (SIEM)

### 6. Defense in Depth

Multiple layers of security:
```
1. Firewall
2. Network segmentation
3. Encryption
4. Authentication
5. Access control
6. Monitoring
7. Incident response
```

## Common Security Protocols

### SSH (Secure Shell)

**Encrypted remote access and file transfer**

#### SSH Authentication Methods

1. **Password**: Simple but less secure
2. **Public Key**: More secure
3. **Certificate**: Best for large deployments

#### Generate SSH Key

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

#### SSH Config Example

```bash
# ~/.ssh/config
Host myserver
    HostName example.com
    User username
    Port 22
    IdentityFile ~/.ssh/id_ed25519
```

### IPsec (Internet Protocol Security)

**Secure IP communications**

**Components**:
1. **AH (Authentication Header)**: Authentication
2. **ESP (Encapsulating Security Payload)**: Encryption + Authentication

**Modes**:
- **Transport Mode**: Encrypts payload only
- **Tunnel Mode**: Encrypts entire packet (VPN)

### TLS/SSL

**Encrypts application layer protocols**

**Used by**:
- HTTPS (HTTP over TLS)
- SMTPS (SMTP over TLS)
- IMAPS (IMAP over TLS)
- FTPS (FTP over TLS)

## Network Segmentation

### Why Segment?

- **Security**: Limit breach scope
- **Performance**: Reduce broadcast traffic
- **Compliance**: Isolate sensitive data

### Segmentation Methods

#### 1. VLANs (Virtual LANs)

Logical separation on same physical switch

```
VLAN 10: Management
VLAN 20: Users
VLAN 30: Servers
VLAN 40: Guest Wi-Fi
```

#### 2. Subnetting

Divide IP network into smaller networks

```
10.0.0.0/16 →
    10.0.1.0/24 (Management)
    10.0.2.0/24 (Employees)
    10.0.3.0/24 (Servers)
    10.0.4.0/24 (IoT)
```

#### 3. DMZ (Demilitarized Zone)

Separate network for public-facing services

```
Internet ← Firewall → DMZ ← Firewall → Internal Network
                       ↑
                 Web Servers
                 Mail Servers
```

## DDoS Protection

### Types of DDoS Attacks

1. **Volumetric**: Flood with traffic (Gbps)
2. **Protocol**: Exploit protocol weaknesses (SYN flood)
3. **Application**: Target application layer (HTTP flood)

### Mitigation Strategies

1. **Rate Limiting**: Limit requests per IP
2. **Traffic Filtering**: Block malicious IPs
3. **CDN**: Distribute traffic globally
4. **Anycast**: Route to nearest datacenter
5. **DDoS Protection Service**: Cloudflare, Akamai, AWS Shield

### SYN Flood Attack

**Attack**:
```
Attacker sends many SYN packets
Server allocates resources, waits for ACK
ACK never comes → resources exhausted
```

**Defense**:
- SYN cookies
- Rate limiting
- Firewall rules

## Security Tools

### Port Scanning

```bash
# Nmap
nmap -sS example.com       # SYN scan
nmap -sV example.com       # Version detection
nmap -p 1-65535 example.com # All ports
```

### Packet Analysis

```bash
# tcpdump
sudo tcpdump -i eth0 -n
sudo tcpdump -i eth0 port 80

# Wireshark (GUI)
# Filter examples:
# tcp.port == 443
# http
# ip.addr == 192.168.1.1
```

### SSL/TLS Testing

```bash
# Check certificate
openssl s_client -connect example.com:443

# Test SSL/TLS versions
nmap --script ssl-enum-ciphers -p 443 example.com

# Online tools
# ssllabs.com/ssltest
```

### Firewall Management

```bash
# iptables (Linux)
sudo iptables -L -v -n

# ufw (Ubuntu)
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw enable

# firewalld (CentOS/RHEL)
sudo firewall-cmd --list-all
sudo firewall-cmd --add-service=http
```

## Zero Trust Security

**"Never trust, always verify"**

### Principles

1. **Verify explicitly**: Authenticate every request
2. **Least privilege**: Minimum necessary access
3. **Assume breach**: Expect attackers inside network

### Implementation

- Multi-factor authentication
- Micro-segmentation
- Encryption everywhere
- Continuous monitoring
- Identity-based access control
