---
sidebar_position: 1
---

## In-Depth Guide: Async Code in Node.js

### Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The Event Loop](#2-the-event-loop)
3. [Async ID System](#3-async-id-system)
4. [Async Hooks](#4-async-hooks)
5. [The C++ Async Context Stack](#5-the-c-async-context-stack)
6. [Promises and async/await](#6-promises-and-asyncawait)
7. [The Microtask Queue](#7-the-microtask-queue)
8. [Timers — A Full Walkthrough](#8-timers--a-full-walkthrough)
9. [AsyncContextFrame and AsyncLocalStorage](#9-asynccontextframe-and-asynclocalstorage)
10. [Putting It All Together](#10-putting-it-all-together)
11. [Suggested Reading Order](#11-suggested-reading-order)

---

## 1. Architecture Overview

Node.js async is composed of three distinct layers that work in concert:

```
┌─────────────────────────────────────────────────────────────┐
│  JavaScript Layer                                           │
│  async/await · Promises · callbacks · AsyncLocalStorage     │
├─────────────────────────────────────────────────────────────┤
│  Node.js C++ Bindings                                       │
│  AsyncWrap · async_hooks · task_queue · env.cc              │
├─────────────────────────────────────────────────────────────┤
│  V8 Engine                          libuv                   │
│  Promise microtask queue            Event loop + I/O        │
└─────────────────────────────────────────────────────────────┘
```

Each layer has a specific role:
- **libuv** drives the event loop and handles OS-level I/O and timers.
- **V8** executes JavaScript and manages the Promise microtask queue.
- **Node.js C++ bindings** bridge V8 and libuv, adding async tracking, context propagation, and hook emission.
- **JavaScript** provides the user-facing APIs (`async_hooks`, `AsyncLocalStorage`, `timers`, etc.).

---

## 2. The Event Loop

### Entry Point

The event loop lives in `src/api/embed_helpers.cc:23`. `SpinEventLoopInternal()` is what keeps Node.js running:

```cpp
// src/api/embed_helpers.cc:23
Maybe<ExitCode> SpinEventLoopInternal(Environment* env) {
  // ...setup...
  bool more;
  do {
    if (env->is_stopping()) break;

    uv_run(env->event_loop(), UV_RUN_DEFAULT);  // line 42 — the core loop call

    platform->DrainTasks(isolate);  // flush V8 platform tasks

    more = uv_loop_alive(env->event_loop());
    if (more && !env->is_stopping()) continue;

    if (EmitProcessBeforeExit(env).IsNothing()) break;

    more = uv_loop_alive(env->event_loop());
  } while (more == true && !env->is_stopping());
}
```

`UV_RUN_DEFAULT` tells libuv to keep running until there are no more active handles or requests.

### libuv Loop Phases

Each iteration of `uv_run()` processes these phases in order:

```
┌─────────────────────────────────┐
│           timers                │  ← setTimeout / setInterval callbacks
├─────────────────────────────────┤
│       pending callbacks         │  ← deferred I/O callbacks from prior iteration
├─────────────────────────────────┤
│      idle / prepare             │  ← internal use only
├─────────────────────────────────┤
│            poll                 │  ← wait for new I/O events (blocking if queue empty)
├─────────────────────────────────┤
│            check                │  ← setImmediate callbacks
├─────────────────────────────────┤
│        close callbacks          │  ← e.g. socket.on('close', ...)
└─────────────────────────────────┘
        ↓ then repeat...
```

Between phases, Node.js flushes the **microtask queue** (Promises, `queueMicrotask`) and **nextTick queue** (`process.nextTick`). These always run before the next libuv phase begins.

---

## 3. Async ID System

Every async operation in Node.js gets a unique numeric ID. This is the backbone of async tracking.

### The Shared Arrays

`lib/internal/async_hooks.js` directly wraps C++ memory via `internalBinding`:

```js
// lib/internal/async_hooks.js:41-55
const {
  async_hook_fields,       // Uint32Array — counts active hooks per type
  async_id_fields,         // Float64Array — current execution/trigger IDs
  execution_async_resources,
} = async_wrap;
```

`async_id_fields` is a `Float64Array` with 4 slots:

| Index | Constant | Meaning |
|---|---|---|
| 0 | `kExecutionAsyncId` | ID of the currently executing async resource |
| 1 | `kTriggerAsyncId` | ID that caused (triggered) the current operation |
| 2 | `kAsyncIdCounter` | Global counter — incremented for each new resource |
| 3 | `kDefaultTriggerAsyncId` | Override for trigger ID in constructors |

`async_hook_fields` is a `Uint32Array` that counts how many hooks are registered for each lifecycle event:

| Index | Constant | Meaning |
|---|---|---|
| 0 | `kInit` | Number of init hooks active |
| 1 | `kBefore` | Number of before hooks active |
| 2 | `kAfter` | Number of after hooks active |
| 3 | `kDestroy` | Number of destroy hooks active |
| 4 | `kTotals` | Sum of all active hooks |
| 5 | `kPromiseResolve` | Number of promiseResolve hooks |

Using `TypedArray` backed by C++ memory means JS can read/write these values at zero cost — no JS/C++ boundary crossing needed on the hot path.

### Trigger ID Precedence

When a new async resource is created, `triggerAsyncId` is resolved with this priority:

```
1. Value passed directly to the constructor
2. kDefaultTriggerAsyncId (if set)
3. kExecutionAsyncId of whoever is currently running
```

---

## 4. Async Hooks

Async hooks allow user code to observe the full lifecycle of every async operation.

### The `AsyncHook` Class

`lib/async_hooks.js:75` defines the `AsyncHook` class:

```js
// lib/async_hooks.js:75
class AsyncHook {
  constructor({ init, before, after, destroy, promiseResolve, trackPromises }) {
    // validates all callbacks are functions, then stores them as symbols
    this[init_symbol] = init;
    this[before_symbol] = before;
    this[after_symbol] = after;
    this[destroy_symbol] = destroy;
    this[promise_resolve_symbol] = promiseResolve;
  }

  enable() {
    const { 0: hooks_array, 1: hook_fields } = getHookArrays();

    // Guard: each hook can only be added once
    if (ArrayPrototypeIncludes(hooks_array, this)) return this;

    // Increment the count for each registered callback type
    hook_fields[kTotals] = hook_fields[kInit] += +!!this[init_symbol];
    hook_fields[kTotals] += hook_fields[kBefore] += +!!this[before_symbol];
    hook_fields[kTotals] += hook_fields[kAfter] += +!!this[after_symbol];
    hook_fields[kTotals] += hook_fields[kDestroy] += +!!this[destroy_symbol];

    // If this is the first hook, activate the C++ hook machinery
    if (prev_kTotals === 0 && hook_fields[kTotals] > 0) {
      enableHooks();
    }

    updatePromiseHookMode(); // tell V8 to call promise hooks
    return this;
  }

  disable() {
    // Decrements counts. If kTotals hits 0, disableHooks() is called
    // to turn off the C++ machinery.
  }
}
```

The `+!!this[init_symbol]` pattern converts the callback to `1` if it exists, `0` if not. This efficiently increments the shared counter.

### Hook Emission

`lib/internal/async_hooks.js:193` — this is what fires when a new async resource is created:

```js
// lib/internal/async_hooks.js:193
function emitInitNative(asyncId, type, triggerAsyncId, resource, isPromiseHook) {
  active_hooks.call_depth += 1;
  resource = lookupPublicResource(resource);
  try {
    for (var i = 0; i < active_hooks.array.length; i++) {
      if (typeof active_hooks.array[i][init_symbol] === 'function') {
        active_hooks.array[i][init_symbol](asyncId, type, triggerAsyncId, resource);
      }
    }
  } catch (e) {
    fatalError(e);  // hook errors are fatal to prevent corruption
  } finally {
    active_hooks.call_depth -= 1;
    // If hooks were added/removed during execution, swap in the pending array
    if (active_hooks.call_depth === 0 && active_hooks.tmp_array !== null) {
      restoreActiveHooks();
    }
  }
}
```

The `active_hooks.tmp_array` mechanism (line 76) is subtle: if a hook is enabled or disabled *while hooks are currently being fired*, the changes go into `tmp_array` rather than mutating `active_hooks.array` mid-iteration. After the current hook batch finishes, `tmp_array` is swapped in.

### The `callbackTrampoline`

`lib/internal/async_hooks.js:119` — this is the hot path for every I/O callback:

```js
// lib/internal/async_hooks.js:119
function callbackTrampoline(asyncId, resource, cb, ...args) {
  const index = async_hook_fields[kStackLength] - 1;
  execution_async_resources[index] = resource;  // track current resource

  if (asyncId !== 0 && hasHooks(kBefore))
    emitBeforeNative(asyncId);

  let result;
  if (asyncId === 0 && typeof domain_cb === 'function') {
    // domain support path
    result = ReflectApply(domain_cb, this, args);
  } else {
    result = ReflectApply(cb, this, args);  // execute the callback
  }

  if (asyncId !== 0 && hasHooks(kAfter))
    emitAfterNative(asyncId);

  execution_async_resources.pop();
  return result;
}
```

Every TCP callback, file I/O callback, DNS response — they all go through this trampoline, which ensures `before`/`after` hooks fire around every callback execution.

---

## 5. The C++ Async Context Stack

### `push_async_context` / `pop_async_context`

When a callback starts executing, Node.js pushes the new async context onto a stack so that `executionAsyncId()` returns the right value. This lives in `src/env.cc:124`:

```cpp
// src/env.cc:124
void AsyncHooks::push_async_context(
    double async_id,
    double trigger_async_id,
    std::variant<Local<Object>*, Global<Object>*> resource) {

  uint32_t offset = fields_[kStackLength];

  // If the JS-side stack is full, grow it
  if (offset * 2 >= async_ids_stack_.Length()) grow_async_ids_stack();

  // Save the current IDs onto the stack
  async_ids_stack_[2 * offset]     = async_id_fields_[kExecutionAsyncId];
  async_ids_stack_[2 * offset + 1] = async_id_fields_[kTriggerAsyncId];

  fields_[kStackLength] += 1;

  // Overwrite the "current" slots with the new context
  async_id_fields_[kExecutionAsyncId] = async_id;
  async_id_fields_[kTriggerAsyncId]   = trigger_async_id;
}
```

And popping it back after the callback (`src/env.cc:162`):

```cpp
// src/env.cc:162
bool AsyncHooks::pop_async_context(double async_id) {
  if (fields_[kStackLength] == 0) return false;

  // Integrity check — the id being popped must match what was pushed
  if (fields_[kCheck] > 0 &&
      async_id_fields_[kExecutionAsyncId] != async_id) {
    FailWithCorruptedAsyncStack(async_id);  // this crashes the process
  }

  uint32_t offset = fields_[kStackLength] - 1;

  // Restore the previous IDs from the stack
  async_id_fields_[kExecutionAsyncId] = async_ids_stack_[2 * offset];
  async_id_fields_[kTriggerAsyncId]   = async_ids_stack_[2 * offset + 1];
  fields_[kStackLength] = offset;

  return fields_[kStackLength] > 0;
}
```

The key insight: the `async_ids_stack_` array stores pairs of `(executionAsyncId, triggerAsyncId)`. Each async operation pushes a pair and pops it when done, so the stack always reflects the exact chain of async operations that led to the current execution.

---

## 6. Promises and async/await

### async/await is Compiled Sugar

`async/await` is not a runtime feature — the V8 engine transforms it at compile time into a **state machine** using Promises. Consider:

```js
async function fetchUser(id) {
  const data = await fetch(`/users/${id}`);
  return data.json();
}
```

V8 compiles this roughly into:

```js
function fetchUser(id) {
  return new Promise((resolve, reject) => {
    // State 0: initial
    fetch(`/users/${id}`)
      .then((data) => {
        // State 1: after first await
        return data.json();
      })
      .then(resolve, reject);
  });
}
```

Each `await` becomes a `.then()` continuation. The V8 engine optimizes this heavily — since Node.js 12, V8 reduced each `await` from 3 microtask ticks to 1 via "PromiseResolveThenableJobTask" optimizations.

### Promise Hooks

`lib/internal/promise_hooks.js` registers hooks directly with V8:

```js
// lib/internal/promise_hooks.js:74
function update() {
  const init     = maybeFastPath(hooks.init, initAll);
  const before   = maybeFastPath(hooks.before, beforeAll);
  const after    = maybeFastPath(hooks.after, afterAll);
  const settled  = maybeFastPath(hooks.settled, settledAll);

  setPromiseHooks(init, before, after, settled);  // native call into V8
}
```

`maybeFastPath` (line 70) is a small optimization:

```js
// lib/internal/promise_hooks.js:70
function maybeFastPath(list, runAll) {
  return list.length > 1 ? runAll : list[0];
  // If only 1 hook, call it directly — skip the loop overhead
}
```

The four phases for Promises:

| Phase | When | Analogue |
|---|---|---|
| `init` | `new Promise(...)` | `init` in async_hooks |
| `before` | Promise callback about to run | `before` in async_hooks |
| `after` | Promise callback finished | `after` in async_hooks |
| `settled` | Promise resolved or rejected | `promiseResolve` in async_hooks |

### Promise Rejection Tracking

`src/node_task_queue.cc:46` — every unhandled rejection, every late `.catch()`, goes through this:

```cpp
// src/node_task_queue.cc:46
void PromiseRejectCallback(PromiseRejectMessage message) {
  static std::atomic<uint64_t> unhandledRejections{0};
  static std::atomic<uint64_t> rejectionsHandledAfter{0};

  Local<Promise> promise = message.GetPromise();
  PromiseRejectEvent event = message.GetEvent();

  if (event == kPromiseRejectWithNoHandler) {
    // No .catch() attached — this is an unhandled rejection
    value = message.GetValue();
    unhandledRejections++;

  } else if (event == kPromiseHandlerAddedAfterReject) {
    // User added .catch() after the fact
    rejectionsHandledAfter++;

  } else if (event == kPromiseResolveAfterResolved) {
    // Bug: promise.resolve() called twice
    value = message.GetValue();

  } else if (event == kPromiseRejectAfterResolved) {
    // Bug: promise.reject() after it was already resolved
    value = message.GetValue();
  }

  // Push the promise's async context so hooks fire with correct IDs
  if (async_id != AsyncWrap::kInvalidAsyncId) {
    env->async_hooks()->push_async_context(async_id, trigger_async_id, &promise_as_obj);
  }

  // Call the JS-land rejection handler (process 'unhandledRejection' event)
  callback->Call(env->context(), Undefined(isolate), arraysize(args), args);

  if (...) env->async_hooks()->pop_async_context(async_id);
}
```

---

## 7. The Microtask Queue

### What Are Microtasks?

Microtasks are functions that run **after the current synchronous task** but **before returning to libuv**. Promise `.then()` continuations are microtasks. So is `queueMicrotask()`.

```
synchronous code runs
  → then ALL microtasks run (flushed completely)
    → then libuv checks for I/O / timers
```

### Enqueueing and Flushing

`src/node_task_queue.cc:131`:

```cpp
// src/node_task_queue.cc:131
static void EnqueueMicrotask(const FunctionCallbackInfo<Value>& args) {
  // Adds a function to V8's microtask queue
  isolate->GetCurrentContext()->GetMicrotaskQueue()
      ->EnqueueMicrotask(isolate, args[0].As<Function>());
}

// src/node_task_queue.cc:140
static void RunMicrotasks(const FunctionCallbackInfo<Value>& args) {
  // Runs ALL pending microtasks atomically
  env->context()->GetMicrotaskQueue()->PerformCheckpoint(env->isolate());
}
```

`PerformCheckpoint` drains the queue completely — if a microtask enqueues another microtask, that new one also runs before control returns to libuv.

### nextTick vs Microtasks

`process.nextTick` is **not** a microtask in the V8 sense. It has its own queue managed by Node.js and always runs before Promise microtasks:

```
process.nextTick queue  →  Promise microtask queue  →  libuv
```

---

## 8. Timers — A Full Walkthrough

Timers are the best place to study the full async machinery end-to-end.

### Data Structure

`lib/internal/timers.js:34-73` explains the architecture in comments. It uses two structures:

```
timerListMap  =  { '40': TimersList, '100': TimersList, ... }
                           ↑
                   keyed by duration (ms)

timerListQueue  =  PriorityQueue<TimersList>
                           ↑
                   ordered by expiry time
```

Each `TimersList` is a doubly-linked list of `Timeout` objects with the same duration. Because all timers in a list share the same duration, later-added timers always expire later — so the list is always sorted by just appending. **O(1)** insertion.

The `PriorityQueue` (binary heap) orders the lists themselves by expiry. **O(log n)** for list-level scheduling.

### Timer Creation

`lib/internal/timers.js:164`:

```js
// lib/internal/timers.js:164
function initAsyncResource(resource, type) {
  const asyncId = resource[async_id_symbol] = newAsyncId();
  const triggerAsyncId =
    resource[trigger_async_id_symbol] = getDefaultTriggerAsyncId();

  // Capture the current context frame for propagation at callback time
  resource[async_context_frame] = AsyncContextFrame.current();

  // Fire the init hook if any hooks are registered
  if (initHooksExist())
    emitInit(asyncId, type, triggerAsyncId, resource);
}
```

### Timer Execution

When the event loop reaches the timers phase, `processTimers` is called. It peeks the `PriorityQueue` for expired lists:

```js
// lib/internal/timers.js:526
function processTimers(now) {
  let list;
  while ((list = timerListQueue.peek()) != null) {
    if (list.expiry > now) {
      // This list hasn't expired yet — nothing left to do
      nextExpiry = list.expiry;
      return timeoutInfo[0] > 0 ? nextExpiry : -nextExpiry;
    }
    if (ranAtLeastOneList) runNextTicks(); // flush nextTick + microtasks between lists
    listOnTimeout(list, now);
  }
  return 0;
}
```

`listOnTimeout` iterates the linked list and fires each timer:

```js
// lib/internal/timers.js:546
function listOnTimeout(list, now) {
  let timer;
  while ((timer = L.peek(list)) != null) {
    const diff = now - timer._idleStart;

    // Not yet expired — update expiry and re-sort the priority queue
    if (diff < msecs) {
      list.expiry = MathMax(timer._idleStart + msecs, now + 1);
      timerListQueue.percolateDown(1);
      return;
    }

    if (ranAtLeastOneTimer) runNextTicks(); // flush between each timer

    L.remove(timer);
    const asyncId = timer[async_id_symbol];

    // 1. Swap in the context that was captured when the timer was created
    const priorContextFrame =
      AsyncContextFrame.exchange(timer[async_context_frame]);

    // 2. Emit the 'before' hook
    emitBefore(asyncId, timer[trigger_async_id_symbol], timer);

    try {
      // 3. Execute the callback
      const args = timer._timerArgs;
      if (args === undefined)
        timer._onTimeout();
      else
        ReflectApply(timer._onTimeout, timer, args);
    } finally {
      // 4. Handle repeat (setInterval) or mark as destroyed
      if (timer._repeat && timer._idleTimeout !== -1) {
        insert(timer, timer._idleTimeout, start); // reschedule
      } else {
        timer._destroyed = true;
        emitDestroy(asyncId);
      }
    }

    // 5. Emit the 'after' hook
    emitAfter(asyncId);

    // 6. Restore the prior context frame
    AsyncContextFrame.set(priorContextFrame);
  }
}
```

The full sequence for one timer tick:

```
AsyncContextFrame.exchange(saved frame)    ← restore caller's context
  → emitBefore(asyncId)                   ← fire before hooks
    → callback executes
  → emitAfter(asyncId)                    ← fire after hooks
AsyncContextFrame.set(prior frame)         ← put back previous context
```

Note that `runNextTicks()` is called between each timer (line 567) and between each timer list (line 538). This ensures that Promise chains spawned by a timer callback are resolved before the next timer fires.

---

## 9. AsyncContextFrame and AsyncLocalStorage

### The Problem

Without special handling, async context is lost across `await`:

```js
const store = new AsyncLocalStorage();
store.run({ userId: 42 }, async () => {
  await someAsyncOperation();
  console.log(store.getStore()); // Would be undefined without context propagation
});
```

### How Context Is Preserved

`lib/internal/async_context_frame.js` manages this. It uses V8's "continuation-preserved embedder data" — a slot in V8's execution context that survives across `await` boundaries:

```js
// lib/internal/async_context_frame.js:15
class ActiveAsyncContextFrame extends SafeMap {
  static current() {
    return getContinuationPreservedEmbedderData();  // V8 native call
  }

  static set(frame) {
    setContinuationPreservedEmbedderData(frame);    // V8 native call
  }

  static exchange(frame) {
    const prior = this.current();
    this.set(frame);
    return prior;
  }
}
```

`AsyncContextFrame` is itself a `Map` — it maps `AsyncLocalStorage` instances to their stored values.

### How It Works at Callback Time

In `AsyncResource.runInAsyncScope` (`lib/async_hooks.js:219`):

```js
// lib/async_hooks.js:219
runInAsyncScope(fn, thisArg, ...args) {
  const asyncId = this[async_id_symbol];
  emitBefore(asyncId, this[trigger_async_id_symbol], this);

  // Swap in the context frame that was captured at resource creation time
  const contextFrame = this[contextFrameSymbol];
  const prior = AsyncContextFrame.exchange(contextFrame);
  try {
    return ReflectApply(fn, thisArg, args);
  } finally {
    AsyncContextFrame.set(prior);   // always restore, even if fn throws
    if (hasAsyncIdStack())
      emitAfter(asyncId);
  }
}
```

And the same pattern in `listOnTimeout` for timers (line 591-627), in `processImmediate` for `setImmediate` (line 495-517), and in the callback trampoline for I/O.

The critical step is line `197` in `AsyncResource`:

```js
// lib/async_hooks.js:197
this[contextFrameSymbol] = AsyncContextFrame.current();
```

This captures a **snapshot** of the current frame when the resource is created. When the callback later fires, `exchange()` restores this snapshot, so `AsyncLocalStorage.getStore()` returns the correct value.

### Two Implementations

`lib/async_hooks.js:283` shows that `AsyncLocalStorage` has two implementations:

```js
get AsyncLocalStorage() {
  return AsyncContextFrame.enabled
    ? require('internal/async_local_storage/async_context_frame')  // V8 native path
    : require('internal/async_local_storage/async_hooks');          // async_hooks path
}
```

The `async_context_frame` path (enabled via `--async-context-frame` flag) uses V8's native continuation-preserved data for lower overhead. The `async_hooks` path uses the async hooks lifecycle to propagate context.

---

## 10. Putting It All Together

Here is the complete picture for a single `setTimeout(fn, 100)` call:

```
1. setTimeout(fn, 100) called
   ├── new Timeout(fn, 100, ...) created          [timers.js:176]
   ├── newAsyncId() → asyncId = N                 [async_hooks.js:199]
   ├── AsyncContextFrame.current() captured       [timers.js:168]
   └── emitInit(N, 'Timeout', triggerAsyncId)     [timers.js:170]
       └── fires all registered init hooks

2. insert(timer) → added to timerListMap[100]
   └── TimersList linked list, position = last (O(1))

3. uv_run() blocks in poll phase, waiting for I/O or timer expiry

4. 100ms later: libuv wakes, calls processTimers(now)

5. processTimers(now)
   └── timerListQueue.peek() → finds expired list
       └── listOnTimeout(list, now)

6. listOnTimeout fires the timer:
   ├── AsyncContextFrame.exchange(savedFrame)     ← restore context
   ├── emitBefore(N, triggerAsyncId, timer)       ← before hooks fire
   │   └── push_async_context(N, ...) in C++      ← executionAsyncId = N
   │
   ├── timer._onTimeout()  ← YOUR CALLBACK RUNS
   │   └── any Promises created here inherit asyncId N as trigger
   │
   ├── emitAfter(N)                               ← after hooks fire
   │   └── pop_async_context(N) in C++            ← restore prior asyncId
   │
   ├── emitDestroy(N)                             ← destroy hook fires
   └── AsyncContextFrame.set(priorFrame)          ← restore prior context

7. runNextTicks() called after timer
   └── flushes process.nextTick queue
       └── then flushes Promise microtask queue
           └── PerformCheckpoint() drains all .then() chains

8. Loop continues to next iteration
```

---

## 11. Suggested Reading Order

| # | File | What to focus on |
|---|---|---|
| 1 | `lib/internal/timers.js:1-73` | Architecture comments and data structure diagrams |
| 2 | `lib/internal/timers.js:164-171` | `initAsyncResource` — resource creation pattern |
| 3 | `lib/internal/timers.js:526-643` | `processTimers` + `listOnTimeout` — full callback lifecycle |
| 4 | `lib/async_hooks.js:75-166` | `AsyncHook` class — `enable()`/`disable()` mechanics |
| 5 | `lib/async_hooks.js:179-278` | `AsyncResource` class — `runInAsyncScope()` |
| 6 | `lib/internal/async_hooks.js:1-100` | Shared typed arrays and constants |
| 7 | `lib/internal/async_hooks.js:119-139` | `callbackTrampoline` — hot path for all I/O callbacks |
| 8 | `lib/internal/async_hooks.js:193-226` | `emitInitNative` — how hooks are called safely |
| 9 | `lib/internal/promise_hooks.js` | Promise lifecycle hooks and V8 integration |
| 10 | `src/node_task_queue.cc:46-128` | `PromiseRejectCallback` — rejection tracking in C++ |
| 11 | `src/node_task_queue.cc:131-143` | Microtask enqueue + flush |
| 12 | `src/env.cc:124-203` | `push_async_context` / `pop_async_context` — the C++ stack |
| 13 | `lib/internal/async_context_frame.js` | `AsyncContextFrame` — context propagation across await |
| 14 | `src/api/embed_helpers.cc:23-78` | `SpinEventLoopInternal` — the outer event loop |
