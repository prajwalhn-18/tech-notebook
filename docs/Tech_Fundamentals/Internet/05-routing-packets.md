# Routing and Packet Switching

## What is Routing?

**Routing** is the process of selecting paths in a network to send data packets from source to destination.

## Packet Switching

Unlike circuit switching (traditional phones), the internet uses **packet switching**:

### How Packet Switching Works

1. **Data broken into packets**
   - Each packet: ~1,500 bytes (typical MTU)
   - Contains: header (addressing) + payload (data)

2. **Independent routing**
   - Each packet routed independently
   - Can take different paths
   - May arrive out of order

3. **Reassembly at destination**
   - Packets reassembled using sequence numbers
   - Missing packets requested again

### Packet Structure

```
[Packet Header]
├── Source IP
├── Destination IP
├── Protocol (TCP/UDP)
├── TTL (Time to Live)
├── Checksum
└── Other metadata

[Payload]
└── Actual data
```

## How Routers Work

A router makes forwarding decisions based on **routing tables**.

### Routing Table Example

```
Destination        Gateway         Interface    Metric
0.0.0.0/0         192.168.1.1     eth0         100    (Default route)
192.168.1.0/24    0.0.0.0         eth0         0      (Local network)
10.0.0.0/8        192.168.1.254   eth0         50     (Remote network)
```

### Router Decision Process

```
1. Packet arrives
2. Extract destination IP
3. Look up in routing table
4. Find best matching route (longest prefix match)
5. Forward to next hop
6. Decrement TTL
7. Recalculate checksum
```

### Longest Prefix Match

If routing table has:
```
10.0.0.0/8
10.1.0.0/16
10.1.1.0/24
```

For destination `10.1.1.5`:
- Matches all three
- **10.1.1.0/24** wins (most specific)

## Routing Algorithms

### 1. Static Routing

**Manually configured routes**

```bash
# Add static route (Linux)
ip route add 10.0.0.0/8 via 192.168.1.254

# Add static route (Windows)
route add 10.0.0.0 mask 255.0.0.0 192.168.1.254
```

**Pros**: Simple, predictable, no overhead
**Cons**: Not scalable, no automatic failover

### 2. Dynamic Routing

**Routers automatically learn routes using protocols**

#### Distance Vector Protocols

**RIP (Routing Information Protocol)**
- **Metric**: Hop count (number of routers)
- **Max hops**: 15 (16 = unreachable)
- **Updates**: Every 30 seconds
- **Use**: Small networks
- **Algorithm**: Bellman-Ford

**How it works**:
```
1. Each router knows directly connected networks
2. Routers share routing tables with neighbors
3. Each router updates based on neighbor info
4. Gradually, all routers learn all routes
```

#### Link State Protocols

**OSPF (Open Shortest Path First)**
- **Metric**: Cost (based on bandwidth)
- **Algorithm**: Dijkstra's
- **Updates**: Only when changes occur
- **Use**: Enterprise networks

**How it works**:
```
1. Routers discover neighbors
2. Exchange link state information
3. Each router builds complete network map
4. Calculate shortest path to all destinations
5. Populate routing table
```

**IS-IS (Intermediate System to Intermediate System)**
- Similar to OSPF
- Common in ISP networks

#### Path Vector Protocol

**BGP (Border Gateway Protocol)**
- **Use**: Internet backbone routing
- **Scope**: Between autonomous systems (AS)
- **Metric**: Policy-based (not just distance)

**How it works**:
```
1. Each AS has an AS number (ASN)
2. BGP routers exchange path information
3. Paths include list of ASes traversed
4. Routers select best path based on policy
5. Avoid loops (reject paths containing own ASN)
```

**BGP Attributes**:
- AS Path
- Next Hop
- Local Preference
- MED (Multi-Exit Discriminator)

## Autonomous Systems (AS)

**Collection of IP networks under single administrative control**

### AS Numbers
- **Range**: 1 - 4,294,967,295
- **Format**: ASN (AS Number)
- **Example**: AS15169 (Google)

### Peering Relationships

1. **Transit**: Pay another AS for connectivity
2. **Peering**: Free exchange of traffic (mutual benefit)
3. **Customer**: Provide connectivity for payment

### BGP Path Selection

Priority order:
1. Highest local preference
2. Shortest AS path
3. Lowest origin type
4. Lowest MED
5. eBGP over iBGP
6. Lowest IGP metric to next hop
7. Oldest path

## TTL (Time to Live)

**Prevents packets from circulating forever**

### How TTL Works

```
1. Sender sets TTL (e.g., 64)
2. Each router decrements TTL by 1
3. If TTL reaches 0, packet dropped
4. Router sends ICMP "Time Exceeded" message
```

### TTL Values

Common initial values:
- Linux: 64
- Windows: 128
- Cisco routers: 255

## Traceroute

Uses TTL to discover path to destination:

```bash
traceroute google.com
```

### How Traceroute Works

```
1. Send packet with TTL=1
   → First router drops it, replies "Time Exceeded"
2. Send packet with TTL=2
   → Second router drops it, replies "Time Exceeded"
3. Repeat, incrementing TTL
   → Discover each hop along the path
4. Continue until destination reached
```

**Output example**:
```
1  192.168.1.1 (192.168.1.1)      1.234 ms
2  10.0.0.1 (10.0.0.1)            5.678 ms
3  72.14.204.1 (72.14.204.1)     10.234 ms
4  172.253.69.5 (172.253.69.5)   11.567 ms
5  142.250.224.46 (google.com)   12.345 ms
```

## Load Balancing

**Distribute traffic across multiple paths**

### Methods

1. **Per-Packet**: Each packet takes different path
   - Pro: Better utilization
   - Con: Out-of-order delivery

2. **Per-Flow**: All packets in a flow use same path
   - Pro: Maintains order
   - Con: Less granular

3. **Equal-Cost Multi-Path (ECMP)**: Distribute across equal-cost routes

## Anycast

**Same IP address announced from multiple locations**

### How Anycast Works

```
DNS Server: 8.8.8.8

Announced from:
- Mountain View, CA
- New York, NY
- London, UK
- Tokyo, Japan

User connects to nearest location
```

**Benefits**:
- Reduced latency
- DDoS mitigation
- Load distribution
- Failover

## Multicast

**One-to-many communication**

- **IP Range**: 224.0.0.0/4
- **Use Cases**: Video streaming, stock tickers, discovery protocols
- **Protocol**: IGMP (Internet Group Management Protocol)

## Quality of Service (QoS)

**Prioritize certain types of traffic**

### Traffic Classification

```
High Priority:  VoIP, video conferencing
Medium Priority: Web browsing, email
Low Priority:   File downloads, backups
```

### QoS Mechanisms

1. **Classification**: Identify traffic types
2. **Marking**: Tag packets (DSCP, CoS)
3. **Queuing**: Buffer management
4. **Shaping**: Control transmission rate
5. **Policing**: Drop excess traffic

## Routing Loops

**Problem**: Packets circulate endlessly

### Prevention Methods

1. **TTL**: Packets eventually dropped
2. **Split Horizon**: Don't advertise route back to source
3. **Route Poisoning**: Set bad route to infinite metric
4. **Hold-down Timers**: Wait before accepting new routes

## Path MTU Discovery

**Find maximum packet size for path**

```
1. Send large packet with "Don't Fragment" flag
2. If router can't forward, sends "Fragmentation Needed"
3. Sender reduces packet size
4. Repeat until successful
5. Cache MTU for this destination
```

**Common MTU Values**:
- Ethernet: 1500 bytes
- Internet minimum: 576 bytes (IPv4), 1280 bytes (IPv6)
- Jumbo frames: 9000 bytes

## Practical Routing Commands

### View routing table

```bash
# Linux/Mac
route -n
netstat -rn
ip route show

# Windows
route print
```

### Add/remove routes

```bash
# Linux
ip route add 10.0.0.0/8 via 192.168.1.254
ip route del 10.0.0.0/8

# Windows
route add 10.0.0.0 mask 255.0.0.0 192.168.1.254
route delete 10.0.0.0
```

### Trace route

```bash
# Linux/Mac
traceroute google.com
mtr google.com  # Better, continuous traceroute

# Windows
tracert google.com
```

### Check BGP information

```bash
# Query BGP looking glass
# Various public BGP looking glasses available online

# Check AS path to destination
traceroute -A google.com  # Shows AS numbers
```
