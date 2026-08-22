# Introduction to C++ Addons with V8 API

C++ addons allow you to call native C++ code from Node.js JavaScript, enabling performance-critical operations and system-level integration. This guide focuses on using the native V8 API for maximum performance and control.

## Why C++ Addons?

### Performance Comparison

**Scenario 1: Image Processing**
```
Pure JavaScript: 45 seconds
Native C++ addon: 0.8 seconds
Performance gain: 56x faster
```

**Scenario 2: Cryptographic Hashing**
```
Pure JavaScript bcrypt: 280 seconds
C++ addon: 15 seconds
Performance gain: 18x faster
```

**Scenario 3: Data Parsing (100MB CSV)**
```
Pure JavaScript: 8 seconds, 450MB memory
C++ addon: 1.2 seconds, 80MB memory
Performance gain: 6.6x faster, 82% less memory
```

### When to Use C++ Addons

**Ideal Use Cases:**
- CPU-intensive computations (image/video processing, compression)
- High-frequency trading algorithms
- Cryptographic operations
- Scientific computing and simulations
- Real-time audio/video processing
- Integration with existing C/C++ libraries
- Hardware interfacing (USB, serial ports)
- Custom high-performance data structures

**When NOT to Use:**
- I/O-bound operations (already async in Node.js)
- Simple CRUD operations
- Network requests
- File system operations
- When JavaScript performance is sufficient (measure first!)

### V8 API vs N-API

**V8 API (This Guide):**
- Direct access to V8 internals
- Maximum performance
- More control and flexibility
- Breaks between Node.js versions (requires recompilation)
- Used by performance-critical modules

**N-API (Alternative):**
- Stable ABI across Node versions
- Easier to maintain
- Slightly more overhead
- Better for general-purpose modules

**This guide uses V8 API for maximum performance.**

## Environment Setup

### Required Tools

**1. C++ Compiler**

**macOS:**
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Verify installation
clang++ --version
# Should show: Apple clang version 14.0.0 or higher
```

**Linux (Ubuntu/Debian):**
```bash
# Install build essentials
sudo apt-get update
sudo apt-get install build-essential

# Verify installation
g++ --version
# Should show: g++ 9.0.0 or higher
```

**Windows:**
```bash
# Install Visual Studio 2019 or 2022
# - Include "Desktop development with C++"
# - Or install Build Tools for Visual Studio

# Verify (in Developer Command Prompt)
cl
# Should show: Microsoft C/C++ Optimizing Compiler
```

**2. Node.js**

```bash
# Install Node.js 14.x or higher (LTS recommended)
node --version
# Should show: v18.0.0 or higher

npm --version
# Should show: 8.0.0 or higher
```

**3. Python (Required by node-gyp)**

```bash
# Python 3.x required
python3 --version
# Should show: Python 3.7.0 or higher

# macOS/Linux
which python3

# Windows
where python
```

**4. node-gyp (Build Tool)**

```bash
# Install globally
npm install -g node-gyp

# Verify installation
node-gyp --version
# Should show: v9.0.0 or higher
```

**What is node-gyp?**

node-gyp is the build system for Node.js addons:
- Compiles C++ source into native binaries (.node files)
- Generates platform-specific build files
- Links against Node.js and V8 headers
- Handles cross-platform compilation

### Verify Setup

Create a test to verify your environment:

**verify-setup.js:**
```javascript
const process = require('process');

console.log('=== Node.js Environment ===');
console.log('Node version:', process.version);
console.log('V8 version:', process.versions.v8);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('');

console.log('=== Build Configuration ===');
console.log('Node prefix:', process.config.variables.node_prefix);
console.log('Node include dir:', process.config.variables.node_root_dir || 'Available');
console.log('');

console.log('✓ Environment is ready for addon development');
```

**Run verification:**
```bash
node verify-setup.js
```

**Expected output:**
```
=== Node.js Environment ===
Node version: v18.12.0
V8 version: 10.2.154.15-node.12
Platform: darwin (or linux, win32)
Architecture: x64 (or arm64)

=== Build Configuration ===
Node prefix: /usr/local
Node include dir: Available

✓ Environment is ready for addon development
```

## Your First C++ Addon

### Project Structure

```
hello-addon/
├── binding.gyp       # Build configuration
├── hello.cc          # C++ source
├── package.json      # Node.js package
└── test.js           # JavaScript test
```

### Step 1: Initialize Project

```bash
mkdir hello-addon
cd hello-addon
npm init -y
```

### Step 2: Create binding.gyp

**binding.gyp:**
```python
{
  "targets": [
    {
      "target_name": "hello",
      "sources": [ "hello.cc" ],
      "include_dirs": [
        "<!(node -e \"require('nan')\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.7"
      },
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      }
    }
  ]
}
```

**Configuration explained:**

- **target_name**: Name of output binary (hello.node)
- **sources**: C++ files to compile
- **cflags!**: Remove compiler flags (enable exceptions)
- **xcode_settings**: macOS-specific settings
- **msvs_settings**: Windows Visual Studio settings

### Step 3: Create C++ Source

**hello.cc:**
```cpp
#include <node.h>

namespace demo {

using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::String;
using v8::Value;

// Simple function that returns "Hello World"
void SayHello(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  // Create a new JavaScript string
  Local<String> result = String::NewFromUtf8(
    isolate,
    "Hello World from C++!"
  ).ToLocalChecked();
  
  // Set return value
  args.GetReturnValue().Set(result);
}

// Module initialization function
void Initialize(Local<Object> exports) {
  NODE_SET_METHOD(exports, "sayHello", SayHello);
}

// Register the addon
NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)

}  // namespace demo
```

**Understanding the code:**

**1. Include V8 headers:**
```cpp
#include <node.h>
```
Provides access to Node.js and V8 APIs.

**2. Namespace and type aliases:**
```cpp
namespace demo {
using v8::FunctionCallbackInfo;
using v8::Isolate;
// ...
}
```
Keeps code organized and shortens type names.

**3. Function signature:**
```cpp
void SayHello(const FunctionCallbackInfo<Value>& args)
```
All exported functions use this signature:
- `FunctionCallbackInfo<Value>&` contains arguments and context
- Return type is `void` (return via args.GetReturnValue())

**4. Get isolate:**
```cpp
Isolate* isolate = args.GetIsolate();
```
`Isolate` represents an isolated V8 VM instance. Required for all V8 operations.

**5. Create JavaScript values:**
```cpp
Local<String> result = String::NewFromUtf8(
  isolate,
  "Hello World from C++!"
).ToLocalChecked();
```
Converts C++ string to V8 string object.

**6. Return values:**
```cpp
args.GetReturnValue().Set(result);
```
Sets the function's return value.

**7. Export function:**
```cpp
NODE_SET_METHOD(exports, "sayHello", SayHello);
```
Makes function available to JavaScript as `exports.sayHello`.

**8. Register module:**
```cpp
NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)
```
Registers the addon with Node.js.

### Step 4: Build the Addon

```bash
# Configure build
node-gyp configure

# Compile
node-gyp build
```

**Build process:**

**configure:**
- Generates platform-specific build files
- Creates `build/` directory
- On Unix: Generates Makefile
- On Windows: Generates Visual Studio project

**build:**
- Compiles C++ source
- Links against Node.js/V8 libraries
- Produces `build/Release/hello.node`

**Common build errors:**

**Error: "node-gyp not found"**
```bash
npm install -g node-gyp
```

**Error: "Python not found"**
```bash
# Install Python 3.x
# Set node-gyp python path
npm config set python /path/to/python3
```

**Error: "Cannot find node.h"**
```bash
# Ensure Node.js development headers are available
node-gyp install
```

### Step 5: Test the Addon

**test.js:**
```javascript
// Load the compiled addon
const addon = require('./build/Release/hello');

// Call the native function
console.log(addon.sayHello());
// Output: Hello World from C++!
```

**Run the test:**
```bash
node test.js
```

**Expected output:**
```
Hello World from C++!
```

**Congratulations! You've built your first C++ addon using V8 API!**

## Understanding V8 Fundamentals

### Isolate

The `Isolate` is V8's representation of an independent VM instance:

```cpp
Isolate* isolate = args.GetIsolate();
```

**Key concepts:**
- One isolate per thread
- Manages heap and execution context
- Required for creating V8 objects
- Cannot share objects between isolates

**Thread safety:**
```cpp
// WRONG: Using isolate from different thread
void WorkerThread(Isolate* isolate) {
  // Crash! Isolate not thread-safe
  Local<String> str = String::NewFromUtf8(isolate, "bad");
}

// CORRECT: Each thread gets its own isolate
void WorkerThread() {
  Isolate* isolate = Isolate::GetCurrent();
  Local<String> str = String::NewFromUtf8(isolate, "good");
}
```

### Context

A `Context` is an execution environment:

```cpp
Local<Context> context = isolate->GetCurrentContext();
```

**Why contexts matter:**
- Separate global objects
- Isolated execution environments
- Required for Worker threads
- Used in embeddings (Electron, NW.js)

**Example:**
```cpp
// Get current context
Local<Context> context = isolate->GetCurrentContext();

// Most operations require context
object->Set(context, key, value);
function->Call(context, receiver, argc, argv);
```

### Handles: Local vs Persistent

**Local handles:**
```cpp
Local<String> str = String::NewFromUtf8(isolate, "temp");
```

- Stack-allocated
- Automatically cleaned up when scope exits
- Fast and lightweight
- Use for temporary values

**Example scope:**
```cpp
void MyFunction(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  {
    Local<String> temp1 = String::NewFromUtf8(isolate, "hello");
    // temp1 is valid here
  }
  // temp1 is gone (scope exited)
  
  Local<String> temp2 = String::NewFromUtf8(isolate, "world");
  // temp2 is valid until function returns
}
```

**Persistent handles:**
```cpp
Persistent<Function> callback;
callback.Reset(isolate, function);
```

- Heap-allocated
- Survives garbage collection
- Must be explicitly released
- Use for callbacks and long-lived objects

**Example:**
```cpp
class MyClass {
 public:
  void SetCallback(Isolate* isolate, Local<Function> fn) {
    callback_.Reset(isolate, fn);
  }
  
  void CallCallback(Isolate* isolate) {
    Local<Function> fn = Local<Function>::New(isolate, callback_);
    // Use fn...
  }
  
  ~MyClass() {
    callback_.Reset();  // Must explicitly release!
  }
  
 private:
  Persistent<Function> callback_;
};
```

### HandleScope

`HandleScope` manages Local handle lifetime:

```cpp
void MyFunction(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);  // Create scope
  
  Local<String> str = String::NewFromUtf8(isolate, "hello");
  // Use str...
  
  // scope destructor automatically cleans up all Local handles
}
```

**Why it matters:**
- Prevents memory leaks
- Automatically created for addon functions
- Must create manually in callbacks/loops

**Example with explicit scope:**
```cpp
void ProcessMany(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  for (int i = 0; i < 1000000; i++) {
    HandleScope scope(isolate);  // New scope each iteration
    
    Local<String> str = String::NewFromUtf8(isolate, "temp");
    // Process str...
    
    // scope destructor cleans up at end of iteration
  }
  // Without HandleScope in loop, 1M handles would accumulate!
}
```

## Working with Arguments

### Accessing Arguments

**args object:**
```cpp
void Add(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  
  // Check number of arguments
  if (args.Length() < 2) {
    isolate->ThrowException(Exception::TypeError(
      String::NewFromUtf8(isolate, "Wrong number of arguments")
        .ToLocalChecked()
    ));
    return;
  }
  
  // Access arguments by index
  Local<Value> arg0 = args[0];
  Local<Value> arg1 = args[1];
  
  // Check types
  if (!arg0->IsNumber() || !arg1->IsNumber()) {
    isolate->ThrowException(Exception::TypeError(
      String::NewFromUtf8(isolate, "Arguments must be numbers")
        .ToLocalChecked()
    ));
    return;
  }
  
  // Convert to C++ types
  double value0 = arg0->NumberValue(context).FromMaybe(0.0);
  double value1 = arg1->NumberValue(context).FromMaybe(0.0);
  
  // Compute result
  double result = value0 + value1;
  
  // Return result
  args.GetReturnValue().Set(Number::New(isolate, result));
}
```

**JavaScript usage:**
```javascript
const result = addon.add(5, 3);  // 8
```

### Type Checking

**Available type checks:**
```cpp
value->IsUndefined()
value->IsNull()
value->IsTrue()
value->IsFalse()
value->IsBoolean()
value->IsNumber()
value->IsString()
value->IsObject()
value->IsArray()
value->IsFunction()
value->IsDate()
value->IsRegExp()
value->IsPromise()
```

**Example:**
```cpp
void ProcessValue(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Value> value = args[0];
  
  if (value->IsString()) {
    Local<String> str = value.As<String>();
    // Process string...
  } else if (value->IsNumber()) {
    double num = value.As<Number>()->Value();
    // Process number...
  } else if (value->IsArray()) {
    Local<Array> arr = value.As<Array>();
    // Process array...
  } else {
    isolate->ThrowException(Exception::TypeError(
      String::NewFromUtf8(isolate, "Unsupported type")
        .ToLocalChecked()
    ));
  }
}
```

### Converting JavaScript to C++ Types

**Numbers:**
```cpp
double doubleVal = value->NumberValue(context).FromMaybe(0.0);
int32_t intVal = value->Int32Value(context).FromMaybe(0);
uint32_t uintVal = value->Uint32Value(context).FromMaybe(0);
int64_t int64Val = value->IntegerValue(context).FromMaybe(0);
```

**Strings:**
```cpp
// To UTF-8 std::string
String::Utf8Value utf8(isolate, value);
std::string str(*utf8, utf8.length());

// Or direct usage
String::Utf8Value utf8Value(isolate, value);
const char* cstr = *utf8Value;
```

**Booleans:**
```cpp
bool boolVal = value->BooleanValue(isolate);
```

**Arrays:**
```cpp
Local<Array> arr = value.As<Array>();
uint32_t length = arr->Length();

for (uint32_t i = 0; i < length; i++) {
  Local<Value> element = arr->Get(context, i).ToLocalChecked();
  // Process element...
}
```

**Objects:**
```cpp
Local<Object> obj = value.As<Object>();

// Get property
Local<Value> prop = obj->Get(
  context,
  String::NewFromUtf8(isolate, "propertyName").ToLocalChecked()
).ToLocalChecked();

// Set property
obj->Set(
  context,
  String::NewFromUtf8(isolate, "propertyName").ToLocalChecked(),
  String::NewFromUtf8(isolate, "value").ToLocalChecked()
);
```

## Summary

You've learned the fundamentals of C++ addon development with V8:

**Key Concepts:**
- C++ addons provide maximum performance for CPU-bound operations
- V8 API offers direct access to JavaScript engine
- Isolate represents independent VM instance
- Handles manage memory (Local for temporary, Persistent for long-lived)
- HandleScope prevents memory leaks
- Type checking and conversion bridge JavaScript and C++

**Development Workflow:**
1. Write C++ code (addon.cc)
2. Configure build (binding.gyp)
3. Compile (node-gyp build)
4. Load and test (require('./build/Release/addon'))

**Next Steps:**
- Learn V8 data types and conversions (Chapter 2)
- Understand callbacks and async operations (Chapter 3)
- Master object wrapping for C++ classes (Chapter 4)
- Optimize performance and memory (Chapter 5)

**Remember:** Measure before optimizing. Only use C++ addons when JavaScript performance isn't sufficient!
