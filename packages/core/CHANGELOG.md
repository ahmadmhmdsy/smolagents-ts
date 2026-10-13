# @smolagents-ts/core

## 0.1.0

### Minor Changes

- 5b0499b: Add the S1 core runtime: the MultiStepAgent ReAct loop, CodeAgent and ToolCallingAgent,
  schema-first tools, the CodeExecutor seam, agent middleware, the async event stream,
  AgentSession, and the MockModel and ScriptedExecutor test doubles.
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

- 4e058d8: Add the QuickJS code executor: `QuickJSExecutor` runs agent-authored JavaScript in a
  QuickJS-WASM realm, bridges awaited host tool calls through the engine's job queue, and
  reports an explicit capability set. The core gains a `releaseResources` hook that runs when
  a run ends — on success, on failure and when a consumer stops reading — and `CodeAgent`
  uses it to release its executor. A failed code step's observation now carries the error
  text, so the model reads why a step failed instead of an empty observation.
- d684e3e: Add the React layer: `useAgentSession`, `useAgentRun`, `useAgentEvent` and
  `useAgentRunSnapshot` subscribe to a live `AgentSession`, and `AgentRun` and
  `AgentStep` render it as headless, class-named primitives with an override slot per step
  kind. The core gains a `planning` lane in the session snapshot, so a run's planning steps
  are readable while they stream.
