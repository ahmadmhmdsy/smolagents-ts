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

## 2026-10-24T22:50:00+03:00 — 2.2: a handover the record can name

**State.** Phase 2 is open; 2.1, 2.2, 2.3, 2.6 and 2.7 are landed. Next is 2.4 (bounded background
child), then 2.5 (supervisor example) and 2.8 (claim board). Nothing pushed.

**Did.** `agent/transfer.ts` declares a `TransferTarget { name, description, agent }` and builds
its `transfer_to_<name>` tool. The tool's name is derived from the declaration, so a target that
was not declared has no call the model can make; an invalid name, a blank description, a
duplicate name or a transfer to the agent itself throws `ToolDefinitionError` at construction.
Calling the tool returns a `TransferSignal { target, reason? }` instead of an answer. The loop
recognises the signal only among the transfer tools it built, commits the step boundary with
`transfer` on the record, and ends the run with the new terminal `run.transferred` event,
`RunResult.state === "success"` and `RunResult.transfer`. The target's run is the caller's to
start (2.5).

**Verified.** `transfer.test.ts` (48th core file, 5 cases) green: one named tool per
declaration, a call ending the run with the target on result and record and one terminal
`run.transferred` with no `run.completed`, invalid declarations throwing `ToolDefinitionError`,
an undeclared target staying an ordinary tool error, and a run without a transfer carrying no
`transfer` key. Core 48 files/562 tests (four new pins); CLI 11/77 with the renderer printing the
target. `pnpm gate` exit 0; validator 0/0; rotate clean.

**Unverified / open.** The target's run is not started by the transfer; a caller that forgets to
start it leaves a completed record naming a run that never happened. 2.5 must show the supervisor
starting it.

**Next.** 2.4: a bounded background child with its own row on the parent record.

**Blockers.** None; the owner-blocked rows were unchanged.

**Artifacts.** `packages/core/src/agent/transfer.ts`; `packages/core/test/transfer.test.ts`;
`packages/core/src/events.ts`; `packages/core/src/agent/run-result.ts`.
<!-- rotate:end -->
