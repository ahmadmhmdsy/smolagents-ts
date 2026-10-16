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

## 2026-10-16T15:30:00+03:00 — S7 closes: the example app delegates to a child agent end to end

**State.** Pre-release and clean. S7 multi-agent is complete: the milestone reads `done`, its live task row (T-34) is archived, and T-35 (S8) is the live row.

**Did.** Closed S7 by proving delegation in the example app: added `createDelegationRun()` to `examples/vite-app/src/agent.ts` — a `CodeAgent` whose scripted program calls a managed agent (`researcher`) from sandboxed QuickJS code — and `examples/vite-app/test/delegation.test.ts` drives it through the real executor. Recorded S7 `done` in the spec, marked and archived T-34, opened T-35 (S8: resumable state plus an approval seam), and updated the roadmap plan.

**Verified.** `pnpm vitest run --project example-vite-app` 3 files and 8 tests, exit 0; `pnpm gate` exit 0 (pack-smoke OK, site 74 pages). Docs: validator 0 errors, `rotate --check` exit 0.

**Unverified / open.** The delegation demo is not wired into the example's React UI — only its factory and test exist, so the page still renders the greet demo. That is a deliberate skip, not a gap in S7. Child-to-parent event forwarding stays out of scope.

**Next.** Start T-35 (S8): design the store/resume seam, then the approval seam.

**Blockers.** None. T-14 (publish), T-16, T-18, T-21 and T-25 wait on the owner.

**Artifacts.** `examples/vite-app/src/agent.ts` (`createDelegationRun`); `examples/vite-app/test/delegation.test.ts`; `docs/04-tasks.md`; `docs/01-project.md` (S7 `done`); `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md` (Phase 1).

## 2026-10-16T14:20:00+03:00 — S7's core lands: a manager delegates to a child agent exposed as a tool, with no change to the loop

**State.** Pre-release and clean. S7 multi-agent is implemented and verified at the library level; only the example-app delegation run is outstanding, so the milestone reads `in_progress`.

**Did.** Added `managedAgent()` (`packages/core/src/agent/managed-agent.ts`): it wraps a child agent as a tool taking a `task` (plus optional `additional_args`), wraps the task in upstream's managed-agent prompt, runs the child, and wraps the answer in the report prompt. `AgentOptions.managedAgents` folds each child into the manager's tool registry, so both `CodeAgent` and `ToolCallingAgent` execute and advertise it with no loop change; the prompt lists them in a "team members" section apart from the tool list. Exported `managedAgent` and `MANAGED_AGENT_INPUT_SCHEMA`; updated the public-surface pin and the template drift test.

**Verified.** `pnpm gate` exit 0 on 2026-10-16: 314 core tests (8 new), every project green, depcruise and site clean. Delegation proven by `packages/core/test/managed-agent.test.ts` — a parent calls `junior`, the child runs, and its report folds back as the observation.

**Unverified / open.** The `examples/vite-app` delegation run named in plan Phase 1 is not done. Child-to-parent event forwarding was dropped from the exit criterion: a tool call has no event channel. S8-S11 remain unstarted.

**Next.** Run a managed agent in `examples/vite-app` to close S7, then start T-35 (S8).

**Blockers.** None. T-14 (publish), T-16 and T-18 still wait on the owner.

**Artifacts.** `packages/core/src/agent/managed-agent.ts`; `packages/core/src/agent/multi-step-agent.ts` (`managedAgents` fold); `packages/core/src/prompts/templates.ts`; `packages/core/test/managed-agent.test.ts`; `docs/01-project.md`; `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md`.
<!-- rotate:end -->
