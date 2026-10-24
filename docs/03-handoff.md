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

## 2026-10-24T23:55:00+03:00 — 2.8: a claim board, not a data blackboard

**State.** Phase 2's items 2.1–2.8 are all landed. What remains is the close: the exit criterion
as `phase-2-exit.test.ts`, the phase report, the parent-plan check and the T-43 row. Nothing
pushed.

**Did.** `session/claim-board.ts` keeps rows on the parent record under `board`. A row is
`{ id, title, owner?, status, blockers, writeScopes, revision, updatedAt }` and has no payload
field; write scopes are recorded as advisory and never enforced. Every mutation — create, claim,
update, complete, tombstone — loads the record, checks the row's revision against the caller's
expectation and commits at the parent's next fence. A stale revision is
`TaskStaleRevisionError`; a claim whose blockers are not all `done` is `TaskBlockedError`; a
tombstone stays in the list with status `deleted` and refuses every mutation with
`TaskDeletedError`. `listBoard` reads and writes nothing.

**Verified.** `claim-board.test.ts` (50th core file, 5 cases) green: the five mutations bump the
revision in order (0→4), a stale revision is refused with the row untouched, a blocked claim
waits for its blocker and then succeeds, a deleted row keeps its tombstone and refuses claim,
update and delete, and the row carries exactly the documented keys with scopes recorded. Core
50 files/585 tests (nine new pins); CLI 11/77. `pnpm gate` exit 0; validator 0/0; rotate clean.

**Unverified / open.** The board's CAS is per record generation: two processes mutating different
rows still race on the parent's fence, so a lost commit is a refusal rather than a merge.

**Next.** The Phase 2 close: `phase-2-exit.test.ts`, the phase report, the parent-plan check, the
T-43 row, a final gate and one commit.

**Blockers.** None; the owner-blocked rows were unchanged.

**Artifacts.** `packages/core/src/session/claim-board.ts`;
`packages/core/test/claim-board.test.ts`.
<!-- rotate:end -->
