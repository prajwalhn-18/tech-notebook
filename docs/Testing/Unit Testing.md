---
sidebar_position: 2
---

## Unit Testing

Unit testing verifies that a **single piece of logic works correctly in isolation**. It's the fastest, cheapest feedback loop you have — running in milliseconds and pinpointing exactly which logic broke.

* * *

Setup with Jest
================

```bash
npm install --save-dev jest
```

```json
// package.json
{
  "scripts": {
    "test":         "jest",
    "test:watch":   "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/__tests__/**/*.js", "**/*.test.js"]
  }
}
```

For ES Modules:

```bash
npm install --save-dev jest @babel/core @babel/preset-env babel-jest
```

```js
// babel.config.js
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
```

* * *

Basic Test Structure
=====================

```js
// services/discountService.js
export function applyDiscount(price, discountPercent) {
  if (price < 0)             throw new Error('Price cannot be negative');
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount must be between 0 and 100');
  }
  return price * (1 - discountPercent / 100);
}
```

```js
// services/discountService.test.js
import { applyDiscount } from './discountService.js';

describe('applyDiscount', () => {
  test('applies percentage discount to price', () => {
    expect(applyDiscount(1000, 10)).toBe(900);
  });

  test('returns full price when discount is 0', () => {
    expect(applyDiscount(1000, 0)).toBe(1000);
  });

  test('returns 0 when discount is 100%', () => {
    expect(applyDiscount(1000, 100)).toBe(0);
  });

  test('throws when price is negative', () => {
    expect(() => applyDiscount(-100, 10)).toThrow('Price cannot be negative');
  });

  test('throws when discount exceeds 100', () => {
    expect(() => applyDiscount(1000, 150)).toThrow('Discount must be between 0 and 100');
  });
});
```

* * *

Common Assertions
==================

```js
// Equality
expect(result).toBe(42);              // strict equality (===)
expect(result).toEqual({ id: 1 });   // deep equality (for objects/arrays)

// Truthiness
expect(result).toBeTruthy();
expect(result).toBeFalsy();
expect(result).toBeNull();
expect(result).toBeUndefined();
expect(result).toBeDefined();

// Numbers
expect(result).toBeGreaterThan(0);
expect(result).toBeLessThanOrEqual(100);
expect(result).toBeCloseTo(0.3, 5);  // floating point comparison

// Strings
expect(str).toContain('shipped');
expect(str).toMatch(/^ORD-\d+$/);

// Arrays
expect(arr).toHaveLength(3);
expect(arr).toContain('admin');
expect(arr).toEqual(expect.arrayContaining(['a', 'b']));

// Objects
expect(obj).toHaveProperty('status', 'PENDING');
expect(obj).toMatchObject({ status: 'PENDING', userId: '42' }); // partial match

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrow('specific message');
expect(() => fn()).toThrow(ValidationError);

// Async
await expect(promise).resolves.toBe('value');
await expect(promise).rejects.toThrow('error message');
```

* * *

Testing Async Code
===================

```js
// Async/await
test('fetches user by id', async () => {
  const user = await userService.getById('42');
  expect(user.name).toBe('Prajwal');
});

// Async error
test('throws NotFoundError when user does not exist', async () => {
  await expect(userService.getById('999')).rejects.toThrow('User not found');
});

// Promise
test('resolves with user data', () => {
  return userService.getById('42').then(user => {
    expect(user.name).toBe('Prajwal');
  });
});
```

* * *

Mocking with Jest
==================

### Mock a module

```js
// emailService.js
export async function sendEmail(to, subject, body) {
  // real SMTP call
}
```

```js
// orderService.test.js
import { sendEmail } from './emailService.js';

jest.mock('./emailService.js'); // replaces all exports with jest.fn()

test('sends confirmation email after order is placed', async () => {
  sendEmail.mockResolvedValue({ sent: true }); // define return value

  await orderService.placeOrder(orderData);

  expect(sendEmail).toHaveBeenCalledWith(
    'user@example.com',
    'Order Confirmed',
    expect.stringContaining('ORD-123')
  );
});
```

### Mock specific functions

```js
jest.mock('./emailService.js', () => ({
  sendEmail:        jest.fn().mockResolvedValue({ sent: true }),
  sendCancellation: jest.fn().mockResolvedValue({ sent: true }),
}));
```

### Mock a class

```js
jest.mock('./PaymentGateway.js');

import { PaymentGateway } from './PaymentGateway.js';

// All methods are auto-mocked to jest.fn()
PaymentGateway.prototype.charge.mockResolvedValue({ transactionId: 'txn_123' });
```

* * *

Dependency Injection makes mocking easy
=========================================

Design classes to accept dependencies — then tests can inject fakes instead of mocking modules.

```js
// Good — injectable dependencies
class OrderService {
  constructor(orderRepo, emailService, paymentService) {
    this.orderRepo      = orderRepo;
    this.emailService   = emailService;
    this.paymentService = paymentService;
  }

  async placeOrder(userId, items) {
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const order = await this.orderRepo.create({ userId, items, total });
    await this.emailService.sendConfirmation(userId, order.id);
    return order;
  }
}
```

```js
// Test — inject mocks directly, no jest.mock() needed
test('creates order and sends confirmation email', async () => {
  const mockRepo = {
    create: jest.fn().mockResolvedValue({ id: 'ORD-1', userId: '42', total: 500 }),
  };
  const mockEmail = {
    sendConfirmation: jest.fn().mockResolvedValue(undefined),
  };

  const service = new OrderService(mockRepo, mockEmail, {});
  const order = await service.placeOrder('42', [{ price: 500, qty: 1 }]);

  expect(order.id).toBe('ORD-1');
  expect(mockEmail.sendConfirmation).toHaveBeenCalledWith('42', 'ORD-1');
});
```

No module mocking, no magic — just objects passed in.

* * *

Setup and Teardown
===================

```js
describe('UserService', () => {
  let service;
  let repo;

  beforeAll(() => {
    // Runs once before all tests in this describe block
    // Good for: DB connections, external service setup
    console.log('Starting UserService tests');
  });

  afterAll(() => {
    // Runs once after all tests
    // Good for: closing connections, cleanup
  });

  beforeEach(() => {
    // Runs before each test
    // Good for: resetting mocks, creating fresh instances
    repo = new InMemoryUserRepository();
    service = new UserService(repo);
    jest.clearAllMocks(); // reset mock call counts
  });

  afterEach(() => {
    // Runs after each test
    // Good for: cleaning DB, restoring spies
    jest.restoreAllMocks();
  });

  test('...', () => { ... });
});
```

* * *

Snapshot Testing
=================

Captures the output of a function and alerts you when it changes.

```js
test('generates correct invoice HTML', () => {
  const html = generateInvoice({ orderId: 'ORD-1', total: 1000 });
  expect(html).toMatchSnapshot();
});
```

First run: Jest saves the output to a `__snapshots__` file.
Future runs: Jest compares output to saved snapshot.

**When to use:** Serialization output, HTML templates, complex data transformations.
**When NOT to use:** Dynamic data (timestamps, random IDs). Use `expect.any(String)` instead.

```js
// For dynamic data in snapshots
expect(order).toMatchObject({
  id: expect.any(String),
  createdAt: expect.any(Date),
  total: 1000,
});
```

* * *

Testing Error Scenarios
========================

Don't just test the happy path. Error paths are where bugs hide.

```js
describe('OrderService.placeOrder', () => {
  test('throws InsufficientStockError when product is out of stock', async () => {
    mockInventory.check.mockResolvedValue({ available: 0 });

    await expect(
      service.placeOrder('user1', [{ productId: 'P1', qty: 5 }])
    ).rejects.toThrow('Insufficient stock for product P1');
  });

  test('does not charge payment if inventory check fails', async () => {
    mockInventory.check.mockRejectedValue(new Error('Inventory service unavailable'));

    await expect(service.placeOrder('user1', items)).rejects.toThrow();

    // Payment should NOT have been attempted
    expect(mockPayment.charge).not.toHaveBeenCalled();
  });

  test('rolls back order if payment fails', async () => {
    mockPayment.charge.mockRejectedValue(new Error('Card declined'));

    await expect(service.placeOrder('user1', items)).rejects.toThrow('Card declined');

    // Order should be cleaned up
    const order = await mockRepo.findByUserId('user1');
    expect(order).toHaveLength(0);
  });
});
```

* * *

Parameterized Tests
====================

Test the same behavior with multiple inputs without repeating test code.

```js
describe('applyDiscount', () => {
  test.each([
    [1000, 0,   1000],
    [1000, 10,  900],
    [1000, 25,  750],
    [1000, 50,  500],
    [1000, 100, 0],
  ])('price %d with %d%% discount returns %d', (price, discount, expected) => {
    expect(applyDiscount(price, discount)).toBe(expected);
  });
});

// Or with objects for readability
test.each([
  { price: 1000, discount: 10,  expected: 900,  label: '10% off' },
  { price: 500,  discount: 20,  expected: 400,  label: '20% off' },
  { price: 200,  discount: 50,  expected: 100,  label: '50% off' },
])('$label: applies correctly', ({ price, discount, expected }) => {
  expect(applyDiscount(price, discount)).toBe(expected);
});
```

* * *

Real-world unit test example
==============================

```js
// services/orderService.js
export class OrderService {
  constructor({ orderRepo, inventoryService, paymentService, emailService }) {
    this.orderRepo        = orderRepo;
    this.inventoryService = inventoryService;
    this.paymentService   = paymentService;
    this.emailService     = emailService;
  }

  async placeOrder(userId, items) {
    // Check inventory
    for (const item of items) {
      const stock = await this.inventoryService.getStock(item.productId);
      if (stock < item.qty) {
        throw new Error(`Insufficient stock for ${item.productId}`);
      }
    }

    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const order = await this.orderRepo.create({ userId, items, total, status: 'PENDING' });

    await this.paymentService.charge(userId, total);
    await this.orderRepo.update(order.id, { status: 'PAID' });
    await this.emailService.sendConfirmation(userId, order.id);

    return order;
  }
}
```

```js
// services/orderService.test.js
import { OrderService } from './orderService.js';

describe('OrderService.placeOrder', () => {
  let service;
  let deps;

  const items = [{ productId: 'P1', price: 100, qty: 2 }];

  beforeEach(() => {
    deps = {
      orderRepo: {
        create: jest.fn().mockResolvedValue({ id: 'ORD-1', status: 'PENDING' }),
        update: jest.fn().mockResolvedValue({ id: 'ORD-1', status: 'PAID' }),
      },
      inventoryService: {
        getStock: jest.fn().mockResolvedValue(10),
      },
      paymentService: {
        charge: jest.fn().mockResolvedValue({ transactionId: 'txn_123' }),
      },
      emailService: {
        sendConfirmation: jest.fn().mockResolvedValue(undefined),
      },
    };

    service = new OrderService(deps);
  });

  test('creates order and charges correct total', async () => {
    await service.placeOrder('user1', items);

    expect(deps.orderRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user1', total: 200 })
    );
    expect(deps.paymentService.charge).toHaveBeenCalledWith('user1', 200);
  });

  test('marks order as PAID after successful payment', async () => {
    await service.placeOrder('user1', items);

    expect(deps.orderRepo.update).toHaveBeenCalledWith(
      'ORD-1', { status: 'PAID' }
    );
  });

  test('sends confirmation email after order is placed', async () => {
    await service.placeOrder('user1', items);

    expect(deps.emailService.sendConfirmation).toHaveBeenCalledWith('user1', 'ORD-1');
  });

  test('throws when product is out of stock', async () => {
    deps.inventoryService.getStock.mockResolvedValue(0);

    await expect(service.placeOrder('user1', items))
      .rejects.toThrow('Insufficient stock for P1');
  });

  test('does not charge payment when inventory check fails', async () => {
    deps.inventoryService.getStock.mockResolvedValue(0);

    await expect(service.placeOrder('user1', items)).rejects.toThrow();
    expect(deps.paymentService.charge).not.toHaveBeenCalled();
  });
});
```

* * *

Interview definition (short answer)
=====================================

> "Unit tests verify isolated business logic using injected fakes or mocks for dependencies. They should test behavior through the public API, cover happy paths and error cases, and run in milliseconds. The goal is confidence in logic, not coverage numbers."
