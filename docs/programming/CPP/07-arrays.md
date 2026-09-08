# Arrays - Storing Multiple Values

## What is an Array?

Imagine you need to store test scores for 5 students. You could create 5 separate variables:

```cpp
int score1 = 85;
int score2 = 92;
int score3 = 78;
int score4 = 95;
int score5 = 88;
```

But what if you had 100 students? That's a mess!

An **array** is like a row of boxes, all labeled with numbers, that can store multiple values of the same type.

```
Array: scores
Index:    0     1     2     3     4
Value:  [85]  [92]  [78]  [95]  [88]
```

## Creating Arrays

**Basic syntax:**
```cpp
dataType arrayName[size];
```

### Simple Array Example

```cpp
#include <iostream>

int main() {
    int scores[5];

    scores[0] = 85;
    scores[1] = 92;
    scores[2] = 78;
    scores[3] = 95;
    scores[4] = 88;

    std::cout << "First score: " << scores[0] << std::endl;
    std::cout << "Third score: " << scores[2] << std::endl;

    return 0;
}
```

**Output:**
```
First score: 85
Third score: 78
```

**Important:** Arrays start at index 0, not 1!
- First element: `scores[0]`
- Second element: `scores[1]`
- Third element: `scores[2]`
- And so on...

## Initializing Arrays

You can set values when you create the array:

```cpp
#include <iostream>

int main() {
    int scores[5] = {85, 92, 78, 95, 88};

    std::cout << "All scores: ";
    std::cout << scores[0] << " ";
    std::cout << scores[1] << " ";
    std::cout << scores[2] << " ";
    std::cout << scores[3] << " ";
    std::cout << scores[4] << std::endl;

    return 0;
}
```

**Output:**
```
All scores: 85 92 78 95 88
```

### Shorter Initialization

Let C++ figure out the size:

```cpp
#include <iostream>

int main() {
    int numbers[] = {10, 20, 30, 40, 50};

    std::cout << numbers[0] << std::endl;
    std::cout << numbers[4] << std::endl;

    return 0;
}
```

**Output:**
```
10
50
```

## Arrays and Loops

Loops make working with arrays much easier!

### Printing an Array

```cpp
#include <iostream>

int main() {
    int scores[] = {85, 92, 78, 95, 88};
    int size = 5;

    std::cout << "All scores: ";
    for (int i = 0; i < size; i++) {
        std::cout << scores[i] << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
All scores: 85 92 78 95 88
```

### Getting Array Size

```cpp
#include <iostream>

int main() {
    int numbers[] = {10, 20, 30, 40, 50, 60};

    int size = sizeof(numbers) / sizeof(numbers[0]);

    std::cout << "Array has " << size << " elements" << std::endl;

    for (int i = 0; i < size; i++) {
        std::cout << "Element " << i << ": " << numbers[i] << std::endl;
    }

    return 0;
}
```

**Output:**
```
Array has 6 elements
Element 0: 10
Element 1: 20
Element 2: 30
Element 3: 40
Element 4: 50
Element 5: 60
```

**How it works:**
- `sizeof(numbers)` = total bytes used by array
- `sizeof(numbers[0])` = bytes for one element
- Dividing gives the number of elements

## Filling an Array from User Input

```cpp
#include <iostream>

int main() {
    int scores[5];
    int size = 5;

    std::cout << "Enter 5 test scores:" << std::endl;
    for (int i = 0; i < size; i++) {
        std::cout << "Score " << (i + 1) << ": ";
        std::cin >> scores[i];
    }

    std::cout << "\nYour scores: ";
    for (int i = 0; i < size; i++) {
        std::cout << scores[i] << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Running the program:**
```
Enter 5 test scores:
Score 1: 85
Score 2: 90
Score 3: 78
Score 4: 92
Score 5: 88

Your scores: 85 90 78 92 88
```

## Calculating with Arrays

### Finding the Sum and Average

```cpp
#include <iostream>

int main() {
    int scores[] = {85, 92, 78, 95, 88};
    int size = 5;
    int sum = 0;

    for (int i = 0; i < size; i++) {
        sum += scores[i];
    }

    double average = static_cast<double>(sum) / size;

    std::cout << "Scores: ";
    for (int i = 0; i < size; i++) {
        std::cout << scores[i] << " ";
    }
    std::cout << std::endl;

    std::cout << "Sum: " << sum << std::endl;
    std::cout << "Average: " << average << std::endl;

    return 0;
}
```

**Output:**
```
Scores: 85 92 78 95 88
Sum: 438
Average: 87.6
```

### Finding the Maximum Value

```cpp
#include <iostream>

int main() {
    int numbers[] = {23, 67, 12, 89, 45, 34};
    int size = 6;

    int max = numbers[0];

    for (int i = 1; i < size; i++) {
        if (numbers[i] > max) {
            max = numbers[i];
        }
    }

    std::cout << "Numbers: ";
    for (int i = 0; i < size; i++) {
        std::cout << numbers[i] << " ";
    }
    std::cout << std::endl;

    std::cout << "Maximum value: " << max << std::endl;

    return 0;
}
```

**Output:**
```
Numbers: 23 67 12 89 45 34
Maximum value: 89
```

### Finding the Minimum Value

```cpp
#include <iostream>

int main() {
    int numbers[] = {23, 67, 12, 89, 45, 34};
    int size = 6;

    int min = numbers[0];

    for (int i = 1; i < size; i++) {
        if (numbers[i] < min) {
            min = numbers[i];
        }
    }

    std::cout << "Numbers: ";
    for (int i = 0; i < size; i++) {
        std::cout << numbers[i] << " ";
    }
    std::cout << std::endl;

    std::cout << "Minimum value: " << min << std::endl;

    return 0;
}
```

**Output:**
```
Numbers: 23 67 12 89 45 34
Minimum value: 12
```

## Searching in Arrays

### Linear Search

```cpp
#include <iostream>

int main() {
    int numbers[] = {15, 23, 8, 42, 17, 31};
    int size = 6;
    int target;

    std::cout << "Array: ";
    for (int i = 0; i < size; i++) {
        std::cout << numbers[i] << " ";
    }
    std::cout << std::endl;

    std::cout << "Enter number to search for: ";
    std::cin >> target;

    bool found = false;
    int position = -1;

    for (int i = 0; i < size; i++) {
        if (numbers[i] == target) {
            found = true;
            position = i;
            break;
        }
    }

    if (found) {
        std::cout << target << " found at index " << position << std::endl;
    } else {
        std::cout << target << " not found in array" << std::endl;
    }

    return 0;
}
```

**Sample run:**
```
Array: 15 23 8 42 17 31
Enter number to search for: 42
42 found at index 3
```

## Modifying Array Elements

```cpp
#include <iostream>

int main() {
    int numbers[] = {10, 20, 30, 40, 50};
    int size = 5;

    std::cout << "Original array: ";
    for (int i = 0; i < size; i++) {
        std::cout << numbers[i] << " ";
    }
    std::cout << std::endl;

    for (int i = 0; i < size; i++) {
        numbers[i] *= 2;
    }

    std::cout << "After doubling: ";
    for (int i = 0; i < size; i++) {
        std::cout << numbers[i] << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
Original array: 10 20 30 40 50
After doubling: 20 40 60 80 100
```

## Multi-Dimensional Arrays

Arrays can have more than one dimension! Think of it like a grid or table.

### 2D Array - Grid/Table

```cpp
#include <iostream>

int main() {
    int grid[3][4] = {
        {1, 2, 3, 4},
        {5, 6, 7, 8},
        {9, 10, 11, 12}
    };

    std::cout << "Grid:" << std::endl;
    for (int row = 0; row < 3; row++) {
        for (int col = 0; col < 4; col++) {
            std::cout << grid[row][col] << "\t";
        }
        std::cout << std::endl;
    }

    return 0;
}
```

**Output:**
```
Grid:
1    2    3    4
5    6    7    8
9    10   11   12
```

### Tic-Tac-Toe Board

```cpp
#include <iostream>

int main() {
    char board[3][3] = {
        {'X', 'O', 'X'},
        {'O', 'X', 'O'},
        {'O', 'X', 'X'}
    };

    std::cout << "Tic-Tac-Toe Board:" << std::endl;
    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
            std::cout << board[i][j] << " ";
        }
        std::cout << std::endl;
    }

    return 0;
}
```

**Output:**
```
Tic-Tac-Toe Board:
X O X
O X O
O X X
```

### Grade Table

```cpp
#include <iostream>

int main() {
    int grades[3][4] = {
        {85, 90, 78, 92},
        {88, 76, 95, 89},
        {91, 84, 87, 93}
    };

    std::cout << "Student Grades:" << std::endl;
    std::cout << "Test1\tTest2\tTest3\tTest4" << std::endl;

    for (int student = 0; student < 3; student++) {
        std::cout << "Student " << (student + 1) << ": ";
        for (int test = 0; test < 4; test++) {
            std::cout << grades[student][test] << "\t";
        }
        std::cout << std::endl;
    }

    return 0;
}
```

**Output:**
```
Student Grades:
Test1   Test2   Test3   Test4
Student 1: 85   90      78      92
Student 2: 88   76      95      89
Student 3: 91   84      87      93
```

## Arrays with Functions

### Passing Arrays to Functions

```cpp
#include <iostream>

void printArray(int arr[], int size) {
    for (int i = 0; i < size; i++) {
        std::cout << arr[i] << " ";
    }
    std::cout << std::endl;
}

int sumArray(int arr[], int size) {
    int total = 0;
    for (int i = 0; i < size; i++) {
        total += arr[i];
    }
    return total;
}

int main() {
    int numbers[] = {10, 20, 30, 40, 50};
    int size = 5;

    std::cout << "Array: ";
    printArray(numbers, size);

    int sum = sumArray(numbers, size);
    std::cout << "Sum: " << sum << std::endl;

    return 0;
}
```

**Output:**
```
Array: 10 20 30 40 50
Sum: 150
```

**Note:** Arrays are automatically passed by reference, so functions can modify the original array!

### Modifying Array in Function

```cpp
#include <iostream>

void doubleValues(int arr[], int size) {
    for (int i = 0; i < size; i++) {
        arr[i] *= 2;
    }
}

int main() {
    int numbers[] = {5, 10, 15, 20};
    int size = 4;

    std::cout << "Before: ";
    for (int i = 0; i < size; i++) {
        std::cout << numbers[i] << " ";
    }
    std::cout << std::endl;

    doubleValues(numbers, size);

    std::cout << "After: ";
    for (int i = 0; i < size; i++) {
        std::cout << numbers[i] << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
Before: 5 10 15 20
After: 10 20 30 40
```

## Common Array Algorithms

### Reversing an Array

```cpp
#include <iostream>

void reverseArray(int arr[], int size) {
    int start = 0;
    int end = size - 1;

    while (start < end) {
        int temp = arr[start];
        arr[start] = arr[end];
        arr[end] = temp;

        start++;
        end--;
    }
}

int main() {
    int numbers[] = {1, 2, 3, 4, 5};
    int size = 5;

    std::cout << "Original: ";
    for (int i = 0; i < size; i++) {
        std::cout << numbers[i] << " ";
    }
    std::cout << std::endl;

    reverseArray(numbers, size);

    std::cout << "Reversed: ";
    for (int i = 0; i < size; i++) {
        std::cout << numbers[i] << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
Original: 1 2 3 4 5
Reversed: 5 4 3 2 1
```

### Copying an Array

```cpp
#include <iostream>

void copyArray(int source[], int dest[], int size) {
    for (int i = 0; i < size; i++) {
        dest[i] = source[i];
    }
}

int main() {
    int original[] = {10, 20, 30, 40, 50};
    int copy[5];
    int size = 5;

    copyArray(original, copy, size);

    std::cout << "Original: ";
    for (int i = 0; i < size; i++) {
        std::cout << original[i] << " ";
    }
    std::cout << std::endl;

    std::cout << "Copy: ";
    for (int i = 0; i < size; i++) {
        std::cout << copy[i] << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
Original: 10 20 30 40 50
Copy: 10 20 30 40 50
```

## Character Arrays (C-Strings)

Before `std::string`, C++ used character arrays for text:

```cpp
#include <iostream>

int main() {
    char name[20];

    std::cout << "Enter your name: ";
    std::cin >> name;

    std::cout << "Hello, " << name << "!" << std::endl;

    return 0;
}
```

**Output:**
```
Enter your name: Alex
Hello, Alex!
```

**Note:** `std::string` is usually easier and safer to use!

## Common Mistakes

### Mistake 1: Index Out of Bounds

```cpp
int numbers[5] = {10, 20, 30, 40, 50};
std::cout << numbers[5];
```

The last valid index is 4, not 5! This causes undefined behavior.

### Mistake 2: Not Initializing Arrays

```cpp
int scores[5];
std::cout << scores[0];
```

The array contains random garbage values! Always initialize:

```cpp
int scores[5] = {0};
```

### Mistake 3: Comparing Arrays with ==

```cpp
int arr1[] = {1, 2, 3};
int arr2[] = {1, 2, 3};
if (arr1 == arr2)
```

This doesn't compare values! You need to loop and compare each element.

## Practice Exercises

**1. Temperature Tracker**
Store 7 days of temperatures, find the average, and identify hottest/coldest days.

**2. Grade Book**
Store grades for multiple students and tests, calculate averages per student.

**3. Number Frequency**
Count how many times each digit (0-9) appears in an array.

**Example solution for temperature tracker:**

```cpp
#include <iostream>

int main() {
    double temps[7];

    std::cout << "Enter temperatures for 7 days:" << std::endl;
    for (int i = 0; i < 7; i++) {
        std::cout << "Day " << (i + 1) << ": ";
        std::cin >> temps[i];
    }

    double sum = 0;
    double max = temps[0];
    double min = temps[0];

    for (int i = 0; i < 7; i++) {
        sum += temps[i];
        if (temps[i] > max) max = temps[i];
        if (temps[i] < min) min = temps[i];
    }

    double average = sum / 7;

    std::cout << "\nAverage temperature: " << average << "°F" << std::endl;
    std::cout << "Hottest day: " << max << "°F" << std::endl;
    std::cout << "Coldest day: " << min << "°F" << std::endl;

    return 0;
}
```

## What's Next?

Arrays are powerful, but they have limitations (fixed size, manual management). Next, we'll learn about:
- **Vectors** - Dynamic arrays that can grow and shrink
- **Better ways to work with collections**
- **More flexibility with data!**

You're getting really good at this! 🎯
