# @smolagents-ts/core

## 0.1.0

### Minor Changes

- The first release of the runtime: `MultiStepAgent` with its ReAct loop, `CodeAgent` and
  `ToolCallingAgent`, schema-first tools, the `CodeExecutor` seam, middleware, the async
  event stream and `AgentSession`, plus the `MockModel` and `ScriptedExecutor` test doubles.
- Multi-agent orchestration with an approval gate: a managed agent runs beside the parent,
  and `withApproval` asks before a tool call executes.
- Durable runs: a `RunStore` checkpoints a run and resumes it after a process restart.
- Observability: `buildTrace` folds an agent event stream into an OpenTelemetry-shaped span
  tree, and `scoreRun` checks a completed run against a transcript's expectations.
- Session persistence: a session `checkpoint` continues the agent's memory across turns.
- Guardrails and output schemas: `AgentOptions.guardrails` are the tripwires checked during
  a run, and `AgentOptions.outputSchema` validates the final answer before a run returns it.

### Patch Changes

- A run now releases its executor: `releaseResources` fires when the run ends, when it fails,
  and when a reader stops early, and `CodeAgent` uses it to dispose what it started.
- A code step that throws hands the model the executor's error message rather than an empty
  observation, so the next turn can react to what went wrong.
- The session snapshot gained a planning lane, which a reader can follow while the planning
  step is still streaming.
