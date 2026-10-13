# @smolagents-ts/exec-quickjs

## 0.1.0

### Minor Changes

- 4e058d8: Add the QuickJS code executor: `QuickJSExecutor` runs agent-authored JavaScript in a
  QuickJS-WASM realm, bridges awaited host tool calls through the engine's job queue, and
  reports an explicit capability set. The core gains a `releaseResources` hook that runs when
  a run ends — on success, on failure and when a consumer stops reading — and `CodeAgent`
  uses it to release its executor. A failed code step's observation now carries the error
  text, so the model reads why a step failed instead of an empty observation.
- The first release: an agent whose action is a program, in TypeScript.

  `smolagents-ts` is the package to install. It re-exports the runtime, the
  provider adapters, the default tools, the QuickJS executor and the React layer
  under one name, with React and the QuickJS engine as optional peers. The
  internal packages are published beside it because its declarations name them;
  they are not the documented entry point.

  This release is pre-1.0 and its API can move. It is an unofficial TypeScript
  implementation of the smolagents approach and is not affiliated with Hugging
  Face.

### Patch Changes

- Updated dependencies [5b0499b]
- Updated dependencies [4e058d8]
- Updated dependencies [d684e3e]
- Updated dependencies
  - @smolagents-ts/core@0.1.0
