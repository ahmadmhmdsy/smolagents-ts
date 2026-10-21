# strands-agents/harness-sdk — gap analysis and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## How a row reads

Buckets follow the baseline (`docs/research/competitors/_synthesis/00-our-baseline.md`):
A extends a seam we already ship, B is decision 0018, C is outside our vocabulary, D is a
depth gap in something we have, E is reserved for an upstream port and does not apply to a
sibling SDK. Matching states what a parity implementation would have to reproduce at the seam
we own, not an invitation to copy their API. Fit names the file the change would land in.
Prices are S (a day or less), M (two to three days), L (a week or more), XL (needs a product
decision first).

## A — roadmap follow-ons

| id | gap | matching means | fit | price |
|---|---|---|---|---|
| RT-06 | A run budget with typed exit reasons instead of a step ceiling | Every turn and every model call counts against optional turn, output-token and total-token limits, checked before a turn so the previous turn's tools still finish; reaching one ends the run with `limitTurns`, `limitTotalTokens` or `limitOutputTokens` in priority order (`strands-ts/src/types/agent.ts:143-191`, `strands-ts/src/agent/agent.ts:1708-1712`) | loop bound in `packages/core/src/agent/multi-step-agent.ts` and `RunResult` | M |
| RT-13 | A continuation handle on the result | `AgentResult.invocationContext` is live usage plus limits, and passing it to a later call continues the same budget, including work that finished after the call returned (`strands-ts/src/types/agent.ts:471-480`) | `packages/core/src/agent/run-result.ts` | M |
| HL-03 | Pause points inside a run that resume by value | Checkpointing pauses after the model or after tools with a serializable position and cycle index, returns `stopReason: 'checkpoint'`, and resumes from the passed checkpoint while never re-running completed tools (`strands-ts/src/experimental/checkpoint.ts:12-41`) | `packages/core/src/session/run-store.ts` and the loop | L |
| HL-05 | Crash recovery at a tool boundary | The pair of a checkpoint and a session snapshot gives a restart position with no duplicated tool side effects; their doc is explicit that only `afterTools` is the deterministic boundary (`strands-ts/src/experimental/checkpoint.ts:36-41`) | run store plus loop | L |
| HL-06 | Interrupt a run and resume with a human value | A tool or hook raises an interrupt, the run stops with `stopReason: 'interrupt'` and an interrupt list, and the next invocation answers it by id (`strands-ts/src/interrupt.ts:4-23`, `strands-ts/src/agent/agent.ts:1999-2012`) | `packages/core/src/agent/approval.ts` and the loop | L |
| HL-02 | Pending approval carried in serialized state | Interrupts are a snapshot field (`strands-ts/src/agent/snapshot.ts:22`), so an unanswered approval survives a process and a UI can render it without parsing messages | snapshot type in `packages/core/src/session` | L |
| HL-10 | A snapshot schema with a version and a scope | One snapshot type carries `schemaVersion`, `scope` and a separate app-owned payload, and the agent and orchestrator paths share it (`strands-ts/src/types/snapshot.ts:10-31`) | `packages/core/src/session/agent-session.ts` | S |
| HL-04, HL-09 | Real durable stores behind the run store seam | In-memory, local file and S3 implementations sit behind a namespaced storage interface with ephemeral and durable views (`strands-ts/src/storage/`, `strands-ts/src/session/`) | `packages/core/src/session/run-store.ts` | M |
| MD-05 | Retry, backoff and a router above providers | A retry strategy classifies failures and returns a decision the loop applies through the after-model hook; a router selects among candidates and fails over per round (`strands-ts/src/retry/default-model-retry-strategy.ts:1-19`, `strands-ts/src/models/routing/router.ts:1-23`). Decision 0019 reopened this space | `packages/models` plus a hook seam | L |
| OB-02 | OpenTelemetry export with span trees | A tracer and a meter over the global OTel API, an OTLP exporter option, and a local trace tree that is always collected (`strands-ts/src/telemetry/tracer.ts:1-13`, `strands-ts/src/telemetry/config.ts:39-40`) | `packages/core/src/monitoring/trace.ts` plus an exporter seam | M |
| TL-04 | Generator tools that report progress | A tool is an async generator yielding progress events and returning one result, surfaced as `ToolStreamUpdateEvent` and usable outside a turn through the direct invocation proxy (`strands-ts/src/tools/tool.ts:96-163`, `strands-ts/src/agent/agent.ts:1065-1078`) | `packages/core/src/tool/tool.ts` | M |
| TL-06 | Replacing or cancelling a tool call from a hook | `BeforeToolCallEvent` exposes `cancel` and `selectedTool`, and the tool use itself is mutable before execution (`strands-ts/src/hooks/events.ts:274-290`) | the middleware chain and tool registry | S |
| MA-04 | Background subagents | A task manager queues tool calls selected by the model, caps concurrency and feeds results into a later turn (`strands-ts/src/background-tasks/types.ts:8-20`) | child-agent execution in `packages/core/src/agent/managed-agent.ts` | L |
| GR-06 | Repairing a structured-output mismatch instead of failing | The hidden structured-output tool returns its validation error as a tool result, so the model sees the failure and retries until a forced tool call validates (`strands-ts/src/agent/agent.ts:1778-1790`) | `packages/core/src/agent/multi-step-agent.ts:713` | S |

## B — non-goals

| id | what they ship | why it stays out | decision |
|---|---|---|---|
| EX-05 | A sandbox shared by tools: Docker, SSH, local POSIX shell, with a common abstract interface (`strands-ts/src/sandbox/base.ts:42`) | A workspace with a filesystem and shell is the non-goal our executors deliberately replace | 0018 |
| MA-03 | An A2A agent proxy and an Express server exposing it (`strands-ts/src/a2a/`) | Agent-to-agent protocol and server authoring are deployment concerns | 0018 |
| — | An MCP server that serves the documentation to coding agents (`strands-mcp/`) | A developer-relations artifact, not a library seam | 0018 |
| CM-01, CM-04 | Context offloading and a memory store backed by Bedrock knowledge bases | RAG and vector retrieval stay out; a caller can assemble this from tools | 0018 |
| PK-05 | A documentation site built from the monorepo | We build our own site from this tree; theirs is not evidence about the library | 0018 |

## C — unconsidered

| id | pattern | why it matters | fit | price |
|---|---|---|---|---|
| C-01 | Compaction as a first-class stage | A conversation manager plus named offload presets keep a long run inside the window, with the preset name as the stable contract and its expansion private (`strands-ts/src/context-manager/presets.ts:1-31`) | a new seam between history and model call | L |
| C-02 | Model-driven compaction with retrieval tools | The agent is given tools to compress its own history and to fetch what it dropped, with auxiliary calls counted in the same budget (`strands-ts/src/context-manager/modes/agentic/agentic-context.ts:1-5`) | the context stage | XL |
| C-03 | Durable memory as a plugin | Messages are mined for durable facts, injected later, and exposed as add and search tools, all without the loop knowing (`strands-ts/src/memory/memory-manager.ts:1-26`) | a plugin seam we do not have | L |
| C-04 | A policy engine over tool calls | Cedar, HITL and steering are intervention handlers with proceed, deny, guide, confirm and transform, and a throwing handler fails closed by default (`strands-ts/src/interventions/handler.ts:12-66`) | a policy layer around the tool executor | L |
| C-05 | Provider state as a separate channel | `stateful` models keep the conversation remotely and the SDK sends only the newest message; `modelState` carries the handle through snapshots (`strands-ts/src/models/model.ts:335-349`) | a third state kind beside run state and session state | M |
| C-06 | Counting tokens before spending them | A pre-call count, with native provider APIs behind a heuristic default, is what makes proactive compression possible (`strands-ts/src/models/model.ts:361-370`) | the model contract | S |

## D — depth gaps

| id | we ship | they ship | fit | price |
|---|---|---|---|---|
| RT-07 | One `AbortSignal` and a `run.cancelled` flag | Cancellation is checked at four named points, a cancel before tools synthesises error results for every pending call, and a cancelled run still leaves valid history (`strands-ts/src/agent/agent.ts:1811-1839`, `:1977-1997`) | the loop | S |
| RT-08 | A middleware array around each step | Three typed stages with input, output and wrap phases, first-registered outermost, hooks deliberately outside the chain (`strands-ts/src/middleware/README.md:3-45`) | `packages/core/src/middleware.ts` | M |
| RT-09 | A typed event stream for rendering | The same union is the subscription bus, so observers and renderers share one taxonomy, with 17 event classes and reverse ordering for `After*` events (`strands-ts/src/hooks/index.ts:1-34`) | `packages/core/src/events.ts` | M |
| RT-13 | Output, steps, messages, usage | Adds stop reason, traces, metrics, structured output, interrupt list, checkpoint and a continuation handle to one result type (`strands-ts/src/types/agent.ts:440-514`) | `packages/core/src/agent/run-result.ts` | M |
| RT-14 | An `AgentSession` checkpoint kept in memory | Mutable latest snapshot plus append-only immutable snapshots, selectable fields, and a save cadence per invocation, message or trigger (`strands-ts/src/session/session-manager.ts:29-60`) | `packages/core/src/session/agent-session.ts` | M |
| TL-02 | A fixed registry | Lookup normalises case and underscores before failing, which is what makes near-miss model output recoverable (`strands-ts/src/registry/tool-registry.ts:73`) | tool registry | S |
| MD-01 | Five adapters and a function model | A six-operation base with server-side state, token counting and a usage-accounting gate shared by every call (`strands-ts/src/models/model.ts:312-370`) | `packages/core/src/model.ts` | M |

## What we have that they lack

- A code-as-action loop. Their agent is tool-calling only; code execution arrives as vended
  tools (Python REPL, notebook, shell) over a sandbox, not as the action the model writes. Our
  RT-01 with QuickJS, Pyodide and remote executors is a different product surface, not a gap.
- A React rendering layer (`UI-01` to `UI-05`). They ship a CLI TUI and a docs site, no hooks or
  headless primitives for a host application.
- A single typed error taxonomy. Their stop reasons are rich, but a failed run and a failed tool
  are ordinary `Error` subclasses, while we carry `AgentErrorInfo` on every failure.
- A step ceiling that fails loudly. Our `AgentMaxStepsError` is a typed terminal state; theirs is
  a budget that returns a reason and can be continued, which is the better shape for a server
  but the worse shape for a one-shot script.

## Patterns worth copying

- Let the request own the budget. A limit is not an agent option; it is a property of one call
  that nested calls inherit and that a continuation carries (`strands-ts/src/types/agent.ts:143-171`).
- Give every ending a name. A closed stop-reason union, with the open `string & {}` escape hatch
  for unknown provider values, beats an exception for the normal exits (`strands-ts/src/types/messages.ts:710-726`).
- Keep hooks outside middleware. Their README's rule is that a short-circuit still fires the hook
  pair and a retry does not multiply it, which keeps telemetry honest (`strands-ts/src/middleware/README.md:3-13`).
- Split state by lifetime, then say so in the type. Durable app state, ephemeral invocation state
  and provider model state each have an owner and a copy rule (`strands-ts/src/tools/tool.ts:27-36`).
- Version stored state with a scope and an untouched app payload before shipping a second store
  (`strands-ts/src/types/snapshot.ts:10-31`).
- Treat concurrency as an executor strategy, not a boolean, and pin per-tool event order inside it
  (`strands-ts/src/tools/executors/concurrent.ts:29-33`).
- Write the divergence down where the code lives. The graph file's comparison section and the
  sandbox's "TypeScript oracle" note are cheap and they stop a reader guessing (`strands-ts/src/multiagent/graph.ts:114-128`, `strands-py/src/strands/sandbox/base.py:7-22`).

## Patterns to avoid

- Five overlapping extension mechanisms (hooks, middleware, interventions, plugins, lifecycle
  observers) grew one at a time; the middleware README itself records that one is meant to
  replace another eventually (`strands-ts/src/middleware/README.md:17-22`). Decide the layering
  before shipping the second mechanism.
- A 2,912-line loop module that owns budgets, checkpoints, interrupts, structured output,
  telemetry and plugin lifecycle is hard to change safely even with a complexity gate
  (`strands-ts/src/agent/agent.ts`). Extract policy before it doubles.
- Experimental features ship inside the stable package behind `@experimental` tags
  (`strands-ts/src/experimental/checkpoint.ts:1-5`, `strands-ts/src/context-manager/presets.ts:9`).
  Consumers do not read tags; a separate entry point is cheaper than a broken promise.
- A cross-language product list in the README drifts from per-language reality: evals are
  advertised for both SDKs and exist only in Python (`README.md:39`, inferred from the tree).
- The deferred-append decision buys reinvokable history and silently changes checkpoint resume
  semantics, forcing a re-invocation of the model at `afterModel` (`strands-ts/src/experimental/checkpoint.ts:34-41`).
  Two features coupled through message ordering is a bug generator; write the invariant as a test.

## What it should change for us

- Replace the step ceiling with request-scoped limits and limit stop reasons, keeping
  `AgentMaxStepsError` as the default policy for callers who want a hard failure (RT-06, T-18).
- Extend `RunResult` with a stop reason and a continuation handle before adding any durable
  session store, so the session has a reason to exist (RT-13, HL-04).
- Formalise the middleware phases we already have and document the ordering rule; fire listeners
  outside the chain so a short-circuit cannot hide a step (RT-08).
- Add the structured-output repair path first: it is one tool and one forced choice in their
  design, and it converts a class of run failures into a retry (GR-06).
- Move `RunContext.state` to an explicit lifetime split before exposing state to a child agent
  (HL-10, C-05).
- Do not build a sandbox workspace or an A2A server to match their feature list; both are
  decision 0018 non-goals and neither is what makes their loop good.
