# @smolagents-ts/core

The runtime: the agent loop, its memory and steps, the event stream, the typed
errors, the prompt templates, the tool, executor and model interfaces,
`AgentSession`, middleware and the Monitor. It is isomorphic by contract and
imports no Node builtin, no DOM and no React.

## Install the facade, not this package

This package is on the registry because the `smolagents-ts` facade's
declarations name it.
It is not the documented entry point, and installing it alone is not a
supported path.

    npm install smolagents-ts

## Documentation

The repository's `docs/` tree is the documentation. The published site is
https://ahmadmhmdsy.github.io/smolagents-ts/

Its design record is `docs/design/2026-10-12-smolagents-ts-v1-design.md`.

## Licence

Apache-2.0; see `NOTICE`. Unofficial, and not affiliated with Hugging Face.
