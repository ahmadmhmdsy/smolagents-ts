# voltagent — gaps and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Bucket `A` is a roadmap follow-on behind a shipped seam, `B` a deliberate non-goal, `C` something we have not considered, and `D` a depth gap in something we ship. Effort is `S` (a day), `M` (a week), `L` (a month) and `XL` (a season), as the method defines. Every row names the baseline id it extends from `docs/research/competitors/_synthesis/00-our-baseline.md:38`.

## A — roadmap follow-ons

| id | gap | our baseline | their evidence | seam | effort |
|---|---|---|---|---|---|
| VA-A1 | a child report is a string, so a supervisor cannot branch on the outcome | MA-03 minimal | `packages/core/src/agent/subagent/index.ts:860` returns objects, yet the payload is prose | `packages/core/src/agent/managed-agent.ts:15` | M |
| VA-A2 | no parallel or background child runs | MA-04 absent | `packages/core/src/agent/subagent/index.ts:741` fans targets out with one `Promise.all` | `packages/core/src/agent/managed-agent.ts:15` | M |
| VA-A3 | a child cannot see the caller's run context | MA-05 absent | `packages/core/src/agent/subagent/index.ts:329` passes a `context` map per call | `packages/core/src/agent/managed-agent.ts:15` | S |
| VA-A4 | a supervisor topology exists only if the caller writes it | MA-06 absent | `packages/core/src/agent/subagent/index.ts:96` installs subagents and rewrites the prompt | `packages/core/src/agent/managed-agent.ts:15` | L |
| VA-A5 | a pending approval cannot outlive the call | HL-02 absent | `packages/core/src/tool/index.ts:164` declares `needsApproval` as a predicate; the message stream carries the pending state | `packages/core/src/agent/approval.ts:4` | M |
| VA-A6 | an interruption cannot resume with a caller-supplied value | HL-06 absent | `packages/core/src/workflow/core.ts:1027` resumes from stored state with typed resume data | `packages/core/src/session/run-store.ts:4` | L |
| VA-A7 | no replay from step N | HL-07 absent | `packages/core/src/workflow/core.ts:1124` replays deterministically under a new execution id | `packages/core/src/session/run-store.ts:4` | L |
| VA-A8 | one durable store only | HL-09 absent | `packages/libsql/src/index.ts:2` plus Postgres, Supabase and D1 adapters | `packages/core/src/session/run-store.ts:4` | XL |
| VA-A9 | no exporter, no context propagation | OB-02 absent | `packages/core/src/observability/node/volt-agent-observability.ts:31` wraps a real OTel provider | `packages/core/src/monitoring/trace.ts:4` | L |
| VA-A10 | no exporter hook | OB-07 minimal | `packages/core/src/observability/node/volt-agent-observability.ts:85` accepts span processors | `packages/core/src/monitoring/trace.ts:4` | S |
| VA-A11 | guardrails are awaited at one point, not streamed | GR-03 absent | `packages/core/src/agent/streaming/guardrail-stream.ts:93` holds back chunks while scanning | `packages/core/src/agent/guardrail.ts:4` | M |
| VA-A12 | no built-in safety checks | GR-04 absent | `packages/core/src/agent/guardrails/defaults.ts:99` onward, ten shipped guardrails | `packages/core/src/agent/guardrail.ts:4` | M |
| VA-A13 | tool output is all-or-nothing | TL-04 absent | `website/docs/agents/tools.md:82` documents streamed preliminary results | `packages/core/src/tool/tool.ts:5` | M |
| VA-A14 | a tool cannot declare an approval predicate | HL-01 implemented | `packages/core/src/tool/index.ts:164` allows a function of the arguments | `packages/core/src/agent/approval.ts:4` | S |
| VA-A15 | nesting a manager inside a manager is unpinned | MA-07 minimal | `packages/core/src/agent/agent.ts:8319` lets any agent carry subagents | `packages/core/src/agent/managed-agent.ts:15` | S |

## B — non-goals

| id | their capability | why it stays out | our decision |
|---|---|---|---|
| VA-B1 | HTTP server, OpenAPI, console | deployment and hosting | 0018 |
| VA-B2 | RAG package and vector stores | retrieval product | 0018 |
| VA-B3 | MCP server authoring (`packages/mcp-server/src/index.ts:1`) | server-side MCP | 0018 |
| VA-B4 | A2A and AG-UI servers | agent-to-agent protocol | 0018 |
| VA-B5 | workspace with filesystem and shell (`website/docs/agents/plan-agent.md:130`) | sandbox workspace | 0018 |
| VA-B6 | chat transport and resumable streams | streaming UI transport | 0018 |
| VA-B7 | voice providers | voice and realtime | 0018 |
| VA-B8 | hosted sandbox packages | execution hosting | 0018 |

## C — unconsidered

| id | observation | their evidence | what it suggests |
|---|---|---|---|
| VA-C1 | attribution is attached to the stream and to the memory row, so a UI can tell which child produced which token | `packages/core/src/agent/subagent/index.ts:928` | add optional `agentPath` to our events |
| VA-C2 | child turns are filtered out of the parent's context on read | `packages/core/src/memory/manager/memory-manager.ts:282` | a memory read policy, not just a store |
| VA-C3 | working memory is both a rendered prompt block and model-facing tools | `packages/core/src/memory/index.ts:909` | memory as tools, not only context |
| VA-C4 | the step budget is derived from the topology | `packages/core/src/agent/subagent/index.ts:220` | a policy hook instead of a fixed number |
| VA-C5 | guardrail state is shared between the input and output handlers | `website/docs/guardrails/overview.md:84` | a state bag per run |
| VA-C6 | evaluation payloads are built from spans | `packages/core/src/agent/eval.ts:1005` | scoring can reuse the trace |
| VA-C7 | trigger definitions ship as data, execution is remote | `packages/core/src/triggers/types.ts:21` | a catalog without a runtime |

## D — depth gaps

| id | we ship | where their depth exceeds ours | our seam | effort |
|---|---|---|---|---|
| VA-D1 | a managed agent with its own prompt section (MA-01) | generated prompt with a memory section and fixed guidelines | `packages/core/src/agent/managed-agent.ts:15` | S |
| VA-D2 | a span tree (OB-01) | usage, model and tool attributes on every span | `packages/core/src/monitoring/trace.ts:4` | S |
| VA-D3 | a tool definition (TL-01) | start, end and error hooks per tool and per agent | `packages/core/src/tool/tool.ts:5` | M |
| VA-D4 | an approval gate (HL-01) | approval requested as a first-class message state | `packages/core/src/agent/approval.ts:4` | M |
| VA-D5 | a typed event stream (RT-09) | events are filtered per consumer and attributed to a child | `packages/core/src/events.ts:13` | S |

## Three rows that matter most

**VA-A1 is first.** Parallel delegation without a typed report just multiplies prose: a supervisor gets several paragraphs back and no way to tell success from failure (`packages/core/src/agent/subagent/index.ts:579`). Our `packages/core/src/agent/managed-agent.ts:53` already declares an output schema, so widening it from a string is the cheapest structural win on this list.

**VA-A4 is the strategy call.** Their supervisor is a normal agent plus a generated prompt; ours has no topology at all. Shipping that means owning a prompt contract we cannot test against a model, so it should follow A1 and A2 rather than lead them.

**VA-A5 is the one users feel.** Approval as a pending state, not a thrown denial, is what makes a chat UI honest. Their message-level state is a better shape than our call-level gate, and it does not require a durable store to be useful.

## The contract, side by side

| dimension | voltagent | ours at the pinned revision |
|---|---|---|
| what a child returns | an array of objects whose response field is text (`packages/core/src/agent/subagent/index.ts:860`) | a string (`packages/core/src/agent/managed-agent.ts:53`) |
| how a failure arrives | a formatted string inside the tool result (`packages/core/src/agent/subagent/index.ts:579`) | a thrown typed error that ends the call |
| how progress is visible | forwarded stream chunks plus a memory section in the prompt | events for our own steps only |
| where shared state lives | a per-call `context` map plus the child's own conversation (`packages/core/src/agent/subagent/index.ts:329`) | nothing shared |
| what a plan is | the supervisor's accumulated messages and tool calls; PlanAgent adds a todo list | no plan object in the manager |

The gap is not that they solved delegation; it is that they gave every dimension a name. A port can copy the names without copying the implementation.

## What we have that they lack

- **Code as action.** Our runtime can run a model-written program in a sandbox (`packages/core/src/agent/multi-step-agent.ts:346`); theirs is tool-calling only.
- **Executors.** QuickJS, Pyodide and remote backends are ours; they delegate sandboxing to hosted packages.
- **A typed error taxonomy.** Their delegation failures are strings (`packages/core/src/agent/subagent/index.ts:579`); ours are `AgentErrorInfo` values (`packages/core/src/errors.ts:1`).
- **A small surface.** A 30-package workspace against our eleven, so their integration matrix is much wider than their runtime.
- **No hosted dependency.** No part of our runtime requires a console or an account.

## Patterns worth copying

1. **Attribute every forwarded event.** They add agent identity to a child's stream chunk before re-emitting it (`packages/core/src/agent/subagent/index.ts:928`). Our event stream should carry an optional path from the start, because adding it later breaks consumers.
2. **Derive limits from structure.** Ten steps per subagent, computed once (`packages/core/src/agent/subagent/index.ts:220`). Copy the derivation, not the number.
3. **Bail as an outcome.** A handoff hook can end the supervisor with the child's answer (`packages/core/src/agent/subagent/index.ts:499`). That is a clean way to model an early stop without an exception.
4. **A typed step context.** `bail`, `abort`, `getStepResult`, `getInitData` and a mutable workflow state give a step everything it needs without closing over the run (`packages/core/src/workflow/context.ts:98`).
5. **Suspend with a schema.** A workflow declares what a resume accepts and the caller gets a typed value back (`website/docs/workflows/suspend-resume.md:51` is the documented shape; the code is `packages/core/src/workflow/core.ts:1027`).
6. **Capability-negotiated storage.** Optional tables mean a minimal adapter still works; the manager detects and degrades (`packages/core/src/memory/types.ts:449`). Our run store should do the same.
7. **Transport fallback.** They try streamable HTTP and fall back to SSE (`packages/core/src/mcp/client/index.ts:161`). Worth copying in any adapter that meets an unknown peer.
8. **A hold-back stream scanner.** Guardrails that need lookahead buffer chunks rather than rejecting a partial match (`packages/core/src/agent/streaming/guardrail-stream.ts:93`).

## Patterns to avoid

1. **Failures as prose in a tool result.** A model reads an error string and improvises; a caller cannot retry intelligently (`packages/core/src/agent/subagent/index.ts:579`).
2. **An 8,000-line class.** Everything in `agent.ts` is one edit away from everything else (`packages/core/src/agent/agent.ts:1013`).
3. **Implicit state.** Memory is on by default, stored in process, and shared across runs; opting out is a flag (`website/docs/agents/memory/overview.md:139`).
4. **Two contracts for the same idea.** The supervisor path and the PlanAgent path both delegate, with different result shapes (`packages/core/src/planagent/plan-agent.ts:934`).
5. **Coupling a core feature to a hosted console.** Triggers and live traces assume VoltOps; the local path is a degraded copy.
6. **Docs sprawl.** 127 pages plus a second site for triggers; a reader cannot tell which page is current.

## Recommendations

1. Ship VA-A1 (typed child report) before any supervisor work; it is a schema change plus a test.
2. Then VA-A2 and VA-A3 together: parallel children and a context map are one API change.
3. Treat VA-A5 as its own small project, because approval-as-state touches the event union.
4. Defer VA-A4 until A1 and A2 prove the shape; a generated prompt is the least testable part.
5. Land VA-A10 early: one exporter interface is cheap and unblocks A9.
6. Schedule VA-A12 as a batch of small guards, not one framework change.
7. Record VA-B1 through VA-B8 in the non-goal note so a future reader does not re-open them.
8. Take VA-C2 seriously: a memory read policy is as important as the store.

## Baseline corrections

None. Every row this dive extended was accurate at the pinned revision. Two notes for the synthesis: their parallel delegation is real but its failure channel is prose, and their span tree is real but exported through OpenTelemetry rather than a local shape.