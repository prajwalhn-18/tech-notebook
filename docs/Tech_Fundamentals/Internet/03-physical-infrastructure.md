# Physical Infrastructure of the Internet

## Global Network Topology

The internet is physically a hierarchical structure of interconnected networks:

```
Tier 1 Networks (Internet Backbone)
    ↓
Tier 2 Networks (Regional ISPs)
    ↓
Tier 3 Networks (Local ISPs)
    ↓
End Users
```

## Network Tiers

### Tier 1 Networks
- **Definition**: Networks that can reach every other network on the internet without paying for transit
- **Characteristics**:
  - Peer with each other for free
  - Form the internet backbone
  - Global reach
- **Examples**:
  - AT&T
  - Verizon
  - Level 3 (now Lumen)
  - NTT Communications
  - Telia Carrier

### Tier 2 Networks
- **Definition**: Regional networks that peer with some networks but purchase transit from Tier 1
- **Characteristics**:
  - Serve specific geographic regions
  - Mix of peering and paid transit
- **Examples**: Regional ISPs, medium-sized carriers

### Tier 3 Networks
- **Definition**: Local ISPs that purchase all internet access from Tier 2 or Tier 1
- **Characteristics**:
  - Serve end customers
  - Buy all transit
- **Examples**: Your local cable/DSL provider

## Physical Transmission Media

### 1. Fiber Optic Cables

**Most important backbone technology**

#### How They Work
- Transmit data as pulses of light
- Core surrounded by cladding (reflects light)
- Total internal reflection keeps light inside

#### Types
- **Single-mode**: Long distance, single light path
- **Multi-mode**: Shorter distance, multiple light paths

#### Advantages
- Extremely fast (up to 100+ Gbps per fiber)
- Low latency
- Long distance without signal degradation
- Not affected by electromagnetic interference

#### Where Used
- Undersea cables connecting continents
- Backbone connections between cities
- Data center interconnects
- Last-mile in some areas (FTTH - Fiber to the Home)

### 2. Submarine Cables

**Connect continents across oceans**

#### Key Facts
- Over 400 submarine cable systems globally
- Carry 99% of intercontinental data traffic
- Thousands of kilometers long
- Laid on ocean floor by specialized ships

#### Major Routes
- Trans-Atlantic: USA ↔ Europe
- Trans-Pacific: USA ↔ Asia
- Europe ↔ Middle East ↔ Asia
- Americas interconnections

#### Famous Cables
- TAT-14: USA to Europe
- FASTER: USA to Japan
- SEA-ME-WE 3: Southeast Asia to Middle East to Western Europe

#### Structure
```
[Core Fiber Optics]
[Copper/Power]
[Protective Layers]
[Steel Wire Armor]
[Outer Sheath]
```

### 3. Copper Cables

#### Twisted Pair (Ethernet - Cat5e, Cat6, Cat7)
- **Speed**: Up to 10 Gbps (Cat6a/7)
- **Distance**: Up to 100 meters
- **Use**: LANs, home networks, office buildings

#### Coaxial Cable
- **Speed**: Up to 1 Gbps
- **Use**: Cable internet, older TV networks
- **Structure**: Central conductor, insulation, shield, jacket

### 4. Wireless Transmission

#### Wi-Fi (802.11)
- **Standards**: 802.11a/b/g/n/ac/ax (Wi-Fi 6)
- **Frequency**: 2.4 GHz, 5 GHz, 6 GHz
- **Range**: 30-100 meters
- **Use**: Local area networks

#### Cellular Networks
- **Generations**: 3G, 4G/LTE, 5G
- **Coverage**: Wide area (tower-based)
- **Use**: Mobile internet access

#### Satellite
- **Types**:
  - Geostationary (35,000 km altitude)
  - Low Earth Orbit - LEO (500-2,000 km)
- **Use**: Remote areas, ships, aircraft
- **Examples**: Starlink, OneWeb, traditional satellite internet

#### Microwave Links
- **Use**: Point-to-point connections
- **Common**: Between buildings, in mountainous areas

## Network Hardware

### 1. Routers
- **Function**: Forward packets between networks
- **Layer**: Network layer (Layer 3)
- **Role**:
  - Determine best path for data
  - Connect different networks
  - Internet backbone and home networks

### 2. Switches
- **Function**: Forward frames within a network
- **Layer**: Data link layer (Layer 2)
- **Role**:
  - Connect devices in a LAN
  - Use MAC addresses
  - More intelligent than hubs

### 3. Hubs (Legacy)
- **Function**: Broadcast data to all connected devices
- **Layer**: Physical layer (Layer 1)
- **Status**: Largely replaced by switches

### 4. Modems
- **Function**: Modulate/demodulate signals
- **Purpose**: Convert digital to analog (and vice versa)
- **Types**: DSL, cable, fiber modems

### 5. Network Interface Cards (NICs)
- **Function**: Connect device to network
- **Contains**: MAC address
- **Types**: Ethernet, Wi-Fi adapters

## Internet Exchange Points (IXPs)

**Physical locations where networks interconnect**

### Purpose
- Allow networks to exchange traffic directly
- Reduce costs (avoid paying for transit)
- Reduce latency (shorter paths)
- Improve reliability

### How They Work
```
[ISP A] ─┐
[ISP B] ─┼─ [IXP Switch] ─ Peering
[ISP C] ─┘
```

### Major IXPs
- DE-CIX (Frankfurt, Germany)
- AMS-IX (Amsterdam, Netherlands)
- LINX (London, UK)
- JPNAP (Japan)
- Any2 (Multiple locations)

## Data Centers

**Facilities housing servers and networking equipment**

### Components
1. **Servers**: Compute resources
2. **Storage**: Data storage systems
3. **Networking**: Switches, routers, load balancers
4. **Power**: UPS, generators, redundant feeds
5. **Cooling**: HVAC systems to prevent overheating
6. **Security**: Physical and digital security measures

### Types
- **Colocation**: Rent space for your equipment
- **Cloud**: Rent virtual resources (AWS, Azure, GCP)
- **Enterprise**: Company-owned data centers
- **Edge**: Smaller facilities closer to users

### Tiers (Uptime Institute)
- **Tier 1**: 99.671% uptime (28.8 hours downtime/year)
- **Tier 2**: 99.741% uptime (22 hours downtime/year)
- **Tier 3**: 99.982% uptime (1.6 hours downtime/year)
- **Tier 4**: 99.995% uptime (26 minutes downtime/year)

## Content Delivery Networks (CDNs)

**Distributed networks of servers for faster content delivery**

### How CDNs Work
1. Content replicated to multiple locations
2. User requests routed to nearest server
3. Reduces latency and load on origin server

### Major CDN Providers
- Cloudflare
- Akamai
- Amazon CloudFront
- Fastly
- Azure CDN

### Benefits
- Faster load times
- Reduced bandwidth costs
- Better reliability
- DDoS protection

## The "Last Mile"

**Connection from ISP to end user**

### Technologies
1. **DSL** (Digital Subscriber Line)
   - Uses existing phone lines
   - Speed: 1-100 Mbps

2. **Cable Internet**
   - Uses coaxial cable (TV infrastructure)
   - Speed: 50-1000+ Mbps

3. **Fiber (FTTH/FTTP)**
   - Fiber directly to home
   - Speed: 100 Mbps - 10 Gbps

4. **Fixed Wireless**
   - Radio signals from tower to home
   - Speed: 25-100 Mbps

5. **Satellite**
   - From satellite to dish
   - Speed: 25-150 Mbps (higher with Starlink)

6. **Cellular (4G/5G)**
   - Mobile network for home internet
   - Speed: 25-1000+ Mbps (5G)

## Network Redundancy

### Why Redundancy Matters
- Hardware failures
- Cable cuts
- Natural disasters
- DDoS attacks

### Redundancy Strategies
1. **Multiple paths**: Data can take alternate routes
2. **Backup systems**: Failover capabilities
3. **Geographic diversity**: Spread across locations
4. **Protocol resilience**: TCP retransmission, routing protocols
