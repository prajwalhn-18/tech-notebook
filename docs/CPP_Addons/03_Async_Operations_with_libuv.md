# Async Operations with libuv

Node.js is single-threaded with an event loop. Long-running C++ operations must run asynchronously to avoid blocking. This chapter covers libuv integration, worker threads, and async patterns.

## The Event Loop Problem

### Why Async is Critical

**Synchronous operation (BLOCKS event loop):**

**bad-sync.cc:**
```cpp
void ProcessImage(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  // This takes 5 seconds and BLOCKS everything!
  uint8_t* result = ExpensiveImageProcessing(inputData, inputSize);
  
  // Event loop frozen for 5 seconds
  // - No HTTP requests handled
  // - No timers fire
  // - No I/O operations complete
  // - Application appears frozen
  
  args.GetReturnValue().Set(/* result */);
}
```

**Impact:**
```
Timeline:
0ms:    processImage() called
0-5000ms: EVENT LOOP BLOCKED
          - Server can't respond to requests
          - Scheduled callbacks don't run
          - Application unusable
5000ms: Function returns
5000ms+: Event loop resumes
```

**The Rule: Operations > 10ms must be async!**

## libuv Work Queue

### Understanding libuv

libuv is Node.js's cross-platform async I/O library:
- Manages thread pool for async operations
- Handles file system operations
- Manages network I/O
- Provides platform abstraction (Windows, Linux, macOS)

**Default thread pool size: 4 threads**

**Configure thread pool:**
```bash
UV_THREADPOOL_SIZE=8 node app.js
```

### Basic Async Pattern

**async-work.cc:**
```cpp
#include <node.h>
#include <uv.h>
#include <iostream>

namespace demo {

using v8::Context;
using v8::Function;
using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::Persistent;
using v8::String;
using v8::Value;

// Structure to pass data between threads
struct WorkData {
  uv_work_t request;              // libuv work request
  Persistent<Function> callback;  // JavaScript callback
  Isolate* isolate;
  
  // Input data
  std::string input;
  
  // Output data
  std::string result;
  std::string error;
};

// Executed in worker thread (NOT main thread!)
void ExecuteWork(uv_work_t* req) {
  WorkData* data = static_cast<WorkData*>(req->data);
  
  // This runs in background thread
  // DO NOT access V8/JavaScript objects here!
  
  try {
    // Simulate expensive operation
    std::this_thread::sleep_for(std::chrono::seconds(2));
    
    // Actual work (CPU-intensive operation)
    data->result = "Processed: " + data->input;
    
  } catch (const std::exception& e) {
    data->error = e.what();
  }
}

// Executed on main thread after work completes
void WorkComplete(uv_work_t* req, int status) {
  WorkData* data = static_cast<WorkData*>(req->data);
  Isolate* isolate = data->isolate;
  
  v8::HandleScope handleScope(isolate);
  Local<Context> context = isolate->GetCurrentContext();
  
  // Prepare callback arguments
  const unsigned argc = 2;
  Local<Value> argv[argc];
  
  if (!data->error.empty() || status != 0) {
    // Error occurred
    argv[0] = String::NewFromUtf8(
      isolate,
      data->error.c_str()
    ).ToLocalChecked();
    argv[1] = v8::Null(isolate);
  } else {
    // Success
    argv[0] = v8::Null(isolate);
    argv[1] = String::NewFromUtf8(
      isolate,
      data->result.c_str()
    ).ToLocalChecked();
  }
  
  // Call JavaScript callback
  Local<Function> callback = Local<Function>::New(isolate, data->callback);
  callback->Call(context, v8::Null(isolate), argc, argv).ToLocalChecked();
  
  // Cleanup
  data->callback.Reset();
  delete data;
}

// Function called from JavaScript
void ProcessAsync(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  
  // Validate arguments
  if (args.Length() < 2 || !args[0]->IsString() || !args[1]->IsFunction()) {
    isolate->ThrowException(v8::Exception::TypeError(
      String::NewFromUtf8(isolate, 
        "Expected (string, callback)").ToLocalChecked()));
    return;
  }
  
  // Prepare work data
  WorkData* data = new WorkData();
  data->request.data = data;
  data->isolate = isolate;
  
  // Get input
  String::Utf8Value input(isolate, args[0]);
  data->input = std::string(*input);
  
  // Store callback
  Local<Function> callback = Local<Function>::Cast(args[1]);
  data->callback.Reset(isolate, callback);
  
  // Queue work
  uv_queue_work(
    uv_default_loop(),
    &data->request,
    ExecuteWork,      // Runs in worker thread
    WorkComplete      // Runs on main thread when done
  );
  
  // Return immediately (non-blocking)
}

void Initialize(Local<Object> exports, Local<Object> module) {
  NODE_SET_METHOD(exports, "processAsync", ProcessAsync);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)

}  // namespace demo
```

**JavaScript usage:**
```javascript
const addon = require('./build/Release/addon');

console.log('Starting async operation...');

addon.processAsync('test data', (err, result) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log('Result:', result);
  // Output: Result: Processed: test data
});

console.log('Operation queued, continuing...');
// This runs immediately!

// Timeline:
// 0ms:     processAsync called
// 0ms:     Work queued
// 0ms:     JavaScript continues (non-blocking!)
// 0-2000ms: Worker thread processing
// 2000ms:  Callback executed with result
```

**Key Concepts:**

**1. WorkData structure:**
```cpp
struct WorkData {
  uv_work_t request;              // Required by libuv
  Persistent<Function> callback;  // Must persist across threads
  Isolate* isolate;               // For callback execution
  
  // Your data
  std::string input;
  std::string result;
};
```

**2. Thread separation:**
```cpp
// Worker thread (background)
void ExecuteWork(uv_work_t* req) {
  // DO NOT access V8 objects!
  // Only manipulate C++ data
}

// Main thread (after completion)
void WorkComplete(uv_work_t* req, int status) {
  // CAN access V8 objects
  // Call JavaScript callback
}
```

**3. Memory management:**
```cpp
WorkData* data = new WorkData();  // Allocate
// ...
delete data;  // Free in WorkComplete
```

## Promise-Based Async

Modern JavaScript uses Promises. Here's how to return Promises from C++:

**async-promise.cc:**
```cpp
#include <node.h>
#include <uv.h>

namespace demo {

using v8::Context;
using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::Persistent;
using v8::Promise;
using v8::String;
using v8::Value;

struct PromiseWorkData {
  uv_work_t request;
  Persistent<Promise::Resolver> resolver;
  Isolate* isolate;
  
  std::string input;
  std::string result;
  std::string error;
};

void ExecutePromiseWork(uv_work_t* req) {
  PromiseWorkData* data = static_cast<PromiseWorkData*>(req->data);
  
  try {
    // Expensive operation
    std::this_thread::sleep_for(std::chrono::seconds(1));
    data->result = "Processed: " + data->input;
  } catch (const std::exception& e) {
    data->error = e.what();
  }
}

void PromiseWorkComplete(uv_work_t* req, int status) {
  PromiseWorkData* data = static_cast<PromiseWorkData*>(req->data);
  Isolate* isolate = data->isolate;
  
  v8::HandleScope handleScope(isolate);
  Local<Context> context = isolate->GetCurrentContext();
  
  Local<Promise::Resolver> resolver = 
    Local<Promise::Resolver>::New(isolate, data->resolver);
  
  if (!data->error.empty() || status != 0) {
    // Reject promise
    Local<Value> error = String::NewFromUtf8(
      isolate,
      data->error.c_str()
    ).ToLocalChecked();
    
    resolver->Reject(context, error).ToChecked();
  } else {
    // Resolve promise
    Local<Value> result = String::NewFromUtf8(
      isolate,
      data->result.c_str()
    ).ToLocalChecked();
    
    resolver->Resolve(context, result).ToChecked();
  }
  
  // Cleanup
  data->resolver.Reset();
  delete data;
}

void ProcessPromise(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  
  // Create promise
  Local<Promise::Resolver> resolver = Promise::Resolver::New(context)
    .ToLocalChecked();
  Local<Promise> promise = resolver->GetPromise();
  
  // Prepare work
  PromiseWorkData* data = new PromiseWorkData();
  data->request.data = data;
  data->isolate = isolate;
  data->resolver.Reset(isolate, resolver);
  
  String::Utf8Value input(isolate, args[0]);
  data->input = std::string(*input);
  
  // Queue work
  uv_queue_work(
    uv_default_loop(),
    &data->request,
    ExecutePromiseWork,
    PromiseWorkComplete
  );
  
  // Return promise immediately
  args.GetReturnValue().Set(promise);
}

void Initialize(Local<Object> exports) {
  NODE_SET_METHOD(exports, "processPromise", ProcessPromise);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)

}  // namespace demo
```

**JavaScript usage (modern):**
```javascript
const addon = require('./build/Release/addon');

// Using Promises
addon.processPromise('hello')
  .then(result => {
    console.log('Result:', result);
  })
  .catch(err => {
    console.error('Error:', err);
  });

// Using async/await
async function process() {
  try {
    const result = await addon.processPromise('world');
    console.log('Result:', result);
  } catch (err) {
    console.error('Error:', err);
  }
}

process();
```

## Progress Reporting

For long-running operations, report progress back to JavaScript.

**async-progress.cc:**
```cpp
#include <node.h>
#include <uv.h>

namespace demo {

using v8::Context;
using v8::Function;
using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::Persistent;
using v8::String;
using v8::Value;

struct ProgressData {
  uv_work_t request;
  uv_async_t async;
  Persistent<Function> progressCallback;
  Persistent<Function> doneCallback;
  Isolate* isolate;
  
  int totalWork;
  int currentProgress;
  std::string result;
  bool completed;
};

// Called on main thread when async_send is called
void ProgressCallback(uv_async_t* handle) {
  ProgressData* data = static_cast<ProgressData*>(handle->data);
  Isolate* isolate = data->isolate;
  
  v8::HandleScope handleScope(isolate);
  Local<Context> context = isolate->GetCurrentContext();
  
  if (data->completed) {
    // Work is done
    Local<Function> callback = Local<Function>::New(
      isolate, data->doneCallback);
    
    Local<Value> argv[1] = {
      String::NewFromUtf8(isolate, data->result.c_str()).ToLocalChecked()
    };
    
    callback->Call(context, v8::Null(isolate), 1, argv).ToLocalChecked();
    
    // Cleanup
    uv_close((uv_handle_t*)&data->async, nullptr);
    data->progressCallback.Reset();
    data->doneCallback.Reset();
    delete data;
    
  } else {
    // Report progress
    Local<Function> callback = Local<Function>::New(
      isolate, data->progressCallback);
    
    Local<Value> argv[1] = {
      Number::New(isolate, data->currentProgress)
    };
    
    callback->Call(context, v8::Null(isolate), 1, argv).ToLocalChecked();
  }
}

void ExecuteWithProgress(uv_work_t* req) {
  ProgressData* data = static_cast<ProgressData*>(req->data);
  
  for (int i = 0; i < data->totalWork; i++) {
    // Do work
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    
    // Update progress
    data->currentProgress = ((i + 1) * 100) / data->totalWork;
    
    // Notify main thread
    uv_async_send(&data->async);
  }
  
  data->result = "Work completed!";
  data->completed = true;
}

void ProgressWorkComplete(uv_work_t* req, int status) {
  ProgressData* data = static_cast<ProgressData*>(req->data);
  
  // Send final notification
  uv_async_send(&data->async);
}

void ProcessWithProgress(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  // Validate arguments
  if (args.Length() < 3 || !args[0]->IsNumber() || 
      !args[1]->IsFunction() || !args[2]->IsFunction()) {
    isolate->ThrowException(v8::Exception::TypeError(
      String::NewFromUtf8(isolate, 
        "Expected (number, progressCallback, doneCallback)")
        .ToLocalChecked()));
    return;
  }
  
  // Prepare data
  ProgressData* data = new ProgressData();
  data->request.data = data;
  data->async.data = data;
  data->isolate = isolate;
  data->totalWork = args[0].As<Number>()->Value();
  data->currentProgress = 0;
  data->completed = false;
  
  // Store callbacks
  Local<Function> progressCb = Local<Function>::Cast(args[1]);
  Local<Function> doneCb = Local<Function>::Cast(args[2]);
  data->progressCallback.Reset(isolate, progressCb);
  data->doneCallback.Reset(isolate, doneCb);
  
  // Initialize async handle
  uv_async_init(uv_default_loop(), &data->async, ProgressCallback);
  
  // Queue work
  uv_queue_work(
    uv_default_loop(),
    &data->request,
    ExecuteWithProgress,
    ProgressWorkComplete
  );
}

void Initialize(Local<Object> exports) {
  NODE_SET_METHOD(exports, "processWithProgress", ProcessWithProgress);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)

}  // namespace demo
```

**JavaScript usage:**
```javascript
const addon = require('./build/Release/addon');

addon.processWithProgress(
  100,  // Total work units
  (progress) => {
    console.log(`Progress: ${progress}%`);
  },
  (result) => {
    console.log('Complete:', result);
  }
);

// Output:
// Progress: 10%
// Progress: 20%
// ...
// Progress: 100%
// Complete: Work completed!
```

**How it works:**

**1. uv_async_t handle:**
```cpp
uv_async_t async;
uv_async_init(uv_default_loop(), &async, ProgressCallback);
```
Creates a handle to send notifications from worker to main thread.

**2. Send notification:**
```cpp
uv_async_send(&data->async);  // From worker thread
```
Triggers `ProgressCallback` on main thread (safe!).

**3. Cleanup:**
```cpp
uv_close((uv_handle_t*)&data->async, nullptr);
```
Close async handle when done.

## Cancellation

Allow cancelling long-running operations:

**cancellable.cc:**
```cpp
#include <node.h>
#include <uv.h>
#include <atomic>

namespace demo {

struct CancellableData {
  uv_work_t request;
  Persistent<Function> callback;
  Isolate* isolate;
  
  std::atomic<bool> cancelled;
  std::string result;
};

void ExecuteCancellable(uv_work_t* req) {
  CancellableData* data = static_cast<CancellableData*>(req->data);
  
  for (int i = 0; i < 100; i++) {
    // Check if cancelled
    if (data->cancelled.load()) {
      data->result = "Cancelled";
      return;
    }
    
    // Do work
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
  }
  
  data->result = "Completed";
}

void CancellableComplete(uv_work_t* req, int status) {
  CancellableData* data = static_cast<CancellableData*>(req->data);
  Isolate* isolate = data->isolate;
  
  v8::HandleScope handleScope(isolate);
  Local<Context> context = isolate->GetCurrentContext();
  
  Local<Function> callback = Local<Function>::New(isolate, data->callback);
  Local<Value> argv[1] = {
    String::NewFromUtf8(isolate, data->result.c_str()).ToLocalChecked()
  };
  
  callback->Call(context, v8::Null(isolate), 1, argv).ToLocalChecked();
  
  data->callback.Reset();
  delete data;
}

// Global pointer to current work (simplified for demo)
CancellableData* currentWork = nullptr;

void StartCancellable(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  
  CancellableData* data = new CancellableData();
  data->request.data = data;
  data->isolate = isolate;
  data->cancelled.store(false);
  
  Local<Function> callback = Local<Function>::Cast(args[0]);
  data->callback.Reset(isolate, callback);
  
  currentWork = data;
  
  uv_queue_work(
    uv_default_loop(),
    &data->request,
    ExecuteCancellable,
    CancellableComplete
  );
}

void CancelWork(const FunctionCallbackInfo<Value>& args) {
  if (currentWork) {
    currentWork->cancelled.store(true);
    currentWork = nullptr;
  }
}

void Initialize(Local<Object> exports) {
  NODE_SET_METHOD(exports, "startCancellable", StartCancellable);
  NODE_SET_METHOD(exports, "cancelWork", CancelWork);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)

}  // namespace demo
```

**JavaScript usage:**
```javascript
addon.startCancellable((result) => {
  console.log('Result:', result);
});

// Cancel after 2 seconds
setTimeout(() => {
  addon.cancelWork();
  console.log('Cancellation requested');
}, 2000);

// Output: Result: Cancelled
```

**Important:** Cancellation is cooperative. Worker must check `cancelled` flag periodically.

## Summary

Async operations are essential for high-performance addons:

**Key Patterns:**
- **uv_queue_work**: Run work in thread pool
- **uv_async_t**: Send notifications from worker to main thread
- **Promises**: Modern async pattern for JavaScript
- **Progress reporting**: Keep user informed during long operations
- **Cancellation**: Allow users to stop operations

**Critical Rules:**
- ✓ Never block event loop (> 10ms = must be async)
- ✓ Don't touch V8 objects in worker threads
- ✓ Use `Persistent<>` for callbacks across threads
- ✓ Always cleanup in completion handler
- ✓ Check for errors and handle them

**Thread Safety:**
```cpp
// SAFE in worker thread
std::string result = ProcessData(cppData);

// UNSAFE in worker thread (CRASH!)
Local<String> str = String::NewFromUtf8(isolate, "bad");

// SAFE in main thread (WorkComplete)
Local<String> str = String::NewFromUtf8(isolate, "good");
```

**Next:** Object wrapping for C++ classes
