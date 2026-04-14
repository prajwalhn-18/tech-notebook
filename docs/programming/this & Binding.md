---
sidebar_position: 3
---

## `this` & Binding

`this` is the most confusing part of JavaScript for most developers. Unlike other languages where `this` refers to the class instance, in JavaScript `this` is determined **at call time**, not at definition time — except for arrow functions.

* * *

What is `this`?
================

`this` refers to the **execution context** — the object that is currently executing the code. Its value depends on **how** a function is called, not where it's defined.

There are 4 binding rules (+ arrow functions).

* * *

Rule 1: Default Binding
========================

When a function is called as a plain function (not as a method), `this` is the global object (`window` in browsers, `global` in Node.js). In strict mode, `this` is `undefined`.

```js
function show() {
  console.log(this);
}

show(); // global object (or undefined in strict mode)
```

```js
'use strict';
function show() {
  console.log(this); // undefined
}
show();
```

* * *

Rule 2: Implicit Binding
=========================

When a function is called as a method of an object, `this` is that object.

```js
const user = {
  name: 'Prajwal',
  greet() {
    console.log(`Hello, ${this.name}`);
  },
};

user.greet(); // 'Hello, Prajwal' — this = user
```

### Implicit binding loss — the most common bug

```js
const user = {
  name: 'Prajwal',
  greet() {
    console.log(`Hello, ${this.name}`);
  },
};

const fn = user.greet; // extract the method
fn();                  // 'Hello, undefined' — this is now global, not user

// This happens everywhere:
setTimeout(user.greet, 100);     // this = global, not user
['click'].forEach(user.greet);   // this = global
```

The function reference is extracted from the object — the binding is lost.

* * *

Rule 3: Explicit Binding
=========================

Use `call`, `apply`, or `bind` to explicitly set `this`.

### call — invoke immediately, args as list

```js
function greet(greeting, punctuation) {
  console.log(`${greeting}, ${this.name}${punctuation}`);
}

const user = { name: 'Prajwal' };

greet.call(user, 'Hello', '!'); // 'Hello, Prajwal!'
```

### apply — invoke immediately, args as array

```js
greet.apply(user, ['Hello', '!']); // 'Hello, Prajwal!'

// Useful for spreading arrays into functions
Math.max.apply(null, [1, 5, 3, 9, 2]); // 9
// (today you'd use: Math.max(...[1, 5, 3, 9, 2]))
```

### bind — returns a new function with `this` permanently set

```js
const boundGreet = greet.bind(user, 'Hello');
boundGreet('!');   // 'Hello, Prajwal!'
boundGreet('???'); // 'Hello, Prajwal???'

// Fix the implicit binding loss problem
const fn = user.greet.bind(user);
setTimeout(fn, 100); // 'Hello, Prajwal' — correctly bound
```

### Practical bind usage

```js
class Timer {
  constructor() {
    this.count = 0;
    // Without bind, `this` inside tick() would be undefined in strict mode
    this.tick = this.tick.bind(this);
  }

  tick() {
    this.count++;
    console.log(this.count);
  }

  start() {
    setInterval(this.tick, 1000);
  }
}
```

* * *

Rule 4: new Binding
====================

When a function is called with `new`, `this` is the newly created object.

```js
function Person(name) {
  this.name = name;         // this = newly created object
  this.greet = function() {
    console.log(`Hi, I'm ${this.name}`);
  };
}

const p = new Person('Prajwal');
p.greet(); // 'Hi, I'm Prajwal'
```

What `new` does internally:
1. Creates a new empty object
2. Sets its `__proto__` to `Person.prototype`
3. Calls the function with `this` = that new object
4. Returns the new object (unless the function explicitly returns another object)

* * *

Rule 5: Arrow Functions — Lexical `this`
==========================================

Arrow functions do **not** have their own `this`. They inherit `this` from the enclosing **lexical** scope at the time they are **defined**.

```js
const obj = {
  name: 'Prajwal',

  regular: function() {
    console.log(this.name); // 'Prajwal' — this = obj (implicit binding)
  },

  arrow: () => {
    console.log(this.name); // undefined — arrow captures this from module/global scope
  },

  withArrowInside: function() {
    const inner = () => {
      console.log(this.name); // 'Prajwal' — arrow inherits this from withArrowInside
    };
    inner();
  },
};

obj.regular();       // 'Prajwal'
obj.arrow();         // undefined
obj.withArrowInside(); // 'Prajwal'
```

### Why arrow functions solve callback `this` problems

```js
class DataFetcher {
  constructor(url) {
    this.url = url;
    this.results = [];
  }

  // Problem with regular function
  fetchRegular() {
    fetch(this.url).then(function(response) {
      this.results = response; // ❌ TypeError: this is undefined (strict mode)
    });
  }

  // Solution with arrow function
  fetchArrow() {
    fetch(this.url).then((response) => {
      this.results = response; // ✅ this is the DataFetcher instance
    });
  }

  // Old solution with bind
  fetchBound() {
    fetch(this.url).then(function(response) {
      this.results = response;
    }.bind(this)); // ✅ but verbose
  }
}
```

* * *

Binding Priority
=================

When multiple rules apply, the priority order is:

```
1. new binding          (highest)
2. Explicit (call/apply/bind)
3. Implicit (method call)
4. Default              (lowest)

Arrow functions: none of the above — lexical this, cannot be overridden
```

```js
function fn() { console.log(this.x); }

const obj1 = { x: 1, fn };
const obj2 = { x: 2 };

obj1.fn();             // 1 — implicit
obj1.fn.call(obj2);    // 2 — explicit wins over implicit
const bound = obj1.fn.bind(obj2);
new bound();           // undefined — new wins over bind (this = new object, no x property)
```

You **cannot** change `this` in an arrow function:

```js
const arrow = () => console.log(this);
arrow.call({ x: 99 }); // still logs global this — call has no effect on arrows
arrow.bind({ x: 99 })(); // same — bind has no effect
```

* * *

`this` in Classes
==================

In class methods, `this` behaves like implicit binding — it's the instance when called as a method.

```js
class Counter {
  #count = 0;

  increment() {
    this.#count++;
  }

  getValue() {
    return this.#count;
  }
}

const c = new Counter();
c.increment(); // this = c ✅

// But loses binding when extracted
const { increment } = c;
increment(); // TypeError: Cannot read private member — this is not a Counter instance
```

**Fix: class fields with arrow functions (bind at definition time)**

```js
class Counter {
  #count = 0;

  // Arrow function as class field — `this` is always the instance
  increment = () => {
    this.#count++;
  };

  getValue = () => this.#count;
}

const c = new Counter();
const { increment } = c;
increment(); // ✅ this is always the Counter instance
```

This is the modern React pattern for event handlers.

* * *

Common `this` Gotchas
======================

```js
// 1. Passing a method as a callback
class Logger {
  prefix = '[LOG]';

  log(message) {
    console.log(`${this.prefix} ${message}`); // this lost if extracted
  }
}

const logger = new Logger();
['a', 'b'].forEach(logger.log);        // ❌ this.prefix is undefined
['a', 'b'].forEach(logger.log.bind(logger)); // ✅
['a', 'b'].forEach(msg => logger.log(msg));  // ✅ wrapper arrow

// 2. Destructured methods
const { log } = logger;
log('test'); // ❌ this is undefined (strict) or global

// 3. Chained method calls with intermediate variables
const fn = obj.method;
fn(); // ❌ binding lost
obj.method(); // ✅ keeps binding
```

* * *

Interview definition (short answer)
=====================================

> "`this` is determined at call time by 4 rules in priority order: `new` > explicit (`call`/`apply`/`bind`) > implicit (method call) > default (global/undefined). Arrow functions have no own `this` — they capture it lexically from their definition context, which is why they're used in callbacks inside class methods. You cannot override `this` in an arrow function with `call`, `apply`, or `bind`."
