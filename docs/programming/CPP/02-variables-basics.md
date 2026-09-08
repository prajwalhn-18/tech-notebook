# Variables - Storing Information

## What is a Variable?

Imagine you have boxes in your room, and each box has a label. You can put different things in each box:
- A box labeled "age" holds how old you are
- A box labeled "name" holds your name
- A box labeled "score" holds your game score

In C++, **variables** are these labeled boxes that store information in your computer's memory.

## Creating Your First Variable

```cpp
#include <iostream>

int main() {
    int age;
    age = 13;

    std::cout << "I am " << age << " years old" << std::endl;

    return 0;
}
```

**What's happening here:**
1. `int age;` - Creates a box labeled "age" that can hold whole numbers
2. `age = 13;` - Puts the number 13 into that box
3. `std::cout << age` - Looks inside the box and prints what's there

**Output:**
```
I am 13 years old
```

## Declaring and Initializing Together

You can create a box and put something in it at the same time:

```cpp
#include <iostream>

int main() {
    int age = 13;

    std::cout << "I am " << age << " years old" << std::endl;

    return 0;
}
```

This does the same thing, just faster!

## Types of Variables (Data Types)

Just like in real life, different types of information need different types of boxes. C++ has several types:

### 1. int - Whole Numbers

Use `int` when you need whole numbers (no decimals).

```cpp
#include <iostream>

int main() {
    int lives = 3;
    int score = 1500;
    int level = 5;

    std::cout << "Lives: " << lives << std::endl;
    std::cout << "Score: " << score << std::endl;
    std::cout << "Level: " << level << std::endl;

    return 0;
}
```

**Output:**
```
Lives: 3
Score: 1500
Level: 5
```

**Range:** An `int` can hold numbers from about -2 billion to +2 billion.

### 2. double - Decimal Numbers

Use `double` when you need numbers with decimal points.

```cpp
#include <iostream>

int main() {
    double price = 19.99;
    double temperature = 98.6;
    double pi = 3.14159;

    std::cout << "Price: $" << price << std::endl;
    std::cout << "Temperature: " << temperature << "°F" << std::endl;
    std::cout << "Pi: " << pi << std::endl;

    return 0;
}
```

**Output:**
```
Price: $19.99
Temperature: 98.6°F
Pi: 3.14159
```

### 3. char - Single Characters

Use `char` for a single letter, digit, or symbol. Use single quotes `' '`.

```cpp
#include <iostream>

int main() {
    char grade = 'A';
    char initial = 'J';
    char symbol = '@';

    std::cout << "Grade: " << grade << std::endl;
    std::cout << "Initial: " << initial << std::endl;
    std::cout << "Symbol: " << symbol << std::endl;

    return 0;
}
```

**Output:**
```
Grade: A
Initial: J
Symbol: @
```

**Important:**
- Single character: `'A'` (single quotes)
- Text/string: `"Alex"` (double quotes)

### 4. bool - True or False

Use `bool` for yes/no or true/false values.

```cpp
#include <iostream>

int main() {
    bool isRaining = true;
    bool isSunny = false;
    bool hasTicket = true;

    std::cout << "Is it raining? " << isRaining << std::endl;
    std::cout << "Is it sunny? " << isSunny << std::endl;
    std::cout << "Has ticket? " << hasTicket << std::endl;

    return 0;
}
```

**Output:**
```
Is it raining? 1
Is it sunny? 0
Has ticket? 1
```

**Note:** `true` displays as 1, `false` displays as 0.

### 5. string - Text

Use `string` for words and sentences. Remember to include `<string>`!

```cpp
#include <iostream>
#include <string>

int main() {
    std::string name = "Alex";
    std::string favoriteGame = "Minecraft";
    std::string city = "New York";

    std::cout << "Name: " << name << std::endl;
    std::cout << "Favorite Game: " << favoriteGame << std::endl;
    std::cout << "City: " << city << std::endl;

    return 0;
}
```

**Output:**
```
Name: Alex
Favorite Game: Minecraft
City: New York
```

## Variable Names - The Rules

You can name variables almost anything, but there are rules:

### ✅ Good Names

```cpp
int age;
int playerScore;
int number_of_lives;
int total2;
int x;
```

### ❌ Bad Names (Will Cause Errors)

```cpp
int 2fast;
int my-score;
int player score;
int int;
int return;
```

### Rules for Naming:
1. **Must start with a letter or underscore** (`_`)
2. **Can contain letters, numbers, and underscores**
3. **No spaces allowed**
4. **Can't use special C++ words** (like `int`, `return`, `if`, etc.)
5. **Case matters!** `age` and `Age` are different variables

### Naming Styles

**camelCase** (popular in C++):
```cpp
int playerScore;
int numberOfLives;
```

**snake_case**:
```cpp
int player_score;
int number_of_lives;
```

**PascalCase** (usually for classes, which we'll learn later):
```cpp
int PlayerScore;
int NumberOfLives;
```

Pick one style and stick with it! Consistency makes code easier to read.

### Descriptive Names are Better

```cpp
int s;
int score;
```

Which is clearer? Use names that describe what the variable holds!

## Changing Variable Values

Variables can change (that's why they're called "variables"!)

```cpp
#include <iostream>

int main() {
    int health = 100;
    std::cout << "Starting health: " << health << std::endl;

    health = 75;
    std::cout << "After taking damage: " << health << std::endl;

    health = 90;
    std::cout << "After healing: " << health << std::endl;

    return 0;
}
```

**Output:**
```
Starting health: 100
After taking damage: 75
After healing: 90
```

## Constants - Values That Never Change

Sometimes you want a value that can never be changed. Use `const`:

```cpp
#include <iostream>

int main() {
    const int MAX_LIVES = 5;
    const double PI = 3.14159;
    const int SPEED_OF_LIGHT = 299792458;

    std::cout << "Maximum lives: " << MAX_LIVES << std::endl;
    std::cout << "Value of Pi: " << PI << std::endl;
    std::cout << "Speed of light: " << SPEED_OF_LIGHT << " m/s" << std::endl;

    return 0;
}
```

**Output:**
```
Maximum lives: 5
Value of Pi: 3.14159
Speed of light: 299792458 m/s
```

**Why use constants?**
- Prevents accidental changes
- Makes code more readable
- Easier to update (change in one place)

**Convention:** Constant names are usually ALL_CAPS with underscores.

If you try to change a constant, you'll get an error:

```cpp
const int MAX_LIVES = 5;
MAX_LIVES = 10;
```

**Compiler error:** assignment of read-only variable 'MAX_LIVES'

## Multiple Variables

You can declare multiple variables of the same type in one line:

```cpp
#include <iostream>

int main() {
    int x = 10, y = 20, z = 30;

    std::cout << "x = " << x << std::endl;
    std::cout << "y = " << y << std::endl;
    std::cout << "z = " << z << std::endl;

    return 0;
}
```

**Output:**
```
x = 10
y = 20
z = 30
```

But for beginners, writing them separately is clearer:

```cpp
int x = 10;
int y = 20;
int z = 30;
```

## Getting User Input

Let's make programs interactive! Use `std::cin` to get input from the user.

```cpp
#include <iostream>
#include <string>

int main() {
    std::string name;
    int age;

    std::cout << "What is your name? ";
    std::cin >> name;

    std::cout << "How old are you? ";
    std::cin >> age;

    std::cout << "\nNice to meet you, " << name << "!" << std::endl;
    std::cout << "You are " << age << " years old." << std::endl;

    return 0;
}
```

**Running this program:**
```
What is your name? Alex
How old are you? 13

Nice to meet you, Alex!
You are 13 years old.
```

**Understanding cin:**
- `std::cout` = output (printing TO screen)
- `std::cin` = input (reading FROM keyboard)
- `<<` = send data TO cout
- `>>` = get data FROM cin

## Reading Full Sentences

There's a problem with `std::cin` - it stops at spaces!

```cpp
#include <iostream>
#include <string>

int main() {
    std::string favoriteGame;

    std::cout << "What's your favorite game? ";
    std::cin >> favoriteGame;

    std::cout << "Cool! You like " << favoriteGame << std::endl;

    return 0;
}
```

**If you type "Minecraft Java Edition":**
```
What's your favorite game? Minecraft Java Edition
Cool! You like Minecraft
```

It only read "Minecraft"! To read the whole line, use `getline`:

```cpp
#include <iostream>
#include <string>

int main() {
    std::string favoriteGame;

    std::cout << "What's your favorite game? ";
    std::getline(std::cin, favoriteGame);

    std::cout << "Cool! You like " << favoriteGame << std::endl;

    return 0;
}
```

**Now it works:**
```
What's your favorite game? Minecraft Java Edition
Cool! You like Minecraft Java Edition
```

## Data Type Sizes

Different types use different amounts of computer memory:

| Type | Typical Size | Range/Notes |
|------|--------------|-------------|
| `char` | 1 byte | -128 to 127 or one character |
| `int` | 4 bytes | -2,147,483,648 to 2,147,483,647 |
| `long long` | 8 bytes | Really huge numbers |
| `float` | 4 bytes | Decimals (7 digits precision) |
| `double` | 8 bytes | Decimals (15 digits precision) |
| `bool` | 1 byte | true or false |

For really big numbers, use `long long`:

```cpp
#include <iostream>

int main() {
    long long bigNumber = 9223372036854775807;
    std::cout << "Huge number: " << bigNumber << std::endl;
    return 0;
}
```

## Type Conversion

Sometimes you need to convert between types:

```cpp
#include <iostream>

int main() {
    int wholeNumber = 7;
    double decimal = wholeNumber;

    std::cout << "Whole: " << wholeNumber << std::endl;
    std::cout << "Decimal: " << decimal << std::endl;

    double pi = 3.14159;
    int truncated = pi;

    std::cout << "Pi: " << pi << std::endl;
    std::cout << "Truncated: " << truncated << std::endl;

    return 0;
}
```

**Output:**
```
Whole: 7
Decimal: 7
Pi: 3.14159
Truncated: 3
```

**Warning:** Converting `double` to `int` removes the decimal part!

## Common Mistakes

### Mistake 1: Using a Variable Before Declaring It

```cpp
score = 100;
int score;
```

**Fix:** Declare before using:
```cpp
int score;
score = 100;
```

Or do both at once:
```cpp
int score = 100;
```

### Mistake 2: Forgetting Semicolons

```cpp
int age = 13
std::cout << age;
```

**Fix:** Add the semicolon:
```cpp
int age = 13;
std::cout << age;
```

### Mistake 3: Wrong Type for Data

```cpp
int price = 19.99;
```

This will become 19! Use `double` for decimals:
```cpp
double price = 19.99;
```

### Mistake 4: Forgetting to Initialize

```cpp
int score;
std::cout << score;
```

`score` has a random value! Always initialize:
```cpp
int score = 0;
std::cout << score;
```

## Practice Project: Profile Creator

Let's build a program that asks for multiple pieces of information and displays a profile:

```cpp
#include <iostream>
#include <string>

int main() {
    std::string name;
    int age;
    std::string favoriteColor;
    double height;
    bool likesGaming;

    std::cout << "=== Create Your Profile ===" << std::endl;
    std::cout << "\nWhat's your name? ";
    std::cin >> name;

    std::cout << "How old are you? ";
    std::cin >> age;

    std::cout << "What's your favorite color? ";
    std::cin >> favoriteColor;

    std::cout << "How tall are you in feet? (like 5.5) ";
    std::cin >> height;

    std::cout << "Do you like gaming? (1 for yes, 0 for no) ";
    std::cin >> likesGaming;

    std::cout << "\n=== YOUR PROFILE ===" << std::endl;
    std::cout << "Name: " << name << std::endl;
    std::cout << "Age: " << age << " years old" << std::endl;
    std::cout << "Favorite Color: " << favoriteColor << std::endl;
    std::cout << "Height: " << height << " feet" << std::endl;
    std::cout << "Likes Gaming: " << likesGaming << std::endl;

    return 0;
}
```

**Challenge:** Add more fields like favorite food, number of siblings, or favorite number!

## What's Next?

Now you know how to store and use different types of information! Next up:
- **Math Operations** - Making your computer calculate things
- **Operators** - Comparing values and making decisions
- **Conditions** - Making your programs smart with if/else

The fun is just beginning! 🚀
