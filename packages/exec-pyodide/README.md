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
bound in this process, no executor exists yet — decision
[0033](../../docs/09-decisions/0033-the-pyodide-interrupt-stays-deferred.md)
pre-registers the shape of one.

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
