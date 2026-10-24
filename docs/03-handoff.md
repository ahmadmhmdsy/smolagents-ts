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
## 2026-10-24T22:10:00+03:00 — 2.3: every event and record names its agent path

**State.** Phase 2 is open; 2.1 (typed child report) and 2.3 (agent path) are landed. Next is 2.6,
then 2.7, then the second slice. Nothing pushed.

**Did.** `AgentEvent` is the payload union intersected with an optional `agentPath`, and `emit`
writes the running context's path onto every event, so the runtime form always carries it. The
root run's path is empty; a managed child runs with its parent's path plus its own name, so a
second level reads `["researcher","writer"]`. `RunOptions.agentPath` seeds a run and
`RunRecord.agentPath` keeps it; both executor seams forward the path to every tool call's
`ToolContext`, which is how the managed-agent tool knows where to extend it. A caller-supplied
path is extended, never replaced.

**Verified.** `agent-path.test.ts` (45th core file, 5 cases) green: empty root path, one-level and
two-level child paths, the stored record path, and extension of a caller's path. Core 45
files/532 tests; `pnpm typecheck` clean across the workspace; `pnpm gate` exit 0; validator
0/0; rotate clean. Two exact event-shape assertions moved to `toMatchObject` because the event
contract grew a field.

**Unverified / open.** 2.6, 2.7, 2.2, 2.4, 2.5 and 2.8 are not started. A child's record is not
durable unless its own run names a run id; the path is on the record either way.

**Next.** 2.6: `sendRunMessage` writes an ordinary user-role message into a run's record and
returns a receipt; a running target sees it at its next step boundary, a parked one resumes.

**Blockers.** None; the owner's blocked rows are unchanged.

**Artifacts.** `packages/core/src/events.ts`; `packages/core/src/agent/multi-step-agent.ts`;
`packages/core/src/session/run-record.ts`; `packages/core/test/agent-path.test.ts`.

## 2026-10-24T21:45:00+03:00 — Phase 2 opened; 2.1 gives a child a typed report

**State.** Phase 2 (delegation that survives its parent) is open under
`docs/plans/2026-10-24-phase-2-execution-plan.md` and `T-43`. Item 2.1 is landed; 2.3, 2.6,
2.7, then 2.2, 2.4, 2.5 and 2.8 follow. Nothing pushed.

**Did.** The plan registers every item's acceptance test before code and records the design
each item lands. 2.1 added `child-report.ts`: `ChildReport<T>` carries a schema-validated
`value` or a `failure` channel, a `stopReason` (`success`/`failure`/`max_steps`/`waiting`),
and a diagnostic bounded to 300 characters with the task text and key-shaped tokens removed.
`ManagedAgent.outputSchema` is the declaration; `runManagedAgent` is the typed path; the
model-facing `managedAgent` tool keeps the Phase 1 report template.

**Verified.** The suite was red first (module missing), then 7 cases green; core 44 files/527
tests; `pnpm gate` exit 0; validator 0/0; rotate clean.

**Unverified / open.** 2.3, 2.6, 2.7 and the second slice (2.2, 2.4, 2.5, 2.8) are not
started. A schema failure reports issue paths and codes only, by design.

**Next.** 2.3: every event carries the agent path, enriched at emission, and the record keeps
the path its run ran under.

**Blockers.** None. `T-14`, `T-39`, `T-16`, `T-18` and `T-21` remain owner-blocked.

**Artifacts.** `docs/plans/2026-10-24-phase-2-execution-plan.md`;
`packages/core/src/agent/child-report.ts`; `packages/core/test/child-report.test.ts`.

## 2026-10-24T21:20:00+03:00 — Phase 1 closed: the durability spine holds across processes

**State.** Phase 1 (items 1.1–1.8) is complete and closed; `T-42` is done. Everything is
committed on `main`, nothing pushed. Phase 2 (delegation that survives its parent) is the next
phase in the parent plan and has not started.

**Did.** Added the exit criterion as `packages/cli/test/phase-1-close.test.ts` (park → competing
claim refused → claim → resume → `allowed-once`; crash after a journaled tool result repaired
without a second effect), wrote `docs/reports/2026-10-24-phase-1-report.md` with the manual
two-process run (process 1 exit 3, counter 0; process 2 exit 0, counter 1; record `completed`),
recorded the close in the execution plan and closed `T-42` in `04-tasks`.

**Verified.** The exit-criterion test was red first, then green; `pnpm gate` exit 0 on the close
tree; contract's thirteen modes still certify three stores; validator 0/0; `rotate.py --check`
clean. The manual run used built `dist` plus `MockModel`/`ScriptedExecutor`, no provider.

**Unverified / open.** A fork at a step whose journal holds an in-doubt `intent` would surface
`EffectOutcomeUnknownError`; untested. The parent plan's "agent fingerprint" is in the phase
deliverable but in none of its items, so it is not landed — a candidate follow-up. CLI approval is
a flag, not a prompt (deliberate).

**Next.** Begin Phase 2.1–2.7 (the first slice needs no new durable rows) under a fresh execution
plan with pre-registered acceptance tests.

**Blockers.** None for Phase 2. `T-14`, `T-39`, `T-16`, `T-18` and `T-21` remain owner-blocked.

**Artifacts.** `docs/reports/2026-10-24-phase-1-report.md`;
`docs/plans/2026-10-24-phase-1-execution-plan.md`;
`packages/cli/test/phase-1-close.test.ts`; `packages/core/src/session/run-store.ts`.

## 2026-10-24T20:55:00+03:00 — 1.8 landed: a run can branch without repeating effects

**State.** All eight Phase 1 items are in the tree; Phase 1 close is next (exit-criterion test,
phase report, task closure). Nothing pushed.

**Did.** `RunOptions.fork {fromRunId, atStep}`: a child run loads the parent record, copies the
memory before the step and the journal through it, and re-enters that step under the parent's
attempt id, so the recorded model reply and tool results replay instead of running. The record
names `parentRunId`/`parentStep`, keeps its own conversation, starts at generation 0 with no
pending request, owner or settlements, and reports its own `runId`. The CLI adds `--fork` plus
`--fork-step`, refuses either alone or with `--resume`, and reads a missing task from the parent;
the bin now also forwards `--conversation`, which 1.7 parsed but did not pass on.

**Verified.** `fork.test.ts` was red first. Core 43 files/519 tests, CLI 10/74, `pnpm gate` exit 0,
validator 0/0, `rotate.py --check` clean. The core acceptance: a three-step parent forked at step
1 yields a child naming parent/step whose journal holds the step-1 tool result with the counting
tool unmoved, finishing under its own id; a waiting parent forked at step 0 leaves `pending` off
the child. The CLI case forks a finished parent and keeps the tool run once.

**Unverified / open.** Phase 1 close: the two-process exit criterion, the phase report, and the
parent-plan check. A fork at a step with an in-doubt `intent` would fail as an unknown effect;
not covered by a test.

**Next.** Write the exit-criterion test and the Phase 1 report, close `T-42`, then mark the goal
complete.

**Blockers.** None for Phase 1; the owner-blocked rows were unchanged.

**Artifacts.** `packages/core/test/fork.test.ts`; `packages/core/src/agent/multi-step-agent.ts`;
`docs/plans/2026-10-24-phase-1-execution-plan.md`.
<!-- rotate:end -->
