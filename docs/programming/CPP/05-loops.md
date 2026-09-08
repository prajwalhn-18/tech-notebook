# Loops - Repeating Actions

## What Are Loops?

Imagine you need to write "I will practice coding" 100 times. Would you type it 100 times? No way! That's where loops come in.

A **loop** repeats code multiple times automatically. It's like telling your computer: "Do this thing over and over until I tell you to stop."

## Types of Loops

C++ has three main types of loops:
1. **while loop** - Repeat while a condition is true
2. **for loop** - Repeat a specific number of times
3. **do-while loop** - Like while, but always runs at least once

## The while Loop

The `while` loop keeps running as long as a condition is true.

**Structure:**
```
while (condition is true) {
    do this code
}
```

### Basic while Loop Example

```cpp
#include <iostream>

int main() {
    int count = 1;

    while (count <= 5) {
        std::cout << "Count: " << count << std::endl;
        count++;
    }

    std::cout << "Done!" << std::endl;

    return 0;
}
```

**Output:**
```
Count: 1
Count: 2
Count: 3
Count: 4
Count: 5
Done!
```

**What's happening:**
1. Start with count = 1
2. Check: Is count <= 5? Yes!
3. Print count
4. Increase count by 1
5. Go back to step 2
6. Repeat until count > 5

### Counting Down

```cpp
#include <iostream>

int main() {
    int countdown = 10;

    std::cout << "Rocket launch in..." << std::endl;

    while (countdown > 0) {
        std::cout << countdown << "..." << std::endl;
        countdown--;
    }

    std::cout << "Blast off! 🚀" << std::endl;

    return 0;
}
```

**Output:**
```
Rocket launch in...
10...
9...
8...
7...
6...
5...
4...
3...
2...
1...
Blast off! 🚀
```

### User Input Example

```cpp
#include <iostream>

int main() {
    int number = 0;

    while (number != 7) {
        std::cout << "Guess the secret number (1-10): ";
        std::cin >> number;

        if (number == 7) {
            std::cout << "Correct! You found it!" << std::endl;
        } else {
            std::cout << "Wrong! Try again..." << std::endl;
        }
    }

    return 0;
}
```

**Running the program:**
```
Guess the secret number (1-10): 3
Wrong! Try again...
Guess the secret number (1-10): 8
Wrong! Try again...
Guess the secret number (1-10): 7
Correct! You found it!
```

### Infinite Loops (Be Careful!)

If the condition is always true, the loop never stops!

```cpp
#include <iostream>

int main() {
    int number = 1;

    while (number > 0) {
        std::cout << "This will run forever!" << std::endl;
    }

    return 0;
}
```

This is called an **infinite loop**. The program will keep running until you force it to stop (Ctrl+C in terminal).

**How to avoid:** Make sure your loop variable changes and eventually makes the condition false.

## The for Loop

The `for` loop is perfect when you know exactly how many times you want to repeat something.

**Structure:**
```
for (initialize; condition; update) {
    do this code
}
```

### Basic for Loop Example

```cpp
#include <iostream>

int main() {
    for (int i = 1; i <= 5; i++) {
        std::cout << "Number: " << i << std::endl;
    }

    return 0;
}
```

**Output:**
```
Number: 1
Number: 2
Number: 3
Number: 4
Number: 5
```

**Breaking it down:**
- `int i = 1` - Start with i = 1 (runs once at the beginning)
- `i <= 5` - Keep going while i is 5 or less
- `i++` - After each loop, increase i by 1
- `i` is called the "loop counter" or "iterator"

### Printing Your Times Tables

```cpp
#include <iostream>

int main() {
    int number = 5;

    std::cout << "Times table for " << number << ":" << std::endl;

    for (int i = 1; i <= 10; i++) {
        std::cout << number << " x " << i << " = " << (number * i) << std::endl;
    }

    return 0;
}
```

**Output:**
```
Times table for 5:
5 x 1 = 5
5 x 2 = 10
5 x 3 = 15
5 x 4 = 20
5 x 5 = 25
5 x 6 = 30
5 x 7 = 35
5 x 8 = 40
5 x 9 = 45
5 x 10 = 50
```

### Counting by Different Amounts

```cpp
#include <iostream>

int main() {
    std::cout << "Count by 2s:" << std::endl;
    for (int i = 0; i <= 20; i += 2) {
        std::cout << i << " ";
    }
    std::cout << std::endl;

    std::cout << "Count by 5s:" << std::endl;
    for (int i = 0; i <= 50; i += 5) {
        std::cout << i << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
Count by 2s:
0 2 4 6 8 10 12 14 16 18 20
Count by 5s:
0 5 10 15 20 25 30 35 40 45 50
```

### Counting Backwards

```cpp
#include <iostream>

int main() {
    std::cout << "Countdown from 10 to 1:" << std::endl;

    for (int i = 10; i >= 1; i--) {
        std::cout << i << " ";
    }

    std::cout << std::endl << "Go!" << std::endl;

    return 0;
}
```

**Output:**
```
Countdown from 10 to 1:
10 9 8 7 6 5 4 3 2 1
Go!
```

## for Loop vs while Loop

They can often do the same thing!

**Using while:**
```cpp
int i = 1;
while (i <= 5) {
    std::cout << i << " ";
    i++;
}
```

**Using for:**
```cpp
for (int i = 1; i <= 5; i++) {
    std::cout << i << " ";
}
```

**Both output:** `1 2 3 4 5`

**When to use which:**
- Use `for` when you know how many times to loop
- Use `while` when you loop until a condition changes

## The do-while Loop

Similar to `while`, but it ALWAYS runs at least once!

**Structure:**
```
do {
    do this code
} while (condition is true);
```

### do-while Example

```cpp
#include <iostream>

int main() {
    int number;

    do {
        std::cout << "Enter a positive number: ";
        std::cin >> number;

        if (number <= 0) {
            std::cout << "That's not positive! Try again." << std::endl;
        }
    } while (number <= 0);

    std::cout << "Great! You entered: " << number << std::endl;

    return 0;
}
```

**Running the program:**
```
Enter a positive number: -5
That's not positive! Try again.
Enter a positive number: 0
That's not positive! Try again.
Enter a positive number: 10
Great! You entered: 10
```

### while vs do-while Difference

**Using while:**
```cpp
#include <iostream>

int main() {
    int count = 10;

    while (count < 5) {
        std::cout << "This never runs!" << std::endl;
        count++;
    }

    return 0;
}
```

**Output:** Nothing! The condition is false from the start.

**Using do-while:**
```cpp
#include <iostream>

int main() {
    int count = 10;

    do {
        std::cout << "This runs once!" << std::endl;
        count++;
    } while (count < 5);

    return 0;
}
```

**Output:** `This runs once!`

The do-while runs the code first, THEN checks the condition.

## Nested Loops

You can put loops inside other loops!

### Drawing a Rectangle

```cpp
#include <iostream>

int main() {
    int rows = 5;
    int cols = 8;

    for (int i = 1; i <= rows; i++) {
        for (int j = 1; j <= cols; j++) {
            std::cout << "* ";
        }
        std::cout << std::endl;
    }

    return 0;
}
```

**Output:**
```
* * * * * * * *
* * * * * * * *
* * * * * * * *
* * * * * * * *
* * * * * * * *
```

**How it works:**
1. Outer loop runs 5 times (rows)
2. For each row, inner loop runs 8 times (cols)
3. Print a star for each column
4. After inner loop, print a new line

### Multiplication Table

```cpp
#include <iostream>

int main() {
    std::cout << "Multiplication Table (1-10):" << std::endl;
    std::cout << std::endl;

    for (int i = 1; i <= 10; i++) {
        for (int j = 1; j <= 10; j++) {
            std::cout << (i * j) << "\t";
        }
        std::cout << std::endl;
    }

    return 0;
}
```

**Output:**
```
Multiplication Table (1-10):

1    2    3    4    5    6    7    8    9    10
2    4    6    8    10   12   14   16   18   20
3    6    9    12   15   18   21   24   27   30
4    8    12   16   20   24   28   32   36   40
5    10   15   20   25   30   35   40   45   50
6    12   18   24   30   36   42   48   54   60
7    14   21   28   35   42   49   56   63   70
8    16   24   32   40   48   56   64   72   80
9    18   27   36   45   54   63   72   81   90
10   20   30   40   50   60   70   80   90   100
```

**Note:** `\t` creates a tab (spacing)

### Triangle Pattern

```cpp
#include <iostream>

int main() {
    int height = 5;

    for (int i = 1; i <= height; i++) {
        for (int j = 1; j <= i; j++) {
            std::cout << "* ";
        }
        std::cout << std::endl;
    }

    return 0;
}
```

**Output:**
```
*
* *
* * *
* * * *
* * * * *
```

## Loop Control: break and continue

### break - Exit the Loop Early

```cpp
#include <iostream>

int main() {
    for (int i = 1; i <= 10; i++) {
        std::cout << i << " ";

        if (i == 5) {
            std::cout << std::endl << "Breaking at 5!" << std::endl;
            break;
        }
    }

    return 0;
}
```

**Output:**
```
1 2 3 4 5
Breaking at 5!
```

The loop stops completely when it hits `break`.

### continue - Skip to Next Iteration

```cpp
#include <iostream>

int main() {
    for (int i = 1; i <= 10; i++) {
        if (i % 2 == 0) {
            continue;
        }
        std::cout << i << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
1 3 5 7 9
```

When it hits `continue`, it skips the rest of the loop body and goes to the next iteration.

### Finding a Number

```cpp
#include <iostream>

int main() {
    int target = 42;
    bool found = false;

    for (int i = 1; i <= 100; i++) {
        if (i == target) {
            std::cout << "Found " << target << " at position " << i << "!" << std::endl;
            found = true;
            break;
        }
    }

    if (!found) {
        std::cout << "Number not found!" << std::endl;
    }

    return 0;
}
```

**Output:**
```
Found 42 at position 42!
```

## Real-World Example: Simple Number Guessing Game

```cpp
#include <iostream>

int main() {
    int secretNumber = 7;
    int guess;
    int attempts = 0;
    int maxAttempts = 5;

    std::cout << "=== Number Guessing Game ===" << std::endl;
    std::cout << "I'm thinking of a number between 1 and 10!" << std::endl;
    std::cout << "You have " << maxAttempts << " attempts." << std::endl;
    std::cout << std::endl;

    while (attempts < maxAttempts) {
        std::cout << "Attempt " << (attempts + 1) << " - Enter your guess: ";
        std::cin >> guess;

        attempts++;

        if (guess == secretNumber) {
            std::cout << "🎉 Correct! You won in " << attempts << " attempts!" << std::endl;
            break;
        } else if (guess < secretNumber) {
            std::cout << "Too low! Try again." << std::endl;
        } else {
            std::cout << "Too high! Try again." << std::endl;
        }

        if (attempts == maxAttempts) {
            std::cout << "Game Over! The number was " << secretNumber << std::endl;
        }
    }

    return 0;
}
```

**Sample game:**
```
=== Number Guessing Game ===
I'm thinking of a number between 1 and 10!
You have 5 attempts.

Attempt 1 - Enter your guess: 5
Too low! Try again.
Attempt 2 - Enter your guess: 8
Too high! Try again.
Attempt 3 - Enter your guess: 7
🎉 Correct! You won in 3 attempts!
```

## Common Mistakes

### Mistake 1: Off-by-One Errors

```cpp
for (int i = 1; i < 10; i++) {
    std::cout << i << " ";
}
```

This prints 1-9, not 1-10! Use `<=` instead:

```cpp
for (int i = 1; i <= 10; i++) {
    std::cout << i << " ";
}
```

### Mistake 2: Forgetting to Update Loop Variable

```cpp
int i = 1;
while (i <= 5) {
    std::cout << i << " ";
}
```

This is an infinite loop! `i` never changes. Add `i++`:

```cpp
int i = 1;
while (i <= 5) {
    std::cout << i << " ";
    i++;
}
```

### Mistake 3: Wrong Condition

```cpp
for (int i = 10; i >= 1; i++) {
    std::cout << i << " ";
}
```

This never runs! You're counting UP but checking if `i >= 1`. Use `i--`:

```cpp
for (int i = 10; i >= 1; i--) {
    std::cout << i << " ";
}
```

## Practice Exercises

**1. Sum Calculator**
Ask the user how many numbers they want to add, then ask for each number and show the total.

**2. Factorial Calculator**
Calculate the factorial of a number (5! = 5 × 4 × 3 × 2 × 1 = 120)

**3. Pattern Maker**
Create a program that asks for a height and draws different patterns (square, triangle, pyramid)

**Example solution for sum calculator:**

```cpp
#include <iostream>

int main() {
    int count, number, sum = 0;

    std::cout << "How many numbers do you want to add? ";
    std::cin >> count;

    for (int i = 1; i <= count; i++) {
        std::cout << "Enter number " << i << ": ";
        std::cin >> number;
        sum += number;
    }

    std::cout << "Total sum: " << sum << std::endl;

    return 0;
}
```

## What's Next?

Now you can make your programs repeat actions automatically! Next, we'll learn:
- **Functions** - Organizing code into reusable pieces
- **Parameters and return values**
- **Making your code cleaner and easier to understand**

You're becoming a real programmer! 🎯
