# Core Internet Protocols

## TCP (Transmission Control Protocol)

### Overview
- **Layer**: Transport (Layer 4)
- **Type**: Connection-oriented
- **Reliability**: Guaranteed delivery
- **Use cases**: Web, email, file transfer

### Key Features

1. **Connection-oriented**
   - Three-way handshake to establish connection
   - Maintains connection state

2. **Reliable delivery**
   - Acknowledgments (ACKs)
   - Retransmission of lost packets
   - Sequence numbers

3. **Ordered delivery**
   - Packets delivered in correct order
   - Buffering for reordering

4. **Flow control**
   - Prevents sender from overwhelming receiver
   - Sliding window mechanism

5. **Congestion control**
   - Detects network congestion
   - Adjusts transmission rate

### TCP Three-Way Handshake

```
Client                          Server
  |                               |
  |  1. SYN (seq=100)            |
  |----------------------------->|
  |                              |
  |  2. SYN-ACK (seq=200,        |
  |     ack=101)                 |
  |<-----------------------------|
  |                              |
  |  3. ACK (ack=201)            |
  |----------------------------->|
  |                              |
  |  Connection Established      |
```

**Steps**:
1. **SYN**: Client sends synchronize packet
2. **SYN-ACK**: Server acknowledges, sends own SYN
3. **ACK**: Client acknowledges server's SYN

### TCP Connection Termination

```
Client                          Server
  |  1. FIN                      |
  |----------------------------->|
  |  2. ACK                      |
  |<-----------------------------|
  |  3. FIN                      |
  |<-----------------------------|
  |  4. ACK                      |
  |----------------------------->|
```

### TCP Header

```
0                   16                              31
+-----------------+---------------------------------+
|   Source Port   |       Destination Port          |
+-----------------+---------------------------------+
|              Sequence Number                      |
+---------------------------------------------------+
|           Acknowledgment Number                   |
+---------------------------------------------------+
| Offset|Reserved|Flags|      Window Size          |
+---------------------------------------------------+
|    Checksum     |       Urgent Pointer            |
+---------------------------------------------------+
|                  Options                          |
+---------------------------------------------------+
```

**Key Fields**:
- **Sequence Number**: Position of data in byte stream
- **Acknowledgment**: Next expected byte
- **Flags**: SYN, ACK, FIN, RST, PSH, URG
- **Window**: Flow control (bytes receiver can accept)

### TCP Flags

- **SYN**: Synchronize, establish connection
- **ACK**: Acknowledge received data
- **FIN**: Finish, close connection
- **RST**: Reset connection (error)
- **PSH**: Push data immediately
- **URG**: Urgent data

## UDP (User Datagram Protocol)

### Overview
- **Layer**: Transport (Layer 4)
- **Type**: Connectionless
- **Reliability**: No guarantees
- **Use cases**: DNS, streaming, gaming, VoIP

### Key Features

1. **Connectionless**
   - No handshake
   - Just send data

2. **Unreliable**
   - No acknowledgments
   - No retransmission
   - Packets may be lost

3. **Unordered**
   - No sequence numbers
   - Packets may arrive out of order

4. **Low overhead**
   - Minimal header
   - Faster than TCP

5. **No flow control**
   - Sender can overwhelm receiver

### UDP Header

```
0                   16                              31
+-----------------+---------------------------------+
|   Source Port   |       Destination Port          |
+-----------------+---------------------------------+
|     Length      |           Checksum              |
+-----------------+---------------------------------+
|                    Data                           |
+---------------------------------------------------+
```

**Much simpler than TCP!**

### TCP vs UDP

| Feature | TCP | UDP |
|---------|-----|-----|
| Connection | Connection-oriented | Connectionless |
| Reliability | Reliable | Unreliable |
| Ordering | Ordered | Unordered |
| Speed | Slower | Faster |
| Overhead | Higher | Lower |
| Use case | Accuracy matters | Speed matters |

**When to use TCP**:
- Web browsing (HTTP/HTTPS)
- Email (SMTP, POP3, IMAP)
- File transfer (FTP, SFTP)
- Remote shell (SSH)

**When to use UDP**:
- Live streaming
- Online gaming
- Voice/video calls
- DNS queries
- IoT sensors

## HTTP (Hypertext Transfer Protocol)

### Overview
- **Layer**: Application (Layer 7)
- **Port**: 80 (HTTP), 443 (HTTPS)
- **Transport**: TCP
- **Model**: Request-response

### HTTP Request Structure

```
GET /index.html HTTP/1.1
Host: www.example.com
User-Agent: Mozilla/5.0
Accept: text/html
Connection: keep-alive

[Optional body]
```

**Components**:
1. **Request Line**: Method, path, version
2. **Headers**: Metadata
3. **Blank Line**: Separator
4. **Body**: Optional data

### HTTP Methods

- **GET**: Retrieve resource
- **POST**: Submit data, create resource
- **PUT**: Update/replace resource
- **PATCH**: Partial update
- **DELETE**: Delete resource
- **HEAD**: Like GET but no body
- **OPTIONS**: Check available methods
- **CONNECT**: Establish tunnel (for proxies)
- **TRACE**: Echo request (debugging)

### HTTP Status Codes

#### 1xx: Informational
- **100 Continue**: Server received headers, send body

#### 2xx: Success
- **200 OK**: Request succeeded
- **201 Created**: Resource created
- **204 No Content**: Success but no body

#### 3xx: Redirection
- **301 Moved Permanently**: New URL forever
- **302 Found**: Temporary redirect
- **304 Not Modified**: Use cached version

#### 4xx: Client Error
- **400 Bad Request**: Invalid syntax
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: No permission
- **404 Not Found**: Resource doesn't exist
- **429 Too Many Requests**: Rate limited

#### 5xx: Server Error
- **500 Internal Server Error**: Server crashed
- **502 Bad Gateway**: Proxy received invalid response
- **503 Service Unavailable**: Server overloaded
- **504 Gateway Timeout**: Proxy timeout

### HTTP Headers

#### Request Headers
```
Host: www.example.com
User-Agent: Mozilla/5.0
Accept: text/html,application/json
Accept-Language: en-US,en
Accept-Encoding: gzip, deflate, br
Connection: keep-alive
Cookie: session=abc123
Authorization: Bearer token123
```

#### Response Headers
```
Content-Type: text/html; charset=utf-8
Content-Length: 1234
Server: nginx/1.18.0
Date: Mon, 07 Sep 2026 10:00:00 GMT
Cache-Control: max-age=3600
Set-Cookie: session=abc123; HttpOnly; Secure
Location: https://example.com/new-page
```

### HTTP Versions

#### HTTP/1.0
- One request per connection
- New connection for each resource

#### HTTP/1.1
- **Keep-alive**: Reuse connections
- **Pipelining**: Multiple requests without waiting
- **Host header**: Virtual hosting support

#### HTTP/2
- **Binary protocol** (vs text in HTTP/1.x)
- **Multiplexing**: Multiple streams over one connection
- **Header compression**: HPACK
- **Server push**: Send resources before requested
- **Stream prioritization**

#### HTTP/3
- **Uses QUIC** (over UDP, not TCP)
- **Faster connection establishment**
- **Better performance on lossy networks**
- **Built-in encryption**

## HTTPS (HTTP Secure)

### How HTTPS Works

1. **TLS Handshake**
   - Client connects to server
   - Server presents SSL/TLS certificate
   - Client verifies certificate
   - Negotiate encryption methods
   - Exchange keys

2. **Encrypted Communication**
   - All HTTP traffic encrypted
   - Uses symmetric encryption (fast)
   - Keys exchanged via asymmetric encryption (secure)

### TLS Handshake (Simplified)

```
Client                              Server
  |  1. ClientHello                   |
  |----------------------------------->|
  |  2. ServerHello, Certificate      |
  |<-----------------------------------|
  |  3. Key Exchange, Finished        |
  |----------------------------------->|
  |  4. Finished                       |
  |<-----------------------------------|
  |  Encrypted Application Data       |
  |<----------------------------------->|
```

### SSL/TLS Versions

- **SSL 2.0** - Deprecated (insecure)
- **SSL 3.0** - Deprecated (insecure)
- **TLS 1.0** - Legacy
- **TLS 1.1** - Legacy
- **TLS 1.2** - Current standard
- **TLS 1.3** - Modern, faster, more secure

## Other Important Protocols

### FTP (File Transfer Protocol)
- **Port**: 20 (data), 21 (control)
- **Purpose**: File transfer
- **Security**: Unencrypted (use SFTP or FTPS)

### SSH (Secure Shell)
- **Port**: 22
- **Purpose**: Secure remote access
- **Features**: Encrypted, authentication

### SMTP (Simple Mail Transfer Protocol)
- **Port**: 25, 587, 465
- **Purpose**: Sending email
- **See Email section for details**

### IMAP/POP3
- **Port**: 143/993 (IMAP), 110/995 (POP3)
- **Purpose**: Retrieving email

### WebSocket
- **Port**: 80 (WS), 443 (WSS)
- **Purpose**: Bidirectional communication
- **Use**: Real-time apps (chat, gaming)

### ICMP (Internet Control Message Protocol)
- **Layer**: Network (Layer 3)
- **Purpose**: Error messages, diagnostics
- **Tools**: ping, traceroute

## Ports

### Port Numbers

```
0-1023:        Well-known ports (system)
1024-49151:    Registered ports (applications)
49152-65535:   Dynamic/private ports
```

### Common Port Numbers

| Port | Protocol | Service |
|------|----------|---------|
| 20/21 | FTP | File Transfer |
| 22 | SSH | Secure Shell |
| 23 | Telnet | Remote Access |
| 25 | SMTP | Email (Send) |
| 53 | DNS | Name Resolution |
| 80 | HTTP | Web |
| 110 | POP3 | Email (Receive) |
| 143 | IMAP | Email (Access) |
| 443 | HTTPS | Secure Web |
| 587 | SMTP | Email Submission |
| 993 | IMAPS | Secure IMAP |
| 995 | POP3S | Secure POP3 |
| 3306 | MySQL | Database |
| 5432 | PostgreSQL | Database |
| 6379 | Redis | Cache |
| 27017 | MongoDB | Database |

### Socket

**Combination of IP address and port**

```
192.168.1.10:8080
```

**Identifies a specific endpoint for communication**

## Useful Commands

### Check open ports

```bash
# Linux/Mac
netstat -tuln
ss -tuln
lsof -i

# Windows
netstat -an
```

### Test TCP connection

```bash
telnet example.com 80
nc -zv example.com 80
```

### Capture packets

```bash
# tcpdump
sudo tcpdump -i eth0 port 80

# Wireshark (GUI)
# Filter: tcp.port == 80
```

### Test HTTP

```bash
curl -v https://example.com
wget -O- https://example.com

# Test specific HTTP method
curl -X POST https://api.example.com/data
```
