# voltagent — architecture

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Layering

| layer | entry point | what it owns |
|---|---|---|
| composition root | `packages/core/src/voltagent.ts:33` | the `VoltAgent` object that holds agents, workflows, the server, MCP servers, A2A servers and the shared observability instance |
| agent runtime | `packages/core/src/agent/agent.ts:1013` | message preparation, model invocation, the step handler, hooks, guardrails, retries and fallbacks, delegation, memory writes |
| model loop | the Vercel AI SDK | `generateText` or `streamText` with `stopWhen: stepCountIs(maxSteps)`; tool execution and the step budget live here, not in this repository |
| tool layer | `packages/core/src/tool/index.ts:230` | tool definition, Zod schema, approval flag, hooks, lifecycle state |
| memory | `packages/core/src/memory/index.ts:76` | conversation and step persistence, working memory, semantic retrieval, workflow state |
| workflow engine | `packages/core/src/workflow/core.ts:384` | step loop, state, hooks, suspension, restart and replay |
| observability | `packages/core/src/observability/node/volt-agent-observability.ts:31` | an OpenTelemetry tracer provider, span processors, trace storage |
| HTTP | `packages/server-hono/src/routes/index.ts:86` | REST and stream endpoints over the registries |
| console | outside the tree | VoltOps, hosted or self-hosted, attaching over a websocket |

The agent runtime is the largest single artefact: `agent.ts` is 7,999 lines and holds at least a dozen concerns that would be separate classes elsewhere. Conversation assembly, streaming, retry and fallback, hooks, memory flushing, guardrail invocation, delegation and step metadata all live in that file.

## The delegation contract

A supervisor is not a separate type. It is an `Agent` whose options carry `subAgents`, and `SubAgentManager` adds a tool and rewrites the system message on the way in (`packages/core/src/agent/subagent/index.ts:55`).

```ts
new Agent({
  name: "supervisor",
  subAgents: [researchAgent, writerAgent],
});
```

What the manager injects:

| piece | where | effect |
|---|---|---|
| `delegate_task` tool | `packages/core/src/agent/subagent/index.ts:758` | a tool whose parameters are `targetAgents`, `task`, `context` and `action` (`packages/core/src/agent/subagent/index.ts:776`) |
| supervisor prompt | `packages/core/src/agent/subagent/index.ts:236` | `<specialized_agents>`, `<instructions>`, `<guidelines>`, `<agents_memory>` |
| step budget | `packages/core/src/agent/agent.ts:8015` | ten steps per subagent when the caller does not set one |
| handoff hooks | `packages/core/src/agent/hooks/index.ts:28` | `onHandoff` before, `onHandoffComplete` after |

### One delegation, end to end

1. The model emits a `delegate_task` call. The AI SDK has already been told the step budget (`packages/core/src/agent/agent.ts:1393`), so this call consumes one step.
2. The tool handler validates the target list and resolves each name through the manager (`packages/core/src/agent/subagent/index.ts:776`).
3. For each target it calls `handoffTask` (`packages/core/src/agent/subagent/index.ts:319`). A single-agent target receives `task`, `context` and `sharedContext`; a multi-agent target is fanned out through `handoffToMultiple` with `Promise.all` (`packages/core/src/agent/subagent/index.ts:741`).
4. The child is executed either by `streamText` with the child's own `maxSteps` (`packages/core/src/agent/subagent/index.ts:414`) or by the child's own `generateText` when the parent is not streaming.
5. The child's run is wrapped in its own span, with `parentSpan` carried from the supervisor (`packages/core/src/agent/open-telemetry/trace-context.ts:194`), so a delegated run appears under the supervisor trace.
6. `onHandoffComplete` runs (`packages/core/src/agent/subagent/index.ts:470`). A hook may return a transformed result, and a `bail()` call from that hook skips the remaining supervisor work and makes the child's output the answer (`packages/core/src/agent/subagent/index.ts:499`).
7. The tool returns an array of `{ agentName, response, usage, bailed }` objects (`packages/core/src/agent/subagent/index.ts:860`). The AI SDK serialises that array into the tool result message, and the supervisor sees it as JSON.
8. The supervisor continues its own loop with that JSON in context.

### How a failure propagates

This is the sharpest edge in the design. A child that throws does not throw into the supervisor. `handoffTask` catches the error, formats a string and returns it as the result (`packages/core/src/agent/subagent/index.ts:579`). The supervisor's tool result therefore contains text such as `Error in delegating task to writer: rate limited`, indistinguishable in shape from a successful result except by reading it.

The tool wrapper adds a second layer: if the manager itself throws, `delegate_task` returns `{ error, status: "error" }` as the tool output (`packages/core/src/agent/subagent/index.ts:875`). There is no error channel in the tool result, no typed failure value and no way for the caller to branch on the kind of failure. Recovery is entirely a language-model decision made by re-reading prose.

### How the supervisor sees progress

Progress is not polled and not pushed through a queue. Three mechanisms exist:

- **Stream forwarding.** While a child streams, its chunks can be re-emitted on the supervisor's stream with attribution metadata added (`packages/core/src/agent/subagent/index.ts:928`). The default is to forward only tool-call and tool-result events, so text deltas from a child stay invisible unless the caller opts in.
- **Prompt injection of history.** `prepareAgentsMemory` reads the children's persisted conversation steps and renders a summary into `<agents_memory>` when building the supervisor prompt (`packages/core/src/agent/agent.ts:5641`). This is the only durable view the supervisor has of earlier delegated work.
- **Hooks.** `onHandoff` and `onHandoffComplete` fire around each delegation (`packages/core/src/agent/hooks/index.ts:33`), which is where an application observes the boundary.

### Where state lives between them

| state | home | lifetime |
|---|---|---|
| the supervisor's conversation | `Memory` messages with an `operationId`, then the conversation buffer and persistence queue | the run, and beyond with a durable adapter |
| child conversation | the same store, tagged `parentAgentId`, `subAgentId` and `subAgentName` (`packages/core/src/memory/manager/memory-manager.ts:247`) | the run |
| what the supervisor reads back | filtered: only records whose `subAgentId` matches the delegating agent survive (`packages/core/src/memory/manager/memory-manager.ts:282`) | the run |
| `context` map | passed by value into `handoffTask` and the child's operation context | the delegation call |
| step results | the AI SDK's step array inside the supervisor's run | the run |
| bailed result | returned from `onHandoffComplete` and short-circuits the run | the run |

There is no shared mutable blackboard and no plan object. The supervisor's "plan" is whatever it has written into its own messages plus the tool calls it has made.

## PlanAgent: the second delegation model

`PlanAgent` extends `Agent` and ships a different contract (`packages/core/src/planagent/plan-agent.ts:934`). Its `write_todos` tool is a real plan artefact (`packages/core/src/planagent/planning/index.ts:14`), enforced by a hook that refuses other tools until a plan exists (`packages/core/src/planagent/plan-agent.ts:842`). Its `task` tool spawns short-lived workers that return one structured result and keep no conversation (`packages/core/src/planagent/plan-agent.ts:718`).

That gives the repository two delegation styles: a persistent supervisor with a conversation memory, and a planner with an explicit todo list and disposable workers. They share `SubAgentManager` but not their result contracts.

## The workflow engine

Workflows are built through a chain rather than declared as a graph. `createWorkflowChain` returns a typed builder whose data type grows with each step (`packages/core/src/workflow/chain.ts:1089`); `andThen`, `andAgent`, `andWhen`, `andAll`, `andRace`, `andForEach`, `andBranch`, `andDoWhile`, `andSleep`, `andGuardrail` and `andWorkflow` each return the chain again. The builder converts once to a `Workflow` (`packages/core/src/workflow/core.ts:384`).

A run is a loop over compiled steps. Each step receives `{ data, suspend, resumeData, bail, abort, getStepResult, getInitData, workflowState, setWorkflowState }` (`packages/core/src/workflow/context.ts:98`). Control flow is expressed by the step type rather than by edges: `WorkflowStepContext` carries a discriminated `stepType` union (`packages/core/src/workflow/context.ts:101`).

Suspension is first-class. A step calls `suspend(reason)`; the run stores its state and returns a result whose status is `suspended` (`packages/core/src/workflow/core.ts:963`). The returned execution object exposes `resume()`, and `resumeFrom` on the stored record decides where execution continues (`packages/core/src/workflow/core.ts:1027`). `createSuspendController` gives a step a signal plus `isSuspended`, `isCancelled` and `getReason` (`packages/core/src/workflow/suspend-controller.ts:25`).

Durability is delegated to memory. Workflow state is another table on the same `StorageAdapter` seam (`packages/core/src/memory/types.ts:477`), so a workflow survives only as far as the configured adapter does. Time travel replays a deterministic run from a chosen step under a new `executionId` while recording the lineage (`packages/core/src/workflow/core.ts:1124`). A restart of a `running` execution re-enters the checkpointed path rather than starting over (`website/docs/workflows/overview.md:646`).

Hooks exist at both levels: `onStart`, `onStepStart`, `onStepEnd`, `onSuspend`, `onError`, `onFinish` and `onEnd` on the workflow (`website/docs/workflows/overview.md:754`).

## Memory

`Memory` is a facade over three adapter contracts: a `StorageAdapter` for rows, an optional embedding adapter and an optional vector adapter (`packages/core/src/memory/index.ts:76`). Messages, conversations, conversation steps, working memory and workflow state are all tables on the storage interface, and the step and workflow tables are optional (`packages/core/src/memory/types.ts:449`), so a minimal adapter degrades by feature rather than by interface.

Reads and writes pass through `MemoryManager`, which is where the interesting policy lives: operation metadata stamping (`packages/core/src/memory/manager/memory-manager.ts:208`), delegation tagging and filtering (`packages/core/src/memory/manager/memory-manager.ts:282`), conversation context assembly (`packages/core/src/memory/manager/memory-manager.ts:564`) and semantic merge ordering (`packages/core/src/memory/manager/memory-manager.ts:978`).

Conversation persistence defaults to one save per step, and tool results can be flushed eagerly. Working memory is a Markdown block or a JSON document with a schema, scoped either to the conversation or to the user (`packages/core/src/memory/index.ts:698`). It is also exposed to the model as tools. Semantic retrieval is opt-in per call, with a limit and a threshold.

The default adapter is in-memory, and the default state is "memory is on". That is a deliberate ergonomic choice with a cost: a caller who never configures memory still accumulates state in process, and must pass `memory: false` to opt out.

## The tool lifecycle

A `Tool` is a name, description, Zod parameter schema, optional `execute`, optional `needsApproval` and optional hooks (`packages/core/src/tool/index.ts:126`). `createTool` is the factory (`packages/core/src/tool/index.ts:347`). A tool with no `execute` is marked client-side and is expected to be run by the caller's UI (`packages/core/src/tool/index.ts:310`).

Execution is owned by the AI SDK, not by this repository. VoltAgent supplies the tool map, wraps the callbacks for hooks and tracing, and translates the result back. Approval is implemented by refusing to execute and returning an approval-requested state; agent-level hooks can throw `ToolDeniedError` to stop the operation outright (`website/docs/agents/tools.md:814`). Tool-level hooks run inside the wrapper; agent-level hooks run for every tool (`website/docs/agents/tools.md:717`).

Registration is a manager plus a registry: `BaseToolManager` handles add and remove over a map (`packages/core/src/tool/manager/BaseToolManager.ts:73`), and MCP toolsets, agent tools and toolkit tools all land in the same shape.

## Observability

The tracer is an OpenTelemetry `NodeTracerProvider` wrapped in a class that also owns storage and processors (`packages/core/src/observability/node/volt-agent-observability.ts:31`). Spans are created through `AgentTraceContext`, a hierarchical handle with `createChildSpan` and `setUsage` (`packages/core/src/agent/open-telemetry/trace-context.ts:79`).

Span processors are the extension point: an in-memory store of 10,000 spans by default (`packages/core/src/observability/node/volt-agent-observability.ts:70`), a LibSQL store, a websocket processor that pushes live spans to the console, a filter processor and a lazy remote exporter that activates when OTLP credentials exist. The storage interface is small (`packages/core/src/observability/types.ts:269`), and the span shape is a simplified OpenTelemetry record (`packages/core/src/observability/types.ts:91`).

Because the provider is real OpenTelemetry, a caller can attach any OTel exporter; the repository ships Langfuse and Vercel AI SDK exporters as separate packages.

## The server

`server-core` holds provider-neutral handlers and schemas; `server-hono` mounts them on a Hono app (`packages/server-hono/src/routes/index.ts:86`). The surface is broad: agents and their history, chat streaming, workflows and executions, memory, tools, logs, observability traces and spans, triggers, A2A, and an MCP bridge. A VoltAgent instance starts the server when passed server options (`packages/core/src/voltagent.ts:58`), and serverless runtimes get an export path instead.

## Where the architecture costs most

- **One huge class.** The agent runtime cannot be read or changed locally; every feature is a branch inside `agent.ts`.
- **Delegation is stringly typed.** Failures are prose in a tool result, so the supervisor cannot distinguish a timeout from a refusal.
- **State is ambient.** Memory, operation ids, delegation tags and the conversation buffer all mutate around the model call, which makes a run's state hard to reconstruct from outside.
- **Two delegation models.** The supervisor path and the PlanAgent path share a manager but not a result contract, so a feature added to one does not reach the other.
