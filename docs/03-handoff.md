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

**Blockers.** None for Phase 1; T-14, T-16, T-18, T-21 and T-39 stay owner-blocked.

**Artifacts.** `packages/core/test/fork.test.ts`; `packages/core/src/agent/multi-step-agent.ts`;
`docs/plans/2026-10-24-phase-1-execution-plan.md`.

## 2026-10-24T20:05:00+03:00 — 1.7 landed: a run belongs to a conversation

**State.** Phase 1 items 1.1–1.7 are in the tree; only 1.8 (fork) remains. A run can carry a
conversation id, the store can name the newest run of one, and the CLI resumes it. Nothing pushed.

**Did.** `RunRecord`/`RunOptions` gained `conversationId`, written on every commit and kept on a
resume that does not name one. `RunStore.latestForConversation` is answered by both stores with a
timestamp-then-run-id tie-break and certified by a thirteenth contract mode. The CLI reads
`--conversation <id>`: it resumes the newest run of that conversation (same settlement rules as
`--resume`; `--approve` now accepts either name) or starts one tagged with the id, minting a run
id when `--run-id` is absent. `--run-id` plus `--conversation` starts a second run of the same
conversation.

**Verified.** Contract and run-store cases were red on the missing method first. The CLI case
starts a conversation, starts a second run that parks, then resumes it by conversation with the
tool run once and two records left. Core 42 files/517 tests, CLI 10/72, `pnpm gate` exit 0,
validator 0/0, `rotate.py --check` clean.

**Unverified / open.** `--conversation` together with `--resume` is accepted and `--resume` wins;
no test covers that pair. 1.8 remains.

**Next.** 1.8: fork a run from a named step.

**Blockers.** None for Phase 1; T-14, T-16, T-18, T-21 and T-39 stay owner-blocked.

**Artifacts.** `docs/plans/2026-10-24-phase-1-execution-plan.md`;
`packages/core/src/session/run-store.ts`; `packages/cli/src/run.ts`.

## 2026-10-24T19:35:00+03:00 — 1.6 landed: the CLI can park and resume

**State.** Phase 1 items 1.1–1.6 are in the tree; Wave B is half done. A durable CLI run now
writes a record, exits 3 on an approval it cannot decide, and a second invocation settles that
request and finishes. Nothing is pushed.

**Did.** `--run-id`, `--resume`, `--approve` and `--state-dir` in the parser, with
`--approve` refused unless `--resume` names the run. A durable run (`--run-id`) or a resume
gets a `FileRunStore` over `nodeRunFileSystem`; a headless process answers `pending`, so the
run parks with exit 3 and the renderer prints the exact resume command. A resume loads the record
first, so a missing directory names `--state-dir`, an absent record names the run, and a waiting
run without `--approve` prints its request id. `--approve` settles `allowed-once` and re-enters
the parked step with the task read back from the record; no model request or recorded effect is
paid for twice. A resume runbook walks the two commands.

**Verified.** CLI 10 files and 70 tests, typecheck; core untouched by the item, still 42 and 509.
`resume-e2e` parks a real `CodeAgent` at exit 3, reads the stored request id, resumes it, and
finishes at exit 0 with the tool run once and the parked model request replayed. `pnpm gate`
exit 0.

**Unverified-open.** A durable run parks once per tool call, and there is no interactive approval
prompt yet. The two-process manual run is recorded in the phase report when the last item lands.

**Next.** 1.7: `conversationId`, `latestForConversation` and `--conversation`.

**Blockers.** None. `T-14`, `T-39`, `T-16`, `T-18`, `T-21` stay owner-blocked.

**Artifacts.** `packages/cli/src/{args,errors,run,renderer,main}.ts`,
`packages/cli/test/{args,resume-e2e}.test.ts`, `docs/10-runbooks/resume-a-parked-run.md`.
<!-- rotate:end -->
