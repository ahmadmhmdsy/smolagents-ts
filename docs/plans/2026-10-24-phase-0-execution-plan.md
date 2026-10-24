# Plan — Phase 0 execution: the correction pass

**Contract**
- **Role:** the execution plan for Phase 0 of the 2026-10-22 research plan; item by item, with a pre-registered acceptance test and a rollback for each.
- **Mutability:** item order and acceptance criteria are fixed once work starts; a change is a new entry in this file's `## Changes` section, not a quiet rewrite.
- **Read when:** starting or resuming Phase 0.
- **Update when:** an item lands, a wave closes, or a criterion proves wrong.

- **Status:** active
- **Owner:** owner
- **Created:** 2026-10-24T09:55:00+03:00
- **Opened by:** owner, "open Phase 0" (2026-10-24)
- **Parent plan:** [`2026-10-22-apply-the-competitor-findings-plan.md`](docs/plans/2026-10-22-apply-the-competitor-findings-plan.md)
- **Task row:** `T-41`

## Goal

Make the record honest before anything is built on it: an approval that names what it approves, a schema that reaches the model through `final_answer` alone, a stored record that carries a version, an egress axis that refuses where it cannot enforce, a typed deadline, a conformance suite and a budget that lives on the record. Ten items, one seam each, all inside `packages/core` except 0.4.

## Preconditions

- Decisions [`0020`](docs/09-decisions/0020-a-capability-is-a-claim.md), [`0022`](docs/09-decisions/0022-the-refuse-list-is-the-boundary.md), [`0023`](docs/09-decisions/0023-one-identity-per-run.md), [`0024`](docs/09-decisions/0024-publication-waits-for-corrections.md) and [`0025`](docs/09-decisions/0025-no-blackboard.md) are accepted.
- The tree is green at `0c03940`; `pnpm gate` passes.
- No source change lands before its acceptance test exists, red first.

## Waves

| wave | items | writers | why together |
|---|---|---|---|
| 1 | 0.1, 0.2, 0.5 | one loop writer | each touches the loop's one commit surface: approval at the tool seam, the schema at the final answer, the record shape |
| 1 beside | 0.4 | one `exec-remote` writer | disjoint package; the egress axis meets 0.1 only at the deny-only stage's shape, not its files |
| 2 | 0.3, 0.6, 0.7, 0.8, 0.9, 0.10 | one loop writer | all ride the loop surface and the Phase 0 record; 0.8's suite is the gate they each satisfy |

Each item ends at one commit with `pnpm gate` green. A wave ends with the core surface projection refreshed when the core surface moved.

## Wave 1

### 0.1 — an approval names what it approves

**Today.** `withApproval` takes `(request) => boolean`, asks with `{name, input, stepIndex}`, and denies by throwing `ToolApprovalError`. No identity, no digest, no audit event.

**Change.** `ApprovalRequest` gains `requestId` (the tool call's `callId`) and `digest` (a stable FNV-1a hex digest of the canonical JSON of the validated input, implemented in `packages/core/src/utils/digest.ts` so it stays isomorphic). The handler answers an `ApprovalVerdict`: `{requestId, digest, outcome}` where `outcome` is `allowed-once | rejected | cancelled | unavailable`. A `boolean` stays accepted as shorthand (`true → allowed-once`, `false → rejected`); any other value, a mismatched id, a mismatched digest, or a throwing handler resolves to `unavailable`, and `withApproval` refuses a non-`allowed-once` outcome with `ToolApprovalError` whose message names the drift or the outcome. `AgentOptions.approvalPolicy?: "ask" | "never"` — `never` refuses deterministically before the handler is called, which is what a CI or a headless run needs. The loop records a `ToolApprovalEvent` (`kind: "approval"`, `requestId`, `digest`, `outcome`) for every ask, and `AgentSession` keeps the pairs in its snapshot; an ask always has its decided record because the recorder is the same loop that emitted the ask.

**Files.** `packages/core/src/agent/approval.ts`, `packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/events.ts`, `packages/core/src/types.ts`, `packages/core/src/utils/digest.ts` (new), `packages/core/src/index.ts`, `packages/core/test/approval.test.ts`, `packages/core/test/events.test.ts`.

**Acceptance (pre-registered).** A scripted agent approves one call, then a second run with one argument edited produces a digest mismatch and no side effect; an agent with `approvalPolicy: "never"` denies without calling the handler; a throwing handler yields `unavailable`; every ask emits exactly one approval event and the event count equals the handler count.

**Rollback.** Revert the commit; the new event kind is additive to the event union, and no persisted shape changed.

**Scope.** `packages/core/src/agent/approval.ts`, `packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/events.ts`, `packages/core/src/types.ts`, `packages/core/src/utils/digest.ts`, `packages/core/src/index.ts`.

### 0.2 — the schema binds to `final_answer`

**Today.** `AgentOptions.outputSchema` is gated in `guardrail.ts` (a tripwire that inspects the value); no bound schema reaches the model, and `ModelCapabilities.structuredOutput` exists as a mode enum the models package reads.

**Change.** Both flavours declare the answer schema to the model as one `final_answer` parameter schema — `ToolCallingAgent` by narrowing the `final_answer` tool's `inputSchema`, `CodeAgent` by the prompt's `final_answer` contract — and a mismatch returns as an observation (a failed `final_answer` call), not as a thrown run error. `ModelCapabilities.structuredOutput` is deleted (`0020`), and every read site goes with it. `guardrail.ts` keeps `Guardrails.output` as a tripwire over the validated value; the schema is no longer re-checked there.

**Files.** `packages/core/src/agent/tool-calling-agent.ts`, `packages/core/src/agent/code-agent.ts`, `packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/model.ts`, `packages/models/src/**` (capability field), `packages/core/test/tool-calling-agent.test.ts`, `packages/core/test/code-agent.test.ts`, `packages/models/test/**`.

**Acceptance.** A wrong-shaped answer names the offending path in the observation and the run continues; a scripted model that cannot call tools still ends schematically (that is 0.10's fixture, reused here); no source file reads a `structuredOutput` capability field (`grep` is the test).

**Rollback.** Revert; the capability field is additive until deleted, and the branch ships together.

**Scope.** `packages/core/src/agent/`, `packages/core/src/model.ts`, `packages/models/src/`.

### 0.5 — one integer version on a stored record

**Today.** `RunSnapshot` is a bare `StepJSON[]`; `RunStore` saves and loads that array; a future shape change has no version to read.

**Change.** `RunSnapshot` becomes `{ formatVersion: 1; steps: readonly StepJSON[] }`. The store interface keeps `save/load`; the loader translates a version-0 value (the bare array a pre-0.5 caller wrote) to version 1, refuses a version above the current one with a typed `RunStoreVersionError`, and the `MemoryRunStore` round-trips the envelope. One migration function lives beside the type (`translateSnapshot`), and the rule "one integer, one migration, no gaps" is written into the file's header.

**Files.** `packages/core/src/session/run-store.ts`, `packages/core/src/session/agent-session.ts`, `packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/errors.ts`, `packages/core/test/run-store.test.ts`, `packages/core/test/session-persistence.test.ts`, `packages/core/test/core-loop-fixes.test.ts`.

**Acceptance.** A fixture written as a bare array loads; a fixture written as `{formatVersion: 2}` is refused with `RunStoreVersionError`; a save/load cycle preserves the envelope; the resume tests still pass.

**Rollback.** Revert; nothing shipped, so version 1 has no readers outside this tree.

**Scope.** `packages/core/src/session/`, `packages/core/src/errors.ts`.

## Wave 1 beside — 0.4, egress axis

**Today.** `ExecutorNetwork = "none" | "host-mediated" | "direct"` describes reach; the e2b backend can confine the guest but exposes no option to ask for it, and docker/process have no such axis.

**Change.** `RemoteExecutorOptions` and the sandbox factories gain `egress?: "unmanaged" | "deny-all"` (unmanaged is the default and is what today's code does). The e2b backend maps `deny-all` to the vendor's deny and reports `network: "none"`; docker and process refuse `deny-all` with a typed `EgressUnsupportedError` raised before the guest starts, naming the backend and the item (4.8) that will lift it. `network` stays reach, never becomes a policy.

**Files.** `packages/exec-remote/src/executor.ts`, `packages/exec-remote/src/sandbox.ts`, `packages/exec-remote/src/errors.ts`, `packages/exec-remote/src/backends/e2b.ts`, `packages/exec-remote/src/backends/e2b/*`, `packages/exec-remote/src/backends/docker.ts`, `packages/exec-remote/src/backends/process.ts`, `packages/exec-remote/test/**`.

**Acceptance.** The e2b double shows the deny option at create and `network: "none"` on the capabilities; docker and process throw `EgressUnsupportedError` before any child process or container exists; an unmanaged executor behaves exactly as today (its eleven existing tests unchanged).

**Rollback.** Revert; the option is optional and no default changed.

**Scope.** `packages/exec-remote/**`.

## Wave 2

| # | change | acceptance | scope |
|---|---|---|---|
| 0.3 | one repair attempt: a schema failure returns as a history message, has its own budget, and never follows a length finish | a scripted model fails twice then returns valid; two attempts recorded | `packages/core/src/agent/` |
| 0.6 | a written and tested rule for a tripped guardrail: blocked output is absent from every persisted artifact and the trace says redacted | the fixture's store contains no blocked text; the trace event says redacted | `packages/core/src/agent/guardrail.ts`, `packages/core/src/monitoring/trace.ts` |
| 0.7 | a finite default deadline per tool, an around-wrapper that replaces a result only when its own timer fired, one typed timeout code, cancellation classified separately | a hanging tool fails the step with `ToolTimeoutError` naming the limit | `packages/core/src/tool/`, `packages/core/src/agent/multi-step-agent.ts` |
| 0.8 | the conformance suite over the ten failure modes, written against the store interface, each refusal with a rejecting counterexample | the memory store and the file store (1.5) pass the same file | `packages/core/test/contract/` |
| 0.9 | turn, output-token and total-token limits as fields on the record, clamped by a deployment ceiling, a typed terminal reason, a handle that continues the budget | a second call with the handle keeps counting and reports `limitTotalTokens`; a resume does not reset | `packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/session/` |
| 0.10 | structured output on a model that cannot call tools: the bound schema plus the repair turn, not a forced tool | a `toolCalls: false` scripted model ends schema-valid inside the attempt bound | `packages/core/src/agent/`, `packages/models/src/` |

## Verification per item

1. The acceptance test exists and fails for the right reason (run it red once).
2. `pnpm vitest run --project core` (or `--project exec-remote`) green.
3. `pnpm gate` exit 0.
4. Long-file gate and the byte caps in `docs/00-schema.md` still pass (`python scripts/validate_context.py --root . --baseline docs/.baseline.json`).
5. One handoff entry and one `docs/04-tasks.md` status change per item, not per wave.

## Rollback

Each item is one commit and touches one seam; a wave is not a release. The only item whose rollback window closes is 0.5 once a store outside this tree writes version 1 — nothing has, because 0.1.0 is unpublished (`0024`).

## Changes

- **2026-10-24 — 0.1 as built.** As built, the audit is one event per ask (`approval.decided`)
  rather than an asked/decided pair, because one record already carries the decision and the
  handler count stays the invariant a test can check; the session snapshot carries the same
  records as `approvals`, additive to its shape. `approvalPolicy: "never"` maps to `rejected`
  with a reason naming the policy. The digest is FNV-1a over canonical JSON, internal to
  `packages/core/src/utils/digest.ts` and not exported from the barrel.
- **2026-10-24 — 0.2 as built.** The bound schema reaches a tool-calling model as the
  `final_answer` parameter schema (`{answer: <schema>}`) and a code-agent model as a
  `FINAL ANSWER SCHEMA` paragraph appended to its prompt; a mismatch on either path returns
  as an observation and the loop continues, which is why the acceptance test is a two-turn
  transcript. The schema is still re-checked in `complete()` as the last line of defence.
- **2026-10-24 — 0.5 as built.** `RunSnapshot` is `{formatVersion, steps}`; a bare step
  array still loads as the version-0 form and translates on read, and a declared version
  newer than the runtime's fails the run with `RunSnapshotVersionError`
  (`AGENT_SNAPSHOT_VERSION`) instead of being half-read. Translation lives beside the
  type in `packages/core/src/session/run-store.ts`, and `RunStore.load` is typed to
  accept either stored shape, so an existing store compiles unchanged.
- **2026-10-24 — 0.4 as built.** `EgressPolicy` (`unmanaged | deny-all`) sits on the
  exec-remote seam beside `network`, which stays a description of reach: the E2B backend
  passes `deny-all` to the vendor at create and reports `network: "none"`, while the
  Docker and process backends throw `EgressUnsupportedError` before an image is built or
  an interpreter is spawned. The seam test drives the E2B client double's create call.
- **2026-10-24 — 0.3 as built.** The repair budget is a module constant of two attempts,
  spent by either flavour when a schema failure is answered with a correction observation;
  past it the run fails as `AGENT_GUARDRAIL`, so a wrong schema can no longer consume
  `maxSteps`. An attempt is recorded as the refused `final_answer` call itself (the
  acceptance's "two attempts recorded" reads the two failed calls), not a second event
  kind. `RunContext.finishReason` carries the reply's finish reason, and a reply cut off
  by `length` is never repaired: the missing part is not a mistake a turn can correct.
- **2026-10-24 — 0.6 as built.** A tripped output guardrail (or the schema safety net in
  `complete()`) now redacts before it reports: the answering step's `final_answer` call and
  observation are replaced, and the checkpoint is rewritten, so a store never holds the
  refused value. `buildTrace` scrubs a guarded run too — the final-answer tool span loses
  its args and output, the answering step's observation becomes `[redacted]`, and the run
  span carries `redacted: true`.
- **2026-10-24 — 0.7 as built.** Every tool made by `tool()` now carries a deadline
  (`DEFAULT_TOOL_TIMEOUT_MS`, 120 s; `ToolDefinition.timeoutMs` overrides it; 0 disables
  it) and runs through `withToolTimeout`, which only replaces a result when its own timer
  fired and swallows a losing promise's late rejection. A deadline failure is
  `ToolTimeoutError` with code `AGENT_TOOL_TIMEOUT` and the limit in its message. An abort
  stays separate: the tool's own cancellation handler settles first, and only a silent tool
  gets the wrapper's `AgentCancelledError`; a timer that fires on an aborted run is
  classified as cancellation. The 120 s default is deliberately loose because a managed
  agent is a tool too.
- **2026-10-24 — 0.8 as built.** `packages/core/test/contract/` holds the store contract:
  ten modes (unknown key, non-empty round-trip, empty round-trip, overwrite, isolation,
  opaque keys, repeatable load, defensively copied data, read-your-write, concurrent
  writes), each with a deliberately broken counterexample the suite must reject — so the
  file proves it can fail. Three implementations are certified against it: `MemoryRunStore`,
  an asynchronous wrapper and a temporary-file store double, because Phase 1.5's durable
  file store does not exist yet; the double is the shape that store will have (one JSON
  file per key under a fresh temporary directory). The contract caught a real defect:
  `MemoryRunStore` handed out its internal array, so a caller could mutate a stored
  checkpoint; it now copies on save and on load.
- **2026-10-24 — 0.9 as built.** `session/budget.ts` owns the record: `RunLimits` asks
  for at most a number of model turns, completion tokens and total tokens;
  `RUN_LIMITS_CEILING` (100 turns, 200k output tokens, 1M total tokens) clamps every
  request, and a non-positive or non-finite request is a `RangeError`. A run's
  `RunBudget` record holds the clamped limits and the spent counters, lives on the run
  context, and travels into `RunResult.budget`. `RunBudgetHandle` is the caller-held
  continuation: passing it through `RunOptions.budget` carries the counters into the next
  run; a resumed checkpoint without a handle seeds its counters from the steps it already
  holds, so a resume does not reset the budget. Crossing a limit emits one new terminal
  event, `run.limitReached`, whose payload is the typed reason `limitTurns`,
  `limitOutputTokens` or `limitTotalTokens`; the session status is `limit_reached` and
  the React label and the CLI line name the budget rather than a failure. Planning turns
  count as turns. A budget crossed by a resumed run is reported before any model call.
