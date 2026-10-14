# @smolagents-ts/exec-quickjs

The default `CodeExecutor`: agent-authored JavaScript in a QuickJS-WASM realm,
with the async tool-call bridge that lets a guest program call a host tool. One
instance serves one run, and its realm is reused across the run's steps.

## Install the facade, not this package

This package is published beside the facade, which depends on it for its
executor.
Installing it alone is not a supported path; the facade is the entry point.

    npm install smolagents-ts

## Documentation

The repository's `docs/` tree is the documentation. The published site is
https://ahmadmhmdsy.github.io/smolagents-ts/

Its hazards are `rules/components/exec-quickjs.md`.

## Licence

Apache-2.0; see `NOTICE`. Unofficial, and not affiliated with Hugging Face.
