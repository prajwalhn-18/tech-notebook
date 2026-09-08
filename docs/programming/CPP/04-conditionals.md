# Conditionals - Making Decisions

## What Are Conditionals?

Imagine you're getting dressed in the morning. You look outside and think:
- **IF** it's raining, **THEN** I'll bring an umbrella
- **IF** it's cold, **THEN** I'll wear a jacket
- **OTHERWISE**, I'll wear a t-shirt

This is exactly what conditionals do in programming - they let your program make decisions!

## The if Statement

The basic structure:

```
if (condition is true) {
    do this code
}
```

### Simple if Example

```cpp
#include <iostream>

int main() {
    int temperature = 25;

    std::cout << "Temperature: " << temperature << "°F" << std::endl;

    if (temperature < 32) {
        std::cout << "It's freezing! Wear a warm coat!" << std::endl;
    }

    std::cout << "Have a great day!" << std::endl;

    return 0;
}
```

**Output:**
```
Temperature: 25°F
It's freezing! Wear a warm coat!
Have a great day!
```

**What happened:** Since 25 is less than 32, the code inside the `if` block ran.

Now try changing `temperature` to 50:

```cpp
int temperature = 50;
```

**Output:**
```
Temperature: 50°F
Have a great day!
```

The warning didn't print because the condition was false!

## The if-else Statement

Sometimes you want to do one thing if a condition is true, and something different if it's false.

```
if (condition is true) {
    do this
} else {
    do that instead
}
```

### if-else Example

```cpp
#include <iostream>

int main() {
    int age;

    std::cout << "How old are you? ";
    std::cin >> age;

    if (age >= 18) {
        std::cout << "You're an adult! You can vote!" << std::endl;
    } else {
        std::cout << "You're a kid or teenager." << std::endl;
    }

    return 0;
}
```

**Running with age 20:**
```
How old are you? 20
You're an adult! You can vote!
```

**Running with age 13:**
```
How old are you? 13
You're a kid or teenager.
```

## The if-else if-else Chain

What if you have more than two options? Use `else if`!

```cpp
#include <iostream>

int main() {
    int score;

    std::cout << "Enter your test score (0-100): ";
    std::cin >> score;

    if (score >= 90) {
        std::cout << "Grade: A - Excellent!" << std::endl;
    } else if (score >= 80) {
        std::cout << "Grade: B - Good job!" << std::endl;
    } else if (score >= 70) {
        std::cout << "Grade: C - Not bad!" << std::endl;
    } else if (score >= 60) {
        std::cout << "Grade: D - You passed!" << std::endl;
    } else {
        std::cout << "Grade: F - Study harder next time!" << std::endl;
    }

    return 0;
}
```

**Testing different scores:**

```
Enter your test score (0-100): 95
Grade: A - Excellent!

Enter your test score (0-100): 75
Grade: C - Not bad!

Enter your test score (0-100): 45
Grade: F - Study harder next time!
```

**How it works:**
1. Checks if score >= 90 (A)
2. If not, checks if score >= 80 (B)
3. If not, checks if score >= 70 (C)
4. If not, checks if score >= 60 (D)
5. If none of those, it must be F

**Important:** It stops checking as soon as one condition is true!

## Nested if Statements

You can put `if` statements inside other `if` statements!

```cpp
#include <iostream>

int main() {
    int age;
    bool hasLicense;

    std::cout << "How old are you? ";
    std::cin >> age;

    if (age >= 16) {
        std::cout << "You're old enough to drive!" << std::endl;

        std::cout << "Do you have a driver's license? (1 for yes, 0 for no): ";
        std::cin >> hasLicense;

        if (hasLicense) {
            std::cout << "Great! You can drive!" << std::endl;
        } else {
            std::cout << "You need to get your license first!" << std::endl;
        }
    } else {
        std::cout << "You're too young to drive." << std::endl;
    }

    return 0;
}
```

**Running the program (age 17, has license):**
```
How old are you? 17
You're old enough to drive!
Do you have a driver's license? (1 for yes, 0 for no): 1
Great! You can drive!
```

**Running the program (age 14):**
```
How old are you? 14
You're too young to drive.
```

## Logical Operators in Conditions

Remember `&&` (AND), `||` (OR), and `!` (NOT)? They're super useful in conditionals!

### AND (&&) - Both Must Be True

```cpp
#include <iostream>

int main() {
    int age;
    double money;

    std::cout << "How old are you? ";
    std::cin >> age;

    std::cout << "How much money do you have? $";
    std::cin >> money;

    if (age >= 13 && money >= 15) {
        std::cout << "You can watch the movie!" << std::endl;
    } else {
        std::cout << "Sorry, you can't watch the movie." << std::endl;

        if (age < 13) {
            std::cout << "You're too young (need to be 13+)" << std::endl;
        }
        if (money < 15) {
            std::cout << "You don't have enough money (need $15)" << std::endl;
        }
    }

    return 0;
}
```

**Test run:**
```
How old are you? 14
How much money do you have? $12
Sorry, you can't watch the movie.
You don't have enough money (need $15)
```

### OR (||) - At Least One Must Be True

```cpp
#include <iostream>

int main() {
    bool isWeekend;
    bool isHoliday;

    std::cout << "Is it the weekend? (1 for yes, 0 for no): ";
    std::cin >> isWeekend;

    std::cout << "Is it a holiday? (1 for yes, 0 for no): ";
    std::cin >> isHoliday;

    if (isWeekend || isHoliday) {
        std::cout << "Yay! No school today!" << std::endl;
    } else {
        std::cout << "Time for school!" << std::endl;
    }

    return 0;
}
```

**Test run:**
```
Is it the weekend? (1 for yes, 0 for no): 0
Is it a holiday? (1 for yes, 0 for no): 1
Yay! No school today!
```

### NOT (!) - Reverse the Condition

```cpp
#include <iostream>

int main() {
    bool isRaining;

    std::cout << "Is it raining? (1 for yes, 0 for no): ";
    std::cin >> isRaining;

    if (!isRaining) {
        std::cout << "Perfect weather for a walk!" << std::endl;
    } else {
        std::cout << "Better stay inside or bring an umbrella!" << std::endl;
    }

    return 0;
}
```

**Test run:**
```
Is it raining? (1 for yes, 0 for no): 0
Perfect weather for a walk!
```

## The Ternary Operator (Short if-else)

There's a super short way to write simple if-else statements:

```
condition ? valueIfTrue : valueIfFalse
```

### Example Without Ternary:

```cpp
#include <iostream>

int main() {
    int age = 17;
    std::string status;

    if (age >= 18) {
        status = "adult";
    } else {
        status = "minor";
    }

    std::cout << "You are a " << status << std::endl;

    return 0;
}
```

### Same Thing With Ternary:

```cpp
#include <iostream>

int main() {
    int age = 17;
    std::string status = (age >= 18) ? "adult" : "minor";

    std::cout << "You are a " << status << std::endl;

    return 0;
}
```

**Both output:**
```
You are a minor
```

**Another example:**

```cpp
#include <iostream>

int main() {
    int score = 85;
    std::string result = (score >= 60) ? "PASS" : "FAIL";

    std::cout << "Result: " << result << std::endl;

    return 0;
}
```

**Output:**
```
Result: PASS
```

**When to use ternary:**
- Only for simple cases
- When it makes code cleaner
- Not for complex conditions (use regular if-else)

## Switch Statement

When you have many possible values to check, `switch` can be cleaner than multiple `else if` statements.

```cpp
#include <iostream>

int main() {
    int day;

    std::cout << "Enter a number (1-7): ";
    std::cin >> day;

    switch (day) {
        case 1:
            std::cout << "Monday - Start of the week!" << std::endl;
            break;
        case 2:
            std::cout << "Tuesday - Keep going!" << std::endl;
            break;
        case 3:
            std::cout << "Wednesday - Halfway there!" << std::endl;
            break;
        case 4:
            std::cout << "Thursday - Almost weekend!" << std::endl;
            break;
        case 5:
            std::cout << "Friday - Weekend is here!" << std::endl;
            break;
        case 6:
            std::cout << "Saturday - Enjoy!" << std::endl;
            break;
        case 7:
            std::cout << "Sunday - Rest day!" << std::endl;
            break;
        default:
            std::cout << "Invalid day! Enter 1-7." << std::endl;
    }

    return 0;
}
```

**Running the program:**
```
Enter a number (1-7): 5
Friday - Weekend is here!
```

**Important parts:**
- `switch (day)` - What variable to check
- `case 1:` - If day equals 1
- `break;` - Exit the switch (very important!)
- `default:` - If none of the cases match

### What Happens Without break?

```cpp
#include <iostream>

int main() {
    int number = 2;

    switch (number) {
        case 1:
            std::cout << "One" << std::endl;
        case 2:
            std::cout << "Two" << std::endl;
        case 3:
            std::cout << "Three" << std::endl;
        default:
            std::cout << "Other" << std::endl;
    }

    return 0;
}
```

**Output:**
```
Two
Three
Other
```

Without `break`, it keeps going! This is called "fall-through" and is usually a bug.

### When Fall-through is Useful

Sometimes you want multiple cases to do the same thing:

```cpp
#include <iostream>

int main() {
    char grade;

    std::cout << "Enter your grade (A, B, C, D, F): ";
    std::cin >> grade;

    switch (grade) {
        case 'A':
        case 'a':
            std::cout << "Excellent! Keep it up!" << std::endl;
            break;
        case 'B':
        case 'b':
            std::cout << "Good job!" << std::endl;
            break;
        case 'C':
        case 'c':
            std::cout << "You passed!" << std::endl;
            break;
        case 'D':
        case 'd':
            std::cout << "You barely passed." << std::endl;
            break;
        case 'F':
        case 'f':
            std::cout << "You failed. Study harder!" << std::endl;
            break;
        default:
            std::cout << "Invalid grade!" << std::endl;
    }

    return 0;
}
```

This handles both uppercase and lowercase letters!

## Real-World Example: Simple Game Menu

```cpp
#include <iostream>

int main() {
    int choice;

    std::cout << "=== Game Menu ===" << std::endl;
    std::cout << "1. New Game" << std::endl;
    std::cout << "2. Load Game" << std::endl;
    std::cout << "3. Settings" << std::endl;
    std::cout << "4. Exit" << std::endl;
    std::cout << std::endl;
    std::cout << "Enter your choice (1-4): ";
    std::cin >> choice;

    if (choice == 1) {
        std::cout << "Starting new game..." << std::endl;
    } else if (choice == 2) {
        std::cout << "Loading saved game..." << std::endl;
    } else if (choice == 3) {
        std::cout << "Opening settings..." << std::endl;
    } else if (choice == 4) {
        std::cout << "Goodbye! Thanks for playing!" << std::endl;
    } else {
        std::cout << "Invalid choice! Please enter 1-4." << std::endl;
    }

    return 0;
}
```

**Same thing with switch:**

```cpp
#include <iostream>

int main() {
    int choice;

    std::cout << "=== Game Menu ===" << std::endl;
    std::cout << "1. New Game" << std::endl;
    std::cout << "2. Load Game" << std::endl;
    std::cout << "3. Settings" << std::endl;
    std::cout << "4. Exit" << std::endl;
    std::cout << std::endl;
    std::cout << "Enter your choice (1-4): ";
    std::cin >> choice;

    switch (choice) {
        case 1:
            std::cout << "Starting new game..." << std::endl;
            break;
        case 2:
            std::cout << "Loading saved game..." << std::endl;
            break;
        case 3:
            std::cout << "Opening settings..." << std::endl;
            break;
        case 4:
            std::cout << "Goodbye! Thanks for playing!" << std::endl;
            break;
        default:
            std::cout << "Invalid choice! Please enter 1-4." << std::endl;
    }

    return 0;
}
```

## Common Mistakes

### Mistake 1: Using = Instead of ==

```cpp
if (age = 18)
```

This SETS age to 18! Use `==`:

```cpp
if (age == 18)
```

### Mistake 2: Forgetting Braces

This works for one statement:

```cpp
if (score >= 60)
    std::cout << "You passed!" << std::endl;
```

But this is a bug:

```cpp
if (score >= 60)
    std::cout << "You passed!" << std::endl;
    std::cout << "Congratulations!" << std::endl;
```

The second line ALWAYS runs! Use braces:

```cpp
if (score >= 60) {
    std::cout << "You passed!" << std::endl;
    std::cout << "Congratulations!" << std::endl;
}
```

### Mistake 3: Forgetting break in Switch

```cpp
switch (choice) {
    case 1:
        std::cout << "Option 1" << std::endl;
    case 2:
        std::cout << "Option 2" << std::endl;
}
```

Both will print! Add `break`:

```cpp
switch (choice) {
    case 1:
        std::cout << "Option 1" << std::endl;
        break;
    case 2:
        std::cout << "Option 2" << std::endl;
        break;
}
```

## Practice Exercises

**1. Number Checker**
Write a program that asks for a number and tells if it's:
- Positive, negative, or zero
- Even or odd

**2. BMI Calculator**
Ask for height and weight, calculate BMI, and give health status:
- Under 18.5: Underweight
- 18.5-24.9: Normal
- 25-29.9: Overweight
- 30+: Obese

**3. Simple Calculator**
Ask for two numbers and an operation (+, -, *, /), then perform it.

**Example solution for number checker:**

```cpp
#include <iostream>

int main() {
    int number;

    std::cout << "Enter a number: ";
    std::cin >> number;

    if (number > 0) {
        std::cout << number << " is positive" << std::endl;
    } else if (number < 0) {
        std::cout << number << " is negative" << std::endl;
    } else {
        std::cout << number << " is zero" << std::endl;
    }

    if (number % 2 == 0) {
        std::cout << number << " is even" << std::endl;
    } else {
        std::cout << number << " is odd" << std::endl;
    }

    return 0;
}
```

## What's Next?

Now your programs can make decisions! Next, we'll learn about:
- **Loops** - Repeating actions automatically
- **while loops** - Repeat while a condition is true
- **for loops** - Repeat a specific number of times
- **do-while loops** - Always run at least once

Get ready to make your programs even more powerful! 🚀
