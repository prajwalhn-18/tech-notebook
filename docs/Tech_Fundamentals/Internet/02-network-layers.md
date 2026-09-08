# Network Layers and Models

## OSI Model (Open Systems Interconnection)

The OSI model is a conceptual framework with **7 layers** describing how data moves through a network.

### The 7 Layers

```
7. Application Layer  - User interfaces, apps (HTTP, FTP, SMTP)
6. Presentation Layer - Data formatting, encryption (SSL/TLS)
5. Session Layer      - Session management, connections
4. Transport Layer    - End-to-end communication (TCP, UDP)
3. Network Layer      - Routing, IP addressing (IP, ICMP)
2. Data Link Layer    - Node-to-node transfer (Ethernet, MAC)
1. Physical Layer     - Physical transmission (cables, signals)
```

### Layer Details

#### 7. Application Layer
- **Purpose**: Interface between network and applications
- **Protocols**: HTTP, HTTPS, FTP, SMTP, DNS, SSH
- **Examples**: Web browsers, email clients
- **Data Unit**: Messages

#### 6. Presentation Layer
- **Purpose**: Data translation, encryption, compression
- **Functions**:
  - Format conversion (ASCII, JPEG, MP3)
  - Encryption/decryption (SSL/TLS)
  - Data compression
- **Data Unit**: Data

#### 5. Session Layer
- **Purpose**: Establish, manage, terminate sessions
- **Functions**:
  - Session establishment
  - Synchronization
  - Dialog control
- **Protocols**: NetBIOS, RPC

#### 4. Transport Layer
- **Purpose**: Reliable data transfer between endpoints
- **Protocols**: TCP (reliable), UDP (fast)
- **Functions**:
  - Segmentation
  - Flow control
  - Error detection
  - Port addressing
- **Data Unit**: Segments (TCP) or Datagrams (UDP)

#### 3. Network Layer
- **Purpose**: Routing packets across networks
- **Protocols**: IP, ICMP, IGMP
- **Functions**:
  - Logical addressing (IP addresses)
  - Routing
  - Packet forwarding
- **Data Unit**: Packets

#### 2. Data Link Layer
- **Purpose**: Transfer data between adjacent nodes
- **Protocols**: Ethernet, Wi-Fi (802.11), PPP
- **Functions**:
  - Physical addressing (MAC addresses)
  - Frame formatting
  - Error detection
  - Media access control
- **Data Unit**: Frames

#### 1. Physical Layer
- **Purpose**: Transmit raw bits over physical medium
- **Components**: Cables, hubs, network cards
- **Functions**:
  - Bit transmission
  - Physical topology
  - Signal encoding
- **Data Unit**: Bits

## TCP/IP Model (Internet Protocol Suite)

The TCP/IP model is a **4-layer** practical implementation used by the actual internet.

```
4. Application Layer   - Combines OSI layers 5-7 (HTTP, FTP, DNS)
3. Transport Layer     - Same as OSI layer 4 (TCP, UDP)
2. Internet Layer      - Same as OSI layer 3 (IP, ICMP)
1. Network Access      - Combines OSI layers 1-2 (Ethernet, Wi-Fi)
```

## OSI vs TCP/IP Comparison

| OSI Model | TCP/IP Model | Purpose |
|-----------|--------------|---------|
| Application | Application | User-facing services |
| Presentation | Application | Data formatting |
| Session | Application | Session management |
| Transport | Transport | End-to-end delivery |
| Network | Internet | Routing across networks |
| Data Link | Network Access | Local network transfer |
| Physical | Network Access | Physical transmission |

## Encapsulation Process

As data moves down layers, each layer adds its own header (encapsulation):

```
Application: [Data]
Transport:   [TCP Header][Data]
Network:     [IP Header][TCP Header][Data]
Data Link:   [Frame Header][IP Header][TCP Header][Data][Frame Footer]
Physical:    01010101... (bits)
```

## Decapsulation Process

At the receiving end, headers are removed as data moves up:

```
Physical:    Receives bits
Data Link:   Removes frame header/footer
Network:     Removes IP header, routes packet
Transport:   Removes TCP header, reassembles data
Application: Receives original data
```

## Real-World Example: Loading a Web Page

```
1. Application Layer:  Browser requests https://example.com
2. Transport Layer:    TCP creates connection, breaks data into segments
3. Network Layer:      IP adds source/destination addresses
4. Data Link Layer:    Ethernet adds MAC addresses
5. Physical Layer:     Bits transmitted over network cable/WiFi

[Travel across internet via routers and switches]

6. Physical Layer:     Server receives bits
7. Data Link Layer:    Removes frame headers
8. Network Layer:      Checks IP, determines it's for this server
9. Transport Layer:    Reassembles TCP segments
10. Application Layer: Web server processes HTTP request, sends response

[Process repeats in reverse for response]
```

## Why Layers Matter

1. **Modularity**: Each layer can be updated independently
2. **Interoperability**: Standard interfaces between layers
3. **Troubleshooting**: Isolate issues to specific layers
4. **Abstraction**: Higher layers don't need to know lower layer details
5. **Flexibility**: Different implementations at each layer

## Common Protocols by Layer

### Application Layer
- HTTP/HTTPS - Web
- FTP/SFTP - File transfer
- SMTP/POP3/IMAP - Email
- DNS - Name resolution
- SSH - Secure shell
- Telnet - Remote terminal

### Transport Layer
- TCP - Reliable, connection-oriented
- UDP - Fast, connectionless

### Network Layer
- IPv4/IPv6 - Addressing and routing
- ICMP - Error messages (ping)
- ARP - Address resolution

### Data Link Layer
- Ethernet - Wired networks
- Wi-Fi (802.11) - Wireless networks
- PPP - Point-to-point connections
