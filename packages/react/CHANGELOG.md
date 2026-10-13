# @smolagents-ts/react

## 0.1.0

### Minor Changes

- d684e3e: Add the React layer: `useAgentSession`, `useAgentRun`, `useAgentEvent` and
  `useAgentRunSnapshot` subscribe to a live `AgentSession`, and `AgentRun` and
  `AgentStep` render it as headless, class-named primitives with an override slot per step
  kind. The core gains a `planning` lane in the session snapshot, so a run's planning steps
  are readable while they stream.
- The first release of the React layer: the L2 hooks that subscribe to a live
  `AgentSession`, and the L3 `AgentRun` and `AgentStep` primitives that render it headless
  and class-named. Nothing is styled and React stays an optional peer.

### Patch Changes

- Updated dependencies [5b0499b]
- Updated dependencies [4e058d8]
- Updated dependencies [d684e3e]
- Updated dependencies
  - @smolagents-ts/core@0.1.0
