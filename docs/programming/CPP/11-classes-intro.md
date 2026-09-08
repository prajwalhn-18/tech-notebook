# Classes - Introduction to OOP

## What is a Class?

A **class** is like a blueprint for creating objects. Think of it like a cookie cutter - the class is the cutter, and the cookies you make are the objects!

Classes are similar to structures, but with superpowers:
- They can have **functions** (called methods)
- They can hide data (encapsulation)
- They can have special setup and cleanup functions

**Object-Oriented Programming (OOP)** is a way of thinking about programs as collections of objects that work together.

## Your First Class

```cpp
#include <iostream>
#include <string>

class Dog {
public:
    std::string name;
    int age;

    void bark() {
        std::cout << name << " says: Woof! Woof!" << std::endl;
    }
};

int main() {
    Dog myDog;
    myDog.name = "Buddy";
    myDog.age = 3;

    std::cout << "My dog's name is " << myDog.name << std::endl;
    std::cout << "He is " << myDog.age << " years old" << std::endl;
    myDog.bark();

    return 0;
}
```

**Output:**
```
My dog's name is Buddy
He is 3 years old
Buddy says: Woof! Woof!
```

**Key differences from structs:**
- `class` keyword instead of `struct`
- `public:` makes members accessible (we'll explain this soon)
- Methods (functions inside the class)

## Class vs Struct

The main difference: classes have `private` by default, structs have `public` by default.

**With struct:**
```cpp
struct Dog {
    std::string name;
};
```

Everything is accessible automatically.

**With class:**
```cpp
class Dog {
public:
    std::string name;
};
```

You need `public:` to make things accessible.

**When to use which:**
- **struct**: Simple data containers with no behavior
- **class**: When you need methods and want to control access

## Methods (Member Functions)

Methods are functions that belong to a class:

```cpp
#include <iostream>
#include <string>

class Calculator {
public:
    int add(int a, int b) {
        return a + b;
    }

    int subtract(int a, int b) {
        return a - b;
    }

    int multiply(int a, int b) {
        return a * b;
    }

    double divide(double a, double b) {
        if (b == 0) {
            std::cout << "Error: Division by zero!" << std::endl;
            return 0;
        }
        return a / b;
    }
};

int main() {
    Calculator calc;

    std::cout << "10 + 5 = " << calc.add(10, 5) << std::endl;
    std::cout << "10 - 5 = " << calc.subtract(10, 5) << std::endl;
    std::cout << "10 * 5 = " << calc.multiply(10, 5) << std::endl;
    std::cout << "10 / 5 = " << calc.divide(10, 5) << std::endl;

    return 0;
}
```

**Output:**
```
10 + 5 = 15
10 - 5 = 5
10 * 5 = 50
10 / 5 = 2
```

## Constructors - Setup Functions

A **constructor** is a special method that runs automatically when you create an object:

```cpp
#include <iostream>
#include <string>

class Student {
public:
    std::string name;
    int age;
    double grade;

    Student(std::string n, int a, double g) {
        name = n;
        age = a;
        grade = g;
        std::cout << "Created student: " << name << std::endl;
    }

    void display() {
        std::cout << "Name: " << name << std::endl;
        std::cout << "Age: " << age << std::endl;
        std::cout << "Grade: " << grade << std::endl;
    }
};

int main() {
    Student student1("Alex", 13, 92.5);
    Student student2("Sam", 14, 88.0);

    std::cout << "\nStudent 1:" << std::endl;
    student1.display();

    std::cout << "\nStudent 2:" << std::endl;
    student2.display();

    return 0;
}
```

**Output:**
```
Created student: Alex
Created student: Sam

Student 1:
Name: Alex
Age: 13
Grade: 92.5

Student 2:
Name: Sam
Age: 14
Grade: 88
```

**Constructor rules:**
- Same name as the class
- No return type (not even void!)
- Called automatically when object is created

## Default Constructor

If you don't provide values:

```cpp
#include <iostream>
#include <string>

class Car {
public:
    std::string brand;
    int year;

    Car() {
        brand = "Unknown";
        year = 0;
        std::cout << "Default car created" << std::endl;
    }

    Car(std::string b, int y) {
        brand = b;
        year = y;
        std::cout << "Car created: " << brand << std::endl;
    }

    void display() {
        std::cout << year << " " << brand << std::endl;
    }
};

int main() {
    Car car1;
    Car car2("Toyota", 2020);

    car1.display();
    car2.display();

    return 0;
}
```

**Output:**
```
Default car created
Car created: Toyota
Unknown
2020 Toyota
```

## Encapsulation - Hiding Data

**Encapsulation** means hiding data and only allowing access through methods:

```cpp
#include <iostream>
#include <string>

class BankAccount {
private:
    std::string accountNumber;
    double balance;

public:
    BankAccount(std::string accNum, double initialBalance) {
        accountNumber = accNum;
        balance = initialBalance;
    }

    void deposit(double amount) {
        if (amount > 0) {
            balance += amount;
            std::cout << "Deposited: $" << amount << std::endl;
        } else {
            std::cout << "Invalid amount!" << std::endl;
        }
    }

    void withdraw(double amount) {
        if (amount > 0 && amount <= balance) {
            balance -= amount;
            std::cout << "Withdrew: $" << amount << std::endl;
        } else {
            std::cout << "Invalid or insufficient funds!" << std::endl;
        }
    }

    double getBalance() {
        return balance;
    }

    void displayInfo() {
        std::cout << "Account: " << accountNumber << std::endl;
        std::cout << "Balance: $" << balance << std::endl;
    }
};

int main() {
    BankAccount account("123456", 1000.0);

    account.displayInfo();

    account.deposit(500);
    account.withdraw(200);

    account.displayInfo();

    return 0;
}
```

**Output:**
```
Account: 123456
Balance: $1000
Deposited: $500
Withdrew: $200
Account: 123456
Balance: $1300
```

**Why encapsulation?**
- Protect data from invalid changes
- Control how data is accessed
- Can change implementation without breaking code

## Getters and Setters

**Getters** retrieve data, **setters** modify data with validation:

```cpp
#include <iostream>
#include <string>

class Person {
private:
    std::string name;
    int age;

public:
    Person(std::string n, int a) {
        name = n;
        setAge(a);
    }

    std::string getName() {
        return name;
    }

    void setName(std::string n) {
        if (!n.empty()) {
            name = n;
        } else {
            std::cout << "Name cannot be empty!" << std::endl;
        }
    }

    int getAge() {
        return age;
    }

    void setAge(int a) {
        if (a >= 0 && a <= 150) {
            age = a;
        } else {
            std::cout << "Invalid age!" << std::endl;
            age = 0;
        }
    }

    void display() {
        std::cout << "Name: " << name << ", Age: " << age << std::endl;
    }
};

int main() {
    Person person1("Alex", 13);
    person1.display();

    person1.setAge(14);
    person1.display();

    person1.setAge(200);
    person1.display();

    return 0;
}
```

**Output:**
```
Name: Alex, Age: 13
Name: Alex, Age: 14
Invalid age!
Name: Alex, Age: 14
```

## this Pointer

`this` refers to the current object:

```cpp
#include <iostream>
#include <string>

class Rectangle {
private:
    double length;
    double width;

public:
    Rectangle(double length, double width) {
        this->length = length;
        this->width = width;
    }

    double getArea() {
        return this->length * this->width;
    }

    double getPerimeter() {
        return 2 * (this->length + this->width);
    }

    void display() {
        std::cout << "Rectangle: " << length << " x " << width << std::endl;
        std::cout << "Area: " << getArea() << std::endl;
        std::cout << "Perimeter: " << getPerimeter() << std::endl;
    }
};

int main() {
    Rectangle rect(5.0, 3.0);
    rect.display();

    return 0;
}
```

**Output:**
```
Rectangle: 5 x 3
Area: 15
Perimeter: 16
```

**When to use `this`:**
- When parameter names match member names
- To be explicit about which variable you're using
- To return the current object

## Class with Multiple Objects

```cpp
#include <iostream>
#include <vector>
#include <string>

class Player {
private:
    std::string name;
    int score;
    int level;

public:
    Player(std::string n) {
        name = n;
        score = 0;
        level = 1;
    }

    void addScore(int points) {
        score += points;
        if (score >= 100 * level) {
            levelUp();
        }
    }

    void levelUp() {
        level++;
        std::cout << name << " leveled up to " << level << "!" << std::endl;
    }

    void display() {
        std::cout << name << " - Level " << level << ", Score: " << score << std::endl;
    }

    std::string getName() {
        return name;
    }

    int getScore() {
        return score;
    }
};

int main() {
    std::vector<Player> players;

    players.push_back(Player("Alice"));
    players.push_back(Player("Bob"));
    players.push_back(Player("Charlie"));

    std::cout << "=== Game Start ===" << std::endl;

    players[0].addScore(50);
    players[1].addScore(80);
    players[2].addScore(120);

    std::cout << "\n=== Current Standings ===" << std::endl;
    for (Player& p : players) {
        p.display();
    }

    return 0;
}
```

**Output:**
```
=== Game Start ===
Charlie leveled up to 2!

=== Current Standings ===
Alice - Level 1, Score: 50
Bob - Level 1, Score: 80
Charlie - Level 2, Score: 120
```

## Real-World Example: Library System

```cpp
#include <iostream>
#include <vector>
#include <string>

class Book {
private:
    std::string title;
    std::string author;
    bool isCheckedOut;

public:
    Book(std::string t, std::string a) {
        title = t;
        author = a;
        isCheckedOut = false;
    }

    bool checkOut() {
        if (!isCheckedOut) {
            isCheckedOut = true;
            std::cout << "Checked out: " << title << std::endl;
            return true;
        } else {
            std::cout << title << " is already checked out!" << std::endl;
            return false;
        }
    }

    void returnBook() {
        isCheckedOut = false;
        std::cout << "Returned: " << title << std::endl;
    }

    void display() {
        std::cout << title << " by " << author;
        if (isCheckedOut) {
            std::cout << " [Checked Out]";
        } else {
            std::cout << " [Available]";
        }
        std::cout << std::endl;
    }

    std::string getTitle() {
        return title;
    }

    bool isAvailable() {
        return !isCheckedOut;
    }
};

class Library {
private:
    std::vector<Book> books;
    std::string name;

public:
    Library(std::string n) {
        name = n;
    }

    void addBook(std::string title, std::string author) {
        books.push_back(Book(title, author));
        std::cout << "Added: " << title << std::endl;
    }

    void displayBooks() {
        std::cout << "\n=== " << name << " ===" << std::endl;
        if (books.empty()) {
            std::cout << "No books in library!" << std::endl;
            return;
        }

        for (int i = 0; i < books.size(); i++) {
            std::cout << (i + 1) << ". ";
            books[i].display();
        }
    }

    void checkOutBook(int index) {
        if (index >= 0 && index < books.size()) {
            books[index].checkOut();
        } else {
            std::cout << "Invalid book number!" << std::endl;
        }
    }

    void returnBook(int index) {
        if (index >= 0 && index < books.size()) {
            books[index].returnBook();
        } else {
            std::cout << "Invalid book number!" << std::endl;
        }
    }
};

int main() {
    Library myLibrary("City Library");

    myLibrary.addBook("1984", "George Orwell");
    myLibrary.addBook("To Kill a Mockingbird", "Harper Lee");
    myLibrary.addBook("The Great Gatsby", "F. Scott Fitzgerald");

    myLibrary.displayBooks();

    std::cout << "\n=== Checking out books ===" << std::endl;
    myLibrary.checkOutBook(0);
    myLibrary.checkOutBook(1);

    myLibrary.displayBooks();

    std::cout << "\n=== Returning a book ===" << std::endl;
    myLibrary.returnBook(0);

    myLibrary.displayBooks();

    return 0;
}
```

**Output:**
```
Added: 1984
Added: To Kill a Mockingbird
Added: The Great Gatsby

=== City Library ===
1. 1984 by George Orwell [Available]
2. To Kill a Mockingbird by Harper Lee [Available]
3. The Great Gatsby by F. Scott Fitzgerald [Available]

=== Checking out books ===
Checked out: 1984
Checked out: To Kill a Mockingbird

=== City Library ===
1. 1984 by George Orwell [Checked Out]
2. To Kill a Mockingbird by Harper Lee [Checked Out]
3. The Great Gatsby by F. Scott Fitzgerald [Available]

=== Returning a book ===
Returned: 1984

=== City Library ===
1. 1984 by George Orwell [Available]
2. To Kill a Mockingbird by Harper Lee [Checked Out]
3. The Great Gatsby by F. Scott Fitzgerald [Available]
```

## Access Specifiers

Three levels of access:

### public
Accessible from anywhere:
```cpp
class Example {
public:
    int publicVar;
};
```

### private
Only accessible inside the class:
```cpp
class Example {
private:
    int privateVar;
};
```

### protected
Accessible in class and derived classes (we'll learn this later):
```cpp
class Example {
protected:
    int protectedVar;
};
```

## Const Methods

Methods that don't modify the object:

```cpp
#include <iostream>
#include <string>

class Circle {
private:
    double radius;

public:
    Circle(double r) {
        radius = r;
    }

    double getArea() const {
        return 3.14159 * radius * radius;
    }

    double getCircumference() const {
        return 2 * 3.14159 * radius;
    }

    void setRadius(double r) {
        radius = r;
    }
};

int main() {
    Circle circle(5.0);

    std::cout << "Area: " << circle.getArea() << std::endl;
    std::cout << "Circumference: " << circle.getCircumference() << std::endl;

    return 0;
}
```

The `const` after the method name means it won't change any member variables.

## Common Mistakes

### Mistake 1: Forgetting public:

```cpp
class Dog {
    std::string name;
};
```

Members are private by default! Add `public:`:

```cpp
class Dog {
public:
    std::string name;
};
```

### Mistake 2: Wrong Constructor Name

```cpp
class Dog {
public:
    void dog() {
    }
};
```

Constructor must match class name exactly:

```cpp
class Dog {
public:
    Dog() {
    }
};
```

### Mistake 3: Trying to Access Private Members

```cpp
class Dog {
private:
    std::string name;
};

Dog myDog;
myDog.name = "Buddy";
```

Use a setter method instead!

## Practice Exercises

**1. Temperature Class**
Create a class that stores temperature and can convert between Celsius and Fahrenheit.

**2. Todo List Class**
Create a class for managing a todo list with add, remove, and display methods.

**3. Game Character Class**
Create a class for an RPG character with health, attack, defend, and level up methods.

**Example solution for temperature:**

```cpp
#include <iostream>

class Temperature {
private:
    double celsius;

public:
    Temperature(double c) {
        celsius = c;
    }

    double getCelsius() const {
        return celsius;
    }

    double getFahrenheit() const {
        return (celsius * 9.0 / 5.0) + 32.0;
    }

    void setCelsius(double c) {
        celsius = c;
    }

    void setFahrenheit(double f) {
        celsius = (f - 32.0) * 5.0 / 9.0;
    }

    void display() {
        std::cout << celsius << "°C = " << getFahrenheit() << "°F" << std::endl;
    }
};

int main() {
    Temperature temp(25.0);
    temp.display();

    temp.setFahrenheit(98.6);
    temp.display();

    return 0;
}
```

## What's Next?

You've learned the basics of Object-Oriented Programming! Next, we'll explore:
- **Inheritance** - Creating classes based on other classes
- **Polymorphism** - Objects that can take many forms
- **Advanced OOP concepts**

You're becoming a real software engineer! 🎯
