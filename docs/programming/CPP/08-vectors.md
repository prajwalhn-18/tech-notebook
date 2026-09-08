# Vectors - Dynamic Arrays

## What is a Vector?

Remember arrays? They're great, but they have a problem: their size is fixed. Once you create an array with 5 elements, it's always 5 elements.

**Vectors** are like smart arrays that can:
- Grow when you add more items
- Shrink when you remove items
- Remember their own size
- Check if you go out of bounds

Think of a vector like a magical backpack that expands as you put more things in it!

## Creating Vectors

First, you need to include the vector library:

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers;

    std::cout << "Created an empty vector!" << std::endl;

    return 0;
}
```

**Breaking it down:**
- `#include <vector>` - Get the vector tools
- `std::vector<int>` - A vector that holds integers
- `<int>` is the type (could be `<double>`, `<string>`, etc.)

## Adding Elements

### Using push_back()

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers;

    numbers.push_back(10);
    numbers.push_back(20);
    numbers.push_back(30);

    std::cout << "Vector has " << numbers.size() << " elements" << std::endl;

    return 0;
}
```

**Output:**
```
Vector has 3 elements
```

`push_back()` adds an element to the end of the vector.

## Accessing Elements

### Using [] Operator

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers;

    numbers.push_back(100);
    numbers.push_back(200);
    numbers.push_back(300);

    std::cout << "First element: " << numbers[0] << std::endl;
    std::cout << "Second element: " << numbers[1] << std::endl;
    std::cout << "Third element: " << numbers[2] << std::endl;

    return 0;
}
```

**Output:**
```
First element: 100
Second element: 200
Third element: 300
```

### Using at() for Safety

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {10, 20, 30};

    std::cout << "Element at index 1: " << numbers.at(1) << std::endl;

    return 0;
}
```

**Output:**
```
Element at index 1: 20
```

`at()` checks if the index is valid and throws an error if not. `[]` doesn't check!

## Initializing Vectors

### With Values

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {10, 20, 30, 40, 50};

    std::cout << "Vector size: " << numbers.size() << std::endl;

    for (int i = 0; i < numbers.size(); i++) {
        std::cout << numbers[i] << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
Vector size: 5
10 20 30 40 50
```

### With Size

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers(5);

    std::cout << "Created vector with size: " << numbers.size() << std::endl;

    for (int i = 0; i < numbers.size(); i++) {
        std::cout << numbers[i] << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
Created vector with size: 5
0 0 0 0 0
```

### With Size and Default Value

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers(5, 100);

    for (int i = 0; i < numbers.size(); i++) {
        std::cout << numbers[i] << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
100 100 100 100 100
```

## Vector Operations

### size() - Get Number of Elements

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {10, 20, 30, 40};

    std::cout << "Size: " << numbers.size() << std::endl;

    return 0;
}
```

**Output:**
```
Size: 4
```

### empty() - Check if Empty

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers;

    if (numbers.empty()) {
        std::cout << "Vector is empty!" << std::endl;
    }

    numbers.push_back(10);

    if (!numbers.empty()) {
        std::cout << "Vector has elements!" << std::endl;
    }

    return 0;
}
```

**Output:**
```
Vector is empty!
Vector has elements!
```

### clear() - Remove All Elements

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {10, 20, 30, 40, 50};

    std::cout << "Size before clear: " << numbers.size() << std::endl;

    numbers.clear();

    std::cout << "Size after clear: " << numbers.size() << std::endl;

    return 0;
}
```

**Output:**
```
Size before clear: 5
Size after clear: 0
```

### pop_back() - Remove Last Element

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {10, 20, 30, 40, 50};

    std::cout << "Before: ";
    for (int i = 0; i < numbers.size(); i++) {
        std::cout << numbers[i] << " ";
    }
    std::cout << std::endl;

    numbers.pop_back();

    std::cout << "After pop_back: ";
    for (int i = 0; i < numbers.size(); i++) {
        std::cout << numbers[i] << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
Before: 10 20 30 40 50
After pop_back: 10 20 30 40
```

### front() and back() - Access First and Last

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {10, 20, 30, 40, 50};

    std::cout << "First element: " << numbers.front() << std::endl;
    std::cout << "Last element: " << numbers.back() << std::endl;

    return 0;
}
```

**Output:**
```
First element: 10
Last element: 50
```

## Looping Through Vectors

### Using Regular for Loop

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> scores = {85, 92, 78, 95, 88};

    std::cout << "Scores: ";
    for (int i = 0; i < scores.size(); i++) {
        std::cout << scores[i] << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
Scores: 85 92 78 95 88
```

### Using Range-Based for Loop (Easier!)

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> scores = {85, 92, 78, 95, 88};

    std::cout << "Scores: ";
    for (int score : scores) {
        std::cout << score << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
Scores: 85 92 78 95 88
```

This is cleaner! `for (int score : scores)` means "for each score in scores"

## Modifying Vectors

### Changing Values

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {10, 20, 30, 40, 50};

    std::cout << "Before: ";
    for (int num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;

    numbers[2] = 300;

    std::cout << "After changing index 2: ";
    for (int num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
Before: 10 20 30 40 50
After changing index 2: 10 20 300 40 50
```

### Doubling All Values

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {1, 2, 3, 4, 5};

    std::cout << "Before: ";
    for (int num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;

    for (int i = 0; i < numbers.size(); i++) {
        numbers[i] *= 2;
    }

    std::cout << "After doubling: ";
    for (int num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
Before: 1 2 3 4 5
After doubling: 2 4 6 8 10
```

## Vectors with Different Types

### String Vector

```cpp
#include <iostream>
#include <vector>
#include <string>

int main() {
    std::vector<std::string> names;

    names.push_back("Alice");
    names.push_back("Bob");
    names.push_back("Charlie");

    std::cout << "Names:" << std::endl;
    for (std::string name : names) {
        std::cout << "- " << name << std::endl;
    }

    return 0;
}
```

**Output:**
```
Names:
- Alice
- Bob
- Charlie
```

### Double Vector

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<double> prices = {19.99, 29.99, 39.99, 49.99};

    std::cout << "Prices:" << std::endl;
    for (double price : prices) {
        std::cout << "$" << price << std::endl;
    }

    return 0;
}
```

**Output:**
```
Prices:
$19.99
$29.99
$39.99
$49.99
```

## Searching in Vectors

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {15, 23, 8, 42, 17, 31};
    int target;

    std::cout << "Numbers: ";
    for (int num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;

    std::cout << "Enter number to find: ";
    std::cin >> target;

    bool found = false;
    int position = -1;

    for (int i = 0; i < numbers.size(); i++) {
        if (numbers[i] == target) {
            found = true;
            position = i;
            break;
        }
    }

    if (found) {
        std::cout << target << " found at index " << position << std::endl;
    } else {
        std::cout << target << " not found!" << std::endl;
    }

    return 0;
}
```

**Sample run:**
```
Numbers: 15 23 8 42 17 31
Enter number to find: 42
42 found at index 3
```

## Calculating with Vectors

### Sum and Average

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> scores = {85, 92, 78, 95, 88, 91};

    int sum = 0;
    for (int score : scores) {
        sum += score;
    }

    double average = static_cast<double>(sum) / scores.size();

    std::cout << "Scores: ";
    for (int score : scores) {
        std::cout << score << " ";
    }
    std::cout << std::endl;

    std::cout << "Sum: " << sum << std::endl;
    std::cout << "Average: " << average << std::endl;

    return 0;
}
```

**Output:**
```
Scores: 85 92 78 95 88 91
Sum: 529
Average: 88.1667
```

### Min and Max

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {45, 12, 89, 23, 67, 34};

    int min = numbers[0];
    int max = numbers[0];

    for (int num : numbers) {
        if (num < min) min = num;
        if (num > max) max = num;
    }

    std::cout << "Numbers: ";
    for (int num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;

    std::cout << "Minimum: " << min << std::endl;
    std::cout << "Maximum: " << max << std::endl;

    return 0;
}
```

**Output:**
```
Numbers: 45 12 89 23 67 34
Minimum: 12
Maximum: 89
```

## Vectors with Functions

### Passing by Value (Copy)

```cpp
#include <iostream>
#include <vector>

void printVector(std::vector<int> vec) {
    for (int num : vec) {
        std::cout << num << " ";
    }
    std::cout << std::endl;
}

int main() {
    std::vector<int> numbers = {10, 20, 30};

    printVector(numbers);

    return 0;
}
```

**Output:**
```
10 20 30
```

**Note:** This makes a copy, which can be slow for large vectors!

### Passing by Reference (No Copy)

```cpp
#include <iostream>
#include <vector>

void printVector(const std::vector<int>& vec) {
    for (int num : vec) {
        std::cout << num << " ";
    }
    std::cout << std::endl;
}

void doubleValues(std::vector<int>& vec) {
    for (int i = 0; i < vec.size(); i++) {
        vec[i] *= 2;
    }
}

int main() {
    std::vector<int> numbers = {5, 10, 15};

    std::cout << "Before: ";
    printVector(numbers);

    doubleValues(numbers);

    std::cout << "After: ";
    printVector(numbers);

    return 0;
}
```

**Output:**
```
Before: 5 10 15
After: 10 20 30
```

**Using `const &` for read-only (fast, safe):**
- No copy is made (fast)
- Can't modify (safe)

**Using `&` for modification:**
- No copy is made (fast)
- Can modify the original

### Returning a Vector

```cpp
#include <iostream>
#include <vector>

std::vector<int> getEvenNumbers(int limit) {
    std::vector<int> evens;

    for (int i = 0; i <= limit; i += 2) {
        evens.push_back(i);
    }

    return evens;
}

int main() {
    std::vector<int> evenNums = getEvenNumbers(20);

    std::cout << "Even numbers up to 20: ";
    for (int num : evenNums) {
        std::cout << num << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
Even numbers up to 20: 0 2 4 6 8 10 12 14 16 18 20
```

## 2D Vectors (Vector of Vectors)

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<std::vector<int>> grid = {
        {1, 2, 3},
        {4, 5, 6},
        {7, 8, 9}
    };

    std::cout << "Grid:" << std::endl;
    for (int i = 0; i < grid.size(); i++) {
        for (int j = 0; j < grid[i].size(); j++) {
            std::cout << grid[i][j] << " ";
        }
        std::cout << std::endl;
    }

    return 0;
}
```

**Output:**
```
Grid:
1 2 3
4 5 6
7 8 9
```

### Dynamic 2D Vector

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<std::vector<int>> matrix;

    matrix.push_back({1, 2, 3});
    matrix.push_back({4, 5, 6});
    matrix.push_back({7, 8, 9, 10});

    for (const auto& row : matrix) {
        for (int val : row) {
            std::cout << val << " ";
        }
        std::cout << std::endl;
    }

    return 0;
}
```

**Output:**
```
1 2 3
4 5 6
7 8 9 10
```

Notice the third row has 4 elements! Vectors can have different sizes.

## Practical Example: Grade Manager

```cpp
#include <iostream>
#include <vector>
#include <string>

int main() {
    std::vector<std::string> students;
    std::vector<int> grades;

    while (true) {
        std::cout << "\n=== Grade Manager ===" << std::endl;
        std::cout << "1. Add student" << std::endl;
        std::cout << "2. View all grades" << std::endl;
        std::cout << "3. Calculate average" << std::endl;
        std::cout << "4. Exit" << std::endl;
        std::cout << "Choice: ";

        int choice;
        std::cin >> choice;

        if (choice == 1) {
            std::string name;
            int grade;

            std::cout << "Student name: ";
            std::cin >> name;
            std::cout << "Grade: ";
            std::cin >> grade;

            students.push_back(name);
            grades.push_back(grade);

            std::cout << "Added!" << std::endl;

        } else if (choice == 2) {
            if (students.empty()) {
                std::cout << "No students yet!" << std::endl;
            } else {
                std::cout << "\nAll Grades:" << std::endl;
                for (int i = 0; i < students.size(); i++) {
                    std::cout << students[i] << ": " << grades[i] << std::endl;
                }
            }

        } else if (choice == 3) {
            if (grades.empty()) {
                std::cout << "No grades yet!" << std::endl;
            } else {
                int sum = 0;
                for (int grade : grades) {
                    sum += grade;
                }
                double avg = static_cast<double>(sum) / grades.size();
                std::cout << "Class average: " << avg << std::endl;
            }

        } else if (choice == 4) {
            std::cout << "Goodbye!" << std::endl;
            break;

        } else {
            std::cout << "Invalid choice!" << std::endl;
        }
    }

    return 0;
}
```

## Arrays vs Vectors

| Feature | Array | Vector |
|---------|-------|--------|
| Size | Fixed | Dynamic |
| Change size | No | Yes |
| Memory | Stack | Heap |
| Bounds checking | No | Yes (with .at()) |
| Functions | size(), at(), push_back(), etc. | None |
| Speed | Slightly faster | Slightly slower |
| Ease of use | Harder | Easier |

**When to use arrays:**
- Fixed size known at compile time
- Need maximum performance
- Very small datasets

**When to use vectors:**
- Size changes during runtime
- Want safety and convenience
- Most modern C++ code

## Common Mistakes

### Mistake 1: Using size() in Loop Wrong

```cpp
for (int i = 0; i <= vec.size(); i++)
```

Should be `i < vec.size()` not `i <=`

### Mistake 2: Modifying While Iterating

```cpp
for (int num : numbers) {
    numbers.push_back(num * 2);
}
```

This causes problems! Don't modify a vector while looping through it with range-based for.

### Mistake 3: Accessing Empty Vector

```cpp
std::vector<int> numbers;
std::cout << numbers[0];
```

Check if empty first:
```cpp
if (!numbers.empty()) {
    std::cout << numbers[0];
}
```

## Practice Exercises

**1. To-Do List**
Create a program that lets users add tasks, view all tasks, and remove completed tasks.

**2. Number Statistics**
Ask user for numbers until they enter -1, then show: count, sum, average, min, max.

**3. Word Counter**
Read words from user and count how many times each word appears.

**Example solution for number statistics:**

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers;
    int input;

    std::cout << "Enter numbers (enter -1 to stop):" << std::endl;

    while (true) {
        std::cin >> input;
        if (input == -1) break;
        numbers.push_back(input);
    }

    if (numbers.empty()) {
        std::cout << "No numbers entered!" << std::endl;
        return 0;
    }

    int sum = 0;
    int min = numbers[0];
    int max = numbers[0];

    for (int num : numbers) {
        sum += num;
        if (num < min) min = num;
        if (num > max) max = num;
    }

    double average = static_cast<double>(sum) / numbers.size();

    std::cout << "\nStatistics:" << std::endl;
    std::cout << "Count: " << numbers.size() << std::endl;
    std::cout << "Sum: " << sum << std::endl;
    std::cout << "Average: " << average << std::endl;
    std::cout << "Minimum: " << min << std::endl;
    std::cout << "Maximum: " << max << std::endl;

    return 0;
}
```

## What's Next?

Vectors are incredibly useful! Next, we'll learn about:
- **Pointers** - Understanding memory addresses
- **References** - Another way to work with data
- **How memory really works in C++**

You're mastering data structures! 🚀
