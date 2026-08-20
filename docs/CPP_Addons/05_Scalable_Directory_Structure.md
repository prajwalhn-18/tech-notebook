# Scalable Directory Structure for C++ Addons

Organizing C++ addons properly is critical for maintainability, testing, and scaling. This guide presents production-ready directory structures for various project sizes.

## Why Structure Matters

**Bad structure (everything in root):**
```
my-project/
├── addon.cc              # Mix of all code
├── binding.gyp
├── package.json
├── test.js
└── utils.cc
```

**Problems:**
- Hard to find code
- Difficult to test
- Can't reuse components
- Poor separation of concerns
- Doesn't scale beyond 2-3 files

**Good structure (organized):**
```
my-project/
├── src/
│   ├── cpp/              # C++ source
│   └── js/               # JavaScript wrapper
├── include/              # Headers
├── test/                 # Tests
├── bindings/             # Build configs
└── docs/                 # Documentation
```

**Benefits:**
- Clear organization
- Easy to navigate
- Scalable to 100+ files
- Testable components
- Reusable code

## Structure Levels

### Level 1: Single Addon (Small Project)

**Use case:** Simple addon, 1-3 C++ files

```
image-processor/
├── src/
│   ├── addon.cc          # Main addon entry
│   ├── processor.cc      # Core processing
│   └── processor.h       # Header
│
├── test/
│   ├── test.js           # JavaScript tests
│   └── fixtures/         # Test data
│       ├── input.jpg
│       └── expected.jpg
│
├── binding.gyp           # Build configuration
├── package.json          # Node.js package
├── .gitignore
└── README.md
```

**binding.gyp:**
```python
{
  "targets": [{
    "target_name": "image_processor",
    "sources": [
      "src/addon.cc",
      "src/processor.cc"
    ],
    "include_dirs": [
      "src"
    ],
    "cflags!": [ "-fno-exceptions" ],
    "cflags_cc!": [ "-fno-exceptions" ],
    "xcode_settings": {
      "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
    }
  }]
}
```

**package.json:**
```json
{
  "name": "image-processor",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "install": "node-gyp rebuild",
    "test": "node test/test.js"
  },
  "gypfile": true
}
```

**index.js (entry point):**
```javascript
const path = require('path');
const addon = require(path.join(__dirname, 'build', 'Release', 'image_processor'));

module.exports = addon;
```

### Level 2: Multiple Related Addons (Medium Project)

**Use case:** Multiple addons sharing common code

```
media-toolkit/
├── packages/
│   ├── image-processor/
│   │   ├── src/
│   │   │   ├── addon.cc
│   │   │   └── image.cc
│   │   ├── binding.gyp
│   │   └── package.json
│   │
│   ├── video-encoder/
│   │   ├── src/
│   │   │   ├── addon.cc
│   │   │   └── encoder.cc
│   │   ├── binding.gyp
│   │   └── package.json
│   │
│   └── audio-processor/
│       ├── src/
│       │   ├── addon.cc
│       │   └── audio.cc
│       ├── binding.gyp
│       └── package.json
│
├── common/               # Shared C++ code
│   ├── include/
│   │   ├── buffer_utils.h
│   │   └── error_handling.h
│   └── src/
│       ├── buffer_utils.cc
│       └── error_handling.cc
│
├── test/
│   ├── image/
│   ├── video/
│   └── audio/
│
├── scripts/
│   ├── build-all.js
│   └── test-all.js
│
├── lerna.json            # Monorepo management
└── package.json          # Root package
```

**Each addon's binding.gyp:**
```python
{
  "targets": [{
    "target_name": "image_processor",
    "sources": [
      "src/addon.cc",
      "src/image.cc",
      "../../common/src/buffer_utils.cc"  # Shared code
    ],
    "include_dirs": [
      "src",
      "../../common/include"  # Shared headers
    ]
  }]
}
```

**Root package.json:**
```json
{
  "name": "media-toolkit",
  "version": "1.0.0",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "node scripts/build-all.js",
    "test": "node scripts/test-all.js"
  }
}
```

### Level 3: Production-Scale (Large Project)

**Use case:** Enterprise addon with extensive features

```
high-performance-db/
├── include/              # Public headers
│   └── hpdb/
│       ├── connection.h
│       ├── query.h
│       └── result.h
│
├── src/
│   ├── cpp/              # C++ implementation
│   │   ├── core/
│   │   │   ├── connection.cc
│   │   │   ├── query.cc
│   │   │   └── result.cc
│   │   │
│   │   ├── utils/
│   │   │   ├── memory_pool.cc
│   │   │   ├── string_utils.cc
│   │   │   └── type_conversion.cc
│   │   │
│   │   ├── async/
│   │   │   ├── worker.cc
│   │   │   └── thread_pool.cc
│   │   │
│   │   └── bindings/
│   │       └── addon.cc  # V8 bindings
│   │
│   └── js/               # JavaScript wrapper
│       ├── index.js
│       ├── connection.js
│       └── query.js
│
├── test/
│   ├── unit/             # Unit tests (C++)
│   │   ├── connection_test.cc
│   │   ├── query_test.cc
│   │   └── utils_test.cc
│   │
│   ├── integration/      # Integration tests (JS)
│   │   ├── connection.test.js
│   │   ├── query.test.js
│   │   └── performance.test.js
│   │
│   ├── fixtures/         # Test data
│   │   └── sample.sql
│   │
│   └── helpers/
│       └── test_utils.js
│
├── benchmark/            # Performance benchmarks
│   ├── query_bench.js
│   └── connection_bench.js
│
├── bindings/             # Build configurations
│   ├── binding.gyp
│   └── common.gypi       # Common build settings
│
├── scripts/
│   ├── build.js
│   ├── test.js
│   ├── benchmark.js
│   └── generate-types.js # TypeScript definitions
│
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── CONTRIBUTING.md
│
├── types/                # TypeScript definitions
│   └── index.d.ts
│
├── .github/
│   └── workflows/
│       ├── build.yml
│       └── test.yml
│
├── .gitignore
├── .clang-format         # C++ formatting
├── .eslintrc.js          # JS linting
├── package.json
└── README.md
```

**bindings/binding.gyp:**
```python
{
  "targets": [{
    "target_name": "hpdb",
    
    "sources": [
      "src/cpp/bindings/addon.cc",
      "src/cpp/core/connection.cc",
      "src/cpp/core/query.cc",
      "src/cpp/core/result.cc",
      "src/cpp/utils/memory_pool.cc",
      "src/cpp/utils/string_utils.cc",
      "src/cpp/utils/type_conversion.cc",
      "src/cpp/async/worker.cc",
      "src/cpp/async/thread_pool.cc"
    ],
    
    "include_dirs": [
      "include",
      "src/cpp"
    ],
    
    "defines": [
      "HPDB_VERSION=<!(node -p \"require('./package.json').version\")"
    ],
    
    "cflags": [
      "-std=c++17",
      "-O3",
      "-Wall",
      "-Wextra"
    ],
    
    "cflags_cc": [
      "-std=c++17",
      "-O3"
    ],
    
    "conditions": [
      ["OS=='linux'", {
        "libraries": ["-lpthread"]
      }],
      ["OS=='mac'", {
        "xcode_settings": {
          "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
          "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
          "MACOSX_DEPLOYMENT_TARGET": "10.12"
        }
      }],
      ["OS=='win'", {
        "msvs_settings": {
          "VCCLCompilerTool": {
            "ExceptionHandling": 1,
            "AdditionalOptions": ["/std:c++17"]
          }
        }
      }]
    ]
  }]
}
```

**bindings/common.gypi:**
```python
{
  'variables': {
    'optimization_level%': '3',
    'debug_extra_ccflags%': '-O0 -g'
  },
  
  'target_defaults': {
    'default_configuration': 'Release',
    
    'configurations': {
      'Debug': {
        'cflags': ['<@(debug_extra_ccflags)'],
        'defines': ['DEBUG']
      },
      'Release': {
        'cflags': ['-O<(optimization_level)'],
        'defines': ['NDEBUG']
      }
    }
  }
}
```

**package.json:**
```json
{
  "name": "high-performance-db",
  "version": "2.0.0",
  "main": "src/js/index.js",
  "types": "types/index.d.ts",
  
  "scripts": {
    "install": "node scripts/build.js",
    "build": "node scripts/build.js",
    "build:debug": "node scripts/build.js --debug",
    "test": "node scripts/test.js",
    "test:unit": "npm run build && node test/unit/run.js",
    "test:integration": "npm run build && npm run test:integration:run",
    "test:integration:run": "mocha test/integration/**/*.test.js",
    "benchmark": "node scripts/benchmark.js",
    "format": "clang-format -i src/cpp/**/*.{cc,h}",
    "lint": "eslint src/js/**/*.js"
  },
  
  "files": [
    "src/",
    "include/",
    "bindings/",
    "types/",
    "build/Release/"
  ],
  
  "binary": {
    "module_name": "hpdb",
    "module_path": "./build/Release/",
    "host": "https://github.com/myorg/hpdb/releases/download/"
  },
  
  "dependencies": {},
  "devDependencies": {
    "mocha": "^10.0.0",
    "chai": "^4.3.0",
    "eslint": "^8.0.0"
  },
  
  "gypfile": true
}
```

## Common Patterns

### Pattern 1: Shared Utilities

**common/include/utils.h:**
```cpp
#ifndef HPDB_UTILS_H_
#define HPDB_UTILS_H_

#include <node.h>
#include <string>

namespace hpdb {
namespace utils {

// String conversion helpers
std::string V8StringToStdString(v8::Isolate* isolate, 
                                v8::Local<v8::Value> value);

v8::Local<v8::String> StdStringToV8String(v8::Isolate* isolate,
                                          const std::string& str);

// Error handling
void ThrowError(v8::Isolate* isolate, const std::string& message);
void ThrowTypeError(v8::Isolate* isolate, const std::string& message);

}  // namespace utils
}  // namespace hpdb

#endif  // HPDB_UTILS_H_
```

**common/src/utils.cc:**
```cpp
#include "utils.h"

namespace hpdb {
namespace utils {

std::string V8StringToStdString(v8::Isolate* isolate,
                                v8::Local<v8::Value> value) {
  v8::String::Utf8Value utf8(isolate, value);
  return std::string(*utf8, utf8.length());
}

v8::Local<v8::String> StdStringToV8String(v8::Isolate* isolate,
                                          const std::string& str) {
  return v8::String::NewFromUtf8(isolate, str.c_str()).ToLocalChecked();
}

void ThrowError(v8::Isolate* isolate, const std::string& message) {
  isolate->ThrowException(v8::Exception::Error(
    StdStringToV8String(isolate, message)));
}

void ThrowTypeError(v8::Isolate* isolate, const std::string& message) {
  isolate->ThrowException(v8::Exception::TypeError(
    StdStringToV8String(isolate, message)));
}

}  // namespace utils
}  // namespace hpdb
```

### Pattern 2: JavaScript Wrapper Layer

**src/js/index.js:**
```javascript
const path = require('path');
const addon = require(path.join(__dirname, '..', '..', 'build', 'Release', 'hpdb'));

class Connection {
  constructor(connectionString) {
    this._native = new addon.Connection(connectionString);
  }
  
  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this._native.query(sql, params, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }
  
  close() {
    this._native.close();
  }
}

module.exports = {
  Connection,
  version: addon.version
};
```

### Pattern 3: Build Scripts

**scripts/build.js:**
```javascript
const { execSync } = require('child_process');
const path = require('path');

const isDebug = process.argv.includes('--debug');
const config = isDebug ? 'Debug' : 'Release';

console.log(`Building in ${config} mode...`);

try {
  // Configure
  execSync('node-gyp configure', {
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_build_from_source: 'true'
    }
  });
  
  // Build
  execSync(`node-gyp build --${config.toLowerCase()}`, {
    stdio: 'inherit'
  });
  
  console.log(`✓ Build succeeded (${config})`);
  process.exit(0);
  
} catch (error) {
  console.error('✗ Build failed');
  process.exit(1);
}
```

**scripts/test.js:**
```javascript
const { execSync } = require('child_process');

// Run unit tests
console.log('Running unit tests...');
try {
  execSync('npm run test:unit', { stdio: 'inherit' });
} catch (error) {
  process.exit(1);
}

// Run integration tests
console.log('\nRunning integration tests...');
try {
  execSync('npm run test:integration', { stdio: 'inherit' });
} catch (error) {
  process.exit(1);
}

console.log('\n✓ All tests passed');
```

## Cross-Platform Support

### Platform-Specific Code

**include/platform.h:**
```cpp
#ifndef HPDB_PLATFORM_H_
#define HPDB_PLATFORM_H_

#ifdef _WIN32
  #define HPDB_WINDOWS
#elif __APPLE__
  #define HPDB_MACOS
#elif __linux__
  #define HPDB_LINUX
#endif

namespace hpdb {
namespace platform {

// Platform-specific implementations
#ifdef HPDB_WINDOWS
  void* AllocateMemory(size_t size);
#else
  void* AllocateMemory(size_t size);
#endif

}  // namespace platform
}  // namespace hpdb

#endif  // HPDB_PLATFORM_H_
```

**src/cpp/utils/platform.cc:**
```cpp
#include "platform.h"

#ifdef HPDB_WINDOWS
  #include <windows.h>
#else
  #include <sys/mman.h>
#endif

namespace hpdb {
namespace platform {

#ifdef HPDB_WINDOWS
void* AllocateMemory(size_t size) {
  return VirtualAlloc(NULL, size, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
}
#else
void* AllocateMemory(size_t size) {
  return mmap(NULL, size, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANON, -1, 0);
}
#endif

}  // namespace platform
}  // namespace hpdb
```

## TypeScript Support

**types/index.d.ts:**
```typescript
export interface ConnectionOptions {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields: FieldInfo[];
}

export interface FieldInfo {
  name: string;
  type: string;
}

export class Connection {
  constructor(options: ConnectionOptions);
  
  query(sql: string, params?: any[]): Promise<QueryResult>;
  close(): void;
}

export const version: string;
```

## Testing Structure

**test/integration/connection.test.js:**
```javascript
const { expect } = require('chai');
const { Connection } = require('../../src/js/index');

describe('Connection', () => {
  let conn;
  
  before(() => {
    conn = new Connection({
      host: 'localhost',
      database: 'test'
    });
  });
  
  after(() => {
    conn.close();
  });
  
  it('should connect to database', async () => {
    const result = await conn.query('SELECT 1 as num');
    expect(result.rows).to.have.lengthOf(1);
    expect(result.rows[0].num).to.equal(1);
  });
  
  it('should handle parameterized queries', async () => {
    const result = await conn.query('SELECT $1 as value', [42]);
    expect(result.rows[0].value).to.equal(42);
  });
});
```

## Summary

Scalable directory structure is essential for maintainable addons:

**Key Principles:**
- ✓ Separate concerns (C++, JS, tests, docs)
- ✓ Share common code across addons
- ✓ Use build scripts for automation
- ✓ Provide TypeScript definitions
- ✓ Support multiple platforms
- ✓ Comprehensive testing (unit + integration)
- ✓ Include benchmarks for performance validation

**Choose the right level:**
- **Level 1**: Single file addon (< 1000 lines)
- **Level 2**: Multiple related addons (monorepo)
- **Level 3**: Production library (enterprise)

**Essential files:**
- `binding.gyp`: Build configuration
- `package.json`: Node.js package
- `src/cpp/`: C++ implementation
- `src/js/`: JavaScript wrapper
- `test/`: Tests
- `types/`: TypeScript definitions
- `scripts/`: Build automation

**Next steps:**
- Start with Level 1 for prototypes
- Graduate to Level 2 when sharing code
- Use Level 3 for production libraries
- Adapt structure to your specific needs
