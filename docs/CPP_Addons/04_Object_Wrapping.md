# Object Wrapping

Object wrapping allows you to expose C++ classes to JavaScript as native objects. This enables object-oriented patterns and maintains state between function calls.

## Why Object Wrapping?

### Stateful Operations

**Without wrapping (stateless):**
```javascript
// Every call is independent
const sum1 = addon.add(5, 3);    // 8
const sum2 = addon.add(10, 2);   // 12
// No state maintained
```

**With wrapping (stateful):**
```javascript
// Object maintains state
const calc = new addon.Calculator(10);
calc.add(5);        // 15 (10 + 5)
calc.multiply(2);   // 30 (15 * 2)
console.log(calc.value);  // 30
```

### Resource Management

**C++ resources (files, database connections, GPU contexts):**
```javascript
const db = new addon.Database('connection_string');
db.query('SELECT * FROM users');
db.close();  // Properly cleanup resources
```

## Basic Object Wrapping

### Minimal Example

**calculator.cc:**
```cpp
#include <node.h>
#include <node_object_wrap.h>

namespace demo {

using v8::Context;
using v8::Function;
using v8::FunctionCallbackInfo;
using v8::FunctionTemplate;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Value;

class Calculator : public node::ObjectWrap {
 public:
  static void Init(Isolate* isolate) {
    // Prepare constructor template
    Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
    tpl->SetClassName(String::NewFromUtf8(isolate, "Calculator").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(1);
    
    // Prototype methods
    NODE_SET_PROTOTYPE_METHOD(tpl, "add", Add);
    NODE_SET_PROTOTYPE_METHOD(tpl, "subtract", Subtract);
    NODE_SET_PROTOTYPE_METHOD(tpl, "multiply", Multiply);
    NODE_SET_PROTOTYPE_METHOD(tpl, "getValue", GetValue);
    
    // Store constructor
    constructor.Reset(isolate, tpl->GetFunction(isolate->GetCurrentContext())
      .ToLocalChecked());
  }
  
  static void NewInstance(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();
    
    const unsigned argc = 1;
    Local<Value> argv[argc] = { args[0] };
    Local<Function> cons = Local<Function>::New(isolate, constructor);
    Local<Object> instance = cons->NewInstance(context, argc, argv)
      .ToLocalChecked();
    
    args.GetReturnValue().Set(instance);
  }
  
 private:
  explicit Calculator(double value = 0) : value_(value) {}
  ~Calculator() {}
  
  // Constructor callback
  static void New(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();
    
    if (args.IsConstructCall()) {
      // Invoked as constructor: `new Calculator(...)`
      double value = args[0]->IsUndefined() ? 
        0 : args[0]->NumberValue(context).FromMaybe(0);
      
      Calculator* obj = new Calculator(value);
      obj->Wrap(args.This());
      args.GetReturnValue().Set(args.This());
    } else {
      // Invoked as plain function: `Calculator(...)`, turn into construct call
      const int argc = 1;
      Local<Value> argv[argc] = { args[0] };
      Local<Function> cons = Local<Function>::New(isolate, constructor);
      Local<Object> instance = cons->NewInstance(context, argc, argv)
        .ToLocalChecked();
      args.GetReturnValue().Set(instance);
    }
  }
  
  // Methods
  static void Add(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();
    
    Calculator* obj = ObjectWrap::Unwrap<Calculator>(args.Holder());
    obj->value_ += args[0]->NumberValue(context).FromMaybe(0);
    
    args.GetReturnValue().Set(Number::New(isolate, obj->value_));
  }
  
  static void Subtract(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();
    
    Calculator* obj = ObjectWrap::Unwrap<Calculator>(args.Holder());
    obj->value_ -= args[0]->NumberValue(context).FromMaybe(0);
    
    args.GetReturnValue().Set(Number::New(isolate, obj->value_));
  }
  
  static void Multiply(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();
    
    Calculator* obj = ObjectWrap::Unwrap<Calculator>(args.Holder());
    obj->value_ *= args[0]->NumberValue(context).FromMaybe(0);
    
    args.GetReturnValue().Set(Number::New(isolate, obj->value_));
  }
  
  static void GetValue(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    
    Calculator* obj = ObjectWrap::Unwrap<Calculator>(args.Holder());
    args.GetReturnValue().Set(Number::New(isolate, obj->value_));
  }
  
  static v8::Persistent<Function> constructor;
  double value_;
};

v8::Persistent<Function> Calculator::constructor;

void Initialize(Local<Object> exports, Local<Object> module) {
  Isolate* isolate = Isolate::GetCurrent();
  
  Calculator::Init(isolate);
  
  NODE_SET_METHOD(module, "exports", Calculator::NewInstance);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)

}  // namespace demo
```

**JavaScript usage:**
```javascript
const Calculator = require('./build/Release/addon');

const calc = new Calculator(10);
console.log(calc.getValue());  // 10

calc.add(5);
console.log(calc.getValue());  // 15

calc.multiply(2);
console.log(calc.getValue());  // 30

calc.subtract(10);
console.log(calc.getValue());  // 20
```

**Key concepts:**

**1. Inherit from ObjectWrap:**
```cpp
class Calculator : public node::ObjectWrap {
```
Provides automatic memory management.

**2. Wrap C++ object:**
```cpp
Calculator* obj = new Calculator(value);
obj->Wrap(args.This());  // Bind to JavaScript object
```

**3. Unwrap in methods:**
```cpp
Calculator* obj = ObjectWrap::Unwrap<Calculator>(args.Holder());
obj->value_ += x;  // Access C++ member
```

**4. Destructor called automatically:**
```cpp
~Calculator() {
  // Cleanup resources
  // Called when JavaScript object is garbage collected
}
```

## Properties (Getters/Setters)

**calculator-properties.cc:**
```cpp
class Calculator : public node::ObjectWrap {
 public:
  static void Init(Isolate* isolate) {
    Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
    tpl->SetClassName(String::NewFromUtf8(isolate, "Calculator")
      .ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(1);
    
    // Methods
    NODE_SET_PROTOTYPE_METHOD(tpl, "add", Add);
    
    // Properties (getter/setter)
    Local<ObjectTemplate> itpl = tpl->InstanceTemplate();
    itpl->SetAccessor(
      String::NewFromUtf8(isolate, "value").ToLocalChecked(),
      GetValue,
      SetValue
    );
    
    constructor.Reset(isolate, tpl->GetFunction(
      isolate->GetCurrentContext()).ToLocalChecked());
  }
  
 private:
  // Property getter
  static void GetValue(Local<String> property,
                       const PropertyCallbackInfo<Value>& info) {
    Isolate* isolate = info.GetIsolate();
    Calculator* obj = ObjectWrap::Unwrap<Calculator>(info.Holder());
    
    info.GetReturnValue().Set(Number::New(isolate, obj->value_));
  }
  
  // Property setter
  static void SetValue(Local<String> property,
                       Local<Value> value,
                       const PropertyCallbackInfo<void>& info) {
    Isolate* isolate = info.GetIsolate();
    Calculator* obj = ObjectWrap::Unwrap<Calculator>(info.Holder());
    Local<Context> context = isolate->GetCurrentContext();
    
    obj->value_ = value->NumberValue(context).FromMaybe(0);
  }
  
  // ... rest of implementation
};
```

**JavaScript usage:**
```javascript
const calc = new Calculator(10);

// Getter
console.log(calc.value);  // 10

// Setter
calc.value = 50;
console.log(calc.value);  // 50

calc.add(10);
console.log(calc.value);  // 60
```

## Factory Pattern

Create objects from factory functions:

**factory.cc:**
```cpp
class MyObject : public node::ObjectWrap {
 public:
  static void Init(Isolate* isolate) {
    Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
    tpl->SetClassName(String::NewFromUtf8(isolate, "MyObject")
      .ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(1);
    
    NODE_SET_PROTOTYPE_METHOD(tpl, "getValue", GetValue);
    
    constructor.Reset(isolate, tpl->GetFunction(
      isolate->GetCurrentContext()).ToLocalChecked());
  }
  
  static void CreateInstance(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();
    
    const unsigned argc = 1;
    Local<Value> argv[argc] = { args[0] };
    Local<Function> cons = Local<Function>::New(isolate, constructor);
    Local<Object> instance = cons->NewInstance(context, argc, argv)
      .ToLocalChecked();
    
    args.GetReturnValue().Set(instance);
  }
  
 private:
  explicit MyObject(double value = 0) : value_(value) {}
  ~MyObject() {}
  
  static void New(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();
    
    if (args.IsConstructCall()) {
      double value = args[0]->IsUndefined() ?
        0 : args[0]->NumberValue(context).FromMaybe(0);
      
      MyObject* obj = new MyObject(value);
      obj->Wrap(args.This());
      args.GetReturnValue().Set(args.This());
    }
  }
  
  static void GetValue(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    MyObject* obj = ObjectWrap::Unwrap<MyObject>(args.Holder());
    args.GetReturnValue().Set(Number::New(isolate, obj->value_));
  }
  
  static v8::Persistent<Function> constructor;
  double value_;
};

v8::Persistent<Function> MyObject::constructor;

void Initialize(Local<Object> exports) {
  MyObject::Init(Isolate::GetCurrent());
  
  NODE_SET_METHOD(exports, "createObject", MyObject::CreateInstance);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)
```

**JavaScript usage:**
```javascript
const addon = require('./build/Release/addon');

// Factory function (not constructor)
const obj = addon.createObject(42);
console.log(obj.getValue());  // 42
```

## Passing Wrapped Objects

Pass C++ objects between functions:

**pass-objects.cc:**
```cpp
class MyObject : public node::ObjectWrap {
  // ... Init and New ...
  
 public:
  double GetValue() const { return value_; }
  void SetValue(double value) { value_ = value; }
  
 private:
  double value_;
};

// Function that accepts wrapped object
void ProcessObject(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  // Unwrap the object
  MyObject* obj = node::ObjectWrap::Unwrap<MyObject>(args[0].As<Object>());
  
  // Use it
  double value = obj->GetValue();
  obj->SetValue(value * 2);
  
  args.GetReturnValue().Set(Number::New(isolate, obj->GetValue()));
}

void Initialize(Local<Object> exports) {
  MyObject::Init(Isolate::GetCurrent());
  
  NODE_SET_METHOD(exports, "createObject", MyObject::CreateInstance);
  NODE_SET_METHOD(exports, "processObject", ProcessObject);
}
```

**JavaScript usage:**
```javascript
const obj = addon.createObject(10);
console.log(obj.getValue());  // 10

const result = addon.processObject(obj);
console.log(result);          // 20
console.log(obj.getValue());  // 20 (modified)
```

## Resource Management

Proper cleanup of system resources:

**file-wrapper.cc:**
```cpp
#include <node.h>
#include <node_object_wrap.h>
#include <fstream>

namespace demo {

class FileWrapper : public node::ObjectWrap {
 public:
  static void Init(Isolate* isolate) {
    Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
    tpl->SetClassName(String::NewFromUtf8(isolate, "File").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(1);
    
    NODE_SET_PROTOTYPE_METHOD(tpl, "write", Write);
    NODE_SET_PROTOTYPE_METHOD(tpl, "close", Close);
    
    constructor.Reset(isolate, tpl->GetFunction(
      isolate->GetCurrentContext()).ToLocalChecked());
  }
  
  static void CreateInstance(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();
    
    const unsigned argc = 1;
    Local<Value> argv[argc] = { args[0] };
    Local<Function> cons = Local<Function>::New(isolate, constructor);
    Local<Object> instance = cons->NewInstance(context, argc, argv)
      .ToLocalChecked();
    
    args.GetReturnValue().Set(instance);
  }
  
 private:
  explicit FileWrapper(const std::string& filename) {
    file_.open(filename, std::ios::out);
  }
  
  ~FileWrapper() {
    // Automatic cleanup when object is garbage collected
    if (file_.is_open()) {
      file_.close();
    }
  }
  
  static void New(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    
    if (args.IsConstructCall()) {
      String::Utf8Value filename(isolate, args[0]);
      FileWrapper* obj = new FileWrapper(*filename);
      obj->Wrap(args.This());
      args.GetReturnValue().Set(args.This());
    }
  }
  
  static void Write(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    FileWrapper* obj = ObjectWrap::Unwrap<FileWrapper>(args.Holder());
    
    if (!obj->file_.is_open()) {
      isolate->ThrowException(v8::Exception::Error(
        String::NewFromUtf8(isolate, "File is closed").ToLocalChecked()));
      return;
    }
    
    String::Utf8Value data(isolate, args[0]);
    obj->file_ << *data;
    obj->file_.flush();
  }
  
  static void Close(const FunctionCallbackInfo<Value>& args) {
    FileWrapper* obj = ObjectWrap::Unwrap<FileWrapper>(args.Holder());
    
    if (obj->file_.is_open()) {
      obj->file_.close();
    }
  }
  
  static v8::Persistent<Function> constructor;
  std::ofstream file_;
};

v8::Persistent<Function> FileWrapper::constructor;

void Initialize(Local<Object> exports) {
  FileWrapper::Init(Isolate::GetCurrent());
  NODE_SET_METHOD(exports, "openFile", FileWrapper::CreateInstance);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)

}  // namespace demo
```

**JavaScript usage:**
```javascript
const file = addon.openFile('output.txt');

file.write('Hello, World!\n');
file.write('Second line\n');

file.close();
// Or let garbage collector close it automatically
```

## Summary

Object wrapping enables object-oriented C++ in JavaScript:

**Key Patterns:**
- Inherit from `node::ObjectWrap`
- Use `Wrap()` to bind C++ object to JavaScript object
- Use `Unwrap()` to access C++ object in methods
- Destructor called automatically on garbage collection
- Factory functions for creating instances

**Best Practices:**
- ✓ Always set internal field count: `SetInternalFieldCount(1)`
- ✓ Use `Persistent<Function>` for constructor
- ✓ Cleanup resources in destructor
- ✓ Check object state in methods (file open, connection alive)
- ✓ Use properties (getters/setters) for natural JavaScript API

**When to Use Object Wrapping:**
- Stateful operations (calculators, games)
- Resource management (files, databases, sockets)
- Complex data structures (trees, graphs)
- Hardware interfaces (cameras, sensors)

**Next:** Memory management and optimization
