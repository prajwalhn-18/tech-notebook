# Strings - Working with Text

## What is a String?

A **string** is a sequence of characters - basically text! Like "Hello", "C++ Programming", or "12345".

We've used strings before, but now let's learn everything about them!

```cpp
#include <iostream>
#include <string>

int main() {
    std::string message = "Hello, World!";
    std::cout << message << std::endl;

    return 0;
}
```

**Output:**
```
Hello, World!
```

**Remember:** Always include `<string>` to use `std::string`!

## Creating Strings

### Different Ways to Create Strings

```cpp
#include <iostream>
#include <string>

int main() {
    std::string str1 = "Hello";
    std::string str2("World");
    std::string str3 = str1;
    std::string str4(5, 'A');
    std::string str5;

    std::cout << "str1: " << str1 << std::endl;
    std::cout << "str2: " << str2 << std::endl;
    std::cout << "str3: " << str3 << std::endl;
    std::cout << "str4: " << str4 << std::endl;
    std::cout << "str5 is empty: " << str5.empty() << std::endl;

    return 0;
}
```

**Output:**
```
str1: Hello
str2: World
str3: Hello
str4: AAAAA
str5 is empty: 1
```

## Getting String Length

```cpp
#include <iostream>
#include <string>

int main() {
    std::string name = "Alexander";

    std::cout << "Name: " << name << std::endl;
    std::cout << "Length: " << name.length() << std::endl;
    std::cout << "Size: " << name.size() << std::endl;

    return 0;
}
```

**Output:**
```
Name: Alexander
Length: 9
Size: 9
```

**Note:** `length()` and `size()` do the same thing!

## Accessing Characters

### Using [] Operator

```cpp
#include <iostream>
#include <string>

int main() {
    std::string word = "Hello";

    std::cout << "First letter: " << word[0] << std::endl;
    std::cout << "Second letter: " << word[1] << std::endl;
    std::cout << "Last letter: " << word[4] << std::endl;

    return 0;
}
```

**Output:**
```
First letter: H
Second letter: e
Last letter: o
```

**Remember:** Strings start at index 0, just like arrays!

### Using at() for Safety

```cpp
#include <iostream>
#include <string>

int main() {
    std::string word = "Hello";

    std::cout << "Third character: " << word.at(2) << std::endl;

    return 0;
}
```

**Output:**
```
Third character: l
```

`at()` checks if the index is valid and gives an error if not!

### Looping Through Characters

```cpp
#include <iostream>
#include <string>

int main() {
    std::string word = "Programming";

    std::cout << "Characters in '" << word << "':" << std::endl;

    for (int i = 0; i < word.length(); i++) {
        std::cout << word[i] << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
Characters in 'Programming':
P r o g r a m m i n g
```

### Range-Based Loop

```cpp
#include <iostream>
#include <string>

int main() {
    std::string word = "Hello";

    for (char c : word) {
        std::cout << c << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

**Output:**
```
H e l l o
```

## Modifying Strings

### Changing a Character

```cpp
#include <iostream>
#include <string>

int main() {
    std::string word = "Hello";

    std::cout << "Before: " << word << std::endl;

    word[0] = 'J';

    std::cout << "After: " << word << std::endl;

    return 0;
}
```

**Output:**
```
Before: Hello
After: Jello
```

### Appending (Adding to End)

```cpp
#include <iostream>
#include <string>

int main() {
    std::string message = "Hello";

    std::cout << "Original: " << message << std::endl;

    message += " World";

    std::cout << "After +=: " << message << std::endl;

    message.append("!");

    std::cout << "After append: " << message << std::endl;

    return 0;
}
```

**Output:**
```
Original: Hello
Original: Hello
After +=: Hello World
After append: Hello World!
```

Both `+=` and `append()` work!

## Concatenating (Joining) Strings

```cpp
#include <iostream>
#include <string>

int main() {
    std::string first = "Hello";
    std::string second = "World";

    std::string result1 = first + " " + second;
    std::cout << result1 << std::endl;

    std::string result2 = first + ", " + second + "!";
    std::cout << result2 << std::endl;

    return 0;
}
```

**Output:**
```
Hello World
Hello, World!
```

## Comparing Strings

```cpp
#include <iostream>
#include <string>

int main() {
    std::string word1 = "apple";
    std::string word2 = "banana";
    std::string word3 = "apple";

    std::cout << "word1 == word2: " << (word1 == word2) << std::endl;
    std::cout << "word1 == word3: " << (word1 == word3) << std::endl;
    std::cout << "word1 != word2: " << (word1 != word2) << std::endl;

    std::cout << "word1 < word2: " << (word1 < word2) << std::endl;
    std::cout << "word1 > word2: " << (word1 > word2) << std::endl;

    return 0;
}
```

**Output:**
```
word1 == word2: 0
word1 == word3: 1
word1 != word2: 1
word1 < word2: 1
word1 > word2: 0
```

**Alphabetical comparison:** "apple" < "banana" because 'a' comes before 'b'

## Getting User Input

### Single Word

```cpp
#include <iostream>
#include <string>

int main() {
    std::string name;

    std::cout << "Enter your first name: ";
    std::cin >> name;

    std::cout << "Hello, " << name << "!" << std::endl;

    return 0;
}
```

**Running:**
```
Enter your first name: Alex
Hello, Alex!
```

### Full Line (With Spaces)

```cpp
#include <iostream>
#include <string>

int main() {
    std::string fullName;

    std::cout << "Enter your full name: ";
    std::getline(std::cin, fullName);

    std::cout << "Hello, " << fullName << "!" << std::endl;

    return 0;
}
```

**Running:**
```
Enter your full name: Alex Johnson
Hello, Alex Johnson!
```

**Important:** Use `getline()` for input with spaces!

### Mixing cin and getline

```cpp
#include <iostream>
#include <string>

int main() {
    int age;
    std::string name;

    std::cout << "Enter your age: ";
    std::cin >> age;

    std::cin.ignore();

    std::cout << "Enter your name: ";
    std::getline(std::cin, name);

    std::cout << "Hi " << name << ", you are " << age << " years old!" << std::endl;

    return 0;
}
```

**Running:**
```
Enter your age: 13
Enter your name: Alex Smith
Hi Alex Smith, you are 13 years old!
```

**Note:** Use `std::cin.ignore()` to clear the newline after `cin`!

## Substring - Getting Part of a String

```cpp
#include <iostream>
#include <string>

int main() {
    std::string sentence = "Hello World Programming";

    std::string word1 = sentence.substr(0, 5);
    std::string word2 = sentence.substr(6, 5);
    std::string word3 = sentence.substr(12);

    std::cout << "Original: " << sentence << std::endl;
    std::cout << "Word 1: " << word1 << std::endl;
    std::cout << "Word 2: " << word2 << std::endl;
    std::cout << "Word 3: " << word3 << std::endl;

    return 0;
}
```

**Output:**
```
Original: Hello World Programming
Word 1: Hello
Word 2: World
Word 3: Programming
```

**Format:** `substr(start_position, length)`
- If you don't specify length, it goes to the end

## Finding in Strings

### find() - Find First Occurrence

```cpp
#include <iostream>
#include <string>

int main() {
    std::string text = "Hello World";

    int pos1 = text.find("World");
    int pos2 = text.find("o");
    int pos3 = text.find("xyz");

    std::cout << "Text: " << text << std::endl;
    std::cout << "'World' found at: " << pos1 << std::endl;
    std::cout << "'o' found at: " << pos2 << std::endl;

    if (pos3 == std::string::npos) {
        std::cout << "'xyz' not found!" << std::endl;
    }

    return 0;
}
```

**Output:**
```
Text: Hello World
'World' found at: 6
'o' found at: 4
'xyz' not found!
```

**Note:** `std::string::npos` means "not found"

### rfind() - Find Last Occurrence

```cpp
#include <iostream>
#include <string>

int main() {
    std::string text = "Hello World, Welcome to World";

    int first = text.find("World");
    int last = text.rfind("World");

    std::cout << "Text: " << text << std::endl;
    std::cout << "First 'World' at: " << first << std::endl;
    std::cout << "Last 'World' at: " << last << std::endl;

    return 0;
}
```

**Output:**
```
Text: Hello World, Welcome to World
First 'World' at: 6
Last 'World' at: 25
```

## Replacing Parts of Strings

```cpp
#include <iostream>
#include <string>

int main() {
    std::string text = "Hello World";

    std::cout << "Before: " << text << std::endl;

    text.replace(6, 5, "C++");

    std::cout << "After: " << text << std::endl;

    return 0;
}
```

**Output:**
```
Before: Hello World
After: Hello C++
```

**Format:** `replace(start_pos, length, new_text)`

## Inserting and Erasing

### insert()

```cpp
#include <iostream>
#include <string>

int main() {
    std::string text = "Hello World";

    std::cout << "Before: " << text << std::endl;

    text.insert(5, " Beautiful");

    std::cout << "After: " << text << std::endl;

    return 0;
}
```

**Output:**
```
Before: Hello World
After: Hello Beautiful World
```

### erase()

```cpp
#include <iostream>
#include <string>

int main() {
    std::string text = "Hello Beautiful World";

    std::cout << "Before: " << text << std::endl;

    text.erase(5, 10);

    std::cout << "After: " << text << std::endl;

    return 0;
}
```

**Output:**
```
Before: Hello Beautiful World
After: Hello World
```

## Case Conversion

C++ doesn't have built-in functions, but we can make our own!

### To Uppercase

```cpp
#include <iostream>
#include <string>
#include <cctype>

int main() {
    std::string text = "Hello World";

    std::cout << "Original: " << text << std::endl;

    for (int i = 0; i < text.length(); i++) {
        text[i] = toupper(text[i]);
    }

    std::cout << "Uppercase: " << text << std::endl;

    return 0;
}
```

**Output:**
```
Original: Hello World
Uppercase: HELLO WORLD
```

### To Lowercase

```cpp
#include <iostream>
#include <string>
#include <cctype>

int main() {
    std::string text = "Hello World";

    std::cout << "Original: " << text << std::endl;

    for (int i = 0; i < text.length(); i++) {
        text[i] = tolower(text[i]);
    }

    std::cout << "Lowercase: " << text << std::endl;

    return 0;
}
```

**Output:**
```
Original: Hello World
Lowercase: hello world
```

## Checking String Properties

### empty() - Check if Empty

```cpp
#include <iostream>
#include <string>

int main() {
    std::string str1 = "";
    std::string str2 = "Hello";

    if (str1.empty()) {
        std::cout << "str1 is empty" << std::endl;
    }

    if (!str2.empty()) {
        std::cout << "str2 is not empty" << std::endl;
    }

    return 0;
}
```

**Output:**
```
str1 is empty
str2 is not empty
```

### Checking for Letters/Digits

```cpp
#include <iostream>
#include <string>
#include <cctype>

int main() {
    char ch1 = 'A';
    char ch2 = '5';
    char ch3 = '@';

    std::cout << ch1 << " is alpha: " << isalpha(ch1) << std::endl;
    std::cout << ch2 << " is digit: " << isdigit(ch2) << std::endl;
    std::cout << ch3 << " is alpha: " << isalpha(ch3) << std::endl;

    return 0;
}
```

**Output:**
```
A is alpha: 1
5 is digit: 1
@ is alpha: 0
```

## Converting Between String and Numbers

### String to Number

```cpp
#include <iostream>
#include <string>

int main() {
    std::string numStr1 = "42";
    std::string numStr2 = "3.14";

    int num1 = std::stoi(numStr1);
    double num2 = std::stod(numStr2);

    std::cout << "String: " << numStr1 << " -> Integer: " << num1 << std::endl;
    std::cout << "String: " << numStr2 << " -> Double: " << num2 << std::endl;

    std::cout << "Doubled: " << (num1 * 2) << std::endl;
    std::cout << "Squared: " << (num2 * num2) << std::endl;

    return 0;
}
```

**Output:**
```
String: 42 -> Integer: 42
String: 3.14 -> Double: 3.14
Doubled: 84
Squared: 9.8596
```

**Functions:**
- `stoi()` - string to int
- `stod()` - string to double
- `stof()` - string to float
- `stol()` - string to long

### Number to String

```cpp
#include <iostream>
#include <string>

int main() {
    int num1 = 42;
    double num2 = 3.14159;

    std::string str1 = std::to_string(num1);
    std::string str2 = std::to_string(num2);

    std::cout << "Integer " << num1 << " -> String: '" << str1 << "'" << std::endl;
    std::cout << "Double " << num2 << " -> String: '" << str2 << "'" << std::endl;

    std::string combined = str1 + " and " + str2;
    std::cout << "Combined: " << combined << std::endl;

    return 0;
}
```

**Output:**
```
Integer 42 -> String: '42'
Double 3.14159 -> String: '3.141590'
Combined: 42 and 3.141590
```

## Reversing a String

```cpp
#include <iostream>
#include <string>

int main() {
    std::string word = "Hello";

    std::cout << "Original: " << word << std::endl;

    std::string reversed = "";
    for (int i = word.length() - 1; i >= 0; i--) {
        reversed += word[i];
    }

    std::cout << "Reversed: " << reversed << std::endl;

    return 0;
}
```

**Output:**
```
Original: Hello
Reversed: olleH
```

## Checking for Palindrome

```cpp
#include <iostream>
#include <string>

int main() {
    std::string word;

    std::cout << "Enter a word: ";
    std::cin >> word;

    bool isPalindrome = true;
    int start = 0;
    int end = word.length() - 1;

    while (start < end) {
        if (word[start] != word[end]) {
            isPalindrome = false;
            break;
        }
        start++;
        end--;
    }

    if (isPalindrome) {
        std::cout << word << " is a palindrome!" << std::endl;
    } else {
        std::cout << word << " is not a palindrome." << std::endl;
    }

    return 0;
}
```

**Sample runs:**
```
Enter a word: racecar
racecar is a palindrome!

Enter a word: hello
hello is not a palindrome.
```

## Counting Characters

```cpp
#include <iostream>
#include <string>

int main() {
    std::string text;
    char target;

    std::cout << "Enter text: ";
    std::getline(std::cin, text);

    std::cout << "Enter character to count: ";
    std::cin >> target;

    int count = 0;
    for (char c : text) {
        if (c == target) {
            count++;
        }
    }

    std::cout << "'" << target << "' appears " << count << " times" << std::endl;

    return 0;
}
```

**Sample run:**
```
Enter text: Hello World
Enter character to count: l
'l' appears 3 times
```

## Practical Example: Text Analysis Tool

```cpp
#include <iostream>
#include <string>
#include <cctype>

int main() {
    std::string text;

    std::cout << "Enter a sentence: ";
    std::getline(std::cin, text);

    int letters = 0;
    int digits = 0;
    int spaces = 0;
    int others = 0;

    for (char c : text) {
        if (isalpha(c)) {
            letters++;
        } else if (isdigit(c)) {
            digits++;
        } else if (isspace(c)) {
            spaces++;
        } else {
            others++;
        }
    }

    std::cout << "\n=== Text Analysis ===" << std::endl;
    std::cout << "Total characters: " << text.length() << std::endl;
    std::cout << "Letters: " << letters << std::endl;
    std::cout << "Digits: " << digits << std::endl;
    std::cout << "Spaces: " << spaces << std::endl;
    std::cout << "Other characters: " << others << std::endl;

    return 0;
}
```

**Sample run:**
```
Enter a sentence: Hello World 2024!

=== Text Analysis ===
Total characters: 18
Letters: 10
Digits: 4
Spaces: 2
Other characters: 1
```

## Common Mistakes

### Mistake 1: Forgetting to Include `<string>`

```cpp
#include <iostream>

int main() {
    std::string message = "Hello";
}
```

Add: `#include <string>`

### Mistake 2: Using cin for Multi-Word Input

```cpp
std::string name;
std::cin >> name;
```

Use `getline()` instead:
```cpp
std::getline(std::cin, name);
```

### Mistake 3: Going Out of Bounds

```cpp
std::string word = "Hi";
std::cout << word[5];
```

Always check length first!

## Practice Exercises

**1. Word Counter**
Count how many words are in a sentence (hint: count spaces + 1)

**2. Email Validator**
Check if an email has '@' and '.' in correct positions

**3. Password Strength Checker**
Check if password has uppercase, lowercase, digit, and is long enough

**Example solution for word counter:**

```cpp
#include <iostream>
#include <string>

int main() {
    std::string sentence;

    std::cout << "Enter a sentence: ";
    std::getline(std::cin, sentence);

    int wordCount = 1;

    for (char c : sentence) {
        if (c == ' ') {
            wordCount++;
        }
    }

    if (sentence.empty()) {
        wordCount = 0;
    }

    std::cout << "Number of words: " << wordCount << std::endl;

    return 0;
}
```

## What's Next?

Now you're a string master! Next, we'll learn about:
- **Structures** - Creating custom data types
- **Grouping related data together**
- **Building more complex programs!**

Keep coding! 📝
