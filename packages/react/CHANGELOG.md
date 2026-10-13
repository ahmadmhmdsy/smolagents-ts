# @smolagents-ts/react

## 0.1.0

### Minor Changes

- d684e3e: Add the React layer: `useAgentSession`, `useAgentRun`, `useAgentEvent` and
  `useAgentRunSnapshot` subscribe to a live `AgentSession`, and `AgentRun` and
  `AgentStep` render it as headless, class-named primitives with an override slot per step
  kind. The core gains a `planning` lane in the session snapshot, so a run's planning steps
  are readable while they stream.
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
