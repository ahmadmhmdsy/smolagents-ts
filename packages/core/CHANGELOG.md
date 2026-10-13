# @smolagents-ts/core

## 0.1.0

### Minor Changes

- 5b0499b: Add the S1 core runtime: the MultiStepAgent ReAct loop, CodeAgent and ToolCallingAgent,
  schema-first tools, the CodeExecutor seam, agent middleware, the async event stream,
  AgentSession, and the MockModel and ScriptedExecutor test doubles.
- The first release of the runtime: `MultiStepAgent` with its ReAct loop, `CodeAgent`,
  `ToolCallingAgent`, schema-first tools, the `CodeExecutor` seam, middleware, the event
  stream and `AgentSession`, plus the `MockModel` and `ScriptedExecutor` test doubles.

### Patch Changes

- A run now releases its executor: `releaseResources` fires when the run ends, when it fails,
  and when a reader stops early, and `CodeAgent` uses it to dispose what it started.
- A code step that throws hands the model the executor's error message rather than an empty
  observation, so the next turn can react to what went wrong.
- The session snapshot gained a planning lane, which a reader can follow while the planning
  step is still streaming.
