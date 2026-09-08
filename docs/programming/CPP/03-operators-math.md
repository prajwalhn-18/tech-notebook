# Operators and Math

## Basic Arithmetic Operations

Your computer is like a super-fast calculator! Let's learn how to make it do math.

### Addition (+)

```cpp
#include <iostream>

int main() {
    int apples = 5;
    int oranges = 3;
    int totalFruit = apples + oranges;

    std::cout << "Apples: " << apples << std::endl;
    std::cout << "Oranges: " << oranges << std::endl;
    std::cout << "Total fruit: " << totalFruit << std::endl;

    return 0;
}
```

**Output:**
```
Apples: 5
Oranges: 3
Total fruit: 8
```

### Subtraction (-)

```cpp
#include <iostream>

int main() {
    int money = 50;
    int spent = 20;
    int remaining = money - spent;

    std::cout << "Started with: $" << money << std::endl;
    std::cout << "Spent: $" << spent << std::endl;
    std::cout << "Remaining: $" << remaining << std::endl;

    return 0;
}
```

**Output:**
```
Started with: $50
Spent: $20
Remaining: $30
```

### Multiplication (*)

```cpp
#include <iostream>

int main() {
    int pricePerCandy = 3;
    int numberOfCandies = 7;
    int totalCost = pricePerCandy * numberOfCandies;

    std::cout << "Price per candy: $" << pricePerCandy << std::endl;
    std::cout << "Number of candies: " << numberOfCandies << std::endl;
    std::cout << "Total cost: $" << totalCost << std::endl;

    return 0;
}
```

**Output:**
```
Price per candy: $3
Number of candies: 7
Total cost: $21
```

### Division (/)

```cpp
#include <iostream>

int main() {
    double pizza = 12.0;
    double people = 4.0;
    double slicesPerPerson = pizza / people;

    std::cout << "Total slices: " << pizza << std::endl;
    std::cout << "Number of people: " << people << std::endl;
    std::cout << "Slices per person: " << slicesPerPerson << std::endl;

    return 0;
}
```

**Output:**
```
Total slices: 12
Number of people: 4
Slices per person: 3
```

### The Integer Division Trap!

Watch out for this common mistake:

```cpp
#include <iostream>

int main() {
    int cookies = 7;
    int friends = 2;
    int cookiesEach = cookies / friends;

    std::cout << cookies << " cookies divided by " << friends << " friends" << std::endl;
    std::cout << "Each gets: " << cookiesEach << " cookies" << std::endl;

    return 0;
}
```

**Output:**
```
7 cookies divided by 2 friends
Each gets: 3 cookies
```

Wait, shouldn't it be 3.5? When you divide two integers, C++ throws away the decimal part!

**Solution:** Use doubles for accurate division:

```cpp
#include <iostream>

int main() {
    double cookies = 7.0;
    double friends = 2.0;
    double cookiesEach = cookies / friends;

    std::cout << cookies << " cookies divided by " << friends << " friends" << std::endl;
    std::cout << "Each gets: " << cookiesEach << " cookies" << std::endl;

    return 0;
}
```

**Output:**
```
7 cookies divided by 2 friends
Each gets: 3.5 cookies
```

### Modulus (%) - The Remainder

The `%` operator gives you the remainder after division. It's super useful!

```cpp
#include <iostream>

int main() {
    int totalCookies = 17;
    int people = 5;

    int cookiesEach = totalCookies / people;
    int leftoverCookies = totalCookies % people;

    std::cout << "Total cookies: " << totalCookies << std::endl;
    std::cout << "Number of people: " << people << std::endl;
    std::cout << "Each person gets: " << cookiesEach << " cookies" << std::endl;
    std::cout << "Leftover cookies: " << leftoverCookies << std::endl;

    return 0;
}
```

**Output:**
```
Total cookies: 17
Number of people: 5
Each person gets: 3 cookies
Leftover cookies: 2
```

**Cool trick:** Check if a number is even or odd!

```cpp
#include <iostream>

int main() {
    int number = 7;
    int remainder = number % 2;

    std::cout << "Number: " << number << std::endl;
    std::cout << "Remainder when divided by 2: " << remainder << std::endl;

    if (remainder == 0) {
        std::cout << "This number is EVEN" << std::endl;
    } else {
        std::cout << "This number is ODD" << std::endl;
    }

    return 0;
}
```

**Output:**
```
Number: 7
Remainder when divided by 2: 1
This number is ODD
```

## Order of Operations (PEMDAS)

C++ follows the same math rules you learned in school!

**Remember: PEMDAS (Please Excuse My Dear Aunt Sally)**
1. **P**arentheses
2. **E**xponents (we'll use functions for this)
3. **M**ultiplication and **D**ivision (left to right)
4. **A**ddition and **S**ubtraction (left to right)

```cpp
#include <iostream>

int main() {
    int result1 = 2 + 3 * 4;
    int result2 = (2 + 3) * 4;
    int result3 = 10 - 4 / 2;
    int result4 = (10 - 4) / 2;

    std::cout << "2 + 3 * 4 = " << result1 << std::endl;
    std::cout << "(2 + 3) * 4 = " << result2 << std::endl;
    std::cout << "10 - 4 / 2 = " << result3 << std::endl;
    std::cout << "(10 - 4) / 2 = " << result4 << std::endl;

    return 0;
}
```

**Output:**
```
2 + 3 * 4 = 14
(2 + 3) * 4 = 20
10 - 4 / 2 = 8
(10 - 4) / 2 = 3
```

**Pro tip:** When in doubt, use parentheses to make your intent clear!

## Compound Assignment Operators

These are shortcuts to change a variable's value.

### Adding to a Variable (+=)

```cpp
#include <iostream>

int main() {
    int score = 100;
    std::cout << "Starting score: " << score << std::endl;

    score = score + 50;
    std::cout << "After bonus: " << score << std::endl;

    score += 30;
    std::cout << "After another bonus: " << score << std::endl;

    return 0;
}
```

**Output:**
```
Starting score: 100
After bonus: 150
After another bonus: 180
```

`score += 30` is just a shorter way to write `score = score + 30`

### All Compound Operators

```cpp
#include <iostream>

int main() {
    int number = 100;

    std::cout << "Start: " << number << std::endl;

    number += 20;
    std::cout << "After += 20: " << number << std::endl;

    number -= 15;
    std::cout << "After -= 15: " << number << std::endl;

    number *= 2;
    std::cout << "After *= 2: " << number << std::endl;

    number /= 5;
    std::cout << "After /= 5: " << number << std::endl;

    number %= 10;
    std::cout << "After %= 10: " << number << std::endl;

    return 0;
}
```

**Output:**
```
Start: 100
After += 20: 120
After -= 15: 105
After *= 2: 210
After /= 5: 42
After %= 10: 2
```

## Increment and Decrement

Super common shortcuts for adding or subtracting 1.

### Increment (++) - Add 1

```cpp
#include <iostream>

int main() {
    int level = 1;

    std::cout << "Current level: " << level << std::endl;

    level++;
    std::cout << "Leveled up! New level: " << level << std::endl;

    level++;
    std::cout << "Leveled up again! New level: " << level << std::endl;

    return 0;
}
```

**Output:**
```
Current level: 1
Leveled up! New level: 2
Leveled up again! New level: 3
```

These all do the same thing:
- `level++`
- `level = level + 1`
- `level += 1`

### Decrement (--) - Subtract 1

```cpp
#include <iostream>

int main() {
    int lives = 3;

    std::cout << "Lives: " << lives << std::endl;

    lives--;
    std::cout << "Lost a life! Lives: " << lives << std::endl;

    lives--;
    std::cout << "Lost another life! Lives: " << lives << std::endl;

    return 0;
}
```

**Output:**
```
Lives: 3
Lost a life! Lives: 2
Lost another life! Lives: 1
```

## Comparison Operators

These compare two values and give you true (1) or false (0).

### Equal to (==)

**Warning:** Use `==` for comparison, NOT `=` (which assigns a value)!

```cpp
#include <iostream>

int main() {
    int score = 100;
    int perfectScore = 100;

    bool isPerfect = (score == perfectScore);

    std::cout << "Score: " << score << std::endl;
    std::cout << "Perfect score: " << perfectScore << std::endl;
    std::cout << "Is perfect? " << isPerfect << std::endl;

    return 0;
}
```

**Output:**
```
Score: 100
Perfect score: 100
Is perfect? 1
```

### Not Equal to (!=)

```cpp
#include <iostream>

int main() {
    int myAge = 13;
    int adultAge = 18;

    bool isAdult = (myAge != adultAge);

    std::cout << "My age: " << myAge << std::endl;
    std::cout << "Adult age: " << adultAge << std::endl;
    std::cout << "Am I an adult? " << isAdult << std::endl;

    return 0;
}
```

**Output:**
```
My age: 13
Adult age: 18
Am I an adult? 1
```

Wait, that's confusing! It says 1 (true) because the ages are NOT equal. Let's make it clearer:

```cpp
#include <iostream>

int main() {
    int myAge = 13;
    int friendAge = 13;

    bool samAge = (myAge == friendAge);
    bool differentAge = (myAge != friendAge);

    std::cout << "My age: " << myAge << std::endl;
    std::cout << "Friend's age: " << friendAge << std::endl;
    std::cout << "Same age? " << samAge << std::endl;
    std::cout << "Different age? " << differentAge << std::endl;

    return 0;
}
```

**Output:**
```
My age: 13
Friend's age: 13
Same age? 1
Different age? 0
```

### Greater Than (>)

```cpp
#include <iostream>

int main() {
    int myScore = 95;
    int passingScore = 60;

    bool passed = (myScore > passingScore);

    std::cout << "My score: " << myScore << std::endl;
    std::cout << "Passing score: " << passingScore << std::endl;
    std::cout << "Did I pass? " << passed << std::endl;

    return 0;
}
```

**Output:**
```
My score: 95
Passing score: 60
Did I pass? 1
```

### Less Than (<)

```cpp
#include <iostream>

int main() {
    int temperature = 25;
    int freezing = 32;

    bool isFreezing = (temperature < freezing);

    std::cout << "Temperature: " << temperature << "°F" << std::endl;
    std::cout << "Freezing point: " << freezing << "°F" << std::endl;
    std::cout << "Is it freezing? " << isFreezing << std::endl;

    return 0;
}
```

**Output:**
```
Temperature: 25°F
Freezing point: 32°F
Is it freezing? 1
```

### Greater Than or Equal (>=)

```cpp
#include <iostream>

int main() {
    int age = 16;
    int drivingAge = 16;

    bool canDrive = (age >= drivingAge);

    std::cout << "Your age: " << age << std::endl;
    std::cout << "Driving age: " << drivingAge << std::endl;
    std::cout << "Can you drive? " << canDrive << std::endl;

    return 0;
}
```

**Output:**
```
Your age: 16
Driving age: 16
Can you drive? 1
```

### Less Than or Equal (<=)

```cpp
#include <iostream>

int main() {
    int health = 20;
    int criticalHealth = 25;

    bool isDanger = (health <= criticalHealth);

    std::cout << "Current health: " << health << std::endl;
    std::cout << "Critical threshold: " << criticalHealth << std::endl;
    std::cout << "In danger? " << isDanger << std::endl;

    return 0;
}
```

**Output:**
```
Current health: 20
Critical threshold: 25
In danger? 1
```

### All Comparisons in One Program

```cpp
#include <iostream>

int main() {
    int x = 10;
    int y = 5;

    std::cout << "x = " << x << ", y = " << y << std::endl;
    std::cout << std::endl;

    std::cout << "x == y: " << (x == y) << std::endl;
    std::cout << "x != y: " << (x != y) << std::endl;
    std::cout << "x > y: " << (x > y) << std::endl;
    std::cout << "x < y: " << (x < y) << std::endl;
    std::cout << "x >= y: " << (x >= y) << std::endl;
    std::cout << "x <= y: " << (x <= y) << std::endl;

    return 0;
}
```

**Output:**
```
x = 10, y = 5

x == y: 0
x != y: 1
x > y: 1
x < y: 0
x >= y: 1
x <= y: 0
```

## Logical Operators

These let you combine multiple true/false conditions.

### AND (&&) - Both Must Be True

```cpp
#include <iostream>

int main() {
    int age = 13;
    bool hasTicket = true;

    bool canEnter = (age >= 12 && hasTicket == true);

    std::cout << "Age: " << age << std::endl;
    std::cout << "Has ticket: " << hasTicket << std::endl;
    std::cout << "Can enter movie? " << canEnter << std::endl;

    return 0;
}
```

**Output:**
```
Age: 13
Has ticket: 1
Can enter movie? 1
```

**Truth table for AND:**
- true && true = true
- true && false = false
- false && true = false
- false && false = false

### OR (||) - At Least One Must Be True

```cpp
#include <iostream>

int main() {
    bool isWeekend = false;
    bool isHoliday = true;

    bool canSleepIn = (isWeekend || isHoliday);

    std::cout << "Is weekend: " << isWeekend << std::endl;
    std::cout << "Is holiday: " << isHoliday << std::endl;
    std::cout << "Can sleep in? " << canSleepIn << std::endl;

    return 0;
}
```

**Output:**
```
Is weekend: 0
Is holiday: 1
Can sleep in? 1
```

**Truth table for OR:**
- true || true = true
- true || false = true
- false || true = true
- false || false = false

### NOT (!) - Flip the Value

```cpp
#include <iostream>

int main() {
    bool isRaining = false;
    bool canGoOutside = !isRaining;

    std::cout << "Is raining: " << isRaining << std::endl;
    std::cout << "Can go outside: " << canGoOutside << std::endl;

    std::cout << std::endl;

    bool isSunny = true;
    bool needUmbrella = !isSunny;

    std::cout << "Is sunny: " << isSunny << std::endl;
    std::cout << "Need umbrella: " << needUmbrella << std::endl;

    return 0;
}
```

**Output:**
```
Is raining: 0
Can go outside: 1

Is sunny: 1
Need umbrella: 0
```

**Truth table for NOT:**
- !true = false
- !false = true

### Combining Logical Operators

```cpp
#include <iostream>

int main() {
    int age = 15;
    bool hasLicense = false;
    bool hasPermit = true;
    bool parentPresent = true;

    bool canDrive = (age >= 16 && hasLicense) || (hasPermit && parentPresent);

    std::cout << "Age: " << age << std::endl;
    std::cout << "Has license: " << hasLicense << std::endl;
    std::cout << "Has permit: " << hasPermit << std::endl;
    std::cout << "Parent present: " << parentPresent << std::endl;
    std::cout << "Can drive: " << canDrive << std::endl;

    return 0;
}
```

**Output:**
```
Age: 15
Has license: 0
Has permit: 1
Parent present: 1
Can drive: 1
```

**Explanation:** You can drive if (you're 16+ with a license) OR (you have a permit and a parent is present).

## Building a Simple Calculator

Let's put it all together!

```cpp
#include <iostream>

int main() {
    double num1, num2;
    double sum, difference, product, quotient;

    std::cout << "=== Simple Calculator ===" << std::endl;
    std::cout << std::endl;

    std::cout << "Enter first number: ";
    std::cin >> num1;

    std::cout << "Enter second number: ";
    std::cin >> num2;

    sum = num1 + num2;
    difference = num1 - num2;
    product = num1 * num2;
    quotient = num1 / num2;

    std::cout << std::endl;
    std::cout << "=== Results ===" << std::endl;
    std::cout << num1 << " + " << num2 << " = " << sum << std::endl;
    std::cout << num1 << " - " << num2 << " = " << difference << std::endl;
    std::cout << num1 << " * " << num2 << " = " << product << std::endl;
    std::cout << num1 << " / " << num2 << " = " << quotient << std::endl;

    return 0;
}
```

**Running the program:**
```
=== Simple Calculator ===

Enter first number: 10
Enter second number: 3

=== Results ===
10 + 3 = 13
10 - 3 = 7
10 * 3 = 30
10 / 3 = 3.33333
```

## Common Mistakes

### Mistake 1: Using = Instead of ==

```cpp
if (score = 100)
```

This SETS score to 100! Use `==` to compare:

```cpp
if (score == 100)
```

### Mistake 2: Integer Division When You Want Decimals

```cpp
int result = 7 / 2;
```

Result will be 3, not 3.5! Use doubles:

```cpp
double result = 7.0 / 2.0;
```

### Mistake 3: Forgetting Parentheses

```cpp
bool result = age >= 18 && hasTicket || isVIP;
```

Add parentheses for clarity:

```cpp
bool result = ((age >= 18) && hasTicket) || isVIP;
```

## Practice Exercises

Try creating these programs:

**1. Rectangle Area Calculator**
- Ask for length and width
- Calculate and display the area

**2. Temperature Converter**
- Ask for temperature in Celsius
- Convert to Fahrenheit using: F = (C × 9/5) + 32

**3. Age Checker**
- Ask for age
- Tell if they can vote (18+) and drive (16+)

**Example solution for temperature converter:**

```cpp
#include <iostream>

int main() {
    double celsius, fahrenheit;

    std::cout << "Enter temperature in Celsius: ";
    std::cin >> celsius;

    fahrenheit = (celsius * 9.0 / 5.0) + 32.0;

    std::cout << celsius << "°C = " << fahrenheit << "°F" << std::endl;

    return 0;
}
```

## What's Next?

Now you can make your computer do math and compare values! Next, we'll learn:
- **Conditional statements (if/else)** - Making decisions
- **Switch statements** - Choosing between many options
- **Making programs that think!**

You're building real programming skills! Keep practicing! 🎯
