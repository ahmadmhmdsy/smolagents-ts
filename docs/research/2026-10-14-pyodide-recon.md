# Reconnaissance — Pyodide as the fidelity executor

- **Task:** T-13's Task 4, the `exec-pyodide` package
- **Owner:** this session
- **Measured:** 2026-10-14, in a scratch directory outside the repository
- **Scratch:** `%TEMP%\pyodide-recon`, removed after the measurements

## Contract

- **Role:** the evidence behind Task 4, which adds a Pyodide-backed
  `CodeExecutor` as the fidelity option the design's fallback ladder names.
- **Mutability:** append-only once filed; every measurement is pinned to the
  versions it was read at.
- **Read when:** writing Task 4's plan, or re-checking what Pyodide costs and
  what it cannot do.
- **Update when:** the pinned Pyodide version, the core executor contract, or the
  browser story changes.

## Question

What does a `CodeExecutor` implemented on Pyodide cost, and what must its plan
decide before the first line of it is written?

## The contract it has to satisfy

`packages/core/src/executor.ts` declares the seam:

```ts
export interface CodeExecutor {
  readonly language: ExecutorLanguage;
  readonly capabilities: ExecutorCapabilities;
  execute(code: string, options: ExecuteOptions): Promise<CodeResult>;
  dispose?(): Promise<void>;
}
```

- `ExecutorLanguage` is `"javascript" | "python"`; the Pyodide executor is the
  first that answers `"python"`.
- `ExecutorCapabilities` carries `language`, `isolation`, `asyncToolCalls`,
  `timers`, `network`, and the optional `memoryLimitBytes` and `cpuTimeLimitMs`.
  The comment on `asyncToolCalls` calls it the single most consequential
  capability, because a code action that can await a tool needs no second turn.
- `ExecuteOptions` carries `tools`, `finalAnswer`, `signal`, `timeoutMs`,
  `stepIndex`, `logger`, `onToolCall` and `onLog`. There is no stream argument:
  guest output arrives through `onLog` and is returned in `CodeResult.logs`.
- **There is no `authorizedImports` field.** A grep for it across `packages/`
  returns nothing. The import allow-list is therefore a package-level option this
  task invents, exactly as `QuickJSExecutorOptions` is the sibling's.
- `dispose?()` is optional and the loop calls it once per run, at the end, after
  `releaseResources()`.
- The design record lists a `context?: Record<string, unknown>` member on
  `ExecuteOptions` that the shipped interface does not have. The plan follows the
  shipped interface.

The sibling `packages/exec-quickjs` is the template: `src/{index,executor,guest-source,marshal,version}.ts`,
six test files, a `public-surface.test.ts` that pins the runtime exports, `tsup`
with the runtime packages marked external, and no Node builtin anywhere in `src`.

## The `pyodide` package, measured

    $ npm view pyodide version engines dependencies dist.unpackedSize dist.fileCount exports
    version = '314.0.7'
    engines = { node: '>=18.0.0' }
    dependencies = { ws: '^8.5.0', '@types/emscripten': '^1.41.4' }
    dist.unpackedSize = 13879282
    dist.fileCount = 14

| fact | value |
|---|---|
| latest version | `314.0.7` (published 2026-09-14) |
| other lines | `next` 315.0.0-alpha.2, `stable-0.29` 0.29.5, `stable-0.27` 0.27.8 |
| licence | MPL-2.0 |
| engine range | node >=18.0.0, compatible with this repository's >=22.12 |
| runtime dependencies | `ws` ^8.5.0 and the types-only `@types/emscripten` |
| exports | `.` → `pyodide.mjs`, plus `./ffi`, `./pyodide.js`, `./pyodide.asm.mjs`, `./pyodide.asm.wasm`, `./pyodide-lock.json`, `./python_stdlib.zip` |
| installed size | 13.40 MiB in 38 files; the package itself 13.24 MiB |
| largest files | `pyodide.asm.wasm` 9.154 MiB, `python_stdlib.zip` 2.428 MiB, `pyodide.asm.mjs` 1.192 MiB |

The version scheme moved from `0.29.x` to `314.x`, which tracks the bundled
CPython; a plan has to pin an exact version, because `indexURL` and the runtime
must agree and `checkAPIVersion` defaults to true.

## The Node load path, verified

A script that replaced `globalThis.fetch` with a throwing spy before calling
`loadPyodide()` recorded **zero** fetch calls: in Node the runtime is read from
`node_modules`, and `indexURL` does not have to be passed. Python reported
itself as 3.14.2.

| measurement | value |
|---|---|
| `loadPyodide()` | 1.94–2.35 s over four runs, warm filesystem |
| first `runPython` after load | 0.7–0.9 ms |
| `print` plus a `sys.version` read | 2.3–3.5 ms |
| a second `runPython` | 0.4–0.8 ms |
| two `loadPyodide()` calls | independent interpreters, isolated globals, second load 1.64 s |

`loadPackage` is the exception to the offline story: it needs the network and it
**writes into the consumer's `node_modules`**, because `packageCacheDir`
defaults to `indexURL`. Loading `micropip` took 407 ms, made one request to the
CDN, and left `micropip-0.11.1-py3-none-any.whl` in the package directory. A bare
`import micropip` fails with `ModuleNotFoundError` until that load.

## The browser load path

- The canonical CDN layout is `https://cdn.jsdelivr.net/pyodide/v<version>/full/`,
  and the installed bundle hardcodes the same base as its default. The directory
  listing answers 403; concrete files answer 200.
- A Vite build of a page that imports the package succeeded with
  `optimizeDeps.exclude: ["pyodide"]`: 21.45 kB of JavaScript (8.31 kB gzip) in
  three files, no wasm and no stdlib zip, because the runtime is fetched at load
  time. It printed seven warnings, one per Node module the bundle externalizes
  (`node:fs`, `node:fs/promises`, `node:vm`, `node:path`, `node:url`,
  `node:crypto`, `node:child_process`).
- A worker must be a module worker, because the runtime is an ES module.
- Interruption needs a worker and a `SharedArrayBuffer`, which needs cross-origin
  isolation headers on the server.
- On the main thread a synchronous run blocks the event loop: a timer armed for
  200 ms did not fire during a 3.9 s run.

## The API surface the executor needs

| call | what it does, and what it costs |
|---|---|
| `loadPyodide(options?)` | loads the runtime; options include `indexURL`, `packageCacheDir`, `stdout`, `stderr`, `packages`, `checkAPIVersion` |
| `runPython(code, options?)` | synchronous; returns the last expression's value |
| `runPythonAsync(code, options?)` | top-level await; importing a package from the code needs `loadPackagesFromImports` first |
| `pyodide.globals` | the Python global namespace, readable and writable from JavaScript |
| `setStdout` / `setStderr` | a batched handler receives whole lines, a raw handler one character code at a time; the default writes to the console |
| `setInterruptBuffer` / `checkInterrupt` | the interrupt mechanism; there is no `setInterrupt` |
| `loadPackage` / `loadPackagesFromImports` | fetch and install wheels, from the CDN by default |
| `pyodide.FS` | the Emscripten filesystem |
| `setDebug` | toggles debug output |
| teardown | **nothing**: no `dispose`, `destroy`, `close` or `unload` exists |

## Timeout, cancellation and disposal

- Pyodide cannot preempt: WebAssembly has no preemptive multitasking, so an
  interrupt is cooperative, delivered by writing 2 into a shared interrupt buffer.
- Measured on the main thread: with the buffer pre-set, an infinite loop raised
  `KeyboardInterrupt` after 5 ms and the interpreter stayed usable. Measured with
  a worker: the main thread wrote 2 after 500 ms and the worker's `runPython`
  raised after 519 ms, roughly 19 ms later.
- A JavaScript timer cannot deliver the interrupt on the main thread, because the
  blocked event loop never runs the timer.
- The only hard stop is terminating the worker or the process.
- Disposal has no API. Dropping the reference, destroying individual proxies, or
  terminating the worker are the options; when the memory is actually reclaimed is
  not documented.

## Enforcing an import allow-list

Upstream enforces its list inside its own interpreter:
`evaluate_import` raises `InterpreterError` with the text "Import of ... is not
allowed. Authorized imports are: ...", its base module list is a constant, it
supports `*` wildcards, and it wraps an allowed module in a copied safe module.
It also refuses `eval`, `exec`, `compile`, `globals`, `locals` and
`__import__`, and restricts dunder access to a small set.

Inside Pyodide the options are:

| option | pros | cons |
|---|---|---|
| replace `builtins.__import__` | one small hook; **measured to work**, with upstream's message text; catches `import x` and `__import__("x")` | guest code can restore it; the guard also sees interpreter-internal imports |
| pre-seed `sys.modules` | no per-import cost | cannot stop a name that is not already resolved |
| a `sys.meta_path` finder | cannot be bypassed by reassigning the builtin | more code; can interfere with stdlib lazy imports |
| an AST pre-screen of the action | deterministic, cheap, blocks the import before any side effect | bypassable through `importlib` or a computed name |

Upstream's own final-answer mechanism is a `BaseException` subclass, so a
`except Exception` in the guest cannot swallow it, and its print capture is a
per-execution container truncated at 50,000 characters.

## Risks and unknowns

| # | the plan must decide | evidence |
|---|---|---|
| 1 | a 13.24 MiB install against the sibling's ~1 MB, and whether the package is a dependency, a peer, or loaded from a CDN | measured |
| 2 | a cold start of about two seconds in Node, and an unmeasured browser cold start | measured |
| 3 | whether `loadPackage` is offered at all, given that it needs the network and writes into `node_modules` | measured |
| 4 | how a timeout is enforced when the main thread cannot be interrupted by a timer | measured |
| 5 | which import allow-list mechanism, and how much of upstream's guard set comes with it | section above |
| 6 | whether Node is supported at all, given that the package drags `node:fs`, `node:vm` and `ws` into a Node consumer and none of them into a browser one | measured |
| 7 | whether the first release requires a worker, or documents the main-thread limits | measured |
| 8 | what `dispose` does when the runtime has no dispose | measured |
| 9 | how host tools are exposed to Python, and whether async tool calls work through stack switching | not measured |
| 10 | the exact version pin, and whether `checkAPIVersion` stays on | measured |

## Not measured

- The browser cold start and the CDN download cost on a real page.
- Async host tool calls from Python (stack switching, `runPythonAsync`).
- Whether the WASM instance's memory is reclaimed after the reference is dropped.
- `pnpm`'s handling of a package that writes into its own directory at run time.
