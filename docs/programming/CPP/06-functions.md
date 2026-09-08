# Functions - Reusable Code Blocks

## What is a Function?

Imagine you have a robot that can do specific tasks. Instead of telling it every single step each time, you teach it a task once, give it a name, and then just say the name whenever you want it done.

**Functions** work the same way! They're named blocks of code that do specific jobs. Once you create a function, you can use it over and over.

## Why Use Functions?

**Without functions:**
```cpp
#include <iostream>

int main() {
    std::cout << "Welcome to my program!" << std::endl;
    std::cout << "===================" << std::endl;

    std::cout << "Starting task 1..." << std::endl;

    std::cout << "Welcome to my program!" << std::endl;
    std::cout << "===================" << std::endl;

    std::cout << "Starting task 2..." << std::endl;

    std::cout << "Welcome to my program!" << std::endl;
    std::cout << "===================" << std::endl;

    return 0;
}
```

We're repeating the same code! That's messy.

**With functions:**
```cpp
#include <iostream>

void printWelcome() {
    std::cout << "Welcome to my program!" << std::endl;
    std::cout << "===================" << std::endl;
}

int main() {
    printWelcome();
    std::cout << "Starting task 1..." << std::endl;

    printWelcome();
    std::cout << "Starting task 2..." << std::endl;

    printWelcome();

    return 0;
}
```

Much cleaner! We wrote the code once and used it three times.

## Creating Your First Function

**Basic structure:**
```
returnType functionName() {
    code to execute
}
```

### Simple Function Example

```cpp
#include <iostream>

void sayHello() {
    std::cout << "Hello, World!" << std::endl;
}

int main() {
    sayHello();
    sayHello();
    sayHello();

    return 0;
}
```

**Output:**
```
Hello, World!
Hello, World!
Hello, World!
```

**Breaking it down:**
- `void` - This function doesn't return a value
- `sayHello` - The function's name
- `()` - No parameters (we'll learn about these soon)
- Code inside `{}` runs when function is called
- `sayHello()` in main - This "calls" (runs) the function

## Functions with Parameters

**Parameters** are like ingredients for a recipe. You give the function some information to work with.

```cpp
#include <iostream>

void greet(std::string name) {
    std::cout << "Hello, " << name << "!" << std::endl;
}

int main() {
    greet("Alice");
    greet("Bob");
    greet("Charlie");

    return 0;
}
```

**Output:**
```
Hello, Alice!
Hello, Bob!
Hello, Charlie!
```

Now the function can work with different names!

### Multiple Parameters

```cpp
#include <iostream>

void introduce(std::string name, int age) {
    std::cout << "Hi! I'm " << name << " and I'm " << age << " years old." << std::endl;
}

int main() {
    introduce("Alex", 13);
    introduce("Sam", 15);
    introduce("Jordan", 14);

    return 0;
}
```

**Output:**
```
Hi! I'm Alex and I'm 13 years old.
Hi! I'm Sam and I'm 15 years old.
Hi! I'm Jordan and I'm 14 years old.
```

**Rules for parameters:**
1. Specify the type (int, string, double, etc.)
2. Give each a name
3. Separate multiple parameters with commas
4. When calling, provide values in the same order

## Functions That Return Values

Sometimes you want a function to give you back a result.

```cpp
#include <iostream>

int add(int a, int b) {
    int result = a + b;
    return result;
}

int main() {
    int sum = add(5, 3);
    std::cout << "5 + 3 = " << sum << std::endl;

    std::cout << "10 + 7 = " << add(10, 7) << std::endl;

    return 0;
}
```

**Output:**
```
5 + 3 = 8
10 + 7 = 17
```

**Key points:**
- `int add` - Returns an integer
- `return result` - Sends the value back
- `int sum = add(5, 3)` - Stores the returned value

### More Return Examples

```cpp
#include <iostream>

double multiply(double x, double y) {
    return x * y;
}

bool isEven(int number) {
    return (number % 2 == 0);
}

int main() {
    double product = multiply(4.5, 2.0);
    std::cout << "4.5 * 2.0 = " << product << std::endl;

    if (isEven(10)) {
        std::cout << "10 is even!" << std::endl;
    }

    if (!isEven(7)) {
        std::cout << "7 is odd!" << std::endl;
    }

    return 0;
}
```

**Output:**
```
4.5 * 2.0 = 9
10 is even!
7 is odd!
```

## Function Declaration vs Definition

In C++, you need to declare a function before using it. There are two ways:

### Method 1: Define Before main()

```cpp
#include <iostream>

int square(int n) {
    return n * n;
}

int main() {
    std::cout << "5 squared = " << square(5) << std::endl;
    return 0;
}
```

### Method 2: Declare Before main(), Define After

```cpp
#include <iostream>

int square(int n);

int main() {
    std::cout << "5 squared = " << square(5) << std::endl;
    return 0;
}

int square(int n) {
    return n * n;
}
```

**The declaration** (also called prototype) tells C++ "This function exists!" The definition provides the actual code.

**Both output:**
```
5 squared = 25
```

## Practical Example: Calculator Functions

```cpp
#include <iostream>

double add(double a, double b) {
    return a + b;
}

double subtract(double a, double b) {
    return a - b;
}

double multiply(double a, double b) {
    return a * b;
}

double divide(double a, double b) {
    if (b == 0) {
        std::cout << "Error: Cannot divide by zero!" << std::endl;
        return 0;
    }
    return a / b;
}

int main() {
    double num1, num2;
    char operation;

    std::cout << "Enter first number: ";
    std::cin >> num1;

    std::cout << "Enter operation (+, -, *, /): ";
    std::cin >> operation;

    std::cout << "Enter second number: ";
    std::cin >> num2;

    double result;

    if (operation == '+') {
        result = add(num1, num2);
    } else if (operation == '-') {
        result = subtract(num1, num2);
    } else if (operation == '*') {
        result = multiply(num1, num2);
    } else if (operation == '/') {
        result = divide(num1, num2);
    } else {
        std::cout << "Invalid operation!" << std::endl;
        return 1;
    }

    std::cout << "Result: " << result << std::endl;

    return 0;
}
```

**Sample run:**
```
Enter first number: 10
Enter operation (+, -, *, /): *
Enter second number: 5
Result: 50
```

## Default Parameters

You can give parameters default values:

```cpp
#include <iostream>

void greet(std::string name = "Guest") {
    std::cout << "Hello, " << name << "!" << std::endl;
}

int main() {
    greet("Alice");
    greet();

    return 0;
}
```

**Output:**
```
Hello, Alice!
Hello, Guest!
```

When you don't provide an argument, it uses the default value.

### Multiple Default Parameters

```cpp
#include <iostream>

void displayInfo(std::string name = "Unknown", int age = 0, std::string country = "Earth") {
    std::cout << name << " is " << age << " years old from " << country << std::endl;
}

int main() {
    displayInfo("Alex", 13, "USA");
    displayInfo("Sam", 15);
    displayInfo("Jordan");
    displayInfo();

    return 0;
}
```

**Output:**
```
Alex is 13 years old from USA
Sam is 15 years old from Earth
Jordan is 0 years old from Earth
Unknown is 0 years old from Earth
```

**Important:** Default parameters must be at the end:

```cpp
void func(int a, int b = 5, int c = 10);
```

## Function Overloading

You can have multiple functions with the same name but different parameters!

```cpp
#include <iostream>

int add(int a, int b) {
    return a + b;
}

double add(double a, double b) {
    return a + b;
}

int add(int a, int b, int c) {
    return a + b + c;
}

int main() {
    std::cout << "Int: " << add(5, 3) << std::endl;
    std::cout << "Double: " << add(5.5, 3.2) << std::endl;
    std::cout << "Three ints: " << add(1, 2, 3) << std::endl;

    return 0;
}
```

**Output:**
```
Int: 8
Double: 8.7
Three ints: 6
```

C++ chooses the right function based on the arguments you provide!

## Pass by Value vs Pass by Reference

### Pass by Value (Default)

When you pass a variable, the function gets a COPY:

```cpp
#include <iostream>

void double Value(int x) {
    x = x * 2;
    std::cout << "Inside function: " << x << std::endl;
}

int main() {
    int number = 5;
    std::cout << "Before: " << number << std::endl;

    doubleValue(number);

    std::cout << "After: " << number << std::endl;

    return 0;
}
```

**Output:**
```
Before: 5
Inside function: 10
After: 5
```

The original `number` didn't change! The function worked on a copy.

### Pass by Reference

Use `&` to work with the original variable:

```cpp
#include <iostream>

void doubleValue(int& x) {
    x = x * 2;
    std::cout << "Inside function: " << x << std::endl;
}

int main() {
    int number = 5;
    std::cout << "Before: " << number << std::endl;

    doubleValue(number);

    std::cout << "After: " << number << std::endl;

    return 0;
}
```

**Output:**
```
Before: 5
Inside function: 10
After: 10
```

Now it changed! The `&` means "work with the original, not a copy."

### When to Use Each

**Pass by value:**
- When you don't want to change the original
- For small data types (int, double, char, bool)

**Pass by reference:**
- When you want to modify the original
- For large data types (to avoid copying)
- When a function needs to return multiple values

## Returning Multiple Values (Using References)

```cpp
#include <iostream>

void calculate(int a, int b, int& sum, int& product) {
    sum = a + b;
    product = a * b;
}

int main() {
    int x = 5, y = 3;
    int total, result;

    calculate(x, y, total, result);

    std::cout << x << " + " << y << " = " << total << std::endl;
    std::cout << x << " * " << y << " = " << result << std::endl;

    return 0;
}
```

**Output:**
```
5 + 3 = 8
5 * 3 = 15
```

## Recursive Functions

A function that calls itself! Useful for certain problems.

### Factorial Example

5! = 5 × 4 × 3 × 2 × 1 = 120

```cpp
#include <iostream>

int factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

int main() {
    std::cout << "5! = " << factorial(5) << std::endl;
    std::cout << "7! = " << factorial(7) << std::endl;

    return 0;
}
```

**Output:**
```
5! = 120
7! = 5040
```

**How it works for factorial(5):**
1. factorial(5) = 5 * factorial(4)
2. factorial(4) = 4 * factorial(3)
3. factorial(3) = 3 * factorial(2)
4. factorial(2) = 2 * factorial(1)
5. factorial(1) = 1 (base case!)
6. Goes back up: 2*1 = 2, 3*2 = 6, 4*6 = 24, 5*24 = 120

**Important:** Always have a base case or it loops forever!

## Scope - Where Variables Live

Variables inside functions only exist inside those functions:

```cpp
#include <iostream>

void myFunction() {
    int localVar = 10;
    std::cout << "Inside function: " << localVar << std::endl;
}

int main() {
    myFunction();

    return 0;
}
```

**Output:**
```
Inside function: 10
```

If you try to use `localVar` in main, you'll get an error!

### Global vs Local Variables

```cpp
#include <iostream>

int globalVar = 100;

void showVars() {
    int localVar = 50;
    std::cout << "Global: " << globalVar << std::endl;
    std::cout << "Local: " << localVar << std::endl;
}

int main() {
    std::cout << "In main, global: " << globalVar << std::endl;

    showVars();

    return 0;
}
```

**Output:**
```
In main, global: 100
Global: 100
Local: 50
```

**Best practice:** Avoid global variables when possible. Use parameters instead!

## Common Mistakes

### Mistake 1: Forgetting to Return a Value

```cpp
int add(int a, int b) {
    int sum = a + b;
}
```

Function says it returns an int but doesn't! Add `return sum;`

### Mistake 2: Wrong Parameter Order

```cpp
void divide(int dividend, int divisor) {
    std::cout << dividend / divisor << std::endl;
}

divide(2, 10);
```

This calculates 2/10 = 0, not 10/2 = 5! Order matters!

### Mistake 3: Modifying by Value Instead of Reference

```cpp
void increment(int x) {
    x++;
}

int num = 5;
increment(num);
```

`num` stays 5! Use `int& x` to actually modify it.

## Practice Exercises

**1. Temperature Converter**
Create functions to convert between Celsius and Fahrenheit.

**2. Grade Calculator**
Function that takes a score and returns letter grade (A, B, C, D, F).

**3. Prime Number Checker**
Function that returns true if a number is prime, false otherwise.

**Example solution for prime checker:**

```cpp
#include <iostream>

bool isPrime(int n) {
    if (n <= 1) {
        return false;
    }

    for (int i = 2; i * i <= n; i++) {
        if (n % i == 0) {
            return false;
        }
    }

    return true;
}

int main() {
    std::cout << "Enter a number: ";
    int number;
    std::cin >> number;

    if (isPrime(number)) {
        std::cout << number << " is prime!" << std::endl;
    } else {
        std::cout << number << " is not prime." << std::endl;
    }

    return 0;
}
```

## What's Next?

Now you can organize code into reusable functions! Next, we'll learn:
- **Arrays** - Storing multiple values of the same type
- **Vectors** - Dynamic arrays
- **Working with collections of data**

You're building serious programming skills now! 🚀
