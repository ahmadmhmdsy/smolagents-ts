# @smolagents-ts/exec-quickjs

## 0.1.0

### Minor Changes

- The first release of the default executor: `QuickJSExecutor` runs agent-authored
  JavaScript in a QuickJS-WASM realm, bridges awaited host tool calls through the engine's
  job queue, and reports the capability set it actually supports. One realm serves one run
  and is released when the run ends.

### Patch Changes

- Updated dependencies [5b0499b]
- Updated dependencies [4e058d8]
- Updated dependencies [d684e3e]
- Updated dependencies
  - @smolagents-ts/core@0.1.0
