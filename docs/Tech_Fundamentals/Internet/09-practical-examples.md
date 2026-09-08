# Practical Examples and Troubleshooting

## Network Diagnostics

### Check Network Connectivity

#### Ping - Test Reachability

```bash
# Basic ping
ping google.com

# Specific number of packets
ping -c 4 google.com

# Continuous ping
ping -t google.com  # Windows
ping google.com     # Linux/Mac (Ctrl+C to stop)

# Set packet size
ping -s 1000 google.com
```

**What ping tells you**:
- Host is reachable
- Round-trip time (latency)
- Packet loss

#### Traceroute - Path to Destination

```bash
# Linux/Mac
traceroute google.com
traceroute -n google.com  # Show IPs only

# Windows
tracert google.com

# Better alternative (combines ping + traceroute)
mtr google.com
```

**What traceroute shows**:
- Each hop (router) along path
- Latency at each hop
- Where packets are getting delayed/dropped

#### Example Traceroute Output

```
 1  192.168.1.1 (192.168.1.1)       1.234 ms   # Your router
 2  10.0.0.1 (10.0.0.1)            5.678 ms   # ISP
 3  72.14.204.1 (72.14.204.1)     10.234 ms   # ISP backbone
 4  172.253.69.5 (172.253.69.5)   11.567 ms   # Google network
 5  142.250.224.46 (google.com)   12.345 ms   # Destination
```

### Check DNS Resolution

```bash
# Quick lookup
nslookup google.com

# Detailed lookup
dig google.com

# Check specific record type
dig google.com MX
dig google.com AAAA

# Query specific DNS server
dig @8.8.8.8 google.com

# Trace full DNS path
dig +trace google.com

# Reverse DNS lookup
dig -x 8.8.8.8
```

### Check Open Ports

```bash
# Check if port is open
nc -zv google.com 80
telnet google.com 80

# Scan multiple ports
nmap -p 80,443 google.com

# Scan range
nmap -p 1-1000 google.com

# Check local listening ports
netstat -tuln
ss -tuln
lsof -i  # Mac/Linux
```

### Check Network Interface

```bash
# Show interface information
ifconfig          # Mac/Linux (legacy)
ip addr show      # Linux (modern)
ipconfig          # Windows

# Show routing table
route -n          # Linux
netstat -rn       # Mac
route print       # Windows
ip route show     # Linux (modern)

# Show ARP table
arp -a
ip neigh show     # Linux (modern)
```

## Common Network Problems and Solutions

### Problem 1: "Can't connect to website"

#### Diagnosis Steps

```bash
# 1. Can you reach internet at all?
ping 8.8.8.8

# 2. Is DNS working?
ping google.com
nslookup google.com

# 3. Is the specific site down?
curl -I https://example.com

# 4. Check if port is blocked
telnet example.com 443
```

**Possible causes**:
- No internet connection → Check cables, router
- DNS issue → Change DNS to 8.8.8.8
- Site is down → Check status page
- Firewall blocking → Check firewall rules

### Problem 2: "Slow internet connection"

#### Diagnosis Steps

```bash
# 1. Test latency
ping google.com

# 2. Test bandwidth
# Use speedtest.net or fast.com

# 3. Check for packet loss
ping -c 100 google.com
# Look for % packet loss

# 4. Trace route to find bottleneck
mtr google.com
```

**Possible causes**:
- High latency (>100ms) → Network congestion, distance
- Packet loss → Faulty hardware, congestion
- Low bandwidth → ISP issue, too many users

### Problem 3: "DNS not resolving"

#### Fix DNS Issues

```bash
# 1. Flush DNS cache
# Windows
ipconfig /flushdns

# Mac
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Linux
sudo systemd-resolve --flush-caches

# 2. Change DNS servers
# Edit network settings to use:
# Google: 8.8.8.8, 8.8.4.4
# Cloudflare: 1.1.1.1, 1.0.0.1

# 3. Test different DNS server
dig @8.8.8.8 google.com
```

### Problem 4: "Port is blocked"

#### Check Port Accessibility

```bash
# Test from outside
# Use online port checker tools

# Check firewall rules
# Linux
sudo iptables -L -v -n
sudo ufw status

# Mac
sudo pfctl -s rules

# Windows
netsh advfirewall show allprofiles
```

## Packet Capture and Analysis

### Using tcpdump

```bash
# Capture all traffic on interface
sudo tcpdump -i eth0

# Capture HTTP traffic
sudo tcpdump -i eth0 port 80

# Capture traffic to/from specific IP
sudo tcpdump -i eth0 host 192.168.1.10

# Save to file
sudo tcpdump -i eth0 -w capture.pcap

# Read from file
tcpdump -r capture.pcap

# Verbose output with ASCII
sudo tcpdump -i eth0 -A port 80
```

### Useful tcpdump Filters

```bash
# TCP SYN packets
sudo tcpdump 'tcp[tcpflags] & tcp-syn != 0'

# DNS queries
sudo tcpdump -i eth0 port 53

# HTTP GET requests
sudo tcpdump -i eth0 -A 'tcp port 80 and (((ip[2:2] - ((ip[0]&0xf)<<2)) - ((tcp[12]&0xf0)>>2)) != 0)'

# Capture first 96 bytes
sudo tcpdump -i eth0 -s 96
```

## Performance Testing

### Bandwidth Testing

```bash
# iperf3 (server)
iperf3 -s

# iperf3 (client)
iperf3 -c server_ip

# Test UDP
iperf3 -c server_ip -u -b 100M

# Reverse direction
iperf3 -c server_ip -R
```

### Latency Testing

```bash
# Continuous ping with statistics
ping -c 1000 google.com | tail -2

# Advanced with mtr
mtr --report --report-cycles 100 google.com
```

### Connection Testing

```bash
# Test HTTP response time
time curl -o /dev/null -s https://example.com

# Detailed timing
curl -w "@curl-format.txt" -o /dev/null -s https://example.com
```

**curl-format.txt**:
```
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
    time_appconnect:  %{time_appconnect}\n
   time_pretransfer:  %{time_pretransfer}\n
      time_redirect:  %{time_redirect}\n
 time_starttransfer:  %{time_starttransfer}\n
                    ----------\n
         time_total:  %{time_total}\n
```

## Monitoring and Logging

### Real-time Network Monitoring

```bash
# Linux - iftop
sudo iftop -i eth0

# Linux - nethogs (by process)
sudo nethogs eth0

# Linux - vnstat (statistics)
vnstat -i eth0
vnstat -l -i eth0  # Live

# Mac - nettop
nettop -m route

# Windows - Resource Monitor
resmon.exe
```

### Log Analysis

```bash
# View system logs (Linux)
journalctl -u NetworkManager
tail -f /var/log/syslog

# View connection logs
last        # Login history
lastlog     # Last login per user

# View failed connections
grep "Failed" /var/log/auth.log
```

## Security Scanning

### Port Scanning with Nmap

```bash
# Quick scan most common ports
nmap example.com

# All ports
nmap -p- example.com

# Detect OS and services
sudo nmap -A example.com

# Stealth SYN scan
sudo nmap -sS example.com

# Scan local network
nmap 192.168.1.0/24

# Detect hosts on network
sudo nmap -sn 192.168.1.0/24
```

### SSL/TLS Testing

```bash
# Test SSL connection
openssl s_client -connect example.com:443

# Show certificate details
openssl s_client -connect example.com:443 </dev/null 2>/dev/null | openssl x509 -text

# Test specific TLS version
openssl s_client -connect example.com:443 -tls1_2
openssl s_client -connect example.com:443 -tls1_3

# Test cipher suites
nmap --script ssl-enum-ciphers -p 443 example.com
```

## Practical Scenarios

### Scenario 1: Setting Up Home Network

```bash
# 1. Configure router
# - Assign static IP for router (e.g., 192.168.1.1)
# - Enable DHCP (192.168.1.100-200)
# - Set DNS (8.8.8.8, 1.1.1.1)

# 2. Configure static IPs for servers/printers
# Edit /etc/network/interfaces (Linux)
auto eth0
iface eth0 inet static
    address 192.168.1.10
    netmask 255.255.255.0
    gateway 192.168.1.1
    dns-nameservers 8.8.8.8 1.1.1.1

# 3. Set up port forwarding
# Forward port 443 to internal server 192.168.1.10:443

# 4. Test connectivity
ping 192.168.1.1        # Router
ping 8.8.8.8            # Internet
ping google.com         # DNS
```

### Scenario 2: Debugging Slow Website

```bash
# 1. Check DNS resolution time
time dig example.com

# 2. Test connection time
curl -w "@curl-format.txt" -o /dev/null -s https://example.com

# 3. Trace route
mtr example.com

# 4. Check server response time
time curl -I https://example.com

# 5. Test from different location
# Use online tools like pingdom.com
```

### Scenario 3: Securing SSH Server

```bash
# 1. Change default port (edit /etc/ssh/sshd_config)
Port 2222

# 2. Disable password auth
PasswordAuthentication no

# 3. Enable key-only auth
PubkeyAuthentication yes

# 4. Disable root login
PermitRootLogin no

# 5. Restart SSH
sudo systemctl restart sshd

# 6. Configure firewall
sudo ufw allow 2222/tcp
sudo ufw enable

# 7. Test connection
ssh -p 2222 user@server
```

## Useful One-Liners

```bash
# Find your public IP
curl ifconfig.me
curl ipinfo.io

# Check if website is up
curl -Is https://example.com | head -1

# Get HTTP headers
curl -I https://example.com

# Download file with progress
wget https://example.com/file.zip

# Test download speed
wget -O /dev/null http://speedtest.wdc01.softlayer.com/downloads/test100.zip

# Monitor bandwidth usage
watch -n 1 ifconfig eth0

# Find all hosts on local network
sudo arp-scan --localnet

# Check listening ports and processes
sudo netstat -tulpn

# View active connections
watch -n 1 'netstat -an | grep ESTABLISHED'
```
