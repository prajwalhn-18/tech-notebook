---
sidebar_position: 4
---

## Prototypes & Inheritance

JavaScript's object system is prototype-based, not class-based. ES6 `class` syntax is syntactic sugar over the prototype system — understanding prototypes lets you understand what classes actually do under the hood, debug inheritance bugs, and write more deliberate code.

* * *

The Prototype Chain
====================

Every object in JavaScript has an internal `[[Prototype]]` link pointing to another object (or `null`). When you access a property, JavaScript walks this chain until it finds the property or reaches `null`.

```js
const animal = {
  breathe() { return 'breathing'; },
};

const dog = {
  bark() { return 'woof'; },
};

// Set dog's prototype to animal
Object.setPrototypeOf(dog, animal);

dog.bark();    // 'woof' — found on dog itself
dog.breathe(); // 'breathing' — not on dog, found on animal (its prototype)
dog.toString() // '[object Object]' — not on dog or animal, found on Object.prototype
dog.missing;   // undefined — not found anywhere in the chain
```

```
dog → animal → Object.prototype → null
```

When you access `dog.breathe()`:
1. Look on `dog` — not found
2. Look on `dog.__proto__` (which is `animal`) — found ✅

* * *

`__proto__` vs `.prototype`

These two confuse everyone:

```
__proto__   → an internal property on every OBJECT, pointing to its prototype
.prototype  → a property on FUNCTIONS, used when the function is called with `new`
```

```js
function Dog(name) {
  this.name = name;
}

Dog.prototype.bark = function() {
  return `${this.name} says woof`;
};

const rex = new Dog('Rex');

rex.__proto__ === Dog.prototype    // true
Dog.prototype.__proto__ === Object.prototype // true
Object.prototype.__proto__ === null          // true — end of chain
```

```
rex  →  Dog.prototype  →  Object.prototype  →  null
```

`Dog.prototype` is the object that becomes the `__proto__` of instances created with `new Dog()`.

* * *

Constructor Functions
======================

Before ES6 classes, constructor functions were the standard way to create objects with shared behavior.

```js
function Person(name, age) {
  // Properties set on `this` are per-instance
  this.name = name;
  this.age  = age;
}

// Methods on .prototype are shared across ALL instances (not copied)
Person.prototype.greet = function() {
  return `Hi, I'm ${this.name}`;
};

Person.prototype.isAdult = function() {
  return this.age >= 18;
};

const p1 = new Person('Prajwal', 25);
const p2 = new Person('Alice', 17);

p1.greet();   // 'Hi, I'm Prajwal'
p2.isAdult(); // false

// All instances share the same greet function (memory efficient)
p1.greet === p2.greet // true
```

**Inheritance with constructor functions:**

```js
function Employee(name, age, company) {
  Person.call(this, name, age); // call parent constructor
  this.company = company;
}

// Set up prototype chain
Employee.prototype = Object.create(Person.prototype);
Employee.prototype.constructor = Employee; // restore constructor

Employee.prototype.introduce = function() {
  return `${this.greet()} and I work at ${this.company}`;
};

const emp = new Employee('Prajwal', 25, 'Acme Corp');
emp.greet();      // 'Hi, I'm Prajwal' — inherited from Person
emp.introduce();  // 'Hi, I'm Prajwal and I work at Acme Corp'
emp instanceof Employee // true
emp instanceof Person   // true
```

* * *

ES6 Classes — Syntactic Sugar
==============================

`class` is not a new object model — it's cleaner syntax over the same prototype system.

```js
class Person {
  // Private field (not accessible outside the class)
  #age;

  constructor(name, age) {
    this.name = name; // public property
    this.#age = age;  // private field
  }

  greet() {
    return `Hi, I'm ${this.name}`;
  }

  isAdult() {
    return this.#age >= 18;
  }

  // Getter
  get age() {
    return this.#age;
  }

  // Setter with validation
  set age(value) {
    if (value < 0) throw new Error('Age cannot be negative');
    this.#age = value;
  }

  // Static method — on the class, not instances
  static create(name, age) {
    return new Person(name, age);
  }

  // toString override
  toString() {
    return `Person(${this.name}, ${this.#age})`;
  }
}

const p = Person.create('Prajwal', 25);
p.greet();    // 'Hi, I'm Prajwal'
p.age;        // 25 — via getter
p.age = 26;   // via setter
p.#age;       // SyntaxError — truly private
```

Under the hood, methods are placed on `Person.prototype`, just like the constructor function approach.

* * *

Class Inheritance
==================

```js
class Animal {
  #name;

  constructor(name) {
    this.#name = name;
  }

  get name() { return this.#name; }

  speak() {
    return `${this.#name} makes a noise`;
  }

  toString() {
    return `Animal(${this.#name})`;
  }
}

class Dog extends Animal {
  #breed;

  constructor(name, breed) {
    super(name); // must call super() before accessing `this`
    this.#breed = breed;
  }

  // Override parent method
  speak() {
    return `${this.name} barks`;
  }

  // Call parent method with super
  introduce() {
    return `${super.speak()} and is a ${this.#breed}`;
  }
}

const rex = new Dog('Rex', 'Labrador');
rex.speak();     // 'Rex barks' — overridden
rex.introduce(); // 'Rex makes a noise and is a Labrador' — calls Animal.speak via super

rex instanceof Dog    // true
rex instanceof Animal // true
```

* * *

Object.create — Prototypal Inheritance Without Classes
=======================================================

`Object.create(proto)` creates a new object with `proto` as its prototype.

```js
const vehicleProto = {
  start()  { return `${this.type} started`; },
  stop()   { return `${this.type} stopped`; },
};

const car = Object.create(vehicleProto);
car.type = 'Car';
car.start(); // 'Car started'

// Factory function pattern (often preferred over classes)
function createVehicle(type, speed) {
  const vehicle = Object.create(vehicleProto);
  vehicle.type  = type;
  vehicle.speed = speed;
  return vehicle;
}

const bike = createVehicle('Bike', 30);
bike.start(); // 'Bike started'
```

This is **true prototypal inheritance** — no constructors, no `new`, no classes.

* * *

Mixins — Composing Behavior
=============================

JavaScript only allows single inheritance (`extends` one class). Mixins let you compose behavior from multiple sources.

```js
// Mixin functions — take a class and add methods to it
const Serializable = (Base) => class extends Base {
  serialize() {
    return JSON.stringify(this);
  }

  static deserialize(json) {
    return Object.assign(new this(), JSON.parse(json));
  }
};

const Timestamped = (Base) => class extends Base {
  constructor(...args) {
    super(...args);
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  touch() {
    this.updatedAt = new Date();
  }
};

const Validatable = (Base) => class extends Base {
  validate() {
    return Object.keys(this).every(key => this[key] !== null && this[key] !== undefined);
  }
};

// Compose mixins
class User extends Serializable(Timestamped(Validatable(class {}))) {
  constructor(name, email) {
    super();
    this.name  = name;
    this.email = email;
  }
}

const user = new User('Prajwal', 'prajwal@example.com');
user.validate();   // true
user.serialize();  // '{"name":"Prajwal","email":"..."}'
user.createdAt;    // Date object
```

* * *

Property Descriptors
=====================

Every property on an object has a descriptor that controls its behavior.

```js
const obj = { name: 'Prajwal' };

Object.getOwnPropertyDescriptor(obj, 'name');
// {
//   value: 'Prajwal',
//   writable: true,       // can be changed
//   enumerable: true,     // shows up in for...in, Object.keys
//   configurable: true    // can be deleted or reconfigured
// }

// Define a property with custom descriptor
Object.defineProperty(obj, 'id', {
  value: 42,
  writable: false,      // read-only
  enumerable: false,    // hidden from Object.keys()
  configurable: false,  // cannot be deleted or reconfigured
});

obj.id = 99;   // silently fails (or throws in strict mode)
obj.id;        // 42
Object.keys(obj); // ['name'] — id is not enumerable

// Accessor property (getter/setter via descriptor)
Object.defineProperty(obj, 'upper', {
  get() { return this.name.toUpperCase(); },
  enumerable: true,
  configurable: true,
});

obj.upper; // 'PRAJWAL'
```

* * *

hasOwnProperty vs `in`
========================

```js
const parent = { inherited: true };
const child  = Object.create(parent);
child.own    = true;

'own'       in child  // true — own property
'inherited' in child  // true — inherited via prototype chain

child.hasOwnProperty('own')       // true
child.hasOwnProperty('inherited') // false — not own, inherited

// Modern: Object.hasOwn (ES2022, preferred over hasOwnProperty)
Object.hasOwn(child, 'own')       // true
Object.hasOwn(child, 'inherited') // false
```

* * *

Interview definition (short answer)
=====================================

> "JavaScript uses prototypal inheritance — every object has a `[[Prototype]]` link, and property lookup walks the chain. `class` syntax is sugar over this system — methods go on `ClassName.prototype`, `new` creates an object with that prototype. `__proto__` is the instance's link; `.prototype` is the function property used when called with `new`. Private fields (`#`) are truly private, enforced by the engine. Mixins via higher-order class functions solve the single-inheritance limitation."
