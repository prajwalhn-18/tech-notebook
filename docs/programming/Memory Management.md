---
sidebar_position: 7
---

## Memory Management

JavaScript handles memory allocation and deallocation automatically through garbage collection. But "automatic" doesn't mean "worry-free" — memory leaks in long-running Node.js services are a real production problem that causes degraded performance and eventual crashes.

* * *

How Memory Works in JavaScript
================================

### Memory lifecycle

1. **Allocation** — JS allocates memory when you create variables, objects, functions
2. **Use** — you read and write to the allocated memory
3. **Release** — the garbage collector reclaims memory no longer reachable

```js
// Allocation
const user = { name: 'Prajwal', age: 25 }; // allocates an object on the heap
const arr  = new Array(1000);               // allocates an array

// After this function returns, `user` goes out of scope
function example() {
  const temp = { x: 1 }; // allocated
  return temp.x;
} // temp is no longer reachable → eligible for GC
```

### Stack vs Heap

**Stack** — primitives and function call frames. Fixed size, automatically managed.

```js
let x = 42;           // stored on stack (number primitive)
let name = 'Prajwal'; // string value is interned/on heap, reference on stack
```

**Heap** — objects and closures. Dynamic size, managed by GC.

```js
const obj = { data: new Array(1000) }; // stored on heap
```

* * *

Garbage Collection
===================

JavaScript uses a **Mark and Sweep** algorithm.

### Mark and Sweep

1. **Mark phase** — starting from roots (global variables, active call stack), the GC traverses all reachable objects and marks them
2. **Sweep phase** — any object not marked is unreachable → memory is reclaimed

```js
let a = { name: 'A' };
let b = { name: 'B', ref: a }; // b holds a reference to a

a = null; // `a` no longer holds a reference to the object

// Is { name: 'A' } GC'd? NO — `b.ref` still references it
// Is it GC'd after b = null? YES — no more references
b = null; // now { name: 'A' } and { name: 'B' } are both unreachable
```

**Key insight:** An object is GC'd only when it has **zero reachable references**. Even one reference keeps it alive.

### Reference counting (older approach, still relevant)

Keeps a count of references to each object. When count hits 0, free the memory.

**Problem: circular references** (why modern GCs use mark-and-sweep)

```js
// Circular reference — reference counting would never free these
function createCycle() {
  const a = {};
  const b = {};
  a.ref = b; // a references b
  b.ref = a; // b references a
  return null;
}
// a.count = 1 (from b.ref), b.count = 1 (from a.ref)
// Neither reaches 0 → memory leak with reference counting
// Mark-and-sweep handles this: neither is reachable from roots → both get GC'd
```

* * *

Memory Leaks — Common Causes
==============================

A memory leak is memory that is no longer needed but is never released because it's still reachable from a root.

### 1. Forgotten event listeners

```js
// Leak — listener added but never removed
class DataPoller {
  start() {
    this.data = new Array(100_000).fill('data'); // large allocation

    window.addEventListener('resize', () => {
      this.recalculate(); // closure holds `this`, `this` holds `data`
    });
  }
}

// Even if DataPoller instance is "done", the resize listener keeps it alive
// Solution: keep a reference to the handler and remove it
class DataPoller {
  constructor() {
    this.handleResize = () => this.recalculate(); // store reference
  }

  start() {
    this.data = new Array(100_000).fill('data');
    window.addEventListener('resize', this.handleResize);
  }

  stop() {
    window.removeEventListener('resize', this.handleResize); // cleanup
    this.data = null; // release large allocation
  }
}
```

### 2. Closures holding large data

```js
// Leak — the returned closure keeps `largeData` alive forever
function processData() {
  const largeData = new Array(1_000_000).fill('record');

  // Only needs the length, but captures the entire array
  return function() {
    return largeData.length; // closes over largeData
  };
}

const fn = processData();
// largeData (8MB+) is never GC'd as long as fn exists

// Fix: only capture what you need
function processData() {
  const largeData = new Array(1_000_000).fill('record');
  const length = largeData.length; // extract before returning

  return function() {
    return length; // closes over just the number
  };
  // largeData is now eligible for GC when processData returns
}
```

### 3. Unbounded caches

```js
// Leak — cache grows forever, nothing is ever evicted
const cache = {};

async function getUser(id) {
  if (cache[id]) return cache[id];
  const user = await db.users.findById(id);
  cache[id] = user; // never removed
  return user;
}

// In a long-running server, this cache grows indefinitely
```

**Fix 1: LRU cache with size limit**

```js
import LRU from 'lru-cache';

const cache = new LRU({ max: 500 }); // max 500 entries, evicts least-recently-used

async function getUser(id) {
  const cached = cache.get(id);
  if (cached) return cached;
  const user = await db.users.findById(id);
  cache.set(id, user);
  return user;
}
```

**Fix 2: WeakMap — GC-friendly cache**

```js
// When the key object is no longer referenced elsewhere, the entry is automatically removed
const cache = new WeakMap();

function processObject(obj) {
  if (cache.has(obj)) return cache.get(obj);
  const result = expensiveComputation(obj);
  cache.set(obj, result);
  return result;
}
// When `obj` goes out of scope, cache entry is automatically GC'd
```

### 4. Timers not cleared

```js
// Leak — interval fires forever, keeps callback and its closure alive
class Heartbeat {
  start() {
    this.data = loadLargeConfig();
    setInterval(() => {
      ping(this.data); // closure keeps `this` alive, `this` keeps `data` alive
    }, 1000);
  }
  // No way to stop this — interval runs until process exits
}

// Fix: store the timer ID and clear it
class Heartbeat {
  start() {
    this.data = loadLargeConfig();
    this.timer = setInterval(() => ping(this.data), 1000);
  }

  stop() {
    clearInterval(this.timer);
    this.data = null;
  }
}
```

### 5. Detached DOM nodes (browser)

```js
// Leak — element is removed from DOM but JS still holds a reference
let button = document.getElementById('submit');
document.body.removeChild(button); // removed from DOM

// But button variable still references the element → not GC'd
button = null; // now it can be GC'd
```

### 6. Global variables

```js
// Accidentally creates a global variable (missing `let`/`const`)
function setup() {
  config = loadConfig(); // no `const` → attaches to global object
}

// `config` is now window.config or global.config — lives forever
// Fix: always use const/let
```

* * *

WeakRef and FinalizationRegistry
==================================

For advanced memory-sensitive scenarios (caches, object pools).

```js
// WeakRef — holds a reference that doesn't prevent GC
const cache = new Map();

function getOrCompute(key, computeFn) {
  const ref = cache.get(key);
  const cached = ref?.deref(); // deref() returns undefined if GC'd

  if (cached !== undefined) return cached;

  const value = computeFn();
  cache.set(key, new WeakRef(value));
  return value;
}

// FinalizationRegistry — callback when object is GC'd
const registry = new FinalizationRegistry((key) => {
  console.log(`Object with key ${key} was garbage collected`);
  cache.delete(key); // clean up the map entry
});

registry.register(value, key); // register object to be tracked
```

* * *

Detecting Memory Leaks in Node.js
===================================

### Heap snapshots

```bash
# Start Node with inspector
node --inspect app.js
```

Open `chrome://inspect` → take a heap snapshot → perform actions → take another snapshot → compare.

### process.memoryUsage()

```js
// Log memory periodically
setInterval(() => {
  const { heapUsed, heapTotal, rss } = process.memoryUsage();
  console.log({
    heapUsed: `${Math.round(heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(rss / 1024 / 1024)}MB`,
  });
}, 10_000);
```

If `heapUsed` grows continuously without stabilizing → memory leak.

### --max-old-space-size

```bash
# Default heap size is ~1.5GB for Node.js
node --max-old-space-size=4096 app.js  # 4GB heap
```

Increasing heap size delays the crash but doesn't fix the leak.

* * *

Interview definition (short answer)
=====================================

> "JavaScript uses mark-and-sweep garbage collection — objects are GC'd when they have no reachable references. Memory leaks in JS happen when references are unintentionally kept alive: unremoved event listeners, closures capturing large data, unbounded caches (use LRU or WeakMap), timers not cleared. Use `process.memoryUsage()` and heap snapshots to diagnose leaks in Node.js."
