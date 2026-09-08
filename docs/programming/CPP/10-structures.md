# Structures - Creating Custom Data Types

## What is a Structure?

Imagine you want to store information about a student. You need:
- Name (string)
- Age (int)
- Grade (double)

You could create three separate variables, but that's messy. A **structure** (or **struct**) lets you group related data together into one custom type!

Think of a structure like a form with multiple fields that belong together.

## Creating Your First Structure

```cpp
#include <iostream>
#include <string>

struct Student {
    std::string name;
    int age;
    double grade;
};

int main() {
    Student student1;

    student1.name = "Alex";
    student1.age = 13;
    student1.grade = 92.5;

    std::cout << "Student Information:" << std::endl;
    std::cout << "Name: " << student1.name << std::endl;
    std::cout << "Age: " << student1.age << std::endl;
    std::cout << "Grade: " << student1.grade << std::endl;

    return 0;
}
```

**Output:**
```
Student Information:
Name: Alex
Age: 13
Grade: 92.5
```

**What's happening:**
1. `struct Student { ... };` defines a new type
2. Inside are **members** (variables that belong to the struct)
3. `Student student1;` creates a Student variable
4. Use `.` to access members: `student1.name`

## Initializing Structures

### Method 1: After Declaration

```cpp
#include <iostream>
#include <string>

struct Person {
    std::string name;
    int age;
    std::string city;
};

int main() {
    Person person1;
    person1.name = "Sam";
    person1.age = 25;
    person1.city = "New York";

    std::cout << person1.name << " is " << person1.age;
    std::cout << " years old from " << person1.city << std::endl;

    return 0;
}
```

**Output:**
```
Sam is 25 years old from New York
```

### Method 2: During Declaration

```cpp
#include <iostream>
#include <string>

struct Person {
    std::string name;
    int age;
    std::string city;
};

int main() {
    Person person1 = {"Sam", 25, "New York"};

    std::cout << person1.name << " is " << person1.age;
    std::cout << " years old from " << person1.city << std::endl;

    return 0;
}
```

**Output:**
```
Sam is 25 years old from New York
```

**Note:** Values must be in the same order as declared in the struct!

## Multiple Instances

You can create many variables of your custom type:

```cpp
#include <iostream>
#include <string>

struct Car {
    std::string brand;
    std::string model;
    int year;
};

int main() {
    Car car1 = {"Toyota", "Camry", 2020};
    Car car2 = {"Honda", "Civic", 2021};
    Car car3 = {"Ford", "Mustang", 2022};

    std::cout << "Car 1: " << car1.year << " " << car1.brand << " " << car1.model << std::endl;
    std::cout << "Car 2: " << car2.year << " " << car2.brand << " " << car2.model << std::endl;
    std::cout << "Car 3: " << car3.year << " " << car3.brand << " " << car3.model << std::endl;

    return 0;
}
```

**Output:**
```
Car 1: 2020 Toyota Camry
Car 2: 2021 Honda Civic
Car 3: 2022 Ford Mustang
```

## Arrays of Structures

```cpp
#include <iostream>
#include <string>

struct Book {
    std::string title;
    std::string author;
    int pages;
};

int main() {
    Book library[3];

    library[0] = {"1984", "George Orwell", 328};
    library[1] = {"To Kill a Mockingbird", "Harper Lee", 281};
    library[2] = {"The Great Gatsby", "F. Scott Fitzgerald", 180};

    std::cout << "Library Books:" << std::endl;
    for (int i = 0; i < 3; i++) {
        std::cout << (i + 1) << ". " << library[i].title;
        std::cout << " by " << library[i].author;
        std::cout << " (" << library[i].pages << " pages)" << std::endl;
    }

    return 0;
}
```

**Output:**
```
Library Books:
1. 1984 by George Orwell (328 pages)
2. To Kill a Mockingbird by Harper Lee (281 pages)
3. The Great Gatsby by F. Scott Fitzgerald (180 pages)
```

## Vectors of Structures

Even better than arrays!

```cpp
#include <iostream>
#include <vector>
#include <string>

struct Product {
    std::string name;
    double price;
    int quantity;
};

int main() {
    std::vector<Product> inventory;

    inventory.push_back({"Laptop", 999.99, 5});
    inventory.push_back({"Mouse", 29.99, 15});
    inventory.push_back({"Keyboard", 79.99, 10});

    std::cout << "Inventory:" << std::endl;
    for (const Product& item : inventory) {
        std::cout << item.name << ": $" << item.price;
        std::cout << " (Stock: " << item.quantity << ")" << std::endl;
    }

    return 0;
}
```

**Output:**
```
Inventory:
Laptop: $999.99 (Stock: 5)
Mouse: $29.99 (Stock: 15)
Keyboard: $79.99 (Stock: 10)
```

## Nested Structures

Structures can contain other structures!

```cpp
#include <iostream>
#include <string>

struct Date {
    int day;
    int month;
    int year;
};

struct Person {
    std::string name;
    int age;
    Date birthday;
};

int main() {
    Person person1;

    person1.name = "Alex";
    person1.age = 13;
    person1.birthday.day = 15;
    person1.birthday.month = 6;
    person1.birthday.year = 2011;

    std::cout << "Name: " << person1.name << std::endl;
    std::cout << "Age: " << person1.age << std::endl;
    std::cout << "Birthday: " << person1.birthday.day << "/";
    std::cout << person1.birthday.month << "/";
    std::cout << person1.birthday.year << std::endl;

    return 0;
}
```

**Output:**
```
Name: Alex
Age: 13
Birthday: 15/6/2011
```

## Structures with Functions

### Passing to Functions

```cpp
#include <iostream>
#include <string>

struct Rectangle {
    double length;
    double width;
};

double calculateArea(Rectangle rect) {
    return rect.length * rect.width;
}

void printRectangle(Rectangle rect) {
    std::cout << "Rectangle: " << rect.length << " x " << rect.width << std::endl;
    std::cout << "Area: " << calculateArea(rect) << std::endl;
}

int main() {
    Rectangle rect1 = {5.0, 3.0};
    Rectangle rect2 = {7.5, 4.2};

    printRectangle(rect1);
    std::cout << std::endl;
    printRectangle(rect2);

    return 0;
}
```

**Output:**
```
Rectangle: 5 x 3
Area: 15

Rectangle: 7.5 x 4.2
Area: 31.5
```

### Passing by Reference

```cpp
#include <iostream>
#include <string>

struct Player {
    std::string name;
    int score;
    int lives;
};

void addPoints(Player& player, int points) {
    player.score += points;
}

void loseLife(Player& player) {
    player.lives--;
}

void printPlayer(const Player& player) {
    std::cout << player.name << " - Score: " << player.score;
    std::cout << ", Lives: " << player.lives << std::endl;
}

int main() {
    Player player1 = {"Alex", 0, 3};

    printPlayer(player1);

    addPoints(player1, 100);
    printPlayer(player1);

    loseLife(player1);
    printPlayer(player1);

    addPoints(player1, 50);
    printPlayer(player1);

    return 0;
}
```

**Output:**
```
Alex - Score: 0, Lives: 3
Alex - Score: 100, Lives: 3
Alex - Score: 100, Lives: 2
Alex - Score: 150, Lives: 2
```

**Note:** Using `&` lets functions modify the original struct!

### Returning Structures

```cpp
#include <iostream>
#include <string>

struct Point {
    double x;
    double y;
};

Point createPoint(double x, double y) {
    Point p;
    p.x = x;
    p.y = y;
    return p;
}

Point addPoints(Point p1, Point p2) {
    Point result;
    result.x = p1.x + p2.x;
    result.y = p1.y + p2.y;
    return result;
}

int main() {
    Point point1 = createPoint(3.0, 4.0);
    Point point2 = createPoint(1.0, 2.0);

    Point sum = addPoints(point1, point2);

    std::cout << "Point 1: (" << point1.x << ", " << point1.y << ")" << std::endl;
    std::cout << "Point 2: (" << point2.x << ", " << point2.y << ")" << std::endl;
    std::cout << "Sum: (" << sum.x << ", " << sum.y << ")" << std::endl;

    return 0;
}
```

**Output:**
```
Point 1: (3, 4)
Point 2: (1, 2)
Sum: (4, 6)
```

## Comparing Structures

You need to compare each member individually:

```cpp
#include <iostream>
#include <string>

struct Point {
    int x;
    int y;
};

bool areEqual(const Point& p1, const Point& p2) {
    return (p1.x == p2.x && p1.y == p2.y);
}

int main() {
    Point point1 = {5, 10};
    Point point2 = {5, 10};
    Point point3 = {3, 7};

    if (areEqual(point1, point2)) {
        std::cout << "point1 and point2 are equal" << std::endl;
    }

    if (!areEqual(point1, point3)) {
        std::cout << "point1 and point3 are different" << std::endl;
    }

    return 0;
}
```

**Output:**
```
point1 and point2 are equal
point1 and point3 are different
```

## Real-World Example: Contact Book

```cpp
#include <iostream>
#include <vector>
#include <string>

struct Contact {
    std::string name;
    std::string phone;
    std::string email;
};

void addContact(std::vector<Contact>& contacts) {
    Contact newContact;

    std::cout << "Enter name: ";
    std::cin.ignore();
    std::getline(std::cin, newContact.name);

    std::cout << "Enter phone: ";
    std::getline(std::cin, newContact.phone);

    std::cout << "Enter email: ";
    std::getline(std::cin, newContact.email);

    contacts.push_back(newContact);
    std::cout << "Contact added!" << std::endl;
}

void displayContacts(const std::vector<Contact>& contacts) {
    if (contacts.empty()) {
        std::cout << "No contacts yet!" << std::endl;
        return;
    }

    std::cout << "\n=== All Contacts ===" << std::endl;
    for (int i = 0; i < contacts.size(); i++) {
        std::cout << (i + 1) << ". " << contacts[i].name << std::endl;
        std::cout << "   Phone: " << contacts[i].phone << std::endl;
        std::cout << "   Email: " << contacts[i].email << std::endl;
    }
}

int main() {
    std::vector<Contact> contacts;

    while (true) {
        std::cout << "\n=== Contact Book ===" << std::endl;
        std::cout << "1. Add Contact" << std::endl;
        std::cout << "2. View All Contacts" << std::endl;
        std::cout << "3. Exit" << std::endl;
        std::cout << "Choice: ";

        int choice;
        std::cin >> choice;

        if (choice == 1) {
            addContact(contacts);
        } else if (choice == 2) {
            displayContacts(contacts);
        } else if (choice == 3) {
            std::cout << "Goodbye!" << std::endl;
            break;
        } else {
            std::cout << "Invalid choice!" << std::endl;
        }
    }

    return 0;
}
```

## Practical Example: Student Grade System

```cpp
#include <iostream>
#include <vector>
#include <string>

struct Student {
    std::string name;
    int rollNumber;
    double grade;
};

void addStudent(std::vector<Student>& students) {
    Student newStudent;

    std::cout << "Enter student name: ";
    std::cin.ignore();
    std::getline(std::cin, newStudent.name);

    std::cout << "Enter roll number: ";
    std::cin >> newStudent.rollNumber;

    std::cout << "Enter grade: ";
    std::cin >> newStudent.grade;

    students.push_back(newStudent);
    std::cout << "Student added!" << std::endl;
}

void displayStudents(const std::vector<Student>& students) {
    if (students.empty()) {
        std::cout << "No students yet!" << std::endl;
        return;
    }

    std::cout << "\n=== All Students ===" << std::endl;
    for (const Student& s : students) {
        std::cout << "Roll #" << s.rollNumber << ": " << s.name;
        std::cout << " (Grade: " << s.grade << ")" << std::endl;
    }
}

double calculateAverage(const std::vector<Student>& students) {
    if (students.empty()) return 0.0;

    double sum = 0;
    for (const Student& s : students) {
        sum += s.grade;
    }
    return sum / students.size();
}

Student findTopStudent(const std::vector<Student>& students) {
    Student top = students[0];
    for (const Student& s : students) {
        if (s.grade > top.grade) {
            top = s;
        }
    }
    return top;
}

int main() {
    std::vector<Student> students;

    while (true) {
        std::cout << "\n=== Student Grade System ===" << std::endl;
        std::cout << "1. Add Student" << std::endl;
        std::cout << "2. View All Students" << std::endl;
        std::cout << "3. Class Average" << std::endl;
        std::cout << "4. Top Student" << std::endl;
        std::cout << "5. Exit" << std::endl;
        std::cout << "Choice: ";

        int choice;
        std::cin >> choice;

        if (choice == 1) {
            addStudent(students);
        } else if (choice == 2) {
            displayStudents(students);
        } else if (choice == 3) {
            if (students.empty()) {
                std::cout << "No students yet!" << std::endl;
            } else {
                std::cout << "Class average: " << calculateAverage(students) << std::endl;
            }
        } else if (choice == 4) {
            if (students.empty()) {
                std::cout << "No students yet!" << std::endl;
            } else {
                Student top = findTopStudent(students);
                std::cout << "Top student: " << top.name;
                std::cout << " (Grade: " << top.grade << ")" << std::endl;
            }
        } else if (choice == 5) {
            std::cout << "Goodbye!" << std::endl;
            break;
        } else {
            std::cout << "Invalid choice!" << std::endl;
        }
    }

    return 0;
}
```

## Common Mistakes

### Mistake 1: Forgetting Semicolon After Struct

```cpp
struct Person {
    std::string name;
    int age;
}
```

Should be:
```cpp
struct Person {
    std::string name;
    int age;
};
```

**Note the semicolon after the closing brace!**

### Mistake 2: Wrong Member Access

```cpp
Student student1;
student1->name = "Alex";
```

Use `.` not `->`:
```cpp
student1.name = "Alex";
```

We'll learn about `->` when we study pointers!

### Mistake 3: Not Initializing Members

```cpp
struct Point {
    int x;
    int y;
};

Point p;
std::cout << p.x;
```

`x` has garbage value! Always initialize:
```cpp
Point p = {0, 0};
```

## Practice Exercises

**1. Movie Database**
Create a struct for movies (title, director, year, rating). Let users add movies and search by title.

**2. Bank Account System**
Create a struct for accounts (account number, holder name, balance). Implement deposit and withdraw functions.

**3. Inventory Manager**
Create a struct for products (name, price, stock). Calculate total inventory value.

**Example solution for bank account:**

```cpp
#include <iostream>
#include <string>

struct Account {
    int accountNumber;
    std::string holderName;
    double balance;
};

void deposit(Account& acc, double amount) {
    acc.balance += amount;
    std::cout << "Deposited $" << amount << std::endl;
}

void withdraw(Account& acc, double amount) {
    if (amount > acc.balance) {
        std::cout << "Insufficient funds!" << std::endl;
    } else {
        acc.balance -= amount;
        std::cout << "Withdrew $" << amount << std::endl;
    }
}

void displayAccount(const Account& acc) {
    std::cout << "\n=== Account Info ===" << std::endl;
    std::cout << "Account #: " << acc.accountNumber << std::endl;
    std::cout << "Holder: " << acc.holderName << std::endl;
    std::cout << "Balance: $" << acc.balance << std::endl;
}

int main() {
    Account myAccount = {12345, "Alex Smith", 1000.0};

    displayAccount(myAccount);

    deposit(myAccount, 500);
    displayAccount(myAccount);

    withdraw(myAccount, 200);
    displayAccount(myAccount);

    return 0;
}
```

## What's Next?

Now you can create custom data types! Next, we'll learn about:
- **Classes** - Like structures but with superpowers!
- **Object-Oriented Programming** - A whole new way to think about code
- **Encapsulation, methods, and more!**

You're ready for advanced programming! 🚀
