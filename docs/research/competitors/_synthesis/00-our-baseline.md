# The capability baseline — what this port ships today

**Contract**
- **Role:** the single home for our capability surface, so a competitor dive cites row ids instead of restating it.
- **Mutability:** rewritten when the surface changes; row ids never change.
- **Read when:** comparing a neighbour, pricing a gap, or asking whether we already have something.
- **Update when:** a capability lands, deepens or is removed.

**Measured:** 2026-10-21, against `main` at `59b295f`.
**Scope:** the published packages, their seams, the CLI, the React layers and the gate. Not the docs site's content and not the examples.
**Status vocabulary:** `mature` (implemented, hardened, tested beyond a smoke case), `implemented` (works end to end, pinned by a test), `minimal` (works in one narrow form, one implementation, no configuration), `seam-only` (a type or interface is exported and the loop calls it, but nothing ships behind it), `absent` (nothing).

Ids are stable: `RT` runtime, `MA` multi-agent, `HL` human-in-the-loop and durability, `GR` guardrails and structured output, `OB` observability and evaluation, `MD` models, `TL` tools, `EX` execution, `MC` MCP, `UI` React, `CL` CLI, `DS` distribution.

## RT — the runtime

| id | capability | status | evidence |
|---|---|---|---|
| RT-01 | code-as-action loop: the model writes a program, a sandbox runs it, the result returns as an observation | implemented | `packages/core/src/agent/multi-step-agent.ts:346`, `packages/core/src/agent/code-agent.ts` |
| RT-02 | tool-calling action, one JSON call per step | implemented | `packages/core/src/agent/tool-calling-agent.ts` |
| RT-03 | planning interval: a planning step every N action steps | implemented | `multi-step-agent.ts:412`, `:560` |
| RT-04 | model streaming folded into the run's events and usage | implemented | `multi-step-agent.ts:625` |
| RT-05 | incremental `code.delta` event while the code block streams | implemented | `multi-step-agent.ts:632` and `:682` emit per chunk; `code-agent.ts:58` reads complete lines inside the fence; `packages/core/test/core-loop-fixes.test.ts:338` pins the deltas. Note: T-30 still records this as never emitted, which the source contradicts (recorded in `_synthesis/30-findings-about-us.md`) |
| RT-06 | step budget with a typed `AgentMaxStepsError` | implemented | `multi-step-agent.ts` loop bound; T-18 records the divergence from upstream's ending |
| RT-07 | cancellation through `AbortSignal`, with `run.cancelled` | implemented | `multi-step-agent.ts:400-410` |
| RT-08 | middleware chain around each step | implemented | `packages/core/src/middleware.ts` |
| RT-09 | typed event stream for rendering a run as it happens | implemented | `packages/core/src/events.ts` |
| RT-10 | typed error taxonomy with a stable `AgentErrorInfo` | implemented | `packages/core/src/errors.ts` |
| RT-11 | token and timing monitor | implemented | `packages/core/src/monitoring/monitor.ts` |
| RT-12 | injectable logger | implemented | `packages/core/src/logger.ts` |
| RT-13 | `RunResult` carrying output, steps, messages and usage | implemented | `packages/core/src/agent/run-result.ts` |
| RT-14 | `AgentSession` snapshot for a UI, and its checkpoint across turns | implemented | `packages/core/src/session/agent-session.ts` |

## MA — multi-agent

| id | capability | status | evidence |
|---|---|---|---|
| MA-01 | managed agents: a child agent exposed to the model as a callable tool, with a prompt section of its own | implemented | `packages/core/src/agent/managed-agent.ts`, `multi-step-agent.ts:144-168` |
| MA-02 | handoffs: transferring control to another agent instead of calling it as a tool | absent | no transfer action in `interpret()` |
| MA-03 | structured child report (a typed result rather than a string) | minimal | `managed-agent.ts:53` declares `outputSchema: z.string()` |
| MA-04 | parallel or background subagents | absent | the child runs inline inside the tool call |
| MA-05 | shared state or blackboard between agents | absent | `RunContext.state` is per run and not exposed to a child |
| MA-06 | a supervisor or network topology shipped as code | absent | a caller composes managed agents by hand |
| MA-07 | nesting: a manager that is itself managed | minimal | works by composition; no test pins it |

## HL — human-in-the-loop and durability

| id | capability | status | evidence |
|---|---|---|---|
| HL-01 | approval gate before a tool call runs | implemented | `packages/core/src/agent/approval.ts`, `multi-step-agent.ts:154` |
| HL-02 | a pending approval as serialized state a UI or queue can carry | absent | a denial fails one call; nothing suspends |
| HL-03 | checkpoint a run's memory after each step | implemented | `packages/core/src/session/run-store.ts`, `multi-step-agent.ts:369-380` |
| HL-04 | resume a named run across processes | minimal | the seam exists; only `MemoryRunStore` ships |
| HL-05 | crash recovery inside a step (idempotent replay) | absent | a checkpoint lands between steps, so a mid-step crash replays the step |
| HL-06 | interrupt and resume with a human-supplied value | absent | no interrupt action |
| HL-07 | replay or time-travel from step N | absent | — |
| HL-08 | a conversation identity across runs | minimal | `AgentSession` keeps a checkpoint across turns; `AgentOptions.checkpoint` names one run |
| HL-09 | durable store implementations (file, SQLite, Redis) | absent | `MemoryRunStore` only |
| HL-10 | checkpoint schema versioning or migration | absent | steps serialize through `StepJSON` with no version field |

## GR — guardrails and structured output

| id | capability | status | evidence |
|---|---|---|---|
| GR-01 | input and output tripwires that halt the run with a typed reason | implemented | `packages/core/src/agent/guardrail.ts`, `multi-step-agent.ts:385`, `:693` |
| GR-02 | a schema-validated final answer | implemented | `multi-step-agent.ts:713` with a Zod `outputSchema` |
| GR-03 | guardrails evaluated in parallel, or during streaming | absent | both are awaited at one point in the loop |
| GR-04 | built-in safety, moderation or PII checks | absent | the seam is caller-supplied |
| GR-05 | provider-side structured output (JSON mode, response format) | seam-only | `ModelCapabilities.structuredOutput` exists; no adapter sets it and the loop never asks |
| GR-06 | schema-failure repair loop: re-prompt the model instead of failing | absent | a mismatch fails the run |

## OB — observability and evaluation

| id | capability | status | evidence |
|---|---|---|---|
| OB-01 | fold an event stream into one span tree | implemented | `packages/core/src/monitoring/trace.ts` |
| OB-02 | export spans to OpenTelemetry or a vendor | absent | `TraceSpan` is a local shape; no exporter, no context propagation |
| OB-03 | span attributes for model and tool calls, timing and usage | minimal | what `buildTrace` records |
| OB-04 | score a completed run against a fixture's expectations | implemented | `packages/core/src/monitoring/eval.ts` |
| OB-05 | datasets, scorers, LLM-as-judge, regression baselines | absent | one hand-written expectation shape |
| OB-06 | cost accounting from token usage and a price table | absent | usage only, no pricing |
| OB-07 | a pluggable event exporter or hook for a caller's own telemetry | minimal | listeners plus middleware; no exporter interface |

## MD — models

| id | capability | status | evidence |
|---|---|---|---|
| MD-01 | five adapters plus a function-defined model | implemented | `packages/models/src/index.ts` |
| MD-02 | streaming per adapter | implemented | `packages/models/src/sse.ts` and each adapter |
| MD-03 | tool calls, including streamed deltas | implemented | `packages/core/src/model.ts` `ToolCallAccumulator` |
| MD-04 | image or multimodal input | absent | `capabilities.images` is declared and unused |
| MD-05 | provider router, fallback, retry, rate limiting | absent | `packages/models/AGENTS.md` states the package owns no retry or budget policy |
| MD-06 | embeddings | absent | — |
| MD-07 | prompt caching and provider-specific options | absent | `GenerateOptions` carries temperature, max tokens and stop sequences only |
| MD-08 | local runtimes | minimal | reachable through the OpenAI-compatible adapter; no dedicated adapter |

## TL — tools

| id | capability | status | evidence |
|---|---|---|---|
| TL-01 | `tool()` with a Zod schema, JSON Schema for the model, runtime validation | implemented | `packages/core/src/tool/tool.ts` |
| TL-02 | registry and collection | implemented | `packages/core/src/tool/registry.ts`, `packages/tools/src/collection.ts` |
| TL-03 | default tools | minimal | three: search, webpage, user input |
| TL-04 | generator tools that yield intermediate output | absent | `execute` returns a value or a promise |
| TL-05 | per-tool timeout, retry or budget | absent | one run-wide `executionTimeoutMs` |
| TL-06 | dynamic tool selection or filtering per step | minimal | the registry is fixed per agent; a caller builds another |
| TL-07 | provider-hosted tools | absent | — |
| TL-08 | tool credentials and auth wiring | absent | a tool closes over what it needs |

## EX — execution

| id | capability | status | evidence |
|---|---|---|---|
| EX-01 | QuickJS-WASM executor, the default | mature | `packages/exec-quickjs/src/executor.ts` |
| EX-02 | Pyodide executor, in process | implemented | `packages/exec-pyodide/src/executor.ts` |
| EX-03 | remote executors: host process, Docker kernel, E2B sandbox | implemented | `packages/exec-remote/src/backends/` |
| EX-04 | a declared capability bag per executor | implemented | `packages/core/src/executor.ts` `ExecutorCapabilities` |
| EX-05 | a filesystem or shell workspace for the agent | absent | decision 0018 keeps it out |
| EX-06 | enforced network policy for guest code | minimal | the value is declared; the process backend reports `direct` because it cannot confine |
| EX-07 | guest state that persists across steps of one run | implemented | one executor instance per run, design decision D-21 |
| EX-08 | snapshot or restore of a live guest | absent | — |
| EX-09 | browser automation inside the sandbox | absent | — |

## MC — MCP

| id | capability | status | evidence |
|---|---|---|---|
| MC-01 | client with Streamable HTTP and stdio transports | implemented | `packages/mcp/src/client.ts`, `transports/` |
| MC-02 | a server's tools adapted to our tools | implemented | `packages/mcp/src/tool-adapter.ts` |
| MC-03 | resources, prompts and completions | absent | the client exposes tools and a raw `request` |
| MC-04 | sampling, elicitation and roots | absent | — |
| MC-05 | notifications | minimal | a bounded notification history exists |
| MC-06 | OAuth or any authentication flow | absent | a caller's transport supplies headers |
| MC-07 | MCP server authoring | absent | decision 0018 keeps it out |

## UI — React

| id | capability | status | evidence |
|---|---|---|---|
| UI-01 | L2 hooks over `AgentSession` | implemented | `packages/react/src/session.ts`, `use-agent-run.ts`, `use-agent-event.ts` |
| UI-02 | L3 headless primitives | implemented | `AgentRun`, `AgentStep`, `CodeBlock`, `ToolCall`, `FinalAnswer` |
| UI-03 | L4 patterns: run inspector and chat surface | implemented | `run-inspector.tsx`, `chat-surface.tsx` |
| UI-04 | L5 styled copy-in layer | implemented | `packages/react-ui/src` |
| UI-05 | character-by-character streaming render | minimal | the snapshot updates; leaf text is not rendered token by token |
| UI-06 | a chat transport protocol between server and client | absent | decision 0018 keeps it out |
| UI-07 | generative UI | absent | — |
| UI-08 | Markdown rendering of model output | minimal | code and text render as text |

## CL — CLI

| id | capability | status | evidence |
|---|---|---|---|
| CL-01 | upstream-shaped arguments and interactive setup | implemented | `packages/cli/src/args.ts`, `interactive.ts` |
| CL-02 | a verbosity-aware renderer for the event stream | implemented | `packages/cli/src/renderer.ts` |
| CL-03 | resume or approve from the terminal | absent | one run per invocation |
| CL-04 | MCP server configuration | absent | — |
| CL-05 | a REPL or multi-turn session | minimal | one task per process |

## DS — distribution and quality

| id | capability | status | evidence |
|---|---|---|---|
| DS-01 | eleven ESM packages, one facade, subpath entries | implemented | `packages/smolagents-ts` |
| DS-02 | eleven-stage gate, CI on three Node versions, runtime smoke on Node, Bun and Deno | mature | `package.json`, `.github/workflows/ci.yml` |
| DS-03 | pack smoke that installs the tarballs and imports them | implemented | `scripts/pack-smoke.mjs` |
| DS-04 | version identity generated from the manifests and checked | implemented | `scripts/sync-versions.mjs` |
| DS-05 | a published artifact on the registry | absent | 0.1.0 is unpublished; T-14 |
| DS-06 | documentation site built from this tree | implemented | `apps/docs-site` |
| DS-07 | runnable examples | implemented | six under `examples/` |
| DS-08 | a benchmark or performance harness | absent | — |

## Deliberate non-goals

Decision 0018 keeps these out of the library, and a competitor that ships one is recorded as bucket B unless a user asks and a seam can host it: RAG and vector stores, a dev UI or Studio, a streaming UI transport, multimodal input, voice and realtime, agent-to-agent protocol, MCP server authoring, a workspace sandbox with filesystem and shell, and deployment or hosting. Decision 0019 supersedes only 0018's sixth gap: provider routing and local runtimes are no longer listed as a roadmap phase.

## Open gaps already recorded elsewhere

Do not re-derive these; they are live rows in `docs/04-tasks.md`: T-14 unpublished release, T-16 planning cadence, T-18 max-steps ending, T-21 which upstream the parity recordings track, T-24 Pyodide interrupt, T-25 supply-chain posture, T-26 Gemini null usage, T-28 snapshot-to-chat-surface, T-29 `on()` overload, T-30 `code.delta`. Plus two known limits from the 2026-10-21 review: dockerode's `HostConfig` mapping is type-checked but not live-verified, and the two `checks.py` hardening items are unscheduled.

## Buckets and effort

A gap is bucketed `A` (roadmap follow-on behind a shipped seam), `B` (non-goal), `C` (unconsidered), `D` (depth gap in something we ship), or `E` (upstream parity, only for the upstream dive). Effort is `S`, `M`, `L` or `XL` as defined in the method. Every gap row names the baseline id it extends, so the backlog can be assembled without re-reading any dive.

## What would make this file wrong

Any change to a public seam, the event set, the executor contract, the model interface or the agent options. The dives are pinned to this revision; a later surface change invalidates the "our status" column, not the competitor evidence.
