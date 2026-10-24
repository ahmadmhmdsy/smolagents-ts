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
## 2026-10-25T02:30:00+03:00 — Phase 4 opened: protocol and tool breadth

**State.** Phase 4 is open and nothing in it has landed yet. `T-45` is the row that carries it.

**Did.** Wrote `docs/plans/2026-10-24-phase-4-execution-plan.md`: eight items, each with the
acceptance tests registered before its code, a design, the public-surface accounting (mcp 29 → 32,
core 108 → 110, exec-remote root 9 → 10) and a close plan. Opened `T-45` in `docs/04-tasks.md`,
moved the parent plan's row, and narrowed `T-40`'s gate cell to name the open phase.

**Verified.** Validator reads 0 errors / 0 warnings; rotation is clean; `pnpm gate` exits 0.

**Unverified / open.** No Phase 4 item is implemented. The pin counts above were measured from each
package's pinned list; the Phase 3 report's "core 115" does not match the 108-name list, so this
phase counts from the list itself.

**Next.** 4.1: write `packages/mcp/test/client-depth.test.ts` and watch it fail.

**Blockers.** None.

**Artifacts.** `docs/plans/2026-10-24-phase-4-execution-plan.md:1`; the `T-45` row in
`docs/04-tasks.md`.

## 2026-10-25T02:05:00+03:00 — Phase 3 closed: memory and streams

**State.** Phase 3 is complete; 3.1 and 3.2 are landed and the exit criterion runs as two cases.
`T-44` is done and the parent plan's row says so. Nothing pushed; Phase 4 is not opened.

**Did.** The exit test `phase-3-exit.test.ts` (54th core file) runs the parent plan's criterion
over a `FileRunStore`: a three-note session condenses, `buildTrace` carries a
`memory.condensed` span whose forgotten ids equal the event's, and the record keeps the step and
the event; a reader's kept cursor, followed through a second store over the same files after a
continuation, returns exactly the later events with the new cursor and no truncation. The report
`docs/reports/2026-10-24-phase-3-report.md` records the outcome, the evidence, the two parent rows
and the open items; the execution plan is marked complete with a close entry.

**Verified.** Core 54 files/605 tests, CLI 11/77, react 12/56; pins core 115, react 13. `pnpm
gate` exit 0; validator 0/0; rotate clean. Commits: 3.1 `4631f0c`, 3.2 `cc7e947`, close follows.

**Unverified / open.** Condensation thresholds are character estimates, not a tokenizer; the event
cap counts entries, not bytes; `useRunEvents` re-reads the retained tail per commit; a store that
never calls `watch` listeners leaves a live client stale until it remounts. Publishing still waits
on `T-14` credentials.

## 2026-10-25T01:40:00+03:00 — 3.2: the event log and the cursor

**State.** Phase 3 is open; 3.1 and 3.2 are landed, and the exit criterion is next. `T-44` stays
in progress. Nothing pushed.

**Did.** Every event now carries a `seq` assigned once by the loop's `emit`, starting at 1, and
the action pipeline yields payloads so `drainAction` is the only emitter. A run that resumes a
durable record reads it before `run.started`, so numbering continues the recorded tail; the
record gains an additive `events` field capped by `AgentOptions.maxRecordedEvents` (default
256). Terminal events are numbered before their terminal commit, so the stored tail ends with the
event a reconnecting reader needs, while a guardrail-refused answer drops its uncommitted events.
`readEvents(store, runId, fromSeq = 0)` returns the events after the cursor, the record's last
seq, and `truncated` when the cursor is older than the retained base. The react
`useRunEvents(store, runId, { fromSeq })` reads at the cursor, follows `store.watch`, and appends
only later events.

**Verified.** `event-log.test.ts` (53rd core file, four cases) green: seqs strictly increasing
from 1, a durable tail read from a second store, truncation at `maxRecordedEvents: 3`, and a
continuation with `reset: false` resuming from the first cursor. `use-run-events.test.ts` (12th
react file, four cases) green: the recorded tail and cursor, a reconnect delivering only later
events, a live run appended once each, and a truncated cursor. Core 53 files/603 tests, react
12/56; pins core 115, react 13; typecheck clean across the workspace (the CLI renderer's
hand-built events now fill `seq`).

**Unverified / open.** The cap counts entries, not bytes, so a chatty run keeps a shorter time
window than a quiet one. The react hook re-reads the retained tail on each commit rather than a
diff, so a chatty store costs one read per commit. `RunStore.watch` is advisory, so a store
that never notifies still leaves the initial read correct.

## 2026-10-25T01:15:00+03:00 — 3.1: condensation as a step and an event

**State.** Phase 3 is open; 3.1 is landed, 3.2 (the event-log cursor) is next. `T-44` stays
in progress. Nothing pushed.

**Did.** `CondensationStep` (kind `condensation`) carries the summary, the forgotten step ids and
the trigger. `AgentMemory` projects at read time: forgotten ids are dropped from the transcript
and each summary renders as an "Earlier steps, condensed:" user turn, so the stored steps stay
and a reload projects identically. `AgentOptions.condensation` is opt-in (`softLimit`,
`hardLimit`, `keepRecent` default 4, optional `summarize` and `estimate`); the loop checks at
each step boundary, forgets only action and planning steps beyond `keepRecent`, and never the
system prompt, the task or a message step. It emits `memory.condensed`, which `buildTrace` folds
into a `memory.condensed` span. A soft trigger whose summarizer throws defers; a hard trigger
falls back to "Condensed N earlier step(s)."

**Verified.** `condensation.test.ts` (52nd core file, six cases) green, including a reloaded
record projecting once per condensation and a trace carrying the forgotten ids. Core 52
files/598 tests; pins 114; lint clean. `pnpm gate` exit 0; validator 0/0; rotate clean.

**Unverified / open.** The thresholds are estimates over characters, not a provider tokenizer;
the soft and hard defaults are first values. A hard condensation while a summary already covers
the same steps cannot happen (forgotten ids are filtered), but repeated condensations each render
their own summary turn.

**Next.** 3.2: `seq` on every event, the additive `events` tail on the record, `readEvents` and
the react `useRunEvents`.

**Blockers.** None; the six owner-blocked rows are unchanged.

**Artifacts.** `packages/core/src/memory/steps.ts`; `packages/core/src/memory/memory.ts`;
`packages/core/test/condensation.test.ts`.

## 2026-10-25T00:45:00+03:00 — Phase 3 opened

**State.** The owner opened Phase 3 (memory and streams). The plan is written with both items'
acceptance tests pre-registered; no item has started. `T-44` is the live row. Nothing pushed.

**Did.** `docs/plans/2026-10-24-phase-3-execution-plan.md` cuts the phase into 3.1 (condensation
as a step and an event, with a read-time projection, soft and hard triggers, protected system
prompt, task, messages and a `keepRecent` window) and 3.2 (a resumable event-log cursor:
`seq` on every event, an additive `events` tail on the record, `readEvents` and a react
`useRunEvents`). The exit criterion runs as `phase-3-exit.test.ts` (54th core file). The
parent plan's row and `T-44` say the phase is in progress. Also committed at `5d51ef4`: the
owner's two general-memory entries, the registry count and the three OmniRoute research files
that were left uncommitted.

**Verified.** Plan committed; the working tree was clean before it. Nothing implemented yet, so
no gate claim belongs to this entry.

**Unverified / open.** The thresholds (soft 6000, hard 12000 estimated tokens, `keepRecent` 4)
are first values and may move when 3.1's fixture is measured; the plan says so rather than
pretending they are calibrated. 3.2's `maxRecordedEvents` default of 256 is likewise a first
value.

**Next.** 3.1: write `condensation.test.ts` first, watch it fail, then implement.

**Blockers.** None; the six owner-blocked rows are unchanged.

**Artifacts.** `docs/plans/2026-10-24-phase-3-execution-plan.md`.
<!-- rotate:end -->
