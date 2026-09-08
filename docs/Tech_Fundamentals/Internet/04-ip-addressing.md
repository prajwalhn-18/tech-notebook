# IP Addressing and Subnetting

## What is an IP Address?

An IP (Internet Protocol) address is a **unique numerical identifier** assigned to every device connected to a network. It serves two main purposes:
1. **Host identification** - Identifies the device
2. **Location addressing** - Enables routing to the device

## IPv4 (Internet Protocol version 4)

### Structure
- **Format**: Four 8-bit numbers (octets) separated by dots
- **Range**: 0.0.0.0 to 255.255.255.255
- **Total addresses**: ~4.3 billion (2^32)
- **Example**: 192.168.1.1

### Binary Representation
```
192.168.1.1 in decimal
11000000.10101000.00000001.00000001 in binary
```

### IPv4 Address Classes (Historical)

| Class | Range | Default Mask | Use |
|-------|-------|--------------|-----|
| A | 0.0.0.0 - 127.255.255.255 | /8 (255.0.0.0) | Large networks |
| B | 128.0.0.0 - 191.255.255.255 | /16 (255.255.0.0) | Medium networks |
| C | 192.0.0.0 - 223.255.255.255 | /24 (255.255.255.0) | Small networks |
| D | 224.0.0.0 - 239.255.255.255 | N/A | Multicast |
| E | 240.0.0.0 - 255.255.255.255 | N/A | Reserved |

### Special IPv4 Addresses

```
0.0.0.0          - Default route / "This network"
127.0.0.0/8      - Loopback (localhost)
127.0.0.1        - Common loopback address
169.254.0.0/16   - Link-local (APIPA - automatic private addressing)
224.0.0.0/4      - Multicast
255.255.255.255  - Broadcast (current network)
```

### Private IP Ranges (RFC 1918)

**Not routable on public internet**

```
10.0.0.0/8        (10.0.0.0 - 10.255.255.255)      - 16 million addresses
172.16.0.0/12     (172.16.0.0 - 172.31.255.255)    - 1 million addresses
192.168.0.0/16    (192.168.0.0 - 192.168.255.255)  - 65,536 addresses
```

Used for:
- Home networks
- Corporate LANs
- Behind NAT (Network Address Translation)

## IPv6 (Internet Protocol version 6)

### Why IPv6?
- IPv4 exhaustion (ran out of addresses)
- Need for more devices (IoT explosion)
- Better features (built-in security, no NAT needed)

### Structure
- **Format**: Eight groups of four hexadecimal digits
- **Total addresses**: 340 undecillion (2^128)
- **Example**: 2001:0db8:85a3:0000:0000:8a2e:0370:7334

### IPv6 Shorthand Rules

**Original**:
```
2001:0db8:0000:0000:0000:0000:0000:0001
```

**Rule 1**: Remove leading zeros
```
2001:db8:0:0:0:0:0:1
```

**Rule 2**: Replace consecutive zeros with `::`
```
2001:db8::1
```

**Note**: `::` can only be used once per address

### Special IPv6 Addresses

```
::1              - Loopback (localhost)
::               - Unspecified address
fe80::/10        - Link-local addresses
fc00::/7         - Unique local addresses (private)
ff00::/8         - Multicast
2001:db8::/32    - Documentation examples
```

## Subnet Masks

A subnet mask **divides an IP address** into:
1. **Network portion** - Identifies the network
2. **Host portion** - Identifies the device on that network

### Subnet Mask Notation

#### Decimal Notation
```
255.255.255.0
```

#### CIDR (Classless Inter-Domain Routing) Notation
```
/24
```
Means: First 24 bits are the network portion

### Common Subnet Masks

| CIDR | Decimal | Available Hosts | Common Use |
|------|---------|-----------------|------------|
| /8 | 255.0.0.0 | 16,777,214 | Large organizations |
| /16 | 255.255.0.0 | 65,534 | Medium networks |
| /24 | 255.255.255.0 | 254 | Small networks (default home) |
| /30 | 255.255.255.252 | 2 | Point-to-point links |
| /32 | 255.255.255.255 | 1 | Single host |

## Subnetting

**Process of dividing a network into smaller sub-networks**

### Why Subnet?
1. Efficient use of IP addresses
2. Improved security (segment networks)
3. Reduced broadcast traffic
4. Better network organization

### Example: Subnetting 192.168.1.0/24

**Original network**: 192.168.1.0/24 (254 hosts)

**Divide into 4 subnets** (/26 - 255.255.255.192):

```
Subnet 1: 192.168.1.0/26    (192.168.1.0 - 192.168.1.63)
Subnet 2: 192.168.1.64/26   (192.168.1.64 - 192.168.1.127)
Subnet 3: 192.168.1.128/26  (192.168.1.128 - 192.168.1.191)
Subnet 4: 192.168.1.192/26  (192.168.1.192 - 192.168.1.255)
```

Each subnet has:
- **Network address**: First address (e.g., 192.168.1.0)
- **Broadcast address**: Last address (e.g., 192.168.1.63)
- **Usable hosts**: 62 addresses (64 - 2)

### Calculating Subnet Information

For **192.168.1.0/26**:

```
Network: 192.168.1.0
First host: 192.168.1.1
Last host: 192.168.1.62
Broadcast: 192.168.1.63
Total hosts: 64
Usable hosts: 62
```

## CIDR and Supernetting

**CIDR** (Classless Inter-Domain Routing) allows flexible network sizing.

### Example: Route Aggregation
Instead of advertising:
```
192.168.0.0/24
192.168.1.0/24
192.168.2.0/24
192.168.3.0/24
```

Aggregate to:
```
192.168.0.0/22
```

Benefits:
- Smaller routing tables
- More efficient routing
- Better scalability

## NAT (Network Address Translation)

**Allows multiple devices to share a single public IP address**

### How NAT Works

```
Private Network (192.168.1.0/24)
    ↓
Router (NAT device)
    ↓
Public IP (203.0.113.5)
    ↓
Internet
```

### NAT Translation Table

| Private IP:Port | Public IP:Port | Destination |
|-----------------|----------------|-------------|
| 192.168.1.10:5000 | 203.0.113.5:50001 | 93.184.216.34:80 |
| 192.168.1.11:6000 | 203.0.113.5:50002 | 151.101.1.140:443 |

### Types of NAT

1. **Static NAT**: One-to-one mapping (1 private ↔ 1 public)
2. **Dynamic NAT**: Many-to-many from a pool
3. **PAT (Port Address Translation)**: Many-to-one using ports (most common)

### NAT Benefits
- Conserves public IP addresses
- Adds security layer
- Allows network restructuring without renumbering

### NAT Limitations
- Breaks end-to-end connectivity
- Complicates peer-to-peer applications
- Can affect performance

## DHCP (Dynamic Host Configuration Protocol)

**Automatically assigns IP addresses to devices**

### How DHCP Works

```
1. DISCOVER: Client broadcasts "I need an IP"
2. OFFER:    Server responds "Here's an available IP"
3. REQUEST:  Client requests that specific IP
4. ACK:      Server confirms and assigns IP
```

### DHCP Lease Information

Server provides:
- IP address
- Subnet mask
- Default gateway
- DNS servers
- Lease duration

### Static vs Dynamic IP

**Static IP**:
- Manually assigned
- Doesn't change
- Used for servers, printers, network equipment

**Dynamic IP**:
- Automatically assigned by DHCP
- Can change over time
- Used for client devices

## Useful Commands

### Check your IP address

**Linux/Mac**:
```bash
ifconfig
ip addr show
```

**Windows**:
```cmd
ipconfig
```

### Check routing table

**Linux/Mac**:
```bash
route -n
ip route show
```

**Windows**:
```cmd
route print
```

### Calculate subnets

**Linux**:
```bash
ipcalc 192.168.1.0/24
```

### Test connectivity

```bash
ping 8.8.8.8
traceroute google.com
```
