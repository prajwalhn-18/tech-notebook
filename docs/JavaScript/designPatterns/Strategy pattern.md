---
sidebar_position: 1
---

## Strategy Pattern in TS

### Response:
The **Strategy Pattern** is one of the cleanest ways to remove `if/else` or `switch` hell in **Node.js + TypeScript**.

Think of it like this:

> “I have **multiple ways to do the same task**, and I want to **swap them dynamically**.”

* * *

What is Strategy Pattern?
=========================

It is a **behavioral design pattern** where:

*   you define a **common interface**
*   create **multiple implementations (strategies)**
*   choose one strategy at runtime

* * *

Real-world analogy
==================

Imagine a payment system:

*   Credit Card payment
*   UPI payment
*   PayPal payment

All of them do the same thing:

```
pay(amount)
```

But the **implementation differs**.

Instead of doing this:

```
if (paymentType === "upi") {
  // UPI logic
} else if (paymentType === "card") {
  // Card logic
} else if (paymentType === "paypal") {
  // PayPal logic
}
```

You use **Strategy Pattern**.

* * *

Structure
=========

It usually has 3 parts:

### 1\. **Strategy Interface**

Defines the common behavior.

### 2\. **Concrete Strategies**

Actual implementations.

### 3\. **Context**

The class that uses the strategy.

* * *

Example in Node.js + TypeScript
===============================

Problem: Different discount calculation strategies
--------------------------------------------------

* * *

1) Strategy Interface
---------------------

```
interface DiscountStrategy {
  calculate(price: number): number;
}
```

This says every discount strategy must implement:

```
calculate(price: number): number
```

* * *

2) Concrete Strategies
----------------------

### No Discount

```
class NoDiscountStrategy implements DiscountStrategy {
  calculate(price: number): number {
    return price;
  }
}
```

### Flat Discount

```
class FlatDiscountStrategy implements DiscountStrategy {
  constructor(private discountAmount: number) {}

  calculate(price: number): number {
    return price - this.discountAmount;
  }
}
```

### Percentage Discount

```
class PercentageDiscountStrategy implements DiscountStrategy {
  constructor(private percentage: number) {}

  calculate(price: number): number {
    return price - (price * this.percentage) / 100;
  }
}
```

* * *

3) Context Class
----------------

```
class PriceCalculator {
  constructor(private strategy: DiscountStrategy) {}

  setStrategy(strategy: DiscountStrategy) {
    this.strategy = strategy;
  }

  getFinalPrice(price: number): number {
    return this.strategy.calculate(price);
  }
}
```

This class **doesn’t care how the discount works**.

It only knows:

> “Give me any object that follows `DiscountStrategy`.”

* * *

4) Usage
--------

```
const calculator = new PriceCalculator(new NoDiscountStrategy());

console.log(calculator.getFinalPrice(1000)); // 1000

calculator.setStrategy(new FlatDiscountStrategy(200));
console.log(calculator.getFinalPrice(1000)); // 800

calculator.setStrategy(new PercentageDiscountStrategy(10));
console.log(calculator.getFinalPrice(1000)); // 900
```

* * *

Why this is useful
==================

Without Strategy Pattern:

```
function calculatePrice(type: string, price: number): number {
  if (type === "none") return price;
  if (type === "flat") return price - 200;
  if (type === "percentage") return price - price * 0.1;
  throw new Error("Invalid type");
}
```

This becomes ugly when logic grows.

* * *

Benefits
========

1\. **Open/Closed Principle**
-----------------------------

You can add new strategies **without modifying existing code**.

Example:

```
class FestivalDiscountStrategy implements DiscountStrategy {
  calculate(price: number): number {
    return price * 0.7;
  }
}
```

No need to touch old logic.

* * *

2\. **Removes giant conditionals**
----------------------------------

No huge `switch` blocks.

* * *

3\. **Easy to test**
--------------------

Each strategy can be unit tested separately.

* * *

4\. **Runtime flexibility**
---------------------------

You can switch behavior dynamically.

* * *

Real backend use cases in Node.js
=================================

This pattern is **very common in backend systems**.

* * *

1) Payment Gateway Selection
----------------------------

```
interface PaymentStrategy {
  pay(amount: number): Promise<void>;
}
```

### Razorpay Strategy

```
class RazorpayStrategy implements PaymentStrategy {
  async pay(amount: number): Promise<void> {
    console.log(`Processing ₹${amount} via Razorpay`);
  }
}
```

### Stripe Strategy

```
class StripeStrategy implements PaymentStrategy {
  async pay(amount: number): Promise<void> {
    console.log(`Processing ₹${amount} via Stripe`);
  }
}
```

### Context

```
class PaymentService {
  constructor(private strategy: PaymentStrategy) {}

  async checkout(amount: number) {
    await this.strategy.pay(amount);
  }
}
```

### Usage

```
const paymentService = new PaymentService(new RazorpayStrategy());
await paymentService.checkout(500);
```

* * *

2) Delivery Partner Selection
-----------------------------

Very relevant for logistics / Node backend systems.

```
interface DeliveryStrategy {
  createShipment(orderId: string): Promise<void>;
}
```

### Dunzo Strategy

```
class DunzoStrategy implements DeliveryStrategy {
  async createShipment(orderId: string): Promise<void> {
    console.log(`Creating shipment in Dunzo for ${orderId}`);
  }
}
```

### Shadowfax Strategy

```
class ShadowfaxStrategy implements DeliveryStrategy {
  async createShipment(orderId: string): Promise<void> {
    console.log(`Creating shipment in Shadowfax for ${orderId}`);
  }
}
```

### Context

```
class ShipmentService {
  constructor(private strategy: DeliveryStrategy) {}

  async ship(orderId: string) {
    await this.strategy.createShipment(orderId);
  }
}
```

### Usage

```
const shipmentService = new ShipmentService(new DunzoStrategy());
await shipmentService.ship("ORD123");
```

* * *

Best example for your kind of backend work
==========================================

If you’re dealing with:

*   multiple carriers
*   multiple OMS/WMS integrations
*   different CSV generators
*   different webhook handlers

then Strategy Pattern is **very useful**.

* * *

Practical Example: Carrier Integration in TypeScript
====================================================

Suppose you support:

*   Company
*   Porter
*   Shadowfax

Each carrier has different payload structure.

Instead of this:

```
if (carrier === "Company") {
  // build Company payload
} else if (carrier === "porter") {
  // build porter payload
} else if (carrier === "shadowfax") {
  // build shadowfax payload
}
```

Use Strategy Pattern.

* * *

Step 1: Define interface
------------------------

```
interface CarrierStrategy {
  createShipment(order: any): Promise<any>;
}
```

* * *

Step 2: Implement strategies
----------------------------

### Company

```
class CompanyStrategy implements CarrierStrategy {
  async createShipment(order: any): Promise<any> {
    return {
      provider: "Company",
      payload: {
        orderId: order.id,
        customerName: order.customerName,
      },
    };
  }
}
```

### Porter

```
class PorterStrategy implements CarrierStrategy {
  async createShipment(order: any): Promise<any> {
    return {
      provider: "Porter",
      payload: {
        shipment_id: order.id,
        name: order.customerName,
      },
    };
  }
}
```

### Shadowfax

```
class ShadowfaxStrategy implements CarrierStrategy {
  async createShipment(order: any): Promise<any> {
    return {
      provider: "Shadowfax",
      payload: {
        order_ref: order.id,
        recipient_name: order.customerName,
      },
    };
  }
}
```

* * *

Step 3: Context
---------------

```
class CarrierService {
  constructor(private strategy: CarrierStrategy) {}

  async createShipment(order: any) {
    return this.strategy.createShipment(order);
  }
}
```

* * *

Step 4: Strategy Factory (very common in Node.js)
-------------------------------------------------

Usually in backend apps, you choose strategy based on DB config / tenant / country / provider.

```
class CarrierFactory {
  static getStrategy(carrier: string): CarrierStrategy {
    switch (carrier) {
      case "Company":
        return new CompanyStrategy();
      case "porter":
        return new PorterStrategy();
      case "shadowfax":
        return new ShadowfaxStrategy();
      default:
        throw new Error(`Unsupported carrier: ${carrier}`);
    }
  }
}
```

* * *

Step 5: Usage
-------------

```
const order = {
  id: "ORD123",
  customerName: "Prajwal",
};

const strategy = CarrierFactory.getStrategy("porter");
const carrierService = new CarrierService(strategy);

const result = await carrierService.createShipment(order);
console.log(result);
```

### Output

```
{
  provider: 'Porter',
  payload: {
    shipment_id: 'ORD123',
    name: 'Prajwal'
  }
}
```

* * *

Folder structure in Node.js / TypeScript
========================================

A clean backend structure could be:

```
src/
  strategies/
    carrier/
      CarrierStrategy.ts
      CompanyStrategy.ts
      PorterStrategy.ts
      ShadowfaxStrategy.ts
      CarrierFactory.ts
  services/
    CarrierService.ts
  controllers/
    ShipmentController.ts
```

* * *

Clean production-style version
==============================

Here’s a **better production-ready structure**.

* * *

`CarrierStrategy.ts`
--------------------

```
export interface CarrierStrategy {
  createShipment(order: any): Promise<any>;
}
```

* * *

`CompanyStrategy.ts`
------------------

```
import { CarrierStrategy } from "./CarrierStrategy";

export class CompanyStrategy implements CarrierStrategy {
  async createShipment(order: any): Promise<any> {
    return {
      provider: "Company",
      payload: {
        orderId: order.id,
        customerName: order.customerName,
      },
    };
  }
}
```

* * *

`PorterStrategy.ts`
-------------------

```
import { CarrierStrategy } from "./CarrierStrategy";

export class PorterStrategy implements CarrierStrategy {
  async createShipment(order: any): Promise<any> {
    return {
      provider: "Porter",
      payload: {
        shipment_id: order.id,
        name: order.customerName,
      },
    };
  }
}
```

* * *

`ShadowfaxStrategy.ts`
----------------------

```
import { CarrierStrategy } from "./CarrierStrategy";

export class ShadowfaxStrategy implements CarrierStrategy {
  async createShipment(order: any): Promise<any> {
    return {
      provider: "Shadowfax",
      payload: {
        order_ref: order.id,
        recipient_name: order.customerName,
      },
    };
  }
}
```

* * *

`CarrierFactory.ts`
-------------------

```
import { CarrierStrategy } from "./CarrierStrategy";
import { CompanyStrategy } from "./CompanyStrategy";
import { PorterStrategy } from "./PorterStrategy";
import { ShadowfaxStrategy } from "./ShadowfaxStrategy";

export class CarrierFactory {
  static getStrategy(carrier: string): CarrierStrategy {
    switch (carrier.toLowerCase()) {
      case "Company":
        return new CompanyStrategy();
      case "porter":
        return new PorterStrategy();
      case "shadowfax":
        return new ShadowfaxStrategy();
      default:
        throw new Error(`Unsupported carrier: ${carrier}`);
    }
  }
}
```

* * *

`CarrierService.ts`
-------------------

```
import { CarrierStrategy } from "../strategies/carrier/CarrierStrategy";

export class CarrierService {
  constructor(private strategy: CarrierStrategy) {}

  async createShipment(order: any) {
    return this.strategy.createShipment(order);
  }
}
```

* * *

`index.ts`
----------

```
import { CarrierFactory } from "./strategies/carrier/CarrierFactory";
import { CarrierService } from "./services/CarrierService";

async function main() {
  const order = {
    id: "ORD123",
    customerName: "Prajwal",
  };

  const strategy = CarrierFactory.getStrategy("Company");
  const carrierService = new CarrierService(strategy);

  const result = await carrierService.createShipment(order);
  console.log(result);
}

main();
```

* * *

When to use Strategy Pattern
============================

Use it when:

*   you have **multiple interchangeable algorithms**
*   behavior changes based on:
    *   provider
    *   country
    *   tenant
    *   payment method
    *   carrier
    *   pricing logic
    *   file generation logic

* * *

When NOT to use it
==================

Do **not** use Strategy Pattern if:

*   you only have **1 or 2 very small conditions**
*   logic is too simple
*   abstraction makes code harder to read

Bad use:

```
if (isAdmin) {
  ...
} else {
  ...
}
```

Don’t create 12 classes for that. That’s design-pattern cosplay.

* * *

Strategy Pattern vs Factory Pattern
===================================

People often confuse them.

* * *

**Strategy Pattern**
--------------------

Focuses on **behavior**.

> “How should this task be performed?”

Example:

*   which payment logic?
*   which shipment logic?
*   which discount logic?

* * *

**Factory Pattern**
-------------------

Focuses on **object creation**.

> “Which object should I create?”

Example:

*   create `CompanyStrategy`
*   create `PorterStrategy`

* * *

### In real apps:

They are often used **together**.

*   **Factory** picks the correct strategy
*   **Strategy** performs the logic

* * *

Common advanced pattern in Node.js apps
=======================================

A very common production pattern is:

```
const strategy = strategyFactory.get(provider);
await strategy.execute(payload);
```

This is used in:

*   payment processors
*   notification channels (email / SMS / WhatsApp)
*   logistics integrations
*   tax calculation
*   pricing engines
*   rule engines
*   export generators (CSV/PDF/XML)

* * *

Very practical notification example
===================================

```
interface NotificationStrategy {
  send(message: string): Promise<void>;
}
```

### Email

```
class EmailStrategy implements NotificationStrategy {
  async send(message: string): Promise<void> {
    console.log("Sending Email:", message);
  }
}
```

### SMS

```
class SmsStrategy implements NotificationStrategy {
  async send(message: string): Promise<void> {
    console.log("Sending SMS:", message);
  }
}
```

### WhatsApp

```
class WhatsAppStrategy implements NotificationStrategy {
  async send(message: string): Promise<void> {
    console.log("Sending WhatsApp:", message);
  }
}
```

### Context

```
class NotificationService {
  constructor(private strategy: NotificationStrategy) {}

  async notify(message: string) {
    await this.strategy.send(message);
  }
}
```

* * *

Unit testing becomes easy
=========================

Example with Jest:

```
describe("FlatDiscountStrategy", () => {
  it("should subtract flat discount", () => {
    const strategy = new FlatDiscountStrategy(100);
    expect(strategy.calculate(1000)).toBe(900);
  });
});
```

Testing each strategy separately is very clean.

* * *

Interview definition (short answer)
===================================

If someone asks in interview:

> **What is Strategy Pattern?**

You can say:

> “Strategy Pattern is a behavioral design pattern that allows selecting an algorithm or behavior at runtime by encapsulating each implementation into separate classes behind a common interface.”

That’s the polished answer.

* * *

Best mental model
=================

If you see code like:

```
switch (provider) {
  case "x":
  case "y":
  case "z":
}
```

Ask yourself:

> “Can this become a strategy?”

A lot of backend integration code **should** become one.

* * *

Final takeaway
==============

### Use Strategy Pattern when:

*   same action
*   different implementations
*   chosen dynamically

### Formula:

```
Interface → Multiple Strategies → Context → Optional Factory
```