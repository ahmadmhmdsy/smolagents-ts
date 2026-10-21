# voltagent — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Status is `implemented` when the source path shows the behaviour, `declared` when only a docs page or a type asserts it, and `inferred` when the code shape implies it but the read did not follow the whole path. Citations are clone-relative.

## Supervisor and delegation

| capability | status | evidence | note |
|---|---|---|---|
| a supervisor is an agent with `subAgents` | implemented | `packages/core/src/agent/subagent/index.ts:96` | no separate supervisor type |
| generated `delegate_task` tool | implemented | `packages/core/src/agent/subagent/index.ts:758` | injected at agent construction |
| generated supervisor system prompt | implemented | `packages/core/src/agent/subagent/index.ts:236` | four sections, replaceable by an explicit `instructions` |
| single-target delegation | implemented | `packages/core/src/agent/subagent/index.ts:319` | returns result, messages and usage |
| multi-target parallel delegation | implemented | `packages/core/src/agent/subagent/index.ts:741` | one `Promise.all`, one shared conversation id |
| delegation result as structured array | implemented | `packages/core/src/agent/subagent/index.ts:860` | array of objects, but the object carries prose only |
| delegated failure as data | implemented | `packages/core/src/agent/subagent/index.ts:579` | failure becomes a formatted string |
| delegation error surfaced to the model | implemented | `packages/core/src/agent/subagent/index.ts:875` | a JSON error object in the tool result |
| bail out of the supervisor | implemented | `packages/core/src/agent/subagent/index.ts:499` | a handoff hook can end the run with the child's output |
| per-child step budget | implemented | `packages/core/src/agent/subagent/index.ts:220` | ten steps per child by default; caller may override |
| child run nested under the parent span | implemented | `packages/core/src/agent/subagent/index.ts:331` | `parentSpan` is threaded through |
| delegation-aware message tagging | implemented | `packages/core/src/memory/manager/memory-manager.ts:247` | `parentAgentId`, `subAgentId`, `subAgentName` |
| subagent turns kept out of the parent context | implemented | `packages/core/src/memory/manager/memory-manager.ts:282` | filter by `subAgentId` |
| subagents read the parent's memory section | declared | `website/docs/agents/subagents.md:564` | `<agents_memory>` rendered from conversation steps |
| subagent progress forwarded on the parent stream | implemented | `packages/core/src/agent/subagent/index.ts:928` | tool-call and tool-result events by default |
| subagent stream opt-in for text and reasoning | declared | `website/docs/agents/subagents.md:633` | per-subagent forwarding flags |
| recursive supervisors | inferred | `packages/core/src/agent/agent.ts:8319` | a subagent may itself carry subagents; no test read |

## Worker and planner models

| capability | status | evidence | note |
|---|---|---|---|
| PlanAgent with an explicit todo list | implemented | `packages/core/src/planagent/plan-agent.ts:934` | extends `Agent` |
| `write_todos` planning tool | implemented | `packages/core/src/planagent/planning/index.ts:14` | plan items persisted through a todo backend |
| planning enforced before other tools | implemented | `packages/core/src/planagent/plan-agent.ts:842` | a hook rejects other calls |
| short-lived `task` workers | implemented | `packages/core/src/planagent/plan-agent.ts:718` | one result, no conversation retained |
| conversation summarisation | declared | `website/docs/agents/plan-agent.md:216` | threshold-driven summary replaces history |
| tool-result eviction to files | declared | `website/docs/agents/plan-agent.md:244` | large tool outputs move to the workspace |
| filesystem and shell tools | declared | `website/docs/agents/plan-agent.md:130` | `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep` |
| workspace sandbox backends | declared | `website/docs/agents/plan-agent.md:154` | local and hosted providers |

## Memory

| capability | status | evidence | note |
|---|---|---|---|
| `Memory` facade over adapters | implemented | `packages/core/src/memory/index.ts:76` | storage plus optional embedding and vector |
| pluggable storage adapter | implemented | `packages/core/src/memory/types.ts:397` | one interface for five tables |
| in-memory default adapter | implemented | `packages/core/src/memory/adapters/storage/in-memory.ts:86` | no configuration needed |
| LibSQL, Postgres, Supabase, D1 adapters | implemented | `packages/core/src/memory/types.ts:397` | shipped as separate packages |
| hosted VoltOps memory adapter | declared | `website/docs/agents/memory/overview.md:267` | `@voltagent/voltagent-memory` package |
| per-step conversation persistence | implemented | `packages/core/src/memory/manager/memory-manager.ts:312` | default mode persists after each step |
| eager flush on tool result | declared | `website/docs/agents/memory/overview.md:78` | `flushOnToolResult` flag |
| whole-run persistence mode | declared | `website/docs/agents/memory/overview.md:82` | alternative to per-step |
| conversation steps as first-class rows | implemented | `packages/core/src/memory/types.ts:449` | optional table, feature-detected |
| working memory as Markdown | implemented | `packages/core/src/memory/index.ts:698` | template with placeholders |
| working memory as a JSON schema | implemented | `packages/core/src/memory/index.ts:717` | schema-guided update |
| working memory scope | implemented | `packages/core/src/memory/types.ts:457` | conversation or user |
| working-memory tools for the model | implemented | `packages/core/src/memory/index.ts:909` | get, update and clear |
| read-only working memory | declared | `website/docs/agents/memory/working-memory.md:94` | per-call getter only |
| semantic retrieval, opt-in | implemented | `packages/core/src/memory/index.ts:321` | limit and threshold per call |
| embedding adapters | declared | `website/docs/agents/memory/overview.md:145` | AI SDK embeddings, several vector stores |
| conversation listing and history API | implemented | `packages/core/src/memory/index.ts:242` | user-scoped listing |
| memory defaults applied per agent | implemented | `packages/core/src/memory/manager/memory-manager.ts:564` | global defaults merge under a per-agent config |
| semantic results merged into context | implemented | `packages/core/src/memory/manager/memory-manager.ts:978` | ordering and dedupe before the model sees them |
| workflow state on the same seam | implemented | `packages/core/src/memory/index.ts:1244` | suspend and resume read it back |

## Workflows

| capability | status | evidence | note |
|---|---|---|---|
| typed chain builder | implemented | `packages/core/src/workflow/chain.ts:1089` | data type grows per step |
| runnable workflow from a chain | implemented | `packages/core/src/workflow/core.ts:384` | `.toWorkflow()` |
| sequential step with data merge | implemented | `packages/core/src/workflow/steps/and-then.ts:31` | prior data plus the step's return |
| agent step | implemented | `packages/core/src/workflow/steps/and-agent.ts:69` | runs an agent as a step |
| conditional step | implemented | `packages/core/src/workflow/steps/and-when.ts:33` | predicate plus two branches |
| parallel fan-out | implemented | `packages/core/src/workflow/steps/and-all.ts:59` | all steps, merged result |
| race | implemented | `packages/core/src/workflow/steps/and-race.ts:56` | first completed wins |
| for-each | implemented | `packages/core/src/workflow/steps/and-foreach.ts:11` | per-item step |
| branching | implemented | `packages/core/src/workflow/steps/and-branch.ts:10` | named branches |
| do-while and do-until | implemented | `packages/core/src/workflow/steps/and-loop.ts:146` | loop bodies as steps |
| sleep and sleep-until | implemented | `packages/core/src/workflow/steps/and-sleep.ts:17` | duration and absolute time |
| nested workflow | implemented | `packages/core/src/workflow/steps/and-workflow.ts:36` | workflow as a step |
| tap step | implemented | `packages/core/src/workflow/steps/and-tap.ts:32` | side effect, data unchanged |
| guardrail step | implemented | `packages/core/src/workflow/steps/and-guardrail.ts:16` | gate inside a chain |
| map step | implemented | `packages/core/src/workflow/steps/and-map.ts:79` | transform without a model |
| step context helpers | implemented | `packages/core/src/workflow/context.ts:98` | bail, abort, step results, init data |
| workflow-level state | implemented | `packages/core/src/workflow/context.ts:12` | mutable `workflowState` |
| suspension | implemented | `packages/core/src/workflow/core.ts:963` | status `suspended` plus a resume handle |
| resume after suspension | implemented | `packages/core/src/workflow/core.ts:1027` | `resumeFrom` from stored state |
| suspend controller | implemented | `packages/core/src/workflow/suspend-controller.ts:25` | signal plus predicate helpers |
| retry configuration | declared | `website/docs/workflows/overview.md:490` | attempts and delay, inherited per step |
| restart a running execution | declared | `website/docs/workflows/overview.md:646` | checkpointed replay |
| time travel from a step | implemented | `packages/core/src/workflow/core.ts:1124` | new execution id, lineage recorded |
| workflow hooks | declared | `website/docs/workflows/overview.md:754` | start, step start, step end, suspend, error, finish, end |
| workflow state persisted through memory | implemented | `packages/core/src/memory/types.ts:477` | optional table |
| external triggers | declared | `website/docs/triggers.md:7` | Slack, Gmail, Calendar, Drive, Airtable, GitHub, cron |
| trigger definitions shipped in core | implemented | `packages/core/src/triggers/types.ts:21` | catalog data only; execution is remote |

## Tools

| capability | status | evidence | note |
|---|---|---|---|
| Zod-schema tool with an executor | implemented | `packages/core/src/tool/index.ts:347` | `createTool` |
| client-side tool without an executor | implemented | `packages/core/src/tool/index.ts:310` | resolved by the UI |
| tool approval flag | implemented | `packages/core/src/tool/index.ts:164` | boolean or predicate |
| approval as a stream state | declared | `website/docs/agents/tools.md:489` | `approval-requested` then execute or deny |
| per-tool hooks | implemented | `packages/core/src/tool/index.ts:224` | start, end, error |
| agent-wide tool hooks | implemented | `packages/core/src/agent/hooks/index.ts:54` | can deny with `ToolDeniedError` |
| dynamic toolsets from MCP | implemented | `packages/core/src/mcp/registry/index.ts:242` | per-server toolsets |
| streaming preliminary tool results | declared | `website/docs/agents/tools.md:82` | generator-style partial output |
| tool tags for policy | declared | `website/docs/agents/tools.md:134` | read by hooks for access control |
| provider-specific tool options | declared | `website/docs/agents/tools.md:190` | passed through to the model |
| registry add and remove | implemented | `packages/core/src/tool/manager/BaseToolManager.ts:73` | map-backed manager |

## Guardrails

| capability | status | evidence | note |
|---|---|---|---|
| input guardrail factory | implemented | `packages/core/src/agent/guardrail.ts:69` | handler plus stream handler |
| output guardrail factory | implemented | `packages/core/src/agent/guardrail.ts:83` | final output and per chunk |
| allow, modify and block actions | declared | `website/docs/guardrails/overview.md:60` | `pass: false` infers block |
| typed abort from a stream handler | declared | `website/docs/guardrails/overview.md:117` | `abort(reason)` stops the run |
| guardrail state shared across handlers | implemented | `packages/core/src/agent/guardrail.ts:287` | mutable state bag |
| input guardrails run before the model | implemented | `packages/core/src/agent/guardrail.ts:287` | sequential within the call path |
| output guardrails run on the result | implemented | `packages/core/src/agent/guardrail.ts:435` | final and stream variants |
| streaming guardrail pipeline | implemented | `packages/core/src/agent/streaming/guardrail-stream.ts:93` | chunk buffer with hold-back |
| built-in PII and safety guardrails | implemented | `packages/core/src/agent/guardrails/defaults.ts:793` | sensitive numbers, email, phone, profanity, length, injection, HTML |
| default guardrail sets | implemented | `packages/core/src/agent/guardrails/defaults.ts:793` | input safety, PII and output safety helpers, the last at `packages/core/src/agent/guardrails/defaults.ts:820` |
| guardrails usable as a workflow step | declared | `website/docs/guardrails/overview.md:28` | `andGuardrail` |

## Observability

| capability | status | evidence | note |
|---|---|---|---|
| OpenTelemetry tracer provider | implemented | `packages/core/src/observability/node/volt-agent-observability.ts:31` | real OTel API |
| span tree per agent run | implemented | `packages/core/src/agent/open-telemetry/trace-context.ts:79` | agent, llm, tool, memory, workflow children |
| usage attributes on spans | implemented | `packages/core/src/agent/open-telemetry/trace-context.ts:344` | tokens and model |
| in-memory span store | implemented | `packages/core/src/observability/adapters/in-memory-adapter.ts:19` | 10,000 spans by default |
| LibSQL span store | implemented | `packages/libsql/src/observability-adapter.ts:41` | same storage seam |
| pluggable span processors | implemented | `packages/core/src/observability/node/volt-agent-observability.ts:85` | filter, websocket, remote |
| websocket push to the console | implemented | `packages/core/src/observability/node/volt-agent-observability.ts:25` | live span stream to the console |
| OTLP export to VoltOps | declared | `website/docs/observability/developer-console.md:110` | auto-configured when keys exist |
| Langfuse exporter package | implemented | `packages/langfuse-exporter/src/index.ts:1` | separate package |
| Vercel AI SDK exporter package | implemented | `packages/vercel-ai-exporter/src/index.ts:1` | separate package |
| trace-shaped evaluation payloads | implemented | `packages/core/src/agent/eval.ts:1005` | built from spans and steps |
| built-in scorer set | implemented | `packages/scorers/src/index.ts:14` | separate `scorers` package |
| console stores nothing in localhost mode | declared | `website/docs/observability/developer-console.md:53` | remote keys enable VoltOps |

## MCP

| capability | status | evidence | note |
|---|---|---|---|
| client over the official SDK | implemented | `packages/core/src/mcp/client/index.ts:46` | wraps `@modelcontextprotocol/sdk` |
| streamable HTTP transport | implemented | `packages/core/src/mcp/client/index.ts:172` | with SSE fallback |
| SSE transport | implemented | `packages/core/src/mcp/client/index.ts:166` | legacy servers |
| stdio transport | implemented | `packages/core/src/mcp/client/index.ts:178` | child process |
| tool discovery and adaptation | implemented | `packages/core/src/mcp/registry/index.ts:101` | MCP tools become normal tools |
| toolsets per server | implemented | `packages/core/src/mcp/registry/index.ts:242` | selectable at agent construction |
| elicitation bridge | implemented | `packages/core/src/mcp/client/index.ts:104` | handler registry, unhandled requests cancelled |
| capability declaration | implemented | `packages/core/src/mcp/client/index.ts:137` | elicitation always advertised |
| connection lifecycle events | declared | `website/docs/agents/mcp/mcp.md:227` | connect, disconnect, error, tool call |
| MCP server authoring | declared | `packages/mcp-server/src/index.ts:1` | separate package, not core |
| OAuth for remote MCP servers | inferred | `packages/core/src/mcp/client/index.ts:160` | transport headers only in the read path |

## Server and API

| capability | status | evidence | note |
|---|---|---|---|
| provider-neutral handlers | implemented | `packages/server-core/src/index.ts:2` | schemas plus business logic |
| Hono server | implemented | `packages/server-hono/src/routes/index.ts:86` | agent and workflow REST |
| chat streaming endpoint | declared | `website/docs/agents/overview.md:303` | AI SDK `useChat` compatible |
| workflow execution history | implemented | `packages/server-hono/src/routes/index.ts:311` | list and per-execution state |
| observability endpoints | implemented | `packages/server-hono/src/routes/observability.ts:47` | traces, spans, status |
| agent history endpoint | implemented | `packages/server-hono/src/routes/index.ts:207` | paginated conversation read |
| OpenAPI and Swagger UI | declared | `website/docs/api/api-reference.md:23` | served at `/ui` |
| A2A server | declared | `packages/a2a-server/src/index.ts:1` | separate package |
| resumable streams | implemented | `packages/resumable-streams/src/index.ts:14` | Redis, generic and VoltOps stores |

## Providers and runtime

| capability | status | evidence | note |
|---|---|---|---|
| models via AI SDK instances | implemented | `packages/core/src/agent/agent.ts:5865` | `model` is an AI SDK model or a string |
| retry and fallback wrapper | implemented | `packages/core/src/agent/agent.ts:6048` | own retry with hooks |
| streaming through `fullStream` | implemented | `packages/core/src/agent/agent.ts:701` | events forwarded to the caller |
| serverless entry | implemented | `packages/core/src/observability/index.ts:42` | serverless config points the exporter at an OTLP collector |
| provider packages are deprecation notices | implemented | `packages/anthropic-ai/DEPRECATED.md:1` | the Anthropic, Google and Groq shims now point at the AI SDK |

## Durability and human-in-the-loop

| capability | status | evidence | note |
|---|---|---|---|
| tool approval before execution | implemented | `packages/core/src/tool/index.ts:164` | predicate support |
| approval state carried to a UI | declared | `website/docs/agents/tools.md:489` | part of the message stream |
| workflow suspension as durable state | implemented | `packages/core/src/workflow/core.ts:963` | state written before returning |
| resume with caller-supplied data | implemented | `packages/core/src/workflow/core.ts:1027` | typed `resumeSchema` |
| replay from a step | implemented | `packages/core/src/workflow/core.ts:1124` | deterministic replay, new id |
| agent-run resume across processes | declared | `packages/resumable-streams/src/index.ts:14` | stream resumption, not run resumption |
| durable stores beyond in-memory | implemented | `packages/libsql/src/index.ts:2` | four database adapters |

## Notes on the status calls

`declared` is used where the docs describe a behaviour whose implementation path was not followed: the PlanAgent workspace tools, the resume and restart semantics of workflows, approval UI flow, the resumable stream stores and the console features. `inferred` marks claims where the source shape implies the behaviour but no test or full path was read: recursive supervisors and remote MCP authentication.

No capability in this inventory was executed. A status of `implemented` means the code path exists and was read, not that it runs.