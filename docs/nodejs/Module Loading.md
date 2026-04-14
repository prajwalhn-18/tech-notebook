---
sidebar_position: 4
---

## Node.js Module Loading — In-Depth Guide

How Node.js loads modules in both CommonJS (CJS) and ECMAScript Modules (ESM), from source to execution.

---

## Table of Contents

1. [Overview: Two Module Systems](#1-overview-two-module-systems)
2. [CommonJS — The Architecture](#2-commonjs--the-architecture)
3. [CJS: The Module Wrapper](#3-cjs-the-module-wrapper)
4. [CJS: `require()` and `Module._load()`](#4-cjs-require-and-module_load)
5. [CJS: The Resolution Algorithm](#5-cjs-the-resolution-algorithm)
6. [CJS: The node_modules Walk](#6-cjs-the-node_modules-walk)
7. [CJS: File Extension Handlers](#7-cjs-file-extension-handlers)
8. [CJS: Circular Dependencies](#8-cjs-circular-dependencies)
9. [CJS: The Cache System](#9-cjs-the-cache-system)
10. [ESM — The Architecture](#10-esm--the-architecture)
11. [ESM: The Four Phases of Loading](#11-esm-the-four-phases-of-loading)
12. [ESM: Resolution Algorithm](#12-esm-resolution-algorithm)
13. [ESM: `package.json` Exports and Imports Maps](#13-esm-packagejson-exports-and-imports-maps)
14. [ESM: ModuleJob and Linking](#14-esm-modulejob-and-linking)
15. [ESM: Translators — How Formats Become Modules](#15-esm-translators--how-formats-become-modules)
16. [CJS ↔ ESM Interoperability](#16-cjs--esm-interoperability)
17. [Loader Hooks — Customizing Both Systems](#17-loader-hooks--customizing-both-systems)
18. [Comparison and Decision Guide](#18-comparison-and-decision-guide)

---

## 1. Overview: Two Module Systems

Node.js ships two completely separate module systems. They coexist but operate differently:

```
CommonJS (CJS)                      ECMAScript Modules (ESM)
─────────────────────────────────   ─────────────────────────────────
require() / module.exports          import / export
Synchronous                         Asynchronous (link phase)
Dynamic (runtime resolution)        Static (parse-time analysis)
Wraps code in a function            Native V8 module graph
lib/internal/modules/cjs/           lib/internal/modules/esm/
```

**Which system runs?** Node.js decides based on:

| Condition | System |
|---|---|
| File extension `.cjs` | CJS always |
| File extension `.mjs` | ESM always |
| File extension `.js` + `"type": "module"` in `package.json` | ESM |
| File extension `.js` + no `"type"` or `"type": "commonjs"` | CJS |
| `--input-type=module` flag | ESM |

---

## 2. CommonJS — The Architecture

The entire CJS system lives in `lib/internal/modules/cjs/loader.js` (2158 lines). The key data structures are set up at startup:

```js
// lib/internal/modules/cjs/loader.js:338
function Module(id = '', parent) {
  this.id = id;                    // absolute filename, or '.' for main
  this.path = path.dirname(id);    // directory of this module
  setOwnProperty(this, 'exports', {}); // what gets returned by require()
  this[kFirstModuleParent] = parent;
  this.filename = null;
  this.loaded = false;             // becomes true after _compile() runs
  this.children = [];              // modules required by this one
}

// Three null-prototype caches (null prototype = no inherited properties,
// faster lookups, prevents 'constructor' / '__proto__' key collisions)
Module._cache      = { __proto__: null }; // filename → Module
Module._pathCache  = { __proto__: null }; // request+paths → filename
Module._extensions = { __proto__: null }; // '.js' / '.json' / '.node' handlers
```

Why `{ __proto__: null }`? Because these are used as plain dictionaries. A module named `"constructor"` or `"toString"` would collide with `Object.prototype` properties if the prototype were not stripped.

---

## 3. CJS: The Module Wrapper

Every `.js` file loaded by CJS is **not executed directly**. It is wrapped in an immediately-invoked function expression (IIFE) that injects 5 variables:

```js
// lib/internal/modules/cjs/loader.js:372
const wrapper = [
  '(function (exports, require, module, __filename, __dirname) { ',
  '\n});',
];
```

So this user code:

```js
// mymodule.js
const x = 42;
module.exports = x;
```

Becomes this before execution:

```js
(function (exports, require, module, __filename, __dirname) {
  const x = 42;
  module.exports = x;
});
```

The wrapper serves three purposes:

1. **Scoping** — variables declared in one module do not leak into others. Every module gets its own function scope.
2. **Injection** — `exports`, `require`, `module`, `__filename`, `__dirname` are local variables, not globals. They are bound to the specific module instance.
3. **`exports` vs `module.exports`** — `exports` is initialized as a reference to `module.exports`. If you reassign `exports = something`, you break the reference. Always use `module.exports` for full replacement.

The wrapper can be inspected and even patched (used by test frameworks like Jest):

```js
require('module').wrapper       // the two string halves
require('module').wrap(script)  // the wrapping function itself
```

---

## 4. CJS: `require()` and `Module._load()`

When your code calls `require('some-module')`, the call chain is:

```
require(id)                            [Module.prototype.require, line 1567]
  → wrapModuleLoad(id, this, false)
    → Module._load(request, parent, isMain)   [line 1238]
      → resolve filename
      → check cache
      → new Module(filename, parent)
      → module.load(filename)                 [line 1537]
        → Module._extensions[ext](module, filename)
          → module._compile(source, filename) [line 1781]
            → wrap source
            → V8 compile
            → execute wrapper function
      → return module.exports
```

Here is `Module._load` in full detail (`lib/internal/modules/cjs/loader.js:1238`):

```js
Module._load = function(request, parent, isMain, internalResolveOptions = kEmptyObject) {
  let relResolveCacheIdentifier;

  // ─── STEP 1: Fast-path cache ───────────────────────────────────────────
  // relativeResolveCache maps  "${parent.path}\x00${request}"  →  filename
  // This avoids calling _resolveFilename() for the same relative require
  // from the same directory a second time.
  if (parent) {
    relResolveCacheIdentifier = `${parent.path}\x00${request}`;
    const filename = relativeResolveCache[relResolveCacheIdentifier];
    if (filename !== undefined) {
      const cachedModule = Module._cache[filename];
      if (cachedModule !== undefined) {
        updateChildren(parent, cachedModule, true);
        if (!cachedModule.loaded)
          return getExportsForCircularRequire(cachedModule); // circular!
        return cachedModule.exports;   // cache hit, done
      }
      delete relativeResolveCache[relResolveCacheIdentifier]; // stale entry
    }
  }

  // ─── STEP 2: Resolve filename ──────────────────────────────────────────
  const resolveResult = resolveForCJSWithHooks(request, parent, isMain, internalResolveOptions);
  const { url, filename } = resolveResult;

  // ─── STEP 3: Main module cache ─────────────────────────────────────────
  let cachedModule = Module._cache[filename];
  if (cachedModule !== undefined) {
    updateChildren(parent, cachedModule, true);
    if (cachedModule.loaded)
      return cachedModule.exports;   // already fully loaded
    if (!cachedModule[kIsCachedByESMLoader])
      return getExportsForCircularRequire(cachedModule); // circular!
  }

  // ─── STEP 4: Create module ─────────────────────────────────────────────
  const module = cachedModule || new Module(filename, parent);

  // ─── STEP 5: Register in cache BEFORE executing ────────────────────────
  // Critical: the module is cached before its code runs. This is what
  // breaks circular dependency infinite loops — a second require() of the
  // same file finds the partially-loaded module in the cache.
  Module._cache[filename] = module;
  if (parent !== undefined)
    relativeResolveCache[relResolveCacheIdentifier] = filename;

  // ─── STEP 6: Load and execute ──────────────────────────────────────────
  let threw = true;
  try {
    module.load(filename);
    threw = false;
  } finally {
    if (threw) {
      // If loading threw, remove from cache so a retry is possible
      delete Module._cache[filename];
      delete relativeResolveCache[relResolveCacheIdentifier];
    }
  }

  // ─── STEP 7: Return exports ────────────────────────────────────────────
  return module.exports;
};
```

---

## 5. CJS: The Resolution Algorithm

`Module._resolveFilename()` (line 1391) determines what file a `require()` string maps to. The algorithm differs based on the specifier type:

```
require(specifier)
│
├── Is it a builtin?  (e.g. 'fs', 'path', 'node:http')
│     → return specifier immediately (no file lookup)
│
├── Starts with '#'?  (package self-imports)
│     → read nearest package.json "imports" field
│     → resolve via packageImportsResolve()
│
├── Starts with './' or '../' or '/'?  (relative/absolute path)
│     → resolve relative to parent file's directory
│     → go to _findPath()
│
└── Bare specifier?  (e.g. 'express', 'lodash')
      → compute node_modules lookup paths (walking up the tree)
      → go to _findPath() for each path
```

`Module._findPath()` (line 703) takes the resolved paths and finds the actual file:

```
For each candidate directory:
│
├── Does package.json "exports" apply?
│     → resolve via packageExportsResolve()  (if the package has exports map)
│
├── Try the path as an exact file
│     → stat() the path directly
│
├── Try with extensions in order: ['.js', '.json', '.node', ...]
│     → tryExtensions() tries path + each extension
│
└── Try as a directory
      ├── Read package.json → use "main" field
      │     → try main as file, main + extensions, main/index + extensions
      └── Try index.js, index.json, index.node
```

Results are stored in `Module._pathCache` keyed by `request + '\x00' + paths.join('\x00')` to avoid repeating the disk walk.

---

## 6. CJS: The node_modules Walk

For bare specifiers (`require('lodash')`), Node.js generates a list of candidate `node_modules` directories by walking **up** the filesystem from the requiring file.

`Module._nodeModulePaths()` (line 878):

```js
// For a file at /home/user/project/src/app.js, this generates:
[
  '/home/user/project/src/node_modules',
  '/home/user/project/node_modules',
  '/home/user/node_modules',
  '/home/node_modules',
  '/node_modules',
]
```

The algorithm scans backwards through the path string looking for `/` characters, skipping any segment already named `node_modules` (to avoid `/node_modules/node_modules`). It is purely string-based — no filesystem access at this stage.

`Module._resolveLookupPaths()` (line 925) also prepends `NODE_PATH` directories and the current working directory's own `node_modules` to this list.

**This is why package hoisting in monorepos works** — a package installed at `/project/node_modules` is found by files anywhere under `/project/`, because the walk always reaches that directory.

---

## 7. CJS: File Extension Handlers

`Module.prototype.load()` (line 1537) dispatches to an extension handler:

```js
Module.prototype.load = function(filename) {
  let extension = findLongestRegisteredExtension(filename);
  Module._extensions[extension](this, filename);  // dispatch
  this.loaded = true;
  this[kModuleExport] = this.exports; // snapshot for ESM interop
};
```

**`.js` handler** (line 1925) — determines format, then compiles:

```js
Module._extensions['.js'] = function(module, filename) {
  // .cjs → always commonjs
  // .mjs → always ESM (throws ERR_REQUIRE_ESM unless --require-module)
  // .js  → check nearest package.json "type" field
  //   "module"    → ESM
  //   "commonjs"  → CJS (default)
  module._compile(source, filename, format);
};
```

**`.json` handler** (line 1977) — parses and assigns directly:

```js
Module._extensions['.json'] = function(module, filename) {
  const { source } = loadSource(module, filename, 'json');
  // JSON.parse directly into module.exports — no wrapper function
  setOwnProperty(module, 'exports', JSONParse(stripBOM(content)));
};
```

**`.node` handler** (line 1994) — native C++ addons:

```js
Module._extensions['.node'] = function(module, filename) {
  // Calls process.dlopen() which uses dlopen()/LoadLibrary() to
  // load the compiled .node binary and call its NAPI_MODULE register function
  return loadNativeModule(module, filename);
};
```

You can add your own extension handler:

```js
require.extensions['.ts'] = function(module, filename) {
  const source = transpileTypeScript(fs.readFileSync(filename, 'utf8'));
  module._compile(source, filename);
};
```

---

## 8. CJS: Circular Dependencies

CJS handles circular dependencies by returning **partial exports**. Because a module is added to `Module._cache` *before* its code executes (step 5 in `Module._load`), a second `require()` of the same file during its own execution gets the partially-built `exports` object.

```js
// a.js
const b = require('./b');
console.log('a: b.done =', b.done);
exports.done = true;

// b.js
const a = require('./a');   // ← a is mid-execution! Gets partial exports: {}
console.log('b: a.done =', a.done); // undefined — a hasn't set done yet
exports.done = true;
```

`getExportsForCircularRequire()` (line 1010) handles the detection:

```js
function getExportsForCircularRequire(module) {
  // If exports is a plain object, wrap it in a Proxy that warns
  // when you access a property that hasn't been set yet
  if (module.exports &&
      !isProxy(module.exports) &&
      ObjectGetPrototypeOf(module.exports) === ObjectPrototype &&
      !module.exports.__esModule) {
    ObjectSetPrototypeOf(module.exports, CircularRequirePrototypeWarningProxy);
  }
  return module.exports; // return the partial exports
}

// Accessing an undefined property on a partially-loaded module warns:
const CircularRequirePrototypeWarningProxy = new Proxy({}, {
  get(target, prop) {
    if (prop in target || prop === '__esModule') return target[prop];
    emitCircularRequireWarning(prop); // "Accessing non-existent property..."
    return undefined;
  },
});
```

**ESM and circular deps are stricter** — ESM detects cycles at link time and throws `ERR_REQUIRE_CYCLE_MODULE` if a cycle is found involving ESM modules loaded via `require()`.

---

## 9. CJS: The Cache System

Three caches work together to make repeated `require()` calls O(1):

```
relativeResolveCache   (fast path)
  Key:   "${parent.path}\x00${request}"
  Value: resolved absolute filename
  Hit:   skip _resolveFilename() entirely

Module._cache          (module cache)
  Key:   absolute filename
  Value: Module instance (with .exports, .loaded, etc.)
  Hit:   return module.exports directly

Module._pathCache      (resolution cache)
  Key:   "${request}\x00${paths.join('\x00')}"
  Value: resolved absolute filename
  Hit:   skip _findPath() filesystem walk
```

The `\x00` (null byte) separator in cache keys prevents ambiguous collisions — a request `"a"` from path `"/b/c"` won't collide with request `"a/b"` from path `"c"`.

**Cache invalidation:** There is none built in. Once a module is loaded, it stays in cache for the lifetime of the process. To force a reload:

```js
delete require.cache[require.resolve('./mymodule')];
const freshModule = require('./mymodule'); // re-executed from disk
```

This has a known pitfall: child modules that were loaded by `mymodule` remain in the cache with references to the old instance.

---

## 10. ESM — The Architecture

ESM is built around the **V8 Module Graph** — a native data structure in the JS engine. Unlike CJS, ESM modules are not executed in isolation; they are linked together before any of them run.

Key files:

| File | Role |
|---|---|
| `lib/internal/modules/esm/loader.js` | `ModuleLoader` class, `import()` entry point |
| `lib/internal/modules/esm/resolve.js` | URL-based resolution algorithm |
| `lib/internal/modules/esm/load.js` | Reading source from disk/network |
| `lib/internal/modules/esm/module_job.js` | `ModuleJob` — tracks one module through its lifecycle |
| `lib/internal/modules/esm/translators.js` | Format-specific compilers (module, commonjs, json) |

The central class is `ModuleLoader` (`lib/internal/modules/esm/loader.js:156`):

```js
class ModuleLoader {
  #defaultConditions = getDefaultConditions(); // ['import', 'node', ...]
  #resolveCache = newResolveCache();           // URL → resolved URL
  loadCache = newLoadCache();                  // URL → ModuleJob
}
```

---

## 11. ESM: The Four Phases of Loading

Every ESM module goes through four phases in strict order. No phase can begin until the previous one completes for all modules in the dependency graph.

```
Phase 1: PARSE (Construction)
  Read source text → parse → build ModuleWrap (V8 object)
  Static import/export declarations are extracted
  No code runs

Phase 2: LINK (Instantiation)
  Resolve all import specifiers recursively
  Build the full dependency graph
  Allocate memory bindings for all exports
  Still no code runs

Phase 3: EVALUATE (Evaluation)
  Execute each module's code in dependency-first order
  Export bindings are filled with their values
  Top-level await is supported here

Phase 4: NAMESPACE
  module.getNamespace() returns the live export bindings
  Importers can read the exported values
```

This is fundamentally different from CJS where "resolve + execute" happen per-module, synchronously, in one shot. In ESM, the entire graph is analyzed before a single line of user code runs.

This enables:
- **Top-level `await`** — the engine knows the full graph and can pause evaluation
- **Live bindings** — an `export let count` that changes is visible to all importers immediately
- **Circular dependency detection at link time** — rather than returning partial objects

---

## 12. ESM: Resolution Algorithm

ESM resolution is URL-based, not path-based. Every module is identified by a URL (`file:///home/user/project/app.js`, `node:fs`, `https://example.com/module.js`).

`defaultResolve()` in `lib/internal/modules/esm/resolve.js:943`:

```js
function defaultResolve(specifier, context = {}) {
  const { parentURL, conditions } = context;

  // ── Relative or absolute path ──────────────────────────────────────────
  if (shouldBeTreatedAsRelativeOrAbsolutePath(specifier)) {
    // './foo', '../bar', '/absolute'
    parsed = new URL(specifier, parentURL); // URL resolution
  }

  // ── data: URLs ─────────────────────────────────────────────────────────
  if (protocol === 'data:') return { url: parsed.href };

  // ── node: built-ins ────────────────────────────────────────────────────
  if (protocol === 'node:') return { url: specifier };

  // ── Entry point (no parent) ────────────────────────────────────────────
  if (parentURL === undefined) {
    parentURL = pathToFileURL(process.cwd() + '/').href;
  }

  // ── Bare specifier: package resolution ─────────────────────────────────
  url = moduleResolve(specifier, parentURL, conditions);

  return { url: url.href, format: defaultGetFormatWithoutErrors(url, context) };
}
```

`moduleResolve()` handles bare specifiers:

```
import 'lodash'
│
├── Is it a relative/absolute URL? No
├── Is it a built-in (node:*)? No
├── Does the package.json "imports" have '#lodash'? (self-imports) Check
├── Does the nearest package.json "exports" self-map to 'lodash'? Check
└── Walk node_modules directories (same walking algorithm as CJS)
    └── Found /node_modules/lodash/package.json
        → Check "exports" field first
        → Fall back to "main" field
        → Fall back to index.js
```

---

## 13. ESM: `package.json` Exports and Imports Maps

### The `exports` Field

`packageExportsResolve()` in `lib/internal/modules/esm/resolve.js:584` implements the `exports` map lookup.

```json
// package.json
{
  "exports": {
    ".": "./src/index.js",
    "./utils": "./src/utils.js",
    "./internal/*": null
  }
}
```

**Direct match** — checked first, no wildcards needed:

```js
import 'mypackage';          // maps to '.' → ./src/index.js
import 'mypackage/utils';    // maps to './utils' → ./src/utils.js
```

**Pattern match with `*`** — longest-match wins:

```json
{
  "exports": {
    "./features/*": "./src/features/*.js",
    "./features/experimental/*": "./src/experimental/*.js"
  }
}
```

`import 'pkg/features/experimental/foo'` matches `./features/experimental/*` (longer prefix) over `./features/*`.

**Conditional exports** — resolved against the current `conditions` set:

```json
{
  "exports": {
    ".": {
      "import": "./src/esm/index.js",
      "require": "./src/cjs/index.js",
      "default": "./src/index.js"
    }
  }
}
```

Conditions are checked in object-key order, first match wins. Default conditions:
- `require()` provides: `["require", "node", "node-addons"]`
- `import` provides: `["import", "node"]`
- Custom via: `node --conditions=browser app.js`

**`null` export** — explicitly blocks access:

```json
{ "exports": { "./internal/*": null } }
```

`import 'pkg/internal/secret'` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. This is how packages prevent importing private internals.

### The `imports` Field (Package Self-Imports)

`packageImportsResolve()` in `lib/internal/modules/esm/resolve.js:691`. The `#` prefix signals a self-import:

```json
{
  "imports": {
    "#utils": "./src/utils.js",
    "#env": {
      "node": "./env.node.js",
      "default": "./env.default.js"
    }
  }
}
```

```js
// Inside the same package:
import utils from '#utils';     // → ./src/utils.js
import env from '#env';         // → conditional, depends on environment
```

This lets packages create private aliases without exposing them to external consumers. It also works with CJS via `require('#utils')`.

---

## 14. ESM: ModuleJob and Linking

`ModuleJob` (`lib/internal/modules/esm/module_job.js:198`) tracks a single module through its lifecycle. Each module has exactly one `ModuleJob`.

```js
class ModuleJob extends ModuleJobBase {
  constructor(loader, url, importAttributes, moduleOrModulePromise,
              phase, isMain, inspectBrk, requestType) {

    // The V8 ModuleWrap — either already resolved or a promise to it
    if (isPromise(moduleOrModulePromise)) {
      this.modulePromise = moduleOrModulePromise;
    } else {
      this.module = moduleOrModulePromise;
      this.modulePromise = PromiseResolve(moduleOrModulePromise);
    }

    // Start linking immediately — discover and load all dependencies
    if (this.phase === kEvaluationPhase) {
      this.linked = this.link(requestType);
    }
  }
}
```

**Linking** (`#asyncLink`, line 252) — the dependency discovery phase:

```js
async #asyncLink(requestType) {
  this.module = await this.modulePromise;

  // Ask V8: what does this module import?
  const moduleRequests = this.module.getModuleRequests();

  // For each import specifier, recursively create/find its ModuleJob
  const modulePromises = Array(moduleRequests.length);
  for (let idx = 0; idx < moduleRequests.length; idx++) {
    const request = moduleRequests[idx];
    const dependencyJobPromise =
      this.loader.getOrCreateModuleJob(this.url, request, requestType);
    modulePromises[idx] = PromisePrototypeThen(dependencyJobPromise,
      (job) => job.modulePromise
    );
  }

  // Wait for ALL dependencies to be loaded (in parallel)
  const modules = await SafePromiseAllReturnArrayLike(modulePromises);

  // Tell V8 to link this module to its resolved dependencies
  this.module.link(modules);
}
```

This is where ESM becomes fundamentally different from CJS. All `import` declarations in a file are read by V8 **before any code runs**, and `getModuleRequests()` returns them all at once. Dependencies are fetched in parallel.

**V8 Module states** (imported at line 27):

```
kUninstantiated  →  kInstantiated  →  kEvaluating  →  kEvaluated
     parsed           linked            running         done
                                          ↓
                                       kErrored  (if evaluation throws)
```

---

## 15. ESM: Translators — How Formats Become Modules

`lib/internal/modules/esm/translators.js` converts source code into `ModuleWrap` objects that V8 understands.

### Standard ES Module Translator (line 81)

```js
translators.set('module', function moduleStrategy(url, translateContext, parentURL) {
  let { source } = translateContext;
  source = stringify(source); // Buffer → string

  // Compile directly with V8's SourceTextModule
  const module = compileSourceTextModule(url, source, kUser, context);
  return module; // V8 ModuleWrap, ready for linking
});
```

V8 parses the source and builds a module record with all static imports extracted. No wrapper function — this is native module support at the engine level.

### CJS-as-ESM Translator (line 203)

When ESM imports a CJS file, a **facade** module is created:

```js
function createCJSModuleWrap(url, translateContext, ...) {
  const filename = urlToFilename(url);

  // 1. Statically pre-parse the CJS source to find what it exports
  const { exportNames, module } = cjsPreparseModuleExports(filename, source, sourceFormat);

  // 2. Build the export name list for V8's module record
  const wrapperNames = [...exportNames, 'default', 'module.exports'];

  // 3. Create a synthetic ModuleWrap that:
  //    - declares the discovered export names to V8 (for static analysis)
  //    - executes the CJS module lazily when evaluated
  return new ModuleWrap(url, undefined, wrapperNames, function() {
    // Execute CJS module when this ESM facade is evaluated
    if (!module.loaded) {
      loadCJS(module, source, url, filename, !!isMain);
    }

    const exports = module.exports;

    // Map CJS named exports to ESM named exports
    for (const exportName of exportNames) {
      this.setExport(exportName, exports[exportName]);
    }

    // CJS module.exports becomes both 'default' and 'module.exports'
    this.setExport('default', exports);
    this.setExport('module.exports', exports);
  }, module);
}
```

This is why `import fs from 'fs'` works — the CJS `module.exports` object becomes the `default` export.

### JSON Translator (line 446)

JSON files become dynamic modules where every top-level key is a named export:

```js
translators.set('json', function jsonStrategy(url, translateContext) {
  const jsonModule = JSONParse(stripBOM(source));

  // Creates a synthetic module with every JSON key as an export
  return createDynamicModule(
    [],
    [...ObjectGetOwnPropertyNames(jsonModule)], // export names
    url,
    (reflect) => {
      reflect.exports.default = jsonModule;     // full object as default
      for (const key of ObjectGetOwnPropertyNames(jsonModule)) {
        reflect.exports[key] = jsonModule[key]; // each key as named export
      }
    }
  );
});
```

---

## 16. CJS ↔ ESM Interoperability

### ESM importing CJS (`import` from a `.js`/`.cjs` file)

This works. The CJS module is executed normally, and its `module.exports` is:
- The `default` export
- Named exports for any enumerable own properties (pre-parsed statically)

```js
// math.cjs
exports.add = (a, b) => a + b;
exports.PI = 3.14159;

// app.mjs
import math, { add, PI } from './math.cjs';
console.log(math.add(1, 2));  // 3 — via default export
console.log(add(1, 2));       // 3 — via named export
console.log(PI);              // 3.14159
```

**Caveat:** Named exports from CJS are statically pre-parsed. If `module.exports` is built dynamically at runtime (e.g. `module.exports[key] = value` in a loop), those names won't be detected and the named import will be `undefined`. Use the `default` import instead.

### CJS `require()`-ing ESM

**This used to throw `ERR_REQUIRE_ESM`.** As of Node.js 22+, it is supported when the ESM module does not use top-level `await` (flag: `--require-module`, now on by default in recent versions).

`loadESMFromCJS()` at `lib/internal/modules/cjs/loader.js:1589`:

```js
function loadESMFromCJS(mod, filename, format, source) {
  const cascadedLoader = require('internal/modules/esm/loader')
                           .getOrInitializeCascadedLoader();
  const isMain = mod[kIsMainSymbol];

  if (isMain) {
    // Entry-point: run the ESM loader bootstrapper
    runEntryPointWithESMLoader((loader) => {
      return loader.import(pathToFileURL(filename).href, ...);
    });
  } else {
    // Non-entry: require() of ESM from CJS
    // Throws if the ESM uses top-level await (can't synchronize)
    // Otherwise wraps and executes synchronously
  }
}
```

The namespace object returned by the ESM loader is mapped back to `module.exports`:
- If ESM exports `module.exports` explicitly → use it
- If ESM has a `default` export → use it as `module.exports`
- Otherwise → use the full namespace object

### The `__esModule` Convention

Transpilers (Babel, TypeScript) mark CJS output with `__esModule: true`:

```js
// TypeScript compiled output
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.myFn = myFn;
function myFn() { ... }
```

When Node.js sees `__esModule: true` on a CJS module being imported by ESM, it uses the namespace object directly rather than wrapping `module.exports` as the default. This preserves transpiler-level ESM semantics.

---

## 17. Loader Hooks — Customizing Both Systems

Both systems can be customized via hooks.

### ESM Loader Hooks (`--import`)

Register a module with `--import` or `register()`:

```js
// my-loader.mjs
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.ts')) {
    return {
      shortCircuit: true,
      url: new URL(specifier, context.parentURL).href,
      format: 'module',
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts')) {
    const source = await fs.promises.readFile(new URL(url));
    const transpiled = transpileTypeScript(source);
    return { format: 'module', source: transpiled, shortCircuit: true };
  }
  return nextLoad(url, context);
}
```

```
node --import ./register-loader.mjs app.mjs
```

Hooks run in the order they were registered and can be chained.

### CJS Extension Handlers

```js
// Register before any require() calls
require.extensions['.yaml'] = function(module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  module.exports = YAML.parse(content);
};
```

Note: `require.extensions` is deprecated (but still works). The ESM loader hooks are the modern replacement.

---

## 18. Comparison and Decision Guide

### Behavioral Differences

| | CJS | ESM |
|---|---|---|
| **Execution** | Synchronous, inline | Async link phase, then sync evaluate |
| **Exports** | Snapshot at call time | Live bindings (always current value) |
| **`this` at top level** | `module.exports` | `undefined` |
| **`__filename`** | Available | `import.meta.filename` |
| **`__dirname`** | Available | `import.meta.dirname` |
| **Dynamic require** | `require(variable)` works | `import()` dynamic only |
| **Circular deps** | Partial exports returned | Detected at link time |
| **Top-level await** | Not supported | Supported |
| **Tree shaking** | Not possible | Possible (static analysis) |
| **Caching** | `Module._cache` (mutable) | `loadCache` (immutable) |

### File Reference Quick Map

| Task | File | Line |
|---|---|---|
| Module constructor | `lib/internal/modules/cjs/loader.js` | 338 |
| Module wrapper string | `lib/internal/modules/cjs/loader.js` | 372 |
| `Module._load()` | `lib/internal/modules/cjs/loader.js` | 1238 |
| Cache lookup (fast path) | `lib/internal/modules/cjs/loader.js` | 1245 |
| `_resolveFilename()` | `lib/internal/modules/cjs/loader.js` | 1391 |
| `_findPath()` | `lib/internal/modules/cjs/loader.js` | 703 |
| node_modules walk | `lib/internal/modules/cjs/loader.js` | 878 |
| `.js` extension handler | `lib/internal/modules/cjs/loader.js` | 1925 |
| `.json` extension handler | `lib/internal/modules/cjs/loader.js` | 1977 |
| `Module.prototype.load` | `lib/internal/modules/cjs/loader.js` | 1537 |
| `Module.prototype.require` | `lib/internal/modules/cjs/loader.js` | 1567 |
| Circular dep handling | `lib/internal/modules/cjs/loader.js` | 1010 |
| `loadESMFromCJS()` | `lib/internal/modules/cjs/loader.js` | 1589 |
| ESM `defaultResolve()` | `lib/internal/modules/esm/resolve.js` | 943 |
| ESM exports map | `lib/internal/modules/esm/resolve.js` | 584 |
| ESM imports map | `lib/internal/modules/esm/resolve.js` | 691 |
| `ModuleJob` constructor | `lib/internal/modules/esm/module_job.js` | 198 |
| `ModuleJob` linking | `lib/internal/modules/esm/module_job.js` | 252 |
| ESM module translator | `lib/internal/modules/esm/translators.js` | 81 |
| CJS-as-ESM facade | `lib/internal/modules/esm/translators.js` | 203 |
| JSON ESM translator | `lib/internal/modules/esm/translators.js` | 446 |

### When to Use Which

**Use CJS when:**
- Maintaining an existing CJS codebase — no reason to migrate just for migration's sake
- Using tooling that doesn't support ESM (some Jest configurations, older webpack)
- Building CLI tools that need synchronous startup with dynamic `require()`

**Use ESM when:**
- Starting a new project
- Building a library (consumers can use it from both CJS and ESM via `exports` map)
- Needing top-level `await`
- Wanting tree shaking in bundlers
- Targeting the browser alongside Node.js (same module format)

**Support both in a library** with dual-package publishing:

```json
{
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js"
    }
  },
  "main": "./dist/cjs/index.js"
}
```
