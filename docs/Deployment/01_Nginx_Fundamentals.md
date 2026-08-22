# Nginx Fundamentals

Nginx (pronounced "engine-x") is a high-performance web server, reverse proxy, load balancer, and HTTP cache. It's known for its stability, rich feature set, simple configuration, and low resource consumption.

## Table of Contents
1. [Architecture](#architecture)
2. [Basic Configuration](#basic-configuration)
3. [Reverse Proxy](#reverse-proxy)
4. [Load Balancing](#load-balancing)
5. [SSL/TLS Configuration](#ssltls-configuration)
6. [Caching](#caching)
7. [Security](#security)
8. [Performance Tuning](#performance-tuning)

## Architecture

### Event-Driven Architecture

```
┌─────────────────────────────────────────┐
│         Nginx Master Process            │
│  (reads config, manages workers)        │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┬────────────┐
    ▼          ▼          ▼            ▼
┌────────┐ ┌────────┐ ┌────────┐  ┌────────┐
│Worker 1│ │Worker 2│ │Worker 3│  │Worker N│
│        │ │        │ │        │  │        │
│ Event  │ │ Event  │ │ Event  │  │ Event  │
│  Loop  │ │  Loop  │ │  Loop  │  │  Loop  │
└────────┘ └────────┘ └────────┘  └────────┘
```

**Key characteristics:**
- **Master process**: Reads configuration, manages worker processes
- **Worker processes**: Handle actual requests using event-driven model
- **Non-blocking I/O**: Single worker can handle thousands of connections
- **Asynchronous**: No thread-per-connection overhead

### Process Model

```bash
# Check nginx processes
ps aux | grep nginx

# Output:
# root      1234  0.0  0.1  nginx: master process
# nginx     1235  0.0  0.5  nginx: worker process
# nginx     1236  0.0  0.5  nginx: worker process
```

## Basic Configuration

### Configuration Structure

```nginx
# /etc/nginx/nginx.conf

# Main context - global settings
user nginx;
worker_processes auto;  # One per CPU core
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

# Events context - connection processing
events {
    worker_connections 1024;  # Max connections per worker
    use epoll;                # Efficient event mechanism on Linux
    multi_accept on;          # Accept multiple connections at once
}

# HTTP context - HTTP server settings
http {
    # Basic settings
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript;

    # Include server configurations
    include /etc/nginx/conf.d/*.conf;
}
```

### Simple Web Server

```nginx
# /etc/nginx/conf.d/myapp.conf

server {
    listen 80;
    server_name example.com www.example.com;
    root /var/www/html;
    index index.html index.htm;

    # Main location
    location / {
        try_files $uri $uri/ =404;
    }

    # Static assets with caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Custom error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;

    location = /50x.html {
        root /usr/share/nginx/html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### Location Matching

```nginx
server {
    listen 80;
    server_name example.com;

    # Exact match (highest priority)
    location = /exact {
        return 200 "Exact match\n";
    }

    # Preferential prefix match
    location ^~ /images/ {
        root /var/www;
    }

    # Regex match (case-sensitive)
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php-fpm.sock;
    }

    # Regex match (case-insensitive)
    location ~* \.(jpg|jpeg|png|gif)$ {
        expires 30d;
    }

    # Prefix match (lowest priority)
    location /documents/ {
        root /var/www;
    }

    # Default/fallback
    location / {
        try_files $uri $uri/ =404;
    }
}

# Priority order:
# 1. Exact match (=)
# 2. Preferential prefix (^~)
# 3. Regex match (~, ~*)
# 4. Prefix match
```

## Reverse Proxy

### Basic Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        # Proxy to backend server
        proxy_pass http://localhost:3000;

        # Pass original host header
        proxy_set_header Host $host;

        # Pass real client IP
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }
}
```

### WebSocket Proxy

```nginx
server {
    listen 80;
    server_name ws.example.com;

    location /socket.io/ {
        proxy_pass http://localhost:3000;

        # WebSocket specific headers
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Timeouts for long-lived connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

### Microservices Routing

```nginx
server {
    listen 80;
    server_name api.example.com;

    # User service
    location /api/users {
        proxy_pass http://user-service:8001;
        include /etc/nginx/proxy_params;
    }

    # Order service
    location /api/orders {
        proxy_pass http://order-service:8002;
        include /etc/nginx/proxy_params;
    }

    # Product service
    location /api/products {
        proxy_pass http://product-service:8003;
        include /etc/nginx/proxy_params;
    }

    # Payment service
    location /api/payments {
        proxy_pass http://payment-service:8004;
        include /etc/nginx/proxy_params;
    }
}

# /etc/nginx/proxy_params
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_redirect off;
```

## Load Balancing

### Load Balancing Methods

```nginx
# Round Robin (default)
upstream backend {
    server backend1.example.com;
    server backend2.example.com;
    server backend3.example.com;
}

# Least Connections
upstream backend {
    least_conn;
    server backend1.example.com;
    server backend2.example.com;
    server backend3.example.com;
}

# IP Hash (session persistence)
upstream backend {
    ip_hash;
    server backend1.example.com;
    server backend2.example.com;
    server backend3.example.com;
}

# Weighted Round Robin
upstream backend {
    server backend1.example.com weight=3;
    server backend2.example.com weight=2;
    server backend3.example.com weight=1;
}

# Server with backup
upstream backend {
    server backend1.example.com;
    server backend2.example.com;
    server backend3.example.com backup;  # Only used if others fail
}

# Health checks
upstream backend {
    server backend1.example.com max_fails=3 fail_timeout=30s;
    server backend2.example.com max_fails=3 fail_timeout=30s;
    server backend3.example.com max_fails=3 fail_timeout=30s;
}
```

### Advanced Load Balancing

```nginx
# Upstream configuration with all features
upstream api_backend {
    # Load balancing method
    least_conn;

    # Keepalive connections to backend
    keepalive 32;
    keepalive_requests 100;
    keepalive_timeout 60s;

    # Server definitions
    server 10.0.1.10:8080 weight=3 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8080 weight=2 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:8080 weight=1 max_fails=3 fail_timeout=30s;
    server 10.0.1.13:8080 backup;

    # Slow start (Nginx Plus)
    # server 10.0.1.14:8080 slow_start=30s;
}

server {
    listen 80;
    server_name api.example.com;

    location /api/ {
        proxy_pass http://api_backend;

        # Use HTTP/1.1 for keepalive
        proxy_http_version 1.1;
        proxy_set_header Connection "";

        # Standard headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Active Health Checks (Nginx Plus)

```nginx
# Available in Nginx Plus
upstream backend {
    zone backend 64k;
    server backend1.example.com;
    server backend2.example.com;
}

server {
    listen 80;

    location / {
        proxy_pass http://backend;
        health_check interval=5s fails=3 passes=2 uri=/health;
    }

    # Health check endpoint
    location = /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

## SSL/TLS Configuration

### Basic HTTPS Setup

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    # SSL certificate files
    ssl_certificate /etc/nginx/ssl/example.com.crt;
    ssl_certificate_key /etc/nginx/ssl/example.com.key;

    # SSL protocols and ciphers
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # SSL session cache
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/nginx/ssl/ca-certs.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        root /var/www/html;
        index index.html;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}
```

### Let's Encrypt with Certbot

```nginx
# Before obtaining certificate
server {
    listen 80;
    server_name example.com www.example.com;

    # Certbot validation
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# After obtaining certificate
server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        root /var/www/html;
        index index.html;
    }
}
```

### SSL Best Practices

```nginx
# /etc/nginx/snippets/ssl-params.conf

# Modern configuration (recommended)
ssl_protocols TLSv1.3 TLSv1.2;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers off;

# SSL session
ssl_session_cache shared:SSL:50m;
ssl_session_timeout 1d;
ssl_session_tickets off;

# OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# Security headers
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;

# Diffie-Hellman parameter
ssl_dhparam /etc/nginx/dhparam.pem;
```

## Caching

### Proxy Cache Configuration

```nginx
# Define cache path and settings
http {
    proxy_cache_path /var/cache/nginx
                     levels=1:2
                     keys_zone=my_cache:10m
                     max_size=10g
                     inactive=60m
                     use_temp_path=off;

    server {
        listen 80;
        server_name example.com;

        location / {
            proxy_pass http://backend;

            # Enable caching
            proxy_cache my_cache;

            # Cache keys
            proxy_cache_key "$scheme$request_method$host$request_uri";

            # Cache status codes
            proxy_cache_valid 200 60m;
            proxy_cache_valid 404 10m;

            # Cache even when backend returns these headers
            proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;

            # Background updates
            proxy_cache_background_update on;

            # Lock to prevent cache stampede
            proxy_cache_lock on;

            # Add cache status header
            add_header X-Cache-Status $upstream_cache_status;

            # Bypass cache for specific conditions
            proxy_cache_bypass $cookie_nocache $arg_nocache;
            proxy_no_cache $cookie_nocache $arg_nocache;

            # Standard proxy settings
            include /etc/nginx/proxy_params;
        }

        # Purge cache (requires ngx_cache_purge module)
        location ~ /purge(/.*) {
            allow 127.0.0.1;
            deny all;
            proxy_cache_purge my_cache "$scheme$request_method$host$1";
        }
    }
}
```

### Static File Caching

```nginx
server {
    listen 80;
    server_name static.example.com;
    root /var/www/static;

    # Browser caching for static assets
    location ~* \.(jpg|jpeg|png|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location ~* \.(css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location ~* \.(pdf|doc|docx)$ {
        expires 1d;
        add_header Cache-Control "public";
    }

    # Open file cache
    open_file_cache max=1000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
}
```

### Cache Purging and Management

```nginx
# Cache purge endpoint (requires ngx_cache_purge)
location ~ /purge(/.*) {
    allow 127.0.0.1;
    deny all;
    proxy_cache_purge my_cache "$scheme$request_method$host$1";
}

# Selective cache bypass
map $request_method $skip_cache {
    POST 1;
    PUT 1;
    DELETE 1;
    default 0;
}

map $http_cookie $skip_cache {
    ~*admin 1;
    default 0;
}

server {
    location / {
        proxy_pass http://backend;
        proxy_cache my_cache;
        proxy_cache_bypass $skip_cache;
        proxy_no_cache $skip_cache;
    }
}
```

## Security

### Rate Limiting

```nginx
http {
    # Define rate limit zones
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=5r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/m;

    # Connection limiting
    limit_conn_zone $binary_remote_addr zone=addr:10m;

    server {
        listen 80;
        server_name example.com;

        # General rate limit
        location / {
            limit_req zone=general burst=20 nodelay;
            limit_conn addr 10;
            proxy_pass http://backend;
        }

        # API rate limit
        location /api/ {
            limit_req zone=api burst=10 nodelay;
            limit_req_status 429;
            proxy_pass http://api_backend;
        }

        # Login rate limit (prevent brute force)
        location /login {
            limit_req zone=login burst=2;
            proxy_pass http://auth_backend;
        }
    }
}
```

### Access Control

```nginx
server {
    listen 80;
    server_name admin.example.com;

    # IP-based access control
    location /admin {
        # Allow specific IPs
        allow 192.168.1.0/24;
        allow 10.0.0.1;
        deny all;

        proxy_pass http://admin_backend;
    }

    # Basic authentication
    location /protected {
        auth_basic "Restricted Area";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://backend;
    }

    # Geo-blocking
    location / {
        if ($allowed_country = no) {
            return 403;
        }
        proxy_pass http://backend;
    }
}

# Create .htpasswd file
# htpasswd -c /etc/nginx/.htpasswd username
```

### Security Headers

```nginx
# /etc/nginx/snippets/security-headers.conf

# XSS Protection
add_header X-XSS-Protection "1; mode=block" always;

# Prevent clickjacking
add_header X-Frame-Options "SAMEORIGIN" always;

# Prevent MIME sniffing
add_header X-Content-Type-Options "nosniff" always;

# Referrer Policy
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Content Security Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;

# Permissions Policy
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

# HSTS (only for HTTPS)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

### DDoS Protection

```nginx
http {
    # Connection limits
    limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
    limit_req_zone $binary_remote_addr zone=req_limit_per_ip:10m rate=5r/s;

    # Slow connection protection
    client_body_timeout 10s;
    client_header_timeout 10s;
    keepalive_timeout 5s 5s;
    send_timeout 10s;

    # Buffer size limits
    client_body_buffer_size 1k;
    client_header_buffer_size 1k;
    client_max_body_size 1m;
    large_client_header_buffers 2 1k;

    server {
        listen 80;
        server_name example.com;

        # Apply limits
        limit_conn conn_limit_per_ip 10;
        limit_req zone=req_limit_per_ip burst=10 nodelay;

        # Block common attack patterns
        location ~ /(wp-admin|phpmyadmin|xmlrpc\.php) {
            deny all;
        }

        # Block user agents
        if ($http_user_agent ~* (bot|crawler|spider)) {
            return 403;
        }

        location / {
            proxy_pass http://backend;
        }
    }
}
```

## Performance Tuning

### Worker Process Optimization

```nginx
# /etc/nginx/nginx.conf

# Number of worker processes (usually = CPU cores)
worker_processes auto;

# Maximum open files per worker
worker_rlimit_nofile 65535;

events {
    # Maximum connections per worker
    worker_connections 4096;

    # Use efficient connection processing
    use epoll;  # Linux
    # use kqueue;  # FreeBSD

    # Accept multiple connections
    multi_accept on;
}
```

### Buffer and Timeout Tuning

```nginx
http {
    # Timeouts
    client_body_timeout 12;
    client_header_timeout 12;
    keepalive_timeout 15;
    send_timeout 10;

    # Buffers
    client_body_buffer_size 16k;
    client_header_buffer_size 1k;
    client_max_body_size 8m;
    large_client_header_buffers 4 8k;

    # Output buffers
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;

    # File operations
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_disable "msie6";

    # Keep alive
    keepalive_requests 100;
}
```

### Caching and Static File Optimization

```nginx
http {
    # Open file cache
    open_file_cache max=10000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;

    server {
        listen 80;
        server_name example.com;

        # Enable sendfile
        sendfile on;

        # Static file handling
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
            sendfile on;
            tcp_nopush on;
        }
    }
}
```

## Common Patterns

### Single Page Application (SPA)

```nginx
server {
    listen 80;
    server_name app.example.com;
    root /var/www/app/dist;
    index index.html;

    # Try files, fallback to index.html for client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://api_backend;
        include /etc/nginx/proxy_params;
    }

    # Static assets with aggressive caching
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Docker with Nginx

```nginx
# docker-compose.yml nginx service
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./html:/usr/share/nginx/html:ro
    depends_on:
      - app
    networks:
      - app-network

  app:
    image: node:18
    networks:
      - app-network
```

```nginx
# nginx.conf for Docker
upstream app {
    # Docker service name
    server app:3000;
}

server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Monitoring and Logging

### Custom Log Format

```nginx
http {
    log_format detailed '$remote_addr - $remote_user [$time_local] '
                       '"$request" $status $body_bytes_sent '
                       '"$http_referer" "$http_user_agent" '
                       'rt=$request_time uct="$upstream_connect_time" '
                       'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log detailed;
}
```

### Status Module

```nginx
server {
    listen 8080;
    server_name localhost;

    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
}
```

## Best Practices

1. **Use upstream blocks** for backend servers
2. **Enable HTTP/2** for better performance
3. **Implement caching** where appropriate
4. **Set up proper logging** with rotation
5. **Use SSL/TLS** with modern ciphers
6. **Rate limit** sensitive endpoints
7. **Add security headers**
8. **Monitor performance** regularly
9. **Keep nginx updated**
10. **Test configuration** before reload: `nginx -t`

## Useful Commands

```bash
# Test configuration
nginx -t

# Reload configuration without downtime
nginx -s reload

# Stop nginx
nginx -s stop

# Graceful shutdown
nginx -s quit

# Check version and modules
nginx -V

# View configuration
nginx -T
```

## Summary

Nginx is a powerful, flexible tool for:
- Serving static content
- Reverse proxying to applications
- Load balancing across servers
- SSL/TLS termination
- Caching responses
- Rate limiting and security
- High-performance web serving
