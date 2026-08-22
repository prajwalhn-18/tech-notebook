---
sidebar_position: 4
---

# Load Testing Node.js Services

Load testing ensures your application can handle expected traffic and helps identify performance bottlenecks before they affect users. This guide covers practical load testing strategies using k6, a modern load testing tool designed for developers.

## Why Load Testing Matters

### Real-World Disaster Scenarios

**Scenario 1: The Product Launch**
```
Company launches new product feature
Marketing sends email to 100K users
All click the link simultaneously at 9 AM
Website crashes within 2 minutes
Sales team loses $500K in potential revenue
Engineering team spends weekend firefighting
```

**Scenario 2: The Slow Degradation**
```
API works fine with 100 users
At 1,000 users, response time increases to 2 seconds
At 5,000 users, response time hits 10 seconds
At 10,000 users, database connections exhaust, everything fails
Nobody noticed because growth was gradual
```

**Scenario 3: The Black Friday**
```
E-commerce site handles 10K users normally
Black Friday brings 100K concurrent users
Checkout page times out
Customers can't complete purchases
Competitors get the business
```

**Load testing prevents these disasters by:**
- Identifying breaking points before production
- Finding bottlenecks (database, API, memory leaks)
- Validating infrastructure capacity
- Establishing performance baselines
- Building confidence in your system

## What is k6?

k6 is a modern, developer-friendly load testing tool that:
- Uses JavaScript for test scripts (familiar for Node.js developers)
- Runs from command line (easy to integrate into CI/CD)
- Provides detailed metrics and insights
- Supports various testing scenarios (load, stress, spike tests)
- Can test HTTP, WebSockets, gRPC

**Why k6 over alternatives?**
- **vs JMeter**: Lighter weight, no GUI needed, better for CI/CD
- **vs Artillery**: More detailed metrics, better for complex scenarios
- **vs Apache Bench**: Much more powerful, supports complex workflows
- **vs Locust**: No Python needed, simpler for JavaScript developers

## Installing k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
```bash
choco install k6
```

**Verify installation:**
```bash
k6 version
```

## Your First Load Test

### Simple API Test

**test.js:**
```javascript
import http from 'k6/http';
import { sleep, check } from 'k6';

// Test configuration
export const options = {
  vus: 10,        // 10 virtual users
  duration: '30s', // Run for 30 seconds
};

// Test scenario
export default function () {
  // Make HTTP request
  const response = http.get('http://localhost:3000/api/users');
  
  // Verify response
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  // Wait 1 second between requests
  sleep(1);
}
```

**Run the test:**
```bash
k6 run test.js
```

**What this does:**
- Simulates 10 users making requests simultaneously
- Each user makes a request, waits 1 second, repeats for 30 seconds
- Checks that responses are successful (200) and fast (< 500ms)
- Reports detailed metrics at the end

### Understanding the Output

**Sample k6 output:**
```
     ✓ status is 200
     ✓ response time < 500ms

     checks.........................: 100.00% ✓ 300      ✗ 0   
     data_received..................: 1.5 MB  50 kB/s
     data_sent......................: 30 kB   1.0 kB/s
     http_req_blocked...............: avg=1.2ms    min=500µs   max=15ms    
     http_req_connecting............: avg=800µs    min=300µs   max=10ms    
     http_req_duration..............: avg=250ms    min=100ms   max=450ms   
       { expected_response:true }...: avg=250ms    min=100ms   max=450ms   
     http_req_failed................: 0.00%   ✓ 0        ✗ 300 
     http_req_receiving.............: avg=500µs    min=100µs   max=2ms     
     http_req_sending...............: avg=300µs    min=100µs   max=1ms     
     http_req_tls_handshaking.......: avg=0s       min=0s      max=0s      
     http_req_waiting...............: avg=249ms    min=99ms    max=448ms   
     http_reqs......................: 300     10/s
     iteration_duration.............: avg=1.25s    min=1.1s    max=1.5s    
     iterations.....................: 300     10/s
     vus............................: 10      min=10     max=10
     vus_max........................: 10      min=10     max=10
```

**Key metrics explained:**

**checks**: Did your assertions pass?
- `100%` means all checks passed
- If `< 100%`, some requests failed your criteria

**http_req_duration**: How long requests took
- `avg=250ms`: Average response time (most important metric)
- `min=100ms`: Fastest request
- `max=450ms`: Slowest request
- **Target**: Keep avg < 500ms for good user experience

**http_req_failed**: Request failure rate
- `0.00%`: No failed requests (good!)
- If `> 0%`, investigate errors

**http_reqs**: Total requests made
- `300` requests in 30 seconds = 10 requests/second

**What to look for:**
- ✓ All checks passing (green checkmarks)
- ✓ Low http_req_duration (< 500ms average)
- ✓ Zero http_req_failed
- ✓ Consistent min/max (no huge outliers)

## Different Types of Load Tests

### 1. Smoke Test (Sanity Check)

**Purpose**: Verify system works under minimal load

**When to use**: Before running heavier tests, in CI/CD pipeline

**smoke-test.js:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,          // Just 1 user
  duration: '1m',  // For 1 minute
};

export default function () {
  const response = http.get('http://localhost:3000/api/health');
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'no errors': (r) => !r.body.includes('error'),
  });
  
  sleep(1);
}
```

**Run it:**
```bash
k6 run smoke-test.js
```

**What you're checking:**
- API endpoints respond correctly
- No obvious errors
- Baseline performance metrics

**Real-world usage:**
```bash
# In CI/CD pipeline
npm run build
npm start &
sleep 5  # Wait for server to start
k6 run smoke-test.js
if [ $? -eq 0 ]; then
  echo "Smoke test passed, proceeding with deployment"
else
  echo "Smoke test failed, aborting deployment"
  exit 1
fi
```

### 2. Load Test (Expected Traffic)

**Purpose**: Test system under normal expected load

**When to use**: Regular testing, before major releases

**load-test.js:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users over 2 min
    { duration: '5m', target: 50 },   // Stay at 50 users for 5 min
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete in 500ms
    http_req_failed: ['rate<0.01'],   // Error rate must be below 1%
  },
};

export default function () {
  const response = http.get('http://localhost:3000/api/products');
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'has products': (r) => JSON.parse(r.body).products.length > 0,
  });
  
  sleep(1);
}
```

**What this simulates:**
```
Users over time:
  0 -----> 50 (ramp up: 2 min)
 50 -----> 50 (sustained: 5 min)  ← This is your normal traffic
 50 -----> 0  (ramp down: 2 min)
```

**Interpreting results:**

**Success:**
```
✓ http_req_duration............: avg=250ms p(95)=450ms  ← 95% under 500ms
✓ http_req_failed..............: 0.00%                  ← No errors
```
System handles expected load well!

**Failure:**
```
✗ http_req_duration............: avg=800ms p(95)=1200ms  ← Too slow!
✗ http_req_failed..............: 2.5%                    ← Errors occurring
```
System struggles under normal load. Investigate before production!

### 3. Stress Test (Breaking Point)

**Purpose**: Find the maximum capacity of your system

**When to use**: Capacity planning, understanding limits

**stress-test.js:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp to 100 users
    { duration: '5m', target: 100 },   // Stay at 100
    { duration: '2m', target: 200 },   // Ramp to 200
    { duration: '5m', target: 200 },   // Stay at 200
    { duration: '2m', target: 300 },   // Ramp to 300
    { duration: '5m', target: 300 },   // Stay at 300
    { duration: '2m', target: 0 },     // Ramp down
  ],
};

export default function () {
  const response = http.get('http://localhost:3000/api/products');
  
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
  
  sleep(1);
}
```

**What you're looking for:**

**Watching the metrics:**
```
At 100 users: avg=250ms, 0% errors  ✓ Healthy
At 200 users: avg=500ms, 0% errors  ⚠️  Slowing down
At 300 users: avg=2000ms, 5% errors ✗ System breaking
```

**Breaking point identified: Between 200-300 concurrent users**

**Real-world implications:**
```
Current traffic: 50 concurrent users
Growth rate: 20% per quarter
Breaking point: 250 concurrent users

Timeline:
Q1: 50 users  ✓ Safe
Q2: 60 users  ✓ Safe
Q3: 72 users  ✓ Safe
Q4: 86 users  ✓ Safe
Q5: 103 users ✓ Safe
Q6: 124 users ✓ Safe
Q7: 149 users ✓ Safe
Q8: 179 users ✓ Safe
Q9: 215 users ⚠️  Getting close
Q10: 258 users ✗ Will exceed capacity

Action needed: Scale infrastructure before Q9 (18 months from now)
```

### 4. Spike Test (Sudden Traffic)

**Purpose**: Test system recovery from sudden traffic spikes

**When to use**: Before marketing campaigns, product launches

**spike-test.js:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },    // Normal traffic
    { duration: '1m', target: 200 },    // Sudden spike!
    { duration: '10s', target: 10 },    // Back to normal
  ],
};

export default function () {
  const response = http.get('http://localhost:3000/api/products');
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 2000,
  });
  
  sleep(1);
}
```

**What this simulates:**
```
Marketing sends email to 50K users at 9 AM
All click the link within 1 minute
Traffic spikes from 10 to 200 concurrent users instantly
```

**Good system behavior:**
```
Before spike: avg=200ms, 0% errors
During spike: avg=800ms, 2% errors    ← Degraded but functional
After spike: avg=200ms, 0% errors     ← Recovered quickly
```

**Bad system behavior:**
```
Before spike: avg=200ms, 0% errors
During spike: avg=5000ms, 50% errors  ← Completely broken
After spike: avg=3000ms, 20% errors   ← Didn't recover!
```

### 5. Soak Test (Endurance Test)

**Purpose**: Find memory leaks and degradation over time

**When to use**: Before major releases, after performance fixes

**soak-test.js:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 50 },    // Ramp up
    { duration: '3h', target: 50 },    // Run for 3 hours!
    { duration: '5m', target: 0 },     // Ramp down
  ],
};

export default function () {
  const response = http.get('http://localhost:3000/api/products');
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}
```

**What you're looking for:**

**Healthy system:**
```
After 30 min: avg=250ms, 0% errors
After 1 hour: avg=250ms, 0% errors
After 2 hours: avg=250ms, 0% errors
After 3 hours: avg=250ms, 0% errors ✓ Stable!
```

**Memory leak:**
```
After 30 min: avg=250ms, 0% errors
After 1 hour: avg=400ms, 0% errors    ⚠️  Slowing down
After 2 hours: avg=1000ms, 2% errors  ⚠️  Getting worse
After 3 hours: avg=5000ms, 20% errors ✗ Memory leak!
```

**Monitor during soak test:**
```bash
# Monitor Node.js memory usage
watch -n 5 'curl http://localhost:3000/metrics | grep process_resident_memory_bytes'

# If memory keeps growing, you have a leak!
```

## Real-World Testing Scenarios

### Testing a REST API with Authentication

**api-with-auth-test.js:**
```javascript
import http from 'k6/http';
import { check, group, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 20 },
    { duration: '1m', target: 0 },
  ],
};

export default function () {
  const BASE_URL = 'http://localhost:3000';
  
  // Step 1: Login
  let loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'got token': (r) => JSON.parse(r.body).token !== undefined,
  });
  
  const token = JSON.parse(loginRes.body).token;
  
  // Step 2: Get user profile
  let profileRes = http.get(`${BASE_URL}/api/user/profile`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  
  check(profileRes, {
    'profile retrieved': (r) => r.status === 200,
  });
  
  // Step 3: Update profile
  let updateRes = http.put(`${BASE_URL}/api/user/profile`, JSON.stringify({
    name: 'Updated Name',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  
  check(updateRes, {
    'profile updated': (r) => r.status === 200,
  });
  
  sleep(1);
}
```

**What this tests:**
- Complete user workflow (login → read → write)
- Authentication token handling
- Multiple API endpoints in sequence

### Testing a Shopping Cart Flow

**ecommerce-flow-test.js:**
```javascript
import http from 'k6/http';
import { check, group, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    'http_req_duration{page:products}': ['p(95)<500'],
    'http_req_duration{page:cart}': ['p(95)<300'],
    'http_req_duration{page:checkout}': ['p(95)<1000'],
  },
};

export default function () {
  const BASE_URL = 'http://localhost:3000';
  
  group('Browse Products', function () {
    let res = http.get(`${BASE_URL}/api/products`, {
      tags: { page: 'products' },
    });
    check(res, { 'products loaded': (r) => r.status === 200 });
    sleep(2); // User spends 2 seconds browsing
  });
  
  group('Add to Cart', function () {
    let res = http.post(`${BASE_URL}/api/cart`, JSON.stringify({
      productId: 'prod-123',
      quantity: 2,
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { page: 'cart' },
    });
    check(res, { 'added to cart': (r) => r.status === 200 });
    sleep(1);
  });
  
  group('View Cart', function () {
    let res = http.get(`${BASE_URL}/api/cart`, {
      tags: { page: 'cart' },
    });
    check(res, { 'cart loaded': (r) => r.status === 200 });
    sleep(3); // User reviews cart
  });
  
  group('Checkout', function () {
    let res = http.post(`${BASE_URL}/api/checkout`, JSON.stringify({
      paymentMethod: 'credit_card',
      shippingAddress: '123 Main St',
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { page: 'checkout' },
    });
    check(res, { 'checkout successful': (r) => r.status === 200 });
  });
  
  sleep(10); // Delay before next iteration
}
```

**Why use groups and tags:**
- Groups organize related requests
- Tags let you set different thresholds per page
- Reports show performance per user flow step

**Output will show:**
```
✓ http_req_duration{page:products}......: avg=350ms p(95)=450ms
✓ http_req_duration{page:cart}..........: avg=200ms p(95)=280ms
✓ http_req_duration{page:checkout}......: avg=800ms p(95)=950ms
```

Now you know checkout is slower (expected, more processing) but still within threshold.

## Advanced Patterns

### Using Test Data

**test-with-data.js:**
```javascript
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';

// Load test data (only loaded once, shared across VUs)
const users = new SharedArray('users', function () {
  return [
    { email: 'user1@example.com', password: 'pass1' },
    { email: 'user2@example.com', password: 'pass2' },
    { email: 'user3@example.com', password: 'pass3' },
    // ... more users
  ];
});

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  // Each VU picks a different user
  const user = users[__VU % users.length];
  
  const res = http.post('http://localhost:3000/api/login', JSON.stringify(user), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(res, {
    'login successful': (r) => r.status === 200,
  });
}
```

**Loading data from CSV:**
```javascript
import { SharedArray } from 'k6/data';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';

const csvData = new SharedArray('users', function () {
  return papaparse.parse(open('./users.csv'), { header: true }).data;
});

export default function () {
  const user = csvData[__VU % csvData.length];
  // Use user.email, user.password, etc.
}
```

### Custom Metrics

**custom-metrics.js:**
```javascript
import http from 'k6/http';
import { Trend, Counter } from 'k6/metrics';

// Custom metrics
const checkoutDuration = new Trend('checkout_duration');
const checkoutErrors = new Counter('checkout_errors');

export const options = {
  vus: 10,
  duration: '1m',
};

export default function () {
  const startTime = Date.now();
  
  const res = http.post('http://localhost:3000/api/checkout', /* ... */);
  
  const duration = Date.now() - startTime;
  checkoutDuration.add(duration);
  
  if (res.status !== 200) {
    checkoutErrors.add(1);
  }
}
```

**Output will include:**
```
checkout_duration..............: avg=850ms min=500ms max=2000ms p(95)=1200ms
checkout_errors................: 5
```

### Testing WebSocket Connections

**websocket-test.js:**
```javascript
import ws from 'k6/ws';
import { check } from 'k6';

export const options = {
  vus: 50,
  duration: '1m',
};

export default function () {
  const url = 'ws://localhost:3000/ws';
  
  const res = ws.connect(url, function (socket) {
    socket.on('open', function () {
      console.log('connected');
      socket.send(JSON.stringify({ type: 'subscribe', channel: 'updates' }));
    });
    
    socket.on('message', function (data) {
      console.log('received:', data);
    });
    
    socket.on('close', function () {
      console.log('disconnected');
    });
    
    socket.setTimeout(function () {
      socket.close();
    }, 10000); // Close after 10 seconds
  });
  
  check(res, { 'status is 101': (r) => r && r.status === 101 });
}
```

## Interpreting Results and Taking Action

### Reading the Metrics

**Key metrics to watch:**

**1. http_req_duration** (Response Time)
```
avg=250ms    ← Average (most important)
min=100ms    ← Best case
max=2000ms   ← Worst case (check for outliers!)
p(90)=400ms  ← 90th percentile
p(95)=500ms  ← 95th percentile (commonly used SLA)
p(99)=800ms  ← 99th percentile (catches outliers)
```

**What to look for:**
- Keep avg < 500ms for good user experience
- p(95) < 1000ms is acceptable for most apps
- Large gap between avg and p(95) suggests inconsistency

**2. http_req_failed** (Error Rate)
```
0.00%  ← Perfect!
0.5%   ← Acceptable for some apps
5%     ← Too high, investigate
```

**3. http_reqs** (Throughput)
```
http_reqs: 1200  40/s
```
Your system handled 40 requests per second.

**4. iterations** (Completed Workflows)
```
iterations: 300
```
300 users completed the full test scenario.

### Common Problems and Solutions

**Problem 1: Response Time Degradation**

**Symptoms:**
```
At 10 users:  avg=200ms
At 50 users:  avg=500ms
At 100 users: avg=2000ms
```

**Possible causes:**
1. **Database not scaling**: Add indexes, connection pooling, read replicas
2. **No caching**: Add Redis/Memcached
3. **Synchronous operations**: Use async/await properly
4. **CPU-bound operations**: Offload to background workers

**Investigation:**
```bash
# Check database slow queries
# Check Node.js event loop delay
# Profile with Chrome DevTools or clinic.js
```

**Problem 2: Memory Leak**

**Symptoms:**
```
Start: avg=200ms, memory=100MB
1 hour: avg=300ms, memory=500MB
2 hours: avg=600ms, memory=1.2GB
3 hours: CRASH (out of memory)
```

**Possible causes:**
1. **Global arrays/objects growing**: Clear old data
2. **Event listeners not removed**: Use `removeListener`
3. **Closures holding references**: Check circular references
4. **Caching without TTL**: Add expiration to cached data

**Investigation:**
```bash
# Take heap snapshots at intervals
node --inspect index.js
# Use Chrome DevTools Memory profiler
```

**Problem 3: Database Connection Exhaustion**

**Symptoms:**
```
At 10 users:  0% errors
At 50 users:  0% errors
At 100 users: 30% errors: "too many connections"
```

**Solution:**
```javascript
// Bad: No connection pooling
const db = mysql.createConnection(config);

// Good: Connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'mydb',
  connectionLimit: 100, // Max connections
  queueLimit: 0,        // Unlimited queue
});
```

**Problem 4: API Rate Limiting**

**Symptoms:**
```
At 50 users: 0% errors
At 100 users: 20% errors: "429 Too Many Requests"
```

**This is actually good!** Rate limiting is protecting your system.

**Options:**
1. Increase rate limits (if your system can handle it)
2. Implement backoff and retry in clients
3. Scale infrastructure to handle more requests

## Integration with CI/CD

### GitHub Actions Example

**.github/workflows/load-test.yml:**
```yaml
name: Load Test

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Run daily at 2 AM

jobs:
  load-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Install k6
        run: |
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start server
        run: |
          npm start &
          sleep 10  # Wait for server to start
      
      - name: Run smoke test
        run: k6 run tests/smoke-test.js
      
      - name: Run load test
        run: k6 run tests/load-test.js
      
      - name: Check thresholds
        run: |
          if [ $? -ne 0 ]; then
            echo "Load test failed! Check metrics."
            exit 1
          fi
```

### Fail Build on Performance Regression

**load-test-with-thresholds.js:**
```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],        // 95% under 500ms
    http_req_failed: ['rate<0.01'],          // <1% errors
    'http_req_duration{page:checkout}': ['p(95)<1000'], // Checkout can be slower
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/products');
  check(res, { 'status is 200': (r) => r.status === 200 });
}
```

**If thresholds fail, k6 exits with non-zero code, failing your CI/CD pipeline.**

## Best Practices

### 1. Start Small
```
Week 1: Smoke test (1 user)
Week 2: Small load test (10 users)
Week 3: Normal load test (50 users)
Week 4: Stress test (find breaking point)
```
Don't jump straight to stress testing—build up gradually.

### 2. Test in Staging First
Never run load tests against production without explicit approval.

### 3. Realistic User Behavior
```javascript
// Bad: Unrealistic
export default function () {
  http.get('/api/products');
  // Immediately repeat, no think time
}

// Good: Realistic
export default function () {
  http.get('/api/products');
  sleep(Math.random() * 3 + 2); // 2-5 seconds think time
  
  http.get('/api/product/123');
  sleep(Math.random() * 2 + 1); // 1-3 seconds
  
  http.post('/api/cart', /* ... */);
  sleep(Math.random() * 5 + 3); // 3-8 seconds before checkout
}
```

### 4. Monitor Your System During Tests
Don't just watch k6 output—monitor your system:
```bash
# CPU and memory
htop

# Database connections
watch -n 1 'mysql -e "SHOW PROCESSLIST"'

# Node.js metrics
curl http://localhost:3000/metrics

# Application logs
tail -f /var/log/app.log
```

### 5. Run Tests Regularly
- Smoke test: Every deployment
- Load test: Weekly or before major releases
- Stress test: Monthly or before traffic spikes
- Soak test: Before major releases

### 6. Document Baselines
```
Current Performance Baseline (as of 2024-01-15):
- 50 concurrent users
- Avg response time: 250ms
- p(95) response time: 450ms
- 0% error rate
- Throughput: 40 req/sec
- Infrastructure: 2x 4-core servers, 8GB RAM, PostgreSQL 14

Next review: 2024-04-15
```

Track changes over time to detect regressions.

## Summary

Load testing with k6 helps you:

- **Prevent disasters**: Find problems before users do
- **Understand capacity**: Know your limits and plan growth
- **Validate performance**: Ensure SLAs are met
- **Build confidence**: Deploy with knowledge your system can handle traffic

**Getting started checklist:**
1. ✓ Install k6
2. ✓ Write a simple smoke test
3. ✓ Run it against your API
4. ✓ Gradually increase load
5. ✓ Find your breaking point
6. ✓ Fix bottlenecks
7. ✓ Integrate into CI/CD
8. ✓ Run regularly

**Remember:** The best time to find performance problems is before your users do!
