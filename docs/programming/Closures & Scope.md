---
sidebar_position: 2
---

## Closures & Scope

Closures are one of JavaScript's most powerful features — and one of the most misunderstood. Every senior engineer must be able to explain them clearly and use them deliberately.

* * *

What is a Closure?
===================

A **closure** is a function that **remembers the variables from its outer scope** even after that outer function has returned.

```js
function outer() {
  const count = 0; // outer variable

  function inner() {
    console.log(count); // inner can access count
  }

  return inner;
}

const fn = outer(); // outer() has returned
fn(); // 0 — inner still has access to count
```

`inner` is a closure — it "closes over" the variable `count`. Even though `outer()` has finished executing, `count` is not garbage collected because `inner` still holds a reference to it.

* * *

How Closures Work Under the Hood
=================================

Every function in JavaScript carries a reference to its **lexical environment** — the variable scope where it was defined.

```js
function makeCounter() {
  let count = 0; // lives in makeCounter's environment

  return {
    increment() { count++; },
    decrement() { count--; },
    value()     { return count; },
  };
}

const counter = makeCounter();
counter.increment(); // count = 1
counter.increment(); // count = 2
counter.decrement(); // count = 1
counter.value();     // 1
```

- `makeCounter()` returns an object with three methods
- All three methods close over the **same** `count` variable
- `count` is private — nothing outside can access it directly
- Each call to `makeCounter()` creates a **new** `count` in a **new** environment

```js
const c1 = makeCounter();
const c2 = makeCounter();

c1.increment();
c1.value(); // 1
c2.value(); // 0 — separate environment, separate count
```

* * *

Practical Uses of Closures
============================

### 1. Data privacy / encapsulation

```js
function createBankAccount(initialBalance) {
  let balance = initialBalance; // private — cannot be accessed from outside

  return {
    deposit(amount) {
      if (amount <= 0) throw new Error('Amount must be positive');
      balance += amount;
      return balance;
    },
    withdraw(amount) {
      if (amount > balance) throw new Error('Insufficient funds');
      balance -= amount;
      return balance;
    },
    getBalance() {
      return balance;
    },
  };
}

const account = createBankAccount(1000);
account.deposit(500);    // 1500
account.withdraw(200);   // 1300
account.getBalance();    // 1300
account.balance;         // undefined — truly private
```

### 2. Factory functions

```js
function createMultiplier(multiplier) {
  return (n) => n * multiplier; // closes over `multiplier`
}

const double = createMultiplier(2);
const triple = createMultiplier(3);

double(5); // 10
triple(5); // 15
```

### 3. Partial application

```js
function fetchWithAuth(baseUrl) {
  return function(endpoint, options = {}) {
    return fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${getToken()}`,
      },
    });
  };
}

const api = fetchWithAuth('https://api.example.com');

// Now use without repeating the base URL
await api('/orders');
await api('/users/42');
```

### 4. Memoization

```js
function memoize(fn) {
  const cache = new Map(); // closes over this cache

  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      console.log('[cache hit]');
      return cache.get(key);
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const expensiveCalc = memoize((n) => {
  console.log('computing...');
  return n * n;
});

expensiveCalc(10); // computing... → 100
expensiveCalc(10); // [cache hit] → 100
expensiveCalc(20); // computing... → 400
```

### 5. Event handlers with context

```js
function makeButton(label) {
  let clickCount = 0; // private state per button

  const button = document.createElement('button');
  button.textContent = label;

  button.addEventListener('click', function() {
    clickCount++;
    console.log(`${label} clicked ${clickCount} times`);
  });

  return button;
}

const btn1 = makeButton('Save');
const btn2 = makeButton('Cancel');
// Each button has its own independent clickCount
```

### 6. Once — run only once

```js
function once(fn) {
  let called = false;
  let result;

  return function(...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}

const initialize = once(() => {
  console.log('initializing...');
  return { ready: true };
});

initialize(); // initializing... → { ready: true }
initialize(); // → { ready: true } (fn not called again)
initialize(); // → { ready: true }
```

* * *

The Classic Closure Bug
========================

The most common interview question about closures — the loop variable problem.

```js
// Bug — all callbacks close over the same `i`
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// Output: 3, 3, 3 — not 0, 1, 2
// By the time the timeouts fire, the loop has finished and i = 3
```

**Fix 1: Use `let` (block-scoped — creates a new binding per iteration)**

```js
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// Output: 0, 1, 2 ✅
```

**Fix 2: IIFE (creates a new scope per iteration)**

```js
for (var i = 0; i < 3; i++) {
  (function(j) {
    setTimeout(() => console.log(j), 100);
  })(i); // immediately capture current i as j
}
// Output: 0, 1, 2 ✅
```

The `let` fix is the modern solution — it was designed specifically to solve this problem.

* * *

IIFE — Immediately Invoked Function Expression
===============================================

A function that defines and calls itself immediately, creating a private scope.

```js
(function() {
  const privateVar = 'I cannot be accessed outside';
  console.log('runs immediately');
})();

// Arrow IIFE
(() => {
  // ...
})();

// IIFE with return value
const result = (() => {
  const x = 10;
  const y = 20;
  return x + y;
})();
console.log(result); // 30
```

**Why IIFEs mattered:** Before ES modules, IIFEs were the way to create private scope and avoid polluting the global namespace. Today, ES modules replace this pattern — each module has its own scope.

```js
// Old (pre-modules)
const MyModule = (function() {
  let privateState = 0;

  return {
    increment() { privateState++; },
    getValue()  { return privateState; },
  };
})();

// Modern — just use ES modules
// myModule.js
let privateState = 0;
export function increment() { privateState++; }
export function getValue()  { return privateState; }
```

* * *

Closure and Memory
==================

Closures keep their outer scope alive — this can cause memory leaks if you're not careful.

```js
// Memory leak: large data kept alive by a closure
function setup() {
  const largeArray = new Array(1_000_000).fill('data'); // 1M items

  return function() {
    // This closure keeps largeArray alive even if we never use it
    console.log('called');
  };
}

const fn = setup();
// largeArray is never GC'd as long as fn exists

// Fix: don't capture what you don't need
function setupFixed() {
  const largeArray = new Array(1_000_000).fill('data');
  const summary = largeArray.length; // extract only what you need

  return function() {
    console.log(summary); // closes over summary, not largeArray
  };
}
// largeArray can now be GC'd after setupFixed returns
```

* * *

Closures in Async Code
=======================

```js
// Closure captures the variable binding, not the value at call time
async function processOrders(orderIds) {
  const results = [];

  for (const id of orderIds) {
    // Each iteration creates a new `id` binding (for...of with const)
    const result = await processOrder(id); // `id` is correctly captured
    results.push(result);
  }

  return results;
}

// With Promise.all — all closures capture different ids
const results = await Promise.all(
  orderIds.map(id => processOrder(id)) // each arrow fn closes over its own id
);
```

* * *

Interview definition (short answer)
=====================================

> "A closure is a function that retains access to its outer lexical scope after the outer function has returned. Closures enable data privacy (the only way to create truly private variables in JS), factory functions, memoization, and partial application. The classic bug is loop variables with `var` — `let` creates a new binding per iteration, solving it."
