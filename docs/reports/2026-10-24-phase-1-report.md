# Phase 1 — the durability spine: completion report

**Date:** 2026-10-24 · **Repository:** `E:\python_projects\smolagents_ts` (branch
`main`) · **Plan:** [Phase 1 execution plan](../plans/2026-10-24-phase-1-execution-plan.md)
(parent: [apply the competitor findings](../plans/2026-10-22-apply-the-competitor-findings-plan.md))

**Contract**
- **Role:** report — the completion record of Phase 1 and the evidence for its exit criterion.
- **Mutability:** history — corrected only by appending a new section; measured numbers are
  never rewritten.
- **Read when:** checking what Phase 1 landed, what the two-process run did, or which open
  items were left for a later phase.
- **Update when:** a claim here stops describing the code, which is a new report rather than an
  edit to this one.

This report describes the tree as it stood at the close commit; it is not a live
status answer.

**Status:** complete. Items 1.1–1.8 are landed, tested, documented and committed; the plan's
Phase 1 exit criterion is proven both in a test and in a manual run of two separate OS
processes. Nothing is pushed; `main` remains ahead of `origin/main`.

## Outcome

A run is now a record, not a checkpoint of steps. The record (`RunRecord`, schema version 2)
carries the run id, an optional conversation id and parent pointer, a generation, an owner, the
open step, a completed flag, the effects journal, the memory snapshot and the pending request
with its settlements. One loop surface (`commitRun`) is the only writer; the store implements
compare-and-set commit, load, claim and `latestForConversation` over a file-system seam. The CLI
parks a durable run on an approval (exit 3), resumes it by run id or conversation with
`--approve`, and forks a run from a named step without repeating effects.

## Verification evidence

| item | result |
|---|---|
| `pnpm gate` at the last item commit (`542e5b1`) | exit 0 (typecheck, version:check, lint, depcruise, test, build, publint, attw, ci:check, pack:smoke, site:build) |
| store contract | thirteen modes, three stores certified (memory, async memory, `FileRunStore`) |
| `packages/cli/test/phase-1-close.test.ts` | 2 passed: park → competing claim refused → resume → completed, and crash-after-tool repaired without repeating the effect |
| manual two-process run (below) | process 1 parks with exit 3 and no effect; process 2 resumes, settles once, exits 0; record `completed`, settlements `allowed-once` |
| context validator | 0 errors, 0 warnings |
| `python scripts/rotate.py --check` | clean |

## What landed

| item | commit | summary |
|---|---|---|
| 1.1 | `166903a` | the record type, the single commit boundary, `checkpoint` → `runId` |
| 1.2 | `9b21ad5` | a pending request as state, with `resume(requestId, value)` and settlements |
| 1.3 | `4d87cae` | one owner by generation claim; stale writers refused typed; repair-forward closers |
| 1.4 | `19fcd1f` | the effects journal: model requests and wrapped tool calls recorded, replayed, and explicit in-doubt |
| 1.5 | `8fe83ee` | `FileRunStore` over a `RunFileSystem` seam, certified by the conformance suite |
| 1.6 | `56e6503` | `--resume` and `--approve` in the CLI, parking once per tool call with exit 3 |
| 1.7 | `a841c5c` | conversation identity; `latestForConversation` as the thirteenth contract mode; `--conversation` |
| 1.8 | `542e5b1` | fork from a named step; `--fork`/`--fork-step`; parent pointer on the record |

## Exit criterion

The plan's exit criterion is: "In a single test: a run pauses on an approval, the first process
stores it, a second process reads the record, refuses a wrong owner, resumes with `resume`, and
finishes; separately, a crash injected after a tool call resumes without repeating it."

`packages/cli/test/phase-1-close.test.ts` does exactly that in two cases. The first parks through
the real CLI run function (exit 3, counter 0), loads the record from a second `FileRunStore`,
shows that a claim at another generation is refused with `RunClaimedError`, claims the recorded
generation, resumes with `--approve`, and finishes (exit 0, counter 1, settlement `allowed-once`).
The second injects a crash through a store that dies on the first commit after a tool result
reached the record: the file keeps the running record with the tool's `done` journal entry and no
action step in memory; the resume repairs the step from the journal, leaves the counter at 1 and
completes.

### Manual two-process run

Run against the built `dist` with `MockModel` and `ScriptedExecutor` (no provider, no key), two
separate `node` processes sharing `.smolagents-demo/`. The tool writes a counter file, so the
number of effects is visible across processes.

```text
$ node demo-process-1.mjs
...
Approval pending: double (call c-double)
Run waiting on request c-double for "double" (run demo-run)
Resume it with --resume demo-run --approve <requestId>.
exit 3 counter 0

$ node demo-process-2.mjs
...
Final answer: finished
exit 0 counter 1 request c-double

$ read the record
completed allowed-once
```

Process 1 wrote the parked record and no effect; process 2 read it, settled the one request and
finished; the counter proves the effect ran exactly once. The scratch scripts and state directory
were deleted after the run.

## Parent-plan check

| parent plan row | landed as |
|---|---|
| 1.1 record type, one commit boundary, `checkpoint` → `runId` (`HL-03`, `HL-04`, `HL-09`) | `run-record.ts`, `commitRun`; `0023` |
| 1.2 pending request as state (`HL-02`, `HL-06`) | `pending`, `settlements`, `resume` |
| 1.3 one owner, refuse stale writer, repair forward (`HL-04`) | generation claim, typed refusals, synthetic closers |
| 1.4 effects journal and in-doubt state (`HL-05`) | journal entries, replay, `EffectOutcomeUnknownError` |
| 1.5 file store passing the 0.8 suite (`HL-09`) | `file-run-store.ts`; the suite became thirteen modes at 1.7 |
| 1.6 `--resume` and `--approve` (`CL-03`) | `args.ts`, `run.ts`, exit code 3 |
| 1.7 conversation identity (`HL-08`) | `conversationId`, `latestForConversation`, `--conversation` |
| 1.8 fork or replay from a named step (`HL-07`) | `fork` option, `--fork`/`--fork-step`, parent pointer |

Two differences from the parent plan's text, both recorded in the execution plan's `## Changes`:

- the deliverable names "an agent fingerprint"; none of the eight items specifies it, so it was
  not landed. It remains a candidate follow-up rather than an implicit gap in an item.
- the "files likely affected" list is indicative: `agent-session.ts`, `run-result.ts` and
  `events.ts` needed no change; the file store, the fork suite and the CLI replaced that scope.

## Open

- A fork at a step whose journal holds an in-doubt `intent` would surface
  `EffectOutcomeUnknownError`; no test covers that combination yet.
- The CLI parks and resumes but has no interactive approval prompt: settling is the `--approve`
  flag with an explicit request id. That is deliberate (1.6), not a missing item.
- The durability brief's ten failure modes are covered by the contract's thirteen modes; no
  failure mode is described in the docs while the code does nothing.

## Verification commands

```text
pnpm vitest run --project cli test/phase-1-close.test.ts
pnpm vitest run --project core test/contract
pnpm gate
python scripts/validate_context.py --root . --baseline docs/.baseline.json
python scripts/rotate.py --check
```
