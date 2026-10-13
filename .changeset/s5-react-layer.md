---
"@smolagents-ts/react": minor
"@smolagents-ts/core": patch
---

Add the React layer: `useAgentSession`, `useAgentRun`, `useAgentEvent` and
`useAgentRunSnapshot` subscribe to a live `AgentSession`, and `AgentRun` and
`AgentStep` render it as headless, class-named primitives with an override slot per step
kind. The core gains a `planning` lane in the session snapshot, so a run's planning steps
are readable while they stream.
