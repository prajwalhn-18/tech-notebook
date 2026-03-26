---
sidebar_position: 1
---

## Node.js Internals for High-Performance Applications

A practical guide to the internals that directly affect how fast, how scalable, and how memory-efficient your Node.js applications are. Each section explains the mechanism, the relevant source code, and the engineering decisions that follow from it.

---

### Table of Contents

1. [The Event Loop — The Foundation of Everything](#1-the-event-loop--the-foundation-of-everything)
2. [Task Queue Ordering — nextTick, Microtasks, setImmediate](#2-task-queue-ordering--nexttick-microtasks-setimmediate)
3. [V8 Engine — How Your Code Gets Optimized](#3-v8-engine--how-your-code-gets-optimized)
4. [Memory & Buffer Management](#4-memory--buffer-management)
5. [Streams & Backpressure](#5-streams--backpressure)
6. [The libuv Thread Pool](#6-the-libuv-thread-pool)
7. [Cluster & Worker Threads](#7-cluster--worker-threads)
8. [HTTP and HTTP/2 Internals](#8-http-and-http2-internals)
9. [DNS Resolution Internals](#9-dns-resolution-internals)
10. [Module Loading & the require() Cache](#10-module-loading--the-require-cache)
11. [Heap & GC Observability](#11-heap--gc-observability)
12. [Performance Measurement with perf_hooks](#12-performance-measurement-with-perf_hooks)
13. [Mental Model: What Blocks the Event Loop](#13-mental-model-what-blocks-the-event-loop)

---

## 1. The Event Loop — The Foundation of Everything

### How It Works

The event loop is driven by **libuv** and entered from `src/api/embed_helpers.cc:42`:

```cpp
uv_run(env->event_loop(), UV_RUN_DEFAULT);
```

Each iteration processes these phases in strict order:

```
┌─────────────────────────────────┐
│           timers                │  setTimeout / setInterval
├─────────────────────────────────┤
│       pending callbacks         │  deferred I/O from prior tick
├─────────────────────────────────┤
│      idle / prepare             │  internal use only
├─────────────────────────────────┤
│            poll                 │  retrieve new I/O events (blocks here if idle)
├─────────────────────────────────┤
│            check                │  setImmediate callbacks
├─────────────────────────────────┤
│        close callbacks          │  socket.on('close'), etc.
└─────────────────────────────────┘
```

Between **every phase**, Node.js flushes:
1. `process.nextTick` queue (all of it)
2. Promise microtask queue (all of it)

### What This Means for You

- **CPU work on the main thread blocks everything.** While your synchronous code runs, no I/O is processed, no timers fire, no requests are served. This is the single most important fact about Node.js performance.
- **The poll phase is where Node.js spends most of its idle time.** If there is nothing to do, libuv blocks here waiting for I/O. The moment a socket gets data or a timer expires, it wakes up.
- **Timer precision is not guaranteed.** A `setTimeout(fn, 100)` fires at *approximately* 100ms — it is queued during the timers phase, after the poll phase completes. If the previous phase took long, it fires late.

---

## 2. Task Queue Ordering — nextTick, Microtasks, setImmediate

### The Queues, in Execution Order

`lib/internal/process/task_queues.js` implements this. The full order within one event loop tick:

```
1. process.nextTick()       ← highest priority, runs ALL queued ticks
2. Promise microtasks       ← queueMicrotask(), Promise.then()
3. [next libuv phase]
4. setImmediate()           ← after the poll phase completes
```

### The nextTick Optimization

`lib/internal/process/task_queues.js:119-127` — the tick callback path has an argument-count optimization:

```js
// For 1-4 args, avoid building an array (common case optimization)
switch (args.length) {
  case 0: nextTickQueue.push({ callback, thisArg }); break;
  case 1: nextTickQueue.push({ callback, thisArg, args: [args[0]] }); break;
  // ...
}
```

### The queueMicrotask Fast Path

`lib/internal/process/task_queues.js:159-174` — if `AsyncLocalStorage` is not active, `queueMicrotask` goes directly to V8 with no wrapper:

```js
function queueMicrotask(callback) {
  if (asyncContextFrame.enabled) {
    // Slow path: wrap to propagate AsyncLocalStorage context
    enqueueMicrotask(new AsyncResource('queueMicrotask').bind(callback));
  } else {
    // Fast path: direct V8 microtask, zero overhead
    enqueueMicrotask(callback);
  }
}
```

### Engineering Rules

| Need | Use | Why |
|---|---|---|
| Defer work to run before any I/O | `process.nextTick` | Runs before poll phase |
| Defer work until after I/O | `setImmediate` | Runs in check phase, after poll |
| Yield inside a hot loop | `setImmediate` | Lets I/O callbacks run between iterations |
| Queue a Promise-like callback | `queueMicrotask` | Consistent with Promise scheduling |
| **Never** | Recursive `nextTick` in a tight loop | Starves I/O — the loop never reaches poll |

---

## 3. V8 Engine — How Your Code Gets Optimized

### The Compilation Pipeline

V8 compiles JavaScript in stages:

```
Source → Parser → AST → Ignition (bytecode) → Execution
                              ↓ (if hot)
                         Maglev (mid-tier JIT)
                              ↓ (if very hot)
                         TurboFan (optimizing JIT)
```

Functions start in **Ignition** (fast to compile, slower to execute). Hot functions are promoted to **Maglev**, then to **TurboFan** which produces highly optimized machine code.

### Hidden Classes (Shapes)

V8 assigns a "hidden class" (also called a Shape or Map) to every object based on its property layout. When all objects have the same shape, V8 can optimize property access to a single memory offset lookup.

**Monomorphic** (best):
```js
// All instances have the same shape — V8 generates optimal code
class Point { constructor(x, y) { this.x = x; this.y = y; } }
const points = [new Point(1, 2), new Point(3, 4)];
```

**Polymorphic** (worse — 2-4 shapes, V8 checks each):
```js
function process(obj) { return obj.value; }
process({ value: 1 });          // shape A
process({ value: 1, extra: 2 }); // shape B — different!
```

**Megamorphic** (worst — 5+ shapes, V8 gives up optimizing):
```js
// Avoid passing objects of wildly different shapes to the same function
```

### Deoptimization Triggers to Avoid

V8 will "bail out" of optimized code back to bytecode if:

- A function is called with arguments of different types than it was optimized for
- An object's shape changes after optimization (adding properties after construction)
- `arguments` object is used in complex ways
- `try/catch` around a hot loop (TurboFan can't optimize through it in some cases)
- Accessing properties on `null`/`undefined` unexpectedly

### Engineering Rules

- **Always initialize object properties in the constructor**, in the same order, with the same types. Never add properties after the fact.
- **Keep functions monomorphic** — avoid calling the same function with objects of different shapes on the hot path.
- **Avoid `delete obj.prop`** — it changes the object's shape, causing deoptimization.
- **Measure with `--prof`** to get a V8 CPU profile. Use `node --prof app.js` then `node --prof-process isolate-*.log`.

---

## 4. Memory & Buffer Management

### The Buffer Pool

`lib/buffer.js:173-183` — Node.js maintains a global 8KB pre-allocated pool for small `Buffer` allocations:

```js
Buffer.poolSize = 8 * 1024; // 8KB pool
// Allocations under 4KB (poolSize / 2) come from this pool
```

How it works:
1. A single 8KB `ArrayBuffer` is allocated up-front.
2. Small allocations carve a slice from it, advancing `poolOffset`.
3. When the pool is exhausted, a new 8KB pool is allocated.
4. Allocations ≥ 4KB bypass the pool entirely and get their own `ArrayBuffer`.

Pool alignment (`poolOffset & 0x7`) ensures 8-byte alignment for all allocations.

### Buffer.alloc vs Buffer.allocUnsafe

| Method | Zeroed | Pool | Use when |
|---|---|---|---|
| `Buffer.alloc(n)` | Yes | No | Sending to untrusted parties |
| `Buffer.allocUnsafe(n)` | No | Yes (if <4KB) | Performance-critical, you fill it immediately |
| `Buffer.allocUnsafeSlow(n)` | No | No | Large buffers you fill yourself |
| `Buffer.from(string)` | N/A | Yes (if small) | Converting strings |

**`allocUnsafe` contains old memory contents.** Never send an `allocUnsafe` buffer over the network without filling every byte first.

### Engineering Rules

- **Reuse buffers** where possible rather than allocating new ones on each request. Pre-allocate and slice.
- **Avoid many small Buffer allocations in a loop.** They burn through pool slices and trigger frequent GC.
- **Use `Buffer.allocUnsafe` for fixed-size protocol frames** you immediately fill.
- **Track `external_memory`** in heap stats — Buffer memory lives outside the V8 heap and won't show up in the normal heap size.

---

## 5. Streams & Backpressure

### highWaterMark and Backpressure

`lib/internal/streams/state.js:12-13` — default high water marks:

```js
// Bytes mode: 64KB on most platforms, 16KB on Windows
// Object mode: 16 objects
```

This is the threshold at which a writable stream signals "I'm full, stop sending":

```
Producer  →  writable.write(chunk)  →  returns false when buffer > hwm
                                         ↑
                                   backpressure signal!
                                   producer must pause and wait for 'drain'
```

`lib/internal/streams/readable.js:545-550` — the check:

```js
function canPushMore(state) {
  return state.length < state.highWaterMark || state.length === 0;
}
```

### What Happens If You Ignore Backpressure

If a producer ignores the `false` return from `write()` and keeps writing:
1. The writable's internal buffer grows without bound.
2. Memory usage climbs until OOM or the process crashes.
3. This is the most common source of memory leaks in Node.js streaming applications.

### The Correct Pattern

```js
// Wrong — ignores backpressure
readable.on('data', (chunk) => {
  writable.write(chunk); // may return false — ignored!
});

// Right — use pipeline (handles backpressure automatically)
const { pipeline } = require('stream');
pipeline(readable, transform, writable, (err) => { ... });
```

### Stream State Uses Bit Fields

`lib/internal/streams/readable.js:111-128` — stream state is stored as bitflags for memory efficiency:

```js
// Each state flag is a single bit in an integer, not a separate boolean property
// kEnded, kEndEmitted, kReading, kSync, kNeedReadable, kEmittedReadable...
```

This means a stream's full state fits in a single integer rather than a dozen separate object properties — fewer allocations, better cache behavior.

### Corking for Batched Writes

```js
// Without corking: 3 separate write syscalls
writable.write('a');
writable.write('b');
writable.write('c');

// With corking: buffered until uncork(), merged into 1 syscall
writable.cork();
writable.write('a');
writable.write('b');
writable.write('c');
writable.uncork(); // flushes all at once
```

### Engineering Rules

- **Always use `pipeline()`** for connecting streams — it handles backpressure, cleanup, and errors automatically.
- **Tune `highWaterMark`** for your workload: larger = fewer syscalls but more buffering; smaller = tighter memory control.
- **Use `objectMode` carefully** — it disables byte-based backpressure and uses a simple item count (default 16) instead.
- **Cork writes** when building up a response from many small pieces.
- **Never buffer an entire file into memory** before streaming it — use `fs.createReadStream()` → `pipeline()` → response.

---

## 6. The libuv Thread Pool

### What Uses the Thread Pool

The default thread pool size is **4 threads**. It is used for:

| Operation | Runs in Thread Pool |
|---|---|
| `fs.*` async (read, write, stat, etc.) | Yes |
| `dns.lookup()` | Yes (via `getaddrinfo`) |
| `zlib` compression | Yes |
| `crypto` (some operations) | Yes |
| `dns.resolve*()` | No (uses c-ares, own async) |
| TCP/UDP/pipes | No (kernel async I/O) |
| HTTP | No (kernel async I/O) |

### The Thread Pool Bottleneck

With only 4 threads, 5 concurrent `fs.readFile()` calls means the 5th waits for a thread to free up. This is a common source of unexplained latency in I/O-heavy services.

```
UV_THREADPOOL_SIZE=4 (default)

Request 1: fs.stat() → thread 1 → completes
Request 2: fs.stat() → thread 2 → completes
Request 3: fs.stat() → thread 3 → completes
Request 4: fs.stat() → thread 4 → completes
Request 5: fs.stat() → WAITING for a free thread ← latency spike
```

### Engineering Rules

- **Set `UV_THREADPOOL_SIZE` based on your workload** — must be set before Node.js starts (environment variable, not in code).
  - I/O heavy (many concurrent file reads): try `8`–`16`
  - CPU-heavy crypto or compression: try matching CPU core count
  - General rule: `UV_THREADPOOL_SIZE = numberOfCPUs * 2`
- **Prefer `dns.resolve()` over `dns.lookup()`** in high-throughput services — `resolve` uses its own async mechanism and does not consume thread pool slots.
- **Avoid blocking the thread pool with CPU work.** The thread pool is not for CPU computation — it exists to bridge blocking OS APIs into async. Put CPU work in Worker Threads instead.

---

## 7. Cluster & Worker Threads

### Cluster — Multi-Process CPU Utilization

`lib/cluster.js` and `lib/internal/cluster/` implement this. The primary process listens on ports and distributes connections to worker processes.

**Two scheduling strategies** (`lib/internal/cluster/`):

| Strategy | Implementation | Default |
|---|---|---|
| `SCHED_RR` (Round-Robin) | Primary distributes connections | Linux/macOS |
| `SCHED_NONE` | OS kernel distributes | Windows |

Round-robin ensures even distribution but adds a hop (connection passes through primary). Kernel scheduling has lower overhead but can be uneven.

Use `cluster.schedulingPolicy = cluster.SCHED_RR` to force round-robin.

**When to use Cluster:**
- Your workload is I/O bound (HTTP server, API gateway)
- You want multiple event loops, each on a separate OS process
- You need process isolation (crash in one worker doesn't kill others)

### Worker Threads — In-Process Parallelism

`lib/worker_threads.js` — each Worker gets its own V8 isolate and event loop, running in the same OS process.

**Communication methods:**

```
Worker Thread ←→ Main Thread via MessageChannel
  - postMessage(data)        ← copies data (structured clone)
  - postMessage(buf, [buf])  ← transfers ArrayBuffer (zero-copy, original becomes unusable)
  - SharedArrayBuffer        ← true shared memory (use Atomics for synchronization)
```

**Transferring vs Copying:**

```js
// Slow: copies the entire buffer
worker.postMessage({ data: largeBuffer });

// Fast: transfers ownership (zero-copy)
worker.postMessage({ data: largeBuffer }, [largeBuffer.buffer]);
// largeBuffer is now detached and unusable in the sender
```

**When to use Worker Threads:**
- CPU-intensive work: JSON parsing of huge payloads, image processing, compression, ML inference
- You need shared memory (`SharedArrayBuffer` + `Atomics`)
- You want parallelism within a single process (shared module cache, lower startup time than cluster)

**When NOT to use Worker Threads:**
- For short-lived tasks — thread creation overhead (~2ms + memory) outweighs the gain
- As a replacement for async I/O — I/O is already non-blocking on the main thread

### Engineering Rules

- **Cluster for I/O parallelism** (web servers): `os.cpus().length` workers is the starting point.
- **Worker Threads for CPU parallelism**: keep a thread pool (e.g. `piscina` library) rather than creating workers per request.
- **Transfer, don't copy** large `ArrayBuffer`s between threads.
- **Use `SharedArrayBuffer` + `Atomics`** for high-frequency communication between threads (avoids message serialization entirely).

---

## 8. HTTP and HTTP/2 Internals

### HTTP/1.1 — Keep-Alive and Connection Reuse

`lib/_http_server.js:216` — `shouldKeepAlive` controls whether the TCP connection is reused after a response. Without it, every request pays a TCP handshake cost.

On the **client** side, use an `Agent` with `keepAlive: true`:

```js
const http = require('http');
const agent = new http.Agent({ keepAlive: true, maxSockets: 50 });
http.get({ hostname: 'api.example.com', agent }, ...);
```

Without `keepAlive`, the default `Agent` destroys sockets after each response.

### Headers Use Null-Prototype Objects

`lib/_http_server.js:253` and a recent commit (`ef5929b`) — incoming headers are stored on a `null`-prototype object:

```js
// Null prototype prevents prototype chain lookups
const headers = Object.create(null);
```

This is a performance optimization: property lookups on a plain `{}` fall through to `Object.prototype` if the key isn't found. A null-prototype object skips this chain, making header access slightly faster — and prevents header names like `constructor` or `__proto__` from colliding with inherited properties.

### HTTP/2 — Multiplexing and Flow Control

`lib/internal/http2/core.js` — HTTP/2 runs multiple request/response streams over a **single TCP connection** using binary frames.

Key performance properties:
- **HPACK header compression** — repeated headers (e.g. `content-type`) are sent as 1-byte indices after the first occurrence
- **Server push** — send resources before the client requests them
- **Stream-level flow control** — each stream has its own `initialWindowSize`; adjust it for large uploads/downloads
- **Multiplexing** — eliminates head-of-line blocking present in HTTP/1.1 pipelining

### Engineering Rules

- **Always use `keepAlive: true`** for outbound HTTP connections in production.
- **Set `maxSockets`** on your Agent — default is `Infinity`, which can open thousands of connections to one host.
- **Use HTTP/2 for browser-facing APIs** — multiplexing eliminates the need for HTTP/1.1 performance hacks (domain sharding, request bundling).
- **Watch for per-stream buffering memory in HTTP/2** — many concurrent streams each hold their own buffers.

---

## 9. DNS Resolution Internals

### Two Different DNS APIs

`lib/dns.js:142-200`:

| API | Mechanism | Thread Pool | Cache |
|---|---|---|---|
| `dns.lookup()` | `getaddrinfo` (OS resolver) | **Yes** — uses thread pool | OS-dependent |
| `dns.resolve()` | c-ares (async DNS library) | No | No built-in cache |

`dns.lookup()` respects `/etc/hosts`, local DNS configuration, and any OS-level caching. But it blocks a thread pool slot — 4 concurrent lookups can saturate the default pool.

`dns.resolve()` goes directly to the DNS server over the network, asynchronously, without consuming a thread pool slot.

### Engineering Rules

- **Use `dns.resolve()` in high-throughput services** that perform frequent lookups.
- **Implement your own DNS cache** for `dns.resolve()` results — it has no caching built in. Cache TTL from the DNS response.
- **Increase `UV_THREADPOOL_SIZE`** if you must use `dns.lookup()` with high concurrency.
- **Avoid DNS lookups in hot paths entirely** — resolve hostnames at startup and cache the IPs.

---

## 10. Module Loading & the require() Cache

### Two-Level Cache

`lib/internal/modules/cjs/loader.js:1240-1260` — `require()` uses two caches:

```
1. relativeResolveCache  →  maps (parentPath + request) → absoluteFilename
                              fast lookup, avoids re-resolving relative paths

2. Module._cache          →  maps absoluteFilename → loaded Module object
                              avoids re-parsing and re-compiling
```

The cache key for `relativeResolveCache` is `${parent.path}\x00${request}` — a null byte separator prevents collisions.

### What Happens on First require()

1. Resolve relative path → absolute filename (disk I/O, traverses `node_modules`)
2. Read file from disk
3. Wrap in module wrapper function
4. Compile with V8
5. Execute
6. Cache the result

Subsequent `require()` calls return the cached `module.exports` object — no disk I/O, no compilation.

### Startup Performance

In large applications, hundreds of `require()` calls at startup can add significant startup time due to file I/O and V8 compilation. Strategies:

- **Lazy-load infrequently used modules** — defer `require()` until first use.
- **Use `--require` sparingly** — every `--require` adds to startup time.
- **ESM with static `import`** allows V8 to analyze the dependency graph and optimize loading order.

### Engineering Rules

- **Never delete from `Module._cache` in production** unless you're building a hot-reload dev tool — it breaks singleton assumptions.
- **Keep `node_modules` flat** — deep nesting forces the resolver to traverse many directories.
- **Profile startup** with `--trace-requires` (or `node --loader` tracing) to identify slow module initialization.

---

## 11. Heap & GC Observability

### V8 Heap Spaces

V8 divides memory into spaces with different GC characteristics:

| Space | GC Type | Speed | Object Lifetime |
|---|---|---|---|
| **New space** (Young gen) | Scavenge (minor GC) | Very fast | Short-lived objects |
| **Old space** (Old gen) | Mark-sweep-compact | Slower | Long-lived objects |
| **Large object space** | Full GC | Slowest | Objects > ~512KB |
| **Code space** | N/A | N/A | JIT-compiled code |

Objects start in new space. After surviving two minor GCs, they are **promoted** to old space. Old space grows until a full (major) GC is triggered — this causes a **GC pause** visible to users.

### Heap Statistics

`lib/v8.js:230-250`:

```js
const v8 = require('v8');
const stats = v8.getHeapStatistics();
// Key fields:
stats.used_heap_size        // currently in use
stats.heap_size_limit       // max before OOM
stats.external_memory       // Buffer memory (outside V8 heap!)
stats.total_available_size  // free before limit
```

**`external_memory` is critical for Buffer-heavy applications** — it tracks memory held by `Buffer` objects, which live outside the V8 heap and don't appear in `used_heap_size`.

### Heap Snapshots

```js
const v8 = require('v8');
v8.writeHeapSnapshot(); // blocks event loop, writes to file
// or
const stream = v8.getHeapSnapshot(); // streaming, non-blocking
stream.pipe(fs.createWriteStream('heap.heapsnapshot'));
```

Load the `.heapsnapshot` file in Chrome DevTools → Memory tab to find leaks.

### PerformanceObserver for GC Events

```js
const { PerformanceObserver } = require('perf_hooks');
const obs = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`GC kind: ${entry.detail.kind}, duration: ${entry.duration}ms`);
  }
});
obs.observe({ type: 'gc' });
```

GC entry kinds: `perf_gc_young` (minor), `perf_gc_full` (major), `perf_gc_incremental`.

### Engineering Rules

- **Watch `used_heap_size` and `external_memory` together** — Buffer leaks only appear in external.
- **Alert on `heap_size_limit - used_heap_size < 20%`** — you're approaching OOM territory.
- **Long GC pauses (`perf_gc_full` > 100ms)** mean too many long-lived objects. Identify with a heap snapshot.
- **Avoid large object allocations on the hot path** — anything > ~512KB goes to large object space and triggers expensive GC.
- **Set `--max-old-space-size`** explicitly in production instead of letting V8 choose — prevents surprise OOM when the OS limit is lower than V8's default.

---

## 12. Performance Measurement with perf_hooks

### What You Can Measure

`lib/perf_hooks.js:34-47` exports:

```js
const {
  performance,
  PerformanceObserver,
  monitorEventLoopDelay,
  eventLoopUtilization,
} = require('perf_hooks');
```

### Event Loop Delay

The most important production metric for a Node.js service:

```js
const { monitorEventLoopDelay } = require('perf_hooks');
const histogram = monitorEventLoopDelay({ resolution: 10 }); // 10ms sampling
histogram.enable();

setInterval(() => {
  console.log('p50:', histogram.percentile(50) / 1e6, 'ms');
  console.log('p99:', histogram.percentile(99) / 1e6, 'ms');
  histogram.reset();
}, 5000);
```

If p99 event loop delay > 100ms, something is blocking the event loop.

### Event Loop Utilization

```js
const { eventLoopUtilization } = require('perf_hooks');
const elu = eventLoopUtilization();

setTimeout(() => {
  const result = eventLoopUtilization(elu);
  console.log('active:', result.active, 'ms');
  console.log('idle:', result.idle, 'ms');
  console.log('utilization:', result.utilization); // 0.0 to 1.0
}, 1000);
```

`utilization` near `1.0` means the event loop is always busy — no time to accept new connections.

### Custom Timing

```js
performance.mark('db-start');
await db.query(sql);
performance.mark('db-end');
performance.measure('db-query', 'db-start', 'db-end');

const [entry] = performance.getEntriesByName('db-query');
console.log(entry.duration, 'ms');
```

### Observing DNS, HTTP, GC entries

```js
const obs = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(entry.entryType, entry.name, entry.duration);
  }
});
obs.observe({ entryTypes: ['dns', 'http', 'gc', 'mark', 'measure'] });
```

### Engineering Rules

- **Event loop delay is your primary health metric.** Instrument it in every production service.
- **`eventLoopUtilization` close to 1.0** means you are CPU-bound and need Worker Threads or Cluster.
- **Use `performance.mark`/`measure`** around any operation you suspect is slow before optimizing — measure first.
- **GC entries > 50ms duration** in production indicate a memory/allocation problem.

---

## 13. Mental Model: What Blocks the Event Loop

The core rule of Node.js performance is simple: **never block the event loop**. But "blocking" takes many forms.

### Direct Blocking

```js
// Obvious blocks — don't do these on the main thread
const data = fs.readFileSync('large.json');   // synchronous I/O
crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512'); // CPU
JSON.parse(veryLargeString);  // can take 100ms+ for multi-MB strings
```

### Indirect Blocking via Thread Pool Starvation

```js
// 100 concurrent requests each doing a dns.lookup()
// = 96 of them waiting for a free thread pool slot
// = latency spikes for ALL requests, not just DNS ones
```

### Memory Pressure Causing GC Pauses

```js
// Allocating many objects in a tight loop
// → fills new space → triggers minor GC
// → many survive → promoted to old space
// → old space fills → triggers major GC pause (stop-the-world)
```

### The Blocked Event Loop Test

```js
// If this timer fires late, something blocked the loop
const start = Date.now();
setInterval(() => {
  const delay = Date.now() - start - 1000;
  if (delay > 50) console.warn(`Event loop blocked for ${delay}ms`);
}, 1000);
```

### Decision Tree

```
Is the operation I/O? (network, file, DNS)
  → Yes: use async APIs, they're non-blocking. No action needed.
  → No: Is it CPU-intensive?
      → Yes: run in a Worker Thread or offload to a child process.
      → No: Is it many quick operations in a tight loop?
          → Yes: batch them, use setImmediate to yield, or move to a Worker.
```

---

## Quick Reference Summary

| Concern | Key File | Key Concept | Action |
|---|---|---|---|
| Event loop blocking | `src/api/embed_helpers.cc:42` | `uv_run` phases | Never block main thread |
| Task scheduling | `lib/internal/process/task_queues.js` | nextTick → microtask → I/O → setImmediate | Choose the right deferral mechanism |
| V8 optimization | V8 internals | Hidden classes, monomorphism | Keep object shapes consistent |
| Buffer allocation | `lib/buffer.js:173` | 8KB pool, allocUnsafe | Reuse buffers, avoid small allocs in loops |
| Stream memory | `lib/internal/streams/state.js:12` | highWaterMark, backpressure | Always use `pipeline()`, respect `false` from `write()` |
| Thread pool | `UV_THREADPOOL_SIZE` env var | Default 4 threads | Increase for I/O-heavy loads, use workers for CPU |
| Multi-core | `lib/cluster.js`, `lib/worker_threads.js` | Cluster=I/O, Workers=CPU | Match strategy to workload |
| HTTP connections | `lib/_http_server.js:216` | Keep-alive | `keepAlive: true` on all outbound agents |
| DNS latency | `lib/dns.js:142` | lookup vs resolve | Use `resolve()` in high-throughput paths |
| Module startup | `lib/internal/modules/cjs/loader.js:1240` | Two-level cache | Lazy-load infrequent modules |
| Memory leaks | `lib/v8.js:230` | Heap stats + external | Monitor `used_heap_size` + `external_memory` |
| Observability | `lib/perf_hooks.js:34` | Event loop delay, ELU | Instrument delay histogram in production |
