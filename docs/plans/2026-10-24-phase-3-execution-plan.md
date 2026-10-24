# Phase 3 — memory and streams: execution plan

**Date:** 2026-10-24 · **Status:** in_progress · **Owner:** lead · **Parent:**
[apply the competitor findings](2026-10-22-apply-the-competitor-findings-plan.md), rows 3.1–3.2.

**Contract**
- **Role:** the working plan for Phase 3 — item order, the design each item lands, and the
  acceptance tests registered before any code is written.
- **Mutability:** history plus a live checklist. Append to `## Changes` when an item lands or a
  criterion proves wrong; never rewrite a landed entry.
- **Read when:** executing or reviewing Phase 3.
- **Update when:** an item lands, a registered test proves its design wrong, or the phase ends.

## Why this phase

Phase 1 made one run durable and Phase 2 made a second agent part of that durability. Phase 3
makes the *history itself* durable: a long run condenses without losing what it forgot, and a
client that was away can follow the event stream from where it stopped instead of replaying it.
Both ride the run record that already exists — no new store, no new backend.

## Invariants

1. **Memory is append-only.** Condensation adds a step; it never rewrites or deletes a stored
   step. The forgotten ids stay addressable on the record, so the loss is a named fact.
2. **The projection is read-time.** The transcript handed to the model hides forgotten steps and
   shows their summary; the record keeps both. A reload projects the same way, because the
   projection is a pure function of the stored steps.
3. **No new store backend.** The Phase 1 `RunStore` seam is untouched; the event log is one more
   additive optional field on the run record, and the cursor reads it through `load` and
   `watch`.
4. **A cursor is delivery, not replay.** It promises a client the events after a sequence number;
   it does not promise byte-exact resumption of a provider stream or of a run's execution.
5. **The surface is opt-in.** No existing run condenses unless it configures `condensation`, and
   no record grows an event log unless the run has a store. Defaults keep both off.
6. **Each item's tests exist here before its code, and are seen red first.**

## Pre-registered acceptance tests

| item | test file | cases that must fail first |
|---|---|---|
| 3.1 | `packages/core/test/condensation.test.ts` (52nd core file) | a long fixture session crosses the soft limit and emits one `memory.condensed` event naming the forgotten step ids and a summary; the model transcript no longer contains a forgotten step's text but does contain the summary, and still contains the system prompt and the task; the record keeps every step and the condensation step, and a reload projects identically without condensing again; the hard trigger condenses with a deterministic summary even when the summarizer throws, while a soft trigger defers and leaves the transcript intact; a message step, the task, the system prompt and the last `keepRecent` steps are never forgotten; `buildTrace` shows the forgetting as a span carrying the forgotten ids and the trigger |
| 3.2 | `packages/core/test/event-log.test.ts` (53rd core file) | every emitted event carries a strictly increasing `seq`, and a durable run records its events on the record at each commit; `readEvents` with no cursor returns the retained log and a cursor equal to the last seq; `readEvents` with a cursor returns only the events after it and the same cursor; a second `FileRunStore` over the same files follows from a cursor without replaying the log; the retained log is bounded, so a cursor below the retained base reports `truncated` instead of silently skipping |
| 3.2 | `packages/react/test/use-run-events.test.ts` (12th react file) | the hook reads from the store at its cursor, renders only the events after it, and appends a new event when a later commit arrives |
| exit | `packages/core/test/phase-3-exit.test.ts` (54th core file) | a long fixture session condenses and its trace shows the forgetting event; a reconnecting reader with a cursor receives only the events after its cursor, across a second store over the same files |

## Item designs

### 3.1 Condensation as a step and an event

New internal step kind, `"condensation"`, in `packages/core/src/memory/steps.ts`:

```ts
class CondensationStep extends AgentStep {
  readonly kind = "condensation";
  readonly summary: string;
  readonly forgotten: readonly string[];
  readonly trigger: "soft" | "hard";
}
```

`StepJSON` gains the matching variant, so a record round-trips the step like any other and the
class does not need a public export. `AgentMemory` gains a read-time projection: the forgotten
set is the union of every condensation step's `forgotten`; `toMessages` renders each summary as a
user turn after the task ("Earlier steps, condensed:\n" + summary) and skips the forgotten steps
where they sat. The stored steps, and therefore the record, keep everything.

`AgentOptions.condensation` is the opt-in:

```ts
interface CondensationOptions {
  readonly softLimit: number;             // estimated tokens; a condensation is due
  readonly hardLimit: number;             // estimated tokens; the next model step is unsafe
  readonly keepRecent?: number;           // steps never forgotten; defaults to 4
  readonly summarize?: (forgotten, transcript) => string | Promise<string>;
  readonly estimate?: (messages) => number; // defaults to ceil(chars / 4)
}
```

The loop checks at each step boundary, before the transcript is built. Over the soft limit it
condenses the oldest steps beyond `keepRecent` using `summarize`; a summarizer that throws
defers to the next step and emits nothing. Over the hard limit it condenses with a deterministic
summary even if the summarizer throws, so the run can proceed. Protected and never forgotten: the
system prompt, the task, every `message` step and the last `keepRecent` steps. The event is
`{ type: "memory.condensed"; forgotten: readonly string[]; summary: string; trigger: "soft" | "hard" }`,
non-terminal and non-advisory; `buildTrace` folds it into a child span of the run named
`memory.condensed` with `forgotten`, `trigger` and `summary` attributes.

3.1 adds no runtime export: the step class, the option type and the event variant are type-level or
internal. The memory suite pins the behavior, not a name.

### 3.2 A resumable stream cursor

`AgentEvent` gains `seq: number`, assigned in the loop's single `emit` helper from a per-run
counter that starts at the record's last seq on a resume. `RunRecord` gains one additive field:

```ts
readonly events?: readonly RunEventEntry[];   // { seq, event } tail, newest last
```

`commitRun` appends the events buffered since the previous commit, keeping at most
`maxRecordedEvents` (default 256); the retained base is the first entry's seq. The reader is one
function:

```ts
readEvents(store, runId, fromSeq = 0): Promise<{ events: readonly AgentEvent[]; cursor: number; truncated: boolean }>
```

`cursor` is the last seq the record holds (0 when it holds none); `truncated` is true when
`fromSeq` is older than the retained base, and the returned events start at the base rather than
silently skipping. Reading writes nothing and resumes nothing.

`packages/react` gains `useRunEvents(store, runId, { fromSeq } = {})`: it reads at the cursor,
subscribes through `store.watch`, and appends only the events after it, returning
`{ events, cursor, truncated }`. A reconnect is the same call with the cursor the client kept.

## Public-surface accounting

- 3.1: `CondensationStep` is a runtime export — an exported `AnyAgentStep` union cannot name a
  private class, so the step class is pinned: core 113 → 114. (The plan first said 3.1 added no
  runtime export; the compiler proved otherwise, and the `## Changes` entry records it.)
- 3.2: `readEvents` is a new core runtime export — core pins 114 → 115.
- 3.2: `useRunEvents` is a new react runtime export — react pins 12 → 13.
- The exit test adds no export.

## Verification per item

1. Run the item's new file before any code; watch it fail for the reason the table gives.
2. Implement to green.
3. Update the execution plan's `## Changes`, the scoped `packages/core/AGENTS.md` (and
   `packages/react/AGENTS.md` for 3.2) counts, a handoff entry, and `docs/04-tasks.md` if a row
   moves. `docs/00-schema.md` owns the pack's records, not the run record, so it does not change.
4. `pnpm gate` exits 0, the validator reads 0/0, rotation is clean, and each item is one commit. Nothing is pushed.

## Close plan

Run the parent plan's exit criterion as `phase-3-exit.test.ts`; write the phase report under
`docs/reports/` with the evidence; check the parent plan's Phase 3 rows against the code; close
the phase task; handoff entry; final gate and commit.

## Changes

*(newest first; an entry is written when an item lands or a criterion proves wrong)*

- **2026-10-24 — 3.2 as built.** Every emitted event carries a `seq` assigned once by the loop's
  `emit`, starting at 1; a durable run reads its record before `run.started` so the first new
  event follows the recorded tail, and the claim still compare-and-sets the generation. The record
  gains an additive `events` tail (default cap 256 via `AgentOptions.maxRecordedEvents`), and
  terminal events are numbered before their terminal commit so the tail ends with the event a
  reconnecting reader needs; a guardrail-refused answer drops its uncommitted events, as it
  already redacted the step and journal. `readEvents(store, runId, fromSeq)` returns the events
  after the cursor, the record's last seq, and `truncated` when the cursor is older than the
  retained base (cursor 0 means "nothing seen"; seqs start at 1 so base 1 is complete). The react
  `useRunEvents` reads at the cursor, follows `store.watch`, and appends only later events. The
  action pipeline yields payloads and `drainAction` is the single emitter, so no event is numbered
  twice. Core 53 files/603 tests; react 12/56; pins core 115, react 13; `pnpm gate` exit 0.

- **2026-10-24 — 3.1 as built.** `CondensationStep` (kind `condensation`) carries a summary, the
  forgotten step ids and the trigger; `AgentMemory` projects at read time — the forgotten ids are
  dropped from the transcript and each summary renders as an "Earlier steps, condensed:" user
  turn, so the stored steps stay and a reload projects identically. `AgentOptions.condensation`
  is opt-in (`softLimit`, `hardLimit`, `keepRecent` default 4, optional `summarize` and
  `estimate`); the loop checks at each step boundary, forgets only action and planning steps
  beyond `keepRecent`, never the system prompt, the task or a message step, and emits
  `memory.condensed`. A soft trigger whose summarizer throws defers; a hard trigger falls back to
  "Condensed N earlier step(s)." `buildTrace` folds the event into a `memory.condensed` span.
  The test file has six cases, one more than the table's five clauses (the hard and the soft
  summarizer paths are separate cases). Core 52 files/598 tests; pins 114; `pnpm gate` exit 0.


