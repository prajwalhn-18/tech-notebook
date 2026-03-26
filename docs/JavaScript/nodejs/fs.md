---
sidebar_position: 5
---

## How `fs` Works in Node.js — Internals Guide

A bottom-up walkthrough of the Node.js filesystem module: from a `fs.readFile()` call in user code all the way down to libuv and back.

---

### Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The Binding Layer — JS meets C++](#2-the-binding-layer--js-meets-c)
3. [FSReqCallback — The Async Bridge](#3-fsreqcallback--the-async-bridge)
4. [readFile() — Callback API Walkthrough](#4-readfile--callback-api-walkthrough)
5. [ReadFileContext — The State Machine](#5-readfilecontext--the-state-machine)
6. [readFileSync() — The Synchronous Path](#6-readfilesync--the-synchronous-path)
7. [The Promise API — FileHandle](#7-the-promise-api--filehandle)
8. [stat() — How File Metadata Works](#8-stat--how-file-metadata-works)
9. [The C++ Layer — node_file.cc](#9-the-c-layer--node_filecc)
10. [How libuv executes fs operations](#10-how-libuv-executes-fs-operations)
11. [After-Callbacks — The Return Path](#11-after-callbacks--the-return-path)
12. [Streams — createReadStream / createWriteStream](#12-streams--createreadstream--createwritestream)
13. [fs.watch() — File System Events](#13-fswatch--file-system-events)
14. [Key Constants and Limits](#14-key-constants-and-limits)
15. [Full Call Flow Diagrams](#15-full-call-flow-diagrams)

---

## 1. Architecture Overview

Every `fs` operation crosses four layers:

```
┌─────────────────────────────────────────────────────┐
│  User Code                                          │
│  fs.readFile() / fs.promises.readFile() / streams   │
├─────────────────────────────────────────────────────┤
│  JavaScript Layer                                   │
│  lib/fs.js                                          │
│  lib/internal/fs/promises.js                        │
│  lib/internal/fs/read/context.js                    │
├─────────────────────────────────────────────────────┤
│  C++ Binding Layer                                  │
│  src/node_file.cc   (Open, Read, Write, Stat ...)   │
│  src/node_file.h    (FSReqBase, FSReqCallback ...)  │
│  src/node_file-inl.h (AsyncCall, SyncCall ...)      │
├─────────────────────────────────────────────────────┤
│  libuv                                              │
│  uv_fs_open / uv_fs_read / uv_fs_write / uv_fs_stat│
│  Thread pool (default 4 threads)                    │
└─────────────────────────────────────────────────────┘
```

The JavaScript layer constructs request objects and calls C++ binding functions. The C++ layer dispatches to libuv, which runs the actual OS syscalls (`open(2)`, `read(2)`, `write(2)`) on a background thread pool. When the syscall finishes, libuv wakes the event loop, and the C++ `After*` callback converts the result back into a JavaScript value.

---

## 2. The Binding Layer — JS meets C++

`lib/fs.js` gets C++ functions through `internalBinding('fs')` (line 65):

```js
// lib/fs.js:65
const binding = internalBinding('fs');

// The two most-used exports from the binding:
const {
  FSReqCallback,  // C++ class for async request objects
  statValues,     // shared Float64Array for stat results
} = binding;
```

`internalBinding('fs')` calls the `Initialize` function in `src/node_file.cc`, which registers all C++ functions on the binding object:

```
binding.open()           → C++ Open()
binding.read()           → C++ Read()
binding.write()          → C++ WriteBuffer()
binding.stat()           → C++ Stat()
binding.fstat()          → C++ Fstat()
binding.close()          → C++ Close()
binding.readFileUtf8()   → C++ ReadFileUtf8()   ← synchronous UTF-8 fast path
binding.writeFileUtf8()  → C++ WriteFileUtf8()  ← synchronous UTF-8 fast path
```

For the Promise API (`lib/internal/fs/promises.js:119`), a special symbol `kUsePromises` is used instead of an `FSReqCallback` object. This tells the C++ layer to return an `FSReqPromise` instead of a callback-based request.

---

## 3. FSReqCallback — The Async Bridge

`FSReqCallback` is a C++ class (`src/node_file.h:203`) that wraps a `uv_fs_t` request. Its JavaScript counterpart is created in `lib/fs.js` whenever an async operation is started.

The JS pattern is always:

```js
// The pattern used by every async fs function in lib/fs.js
const req = new FSReqCallback();  // allocates uv_fs_t on C++ side
req.oncomplete = myCallback;      // the JS function to call when done
req.context = someState;          // optional: extra state to carry through

binding.open(path, flags, mode, req);  // hand off to C++
```

When libuv finishes the syscall, the C++ `After*` function calls `req_wrap->Resolve(value)`, which triggers `req.oncomplete(err, value)` on the JS side.

The C++ class hierarchy:

```
ReqWrap<uv_fs_t>        ← wraps libuv's uv_fs_t request struct
  └── FSReqBase         ← pure virtual: Resolve/Reject/ResolveStat interface
        ├── FSReqCallback   ← callback mode (new FSReqCallback() in JS)
        ├── FSReqPromise    ← promise mode (kUsePromises symbol)
        └── FSReqWrapSync   ← synchronous mode (no callback, blocks thread)
```

`FSReqBase` (`src/node_file.h:135`) defines the interface:

```cpp
class FSReqBase : public ReqWrap<uv_fs_t> {
  virtual void Reject(v8::Local<v8::Value> reject) = 0;
  virtual void Resolve(v8::Local<v8::Value> value) = 0;
  virtual void ResolveStat(const uv_stat_t* stat) = 0;
  // ...
};
```

---

## 4. readFile() — Callback API Walkthrough

`lib/fs.js:357` — the `readFile()` function you call in userland:

```js
// lib/fs.js:357
function readFile(path, options, callback) {
  callback ||= options;
  validateFunction(callback, 'cb');
  options = getOptions(options, { flag: 'r' });

  // Lazy-load ReadFileContext (avoids startup cost)
  ReadFileContext ??= require('internal/fs/read/context');

  // Create a state machine that tracks the multi-step read
  const context = new ReadFileContext(callback, options.encoding);
  context.isUserFd = isFd(path); // Was a file descriptor (integer) passed?

  if (options.signal) {
    context.signal = options.signal; // AbortSignal support
  }

  // If already a file descriptor, skip the open() step
  if (context.isUserFd) {
    process.nextTick(function tick(context) {
      FunctionPrototypeCall(readFileAfterOpen, { context }, null, path);
    }, context);
    return;
  }

  if (checkAborted(options.signal, callback)) return;

  const flagsNumber = stringToFlags(options.flag, 'options.flag');

  // Step 1: Open the file
  const req = new FSReqCallback();
  req.context = context;
  req.oncomplete = readFileAfterOpen;  // called when open() finishes
  binding.open(getValidatedPath(path), flagsNumber, 0o666, req);
}
```

`readFileAfterOpen` (line ~289) runs when `open()` completes, sets `context.fd`, then calls `binding.fstat()` to get the file size. Once the size is known, `readFileAfterStat` allocates the buffer and starts the actual reads via `context.read()`.

The key insight: **`readFile()` is not a single syscall**. It is a chain: `open → fstat → read (in a loop) → close`. Each step creates a new `FSReqCallback`, passes it to C++, and the callback chain continues when each step completes.

---

## 5. ReadFileContext — The State Machine

`lib/internal/fs/read/context.js` holds all the state across the multi-step read operation.

```js
// lib/internal/fs/read/context.js:71
class ReadFileContext {
  constructor(callback, encoding) {
    this.fd = undefined;        // file descriptor (set after open)
    this.isUserFd = undefined;  // whether fd was passed directly by user
    this.size = 0;              // file size from fstat (0 = unknown)
    this.callback = callback;   // the original user callback
    this.buffers = null;        // list of chunks (when size is unknown)
    this.buffer = null;         // single pre-allocated buffer (when size is known)
    this.pos = 0;               // current read position
    this.encoding = encoding;
    this.err = null;
    this.signal = undefined;
  }

  read() {
    let buffer, offset, length;

    // AbortSignal check before every read
    if (this.signal?.aborted) {
      return this.close(new AbortError(undefined, { cause: this.signal.reason }));
    }

    if (this.size === 0) {
      // Unknown size (e.g. /proc files, pipes): read in 64KB chunks
      buffer = Buffer.allocUnsafeSlow(kReadFileUnknownBufferLength); // 64KB
      offset = 0;
      length = kReadFileUnknownBufferLength;
      this.buffer = buffer;
    } else {
      // Known size: use pre-allocated buffer, read up to 512KB per call
      buffer = this.buffer;
      offset = this.pos;
      length = MathMin(kReadFileBufferLength, this.size - this.pos); // max 512KB
    }

    const req = new FSReqCallback();
    req.oncomplete = readFileAfterRead; // called after each read()
    req.context = this;

    read(this.fd, buffer, offset, length, -1, req); // pos=-1 means "current position"
  }

  close(err) {
    // If user passed an fd, don't close it (they own it)
    if (this.isUserFd) {
      process.nextTick(function tick(context) {
        FunctionPrototypeCall(readFileAfterClose, { context }, null);
      }, this);
      return;
    }

    const req = new FSReqCallback();
    req.oncomplete = readFileAfterClose;
    req.context = this;
    this.err = err;
    close(this.fd, req);
  }
}
```

`readFileAfterRead` (line 25) handles each completed read:

```js
// lib/internal/fs/read/context.js:25
function readFileAfterRead(err, bytesRead) {
  const context = this.context;

  if (err) return context.close(err);

  context.pos += bytesRead;

  if (context.pos === context.size || bytesRead === 0) {
    // Done — close the file
    context.close();
  } else {
    if (context.size === 0) {
      // Unknown size: save this chunk, keep reading
      const buffer = bytesRead === kReadFileUnknownBufferLength ?
        context.buffer : context.buffer.slice(0, bytesRead);
      ArrayPrototypePush(context.buffers, buffer);
    }
    context.read(); // read next chunk
  }
}
```

`readFileAfterClose` (line 46) fires after the file is closed. It assembles the final buffer:

```js
// lib/internal/fs/read/context.js:46
function readFileAfterClose(err) {
  const context = this.context;
  const callback = context.callback;

  if (context.err || err)
    return callback(aggregateTwoErrors(err, context.err));

  // Assemble the final result
  let buffer;
  if (context.size === 0)
    buffer = Buffer.concat(context.buffers, context.pos); // join chunks
  else if (context.pos < context.size)
    buffer = context.buffer.slice(0, context.pos);        // trim oversized buffer
  else
    buffer = context.buffer;

  if (context.encoding)
    buffer = buffer.toString(context.encoding); // convert to string if needed

  callback(null, buffer); // deliver to user
}
```

**The read loop in state machine form:**

```
readFile(path, cb)
  │
  ├─ open(path) ──→ readFileAfterOpen
  │                   │
  │                   ├─ fstat(fd) ──→ readFileAfterStat
  │                   │                  │
  │                   │                  ├─ allocate buffer
  │                   │                  └─ context.read()
  │                   │                       │
  │                   │                       └─ read(fd, buf) ──→ readFileAfterRead
  │                   │                                               │
  │                   │                           ┌──────────────────┘
  │                   │                           │
  │                   │                     more data? ──yes──→ context.read() (loop)
  │                   │                           │
  │                   │                          no
  │                   │                           └─ context.close()
  │                   │                                 │
  │                   │                                close(fd) ──→ readFileAfterClose
  │                   │                                                   │
  └───────────────────────────────────────────────────────────────────── cb(null, buffer)
```

---

## 6. readFileSync() — The Synchronous Path

`lib/fs.js:429` — the synchronous version is much simpler:

```js
// lib/fs.js:429
function readFileSync(path, options) {
  options = getOptions(options, { flag: 'r' });

  // ── UTF-8 fast path ─────────────────────────────────────────────────────
  // A single C++ call that does open→stat→read→close entirely in C++.
  // No JS state machine needed. No Buffer allocations on the JS side.
  if (options.encoding === 'utf8' || options.encoding === 'utf-8') {
    if (!isInt32(path)) {
      path = getValidatedPath(path);
    }
    return binding.readFileUtf8(path, stringToFlags(options.flag)); // ← one call
  }

  // ── General path (non-UTF-8 or unknown encoding) ─────────────────────────
  const isUserFd = isFd(path);
  const fd = isUserFd ? path : fs.openSync(path, options.flag, 0o666);

  const stats = tryStatSync(fd, isUserFd);
  const size = isFileType(stats, S_IFREG) ? stats[8] : 0; // stats[8] = file size

  let pos = 0;
  let buffer;  // single buffer when size is known
  let buffers; // list of chunks when size is unknown (pipes, /proc, etc.)

  if (size === 0) {
    buffers = [];
  } else {
    buffer = tryCreateBuffer(size, fd, isUserFd); // Buffer.allocUnsafe(size)
  }

  // ── Read loop ────────────────────────────────────────────────────────────
  if (size !== 0) {
    // Known size: read until we have everything
    do {
      bytesRead = tryReadSync(fd, isUserFd, buffer, pos, size - pos);
      pos += bytesRead;
    } while (bytesRead !== 0 && pos < size);
  } else {
    // Unknown size: read 8KB chunks until EOF
    do {
      buffer = Buffer.allocUnsafe(8192);
      bytesRead = tryReadSync(fd, isUserFd, buffer, 0, 8192);
      if (bytesRead !== 0) {
        ArrayPrototypePush(buffers, buffer.slice(0, bytesRead));
      }
      pos += bytesRead;
    } while (bytesRead !== 0);
  }

  if (!isUserFd) fs.closeSync(fd);

  // Assemble result
  if (size === 0) buffer = Buffer.concat(buffers, pos);
  else if (pos < size) buffer = buffer.slice(0, pos);

  if (options.encoding) buffer = buffer.toString(options.encoding);
  return buffer;
}
```

The UTF-8 fast path (`binding.readFileUtf8()`) calls `ReadFileUtf8()` in `src/node_file.cc:2734`. This stays entirely in C++: opens the file, stats it, allocates a `std::string`, reads everything in a loop, then returns a V8 string — never crossing back into JS until the final return.

**Sync calls block the event loop.** `tryReadSync()` ultimately calls `SyncCallAndThrowOnError()` in `src/node_file-inl.h`, which calls `uv_fs_read(loop, req, ..., nullptr)`. Passing `nullptr` as the callback tells libuv to execute the syscall on the *current thread* synchronously, bypassing the thread pool entirely.

---

## 7. The Promise API — FileHandle

`lib/internal/fs/promises.js` — the Promise API uses a `FileHandle` object instead of raw file descriptors.

### FileHandle

```js
// lib/internal/fs/promises.js:154
class FileHandle extends EventEmitter {
  constructor(filehandle) {
    super();
    this[kHandle] = filehandle;       // C++ FileHandle object (src/node_file.h:321)
    this[kFd] = filehandle ? filehandle.fd : -1;
    this[kRefs] = 1;                  // reference count for close management
    this[kClosePromise] = null;
  }

  get fd() { return this[kFd]; }

  // All operations delegate to internal promise functions:
  read(buffer, offset, length, position) {
    return fsCall(read, this, buffer, offset, length, position);
  }
  readFile(options)             { return fsCall(readFile, this, options); }
  write(buffer, offset, length, position) {
    return fsCall(write, this, buffer, offset, length, position);
  }
  writeFile(data, options)      { return fsCall(writeFile, this, data, options); }
  stat(options)                 { return fsCall(fstat, this, options); }
  close = () => { /* ref-counted close, returns Promise */ }
}
```

`FileHandle` wraps the C++ `FileHandle` class (`src/node_file.h:321`), which extends both `AsyncWrap` and `StreamBase`. The `kHandle` holds the raw file descriptor and exposes the C++ methods through V8.

The C++ `FileHandle` is created in `AfterOpenFileHandle` (`src/node_file.cc:852`):

```cpp
// src/node_file.cc:852
void AfterOpenFileHandle(uv_fs_t* req) {
  FSReqBase* req_wrap = FSReqBase::from_req(req);
  FSReqAfterScope after(req_wrap, req);
  if (after.Proceed()) {
    // Create the C++ FileHandle wrapping the fd integer
    FileHandle* fd = FileHandle::New(
        req_wrap->binding_data(),
        static_cast<int>(req->result),  // the fd number
        {},
        req->path);
    req_wrap->Resolve(fd->object());    // return it to JS as FileHandle
  }
}
```

### Promise readFile

`lib/internal/fs/promises.js` — the Promise `readFile` routes through `readFileHandle()`:

```js
// lib/internal/fs/promises.js:1278
async function readFile(path, options) {
  // ...option parsing...

  if (path instanceof FileHandle)
    return readFileHandle(path, options);  // already open

  // Open → read → close
  const fd = await open(path, flag, 0o666);
  return handleFdClose(readFileHandle(fd, options), fd.close);
}
```

`readFileHandle()` uses `binding.fstat(..., kUsePromises)` instead of `new FSReqCallback()`. The `kUsePromises` symbol tells the C++ layer to create an `FSReqPromise` and return a native Promise instead of calling a JS callback.

---

## 8. stat() — How File Metadata Works

### The shared stat buffer

Rather than allocating a new object for every stat result, Node.js uses a pre-allocated shared `Float64Array`:

```js
// lib/fs.js:84
const { FSReqCallback, statValues } = binding;
// statValues is a Float64Array shared with C++
// It has kFsStatsFieldsNumber * 2 slots (regular + bigint)
```

The `Stats` object (`lib/internal/fs/utils.js:520`) reads values directly out of this shared array by index:

```js
function Stats(dev, mode, nlink, uid, gid, rdev, blksize,
               ino, size, blocks,
               atimeMs, mtimeMs, ctimeMs, birthtimeMs) {
  // Each argument is statValues[offset + fieldIndex]
  this.dev = dev;
  this.mode = mode;
  // etc.
}
```

The `FsStatsOffset` enum in `src/node_file.h:17-37` defines the exact array indices for each field: `kDev=0, kMode=1, kNlink=2, kUid=3, kGid=4, kRdev=5, kBlkSize=6, kIno=7, kSize=8, kBlocks=9, kAtimeSec=10, kAtimeNsec=11 ...`

### stat() implementation

```js
// lib/fs.js:1625
function stat(path, options = { bigint: false, throwIfNoEntry: true }, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = kEmptyObject;
  }
  callback = makeStatsCallback(callback); // wraps callback to build Stats object

  const req = new FSReqCallback(options.bigint); // bigint flag changes array type
  req.oncomplete = callback;
  binding.stat(getValidatedPath(path), options.bigint, req, options.throwIfNoEntry);
}
```

When the C++ `AfterStat` callback fires (`src/node_file.cc:803`):

```cpp
// src/node_file.cc:803
void AfterStat(uv_fs_t* req) {
  FSReqBase* req_wrap = FSReqBase::from_req(req);
  FSReqAfterScope after(req_wrap, req);
  if (after.Proceed()) {
    req_wrap->ResolveStat(&req->statbuf); // fills the shared statValues array
  }
}
```

`ResolveStat` fills `statValues` with the 18 field values from `uv_stat_t`, then calls the JS callback. The callback receives the `statValues` array and constructs a `Stats` object by reading from it.

**`statSync()`** is even simpler — it calls `binding.stat(path, bigint, undefined, throwIfNoEntry)`. Passing `undefined` instead of an `FSReqCallback` triggers the synchronous C++ code path.

---

## 9. The C++ Layer — node_file.cc

`src/node_file.cc` (4127 lines) implements every fs operation. The pattern is always the same:

### Open (line 2195)

```cpp
static void Open(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);
  BufferValue path(env->isolate(), args[0]);   // JS string → C++ string
  const int flags = args[1].As<Int32>()->Value();
  const int mode  = args[2].As<Int32>()->Value();

  if (argc > 3) {
    // ── Async path ──────────────────────────────────────────────────────
    FSReqBase* req_wrap_async = GetReqWrap(args, 3); // the FSReqCallback from JS
    req_wrap_async->set_is_plain_open(true);          // mark for fd tracking

    AsyncCall(env, req_wrap_async, args, "open", UTF8, AfterInteger,
              uv_fs_open, *path, flags, mode);
    //        ↑ after-callback  ↑ libuv function  ↑ libuv args
  } else {
    // ── Sync path ────────────────────────────────────────────────────────
    FSReqWrapSync req_wrap_sync("open", *path);
    int result = SyncCallAndThrowOnError(
        env, &req_wrap_sync, uv_fs_open, *path, flags, mode);
    // blocks until complete, throws JS error on failure
    args.GetReturnValue().Set(result);
  }
}
```

### Read (line 2679)

```cpp
static void Read(const FunctionCallbackInfo<Value>& args) {
  // Extract args: fd, buffer, offset, len, pos
  int fd;
  GetValidatedFd(env, args[0]).To(&fd);

  char* buffer_data = Buffer::Data(args[1].As<Object>());
  const size_t off = args[2].As<Integer>()->Value();
  const size_t len = args[3].As<Int32>()->Value();
  const int64_t pos = args[4]->IsNumber() ?
    args[4].As<Integer>()->Value() :
    args[4].As<BigInt>()->Int64Value();

  char* buf = buffer_data + off;
  uv_buf_t uvbuf = uv_buf_init(buf, len); // libuv buffer struct: pointer + length

  if (argc > 5) {
    // Async: hand off to libuv thread pool
    FSReqBase* req_wrap_async = GetReqWrap(args, 5);
    AsyncCall(env, req_wrap_async, args, "read", UTF8, AfterInteger,
              uv_fs_read, fd, &uvbuf, 1, pos);
  } else {
    // Sync: block current thread
    FSReqWrapSync req_wrap_sync("read");
    const int bytesRead = SyncCallAndThrowOnError(
        env, &req_wrap_sync, uv_fs_read, fd, &uvbuf, 1, pos);
    args.GetReturnValue().Set(bytesRead);
  }
}
```

### The AsyncCall template (src/node_file-inl.h)

`AsyncCall` is a C++ template function that wires everything together:

```cpp
template <typename Func, typename... Args>
FSReqBase* AsyncCall(Environment* env,
                     FSReqBase* req_wrap,
                     const v8::FunctionCallbackInfo<v8::Value>& args,
                     const char* syscall,
                     enum encoding enc,
                     uv_fs_cb after,     // called when libuv finishes
                     Func fn,            // the libuv function (uv_fs_read, etc.)
                     Args... fn_args) {  // args to pass to libuv
  return AsyncDestCall(env, req_wrap, args,
                       syscall, nullptr, 0, enc,
                       after, fn, fn_args...);
}
```

`AsyncDestCall` calls `req_wrap->Dispatch(fn, fn_args..., after)`. `Dispatch()` (from `ReqWrap`) calls `uv_fs_*` with `env->event_loop()` as the loop — this submits the work to libuv's thread pool and returns immediately.

---

## 10. How libuv executes fs operations

libuv maintains a thread pool (default 4 threads, set by `UV_THREADPOOL_SIZE`). When `uv_fs_read(loop, req, fd, bufs, nbufs, offset, cb)` is called with a non-null callback:

1. **libuv enqueues the work** onto the thread pool queue
2. **A worker thread picks it up** and calls the OS syscall: `pread(fd, buf, len, offset)` on Linux/macOS, or `ReadFile()` on Windows
3. **The syscall blocks** the worker thread (not the event loop) until the OS delivers the data
4. **libuv posts the completion** to the event loop via a `uv_async_t` handle
5. **On the event loop thread**, libuv calls the `cb` function — this is the C++ `After*` callback

```
Event Loop Thread                    Thread Pool Thread
─────────────────────                ─────────────────
uv_fs_read(loop, req, ..., AfterInteger)
  → enqueue work item
                            ← worker picks up work
                               pread(fd, buf, len, offset) blocks
                               ... kernel reads data ...
                               pread returns
                            → post completion to event loop
  ← event loop wakes up
AfterInteger(uv_req) called
  → req_wrap->Resolve(bytesRead)
  → req.oncomplete(null, bytesRead) in JS
```

For **synchronous** calls (null callback), the same syscall happens on the event loop thread directly — no thread pool involved, no async dispatch.

---

## 11. After-Callbacks — The Return Path

After libuv finishes, the corresponding C++ `After*` function is called on the event loop thread:

**AfterInteger** (`src/node_file.cc:839`) — for open, read, write, close:

```cpp
void AfterInteger(uv_fs_t* req) {
  FSReqBase* req_wrap = FSReqBase::from_req(req);
  FSReqAfterScope after(req_wrap, req);   // cleans up uv_fs_t on scope exit

  int result = static_cast<int>(req->result); // number of bytes / fd

  if (result >= 0 && req_wrap->is_plain_open())
    req_wrap->env()->AddUnmanagedFd(result); // register fd for tracking/cleanup

  if (after.Proceed())  // checks for error
    req_wrap->Resolve(Integer::New(req_wrap->env()->isolate(), result));
    // ↑ calls req.oncomplete(null, result) in JavaScript
}
```

**AfterStat** (`src/node_file.cc:803`) — for stat, fstat, lstat:

```cpp
void AfterStat(uv_fs_t* req) {
  FSReqBase* req_wrap = FSReqBase::from_req(req);
  FSReqAfterScope after(req_wrap, req);
  if (after.Proceed()) {
    req_wrap->ResolveStat(&req->statbuf);
    // ↑ fills statValues typed array, then calls req.oncomplete(null, statValues)
  }
}
```

`FSReqAfterScope` (`src/node_file.cc`) is an RAII guard. Its destructor calls `uv_fs_req_cleanup(req)` to free memory libuv allocated (e.g. for directory entry lists), then either calls the error path or sets up for the Resolve call.

---

## 12. Streams — createReadStream / createWriteStream

`lib/internal/fs/streams.js` implements `ReadStream` and `WriteStream` as subclasses of Node.js `Readable` and `Writable` streams.

### Opening the file (`_construct`)

```js
// lib/internal/fs/streams.js:49 (approximate)
_construct(callback) {
  // Open the file and set this.fd when ready
  open(this.path, this.flags, this.mode, (err, fd) => {
    if (err) {
      callback(err);
      return;
    }
    this.fd = fd;
    callback();
    this.emit('open', fd);
  });
}
```

`_construct` is called by the stream machinery before any reads begin.

### FileHandle mode

`streams.js` also supports a `FileHandle` path (Promise API). In this case a `FileHandleOperations` adapter converts the promise-based `handle.read()` into the callback style the `Readable` stream expects:

```js
const FileHandleOperations = (handle) => {
  return {
    read: (fd, buf, offset, length, pos, cb) => {
      PromisePrototypeThen(
        handle.read(buf, offset, length, pos),
        (r) => cb(null, r.bytesRead, r.buffer),
        (err) => cb(err, 0, buf)
      );
    },
    close: (fd, cb) => {
      PromisePrototypeThen(handle.close(), () => cb(), cb);
    },
  };
};
```

### How `createReadStream` reads data

1. `ReadStream._read(n)` is called by the `Readable` machinery when the consumer wants more data
2. It calls `fs.read(this.fd, buffer, 0, length, this.pos, callback)`
3. In the callback: if `bytesRead > 0`, call `this.push(buffer.slice(0, bytesRead))`
4. If `bytesRead === 0` (EOF): call `this.push(null)` to signal end of stream
5. The stream machinery handles backpressure via `highWaterMark`

---

## 13. fs.watch() — File System Events

`lib/fs.js:2498` creates an `FSWatcher`, defined in `lib/internal/fs/watchers.js`.

```js
// lib/fs.js (simplified)
function watch(filename, options, listener) {
  // ...
  const watcher = new FSWatcher();
  watcher[kFSWatchStart](filename, persistent, recursive, encoding);
  if (listener) watcher.on('change', listener);
  return watcher;
}
```

`FSWatcher` uses `internalBinding('fs_event_wrap')` — a separate binding that wraps libuv's `uv_fs_event_t`. This is different from the thread pool: file events use OS-native notification APIs:

| Platform | Mechanism |
|---|---|
| Linux | inotify |
| macOS | FSEvents (kqueue fallback) |
| Windows | ReadDirectoryChangesW |

**`StatWatcher`** (used by `fs.watchFile()`) is different — it polls `stat()` on a timer interval rather than using OS events. It uses `internalBinding('fs').StatWatcher` (`lib/internal/fs/watchers.js:35`).

```js
// lib/internal/fs/watchers.js:130
function StatWatcher(bigint) {
  FunctionPrototypeCall(EventEmitter, this);
  this._handle = null;
  this[kOldStatus] = -1;
  this[kUseBigint] = bigint;
}
```

`fs.watch()` → OS events → efficient, low overhead
`fs.watchFile()` → polling `stat()` → less efficient, but works on all filesystems (e.g. network drives)

---

## 14. Key Constants and Limits

From `lib/internal/fs/utils.js`:

```js
const kReadFileUnknownBufferLength = 64 * 1024;   // 64 KB  — chunk size when file size unknown
const kReadFileBufferLength        = 512 * 1024;  // 512 KB — chunk size when file size is known
const kWriteFileMaxChunkSize       = 512 * 1024;  // 512 KB — max chunk per write call
const kIoMaxLength                 = 2 ** 31 - 1; // ~2 GB  — max bytes per single I/O operation
```

From `lib/fs.js` (inherited from POSIX):
- `O_RDONLY = 0`, `O_WRONLY = 1`, `O_RDWR = 2` — open flags
- `S_IFREG = 0o100000` — regular file type bitmask (used in `isFileType()`)
- Default mode for new files: `0o666` (before umask is applied)

---

## 15. Full Call Flow Diagrams

### Async fs.readFile()

```
User:      fs.readFile('data.txt', 'utf8', callback)
           │
lib/fs.js  ├─ new ReadFileContext(callback, 'utf8')
           ├─ new FSReqCallback() { oncomplete: readFileAfterOpen }
           └─ binding.open('data.txt', O_RDONLY, 0o666, req)
                │
src/node_  ├─ Open() extracts path, flags, mode
file.cc    └─ AsyncCall(env, req, ..., AfterInteger, uv_fs_open, ...)
                │
libuv      ├─ enqueue uv_fs_open to thread pool
           │   [worker thread: open(2) syscall]
           └─ completion posted to event loop
                │
src/node_  └─ AfterInteger(uv_req): req_wrap->Resolve(fd)
file.cc         │
lib/fs.js  └─ readFileAfterOpen(null, fd)
               ├─ context.fd = fd
               ├─ new FSReqCallback() { oncomplete: readFileAfterStat }
               └─ binding.fstat(fd, false, req)
                    │ [libuv thread pool: fstat(2)]
                    │
lib/fs.js  └─ readFileAfterStat(null, stats)
               ├─ size = stats[8]  (file size field)
               ├─ buffer = Buffer.allocUnsafe(size)
               └─ context.read()
                    ├─ new FSReqCallback() { oncomplete: readFileAfterRead }
                    └─ binding.read(fd, buffer, 0, size, -1, req)
                         │ [libuv thread pool: pread(2)]
                         │
lib/internal   └─ readFileAfterRead(null, bytesRead)
/fs/read/          ├─ pos += bytesRead
context.js         ├─ done? → context.close()
                   │              ├─ binding.close(fd, req)
                   │              └─ readFileAfterClose → callback(null, 'file contents')
                   └─ not done? → context.read() [loop]
```

### Sync fs.readFileSync() with UTF-8

```
User:       fs.readFileSync('data.txt', 'utf8')
            │
lib/fs.js   └─ binding.readFileUtf8('data.txt', O_RDONLY)
                 │
src/node_   └─ ReadFileUtf8()
file.cc          ├─ SyncCallAndThrowOnError(uv_fs_open, ...)  ← blocks
                 ├─ SyncCallAndThrowOnError(uv_fs_fstat, ...) ← blocks
                 ├─ std::string buffer; buffer.resize(size)
                 ├─ loop: SyncCallAndThrowOnError(uv_fs_read, ...) ← blocks
                 ├─ SyncCallAndThrowOnError(uv_fs_close, ...) ← blocks
                 └─ return V8 string
```

### Promise fs.promises.readFile()

```
User:      await fs.promises.readFile('data.txt')
           │
promises   ├─ open('data.txt', 'r', 0o666)
.js        │   ├─ binding.openFileHandle(path, flags, mode, kUsePromises)
           │   │   → FSReqPromise created in C++, returns native Promise
           │   └─ Promise resolves with FileHandle instance
           │
           └─ readFileHandle(fileHandle, options)
               ├─ binding.fstat(fd, false, kUsePromises) → Promise<statValues>
               ├─ allocate buffer
               └─ loop: binding.read(fd, buf, offset, len, pos, kUsePromises)
                    → each returns Promise<{ bytesRead }>
                    → await each, continue until bytesRead === 0
               └─ fileHandle.close()
               └─ resolve with Buffer / string
```

---

## File Reference Summary

| What | File | Lines |
|---|---|---|
| `binding = internalBinding('fs')` | `lib/fs.js` | 65 |
| `FSReqCallback` (JS usage) | `lib/fs.js` | 83–85 |
| `readFile()` | `lib/fs.js` | 357–383 |
| `readFileSync()` (UTF-8 fast path) | `lib/fs.js` | 432–436 |
| `readFileSync()` (general) | `lib/fs.js` | 439–486 |
| `stat()` | `lib/fs.js` | 1625–1635 |
| `ReadFileContext` class | `lib/internal/fs/read/context.js` | 71–127 |
| `readFileAfterRead` | `lib/internal/fs/read/context.js` | 25–43 |
| `readFileAfterClose` | `lib/internal/fs/read/context.js` | 46–69 |
| `FileHandle` class | `lib/internal/fs/promises.js` | 154–270 |
| Promise `readFile()` | `lib/internal/fs/promises.js` | 1278–1289 |
| `FSReqBase` C++ class | `src/node_file.h` | 135–201 |
| `FSReqCallback` C++ class | `src/node_file.h` | 203–220 |
| `FileHandle` C++ class | `src/node_file.h` | 321–456 |
| `Open()` C++ | `src/node_file.cc` | 2195–2232 |
| `OpenFileHandle()` C++ | `src/node_file.cc` | 2234–2285 |
| `Read()` C++ | `src/node_file.cc` | 2679–2732 |
| `ReadFileUtf8()` C++ | `src/node_file.cc` | 2734+ |
| `AfterInteger()` C++ | `src/node_file.cc` | 839–850 |
| `AfterStat()` C++ | `src/node_file.cc` | 803–811 |
| `AfterOpenFileHandle()` C++ | `src/node_file.cc` | 852–862 |
| `AsyncCall()` template | `src/node_file-inl.h` | 335–343 |
| `SyncCallAndThrowOnError()` | `src/node_file-inl.h` | 400–405 |
| `StatWatcher` | `lib/internal/fs/watchers.js` | 130–138 |
| Buffer constants | `lib/internal/fs/utils.js` | 140–143 |
