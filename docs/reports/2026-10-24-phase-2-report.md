# Phase 2 — delegation that survives its parent: completion report

**Date:** 2026-10-24 · **Repository:** `E:\python_projects\smolagents_ts` (branch
`main`) · **Plan:** [Phase 2 execution plan](../plans/2026-10-24-phase-2-execution-plan.md)
(parent: [apply the competitor findings](../plans/2026-10-22-apply-the-competitor-findings-plan.md))

**Contract**
- **Role:** report — the completion record of Phase 2 and the evidence for its exit criterion.
- **Mutability:** history — corrected only by appending a new section; measured numbers are
  never rewritten.
- **Read when:** checking what Phase 2 landed, how the delegation surface is shaped, or which
  open items were left for a later phase.
- **Update when:** a claim here stops describing the code, which is a new report rather than an
  edit to this one.

This report describes the tree as it stood at the close commit; it is not a live status answer.

**Status:** complete. Items 2.1–2.8 are landed, tested, documented and committed; the plan's
Phase 2 exit criterion runs as six cases in `packages/core/test/phase-2-exit.test.ts`. Nothing is
pushed; `main` remains ahead of `origin/main`.

## Outcome

A second agent is now part of a run's durability, and the whole surface is opt-in. A managed
child returns a `ChildReport` — a schema-validated `value` or a typed `failure` with a bounded
diagnostic, plus a stop reason — rather than prose. Every event and record carries the
`agentPath` of the agents that produced it. A caller can send a run an ordinary record entry
that the target sees at its next step (resuming a parked child for it), and can wait on the next
edge without polling or claiming. A declared transfer ends a run with the target named on the
result and the record, so the caller starts the target's run. A background child gets its own row
on the parent with a concurrency cap and a cold resume that reconciles a `provisioning` row
against the child's record. The claim board stores claims, not data: owner, status, blockers,
advisory write scopes, a compare-and-set revision and tombstones, with no payload field. The
supervisor example shows the shape a caller writes: two schema'd children, one failing, and a
route computed from the reports.

## Verification evidence

| item | result |
|---|---|
| `pnpm gate` at the last item commit (`9f2e478`) | exit 0 (typecheck, version:check, lint, depcruise, test, build, publint, attw, ci:check, pack:smoke, site:build) |
| core suite | 51 files, 591 tests pass |
| CLI suite | 11 files, 77 tests pass |
| `packages/core/test/phase-2-exit.test.ts` | 6 passed (below) |
| `examples/supervisor` | its vitest project green; `tsc --noEmit` clean; `start` prints `route: hold` |
| public surface | 113 pinned names; every new runtime export has a pin |
| context validator | 0 errors, 0 warnings |
| `python scripts/rotate.py --check` | clean |

## What landed

| item | commit | summary |
|---|---|---|
| 2.1 | `588ac6d` | `ChildReport` with `value`/`failure`/`stopReason`; `runManagedAgent`; bounded diagnostics |
| 2.3 | `dbc2773` | `agentPath` on every event and on the record; extended, never replaced |
| 2.6 | `20d8ff8` | `sendRunMessage`: a record entry with sender, delivered at the next step, resuming a parked child |
| 2.7 | `8eb0023` | `waitForRun`: a subscription edge that never claims; `RunStore.watch` as the fourteenth contract mode |
| 2.2 | `b470e9c` | `transfers` and `transferTool`: a declared target's tool ends the run with `result.transfer` and `run.transferred` |
| 2.4 | `8843160` | `startBackgroundChild`/`listChildren`/`resumeBackgroundChild`: a row on the parent, a cap, a cold reconcile |
| 2.5 | `26b4e04` | `examples/supervisor`: two schema'd managed agents, one failing, routing on the reports |
| 2.8 | `9f2e478` | `session/claim-board.ts`: revision CAS, blockers, tombstones, advisory scopes, no payload |

## Exit criterion

The parent plan's criterion is: "A parent starts a child, ends, and a later run re-attaches to
the child's typed result; a send reaches a running child at its next step and a parked child
resumes for it; a wait returns `noProgress` when no child can move; a transfer survives a
restart; a nested child's events filter by path; a claim board refuses a stale revision."

`packages/core/test/phase-2-exit.test.ts` runs exactly those six cases:

1. a parent starts a background child, the child completes, and a later call re-attaches through
   `resumeBackgroundChild` with a fresh agent that never runs, reading `value: "forty-two"` from
   the stored report; the child's record names `parentRunId`.
2. a running child sends itself a message mid-run and the next step sees it; a parked child
   accepts a message and delivers it on the resumed step (`deliveredStep` set).
3. `waitForRun` on an ended run reports `noProgress` and returns the record without claiming; on
   a run the store does not hold it reports `noProgress` with no record.
4. a parent transfers to a declared target; a second `FileRunStore` over the same files loads
   the record and still finds `transfer.target` and the reason.
5. a two-level delegation puts every grandchild event on `["researcher","writer"]`.
6. a claim at the revision a prior claim consumed is refused with `TaskStaleRevisionError`, and
   the row keeps its owner and revision.

## Parent-plan check

| parent plan row | landed as |
|---|---|
| 2.1 typed child report, separate failure channel, stop reason, bounded diagnostic (`MA-03`) | `child-report.ts`, `runManagedAgent` |
| 2.3 an agent path on every event, enriched at emission (`RT-09`) | `agentPath`, `RunContext.agentPath` |
| 2.6 a send as a record entry, delivered at the next step, resuming an inactive child | `messages.ts`, `sendRunMessage` |
| 2.7 a wait on the next edge, `noProgress` at once, waking nobody | `wait.ts`, `RunStore.watch` |
| 2.2 a transfer action, target validated against declared agents, recorded in the run (`MA-02`) | `transfer.ts`, `transfers` option, `run.transferred` |
| 2.4 a bounded background child with its own row, parent pointer, cap, cold resume (`MA-04`) | `background-child.ts` |
| 2.5 one supervisor shape shipped as a tested example (`MA-06`) | `examples/supervisor/` |
| 2.8 a claim board with owner, status, blockers, advisory scopes, CAS revisions, tombstones, no payload | `claim-board.ts` |

Two differences from the parent plan's text, both recorded in the execution plan's `## Changes`:

- the deliverable calls the new rows "behind a flag"; no flag was needed because both rows are
  additive optional fields on the record and no existing run can reach them by accident. The
  opt-in surface is the flag.
- the plan's "Verification" names a fixture that parks and resumes a child; the exit test's case 2
  covers the parked-child resume directly instead of adding a separate fixture file.

## Open

- `T-43` closes with this report. The release stays bundled with `T-14` (publishing waits on
  credentials); Phase 2 is code-complete and unreleased.
- The supervisor example's model is scripted: it demonstrates the report channel, not a live
  model choosing where to route.
- The claim board's compare-and-set is per parent-record generation, so two processes mutating
  different rows still race on the parent's fence; a lost commit is a typed refusal, not a merge.
- A background child's agent must be built with the same store as the parent, or its record never
  lands; `startBackgroundChild` documents this rather than enforcing it.
- `run.transfer` names a target; starting that target's run is the caller's job. Nothing resumes
  it automatically.
