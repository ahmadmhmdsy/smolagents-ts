# @smolagents-ts/exec-pyodide

The Python `CodeExecutor`: agent-authored Python in a Pyodide-WASM runtime,
in-process on Node and in a browser page. One instance serves one run, and its
interpreter globals persist across the run's steps.

The import allow-list over the guest's `builtins.__import__` is a fidelity
guard, not a security boundary: a guest can restore the builtin, and the hook
sees the interpreter's own imports. This executor is not a sandbox.

## Its limits, in plain language

A synchronous guest loop cannot be preempted: the JS thread is the Python thread,
so `timeoutMs` and an abort are honoured at the next await boundary and reported
then, not enforced at the deadline. A loop that never yields runs to completion
however long it takes. The runtime is 13.40 MiB, it cannot be unloaded, and
`dispose()` drops the reference rather than reclaiming the memory. For
untrusted or unbounded Python use the remote executors; for a hard wall-clock
bound without leaving the host, use `PyodideWorkerExecutor`, below.

## A hard deadline: `PyodideWorkerExecutor`

`PyodideWorkerExecutor` runs the same executor in a worker the host can
terminate (decision
[0041](../../docs/09-decisions/0041-the-pyodide-worker-is-built-ahead-of-its-trigger.md)).
At a step's deadline, or on an abort, the host terminates the worker and the
step ends with the same timeout or cancellation error, even inside
`while True: pass`. It needs no COOP/COEP header.

    import { PyodideWorkerExecutor } from "@smolagents-ts/exec-pyodide";

    const executor = new PyodideWorkerExecutor({ cpuTimeLimitMs: 10_000 });
    // … pass it to a CodeAgent as its executor; call executor.dispose() when the run ends.

What it costs:

- A stop loses the guest's globals; the next step starts a fresh worker and
  pays one cold start (about two seconds on Node). The cold start is never
  charged to a step's deadline.
- Every tool call is a message round trip to the host, where the tool runs, so
  arguments and results cross as JSON and the final answer as a structured
  clone.
- `cpuTimeLimitMs` (default 30,000) is the wall-clock bound it reports and
  enforces; a step stops at that bound or at its own `timeoutMs`, whichever is
  shorter.
- `dispose()` terminates the worker and reclaims the runtime.

The worker script ships as `dist/pyodide-worker.js` beside the entry. On Node it
starts as a `worker_threads` worker; in a browser it is a module `Worker`, which
bundlers that follow `new Worker(new URL(...))` pick up. A bundler that cannot
resolve it takes `workerUrl` or a `createWorker` factory. The gate proves the
Node half; the browser half is not yet run by any test. The worker is not a
sandbox either: the termination is the bound, not isolation.

## Install the facade, not this package

This package is published beside the facade, which depends on it for its Python
executor. Installing it alone is not a supported path; the facade is the entry
point.

    npm install smolagents-ts

## Documentation

The repository's `docs/` tree is the documentation. The published site is
https://ahmadmhmdsy.github.io/smolagents-ts/

Its hazards are `rules/components/exec-pyodide.md`.

## Licence

Apache-2.0; see `NOTICE`. Unofficial, and not affiliated with Hugging Face.
