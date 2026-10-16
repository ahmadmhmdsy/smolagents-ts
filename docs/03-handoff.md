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
## 2026-10-16T21:20:00+03:00 — S11 lands: guardrails halt a run, the schema binds the final answer

**State.** Pre-release and clean. S11 (guardrails and structured output) is complete: the milestone reads `done`, its row (T-38) is archived, and no live task row is open. S7 through S11 — the whole post-0.1.0 roadmap — have landed this session; only the standing later candidates remain unscheduled.

**Did.** `AgentOptions` gained `guardrails` (an `input` and an `output` tripwire) and `outputSchema` (a caller-supplied zod schema). The loop runs the input tripwire after `run.started` (before the model is asked), and both output checks in one shared `complete()` choke point serving both completion paths (the code agent's final call and the tool-calling agent's final answer): a tripped wire or a schema mismatch emits `run.failed` with a new `AgentGuardrailError` (code `AGENT_GUARDRAIL`) instead of `run.completed`, and a passing schema reports its validated value as the output.

**Verified.** Core suite 36 files and 340 tests, exit 0. `packages/core/test/guardrail.test.ts` (5 cases) covers an input halt (proving the model was not asked, via an empty script), an input pass, an output halt, a schema reject and a schema accept-and-coerce. `pnpm typecheck`, `lint` and `pnpm gate` exit 0.

**Open.** A tripwire returns a reason string rather than throwing — one function per direction, composed by the caller; no array form. `run()` rebuilds errors from event data, so the failure is an `AgentError` carrying the guardrail name and code, not an `AgentGuardrailError` instance.

**Next.** No scheduled milestone remains. Likely next is a fresh roadmap or the first release (T-14 publish), which waits on the owner's registry credentials.

**Blockers.** None. T-14, T-16, T-18, T-21 and T-25 wait on the owner.

**Artifacts.** `packages/core/src/agent/guardrail.ts`; `packages/core/src/errors.ts`; `packages/core/test/guardrail.test.ts`; `docs/01-project.md`; `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md` (Phase 5).

## 2026-10-16T20:45:00+03:00 — S10 lands: a session continues the agent's memory across turns behind the store seam

**State.** Pre-release and clean. S10 (persistent sessions and memory) is complete: the milestone reads `done`, its row (T-37) is archived, and no live task row is open. S7 through S10 have landed this session.

**Did.** Gave `AgentSession` an `AgentSessionOptions.checkpoint` and made `send(task, { reset })` thread it into `agent.run`: with a checkpoint set, a turn continues the agent's prior memory (`reset:false`, checkpointed by the S8 store seam); with none, each turn is fresh. A new session naming the same checkpoint over the same `RunStore` reads the earlier turns. No new store type — the session reuses `RunStore`, so S10 is one option and one line.

**Verified.** Core suite 35 files and 333 tests, exit 0. `packages/core/test/session-persistence.test.ts` runs one session to a checkpoint, then a fresh agent and session over the same `MemoryRunStore` read the first turn's task; a second case shows no checkpoint starts fresh. `pnpm typecheck`, `lint`, `depcruise` and `pnpm gate` exit 0.

**Unverified / open.** Only the agent's memory persists; the session snapshot (the React step view) is not rehydrated from the store, so a reload shows an empty step list though the model still sees prior turns. A `SessionStore` for the snapshot is deferred.

**Next.** Start S11 (guardrails and structured output): a guardrail seam with input/output tripwires and a schema-bound final answer.

**Blockers.** None. T-14, T-16, T-18, T-21 and T-25 wait on the owner.

**Artifacts.** `packages/core/src/session/agent-session.ts` (`AgentSessionOptions`); `packages/core/test/session-persistence.test.ts`; `docs/01-project.md` (S10 `done`); `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md` (Phase 4).

## 2026-10-16T20:35:00+03:00 — S9 lands: an event-stream trace exporter and an eval harness over the golden run

**State.** Pre-release and clean. S9 (observability and evaluation) is complete: the milestone reads `done`, its row (T-36) is archived, and no live task row is open.

**Did.** Added `buildTrace` (`monitoring/trace.ts`): it folds an `AgentEvent` stream into one OTel-shaped `TraceSpan` tree — a `run` root with a child span per step, planning pass and tool call, status and attributes from the events, an injected clock for deterministic replays, advisory `.delta` events skipped. Added `scoreRun` (`monitoring/eval.ts`): it checks a completed run against a transcript's output, state, action-step count and event-type sequence, returning a readable per-check list. Exported and pinned both. Committed S7+S8 as `ccd7a50` first.

**Verified.** Core suite 34 files and 331 tests, exit 0. `packages/core/test/observability.test.ts` drives the existing `fibonacci` golden fixture once, folds its event stream into a trace, scores it (`pass: true`), and shows a mismatched `actionSteps` fails with a named detail. `pnpm typecheck`, `lint`, `depcruise` and `pnpm gate` exit 0.

**Unverified / open.** `buildTrace` folds an already-collected stream; it does not wrap a live `agent.stream()` as a sink, and there is no OTel SDK adapter or exporter transport — both are additive on the same seam. `scoreRun` compares by JSON value, enough for a transcript's scalar/array fields.

**Next.** Start S10 (persistent sessions and memory): a session that persists across runs behind the store seam, so a second run reads the first run's memory.

**Blockers.** None. T-14, T-16, T-18, T-21 and T-25 wait on the owner.

**Artifacts.** `packages/core/src/monitoring/trace.ts`; `packages/core/src/monitoring/eval.ts`; `packages/core/test/observability.test.ts`; `packages/core/test/golden/fibonacci.transcript.json`; `docs/01-project.md` (S9 `done`); `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md` (Phase 3).

## 2026-10-16T17:55:00+03:00 — S8 lands: a run checkpoints and resumes, and an approval gate holds a tool call

**State.** Pre-release and clean. S8 (durable runs and human-in-the-loop) is complete: the milestone reads `done`, its live row (T-35) is archived, and no S8 row is open.

**Did.** A step now serializes to plain JSON (`StepJSON`, `stepToJSON`/`stepFromJSON` in `memory/steps.ts`, identity and timing included) with `AgentMemory.toJSON`/`restore`. Added the `RunStore` seam plus a `MemoryRunStore` (`session/run-store.ts`) and the approval seam `withApproval`/`ApprovalHandler`/`ToolApprovalError` (`agent/approval.ts`). Wired `AgentOptions.store`/`approve` and `run(task, { reset, checkpoint })` into `MultiStepAgent`: `reset:false` loads the checkpoint and continues, each completed step saves, and `approve` rebuilds the registry through `withApproval` so both agent flavours gate at the one seam. Exported and pinned the five new names.

**Verified.** Core suite 33 files and 325 tests, exit 0. `run-store.test.ts` stops a run at `maxSteps`, resumes it from a `MemoryRunStore` checkpoint with `reset:false`, and finishes; `approval.test.ts` (4 cases) proves a denied call never runs the tool. `pnpm typecheck`, `lint`, `depcruise` (288 modules) exit 0.

**Unverified / open.** Only in-memory checkpointing ships; a durable store implements the same seam (S10). Resume rebuilds memory only — it does not re-emit prior events. A mid-step interrupt still ends the run.

**Next.** Start S9: an `AgentEvent` trace exporter seam and a golden-transcript eval harness.

**Blockers.** None. T-14, T-16, T-18, T-21, T-25 wait on the owner.

**Artifacts.** `packages/core/src/session/run-store.ts`; `packages/core/src/agent/approval.ts`; `packages/core/src/memory/steps.ts`; `packages/core/src/agent/multi-step-agent.ts`; `packages/core/test/run-store.test.ts`; `packages/core/test/approval.test.ts`.
<!-- rotate:end -->
