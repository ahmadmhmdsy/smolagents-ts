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

## 2026-10-25T00:20:00+03:00 — Phase 2 closed

**State.** Phase 2 (delegation that survives its parent) is complete: 2.1–2.8 landed, the exit
criterion proven, the report written, `T-43` done. Nothing pushed; `main` is ahead of
`origin/main`.

**Did.** `phase-2-exit.test.ts` (51st core file, 6 cases) runs the parent plan's criterion: a
background child's typed result re-attaches through `resumeBackgroundChild` after the parent
ended; a running child sees a send at its next step and a parked child resumes for one; a wait on
an ended or unknown run reports `noProgress` and claims nothing; a transfer survives a reload
through a second `FileRunStore`; every grandchild event carries `["researcher","writer"]`; a
claim at a consumed revision is `TaskStaleRevisionError`. `docs/reports/2026-10-24-phase-2-report.md`
records the evidence, the eight commits, the parent-plan check and the open items. The execution
plan is marked complete with a close entry; `T-43` moved to the archive with evidence; the
parent plan's row and `T-40`'s gate text say Phase 2 is closed.

**Verified.** Core 51 files/591 tests; CLI 11/77; public surface 113 pins; the supervisor
example's project green and typechecked. `pnpm gate` exit 0; validator 0/0; rotate clean.

**Unverified / open.** The release still waits on `T-14` credentials. The supervisor's model is
scripted. The board's CAS races on the parent's fence across processes, so a lost commit is a
typed refusal, not a merge. A background child's agent must share the parent's store.

**Next.** No phase row is open; the next one starts when the owner opens it. Phase 3 in the parent
plan (context and compaction) is the next cut if the owner continues.

**Blockers.** None; the six owner-blocked rows are unchanged.

**Artifacts.** `packages/core/test/phase-2-exit.test.ts`;
`docs/reports/2026-10-24-phase-2-report.md`.
<!-- rotate:end -->
