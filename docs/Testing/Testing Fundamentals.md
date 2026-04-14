---
sidebar_position: 1
---

## Testing Fundamentals

Testing is not about achieving 100% coverage. It's about **confidence** — shipping code knowing it does what it's supposed to do, and that future changes won't silently break existing behavior.

* * *

Why Test?
=========

*   **Safety net for refactoring** — change internal implementation without fear
*   **Living documentation** — tests describe how code is supposed to behave
*   **Faster debugging** — a failing test tells you exactly what broke and where
*   **Design pressure** — hard-to-test code is usually poorly designed
*   **Confidence in deploys** — CI catches regressions before production

* * *

The Testing Pyramid
====================

```
          /\
         /  \
        / E2E \          ← Few, slow, expensive, high confidence
       /────────\
      / Integration\     ← Some, moderate speed, catch integration bugs
     /──────────────\
    /   Unit Tests   \   ← Many, fast, cheap, catch logic bugs
   /──────────────────\
```

### Unit Tests (base — majority of tests)

*   Test a single function or class in isolation
*   All dependencies are mocked/stubbed
*   Run in milliseconds
*   Hundreds or thousands in a codebase

### Integration Tests (middle)

*   Test multiple components working together
*   May use real database, real Redis, real file system
*   Slower (seconds), but catch contract bugs between layers
*   Dozens to low hundreds

### E2E Tests (top)

*   Test the entire system from the outside (HTTP request → DB → HTTP response)
*   Slowest, most brittle, most expensive to maintain
*   A few dozen for critical paths (checkout, login, signup)

* * *

What to Test
=============

### Test behavior, not implementation

The test should describe **what the code does**, not **how it does it**. Tests that couple to implementation break every refactor.

```js
// Bad — tests implementation details
test('calls _processPaymentInternal with correct params', () => {
  const spy = jest.spyOn(service, '_processPaymentInternal');
  service.pay(order);
  expect(spy).toHaveBeenCalledWith(order.id, order.total);
});

// Good — tests observable behavior
test('returns success when payment is processed', async () => {
  const result = await service.pay(order);
  expect(result.status).toBe('SUCCESS');
  expect(result.transactionId).toBeDefined();
});
```

### Test the contract, not the internals

```js
// Bad — tests the internal structure of an object
expect(user._data.profile.name).toBe('Prajwal');

// Good — tests the public API
expect(user.getName()).toBe('Prajwal');
```

### What's worth testing

| Worth testing | Not worth testing |
|---|---|
| Business logic and rules | Simple getters/setters |
| Edge cases and boundaries | Framework code |
| Error and exception paths | Third-party library internals |
| Integration between components | Generated code |
| Critical user flows | One-line wrappers |

* * *

The AAA Pattern
================

Every test follows three phases:

```js
test('applies percentage discount correctly', () => {
  // Arrange — set up the scenario
  const strategy = new PercentageDiscountStrategy(10);
  const price = 1000;

  // Act — call the thing under test
  const result = strategy.calculate(price);

  // Assert — verify the outcome
  expect(result).toBe(900);
});
```

Keep each phase visually separated. A test that needs a 50-line `Arrange` section is testing too much.

* * *

Test Naming
============

Test names are **documentation**. They should tell you exactly what failed when a test breaks.

```js
// Bad — vague, tells you nothing when it fails
test('works correctly')
test('handles edge case')
test('user test')

// Good — describes the scenario and expected outcome
test('applies 10% discount to base price')
test('throws NotFoundError when order does not exist')
test('returns empty array when user has no orders')
test('does not charge card when inventory is insufficient')
```

Pattern: **"[action/condition] [expected result]"**

```js
describe('OrderService', () => {
  describe('placeOrder', () => {
    test('creates order with PENDING status', ...)
    test('reduces inventory by order quantity', ...)
    test('throws InsufficientInventoryError when stock is 0', ...)
    test('sends confirmation email after successful creation', ...)
  });

  describe('shipOrder', () => {
    test('updates order status to SHIPPED', ...)
    test('throws InvalidStateError when order is not PAID', ...)
  });
});
```

When `OrderService > placeOrder > throws InsufficientInventoryError when stock is 0` fails, you know exactly what broke.

* * *

Test Isolation
===============

Tests must not depend on each other. Each test should start from a clean state and be runnable in any order.

### Reset state between tests

```js
describe('UserService', () => {
  let userRepo;
  let userService;

  beforeEach(() => {
    // Fresh instance for each test
    userRepo    = new InMemoryUserRepository();
    userService = new UserService(userRepo);
  });

  test('creates a user with hashed password', async () => {
    const user = await userService.register({ email: 'a@b.com', password: 'secret' });
    expect(user.password).not.toBe('secret');
  });

  test('throws when email already exists', async () => {
    await userService.register({ email: 'a@b.com', password: 'secret' });
    await expect(
      userService.register({ email: 'a@b.com', password: 'other' })
    ).rejects.toThrow('Email already registered');
  });
});
```

`beforeEach` creates a fresh repo for every test — no shared state.

### Test-only databases

For integration tests that hit a real DB:

```js
beforeAll(async () => {
  await db.migrate.latest();    // run migrations
});

beforeEach(async () => {
  await db.seed.run();          // seed fresh data
});

afterEach(async () => {
  await db('orders').truncate(); // clean up
  await db('users').truncate();
});

afterAll(async () => {
  await db.destroy();           // close connection
});
```

* * *

Test Doubles
=============

When you don't want to use real dependencies in a unit test.

### Stub — returns canned data

```js
const emailService = {
  sendWelcome: jest.fn().mockResolvedValue({ sent: true }),
};
```

### Mock — also verifies calls

```js
const emailService = {
  sendWelcome: jest.fn(),
};

// After the test:
expect(emailService.sendWelcome).toHaveBeenCalledWith(
  expect.objectContaining({ email: 'user@test.com' })
);
```

### Spy — wraps real implementation

```js
const spy = jest.spyOn(emailService, 'sendWelcome');
// Real implementation still runs, but calls are tracked
```

### Fake — working but simplified implementation

```js
// InMemoryOrderRepository is a fake — it works like the real one
// but stores data in memory instead of a database
class InMemoryOrderRepository {
  #orders = new Map();

  async findById(id) {
    return this.#orders.get(id) || null;
  }

  async create(order) {
    const id = String(Date.now());
    this.#orders.set(id, { ...order, id });
    return this.#orders.get(id);
  }
}
```

**When to use each:**

| Double | Use when |
|---|---|
| Stub | You need a dependency to return specific data |
| Mock | You need to verify a dependency was called correctly |
| Spy | You want to observe calls on a real implementation |
| Fake | The real implementation is too slow/complex (DB, external API) |

* * *

What Makes a Good Test
========================

```
F — Fast          Runs in milliseconds. Slow tests don't get run.
I — Isolated      No shared state. Run in any order.
R — Repeatable    Same result every time, regardless of environment.
S — Self-checking Passes or fails clearly — no manual inspection.
T — Timely        Written alongside the code, not after.
```

* * *

Testing Anti-Patterns
======================

### Testing implementation details

```js
// Bad — breaks on any internal refactor
expect(service.cache).toHaveProperty('user:42');
expect(service._internalState).toBe('ready');
```

### Asserting too much in one test

```js
// Bad — if it fails, which assertion caused it?
test('order processing', async () => {
  const order = await service.process(orderData);
  expect(order.status).toBe('COMPLETE');
  expect(order.total).toBe(1000);
  expect(emailSpy).toHaveBeenCalled();
  expect(inventorySpy).toHaveBeenCalledWith('PROD1', -2);
  expect(order.shipment.trackingId).toBeDefined();
  // 10 more assertions...
});

// Better — one behavior per test
test('sets order status to COMPLETE', ...)
test('calculates correct total', ...)
test('sends confirmation email', ...)
```

### Testing the wrong thing

```js
// Bad — tests that Axios was called, not that the behavior is correct
test('makes HTTP request to payment API', () => {
  const spy = jest.spyOn(axios, 'post');
  service.charge(order);
  expect(spy).toHaveBeenCalled(); // Who cares HOW — test WHAT
});

// Good — tests the observable outcome
test('returns transaction ID on successful charge', async () => {
  const result = await service.charge(order);
  expect(result.transactionId).toMatch(/^txn_/);
});
```

### Ignoring test maintenance

Tests that are never updated become liabilities. When tests fail and developers just delete them or mark `test.skip`, the test suite loses value. Treat test code with the same care as production code.

* * *

Code Coverage
==============

Coverage measures **what percentage of your code is executed by tests**. It's a useful metric but a poor goal.

```bash
jest --coverage
```

| Coverage % | Reality |
|---|---|
| 100% | Can still have bugs — coverage doesn't test correctness |
| 80% | Good for most applications |
| 60% | Acceptable for legacy codebases |
| < 40% | You have no safety net |

**Aim for high coverage on:**
- Business logic / domain layer
- Utility functions
- Error handling paths

**Don't stress about:**
- Boilerplate (config files, DI wiring)
- Generated code
- Simple getters/setters

> "100% code coverage with bad tests gives you false confidence. 70% coverage with meaningful tests gives you real confidence."

* * *

Test-Driven Development (TDD)
===============================

Write the test **before** the code.

```
Red → Green → Refactor

1. Write a failing test (Red)
2. Write the minimum code to make it pass (Green)
3. Refactor the code while keeping tests green
```

```js
// Step 1: Write failing test
test('calculates order total with tax', () => {
  const total = calculateTotal([
    { price: 100, qty: 2 },
    { price: 50,  qty: 1 },
  ], { taxRate: 0.18 });

  expect(total).toBe(295); // (200 + 50) * 1.18
});

// Step 2: Write minimum code
function calculateTotal(items, { taxRate }) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  return subtotal * (1 + taxRate);
}

// Step 3: Refactor if needed
```

**Benefits of TDD:**
- Forces you to think about the interface before implementation
- Results in naturally testable code
- Prevents over-engineering (you only write what the test requires)

**Where TDD works best:** Business logic, algorithms, utility functions.
**Where it's harder:** UI, exploratory features, unknown domains.

* * *

Interview definition (short answer)
=====================================

> "Good testing means: unit tests for business logic using fakes, integration tests for component contracts, and E2E tests for critical paths. Tests should test behavior not implementation, be isolated, fast, and maintained like production code. Coverage is a metric, not a goal."
