# Phase 3 — memory and streams: completion report

**Date:** 2026-10-24 · **Repository:** `E:\python_projects\smolagents_ts` (branch
`main`) · **Plan:** [Phase 3 execution plan](../plans/2026-10-24-phase-3-execution-plan.md)
(parent: [apply the competitor findings](../plans/2026-10-22-apply-the-competitor-findings-plan.md))

**Contract**
- **Role:** report — the completion record of Phase 3 and the evidence for its exit criterion.
- **Mutability:** history — corrected only by appending a new section; measured numbers are
  never rewritten.
- **Read when:** checking what Phase 3 landed, how the memory and stream surfaces are shaped, or
  which open items were left for a later phase.
- **Update when:** a claim here stops describing the code, which is a new report rather than an
  edit to this one.

The numbers below describe the tree at the close commit; for live status read `docs/03-handoff.md`.

**Status:** complete. Items 3.1–3.2 are landed, tested, documented and committed; the plan's
Phase 3 exit criterion runs as two cases in `packages/core/test/phase-3-exit.test.ts`. Nothing is
pushed; `main` remains ahead of `origin/main`.

## Outcome

A long run now forgets on purpose and says so. `AgentOptions.condensation` is opt-in; when the
estimated history crosses the soft limit the loop adds a `condensation` step naming the summary,
the forgotten step ids and the trigger, then emits `memory.condensed`. The stored steps are
never rewritten: the transcript the model sees is projected at read time, with forgotten steps
dropped and each summary rendered as an "Earlier steps, condensed:" turn, so a reload projects the
same way and does not condense again. A hard trigger falls back to a deterministic summary if the
caller's summarizer throws, while a soft trigger simply defers.

The event stream is now addressable. Every event carries a `seq` assigned once by the loop's
`emit`, starting at 1; a run that resumes a durable record reads it before `run.started`, so
numbering continues the recorded tail. The record gains an additive, capped `events` field
(`AgentOptions.maxRecordedEvents`, default 256). `readEvents(store, runId, fromSeq)` returns the
events after the cursor, the record's last seq, and `truncated` when the cursor is older than the
retained base. The react `useRunEvents` reads at the cursor, follows `store.watch`, and appends
only later events, so a client that was away resumes instead of replaying.

## Verification evidence

| item | result |
|---|---|
| `pnpm gate` at the 3.2 commit (`cc7e947`) | exit 0 (typecheck, version:check, lint, depcruise, test, build, publint, attw, ci:check, pack:smoke, site:build) |
| core suite | 54 files, 605 tests pass |
| CLI suite | 11 files, 77 tests pass |
| react suite | 12 files, 56 tests pass |
| `packages/core/test/phase-3-exit.test.ts` | 2 passed (below) |
| public surface | core 115 pinned names, react 13; every new runtime export has a pin |
| context validator | 0 errors, 0 warnings |
| `python scripts/rotate.py --check` | clean |

## What landed

| item | commit | summary |
|---|---|---|
| 3.1 | `4631f0c` | `CondensationStep` (kind `condensation`) with summary, forgotten ids and trigger; read-time projection; opt-in `AgentOptions.condensation`; `memory.condensed` event and trace span |
| 3.2 | `cc7e947` | `seq` on every event; capped `events` on the record; `readEvents` cursor reads; react `useRunEvents` |

## Exit criterion

The parent plan's criterion is: "a long fixture session condenses and its trace shows the
forgetting event; a reconnecting client receives only events after its cursor."

`packages/core/test/phase-3-exit.test.ts` runs exactly those two cases:

1. a session over a `FileRunStore` with three notes crosses the soft limit: at least one
   `memory.condensed` event names forgotten ids, `buildTrace` carries a `memory.condensed` span
   whose `forgotten` attribute equals the event's, and the record keeps both the condensation step
   and the event, so a reload sees the same forgetting.
2. a reader takes the cursor after the first turn; a second turn continues the same run through a
   second `FileRunStore` over the same files; reading from the kept cursor returns exactly the
   second turn's events, every `seq` greater than the cursor, with the record's last seq as the new
   cursor and no truncation.

## Parent-plan check

| parent plan row | landed as |
|---|---|
| 3.1 a session that condenses without losing what it forgot, with the forgetting visible in the trace (`HL-11`) | `CondensationStep`, `AgentOptions.condensation`, `memory.condensed`, `buildTrace` span |
| 3.2 a cursor a client resumes from, so a reconnect delivers only later events (`RT-09`) | `seq`, record `events`, `readEvents`, react `useRunEvents` |

One difference from the execution plan's text: the pre-registered react test path ends in
`.ts`, while the file is `use-run-events.test.tsx` — the react project's hook tests are all
`.tsx` and the test file is otherwise exactly the registered one (four cases).

## Open

- `T-44` closes with this report. Phase 3 is code-complete and unreleased; publishing still waits
  on `T-14` credentials.
- The condensation thresholds are character estimates, not a provider tokenizer; soft 6000 and hard
  12000 are first values, overridable through `estimate`.
- The event cap counts entries, not bytes, so a chatty run keeps a shorter time window than a quiet
  one; `maxRecordedEvents` is the tuning point.
- `useRunEvents` re-reads the retained tail on each commit rather than diffing, so a store that
  commits very often costs one read per commit.
- `RunStore.watch` is advisory: a store that never notifies still leaves the initial read correct,
  but a live client sees nothing new until it remounts.
