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

## 2026-10-24T23:30:00+03:00 — 2.5: the supervisor shape

**State.** Phase 2 is open; 2.1–2.7 are landed except 2.8 (claim board). Next is 2.8, then the
phase close. Nothing pushed.

**Did.** `examples/supervisor/` declares two managed agents with output schemas. The researcher's
answer validates; the auditor's omits the `confidence` field its schema requires. The schema sits
on the `ManagedAgent` entry, not on the child agent, so the mismatch lands in the report's
`schema` channel (`ChildSchemaError`, `issues: ["confidence: invalid_type"]`) instead of the
child's own guardrail. The sample calls both through `runManagedAgent` — the path the
model-facing tool uses — and routes on the reports: the researcher's value and the auditor's
failure produce the `hold` route and an answer stating both outcomes. It ships
`package.json`, `tsconfig.json` with a `typecheck` script, its own `vitest.config.ts` project,
a README and a test, and the examples index gained its row.

**Verified.** `pnpm vitest run --project example-supervisor` green; `pnpm --filter
example-supervisor run typecheck` clean; `pnpm --filter example-supervisor run start` prints
`route: hold` and both reports. `pnpm gate` exit 0; validator 0/0; rotate clean.

**Unverified / open.** The sample's model is scripted; it shows the report channel, not a live
model deciding where to route. 2.8 is the last item before the close.

**Next.** 2.8: the claim board with revision compare-and-set, blockers and tombstones.

**Blockers.** None; the owner-blocked rows were unchanged.

**Artifacts.** `examples/supervisor/src/index.ts`; `examples/supervisor/test/example.test.ts`.

## 2026-10-24T23:10:00+03:00 — 2.4: a child the parent can find again

**State.** Phase 2 is open; 2.1, 2.2, 2.3, 2.4, 2.6 and 2.7 are landed. Next is 2.5 (supervisor
example), then 2.8 (claim board), then the phase close. Nothing pushed.

**Did.** `agent/background-child.ts` starts a child that outlives the call. The parent record
gains a `children` row — `provisioning`, then `active`, then `completed`/`failed` carrying the
typed `ChildReport` — each write its own commit at the parent's next fence. The child runs under
its own id with `parentRunId` on its record, so the two records point at each other. The cap
(default 4) counts rows in `provisioning`/`active` and refuses the next start with
`ChildLimitError` before writing anything. `listChildren` reads rows and resumes nothing;
`resumeBackgroundChild` returns a stored report, adopts a child record behind a `provisioning`
row, fails a row that has no record, and resumes an unfinished child.

**Verified.** `background-child.test.ts` (49th core file, 5 cases) green: the parent commits
provisioning and then completed rows and the child record names `parentRunId`; a start over the
cap is `ChildLimitError` and writes nothing; listing twice is stable and commits nothing; cold
resume adopts a completed record and fails a recordless row; a child's typed failure report lands
on its row with a bounded message. Core 49 files/571 tests (four new pins); CLI 11/77.
`pnpm gate` exit 0; validator 0/0; rotate clean.

**Unverified / open.** The child's agent must be built with the same store; the helper cannot
check that. Rows are written by the parent's record, so a concurrent parent commit can lose a row
write to `StaleWriterError` — 2.5 keeps the supervisor idle while it starts children.

**Next.** 2.5: the supervisor example with two schema'd managed agents, one failing.

**Blockers.** None; the owner-blocked rows were unchanged.

**Artifacts.** `packages/core/src/agent/background-child.ts`;
`packages/core/test/background-child.test.ts`.
<!-- rotate:end -->
