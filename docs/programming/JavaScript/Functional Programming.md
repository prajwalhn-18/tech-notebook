---
sidebar_position: 6
---

## Functional Programming

Functional programming (FP) is a paradigm that treats computation as the evaluation of **pure functions** and avoids **shared mutable state**. You don't need to go full FP — selectively applying FP principles makes your code more predictable, testable, and composable.

* * *

Pure Functions
===============

A function is **pure** if:
1. Given the same input, it always returns the same output
2. It has no side effects (no mutation of external state, no I/O)

```js
// Pure — same input, same output, no side effects
function add(a, b) { return a + b; }
function calculateTax(price, rate) { return price * rate; }
function formatName(first, last) { return `${first} ${last}`; }

// Impure — depends on external state
let taxRate = 0.18;
function calculateTax(price) {
  return price * taxRate; // result changes if taxRate changes
}

// Impure — mutates external state
let total = 0;
function addToTotal(n) {
  total += n; // side effect
  return total;
}

// Impure — I/O is a side effect
function logAndReturn(x) {
  console.log(x); // side effect
  return x;
}
```

### Why pure functions matter

```js
// Pure functions are trivially testable
test('calculateTax', () => {
  expect(calculateTax(100, 0.18)).toBe(18);
  expect(calculateTax(200, 0.10)).toBe(20);
  // No setup, no mocks, no state to reset
});

// Pure functions are safely parallelizable — no shared state
const totals = await Promise.all(orders.map(order => calculateTotal(order)));

// Pure functions are memoizable
const memoized = memoize(expensiveCalculation);
```

* * *

Immutability
=============

Never mutate data — create new versions instead.

```js
// Mutation (bad) — changes the original
const user = { name: 'Prajwal', role: 'user' };
user.role = 'admin'; // original is now changed

// Immutable update (good) — new object, original unchanged
const updatedUser = { ...user, role: 'admin' };

// Array mutations to avoid
const arr = [1, 2, 3];
arr.push(4);    // mutates arr
arr.splice(1, 1); // mutates arr
arr.sort();     // mutates arr (!)

// Immutable array operations
const arr2 = [...arr, 4];         // add
const arr3 = arr.filter(x => x !== 2); // remove
const arr4 = [...arr].sort();     // sort — spread first to avoid mutation

// Nested immutable update
const state = {
  user: { name: 'Prajwal', address: { city: 'Bangalore' } },
  orders: [],
};

// Update nested field immutably
const newState = {
  ...state,
  user: {
    ...state.user,
    address: {
      ...state.user.address,
      city: 'Mumbai',
    },
  },
};
```

### Practical immutability helpers

```js
// structuredClone — deep clone (Node 17+, modern browsers)
const deepCopy = structuredClone(original);

// Object.freeze — shallow immutability
const config = Object.freeze({
  port: 3000,
  db: { url: 'postgres://...' }, // this nested object is still mutable!
});

// Deep freeze
function deepFreeze(obj) {
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      deepFreeze(obj[key]);
    }
  });
  return Object.freeze(obj);
}
```

* * *

Higher-Order Functions
=======================

Functions that take functions as arguments or return functions.

### map — transform each element

```js
const orders = [
  { id: 1, total: 1000, tax: 0.18 },
  { id: 2, total: 500,  tax: 0.05 },
];

// Imperative
const totals = [];
for (const order of orders) {
  totals.push(order.total + order.total * order.tax);
}

// Declarative with map
const totals = orders.map(order => order.total * (1 + order.tax));
```

### filter — keep elements matching a predicate

```js
const pendingOrders  = orders.filter(o => o.status === 'PENDING');
const highValueOrders = orders.filter(o => o.total > 1000);
const activeUsers    = users.filter(u => !u.deletedAt);
```

### reduce — fold a list into a single value

The most powerful (and most misused) array method.

```js
// Sum
const total = orders.reduce((sum, order) => sum + order.total, 0);

// Group by
const byStatus = orders.reduce((acc, order) => {
  const key = order.status;
  acc[key] = acc[key] || [];
  acc[key].push(order);
  return acc;
}, {});
// { PENDING: [...], PAID: [...], SHIPPED: [...] }

// Index by ID
const byId = users.reduce((map, user) => {
  map[user.id] = user;
  return map;
}, {});
// { '1': { id: 1, name: '...' }, '2': { ... } }

// Flatten
const flat = [[1, 2], [3, 4], [5]].reduce((acc, arr) => [...acc, ...arr], []);
// [1, 2, 3, 4, 5]
// (or just use: arr.flat())

// Pipeline using reduce
const pipeline = [trim, toLower, removeSpecialChars];
const result = pipeline.reduce((value, fn) => fn(value), input);
```

### Chaining map, filter, reduce

```js
const result = orders
  .filter(o => o.status === 'PAID')
  .map(o => ({ ...o, total: o.total * (1 + o.tax) }))
  .reduce((sum, o) => sum + o.total, 0);

// total revenue from paid orders including tax
```

* * *

Currying
=========

**Currying** transforms a function that takes multiple arguments into a sequence of functions that each take one argument.

```js
// Normal function
function add(a, b) { return a + b; }
add(2, 3); // 5

// Curried version
function add(a) {
  return function(b) {
    return a + b;
  };
}

add(2)(3); // 5

const addFive = add(5); // partial application — returns a function
addFive(3);  // 8
addFive(10); // 15
```

### Real-world currying

```js
// Curried validation
const isGreaterThan = (min) => (value) => value > min;
const isLessThan    = (max) => (value) => value < max;
const equals        = (expected) => (value) => value === expected;

const isPositive  = isGreaterThan(0);
const isAdult     = isGreaterThan(17);
const isTeen      = (age) => isGreaterThan(12)(age) && isLessThan(20)(age);

[21, 15, 8, 17].filter(isAdult); // [21]
[21, 15, 8, 17].filter(isPositive); // [21, 15, 8, 17]

// Curried event handler factory
const handleEvent = (type) => (handler) => (event) => {
  if (event.type === type) handler(event);
};

const onClick = handleEvent('click');
button.addEventListener('click', onClick(handleSubmit));

// Curried API call
const makeRequest = (baseUrl) => (method) => (endpoint) => (data) =>
  fetch(`${baseUrl}${endpoint}`, { method, body: JSON.stringify(data) });

const api     = makeRequest('https://api.example.com');
const apiGet  = api('GET');
const apiPost = api('POST');

const getUser  = apiGet('/users');
const postOrder = apiPost('/orders');
```

* * *

Function Composition
=====================

Combining multiple functions where the output of one becomes the input of the next.

```js
// Manual composition (right to left — mathematical order)
const compose = (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x);

// Left to right (more readable)
const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);

// Example functions
const trim       = (str) => str.trim();
const toLower    = (str) => str.toLowerCase();
const removeSpaces = (str) => str.replace(/\s+/g, '-');
const addPrefix  = (str) => `slug-${str}`;

// Compose into a slug generator
const toSlug = pipe(trim, toLower, removeSpaces, addPrefix);

toSlug('  Hello World  '); // 'slug-hello-world'
```

### Real-world composition

```js
// Middleware-style composition
const validate   = (data) => { if (!data.email) throw new Error('Email required'); return data; };
const normalize  = (data) => ({ ...data, email: data.email.toLowerCase().trim() });
const enrich     = (data) => ({ ...data, createdAt: new Date() });
const sanitize   = (data) => ({ ...data, name: data.name?.replace(/<[^>]*>/g, '') });

const processUser = pipe(validate, normalize, sanitize, enrich);

const user = processUser({ name: '<b>Prajwal</b>', email: '  PRAJWAL@EXAMPLE.COM  ' });
// { name: 'Prajwal', email: 'prajwal@example.com', createdAt: Date }
```

* * *

Avoid Side Effects at the Edges
================================

Pure FP is impractical — you need I/O to do anything useful. The key is to **push side effects to the edges** of your system and keep the core logic pure.

```js
// Bad — side effects mixed into business logic
function processOrder(order) {
  console.log('Processing order', order.id);  // side effect
  db.save(order);                              // side effect
  const total = order.items.reduce(...)        // pure logic buried in side effects
  emailService.send(order.userId, total);      // side effect
  return total;
}

// Good — pure core, side effects at the boundary
// Pure functions (easy to test)
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function buildOrderRecord(order, total) {
  return { ...order, total, processedAt: new Date() };
}

// Side effects only in the orchestration layer
async function processOrder(order) {
  const total  = calculateTotal(order.items);      // pure
  const record = buildOrderRecord(order, total);    // pure

  await db.save(record);                            // side effect
  await emailService.send(order.userId, total);     // side effect

  return record;
}
```

* * *

Useful Functional Utilities
=============================

```js
// Identity — returns what it receives (useful as a default)
const identity = x => x;
[null, 1, undefined, 2, false, 3].filter(identity); // [1, 2, 3]

// Constant — always returns the same value
const constant = x => () => x;
const alwaysTrue = constant(true);
alwaysTrue(); // true
alwaysTrue(); // true

// tap — side effect without changing the value (logging in pipelines)
const tap = (fn) => (x) => { fn(x); return x; };

const processWithLogging = pipe(
  validate,
  tap(data => console.log('validated:', data)),
  normalize,
  tap(data => console.log('normalized:', data)),
  enrich,
);

// not — negate a predicate
const not = (fn) => (...args) => !fn(...args);
const isActive  = user => !user.deletedAt;
const isDeleted = not(isActive);

users.filter(isDeleted); // get deleted users
```

* * *

Interview definition (short answer)
=====================================

> "Functional programming in JS means: pure functions (same input → same output, no side effects), immutable data (create new objects instead of mutating), higher-order functions (map/filter/reduce), currying (partial application), and function composition (pipe/compose). Push side effects to the edges — keep core business logic pure and easily testable."
