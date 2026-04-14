---
sidebar_position: 6
---

## Node.js Streams: From Basics to C++ Internals

A comprehensive guide to how Node.js streams work — from the JavaScript API through the binding layer, down to libuv and the OS kernel.

---

## Table of Contents

1. [What Are Streams?](#1-what-are-streams)
2. [Stream Types and the Inheritance Chain](#2-stream-types-and-the-inheritance-chain)
3. [ReadableState: The Bitmask Engine](#3-readablestate-the-bitmask-engine)
4. [How Readable Streams Work](#4-how-readable-streams-work)
5. [WritableState: Backpressure and Buffering](#5-writablestate-backpressure-and-buffering)
6. [How Writable Streams Work](#6-how-writable-streams-work)
7. [Transform Streams: The _transform/_read Interlock](#7-transform-streams-the-_transform_read-interlock)
8. [pipeline(): Error Propagation and Cleanup](#8-pipeline-error-propagation-and-cleanup)
9. [C++ Layer: StreamBase and StreamListener](#9-c-layer-streambase-and-streamlistener)
10. [LibuvStreamWrap: Bridging libuv and Node.js](#10-libuvstreamwrap-bridging-libuv-and-nodejs)
11. [Full Data Flow: TCP Socket Read to JS](#11-full-data-flow-tcp-socket-read-to-js)
12. [Web Streams API](#12-web-streams-api)
13. [Performance Patterns](#13-performance-patterns)
14. [Suggested Reading Order](#14-suggested-reading-order)

---

## 1. What Are Streams?

A stream is an abstraction for sequential data that arrives or leaves over time. Instead of waiting for all data to be available (e.g. reading an entire 2GB file into memory), streams process data in chunks as it arrives.

### Why streams matter:

| Without Streams | With Streams |
|---|---|
| `fs.readFile` loads entire file into RAM | `fs.createReadStream` reads chunk by chunk |
| HTTP response body buffered | Response piped directly from disk |
| Processing blocked until full data ready | Processing begins on first byte |

### The four stream types:

```
Readable   — source of data (fs.createReadStream, http.IncomingMessage)
Writable   — sink of data  (fs.createWriteStream, http.ServerResponse)
Duplex     — both readable and writable (net.Socket, TLS socket)
Transform  — duplex that transforms data (zlib.createGzip, crypto.createCipher)
```

### Streams are EventEmitters:

Every stream inherits from `EventEmitter`. Key events:
- **Readable**: `data`, `end`, `error`, `close`, `readable`
- **Writable**: `drain`, `finish`, `error`, `close`
- **Duplex/Transform**: all of the above

---

## 2. Stream Types and the Inheritance Chain

```
EventEmitter (lib/events.js)
  └── Stream (lib/stream.js)
        ├── Readable  (lib/internal/streams/readable.js)
        │     └── PassThrough → Transform → Duplex (mix-in)
        ├── Writable  (lib/internal/streams/writable.js)
        └── Duplex    (lib/internal/streams/duplex.js)
              └── Transform (lib/internal/streams/transform.js)
                    └── PassThrough (lib/internal/streams/passthrough.js)
```

In C++, the parallel hierarchy:

```
HandleWrap (src/handle_wrap.h)
  └── LibuvStreamWrap (src/stream_wrap.h)
        extends StreamBase (src/stream_base.h)
              which uses StreamListener (src/stream_base.h)
```

`LibuvStreamWrap` is used by `TCPWrap`, `PipeWrap`, and `TTYWrap` — all concrete I/O stream types.

---

## 3. ReadableState: The Bitmask Engine

`lib/internal/streams/readable.js`

Instead of storing boolean flags as separate object properties (which would create megamorphic objects and slow V8), Node.js packs many state bits into a single 32-bit integer `state[kState]`.

### The bit flag definitions (lines 111–129):

```js
// lib/internal/streams/readable.js
const kObjectMode       = 1 << 0;   // bit 0
const kEnded            = 1 << 9;   // bit 9  — push(null) called
const kEndEmitted        = 1 << 10;
const kReading          = 1 << 11;  // _read() is in flight
const kConstructed      = 1 << 12;
const kSync             = 1 << 13;
const kNeedReadable     = 1 << 14;
const kEmittedReadable  = 1 << 15;
const kReadableListening = 1 << 16;
const kResumeScheduled  = 1 << 17;
const kErrorEmitted     = 1 << 18;
const kEmitClose        = 1 << 19;
const kAutoDestroy      = 1 << 20;
const kDestroyed        = 1 << 21;
const kClosed           = 1 << 22;
const kCloseEmitted     = 1 << 23;
const kFlowing          = 1 << 24;  // bit 24 — flowing vs paused
const kLength           = 1 << 25;
const kPipes            = 1 << 26;
```

### The `makeBitMapDescriptor` helper (line 132):

```js
function makeBitMapDescriptor(bit) {
  return {
    enumerable: false,
    get() { return (this[kState] & bit) !== 0; },
    set(value) {
      if (value) this[kState] |= bit;
      else this[kState] &= ~bit;
    },
  };
}
```

This is used to define boolean properties like `state.ended`, `state.flowing`, `state.reading` on `ReadableState.prototype`. They look like regular booleans to consumers but read/write a single integer under the hood.

### `ReadableState` constructor (line 265):

```js
function ReadableState(options, stream, isDuplex) {
  // objectMode, highWaterMark, encoding, etc.
  this.highWaterMark = options?.highWaterMark ?? 16384; // 16KB default

  this[kState] = kEmitClose | kAutoDestroy | kConstructed | kSync;
  //             ^ four bits set at construction

  this.buffer = new BufferList();  // linked list of chunks
  this.length = 0;
  this.pipes  = [];
  // ...
}
```

Key: `highWaterMark` controls when the stream pauses and resumes. Default is `16384` bytes for binary streams and `16` objects for object mode streams.

---

## 4. How Readable Streams Work

### Two modes: Paused and Flowing

```
Paused mode  → data sits in internal buffer until .read(n) is called
Flowing mode → data emitted via 'data' event as fast as it arrives
```

Mode transitions:
- `.pipe()`, `.resume()`, or adding a `data` listener → switches to flowing
- `.pause()`, `.unpipe()`, or removing all `data` listeners → back to paused

The `kFlowing` bit tracks this in `ReadableState[kState]`.

### The `push()` method (line 393):

```js
Readable.prototype.push = function(chunk, encoding) {
  return readableAddChunk(this, chunk, encoding, false);
};
```

`readableAddChunk` decides whether to emit immediately (flowing mode) or buffer the chunk:

```js
function readableAddChunk(stream, chunk, encoding, addToFront) {
  const state = stream._readableState;

  if (chunk === null) {
    // EOF — set kEnded
    state[kState] |= kEnded;
    // ...
  } else if (state.flowing && state.length === 0 && !state.sync) {
    // Fast path: emit directly without buffering
    stream.emit('data', chunk);
  } else {
    state.buffer.push(chunk);  // BufferList.push
    state.length += chunk.length;
  }

  maybeReadMore(stream, state);
  return state.length < state.highWaterMark; // backpressure signal
}
```

### The `read(n)` method (lines 660+):

```js
Readable.prototype.read = function(n) {
  n = howMuchToRead(n, state); // compute actual bytes to return

  let doRead = state.needReadable;
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;  // buffer is below HWM — request more data
  }

  if (state.ended || state.reading || state.destroyed) {
    doRead = false; // do not call _read if stream is done/busy
  }

  if (doRead) {
    state[kState] |= kReading;    // set the reading bit
    this._read(state.highWaterMark); // subclass-defined: call push() with data
  }

  const ret = n > 0 ? fromList(n, state) : null; // dequeue from BufferList
  if (ret !== null) this.emit('data', ret);
  return ret;
};
```

### The `_read()` contract:

You implement `_read(size)` in your subclass. It must call `this.push(chunk)` with data, and may call it multiple times. When there is no more data, call `this.push(null)`.

```js
class MyStream extends Readable {
  constructor() {
    super();
    this._counter = 0;
  }

  _read(size) {
    if (this._counter < 5) {
      this.push(`chunk-${this._counter++}`);
    } else {
      this.push(null); // signal EOF
    }
  }
}
```

### `emitReadable` (line 827):

```js
function emitReadable(stream) {
  const state = stream._readableState;
  state[kState] &= ~kEmittedReadable;
  // Deferred via process.nextTick to avoid sync re-entry
  if (!state.sync) {
    process.nextTick(emitReadable_, stream);
  } else {
    emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  stream.emit('readable');
  flow(stream);
}
```

### `maybeReadMore` (line 865):

```js
function maybeReadMore(stream, state) {
  if (!state.readingMore && state.constructed) {
    state.readingMore = true;
    process.nextTick(maybeReadMoreCall, stream, state);
  }
}

function maybeReadMoreCall(stream, state) {
  // Keep reading as long as buffer is below HWM
  while (!state.reading && !state.ended &&
         (state.length < state.highWaterMark || state.flowing)) {
    stream.read(0);  // triggers _read() without consuming data
  }
}
```

This is Node.js's proactive prefetch: it tries to keep the internal buffer full up to `highWaterMark` so consumers always have data ready.

---

## 5. WritableState: Backpressure and Buffering

`lib/internal/streams/writable.js`

### Bit flag definitions (lines 102–123):

```js
// lib/internal/streams/writable.js
const kAllowHalfOpen          = 1 << 0;
const kObjectMode             = 1 << 1;
const kDecodeStrings          = 1 << 2;
const kEnded                  = 1 << 3;
const kEndEmitted              = 1 << 4;
const kFinished               = 1 << 5;
const kSync                   = 1 << 6;
const kBuffered               = 1 << 7;
const kInFlush                = 1 << 8;
const kNoCallback             = 1 << 9;
const kErrored                = 1 << 10;
const kNeedDrain              = 1 << 11;  // signal to emit 'drain'
const kCloseEmitted            = 1 << 12;
const kEmitClose              = 1 << 13;
const kAutoDestroy            = 1 << 14;
const kDestroyed              = 1 << 15;
const kClosed                 = 1 << 16;
const kConstructed            = 1 << 17;
const kOnce                   = 1 << 18;
const kWriting                = 1 << 19;  // _write() is in flight
const kBufferProcessing       = 1 << 20;
const kShouldHwm              = 1 << 21;
const kCorked                 = 1 << 23;  // cork() called
const kDefaultUTF8Encoding    = 1 << 24;
const kWriteCbCallbackPending  = 1 << 25;
const kExpectWriteCb          = 1 << 26;
const kAfterWriteTickInfo     = 1 << 27;
```

### Backpressure: how it works

When you call `writable.write(chunk)`:
1. If `state.length >= state.highWaterMark`, it returns `false` — **backpressure signal**.
2. When the writable drains (all buffered data written), it emits `'drain'`.
3. The producer must pause and wait for `'drain'` before resuming writes.

```js
// Correct usage with backpressure
function write(data) {
  const ok = stream.write(data);
  if (!ok) {
    // Stop producing — stream is full
    stream.once('drain', write);
  }
}
```

---

## 6. How Writable Streams Work

### `write()` (line 502):

```js
Writable.prototype.write = function(chunk, encoding, cb) {
  return _write(this, chunk, encoding, cb);
};

function _write(stream, chunk, encoding, cb) {
  const state = stream._writableState;

  // Decode strings unless binary
  if ((state[kState] & kDecodeStrings) !== 0 && typeof chunk === 'string') {
    chunk = Buffer.from(chunk, encoding);
    encoding = 'buffer';
  }

  return writeOrBuffer(stream, state, chunk, encoding, cb);
}
```

### `cork()` and `uncork()` (lines 511–530):

```js
Writable.prototype.cork = function() {
  this._writableState[kState] |= kCorked;  // set cork bit
};

Writable.prototype.uncork = function() {
  const state = this._writableState;
  if (state.corked) {
    state[kState] &= ~kCorked;             // clear cork bit
    if (!state.writing) {
      clearBuffer(this, state);             // flush buffer
    }
  }
};
```

When corked, writes accumulate in `state.buffered`. On `uncork()`, `clearBuffer` calls `_writev(chunks, cb)` with all buffered chunks at once — a batch write optimization.

### `writeOrBuffer` (lines 546–583):

```js
function writeOrBuffer(stream, state, chunk, encoding, callback) {
  const len = state.objectMode ? 1 : chunk.length;
  state.length += len;

  const ret = state.length < state.highWaterMark;
  // ^ BACKPRESSURE: false when buffer is full

  if (!ret) state[kState] |= kNeedDrain; // schedule drain event

  if (state.writing || state.corked || state.bufferProcessing || !state.constructed) {
    // Can't write now — buffer it
    state.buffered.push({ chunk, encoding, callback });
    state[kState] |= kBuffered;
  } else {
    // Ready to write immediately
    doWrite(stream, state, false, len, chunk, encoding, callback);
  }

  return ret; // backpressure boolean
}
```

### `doWrite` (lines 585–598):

```js
function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state[kState] |= kWriting;     // mark as writing
  state[kState] &= ~kSync;       // not in sync call anymore

  if (writev) {
    stream._writev(chunk, state.onwrite); // batch write
  } else {
    stream._write(chunk, encoding, state.onwrite); // single write
  }
}
```

`state.onwrite` is a callback that marks the write as complete, decrements length, and may emit `drain` or process the next buffered chunk.

---

## 7. Transform Streams: The _transform/_read Interlock

`lib/internal/streams/transform.js`

A `Transform` is both a `Readable` and a `Writable`. It reads data from the writable side, processes it, and makes the result available on the readable side.

### The interlock problem

The challenge: the readable side won't request data until a consumer calls `.read()`, and the writable side won't continue writing until the current `_transform` finishes. These two sides must stay in sync.

### Transform constructor (line 82):

```js
function Transform(options) {
  Duplex.call(this, options);

  // Readable side: do not buffer, sync emit
  this._readableState.sync = false;

  // When the writable side finishes, we need to flush
  this.once('prefinish', function() {
    if (typeof this._flush === 'function' && !this.destroyed) {
      this._flush((er, data) => {
        if (er) { this.destroy(er); return; }
        if (data != null) this.push(data);
        this.push(null);   // signal EOF on readable side
        this[kCallback]();
      });
    } else {
      this.push(null);
      this[kCallback]();
    }
  });
}
```

### `_write` on the Transform (line 166):

```js
Transform.prototype._write = function(chunk, encoding, callback) {
  const rState = this._readableState;
  const wState = this._writableState;
  const length = rState.length;

  // Call user's _transform — must call push() with output
  this._transform(chunk, encoding, (err, val) => {
    if (err) { callback(err); return; }
    if (val != null) this.push(val);
    // If the readable side has a consumer waiting, callback immediately
    // Otherwise, store callback in kCallback so _read can fire it
    if (length === rState.length) {
      callback();
    } else {
      this[kCallback] = callback;
    }
  });
};
```

### `_read` on the Transform (line 198):

```js
Transform.prototype._read = function(n) {
  const cb = this[kCallback];
  if (typeof cb === 'function') {
    this[kCallback] = null;
    cb();  // resume the writable side
  }
};
```

The interlock: when `_transform` pushes data, if the readable side isn't ready, the writable callback is stored in `kCallback`. When the readable side calls `_read()` (because a consumer wants data), it fires `kCallback` — resuming the writable side. This creates a cooperative push/pull flow through the transform.

### Typical `_transform` implementation:

```js
class UpperCase extends Transform {
  _transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback(); // signal: done, ready for next chunk
  }

  _flush(callback) {
    // called after all input consumed, before 'finish'
    callback(); // or: callback(null, 'FOOTER\n')
  }
}
```

---

## 8. pipeline(): Error Propagation and Cleanup

`lib/internal/streams/pipeline.js`

`stream.pipeline(...streams, callback)` is the correct way to connect streams. It:
1. Handles error propagation across all streams
2. Destroys all streams if any one fails
3. Fires a single callback when all streams finish (or any error occurs)

### `destroyer` wrapper (line 51):

```js
function destroyer(stream, reading, writing, final, cb) {
  // Attach EOS (End-of-Stream) listener
  const cleanup = eos(stream, { readable: reading, writable: writing }, (err) => {
    if (err) return cb(err);
    cb();
  });

  // Return a destroy function: called when pipeline needs to abort
  return {
    destroy: (err) => {
      cleanup();
      stream.destroy(err);
    },
    cleanup,
  };
}
```

Every stream in the pipeline gets wrapped by `destroyer`. If any stream errors, the error propagates to `finishImpl` which calls `.destroy()` on all streams.

### `pipelineImpl` (line 186):

```js
function pipelineImpl(streams, callback, opts) {
  // ...
  let ac = new AbortController(); // cancellation support

  const destroys = streams.map((stream, i) => {
    const reading = i < streams.length - 1;
    const writing = i > 0;
    return destroyer(stream, reading, writing, !reading, (err) => {
      if (!error && err) error = err;
      if (err) ac.abort();
      finishImpl(err);
    });
  });

  // Wire up pipe connections
  for (let i = 0; i < streams.length - 1; i++) {
    streams[i].pipe(streams[i + 1]);
  }
}
```

### `finishImpl` (line 229):

```js
function finishImpl(err) {
  if (--waiting === 0) {
    // All streams have finished/errored
    for (const { destroy } of destroys) {
      destroy(err);  // destroy all streams on error
    }
    // Fire callback on next tick to avoid sync re-entry
    process.nextTick(callback, error || null);
  }
}
```

### Async iterator pump (`pumpToNode`, line 95):

When the source is an async iterable (including async generators):

```js
async function pumpToNode(iterable, writable, cb, { end }) {
  let error;
  try {
    for await (const chunk of iterable) {
      if (!writable.write(chunk)) {
        // Backpressure: wait for drain before producing more
        await once(writable, 'drain');
      }
    }
  } catch (err) {
    error = err;
  } finally {
    if (end) writable.end();
    cb(error);
  }
}
```

This is how `pipeline()` handles async generators as stream sources while respecting backpressure.

---

## 9. C++ Layer: StreamBase and StreamListener

`src/stream_base.h`

The C++ stream layer is a clean listener/observer pattern. A `StreamBase` holds a linked list of `StreamListener` objects. When data arrives from libuv, the `StreamBase` notifies the active listener.

### `StreamReq` — base for write/shutdown requests (line 33):

```cpp
class StreamReq {
 public:
  // Stored on the uv_req_t's data field
  static StreamReq* FromReq(uv_req_t* req);

  // Called when the request completes
  virtual void OnStreamAfterReq(int status) = 0;

  // Resets the JS object to a clean state
  static void ResetObject(v8::Local<v8::Object> obj);
};
```

`WriteWrap` and `ShutdownWrap` both extend `StreamReq`.

### `StreamListener` interface (line 116):

```cpp
class StreamListener {
 public:
  // Called to allocate a buffer before reading
  virtual uv_buf_t OnStreamAlloc(size_t suggested_size) = 0;

  // Called with data read from the stream
  virtual void OnStreamRead(ssize_t nread, const uv_buf_t& buf) = 0;

  // Called after a write completes
  virtual void OnStreamAfterWrite(WriteWrap* w, int status) {}

  // Called after a shutdown completes
  virtual void OnStreamAfterShutdown(ShutdownWrap* wrap, int status) {}

  // The stream this listener is attached to
  StreamBase* stream_ = nullptr;

  // Next listener in the linked list (for stacking)
  StreamListener* previous_listener_ = nullptr;
};
```

### `EmitToJSStreamListener` — the default listener (line 197):

This is the final listener in the chain. It takes data from `OnStreamRead` and emits it into JS land:

```cpp
class EmitToJSStreamListener : public StreamListener {
 public:
  uv_buf_t OnStreamAlloc(size_t suggested_size) override;
  void OnStreamRead(ssize_t nread, const uv_buf_t& buf) override;
};
```

`OnStreamRead` calls into JS via `MakeCallback` on the stream's `.ondata` property. This is the boundary crossing from C++ to JS.

### `StreamBase` — the abstract C++ stream (line 250+):

```cpp
class StreamBase : public StreamResource {
 public:
  // Called by subclasses to deliver data up to listeners
  void EmitRead(ssize_t nread, const uv_buf_t& buf = uv_buf_init(nullptr, 0));
  uv_buf_t EmitAlloc(size_t suggested_size);

  // Subclasses implement these for their I/O mechanism
  virtual int ReadStart() = 0;
  virtual int ReadStop() = 0;
  virtual int DoShutdown(ShutdownWrap* req_wrap) = 0;
  virtual int DoWrite(WriteWrap* w, uv_buf_t* bufs, size_t count,
                      uv_stream_t* send_handle) = 0;

  // Pushes a listener on top of the listener stack
  void PushStreamListener(StreamListener* listener);
  void RemoveStreamListener(StreamListener* listener);
};
```

The listener stack enables TLS: `TLSWrap` inserts itself between `LibuvStreamWrap` and `EmitToJSStreamListener`. Raw TCP data flows into `TLSWrap::OnStreamRead`, which decrypts it, then calls `EmitRead` upward with plaintext.

---

## 10. LibuvStreamWrap: Bridging libuv and Node.js

`src/stream_wrap.h` / `src/stream_wrap.cc`

`LibuvStreamWrap` is the concrete C++ class that wraps a `uv_stream_t`. It extends both `HandleWrap` (for libuv handle lifecycle) and `StreamBase` (for the stream abstraction).

```cpp
// src/stream_wrap.h
class LibuvStreamWrap : public HandleWrap, public StreamBase {
 public:
  int ReadStart() override;
  int ReadStop() override;
  int DoShutdown(ShutdownWrap* req_wrap) override;
  int DoWrite(WriteWrap* w, uv_buf_t* bufs, size_t count,
              uv_stream_t* send_handle) override;

  inline uv_stream_t* stream() const { return stream_; }
  inline bool is_named_pipe() const { return stream()->type == UV_NAMED_PIPE; }
  inline bool is_tcp() const { return stream()->type == UV_TCP; }

 private:
  void OnUvAlloc(size_t suggested_size, uv_buf_t* buf);
  v8::Maybe<void> OnUvRead(ssize_t nread, const uv_buf_t* buf);

  static void AfterUvWrite(uv_write_t* req, int status);
  static void AfterUvShutdown(uv_shutdown_t* req, int status);

  uv_stream_t* const stream_;  // the actual libuv stream
};
```

### `ReadStart()` — starting the read loop (line 201):

```cpp
int LibuvStreamWrap::ReadStart() {
  return uv_read_start(
    stream(),
    // Alloc callback: called before every read to provide a buffer
    [](uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
      static_cast<LibuvStreamWrap*>(handle->data)
          ->OnUvAlloc(suggested_size, buf);
    },
    // Read callback: called with data (or error)
    [](uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf) {
      LibuvStreamWrap* wrap = static_cast<LibuvStreamWrap*>(stream->data);
      TryCatchScope try_catch(wrap->env());
      try_catch.SetVerbose(true);
      wrap->OnUvRead(nread, buf);
    }
  );
}
```

`uv_read_start` tells libuv: "start watching this stream. Call my alloc callback when you need a buffer, and my read callback when data arrives." This is registered with the OS's I/O multiplexer (epoll on Linux, kqueue on macOS).

### `OnUvAlloc` — buffer allocation (line 222):

```cpp
void LibuvStreamWrap::OnUvAlloc(size_t suggested_size, uv_buf_t* buf) {
  HandleScope scope(env()->isolate());
  Context::Scope context_scope(env()->context());

  // Delegates up to StreamBase::EmitAlloc → StreamListener::OnStreamAlloc
  *buf = EmitAlloc(suggested_size);
}
```

`EmitAlloc` calls `OnStreamAlloc` on the active `StreamListener`. The default listener (`EmitToJSStreamListener`) allocates from Node.js's 8KB buffer pool when possible.

### `OnUvRead` — data arrival (line 253):

```cpp
Maybe<void> LibuvStreamWrap::OnUvRead(ssize_t nread, const uv_buf_t* buf) {
  HandleScope scope(env()->isolate());
  Context::Scope context_scope(env()->context());

  // Check for pending IPC handles (for named pipe IPC)
  if (is_named_pipe_ipc() &&
      uv_pipe_pending_count(reinterpret_cast<uv_pipe_t*>(stream())) > 0) {
    uv_handle_type type = uv_pipe_pending_type(...);
    // Accept the pending handle (TCP, Pipe, or UDP)
    if (type == UV_TCP)
      pending_obj = AcceptHandle<TCPWrap>(env(), this);
    // ...
    object()->Set(env()->context(),
                  env()->pending_handle_string(),
                  local_pending_obj);
  }

  // Forward data up to the JS layer via listener chain
  EmitRead(nread, *buf);
  return JustVoid();
}
```

`EmitRead` calls `OnStreamRead` on the active listener, which eventually calls `EmitToJSStreamListener::OnStreamRead`, which pushes data into the JS `Readable` stream.

### `DoWrite` — writing data (line 391):

```cpp
int LibuvStreamWrap::DoWrite(WriteWrap* req_wrap,
                             uv_buf_t* bufs,
                             size_t count,
                             uv_stream_t* send_handle) {
  LibuvWriteWrap* w = static_cast<LibuvWriteWrap*>(req_wrap);
  // uv_write2 can send a handle along with the data (for IPC)
  return w->Dispatch(uv_write2, stream(), bufs, count,
                     send_handle, AfterUvWrite);
}
```

`AfterUvWrite` is called by libuv when the write completes. It calls `req_wrap->Done(status)`, which fires the JS-side callback (the `oncomplete` property).

---

## 11. Full Data Flow: TCP Socket Read to JS

This traces data from the OS kernel to your `socket.on('data', cb)` handler.

```
┌─────────────────────────────────────────────────────────────────┐
│  OS / Kernel                                                    │
│  TCP packet arrives on socket fd                                │
└──────────────────────────────┬──────────────────────────────────┘
                               │  epoll_wait() (Linux)
                               │  kqueue (macOS)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  libuv (event loop, I/O poll phase)                            │
│  uv__io_poll → uv__stream_io → uv__read                        │
│  Calls: alloc_cb(handle, suggested_size, &buf)                  │
│  Calls: read_cb(stream, nread, &buf)                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  LibuvStreamWrap (src/stream_wrap.cc)                           │
│  OnUvAlloc(suggested_size, buf) → EmitAlloc() → OnStreamAlloc()│
│  OnUvRead(nread, buf) → EmitRead(nread, buf)                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │  EmitRead walks listener chain
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  TLSWrap::OnStreamRead (if TLS)                                │
│  Decrypts data → calls EmitRead again with plaintext            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  EmitToJSStreamListener::OnStreamRead (src/stream_base.cc)     │
│  Creates Buffer from uv_buf_t                                   │
│  Calls MakeCallback(env, object, ondata, [buffer])              │
└──────────────────────────────┬──────────────────────────────────┘
                               │  JS callback invocation
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  lib/net.js — Socket._handle.ondata handler                    │
│  Calls socket.push(buffer) on the Readable side                │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  lib/internal/streams/readable.js                              │
│  readableAddChunk(stream, chunk, encoding, false)               │
│  If flowing: stream.emit('data', chunk)                         │
│  Else: state.buffer.push(chunk); state.length += len           │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Your application code                                          │
│  socket.on('data', (chunk) => { /* process */ })                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Web Streams API

Node.js v16+ includes the WHATWG Streams API (`ReadableStream`, `WritableStream`, `TransformStream`).

These are separate from Node.js's native streams. `pipeline()` can interop with them via `pumpToWeb` (line 153 in `lib/internal/streams/pipeline.js`):

```js
async function pumpToWeb(readable, writable, ac, { end }) {
  const writer = writable.getWriter();
  try {
    for await (const chunk of readable) {
      await writer.write(chunk);  // Web WritableStream API
    }
    if (end) await writer.close();
  } catch (err) {
    await writer.abort(err);
  } finally {
    writer.releaseLock();
  }
}
```

### Interop between Node streams and Web streams:

```js
import { ReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';

// Convert Node Readable → Web ReadableStream
const nodeReadable = createReadStream('file.txt');
const webStream = ReadableStream.from(nodeReadable);

// Convert Web ReadableStream → Node Readable
import { Readable } from 'node:stream';
const nodeStream = Readable.fromWeb(webStream);
```

---

## 13. Performance Patterns

### 1. Always use `pipeline()` over manual `.pipe()`

```js
// Bad: memory leak if destination errors
src.pipe(dest);

// Good: proper error handling and cleanup
await pipeline(src, transform, dest);
```

### 2. Tune `highWaterMark` for your use case

```js
// Low latency (prefer smaller buffers): lower HWM
const stream = fs.createReadStream('file', { highWaterMark: 4096 });

// High throughput (prefer fewer syscalls): higher HWM
const stream = fs.createReadStream('large.bin', { highWaterMark: 65536 });
```

### 3. Use `cork()`/`uncork()` for batch writes

```js
socket.cork();
socket.write(header);
socket.write(body);
socket.write(trailer);
process.nextTick(() => socket.uncork()); // sends as one batch
```

### 4. Object mode streams avoid serialization

```js
const objectStream = new Transform({
  objectMode: true,
  transform(obj, enc, cb) {
    // process JS objects without Buffer conversion
    cb(null, processObject(obj));
  }
});
```

### 5. Respect backpressure in producers

```js
// Wrong: ignores backpressure
for (const chunk of data) {
  stream.write(chunk);
}

// Right: waits for drain when needed
for (const chunk of data) {
  const ok = stream.write(chunk);
  if (!ok) await once(stream, 'drain');
}
```

### 6. Use `stream.finished()` for cleanup detection

```js
import { finished } from 'node:stream/promises';

try {
  await finished(stream);
  console.log('stream done');
} catch (err) {
  console.error('stream error:', err);
}
```

### 7. `Readable.from()` for async iterables

```js
import { Readable } from 'node:stream';

async function* generate() {
  for (let i = 0; i < 1000; i++) yield `line ${i}\n`;
}

const readable = Readable.from(generate());
await pipeline(readable, process.stdout);
```

---

## 14. Suggested Reading Order

For engineers wanting to go deep on streams internals:

**Start with JS layer:**
1. `lib/stream.js` — stream module entry point, exports, `Stream` base class
2. `lib/internal/streams/readable.js` — `ReadableState` constructor, bit flags, `push()`, `read()`, `maybeReadMore`
3. `lib/internal/streams/writable.js` — `WritableState`, `writeOrBuffer`, `doWrite`, backpressure return value
4. `lib/internal/streams/transform.js` — `_write`/`_read` interlock via `kCallback`
5. `lib/internal/streams/pipeline.js` — `destroyer`, `pipelineImpl`, `finishImpl`, `pumpToNode`
6. `lib/internal/streams/duplex.js` — how Readable and Writable state coexist
7. `lib/internal/streams/passthrough.js` — trivial Transform subclass, good reference

**Then the C++ binding layer:**
8. `src/stream_base.h` — `StreamBase`, `StreamListener`, `EmitToJSStreamListener`, `StreamReq`
9. `src/stream_base.cc` — `EmitRead`, `EmitAlloc`, listener chain dispatch
10. `src/stream_wrap.h` — `LibuvStreamWrap` declaration
11. `src/stream_wrap.cc` — `ReadStart`, `OnUvAlloc`, `OnUvRead`, `DoWrite`, `AfterUvWrite`

**Then concrete stream types:**
12. `src/tcp_wrap.cc` — `TCPWrap::Instantiate`, how a TCP socket becomes a `LibuvStreamWrap`
13. `src/pipe_wrap.cc` — Unix pipes and named pipes
14. `src/tls_wrap.cc` — TLS as a `StreamListener` inserted into the chain
15. `lib/net.js` — `Socket` class in JS: wires C++ handle to JS Readable/Writable

**Then for Web Streams:**
16. `lib/internal/webstreams/readablestream.js`
17. `lib/internal/webstreams/writablestream.js`
18. `lib/internal/webstreams/transformstream.js`

---

## Quick Reference

| Concept | Where it lives | Key thing |
|---|---|---|
| `ReadableState` bit flags | `lib/internal/streams/readable.js:111` | `kFlowing`, `kEnded`, `kReading` |
| Readable backpressure signal | `readableAddChunk` return value | `state.length < state.highWaterMark` |
| `WritableState` bit flags | `lib/internal/streams/writable.js:102` | `kCorked`, `kWriting`, `kNeedDrain` |
| Writable backpressure signal | `writeOrBuffer` return value | `state.length < state.highWaterMark` |
| Transform interlock | `kCallback` field | `_write` stores cb; `_read` fires it |
| pipeline cleanup | `destroyer` + `finishImpl` | wraps each stream with `eos` |
| C++ data delivery | `StreamBase::EmitRead` | walks `StreamListener` linked list |
| libuv integration | `LibuvStreamWrap::ReadStart` | calls `uv_read_start` |
| Buffer to JS | `EmitToJSStreamListener::OnStreamRead` | calls `MakeCallback` with Buffer |
| TLS interception | `TLSWrap` as `StreamListener` | inserts itself in the listener chain |
