# @smolagents-ts/exec-pyodide

The Python `CodeExecutor`: agent-authored Python in a Pyodide-WASM runtime,
in-process on Node and in a browser page. One instance serves one run, and its
interpreter globals persist across the run's steps.

The import allow-list over the guest's `builtins.__import__` is a fidelity
guard, not a security boundary: a guest can restore the builtin, and the hook
sees the interpreter's own imports. This executor is not a sandbox.

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
