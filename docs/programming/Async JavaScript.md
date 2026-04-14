---
sidebar_position: 5
---

## Async JavaScript

JavaScript is single-threaded. It can only do one thing at a time. Async programming is how it handles I/O (network, file system, timers) without blocking — by scheduling callbacks to run when operations complete.

Understanding async JavaScript deeply is non-negotiable for backend and frontend engineers.

* * *

Callbacks — The Foundation
============================

The original async pattern. Pass a function to be called when the operation completes.

```js
const fs = require('fs');

fs.readFile('data.txt', 'utf8', function(err, data) {
  if (err) {
    console.error('Error:', err);
    return;
  }
  console.log(data);
});

console.log('This runs first'); // sync code runs before the callback
```

### Callback Hell

```js
// Deeply nested callbacks — hard to read, hard to handle errors
getUser(userId, function(err, user) {
  if (err) return handleError(err);

  getOrders(user.id, function(err, orders) {
    if (err) return handleError(err);

    getOrderItems(orders[0].id, function(err, items) {
      if (err) return handleError(err);

      getProductDetails(items[0].productId, function(err, product) {
        if (err) return handleError(err);
        // finally do something with product...
      });
    });
  });
});
```

Problems: deeply nested, error handling repeated at every level, hard to reason about, hard to add parallel operations.

* * *

Promises
=========

A Promise is an object representing the **eventual completion or failure** of an async operation.

### Three states

```
pending  → the operation is still in progress
fulfilled → the operation succeeded (has a value)
rejected  → the operation failed (has a reason/error)
```

A promise transitions from `pending` to either `fulfilled` or `rejected` — exactly once, permanently.

### Creating promises

```js
const promise = new Promise((resolve, reject) => {
  // async operation
  setTimeout(() => {
    const success = true;
    if (success) {
      resolve('Operation succeeded'); // fulfills the promise
    } else {
      reject(new Error('Operation failed')); // rejects the promise
    }
  }, 1000);
});
```

### Consuming promises

```js
promise
  .then(value => console.log(value))  // runs on fulfill
  .catch(err => console.error(err))    // runs on reject
  .finally(() => console.log('done')); // runs always
```

### Promise chaining — replacing callback hell

```js
getUser(userId)
  .then(user => getOrders(user.id))        // each .then returns a new promise
  .then(orders => getOrderItems(orders[0].id))
  .then(items => getProductDetails(items[0].productId))
  .then(product => console.log(product))
  .catch(err => handleError(err));         // one catch handles all errors
```

### Returning values in .then chains

```js
fetchUser(id)
  .then(user => {
    // Transform the value — return it, and next .then gets it
    return { ...user, fullName: `${user.firstName} ${user.lastName}` };
  })
  .then(user => {
    // user here is the transformed object
    return fetchOrders(user.id);
  })
  .then(orders => {
    console.log(orders);
  });
```

If you return a promise from `.then`, the chain waits for it to resolve.

* * *

async / await
==============

Syntactic sugar over promises — makes async code look and behave like synchronous code.

```js
// Promise chain
function getOrderDetails(orderId) {
  return getOrder(orderId)
    .then(order => getUser(order.userId))
    .then(user => ({ order, user }))
    .catch(err => { throw err; });
}

// async/await equivalent — same behavior, much cleaner
async function getOrderDetails(orderId) {
  const order = await getOrder(orderId);  // pauses until promise resolves
  const user  = await getUser(order.userId);
  return { order, user };
}
```

`await` can only be used inside an `async` function. An `async` function always returns a promise.

### Error handling

```js
async function processOrder(orderId) {
  try {
    const order = await getOrder(orderId);
    const payment = await processPayment(order);
    await sendConfirmation(order.userId, payment.id);
    return { success: true, paymentId: payment.id };
  } catch (err) {
    // Catches any rejection from any awaited promise
    logger.error('Order processing failed', { orderId, err: err.message });
    throw err; // rethrow so the caller knows it failed
  }
}
```

* * *

Promise Combinators — Running Async Operations Together
========================================================

### Promise.all — all must succeed

Runs multiple promises concurrently. Resolves when **all** resolve. Rejects immediately if **any** rejects.

```js
// Sequential — slow (waits for each before starting next)
const user    = await getUser(userId);
const orders  = await getOrders(userId);
const profile = await getProfile(userId);

// Parallel — fast (all start at the same time)
const [user, orders, profile] = await Promise.all([
  getUser(userId),
  getOrders(userId),
  getProfile(userId),
]);
```

**When one rejects, all fail:**

```js
try {
  const [a, b] = await Promise.all([
    fetchA(),
    fetchB(), // if this rejects...
  ]);
} catch (err) {
  // ...we catch here, even if fetchA succeeded
}
```

### Promise.allSettled — wait for all, handle each result

Resolves when **all** promises settle (resolve OR reject). Returns an array of outcome objects.

```js
const results = await Promise.allSettled([
  fetchUser(1),
  fetchUser(2),
  fetchUser(999), // doesn't exist — will reject
]);

results.forEach(result => {
  if (result.status === 'fulfilled') {
    console.log('Got user:', result.value);
  } else {
    console.error('Failed:', result.reason);
  }
});
```

Use when: you want to attempt multiple operations and handle each outcome individually — not abort if one fails.

### Promise.race — first one wins

Resolves or rejects with the outcome of the **first** settled promise.

```js
// Timeout pattern
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

const result = await withTimeout(fetchUser(id), 5000);
```

### Promise.any — first success wins

Resolves with the **first fulfilled** promise. Rejects only if **all** reject.

```js
// Try multiple CDNs — use whichever responds first
const resource = await Promise.any([
  fetch('https://cdn1.example.com/file.js'),
  fetch('https://cdn2.example.com/file.js'),
  fetch('https://cdn3.example.com/file.js'),
]);
```

* * *

Common async/await Patterns
=============================

### Running async operations in a loop

```js
const orderIds = ['ORD1', 'ORD2', 'ORD3'];

// Sequential — each awaits the previous (use when order matters or rate limiting)
for (const id of orderIds) {
  await processOrder(id);
}

// Parallel — all start at once (use when they're independent)
await Promise.all(orderIds.map(id => processOrder(id)));

// Parallel with concurrency limit (e.g., max 3 at once)
async function mapWithConcurrency(items, fn, concurrency = 3) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

await mapWithConcurrency(orderIds, processOrder, 3);
```

### Async IIFE (top-level await alternative)

```js
// When top-level await is not available
(async () => {
  const config = await loadConfig();
  const db = await connectToDatabase(config.dbUrl);
  // ...
})();

// Modern: top-level await in ES modules
const config = await loadConfig();
```

### Converting callbacks to promises

```js
// Manual promisification
function readFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

// Built-in: util.promisify
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const data = await readFile('file.txt', 'utf8');

// Or use fs.promises directly
const data = await fs.promises.readFile('file.txt', 'utf8');
```

* * *

Error Handling Patterns
========================

### Don't swallow errors

```js
// Bad — error silently disappears
async function getUser(id) {
  try {
    return await db.users.find(id);
  } catch (err) {
    // nothing here — caller has no idea it failed
  }
}

// Good — rethrow or transform
async function getUser(id) {
  try {
    return await db.users.find(id);
  } catch (err) {
    throw new NotFoundError('User', id); // transform to domain error
  }
}
```

### Result type pattern (no-throw)

```js
// Instead of try/catch everywhere, return [error, result]
async function safeAsync(promise) {
  try {
    const result = await promise;
    return [null, result];
  } catch (err) {
    return [err, null];
  }
}

const [err, user] = await safeAsync(getUser(id));
if (err) return res.status(404).json({ error: err.message });
```

### Unhandled promise rejections

```js
// Always handle rejections — unhandled ones crash the process in Node 15+
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// In Express, wrap async handlers
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
```

* * *

Async Iterators
================

Iterate over values that arrive asynchronously (streams, paginated APIs, database cursors).

```js
async function* fetchPages(url) {
  let nextUrl = url;

  while (nextUrl) {
    const response = await fetch(nextUrl);
    const data = await response.json();

    yield data.items; // yield the current page

    nextUrl = data.nextPageUrl; // null when done
  }
}

// Consume with for await...of
for await (const page of fetchPages('https://api.example.com/orders')) {
  for (const order of page) {
    await processOrder(order);
  }
}
```

```js
// Node.js readable streams are async iterables
const fs = require('fs');

async function processLargeFile(path) {
  const stream = fs.createReadStream(path, { encoding: 'utf8' });

  for await (const chunk of stream) {
    process(chunk);
  }
}
```

* * *

Interview definition (short answer)
=====================================

> "JavaScript's async model is callback-based under the hood, with Promises providing composable chaining and error handling, and async/await providing synchronous-looking syntax over Promises. `Promise.all` runs in parallel and fails fast; `Promise.allSettled` waits for all and handles each; `Promise.race` takes the first settler; `Promise.any` takes the first success. Never swallow errors in catch blocks — always rethrow or transform them."
