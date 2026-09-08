# Pointers - Understanding Memory

## What is a Pointer?

Imagine your computer's memory is like a huge apartment building. Each apartment has an **address** (like "Apartment 305") and can store something inside it.

A **pointer** is a variable that stores the **address** of another variable, not the value itself!

Think of it like this:
- **Regular variable**: A box with a value inside
- **Pointer**: A piece of paper with directions to where the box is located

## Why Use Pointers?

Pointers let you:
- Work with large amounts of data efficiently
- Modify variables from inside functions
- Create dynamic data structures
- Understand how memory works

## Your First Pointer

```cpp
#include <iostream>

int main() {
    int age = 13;
    int* ptr = &age;

    std::cout << "Value of age: " << age << std::endl;
    std::cout << "Address of age: " << &age << std::endl;
    std::cout << "Value in ptr: " << ptr << std::endl;
    std::cout << "Value ptr points to: " << *ptr << std::endl;

    return 0;
}
```

**Output (addresses will be different on your computer):**
```
Value of age: 13
Address of age: 0x7ffeefbff5ac
Value in ptr: 0x7ffeefbff5ac
Value ptr points to: 13
```

**Breaking it down:**
- `int* ptr` - Declares a pointer to an integer
- `&age` - The address operator (&) gets the address of age
- `*ptr` - The dereference operator (*) gets the value at that address

## The Three Key Operators

### 1. Address Operator (&)

Gets the memory address of a variable:

```cpp
#include <iostream>

int main() {
    int number = 42;
    double price = 19.99;
    char letter = 'A';

    std::cout << "Address of number: " << &number << std::endl;
    std::cout << "Address of price: " << &price << std::endl;
    std::cout << "Address of letter: " << static_cast<void*>(&letter) << std::endl;

    return 0;
}
```

**Note:** We use `static_cast<void*>` for char because otherwise it tries to print it as a string!

### 2. Pointer Declaration (*)

Creates a pointer variable:

```cpp
#include <iostream>

int main() {
    int* intPtr;
    double* doublePtr;
    char* charPtr;

    int num = 10;
    intPtr = &num;

    std::cout << "num value: " << num << std::endl;
    std::cout << "num address: " << &num << std::endl;
    std::cout << "intPtr points to: " << intPtr << std::endl;

    return 0;
}
```

### 3. Dereference Operator (*)

Accesses the value at the address:

```cpp
#include <iostream>

int main() {
    int score = 100;
    int* ptr = &score;

    std::cout << "score: " << score << std::endl;
    std::cout << "ptr: " << ptr << std::endl;
    std::cout << "*ptr: " << *ptr << std::endl;

    *ptr = 200;

    std::cout << "\nAfter *ptr = 200:" << std::endl;
    std::cout << "score: " << score << std::endl;
    std::cout << "*ptr: " << *ptr << std::endl;

    return 0;
}
```

**Output:**
```
score: 100
ptr: 0x7ffeefbff5ac
*ptr: 100

After *ptr = 200:
score: 200
*ptr: 200
```

**Important:** Changing `*ptr` changes `score` because they point to the same location!

## Pointer Arithmetic

You can do math with pointers:

```cpp
#include <iostream>

int main() {
    int numbers[] = {10, 20, 30, 40, 50};
    int* ptr = numbers;

    std::cout << "Array using pointer arithmetic:" << std::endl;
    for (int i = 0; i < 5; i++) {
        std::cout << "*(ptr + " << i << ") = " << *(ptr + i) << std::endl;
    }

    return 0;
}
```

**Output:**
```
Array using pointer arithmetic:
*(ptr + 0) = 10
*(ptr + 1) = 20
*(ptr + 2) = 30
*(ptr + 3) = 40
*(ptr + 4) = 50
```

**What's happening:**
- `ptr` points to the first element
- `ptr + 1` moves to the next integer
- `ptr + 2` moves to the one after that
- And so on...

## Pointers and Arrays

Array names act like pointers to the first element:

```cpp
#include <iostream>

int main() {
    int numbers[] = {10, 20, 30, 40, 50};

    std::cout << "Using array notation:" << std::endl;
    for (int i = 0; i < 5; i++) {
        std::cout << "numbers[" << i << "] = " << numbers[i] << std::endl;
    }

    std::cout << "\nUsing pointer notation:" << std::endl;
    for (int i = 0; i < 5; i++) {
        std::cout << "*(numbers + " << i << ") = " << *(numbers + i) << std::endl;
    }

    return 0;
}
```

**Output:**
```
Using array notation:
numbers[0] = 10
numbers[1] = 20
numbers[2] = 30
numbers[3] = 40
numbers[4] = 50

Using pointer notation:
*(numbers + 0) = 10
*(numbers + 1) = 20
*(numbers + 2) = 30
*(numbers + 3) = 40
*(numbers + 4) = 50
```

## Pointers with Functions

### Passing by Pointer

```cpp
#include <iostream>

void doubleValue(int* ptr) {
    *ptr = *ptr * 2;
}

void swap(int* a, int* b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}

int main() {
    int num = 5;

    std::cout << "Before: " << num << std::endl;
    doubleValue(&num);
    std::cout << "After doubleValue: " << num << std::endl;

    int x = 10;
    int y = 20;

    std::cout << "\nBefore swap: x = " << x << ", y = " << y << std::endl;
    swap(&x, &y);
    std::cout << "After swap: x = " << x << ", y = " << y << std::endl;

    return 0;
}
```

**Output:**
```
Before: 5
After doubleValue: 10

Before swap: x = 10, y = 20
After swap: x = 20, y = 10
```

### Returning Pointers

Be careful! Don't return pointers to local variables:

```cpp
#include <iostream>

int* createArray(int size) {
    int* arr = new int[size];
    for (int i = 0; i < size; i++) {
        arr[i] = i * 10;
    }
    return arr;
}

int main() {
    int* myArray = createArray(5);

    for (int i = 0; i < 5; i++) {
        std::cout << myArray[i] << " ";
    }
    std::cout << std::endl;

    delete[] myArray;

    return 0;
}
```

**Output:**
```
0 10 20 30 40
```

**Important:** When using `new`, always use `delete` to free memory!

## nullptr - The Safe Empty Pointer

Always initialize pointers! Use `nullptr` for empty pointers:

```cpp
#include <iostream>

int main() {
    int* ptr = nullptr;

    if (ptr == nullptr) {
        std::cout << "Pointer is null (empty)" << std::endl;
    }

    int num = 42;
    ptr = &num;

    if (ptr != nullptr) {
        std::cout << "Pointer now points to: " << *ptr << std::endl;
    }

    return 0;
}
```

**Output:**
```
Pointer is null (empty)
Pointer now points to: 42
```

**Always check pointers before using them!**

## Dynamic Memory Allocation

Create variables that live until you explicitly delete them:

### Single Variable

```cpp
#include <iostream>

int main() {
    int* ptr = new int;
    *ptr = 42;

    std::cout << "Value: " << *ptr << std::endl;

    delete ptr;
    ptr = nullptr;

    return 0;
}
```

### Arrays

```cpp
#include <iostream>

int main() {
    int size;

    std::cout << "Enter array size: ";
    std::cin >> size;

    int* arr = new int[size];

    std::cout << "Enter " << size << " numbers:" << std::endl;
    for (int i = 0; i < size; i++) {
        std::cin >> arr[i];
    }

    std::cout << "You entered: ";
    for (int i = 0; i < size; i++) {
        std::cout << arr[i] << " ";
    }
    std::cout << std::endl;

    delete[] arr;

    return 0;
}
```

**Sample run:**
```
Enter array size: 3
Enter 3 numbers:
10
20
30
You entered: 10 20 30
```

**Memory rules:**
- `new` → use `delete`
- `new[]` → use `delete[]`
- Always delete what you new!

## Pointers with Structures/Classes

### Using the Arrow Operator (->)

```cpp
#include <iostream>
#include <string>

struct Person {
    std::string name;
    int age;
};

int main() {
    Person person1 = {"Alex", 13};

    Person* ptr = &person1;

    std::cout << "Using dot operator:" << std::endl;
    std::cout << "Name: " << person1.name << std::endl;
    std::cout << "Age: " << person1.age << std::endl;

    std::cout << "\nUsing arrow operator:" << std::endl;
    std::cout << "Name: " << ptr->name << std::endl;
    std::cout << "Age: " << ptr->age << std::endl;

    ptr->age = 14;
    std::cout << "\nAfter changing via pointer:" << std::endl;
    std::cout << "Age: " << person1.age << std::endl;

    return 0;
}
```

**Output:**
```
Using dot operator:
Name: Alex
Age: 13

Using arrow operator:
Name: Alex
Age: 13

After changing via pointer:
Age: 14
```

**Remember:**
- Use `.` with objects: `person1.name`
- Use `->` with pointers: `ptr->name`

## Dynamic Objects

```cpp
#include <iostream>
#include <string>

class Dog {
private:
    std::string name;
    int age;

public:
    Dog(std::string n, int a) {
        name = n;
        age = a;
    }

    void bark() {
        std::cout << name << " says: Woof!" << std::endl;
    }

    void display() {
        std::cout << name << " is " << age << " years old" << std::endl;
    }
};

int main() {
    Dog* dogPtr = new Dog("Buddy", 3);

    dogPtr->display();
    dogPtr->bark();

    delete dogPtr;

    return 0;
}
```

**Output:**
```
Buddy is 3 years old
Buddy says: Woof!
```

## Common Pointer Mistakes

### Mistake 1: Using Uninitialized Pointers

```cpp
int* ptr;
*ptr = 42;
```

**Danger!** ptr points to random memory! Always initialize:

```cpp
int* ptr = nullptr;
```

### Mistake 2: Dereferencing nullptr

```cpp
int* ptr = nullptr;
*ptr = 42;
```

**Crashes!** Always check first:

```cpp
if (ptr != nullptr) {
    *ptr = 42;
}
```

### Mistake 3: Memory Leaks

```cpp
int* ptr = new int(42);
ptr = nullptr;
```

**Memory leaked!** Delete before reassigning:

```cpp
int* ptr = new int(42);
delete ptr;
ptr = nullptr;
```

### Mistake 4: Using After Delete

```cpp
int* ptr = new int(42);
delete ptr;
*ptr = 100;
```

**Danger!** Set to nullptr after delete:

```cpp
int* ptr = new int(42);
delete ptr;
ptr = nullptr;
```

### Mistake 5: Deleting Stack Variables

```cpp
int num = 42;
int* ptr = &num;
delete ptr;
```

**Never do this!** Only delete what you `new`!

## Pointer Best Practices

1. **Always initialize pointers**
   ```cpp
   int* ptr = nullptr;
   ```

2. **Check before dereferencing**
   ```cpp
   if (ptr != nullptr) {
       *ptr = 42;
   }
   ```

3. **Delete what you new**
   ```cpp
   int* ptr = new int(42);
   delete ptr;
   ```

4. **Set to nullptr after delete**
   ```cpp
   delete ptr;
   ptr = nullptr;
   ```

5. **Use smart pointers when possible** (we'll learn these later!)

## Practical Example: Dynamic Array Manager

```cpp
#include <iostream>

class IntArray {
private:
    int* data;
    int size;

public:
    IntArray(int s) {
        size = s;
        data = new int[size];
        for (int i = 0; i < size; i++) {
            data[i] = 0;
        }
        std::cout << "Created array of size " << size << std::endl;
    }

    ~IntArray() {
        delete[] data;
        std::cout << "Deleted array" << std::endl;
    }

    void set(int index, int value) {
        if (index >= 0 && index < size) {
            data[index] = value;
        }
    }

    int get(int index) {
        if (index >= 0 && index < size) {
            return data[index];
        }
        return -1;
    }

    void display() {
        std::cout << "Array: ";
        for (int i = 0; i < size; i++) {
            std::cout << data[i] << " ";
        }
        std::cout << std::endl;
    }

    int getSize() {
        return size;
    }
};

int main() {
    IntArray arr(5);

    arr.set(0, 10);
    arr.set(1, 20);
    arr.set(2, 30);
    arr.set(3, 40);
    arr.set(4, 50);

    arr.display();

    std::cout << "Element at index 2: " << arr.get(2) << std::endl;

    return 0;
}
```

**Output:**
```
Created array of size 5
Array: 10 20 30 40 50
Element at index 2: 30
Deleted array
```

**Note:** The destructor (`~IntArray()`) automatically cleans up memory!

## Practice Exercises

**1. Pointer Swap**
Write a function that swaps two integers using pointers.

**2. Dynamic String Array**
Create a program that stores strings dynamically and lets users add/remove them.

**3. Pointer Calculator**
Create functions that take pointers and perform calculations.

**Example solution for pointer swap:**

```cpp
#include <iostream>

void swap(int* a, int* b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}

int main() {
    int x, y;

    std::cout << "Enter first number: ";
    std::cin >> x;

    std::cout << "Enter second number: ";
    std::cin >> y;

    std::cout << "\nBefore swap: x = " << x << ", y = " << y << std::endl;

    swap(&x, &y);

    std::cout << "After swap: x = " << x << ", y = " << y << std::endl;

    return 0;
}
```

## What's Next?

Pointers are powerful but can be tricky! Next, we'll learn about:
- **References** - A safer alternative to pointers
- **Smart pointers** - Automatic memory management
- **More advanced memory concepts**

You're mastering one of C++'s most important features! 🧠
