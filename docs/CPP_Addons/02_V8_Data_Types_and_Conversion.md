# V8 Data Types and Conversion

Mastering data type conversion between JavaScript and C++ is essential for building efficient addons. This chapter covers all V8 data types, conversion patterns, and performance optimization.

## V8 Type Hierarchy

### Understanding V8 Types

```
Value (base class)
├── Primitive
│   ├── Undefined
│   ├── Null
│   ├── Boolean
│   ├── String
│   ├── Symbol
│   └── Number
├── Object
│   ├── Array
│   ├── Function
│   ├── Date
│   ├── RegExp
│   ├── Promise
│   ├── Map
│   ├── Set
│   └── TypedArray
└── External (wraps C++ pointers)
```

**Key principle:** All JavaScript values in C++ are represented as `Local<Value>`. You must cast to specific types after type checking.

## Working with Numbers

### Creating Numbers

**numbers.cc:**
```cpp
#include <node.h>

namespace demo {

using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Integer;
using v8::Value;

// Return an integer
void GetInteger(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  // Create integer
  Local<Integer> result = Integer::New(isolate, 42);
  args.GetReturnValue().Set(result);
}

// Return a floating-point number
void GetDouble(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  // Create number
  Local<Number> result = Number::New(isolate, 3.14159);
  args.GetReturnValue().Set(result);
}

// Return large integer (int64)
void GetLargeInt(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  // JavaScript Number can safely represent integers up to 2^53-1
  int64_t largeNumber = 9007199254740991LL;  // Number.MAX_SAFE_INTEGER
  
  Local<Number> result = Number::New(isolate, static_cast<double>(largeNumber));
  args.GetReturnValue().Set(result);
}

}  // namespace demo
```

### Converting Numbers from JavaScript

**convert-numbers.cc:**
```cpp
void ProcessNumber(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  
  if (args.Length() < 1 || !args[0]->IsNumber()) {
    isolate->ThrowException(Exception::TypeError(
      String::NewFromUtf8(isolate, "Expected a number").ToLocalChecked()));
    return;
  }
  
  Local<Value> arg = args[0];
  
  // Various number conversions
  double asDouble = arg->NumberValue(context).FromMaybe(0.0);
  int32_t asInt32 = arg->Int32Value(context).FromMaybe(0);
  uint32_t asUint32 = arg->Uint32Value(context).FromMaybe(0);
  int64_t asInt64 = arg->IntegerValue(context).FromMaybe(0);
  
  // Use the values
  std::cout << "Double: " << asDouble << std::endl;
  std::cout << "Int32: " << asInt32 << std::endl;
  std::cout << "Uint32: " << asUint32 << std::endl;
  std::cout << "Int64: " << asInt64 << std::endl;
  
  args.GetReturnValue().Set(asDouble * 2);
}
```

**JavaScript usage:**
```javascript
const addon = require('./build/Release/addon');

console.log(addon.getInteger());    // 42
console.log(addon.getDouble());     // 3.14159
console.log(addon.getLargeInt());   // 9007199254740991

addon.processNumber(42);      // Logs conversions, returns 84
addon.processNumber(3.7);     // Handles floating point
addon.processNumber(-100);    // Handles negatives
```

**Important:** JavaScript numbers are always 64-bit floating point (IEEE 754). Integers are safe up to ±2^53-1.

## Working with Strings

### Creating Strings

**strings.cc:**
```cpp
void CreateString(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  // From C string literal
  Local<String> str1 = String::NewFromUtf8(
    isolate,
    "Hello World"
  ).ToLocalChecked();
  
  // From std::string
  std::string cppString = "C++ String";
  Local<String> str2 = String::NewFromUtf8(
    isolate,
    cppString.c_str()
  ).ToLocalChecked();
  
  // With explicit length
  const char* data = "Test\0Hidden";  // Contains null byte
  Local<String> str3 = String::NewFromUtf8(
    isolate,
    data,
    NewStringType::kNormal,
    11  // Explicit length includes null byte
  ).ToLocalChecked();
  
  args.GetReturnValue().Set(str1);
}

// Concatenate strings
void ConcatStrings(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  
  if (args.Length() < 2 || !args[0]->IsString() || !args[1]->IsString()) {
    isolate->ThrowException(Exception::TypeError(
      String::NewFromUtf8(isolate, "Expected two strings").ToLocalChecked()));
    return;
  }
  
  // Convert to C++ strings
  String::Utf8Value str1(isolate, args[0]);
  String::Utf8Value str2(isolate, args[1]);
  
  // Concatenate in C++
  std::string result = std::string(*str1) + std::string(*str2);
  
  // Convert back to V8 string
  args.GetReturnValue().Set(
    String::NewFromUtf8(isolate, result.c_str()).ToLocalChecked());
}
```

### String Conversion Patterns

**Pattern 1: Quick conversion (stack-allocated)**
```cpp
void ProcessString(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  String::Utf8Value str(isolate, args[0]);
  
  // Use as C string
  const char* cstr = *str;
  printf("String: %s\n", cstr);
  
  // Get length
  int length = str.length();
}
```

**Pattern 2: std::string conversion**
```cpp
void ToStdString(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  String::Utf8Value utf8(isolate, args[0]);
  
  // Convert to std::string (safer for complex operations)
  std::string str(*utf8, utf8.length());
  
  // Can now use std::string methods
  std::transform(str.begin(), str.end(), str.begin(), ::toupper);
  
  args.GetReturnValue().Set(
    String::NewFromUtf8(isolate, str.c_str()).ToLocalChecked());
}
```

**Pattern 3: Handling non-ASCII (Unicode)**
```cpp
void HandleUnicode(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  String::Utf8Value utf8(isolate, args[0]);
  
  // UTF-8 encoded string
  std::string str(*utf8, utf8.length());
  
  // Length in bytes (not characters!)
  size_t byteLength = str.length();
  
  // For character count, need to parse UTF-8
  // (Use a UTF-8 library like utf8cpp)
}
```

**JavaScript usage:**
```javascript
addon.concatStrings("Hello ", "World");  // "Hello World"
addon.toStdString("hello");              // "HELLO"
addon.handleUnicode("Hello 世界");       // Handles Unicode correctly
```

## Working with Booleans

**booleans.cc:**
```cpp
void GetBoolean(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  // Create boolean
  Local<Boolean> trueValue = Boolean::New(isolate, true);
  Local<Boolean> falseValue = Boolean::New(isolate, false);
  
  args.GetReturnValue().Set(trueValue);
}

void ProcessBoolean(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  if (!args[0]->IsBoolean()) {
    isolate->ThrowException(Exception::TypeError(
      String::NewFromUtf8(isolate, "Expected boolean").ToLocalChecked()));
    return;
  }
  
  // Convert to C++ bool
  bool value = args[0]->BooleanValue(isolate);
  
  if (value) {
    std::cout << "Value is true" << std::endl;
  } else {
    std::cout << "Value is false" << std::endl;
  }
  
  args.GetReturnValue().Set(!value);  // Return negated value
}
```

**Truthy/falsy conversion:**
```cpp
// Any value can be converted to boolean
bool isTruthy = args[0]->BooleanValue(isolate);

// These are falsy: false, 0, "", null, undefined, NaN
// Everything else is truthy
```

## Working with Arrays

### Creating Arrays

**arrays.cc:**
```cpp
void CreateArray(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  
  // Create array with length
  Local<Array> arr = Array::New(isolate, 3);
  
  // Set elements
  arr->Set(context, 0, Number::New(isolate, 10)).Check();
  arr->Set(context, 1, Number::New(isolate, 20)).Check();
  arr->Set(context, 2, Number::New(isolate, 30)).Check();
  
  args.GetReturnValue().Set(arr);
}

// Return array from C++ vector
void VectorToArray(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  
  // C++ vector
  std::vector<int> numbers = {1, 2, 3, 4, 5};
  
  // Create V8 array
  Local<Array> arr = Array::New(isolate, numbers.size());
  
  for (size_t i = 0; i < numbers.size(); i++) {
    arr->Set(context, i, Number::New(isolate, numbers[i])).Check();
  }
  
  args.GetReturnValue().Set(arr);
}
```

### Processing Arrays

**process-array.cc:**
```cpp
void SumArray(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  
  if (!args[0]->IsArray()) {
    isolate->ThrowException(Exception::TypeError(
      String::NewFromUtf8(isolate, "Expected array").ToLocalChecked()));
    return;
  }
  
  Local<Array> arr = args[0].As<Array>();
  uint32_t length = arr->Length();
  
  double sum = 0;
  
  for (uint32_t i = 0; i < length; i++) {
    Local<Value> element = arr->Get(context, i).ToLocalChecked();
    
    if (element->IsNumber()) {
      sum += element->NumberValue(context).FromMaybe(0.0);
    }
  }
  
  args.GetReturnValue().Set(Number::New(isolate, sum));
}

// Convert array to C++ vector
void ArrayToVector(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  
  Local<Array> arr = args[0].As<Array>();
  uint32_t length = arr->Length();
  
  std::vector<double> numbers;
  numbers.reserve(length);  // Pre-allocate for efficiency
  
  for (uint32_t i = 0; i < length; i++) {
    Local<Value> element = arr->Get(context, i).ToLocalChecked();
    
    if (element->IsNumber()) {
      numbers.push_back(element->NumberValue(context).FromMaybe(0.0));
    }
  }
  
  // Process vector...
  double sum = std::accumulate(numbers.begin(), numbers.end(), 0.0);
  
  args.GetReturnValue().Set(Number::New(isolate, sum));
}
```

**JavaScript usage:**
```javascript
const arr = addon.createArray();      // [10, 20, 30]
const vec = addon.vectorToArray();    // [1, 2, 3, 4, 5]

const sum = addon.sumArray([1, 2, 3, 4, 5]);  // 15
```

## Working with Objects

### Creating Objects

**objects.cc:**
```cpp
void CreateObject(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  
  // Create empty object
  Local<Object> obj = Object::New(isolate);
  
  // Set properties
  obj->Set(
    context,
    String::NewFromUtf8(isolate, "name").ToLocalChecked(),
    String::NewFromUtf8(isolate, "John Doe").ToLocalChecked()
  ).Check();
  
  obj->Set(
    context,
    String::NewFromUtf8(isolate, "age").ToLocalChecked(),
    Number::New(isolate, 30)
  ).Check();
  
  obj->Set(
    context,
    String::NewFromUtf8(isolate, "active").ToLocalChecked(),
    Boolean::New(isolate, true)
  ).Check();
  
  // Nested array
  Local<Array> hobbies = Array::New(isolate, 2);
  hobbies->Set(context, 0, 
    String::NewFromUtf8(isolate, "reading").ToLocalChecked()).Check();
  hobbies->Set(context, 1, 
    String::NewFromUtf8(isolate, "coding").ToLocalChecked()).Check();
  
  obj->Set(
    context,
    String::NewFromUtf8(isolate, "hobbies").ToLocalChecked(),
    hobbies
  ).Check();
  
  args.GetReturnValue().Set(obj);
}
```

### Reading Object Properties

**read-object.cc:**
```cpp
void ReadObjectProperties(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  
  if (!args[0]->IsObject()) {
    isolate->ThrowException(Exception::TypeError(
      String::NewFromUtf8(isolate, "Expected object").ToLocalChecked()));
    return;
  }
  
  Local<Object> obj = args[0].As<Object>();
  
  // Get property
  Local<Value> name = obj->Get(
    context,
    String::NewFromUtf8(isolate, "name").ToLocalChecked()
  ).ToLocalChecked();
  
  if (name->IsString()) {
    String::Utf8Value utf8(isolate, name);
    std::cout << "Name: " << *utf8 << std::endl;
  }
  
  // Check if property exists
  bool hasAge = obj->Has(
    context,
    String::NewFromUtf8(isolate, "age").ToLocalChecked()
  ).FromMaybe(false);
  
  if (hasAge) {
    Local<Value> age = obj->Get(
      context,
      String::NewFromUtf8(isolate, "age").ToLocalChecked()
    ).ToLocalChecked();
    
    if (age->IsNumber()) {
      double ageValue = age->NumberValue(context).FromMaybe(0);
      std::cout << "Age: " << ageValue << std::endl;
    }
  }
  
  // Get all property names
  Local<Array> propertyNames = obj->GetPropertyNames(context).ToLocalChecked();
  uint32_t length = propertyNames->Length();
  
  std::cout << "Properties: ";
  for (uint32_t i = 0; i < length; i++) {
    Local<Value> key = propertyNames->Get(context, i).ToLocalChecked();
    String::Utf8Value keyUtf8(isolate, key);
    std::cout << *keyUtf8 << " ";
  }
  std::cout << std::endl;
}
```

**JavaScript usage:**
```javascript
const user = addon.createObject();
// {
//   name: 'John Doe',
//   age: 30,
//   active: true,
//   hobbies: ['reading', 'coding']
// }

addon.readObjectProperties(user);
// Logs: Name: John Doe
//       Age: 30
//       Properties: name age active hobbies
```

## Working with Buffers

Buffers are crucial for high-performance binary data processing.

**buffers.cc:**
```cpp
void CreateBuffer(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  size_t length = 1024;
  
  // Allocate buffer
  Local<v8::ArrayBuffer> buffer = v8::ArrayBuffer::New(isolate, length);
  
  // Get pointer to data
  std::shared_ptr<v8::BackingStore> backing = buffer->GetBackingStore();
  uint8_t* data = static_cast<uint8_t*>(backing->Data());
  
  // Fill with data
  for (size_t i = 0; i < length; i++) {
    data[i] = i % 256;
  }
  
  args.GetReturnValue().Set(buffer);
}

void ProcessBuffer(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  if (!args[0]->IsArrayBuffer() && !args[0]->IsArrayBufferView()) {
    isolate->ThrowException(Exception::TypeError(
      String::NewFromUtf8(isolate, "Expected Buffer or TypedArray")
        .ToLocalChecked()));
    return;
  }
  
  Local<v8::ArrayBuffer> buffer;
  size_t byte_offset = 0;
  size_t byte_length = 0;
  
  if (args[0]->IsArrayBufferView()) {
    Local<v8::ArrayBufferView> view = args[0].As<v8::ArrayBufferView>();
    buffer = view->Buffer();
    byte_offset = view->ByteOffset();
    byte_length = view->ByteLength();
  } else {
    buffer = args[0].As<v8::ArrayBuffer>();
    byte_length = buffer->ByteLength();
  }
  
  std::shared_ptr<v8::BackingStore> backing = buffer->GetBackingStore();
  uint8_t* data = static_cast<uint8_t*>(backing->Data()) + byte_offset;
  
  // Process data
  uint64_t sum = 0;
  for (size_t i = 0; i < byte_length; i++) {
    sum += data[i];
  }
  
  args.GetReturnValue().Set(Number::New(isolate, static_cast<double>(sum)));
}

// Efficient buffer copy (in-place modification)
void ModifyBuffer(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  Local<v8::ArrayBuffer> buffer = args[0].As<v8::ArrayBuffer>();
  std::shared_ptr<v8::BackingStore> backing = buffer->GetBackingStore();
  uint8_t* data = static_cast<uint8_t*>(backing->Data());
  size_t length = backing->ByteLength();
  
  // Modify in place (zero-copy)
  for (size_t i = 0; i < length; i++) {
    data[i] = data[i] * 2;
  }
  
  // No return needed - buffer modified in place
}
```

**JavaScript usage:**
```javascript
const buffer = addon.createBuffer();        // ArrayBuffer of 1024 bytes
console.log(buffer.byteLength);             // 1024

const sum = addon.processBuffer(buffer);    // Sum all bytes

addon.modifyBuffer(buffer);                 // Doubles all values in-place
```

## TypedArrays

**typed-arrays.cc:**
```cpp
void ProcessTypedArray(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  if (!args[0]->IsTypedArray()) {
    isolate->ThrowException(Exception::TypeError(
      String::NewFromUtf8(isolate, "Expected TypedArray").ToLocalChecked()));
    return;
  }
  
  Local<v8::TypedArray> typedArray = args[0].As<v8::TypedArray>();
  
  // Get underlying ArrayBuffer
  Local<v8::ArrayBuffer> buffer = typedArray->Buffer();
  std::shared_ptr<v8::BackingStore> backing = buffer->GetBackingStore();
  
  size_t byte_offset = typedArray->ByteOffset();
  size_t byte_length = typedArray->ByteLength();
  size_t length = typedArray->Length();
  
  // Check specific type
  if (typedArray->IsUint8Array()) {
    uint8_t* data = static_cast<uint8_t*>(backing->Data()) + byte_offset;
    // Process as uint8...
  } else if (typedArray->IsFloat64Array()) {
    double* data = reinterpret_cast<double*>(
      static_cast<uint8_t*>(backing->Data()) + byte_offset);
    // Process as double...
  }
}
```

## Null and Undefined

**null-undefined.cc:**
```cpp
void ReturnUndefined(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  args.GetReturnValue().Set(v8::Undefined(isolate));
}

void ReturnNull(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  args.GetReturnValue().Set(v8::Null(isolate));
}

void CheckNullOrUndefined(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Value> val = args[0];
  
  if (val->IsNull()) {
    std::cout << "Value is null" << std::endl;
  } else if (val->IsUndefined()) {
    std::cout << "Value is undefined" << std::endl;
  } else {
    std::cout << "Value is defined" << std::endl;
  }
}
```

## Performance Optimization

### Minimize Conversions

**Bad: Multiple conversions**
```cpp
void ProcessString(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  // Conversion 1
  String::Utf8Value str1(isolate, args[0]);
  std::string s1(*str1);
  
  // Conversion 2 (unnecessary!)
  String::Utf8Value str2(isolate, args[0]);
  std::string s2(*str2);
  
  // Use s1 and s2 (wasteful)
}
```

**Good: Single conversion**
```cpp
void ProcessString(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  // Convert once
  String::Utf8Value str(isolate, args[0]);
  std::string s(*str);
  
  // Reuse s
}
```

### Reuse Objects

**Bad: Create in loop**
```cpp
for (int i = 0; i < 1000; i++) {
  Local<String> key = String::NewFromUtf8(isolate, "key").ToLocalChecked();
  // Use key...
}
```

**Good: Create once**
```cpp
Local<String> key = String::NewFromUtf8(isolate, "key").ToLocalChecked();
for (int i = 0; i < 1000; i++) {
  // Reuse key
}
```

### Batch Operations

**Bad: Individual operations**
```cpp
for (int i = 0; i < array.size(); i++) {
  Local<Number> num = Number::New(isolate, array[i]);
  result->Set(context, i, num).Check();
}
```

**Good: Batch when possible**
```cpp
// Process in C++ first
std::vector<double> processed = ProcessInCpp(array);

// Then convert to V8 objects
for (size_t i = 0; i < processed.size(); i++) {
  result->Set(context, i, Number::New(isolate, processed[i])).Check();
}
```

## Summary

You've mastered V8 data type conversion:

**Key Takeaways:**
- Always check types before conversion (`IsNumber()`, `IsString()`, etc.)
- Use `ToLocalChecked()` for infallible operations
- Use `FromMaybe()` for operations that might fail
- Buffers enable zero-copy data transfer
- Minimize conversions for better performance
- Reuse V8 objects when possible

**Type Conversion Checklist:**
- ✓ Check type before converting
- ✓ Handle conversion failures
- ✓ Use appropriate C++ types
- ✓ Minimize unnecessary conversions
- ✓ Prefer in-place modifications for buffers

**Next:** Async operations with libuv
