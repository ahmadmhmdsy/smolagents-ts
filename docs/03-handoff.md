# 03 — Handoff (state)

**Contract**
- **Role:** narrative state — where we are.
- **Mutability:** **append-only, newest first.** Never edit or delete a past
  entry. Correct a past entry by writing a new entry that supersedes it.
- **Read when:** session start, before anything else.
- **Update when:** any milestone, incident, decision, or resume point.

**Why append-only:** the value of this file is that it records what was
believed at the time. Editing history destroys exactly that.

---

## Entry format

Copy _templates/handoff-entry.md. Every entry answers:

- **State** — where the project is right now.
- **Did** — what this session actually changed.
- **Verified** — what was checked, with the command and the result.
- **Unverified / open** — what was not checked and what remains.
- **Next** — the single next step.
- **Blockers** — anything gated, and on what.
- **Artifacts** — paths worth opening, as path:line where possible.

## Rotation

The newest entries stay inline, newest first. Older entries move verbatim to
`docs/handoff/archive-2026.md`; rotation never deletes and never rewrites. A new
entry is prepended inside the markers below.

---

<!-- rotate:begin -->
## 2026-10-24T13:45:00+03:00 — 0.9 landed: a budget record, a typed limit, a handle

**State.** Nine Phase 0 items in (0.1–0.9). Last one is 0.10: structured output on a
model that cannot call tools.

**Did.** Added `session/budget.ts`: requested limits (turns, output tokens, total
tokens) clamped by the deployment ceiling, a `RunBudget` record on the run context and in
`RunResult.budget`, and a caller-held `RunBudgetHandle` that continues the counters into
the next run. A resumed checkpoint without a handle seeds its counters from its own steps,
so the budget does not reset. Crossing a limit ends the run with a new terminal event,
`run.limitReached`, carrying the typed reason; the session status became `limit_reached`
and the React label and CLI line were updated for it (both gates caught the missing React
entry).

**Verified.** `pnpm gate` exit 0; core 39 files, 458 tests (seven new: clamping, the
three typed reasons, the seed, the run-level limit, the shared handle and the
non-resetting resume).

**Unverified / open.** The ceiling is a module constant, not configuration; 0.9 has no
deployment-level wiring. A handle is in-memory only, so a process restart still needs the
checkpoint path to continue a budget.

**Next.** 0.10: bound a schema for a model with `toolCalls: false` and repair without a
forced tool.

**Blockers.** None.

**Artifacts.** `packages/core/src/session/budget.ts`,
`packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/events.ts`,
`packages/core/test/budget.test.ts`, `packages/react/src/agent-run.tsx`,
`packages/cli/src/renderer.ts`.

## 2026-10-24T13:10:00+03:00 — 0.8 landed: the store contract, with counterexamples

**State.** Eight Phase 0 items in (0.1–0.8). Next is 0.9's budget record, then 0.10's
tool-less structured output.

**Did.** Wrote `test/contract/run-store.contract.ts`: ten store modes, each check paired
with a deliberately broken counterexample the suite must reject. Certified three
implementations — `MemoryRunStore`, an asynchronous wrapper and a temporary-file store
double that stands in for the durable file store Phase 1.5 has not built. The contract
found a real leak: `MemoryRunStore` handed out its internal steps array, so a caller that
mutated a loaded checkpoint changed the stored one. It now copies on both sides of the
boundary.

**Verified.** `pnpm gate` exit 0; core 38 files, 446 tests (the contract file alone
registers sixty).

**Unverified / open.** The file store certified here is a test double, not the 1.5
artifact; when 1.5 lands, its store joins this file and the double goes.

**Next.** 0.9: turn/output/total-token limits on the record, a typed terminal reason and
a handle that continues the budget.

**Blockers.** None.

**Artifacts.** `packages/core/test/contract/run-store.contract.ts`,
`packages/core/test/contract/run-store.conformance.test.ts`,
`packages/core/src/session/run-store.ts`.

## 2026-10-24T12:40:00+03:00 — 0.7 landed: every tool has a finite deadline

**State.** Seven Phase 0 items in (0.1–0.7). Next is 0.8's conformance suite, then 0.9's
budget record and 0.10's tool-less structured output.

**Did.** `tool()` now guards every tool with a deadline: 120 s by default, overridable
per definition, 0 to disable. The around-wrapper races the call against its timer,
replaces a result only when that timer fired, swallows a loser's late rejection, and
classifies an aborted run as cancellation rather than as a timeout. A deadline failure
is `ToolTimeoutError` (code `AGENT_TOOL_TIMEOUT`, limit in the message); the
tool-calling agent keeps that typed error instead of flattening it into a generic call
failure, and rethrows cancellation.

**Verified.** `pnpm gate` exit 0; core 37 files, 386 tests (four new: deadline failure,
cancellation classification, and the agent-level action failure carrying the code).

**Unverified / open.** A custom `Tool` implementation that does not go through `tool()`
gets no deadline; the seam guards the factory, not the interface.

**Next.** 0.8: the store conformance suite over ten failure modes.

**Blockers.** None.

**Artifacts.** `packages/core/src/tool/timeout.ts`,
`packages/core/src/tool/tool.ts`, `packages/core/src/agent/tool-calling-agent.ts`,
`packages/core/src/errors.ts`, `packages/core/test/tool.test.ts`,
`packages/core/test/tool-calling-agent.test.ts`.

## 2026-10-24T12:05:00+03:00 — 0.6 landed: a tripped guardrail leaves no blocked text behind

**State.** Six Phase 0 items in (0.1, 0.2, 0.3, 0.4, 0.5, 0.6). Next is 0.7's tool
deadline, then 0.8's conformance suite, 0.9's budget record and 0.10's tool-less
structured output.

**Did.** Wrote and enforced the rule in `MultiStepAgent.complete()`: when the output
tripwire (or the schema safety net) refuses an answer, the answering step's
`final_answer` call loses its arguments and result, its observation becomes
`Final answer: [redacted]`, and the checkpoint is re-saved before `run.failed` — so a
store never keeps the refused value. `buildTrace` scrubs a guarded run's trace the same
way and marks the run span `redacted: true`.

**Verified.** `pnpm gate` exit 0; core 37 files, 382 tests (1 new: a blocked answer is
absent from the checkpoint and the trace, which says redacted).

**Unverified / open.** A caller that persists the raw `AgentEvent` stream itself will
still see the transient `action.result` value; the rule covers the artifacts this
package writes. Nothing pushed.

**Next.** 0.7: a finite per-tool deadline, a typed `ToolTimeoutError`, cancellation
kept separate.

**Blockers.** None.

**Artifacts.** `packages/core/src/agent/multi-step-agent.ts`,
`packages/core/src/monitoring/trace.ts`,
`packages/core/test/guardrail.test.ts`.

## 2026-10-24T11:35:00+03:00 — 0.3 landed: a schema failure gets two repairs, then ends the run

**State.** Phase 0 has five items in (0.1, 0.2, 0.3, 0.4, 0.5). Wave 2 continues with
0.6, 0.7, 0.8, 0.9, 0.10.

**Did.** A schema mismatch is answered with a correction observation at most twice per
run; a third failure throws `AgentGuardrailError` naming the budget, so a
wrong-schema loop can no longer spend `maxSteps` silently. `RunContext.finishReason`
now carries why the reply ended, and a reply truncated by `length` is never repaired
(the missing part is not a correctable mistake) — it fails immediately. The attempt
count rides on the refused `final_answer` calls, not a new event kind.

**Verified.** `pnpm gate` exit 0; core 37 files, 381 tests (3 new: two repairs then a
valid answer, budget exhaustion, the length guard with one model call).

**Unverified / open.** The length guard is unit-tested through a scripted tool call
finish; the text-answer path that can actually be truncated by length is 0.10's and will
re-test it there. Nothing pushed.

**Next.** 0.6 (guardrail redaction rule), then 0.7's tool deadline.

**Blockers.** None.

**Artifacts.** `packages/core/src/agent/multi-step-agent.ts`,
`packages/core/src/agent/tool-calling-agent.ts`,
`packages/core/test/guardrail.test.ts`.
<!-- rotate:end -->
