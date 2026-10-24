# Handoff archive -- 2026

Rotated entries, newest first. Rotation moves; it never deletes.

---

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

## 2026-10-24T22:35:00+03:00 — 2.7: a wait is an edge, not a poll

**State.** Phase 2 is open; the first slice (2.1, 2.3, 2.6, 2.7) is landed. Next is the second
slice: 2.2 (transfer), 2.4 (bounded background child), 2.5 (supervisor example), 2.8 (claim
board). Nothing pushed.

**Did.** `RunStore.watch(runId, listener)` is the contract's fourteenth mode: a commit or claim
that lands after registration hands the listener the record, the returned function
unsubscribes, and watching never writes. `MemoryRunStore` notifies synchronously; `FileRunStore`
notifies its own writes and reaches another process's through the optional
`RunFileSystem.watchFile`, which the CLI now binds to `fs.watchFile` with a 50 ms poll, so the
store's rename-into-place publish survives it. `session/wait.ts` exports `waitForRun`: the
baseline is the record read at call time, the wait resolves on the first notification whose
status, fence, step or updatedAt differs, times out and aborts without claiming, and answers
`noProgress` at once for an unknown or already terminal run.

**Verified.** `wait-for-run.test.ts` (47th core file, 5 cases) green: first edge, terminal
`noProgress` with no claim, timeout that releases its edge, abort with the generation unchanged,
and the contract mode run against both shipped stores. Core 47 files/553 tests (six of the new
cases are the contract mode on three stores); CLI 11 files/77 tests, including a file-watch case
over a real directory. `pnpm typecheck` clean; `pnpm gate` exit 0; validator 0/0; rotate clean.

**Unverified / open.** The second slice is not started. `watchFile` polls; a caller needing
sub-50 ms latency needs its own watcher.

**Next.** 2.2: a declared transfer target becomes a tool that ends the run with `run.transferred`
and a typed `TransferSignal`.

**Blockers.** None; the owner's blocked rows are unchanged.

**Artifacts.** `packages/core/src/session/wait.ts`; `packages/core/src/session/run-store.ts`;
`packages/core/src/session/file-run-store.ts`; `packages/cli/src/store.ts`.

## 2026-10-24T22:20:00+03:00 — 2.6: a send is an ordinary record entry, delivery a boundary

**State.** Phase 2 is open; 2.1, 2.3 and 2.6 are landed. Next is 2.7 (`waitForRun` and the
store's `watch` mode), then the second slice. Nothing pushed.

**Did.** `RunRecord.messages` keeps `RunMessage` entries and `sendRunMessage(store, runId, {from,
text})` appends one: it loads the record, refuses an unknown or ended run typed, commits at the
generation it read without taking a claim, and returns an `accepted` receipt — acceptance, not
processing. The loop joins messages another writer appended before every commit, so an effect's
commit cannot drop a send. At each step boundary it delivers the undelivered entries as an
ordinary `MessageStep`, stamps `deliveredAt` and `deliveredStep` in that same commit, and renders
the step as a user turn prefixed with its sender. A parked run accepts a send and delivers it on
the resumed step; a delivered entry is not delivered again.

**Verified.** `run-messages.test.ts` (46th core file, 10 cases) green, covering the receipt, a
running target's next step seeing the text (including the transcript), a parked run's resumed
step, no redelivery of a stamped entry, typed refusals, and the file-store round trip. Core 46
files/542 tests; `pnpm typecheck` clean; `pnpm gate` exit 0; validator 0/0; rotate clean.

**Unverified / open.** 2.7 and the second slice are not started. A send racing the loop's own
commit inside the same generation is resolved by the commit that lands last; the merge keeps the
common interleavings, not a distributed guarantee.

**Next.** 2.7: `RunStore.watch` as the fourteenth contract mode and `waitForRun`, which reads,
waits and never claims.

**Blockers.** None; the owner's blocked rows are unchanged.

**Artifacts.** `packages/core/src/session/messages.ts`; `packages/core/src/memory/steps.ts`;
`packages/core/test/run-messages.test.ts`.

## 2026-10-24T22:10:00+03:00 — 2.3: every event and record names its agent path

**State.** Phase 2 is open; 2.1 (typed child report) and 2.3 (agent path) are landed. Next is 2.6,
then 2.7, then the second slice. Nothing pushed.

**Did.** `AgentEvent` is the payload union intersected with an optional `agentPath`, and `emit`
writes the running context's path onto every event, so the runtime form always carries it. The
root run's path is empty; a managed child runs with its parent's path plus its own name, so a
second level reads `["researcher","writer"]`. `RunOptions.agentPath` seeds a run and
`RunRecord.agentPath` keeps it; both executor seams forward the path to every tool call's
`ToolContext`, which is how the managed-agent tool knows where to extend it. A caller-supplied
path is extended, never replaced.

**Verified.** `agent-path.test.ts` (45th core file, 5 cases) green: empty root path, one-level and
two-level child paths, the stored record path, and extension of a caller's path. Core 45
files/532 tests; `pnpm typecheck` clean across the workspace; `pnpm gate` exit 0; validator
0/0; rotate clean. Two exact event-shape assertions moved to `toMatchObject` because the event
contract grew a field.

**Unverified / open.** 2.6, 2.7, 2.2, 2.4, 2.5 and 2.8 are not started. A child's record is not
durable unless its own run names a run id; the path is on the record either way.

**Next.** 2.6: `sendRunMessage` writes an ordinary user-role message into a run's record and
returns a receipt; a running target sees it at its next step boundary, a parked one resumes.

**Blockers.** None; the owner's blocked rows are unchanged.

**Artifacts.** `packages/core/src/events.ts`; `packages/core/src/agent/multi-step-agent.ts`;
`packages/core/src/session/run-record.ts`; `packages/core/test/agent-path.test.ts`.

## 2026-10-24T21:45:00+03:00 — Phase 2 opened; 2.1 gives a child a typed report

**State.** Phase 2 (delegation that survives its parent) is open under
`docs/plans/2026-10-24-phase-2-execution-plan.md` and `T-43`. Item 2.1 is landed; 2.3, 2.6,
2.7, then 2.2, 2.4, 2.5 and 2.8 follow. Nothing pushed.

**Did.** The plan registers every item's acceptance test before code and records the design
each item lands. 2.1 added `child-report.ts`: `ChildReport<T>` carries a schema-validated
`value` or a `failure` channel, a `stopReason` (`success`/`failure`/`max_steps`/`waiting`),
and a diagnostic bounded to 300 characters with the task text and key-shaped tokens removed.
`ManagedAgent.outputSchema` is the declaration; `runManagedAgent` is the typed path; the
model-facing `managedAgent` tool keeps the Phase 1 report template.

**Verified.** The suite was red first (module missing), then 7 cases green; core 44 files/527
tests; `pnpm gate` exit 0; validator 0/0; rotate clean.

**Unverified / open.** 2.3, 2.6, 2.7 and the second slice (2.2, 2.4, 2.5, 2.8) are not
started. A schema failure reports issue paths and codes only, by design.

**Next.** 2.3: every event carries the agent path, enriched at emission, and the record keeps
the path its run ran under.

**Blockers.** None. `T-14`, `T-39`, `T-16`, `T-18` and `T-21` remain owner-blocked.

**Artifacts.** `docs/plans/2026-10-24-phase-2-execution-plan.md`;
`packages/core/src/agent/child-report.ts`; `packages/core/test/child-report.test.ts`.

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

**Blockers.** None for Phase 1; the owner-blocked rows were unchanged.

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

## 2026-10-24T18:55:00+03:00 — 1.5 landed: a store you can keep

**State.** Phase 1 items 1.1–1.5 are in the tree; Wave B has started. Core now ships a durable
store a caller can keep: `FileRunStore` writes one JSON file per run through an injected
filesystem seam, and the CLI binds that seam to `node:fs/promises`. Nothing is pushed.

**Did.** `RunFileSystem` (`read`, `write`, `rename`, `delete`, `list`) and
`FileRunStore` in core; one file named by the escaped run id, committed via a random temporary
name and a rename, with the temporary removed when the rename fails. A stale commit is refused
before anything is written. `packages/cli/src/store.ts` adds `nodeRunFileSystem(directory)` and
`DEFAULT_STATE_DIRECTORY`; it creates the directory on first write and refuses a non-flat name.
The conformance suite now certifies the shipped store over a real temporary directory (memory,
async memory, file — twelve modes each), and `test/file-run-store.test.ts` covers the torn write.

**Verified.** Core 42 files and 509 tests; CLI 9 files and 63 tests. Both typecheck. The core
acceptance test was red on the missing module first; the CLI test was re-run red with the binding
moved aside. `pnpm gate` exit 0.

**Unverified-open.** The stale check and the rename are per-process: two processes writing one
run are fenced by the claim at the loop, not by an atomic compare-and-set in the store. The
contract's record group is the twelve existing modes; `latestForConversation` belongs to 1.7.

**Next.** 1.6: `--run-id`, `--resume`, `--approve`, `--state-dir`; park with exit 3, resume
by id and approve, with a resume runbook.

**Blockers.** None. `T-14`, `T-39`, `T-16`, `T-18`, `T-21` stay owner-blocked.

**Artifacts.** `core/src/session/file-run-store.ts`, `core/test/file-run-store.test.ts`,
`cli/src/store.ts`, `cli/test/store.test.ts`, `docs/plans/2026-10-24-phase-1-execution-plan.md`.

## 2026-10-24T18:20:00+03:00 — 1.4 landed: effects journaled, not re-run

**State.** Phase 1 items 1.1–1.4 are in the tree; 1.4 closes Wave A. A run record now carries
an effects journal: every tool effect and every model request is announced (`intent`) before
it starts and completed (`done`) after it returns. A resumed run replays finished effects,
refuses to guess at an in-doubt non-idempotent one, and retries only a tool that declares
`idempotent`. Nothing is pushed.

**Did.** `RunRecord.journal` and `JournalEntry` (stepId is the attempt id; model request is
`toolName ""`); `EffectOutcomeUnknownError`; `ToolDefinition.idempotent`;
intent/result commits serialised through one tail promise; model requests journaled and replayed
without new usage; in-flight steps kept out of the durable `memory` (a park restores the last
boundary); the answer guardrail now redacts the journal too; `CodeAgent` hands its executor a
journaled tool registry. `JournalEntry`/`JournalState` exported; the public surface pinned
`EffectOutcomeUnknownError`.

**Verified.** Core 41 files and 503 tests, including six new journal cases in
`test/journal.test.ts`: intent before the effect, crash between steps, in-doubt effect refused,
idempotent retry recorded `unknown`, model replayed, code-agent effect replayed. `pnpm gate` exit 0.

**Unverified-open.** A replay inside generated code surfaces as a tool failure, not a loop
failure (recorded in the plan, not solved). 1.1's exact commit counts are superseded by journal
writes; the store test now asserts monotonic actions and one terminal commit.

**Next.** 1.5: the file store — `FileRunStore` over a `RunFileSystem` seam in core plus the Node
binding in `packages/cli`, certified against the twelve-mode contract first.

**Blockers.** None. `T-14`, `T-39`, `T-16`, `T-18`, `T-21` stay owner-blocked.

**Artifacts.** `docs/plans/2026-10-24-phase-1-execution-plan.md`,
`core/src/session/run-record.ts`, `core/src/agent/multi-step-agent.ts`,
`core/test/journal.test.ts`.

## 2026-10-24T17:40:00+03:00 — 1.3 landed: one owner at a time

**State.** Phase 1 items 1.1–1.3 are in the tree. A run record is fenced: `generation` is the
ownership fence and `owner` names the live holder. Continuing a stored run claims it first;
a `running` record left by a dead process is repaired forward (every step kept, one synthetic
`completed` closer naming the open step, then the run finishes). Nothing is pushed.

**Did.** `RunStore.claim(runId, expectedGeneration, owner)` plus `commit(..., expectedGeneration)`
with `RunClaimedError` / `StaleWriterError`; `RunRecord` gains `owner`, `step` and `completed`;
the loop opens a step when it adds it, closes it at the boundary, claims on continuation and
repairs a crashed record; terminal commits clear the owner. The contract gained `claim` and
`stale` modes (twelve now) with rejecting counterexamples; `MemoryRunStore` and the
temporary-file double fence; glossary gained **claim** and **generation (fence)**.

**Verified.** `pnpm gate` exit 0. Core 40 files and 496 tests, including three new run-store
cases: two resumers, exactly one claim and one `RunClaimedError`; a stale writer refused with
the stored record byte-identical and still resumable; a crashed record repaired and finished.

**Unverified-open.** An interrupted step's effects still run again on resume; the journal is
1.4. The two-resumer race is proven at the store seam, not yet across two processes (1.5).

**Next.** 1.4: the effects journal — `intent` before an effect, `done` after, replay `done`,
surface in-doubt as `unknown`; starting with its red acceptance test.

**Blockers.** None. `T-14`, `T-39`, `T-16`, `T-18`, `T-21` stay owner-blocked.

**Artifacts.** `docs/plans/2026-10-24-phase-1-execution-plan.md`, `agent/multi-step-agent.ts`,
`session/run-record.ts`, `session/run-store.ts`, `test/run-store.test.ts`.

## 2026-10-24T16:55:00+03:00 — 1.2 landed: a run can park on a request

**State.** Phase 1 items 1.1 and 1.2 are in the tree. A gated call may answer `pending`: the
run commits `waiting` with a `pending` request and ends with `run.waiting`. A later agent
resumes it with `RunOptions.resume {requestId, outcome}`, settles once, and re-enters the
unfinished step. Nothing is pushed.

**Did.** Added the fifth verdict and `ToolApprovalPendingError`; record fields `pending` and
`settlements`; `RunState "waiting"`; `run.waiting` and `run.resumed`; resume validation with
typed refusals (`RunNotFoundError`, `RunNotWaitingError`, `RunRequestMismatchError`,
`RunRequestExpiredError`, `RunAlreadySettledError`, `RunApprovalMismatchError`); the session's
`waiting` status and the React label; and a gate installed on resume even without a handler.

**Verified.** `pnpm gate` exit 0. Core 40 files and 479 tests, including six new resume cases:
park with digest, settle once, second resume reports settled, wrong id, digest mismatch, expiry.

**Unverified-open.** Two processes resuming one request still race: the claim and generation
fence are 1.3. A resumed step re-asks the model; the settlement binds by digest-and-step, so a
model that changes its arguments gets a typed refusal rather than a retry.

**Next.** 1.3: ownership CAS with a claim, `generation` bumped per claim, `RunClaimed`, repair
forward — starting with its red acceptance test.

**Blockers.** None. `T-14`, `T-39`, `T-16`, `T-18`, `T-21` stay owner-blocked.

**Artifacts.** `docs/plans/2026-10-24-phase-1-execution-plan.md`, `agent/approval.ts`,
`agent/multi-step-agent.ts`, `session/run-record.ts`, `test/session-resume.test.ts`.

## 2026-10-24T16:05:00+03:00 — 1.1 landed: a run has a record

**State.** Phase 1 is open and item 1.1 is in the tree. A run is now a `RunRecord` under a
`runId`: status, generation, memory steps, timestamps. `RunStore` is `commit`/`load`; the loop
commits at one boundary per step and once as terminal. `RunOptions.checkpoint` is renamed
`runId` and the durable id is the run's event identity. Nothing is pushed.

**Did.** Added `session/run-record.ts` (version 2, forward translation of the version 1
envelope and version 0 array, `RunRecordVersionError` for newer), rewrote `run-store.ts`, moved
the loop from `saveCheckpoint` to `commitRun`, made `complete()` commit `completed` before the
event, and made a throw that escapes the loop commit `failed`. Contract suite speaks records.

**Verified.** `pnpm gate` exit 0. Core 39 files and 466 tests. Public surface pins the new
names; `pnpm typecheck` across the workspace.

**Unverified-open.** Two-process use is not testable until the file store lands in 1.5. A
legacy translation leaves `runId` empty; the caller fills it from the store key.

**Next.** 1.2: the `pending` request and `resume`, starting with the red acceptance test.

**Blockers.** None. `T-14`, `T-39`, `T-16`, `T-18`, `T-21` stay owner-blocked.

**Artifacts.** `docs/plans/2026-10-24-phase-1-execution-plan.md`, `session/run-record.ts`,
`session/run-store.ts`, `test/run-store.test.ts`.

## 2026-10-24T15:20:00+03:00 — Phase 1 opened: the durability spine

**State.** Phase 0 is closed and pushed nowhere: ten correction commits, `pnpm gate`
exit 0, core 39 files and 460 tests. The owner said "continue to next phase", so Phase 1
is now open with its execution plan and `T-42` in `in_progress`. Nothing in Phase 1 has
landed yet. All the gated rows are unchanged: `T-14` waits on registry credentials,
`T-39` on the OmniRoute phase choice, `T-16`, `T-18` and `T-21` on owner decisions.

**Did.** Wrote [`docs/plans/2026-10-24-phase-1-execution-plan.md`](docs/plans/2026-10-24-phase-1-execution-plan.md):
eight strictly ordered items, each with a pre-registered acceptance test, a rollback and
a file scope, grounded in the durability brief and decision `0023`. Opened `T-42` with
the wave split: wave A is the record, the pending request, ownership and the journal
(1.1–1.4, one loop writer); wave B is the file store, the CLI flags, the conversation and
the fork (1.5–1.8).

**Verified.** Each criterion was checked against the shipped seam before being written:
the store still saves a `RunSnapshot` under `RunOptions.checkpoint`, `RunState` has two
values, and the Phase 0.8 contract suite is the one every store item extends. This entry
is docs only.

**Unverified / open.** No Phase 1 code exists, so no acceptance test has run. Four readings
are mine to prove or amend in `## Changes`: the
record's version 2 with a dual reader for v1/v0; `pending` as a fifth approval verdict;
the digest-and-step binding of a settled approval on replay; and a core file store over an
injected filesystem seam with the Node binding in the CLI.

**Next.** Write the 1.1 acceptance test red, then the record type and the one commit
boundary.

**Blockers.** None in this phase.

**Artifacts.** `docs/plans/2026-10-24-phase-1-execution-plan.md`,
`docs/04-tasks.md:56`, `docs/research/competitors/_synthesis/15-durability-design-brief.md`.

## 2026-10-24T14:20:00+03:00 — Phase 0 closed: all ten items landed

**State.** Phase 0 is done and `T-41` is `done`: ten correction items landed, each with
its pre-registered acceptance test, its plan entry, its handoff entry and its commit.
`pnpm gate` exits 0; core reports 39 files and 460 tests. Nothing is pushed, and the
unpublished `0.1.0` still waits on `T-14`'s credentials. `T-40` (the parent research
plan) stays `in_progress`: Phase 1 has not been opened.

**Did.** 0.10: the tool-calling agent advertises tools only to a model that claims
`toolCalls`, sends the bound schema in the prompt to one that does not, reads a JSON
text reply as the answer, and spends the bounded repair turn when the text answer has the
wrong shape. The acceptance test fails twice and then succeeds inside the attempt bound,
with no tool schema on the wire. No `packages/models` change was needed —
`CustomModel` already reports `toolCalls: false`.

**Verified.** `pnpm gate` exit 0; core 39 files, 460 tests; validator 0 errors,
0 warnings; `rotate.py --check` clean.

**Unverified / open.** Phase 1 is unopened. Two items remain parked outside this phase:
`MD-10` (deferred by the owner) and `T-14` (blocked on registry credentials). The
publication hold stands until the corrections ship.

**Next.** The owner picks the next phase (or a release); `T-40` is the row to reopen.

**Blockers.** None in this phase.

**Artifacts.** `docs/plans/2026-10-24-phase-0-execution-plan.md`,
`packages/core/src/agent/tool-calling-agent.ts`,
`packages/core/src/agent/multi-step-agent.ts`,
`packages/core/test/guardrail.test.ts`.

## 2026-10-24T13:45:00+03:00 — 0.9 landed: a budget record, a typed limit, a handle

**State.** Nine Phase 0 items in (0.1–0.9). Last one is 0.10: structured output on a
model that cannot call tools.

**Did.** Added `session/budget.ts`: requested limits (turns, output tokens, total
tokens) clamped by the deployment ceiling, a `RunBudget` record on the run context and in
`RunResult.budget`, and a caller-held `RunBudgetHandle` that continues the counters into
the next run. A resumed checkpoint without a handle seeds its counters from its own steps,
so the budget does not reset. Crossing a limit ends the run with a new terminal event,
`run.limitReached`, carrying the typed reason; the session status became `limit_reached`
and the React label and CLI line were updated for it (both gates caught the missing React
entry).

**Verified.** `pnpm gate` exit 0; core 39 files, 458 tests (seven new: clamping, the
three typed reasons, the seed, the run-level limit, the shared handle and the
non-resetting resume).

**Unverified / open.** The ceiling is a module constant, not configuration; 0.9 has no
deployment-level wiring. A handle is in-memory only, so a process restart still needs the
checkpoint path to continue a budget.

**Next.** 0.10: bound a schema for a model with `toolCalls: false` and repair without a
forced tool.

**Blockers.** None.

**Artifacts.** `packages/core/src/session/budget.ts`,
`packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/events.ts`,
`packages/core/test/budget.test.ts`, `packages/react/src/agent-run.tsx`,
`packages/cli/src/renderer.ts`.

## 2026-10-24T13:10:00+03:00 — 0.8 landed: the store contract, with counterexamples

**State.** Eight Phase 0 items in (0.1–0.8). Next is 0.9's budget record, then 0.10's
tool-less structured output.

**Did.** Wrote `test/contract/run-store.contract.ts`: ten store modes, each check paired
with a deliberately broken counterexample the suite must reject. Certified three
implementations — `MemoryRunStore`, an asynchronous wrapper and a temporary-file store
double that stands in for the durable file store Phase 1.5 has not built. The contract
found a real leak: `MemoryRunStore` handed out its internal steps array, so a caller that
mutated a loaded checkpoint changed the stored one. It now copies on both sides of the
boundary.

**Verified.** `pnpm gate` exit 0; core 38 files, 446 tests (the contract file alone
registers sixty).

**Unverified / open.** The file store certified here is a test double, not the 1.5
artifact; when 1.5 lands, its store joins this file and the double goes.

**Next.** 0.9: turn/output/total-token limits on the record, a typed terminal reason and
a handle that continues the budget.

**Blockers.** None.

**Artifacts.** `packages/core/test/contract/run-store.contract.ts`,
`packages/core/test/contract/run-store.conformance.test.ts`,
`packages/core/src/session/run-store.ts`.

## 2026-10-24T12:40:00+03:00 — 0.7 landed: every tool has a finite deadline

**State.** Seven Phase 0 items in (0.1–0.7). Next is 0.8's conformance suite, then 0.9's
budget record and 0.10's tool-less structured output.

**Did.** `tool()` now guards every tool with a deadline: 120 s by default, overridable
per definition, 0 to disable. The around-wrapper races the call against its timer,
replaces a result only when that timer fired, swallows a loser's late rejection, and
classifies an aborted run as cancellation rather than as a timeout. A deadline failure
is `ToolTimeoutError` (code `AGENT_TOOL_TIMEOUT`, limit in the message); the
tool-calling agent keeps that typed error instead of flattening it into a generic call
failure, and rethrows cancellation.

**Verified.** `pnpm gate` exit 0; core 37 files, 386 tests (four new: deadline failure,
cancellation classification, and the agent-level action failure carrying the code).

**Unverified / open.** A custom `Tool` implementation that does not go through `tool()`
gets no deadline; the seam guards the factory, not the interface.

**Next.** 0.8: the store conformance suite over ten failure modes.

**Blockers.** None.

**Artifacts.** `packages/core/src/tool/timeout.ts`,
`packages/core/src/tool/tool.ts`, `packages/core/src/agent/tool-calling-agent.ts`,
`packages/core/src/errors.ts`, `packages/core/test/tool.test.ts`,
`packages/core/test/tool-calling-agent.test.ts`.

## 2026-10-24T12:05:00+03:00 — 0.6 landed: a tripped guardrail leaves no blocked text behind

**State.** Six Phase 0 items in (0.1, 0.2, 0.3, 0.4, 0.5, 0.6). Next is 0.7's tool
deadline, then 0.8's conformance suite, 0.9's budget record and 0.10's tool-less
structured output.

**Did.** Wrote and enforced the rule in `MultiStepAgent.complete()`: when the output
tripwire (or the schema safety net) refuses an answer, the answering step's
`final_answer` call loses its arguments and result, its observation becomes
`Final answer: [redacted]`, and the checkpoint is re-saved before `run.failed` — so a
store never keeps the refused value. `buildTrace` scrubs a guarded run's trace the same
way and marks the run span `redacted: true`.

**Verified.** `pnpm gate` exit 0; core 37 files, 382 tests (1 new: a blocked answer is
absent from the checkpoint and the trace, which says redacted).

**Unverified / open.** A caller that persists the raw `AgentEvent` stream itself will
still see the transient `action.result` value; the rule covers the artifacts this
package writes. Nothing pushed.

**Next.** 0.7: a finite per-tool deadline, a typed `ToolTimeoutError`, cancellation
kept separate.

**Blockers.** None.

**Artifacts.** `packages/core/src/agent/multi-step-agent.ts`,
`packages/core/src/monitoring/trace.ts`,
`packages/core/test/guardrail.test.ts`.

## 2026-10-24T11:35:00+03:00 — 0.3 landed: a schema failure gets two repairs, then ends the run

**State.** Phase 0 has five items in (0.1, 0.2, 0.3, 0.4, 0.5). Wave 2 continues with
0.6, 0.7, 0.8, 0.9, 0.10.

**Did.** A schema mismatch is answered with a correction observation at most twice per
run; a third failure throws `AgentGuardrailError` naming the budget, so a
wrong-schema loop can no longer spend `maxSteps` silently. `RunContext.finishReason`
now carries why the reply ended, and a reply truncated by `length` is never repaired
(the missing part is not a correctable mistake) — it fails immediately. The attempt
count rides on the refused `final_answer` calls, not a new event kind.

**Verified.** `pnpm gate` exit 0; core 37 files, 381 tests (3 new: two repairs then a
valid answer, budget exhaustion, the length guard with one model call).

**Unverified / open.** The length guard is unit-tested through a scripted tool call
finish; the text-answer path that can actually be truncated by length is 0.10's and will
re-test it there. Nothing pushed.

**Next.** 0.6 (guardrail redaction rule), then 0.7's tool deadline.

**Blockers.** None.

**Artifacts.** `packages/core/src/agent/multi-step-agent.ts`,
`packages/core/src/agent/tool-calling-agent.ts`,
`packages/core/test/guardrail.test.ts`.

## 2026-10-24T11:05:00+03:00 — 0.4 landed: egress is a policy the backends honour or refuse

**State.** Phase 0 Wave 1 is complete: 0.1, 0.2, 0.5 and 0.4 are in, each with its
pre-registered acceptance test and a green gate. Wave 2 (0.3, 0.6, 0.7, 0.8, 0.9, 0.10)
starts next.

**Did.** Added `EgressPolicy` (`unmanaged | deny-all`) beside `network` on the
exec-remote seam, where `network` stays a description of reach. E2B enforces deny-all by
passing the vendor's own outbound rule at create (the client seam carries the decision)
and reports `network: "none"`; Docker and process throw the new
`EgressUnsupportedError` before an image is built or an interpreter spawned, so the
option is never accepted and ignored. The root entry exports the refusal and the type.

**Verified.** `pnpm gate` exit 0; exec-remote 12 files, 92 tests (3 new: seam create
option, docker refusal without a build, process refusal without a spawn).

**Unverified / open.** The vendor mapping itself is behind the eager client seam, so no
test reaches the E2B SDK's own `network` field; a live denial is unproven (the suite has
never touched a live sandbox). Nothing pushed.

**Next.** Wave 2, in plan order: 0.3 (approval policy hook), then 0.6/0.7/0.8/0.9/0.10.

**Blockers.** None.

**Artifacts.** `packages/exec-remote/src/sandbox.ts`,
`packages/exec-remote/src/backends/e2b.ts`,
`packages/exec-remote/src/errors.ts`.

## 2026-10-24T10:45:00+03:00 — 0.5 landed: a checkpoint says which format it is

**State.** Phase 0 Wave 1 has 0.1, 0.2 and 0.5 in. 0.4 (remote egress) is the last Wave 1
item and runs beside the others on `packages/exec-remote/**`, so it can start now.

**Did.** `RunSnapshot` is now `{formatVersion, steps}`; `translateSnapshot` reads a
bare step array as version 0 and normalises it, and a declared version newer than
`RUN_SNAPSHOT_VERSION` fails the run with `RunSnapshotVersionError`
(`AGENT_SNAPSHOT_VERSION`) rather than being half-read. `RunStore.load` accepts either
shape, so an existing store compiles unchanged; `MemoryRunStore` stores the envelope.
Translation is public: a store outside this tree needs it to migrate a checkpoint.

**Verified.** `pnpm gate` exit 0; core 37 files, 378 tests (8 new snapshot tests,
including a legacy-store resume and the newer-version refusal).

**Unverified / open.** Nothing pushed.

**Next.** 0.4: `egress` on the remote executor seam, deny-all mapped to the vendor for
E2B and refused typed for Docker and process before a guest starts.

**Blockers.** None (Docker/process refusal is the planned outcome, not a blocker).

**Artifacts.** `packages/core/src/session/run-store.ts:1`,
`packages/core/src/errors.ts:128`, `packages/core/test/run-store.test.ts:51`.

## 2026-10-24T10:35:00+03:00 — 0.2 landed: the answer schema binds to `final_answer`

**State.** Phase 0 Wave 1 has two items in: 0.1 (approval naming) and 0.2 (schema
binding). `ModelCapabilities.structuredOutput` is deleted, so the model seam no
longer declares a capability nothing honours. 0.5 and 0.4 remain.

**Did.** A tool-calling agent now receives the bound `outputSchema` as the
`final_answer` parameter schema `{answer: <schema>}`; a code agent receives it as a
`FINAL ANSWER SCHEMA` paragraph in its prompt. A mismatch returns as an observation
on both paths — `action.failed` for a structured call, an appended error for a code
step — and the loop continues; `complete()` keeps the schema as its last check.
Deleted `structuredOutput` from `ModelCapabilities` and its three adapter
assertions; added the schema seam (`answerJsonSchema`, `finalAnswerSpec`,
`answerSchemaText`, `invalidAnswer`) to the base loop.

**Verified.** `pnpm gate` exit 0; core 37 files, 370 tests; models 13 files green.

**Unverified / open.** Nothing pushed.

**Next.** 0.5: `RunSnapshot` becomes `{formatVersion, steps}`, a legacy bare array
translates, a newer version refuses typed, and the resume tests must stay green.

**Blockers.** None.

**Artifacts.** `packages/core/src/agent/multi-step-agent.ts`,
`packages/core/test/guardrail.test.ts:54`,
`docs/plans/2026-10-24-phase-0-execution-plan.md:117`.

## 2026-10-24T10:20:00+03:00 — 0.1 landed: an approval names its call and its arguments

**State.** Phase 0 Wave 1 is under way and 0.1 is done. An approval carries
`requestId` (the tool call id) and a stable `digest` of the validated arguments; the
answer is the closed set `allowed-once | rejected | cancelled | unavailable`, a
boolean stays shorthand, a verdict for another call or another input is refused, a
throwing handler fails closed as `unavailable`, and `approvalPolicy: "never"`
refuses before the handler runs. Every ask emits one `approval.decided` event, and
`AgentSession` keeps the same records in its snapshot as `approvals`. 0.5 and 0.4
are untouched; 0.2 is next.

**Did.** New `packages/core/src/utils/digest.ts`; rewrote
`packages/core/src/agent/approval.ts`; gated tools in `multi-step-agent.ts` with a
per-step sink; both flavours emit decisions; `agent-session.ts` projects them; the
CLI renders the event; the event fixture and the approval suite (eight cases)
updated; the execution plan's Changes section records the one-event decision.

**Verified.** `pnpm gate` exit 0; core 37 files, 367 tests; typecheck clean across
the workspace.

**Unverified / open.** Nothing pushed. The production build ran inside the gate;
no package was published.

**Next.** 0.2: bind `outputSchema` to `final_answer` in both flavours, return a
mismatch as an observation, and delete `ModelCapabilities.structuredOutput` — its
acceptance test comes first.

**Blockers.** None.

**Artifacts.** `packages/core/src/agent/approval.ts:1`,
`packages/core/src/agent/multi-step-agent.ts:139`,
`docs/plans/2026-10-24-phase-0-execution-plan.md:170`.

## 2026-10-24T10:05:00+03:00 — Phase 0 opened; T-41 in progress

**State.** The program is approved and Phase 0 is open. Wave 1 is 0.1 (approval
naming), then 0.2 (schema on `final_answer`) and 0.5 (stored-record version), with
0.4 (egress axis) running beside them on `packages/exec-remote/**`. Decisions
0020–0025 are accepted; nothing in the tree is source-changed yet.

**Did.** Wrote `docs/plans/2026-10-24-phase-0-execution-plan.md` (waves, per-item
acceptance tests, write scopes, rollbacks); activated the parent plan and pointed
Phase 0 at it; opened `T-41` and moved `T-40` to in progress; trimmed ten task
rows to fit the 4096-byte inline cap.

**Verified.** `validate_context.py`: 0 errors, 0 warnings; `rotate.py --check`
clean; tasks region 3847 bytes.

**Unverified / open.** No source edits yet, so `pnpm gate` is unchanged from
`0c03940`. 0.1 is the first code item.

**Next.** Implement 0.1: `requestId` + digest + closed outcome set + `never`
policy + one approval event per ask, red test first.

**Blockers.** None. `T-14` still waits on registry credentials.

**Artifacts.** `docs/plans/2026-10-24-phase-0-execution-plan.md:1`,
`docs/04-tasks.md:56`.

## 2026-10-24T09:45:00+03:00 — the delegation ruling lands: no blackboard; the approved intake is folded into the plan

**State.** Decisions 0020–0025 are accepted. `0025` answers `MA-05`: no shared
data blackboard; a typed report, a message that is a record entry delivered at the
recipient's next step, and a claim board only when a background child exists,
carrying claims and never data. Delegation ships opt-in; the team shelf (a named
peer roster, nine tools, a client panel) is out of scope. The plan now carries the
dive's ten adoptable items: 0.1 and 0.4 gain the closed approval outcomes, the
`never` policy, the turn-enclosed ask and the deny-only stage; 0.5 one migration per
integer; 0.7 the around-wrapper deadline; 0.8 the interface contract suite; 0.9 the
clamped record budget; 1.3 repair-forward. Phase 2 is cut into two slices.

**Did.** Wrote `docs/09-decisions/0025-no-blackboard.md` and its index row; edited
the plan's header, non-goals, six Phase 0 rows, 1.3, the Phase 2 section (two
slices; send 2.6, wait 2.7, claim board 2.8), the risk note, the open questions
(`MA-05` closed) and the Tasks note.

**Verified.** `validate_context.py`: 0 errors, 0 warnings; `rotate.py --check`
clean; `pnpm --filter docs-site test`: 25 passed. No source or test file changed,
so `pnpm gate` was not run.

**Unverified / open.** The program is still `Authorized by: not yet approved` and
`T-41` stays unopened. No package source changed.

**Next.** The owner approves the program; then write the Phase 0 execution plan and
start Wave 1 (0.1, 0.2, 0.5, with 0.4 beside them on `exec-remote`).

**Blockers.** Program approval; registry credentials for `T-14`.

**Artifacts.** `docs/09-decisions/0025-no-blackboard.md:1`,
`docs/plans/2026-10-22-apply-the-competitor-findings-plan.md:95`.

## 2026-10-24T09:20:00+03:00 — deepseek-harness filed as a post-synthesis dive; its team model answers the delegation question

**State.** The harness we run inside is dive twenty-two: five files under `docs/research/competitors/deepseek-harness/` plus a register addendum row, read at `687f282e86` (MIT, 0.2.1-rc.2; the owner's rc.3 is newer and changes client menus only). No package source changed; the plan is unapproved and nothing from this dive is applied to it.

**Did.** Read the team subsystem page, both team READMEs, the design note and its rejected alternatives, the subagent seam, approval, jobs, goal and plan, and 117 team commits across seven waves. Filed: a flat roster of named continuable children, peer messages as inbox writes at a step boundary, a task board of claims rather than data, wait edges with a typed `noProgress`, and closed approval outcomes with a per-session `never` policy. Also recorded what not to copy: the durable mailbox that became dead decoder code, nine tools before a usage shape, separate profile layers, a shared checkout with advisory write scopes.

**Verified.** Validator 0/0 after this rotation; harness paths are prefixed `clone:/` so they never resolve into this tree; contracts in all five files. Not verified: the adjacent-feature sweep was still running at filing time.

**Unverified / open.** `MA-05` is now answerable from evidence — no blackboard for data, messages as record entries, a claim board only when background children exist — but the owner has not decided. The program is unapproved, so no phase row is open.

**Next.** Brainstorm the five adoptable ideas and get the `MA-05` wording and a Phase 2 amendment approved or rejected.

**Blockers.** `T-40` on approval; `T-14` on credentials and `0024`.

**Artifacts.** `docs/research/competitors/deepseek-harness/`; `docs/research/competitors/README.md` addendum.

## 2026-10-24T08:05:00+03:00 — five of the six design questions are decided; delegation is the last one open

**State.** Decisions `0022` (refuse list), `0023` (one identity per run) and `0024` (publication ordering) are accepted, and the plan records the two-wave Phase 0 cut. No package source changed. `MA-05` waits on an explanation of the delegation model; `MD-10` is deferred by the owner.

**Did.** Adopted the study's refuse list as the boundary with each reopen trigger paraphrased, holding the blackboard row for the delegation answer; fixed the run vocabulary (`runId`, `waiting`, `pending`, `resume`, and the public `checkpoint` option renamed in Phase 1.1); made 0.1.0 wait for the correction pass. Folded all three into the plan: non-goals cite `0022`, Phase 1.1 carries the rename, 1.6 names `--resume <runId>`, Phase 0 gained its wave sequencing, and four open questions closed.

**Verified.** Validator 0 errors and 0 warnings; `rotate.py --check` clean; docs-site suite passes with three new decisions linked from the index and the plan.

**Unverified / open.** `MA-05`: the owner asked what the delegation process actually is and whether agents form teams or message each other, so the answer comes before the decision. `MD-10` stays open deliberately. The program itself is still unapproved, so no phase row is open.

**Next.** Explain the delegation model — typed child report, transfer, background child, steering, no peer messaging — then decide `MA-05`, then write the Phase 0 execution plan.

**Blockers.** `T-14` on credentials and now on `0024`; `T-40` on program approval.

**Artifacts.** `docs/09-decisions/0022-the-refuse-list-is-the-boundary.md`; `0023-one-identity-per-run.md`; `0024-publication-waits-for-corrections.md`; `docs/research/competitors/_synthesis/17-multi-agent-brief.md:88-106`.

## 2026-10-22T15:20:00+03:00 — Docker abandons the published Jupyter port for exec, so deny-all becomes enforceable there too

**State.** Decision `0021` accepted; `0020` stands with its Docker clause superseded. No source changed.

**Did.** Recorded the owner's choice of the exec transport: one long-lived `docker exec -i` Python process speaks the frame protocol over stdio, the container is created with `network mode` derived from egress, no port is published, readiness is a handshake frame, and `jupyter.ts` plus the WebSocket options are deleted. Added Phase 4.8 for the L-sized transport, made 0.4 say Docker refuses until it lands, and closed the Docker open question.

**Verified.** Validator 0 errors and 0 warnings; `rotate.py --check` clean; docs-site suite passes with the new decision linked from the index and the plan.

**Unverified / open.** The transport is unbuilt, so deny-all is enforced only by E2B today and Docker refuses. Signal-to-guest interruption and stdio buffering are the two design hazards the phase plan must cover.

**Next.** The owner decides the six remaining questions below (vocabulary, blackboard, retrieval, refuse list, publication timing, execution wave); then Phase 0's execution plan.

**Blockers.** `T-14`; `T-40` on plan approval.

**Artifacts.** `docs/09-decisions/0021-docker-exec-transport.md`; `packages/exec-remote/src/backends/docker.ts:25-36`, `:120-158`.

## 2026-10-22T15:05:00+03:00 — a capability must now be consulted or enforced: the two blocking questions are answered

**State.** Decision `0020` is accepted and the plan's Phase 0 is unblocked; no package source changed. The owner approved the egress answer (A) and the output answer (E) after a session that read the code behind both bags rather than the study's summary of them.

**Did.** Wrote `docs/09-decisions/0020-a-capability-is-a-claim.md`: four clauses (a bag field has a read site or is not a capability; every claim names its consuming site and its test; description and policy are separate axes; a backend refuses what it cannot honour) and two applications. Egress gains an `egress` policy axis beside `network`: e2b passes the vendor's deny through its seam, docker and process refuse typed, allow-lists wait for a fetch capability. Output drops `structuredOutput` instead of gaining a mode enum: the schema binds to `final_answer` in both flavours and a mismatch becomes a repair observation. Folded both into Phase 0 rows 0.2, 0.4 and 0.10, marked the two questions answered, added the Docker deny-all deferral, and cleared the plan's four leftover template placeholders.

**Verified.** `python scripts/validate_context.py --root . --baseline docs/.baseline.json` reports 0 errors and 0 warnings; `python scripts/rotate.py --check` is clean; `pnpm --filter docs-site test` passes, including the unresolved-link check over the new decision and its index row.

**Unverified / open.** The plan itself is still draft: the owner approved the two decisions, not the program. Six questions remain, all non-blocking. Docker deny-all needs a sidecar or an exec-based transport, deferred to the guest contract. `0020`'s follow-ups are the Phase 0 items, so none of them has a bite-sized plan yet.

**Next.** The owner approves the program and picks Phase 0; its execution plan is the first artifact of the work, and 0.2 is the smallest entry into it.

**Blockers.** `T-14` unchanged; `T-40` waits on plan approval. Nothing else new.

**Artifacts.** `docs/09-decisions/0020-a-capability-is-a-claim.md`; `docs/plans/2026-10-22-apply-the-competitor-findings-plan.md:50-61`; `docs/09-decisions/README.md:31`.

## 2026-10-22T14:15:00+03:00 — the findings became a six-phase plan; nothing approved, nothing built

**State.** `a8573e1` plus this entry; the study's ranked backlog is now sequenced into a plan with phases, exit criteria, risks and rollback. No package source changed.

**Did.** Wrote `docs/plans/2026-10-22-apply-the-competitor-findings-plan.md`: Phase 0 truth pass (ten small items), Phase 1 durability spine (record, pending request, owner, journal, file store, CLI — strictly ordered), Phase 2 delegation, Phase 3 memory and streams, Phase 4 protocol and tool breadth, Phase 5 observation and cost, Phase 6 model depth; pointed `T-40` at it.

**Verified.** Validator reports 0 errors and 0 warnings; `rotate.py --check` is clean; the docs-site suite passes 25 tests.

**Unverified / open.** Owner approval; eight open questions, of which `EX-06` (enforce or remove) blocks Phase 0.4 and the API posture blocks its changeset. No phase has a bite-sized execution plan yet.

**Next.** The owner answers the two blocking questions and picks Phase 0; its execution plan is the first artifact of the work.

**Blockers.** `T-14` unchanged; `T-40` waits on approval.

**Artifacts.** `docs/plans/2026-10-22-apply-the-competitor-findings-plan.md`; `docs/research/competitors/_synthesis/20-ranked-backlog.md`.

## 2026-10-21T19:55:00+03:00 — the competitor study is filed: 22 dives, 565 gap rows, and a ranked backlog nobody has started

**State.** `e6b4661` plus this session's untracked research tree; no package source changed. `docs/research/competitors/` holds thirteen deep dives and nine profiles, 22 folders and about 13.6k lines, plus a synthesis layer: the baseline, the long-tail sweep, lane briefs 15–19, two verification records, the gap matrix and the ranked backlog.

**Did.** Swept the field one repository at a time through seven teammates: clone at a pinned commit, read the loop and the state model at source, file five files for a deep dive and four for a profile. Then synthesised: a 75-row heat table over the 97 baseline ids, five lane briefs, `30-findings-about-us.md` (eight row corrections, ten candidate rows we never wrote down), and `20-ranked-backlog.md` — 39 items in six releases, a refuse list, and the trigger that would reopen each deferral. Brief verification checked 243 citations, found two wrong targets and fixed them in place; the record of the wrong values stays in `06b`.

**Verified.** `python scripts/validate_context.py --root . --baseline docs/.baseline.json` reports 0 errors and 0 warnings; `pnpm --filter docs-site test` passes 25 tests including the unresolved-link check. No competitor code was copied or executed; every clone sits under the gitignored `reference/competitors/`.

**Unverified / open.** None of the backlog is implemented. `strands` documentation was unreachable, so its doc-derived claims are marked declared; the OmniRoute findings are untouched by this session.

**Next.** T-40: the owner picks the first release from `20-ranked-backlog.md`; R1 is nine small items behind seams we already export.

**Blockers.** None new; T-14, T-16, T-18, T-21, T-25 and T-39 unchanged. T-30 is closed: the event is emitted and tested.

**Artifacts.** `docs/research/competitors/README.md`; `_synthesis/10-gap-matrix.md`; `_synthesis/20-ranked-backlog.md`; `_synthesis/30-findings-about-us.md`.

## 2026-10-21T19:05:00+03:00 — OmniRoute needs no code: gateway support is a documented recipe, and the package is the owner's call

**State.** `e6b4661` plus this session's records; no source file changed. A delegated investigation answered "add OmniRoute support": the shipped `OpenAICompatibleModel` already serves the gateway's `/v1` surface unmodified, verified against the frame shapes OmniRoute 3.8.53's own source emits.

**Did.** Cloned OmniRoute read-only and ran two research shards with teammates; filed `docs/research/2026-10-21-omniroute-gateway-support.md` with its two shards (`omniroute-api-surface.md`, `omniroute-integration-notes.md`); opened T-39; added one lesson to `docs/memory/general.md`.

**Verified.** Two throwaway Node probes (outside the tree) drove the unmodified `packages/models/dist` against a stand-in on `127.0.0.1:20128`: non-streaming text, `tool_calls`, streamed deltas, `[DONE]`, streamed usage, and all four gateway stream irregularities — a keepalive frame, an error-as-data frame with no key in the message, a `choices: []` usage chunk, and a synthesized finish. `python scripts/validate_context.py --root .` reports no error in any file this session wrote; every error in that run is inside `docs/research/competitors/**`, an untracked tree a concurrent writer was still creating during this session.

**Unverified / open.** No live OmniRoute instance was contacted (it needs a provider account); per-provider tool fidelity across ~375 providers and the fallback path's ordering are unread; no test or gate ran, because no code was written.

**Next.** T-39: the owner picks phase 0 (a docs page, an example and one hand-made gateway fixture, no decision needed) or phase 1 (open the pre-registered `models-gateway` package, which needs a new decision record).

**Blockers.** T-39 on that phase choice; T-14, T-16, T-18, T-21 and T-25 unchanged.

**Artifacts.** `docs/research/2026-10-21-omniroute-gateway-support.md`; `docs/design/2026-10-12-smolagents-ts-v1-design.md:664-669`; `docs/09-decisions/0019-post-0.1.0-roadmap-is-s7-s11.md:35-40`.


## 2026-10-21T16:20:00+03:00 — pushed: CI green on all six jobs, and Pages deployed only after it

**State.** `main` is pushed as `39566c1..e6b4661` (26 commits, including remediation `5b5fab8` and records `e6b4661`). CI run 39604784765 succeeded on all six jobs (gate on node 22, 24 and 26; runtime on node, bun and deno), with `version:check` in the chain; the context workflow run 39604784744 succeeded; Pages run 39605192267 built and deployed through `workflow_run`, so the site now waits for a green CI instead of deploying every push.

**Did.** Pushed the branch and watched both workflows with `gh run watch`.

**Verified.** `gh run view 39604784765` reports conclusion success with every job success; `gh run view 39605192267` reports success and the site is https://ahmadmhmdsy.github.io/smolagents-ts/ ; local `git status --short` is empty and `git worktree list` shows only the main tree.

**Unverified / open.** This records the state at `e6b4661`; this entry is a later commit and its own CI run is separate. 0.1.0 is still unpublished (T-14 needs registry credentials), and the follow-up items in the previous entry stand.

**Next.** T-14 publish when the credentials arrive; fold the two `checks.py` hardening items into a reviewed change.

**Blockers.** T-14 needs registry credentials; T-16, T-18, T-21, T-25 need the owner's decision.

**Artifacts.** https://github.com/ahmadmhmdsy/smolagents-ts/actions/runs/39604784765 ; https://github.com/ahmadmhmdsy/smolagents-ts/actions/runs/39605192267 ; https://ahmadmhmdsy.github.io/smolagents-ts/


## 2026-10-21T16:10:00+03:00 — remediation committed, eleven-stage gate green, stale worktrees gone

**State.** HEAD `5b5fab8` is the review remediation on top of the four merged fix branches; the tree is clean. `pnpm gate` (eleven stages) exits 0: 134 test files / 945 tests, eleven packages built, publint/attw clean, `ci:check` OK, pack smoke green (11 tarballs incl. the `mcp/stdio` and `exec-remote` subpaths), site build green (76 pages). 32 stale worktrees (28 review exports, 4 merged fix worktrees) are removed and pruned; one empty ignored directory is held by a running process. CI has not run on this tree; `main` is not pushed yet.

**Did.** Committed version identity (0.1.0 in eleven packages, `version:check` in gate and CI, changelogs, publish runbook), executor hardening (process env allow-list, `network: "direct"`, write-time log caps, Docker port/memory/pid limits, the rule's Contract paragraph), the CLI bin symlink guard, StrictMode, the docs-site skip link, CI-gated Pages, the self-reading pack smoke, and the docs truth pass.

**Verified.** `pnpm gate` exit 0 at `5b5fab8` (`.superpowers/gate-output.txt`); validator 0 errors, no unbaselined warning; `git worktree list` only main; clean tree.

**Unverified / open.** CI and Pages have not run on the pushed tree. T-14 needs registry credentials. Backend `SandboxRunResult.outputs` stays step-bounded; the dockerode `HostConfig` mapping is type-checked only; the two `checks.py` hardening items are unscheduled.

**Next.** Push `main`, watch CI, confirm Pages deploys only the CI-proved sha.

**Blockers.** T-14 needs registry credentials; T-16, T-18, T-21, T-25 need the owner's decision.

**Artifacts.** `docs/reports/2026-10-21-full-project-review.md` (addendum); `docs/09-decisions/0019-post-0.1.0-roadmap-is-s7-s11.md`; `docs/10-runbooks/gate.md`; commit `5b5fab8`.


## 2026-10-21T15:55:00+03:00 — the review's fixes are merged, and the docs truth pass closes its drift

**State.** The 2026-10-21 review's fixes are merged as four commits (`e2c18fa`, `c5c4f5a`, `3c8d776`, `b323ae6`; HEAD `b323ae6`). This session ran the docs truth pass it asked for. 0.1.0 is unpublished; CI has never run on this tree. The 2026-10-16 entry's "whole post-0.1.0 roadmap" line overstated: S7–S11 was the closed roadmap, and 0018's sixth gap was never scheduled — 0019 records that.

**Did.** `scripts/_packmodel.py` skips `.claude`, so ignored worktree copies stop failing validation. `docs/10-runbooks/gate.md` lists the eleven stages in `package.json` order with eleven-package counts and the newest verified gate. `docs/06-glossary.md` and `docs/07-sources-of-truth.md` are corrected. `docs/09-decisions/0019-post-0.1.0-roadmap-is-s7-s11.md` supersedes 0018's sixth gap. `docs/04-tasks.md` marks T-14, T-16, T-18, T-21, T-25 `blocked`; `docs/08-coordination.md` keeps T-13 `stale` and records this claim; the plans are marked landed. Stale test counts in every scoped entry are re-measured, `docs/memory/general.md` gains a lesson correcting the `network` reading, and `docs/.baseline.json` absorbs the two contract warnings with a 2026-11-20 review date.

**Verified.** `python scripts/validate_context.py --root .` exit 0, 0 errors, 16 baselined warnings; `--baseline` reports none new. `python scripts/selftest.py` pass, 23 tests. Own runs (files / tests): core 37 / 363, cli 8 / 59, react 11 / 51, tools 7 / 32, models 13 / 71; five more come from their owners' runs today.

**Unverified / open.** No full gate at `b323ae6`; other remediation scopes were uncommitted, so the tree is not the merged tree.

**Next.** Run the full gate on the merged tree and record it as the runbook's newest verified gate.

**Blockers.** T-14 needs registry credentials; T-16, T-18, T-21, T-25 need the owner's decision.

**Artifacts.** `docs/reports/2026-10-21-full-project-review.md`; 0019; `docs/10-runbooks/gate.md`.


## 2026-10-16T21:20:00+03:00 — S11 lands: guardrails halt a run, the schema binds the final answer

**State.** Pre-release and clean. S11 (guardrails and structured output) is complete: the milestone reads `done`, its row (T-38) is archived, and no live task row is open. S7 through S11 — the whole post-0.1.0 roadmap — have landed this session; only the standing later candidates remain unscheduled.

**Did.** `AgentOptions` gained `guardrails` (an `input` and an `output` tripwire) and `outputSchema` (a caller-supplied zod schema). The loop runs the input tripwire after `run.started` (before the model is asked), and both output checks in one shared `complete()` choke point serving both completion paths (the code agent's final call and the tool-calling agent's final answer): a tripped wire or a schema mismatch emits `run.failed` with a new `AgentGuardrailError` (code `AGENT_GUARDRAIL`) instead of `run.completed`, and a passing schema reports its validated value as the output.

**Verified.** Core suite 36 files and 340 tests, exit 0. `packages/core/test/guardrail.test.ts` (5 cases) covers an input halt (proving the model was not asked, via an empty script), an input pass, an output halt, a schema reject and a schema accept-and-coerce. `pnpm typecheck`, `lint` and `pnpm gate` exit 0.

**Open.** A tripwire returns a reason string rather than throwing — one function per direction, composed by the caller; no array form. `run()` rebuilds errors from event data, so the failure is an `AgentError` carrying the guardrail name and code, not an `AgentGuardrailError` instance.

**Next.** No scheduled milestone remains. Likely next is a fresh roadmap or the first release (T-14 publish), which waits on the owner's registry credentials.

**Blockers.** None. T-14, T-16, T-18, T-21 and T-25 wait on the owner.

**Artifacts.** `packages/core/src/agent/guardrail.ts`; `packages/core/src/errors.ts`; `packages/core/test/guardrail.test.ts`; `docs/01-project.md`; `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md` (Phase 5).



## 2026-10-16T20:45:00+03:00 — S10 lands: a session continues the agent's memory across turns behind the store seam

**State.** Pre-release and clean. S10 (persistent sessions and memory) is complete: the milestone reads `done`, its row (T-37) is archived, and no live task row is open. S7 through S10 have landed this session.

**Did.** Gave `AgentSession` an `AgentSessionOptions.checkpoint` and made `send(task, { reset })` thread it into `agent.run`: with a checkpoint set, a turn continues the agent's prior memory (`reset:false`, checkpointed by the S8 store seam); with none, each turn is fresh. A new session naming the same checkpoint over the same `RunStore` reads the earlier turns. No new store type — the session reuses `RunStore`, so S10 is one option and one line.

**Verified.** Core suite 35 files and 333 tests, exit 0. `packages/core/test/session-persistence.test.ts` runs one session to a checkpoint, then a fresh agent and session over the same `MemoryRunStore` read the first turn's task; a second case shows no checkpoint starts fresh. `pnpm typecheck`, `lint`, `depcruise` and `pnpm gate` exit 0.

**Unverified / open.** Only the agent's memory persists; the session snapshot (the React step view) is not rehydrated from the store, so a reload shows an empty step list though the model still sees prior turns. A `SessionStore` for the snapshot is deferred.

**Next.** Start S11 (guardrails and structured output): a guardrail seam with input/output tripwires and a schema-bound final answer.

**Blockers.** None. T-14, T-16, T-18, T-21 and T-25 wait on the owner.

**Artifacts.** `packages/core/src/session/agent-session.ts` (`AgentSessionOptions`); `packages/core/test/session-persistence.test.ts`; `docs/01-project.md` (S10 `done`); `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md` (Phase 4).


## 2026-10-16T20:35:00+03:00 — S9 lands: an event-stream trace exporter and an eval harness over the golden run

**State.** Pre-release and clean. S9 (observability and evaluation) is complete: the milestone reads `done`, its row (T-36) is archived, and no live task row is open.

**Did.** Added `buildTrace` (`monitoring/trace.ts`): it folds an `AgentEvent` stream into one OTel-shaped `TraceSpan` tree — a `run` root with a child span per step, planning pass and tool call, status and attributes from the events, an injected clock for deterministic replays, advisory `.delta` events skipped. Added `scoreRun` (`monitoring/eval.ts`): it checks a completed run against a transcript's output, state, action-step count and event-type sequence, returning a readable per-check list. Exported and pinned both. Committed S7+S8 as `ccd7a50` first.

**Verified.** Core suite 34 files and 331 tests, exit 0. `packages/core/test/observability.test.ts` drives the existing `fibonacci` golden fixture once, folds its event stream into a trace, scores it (`pass: true`), and shows a mismatched `actionSteps` fails with a named detail. `pnpm typecheck`, `lint`, `depcruise` and `pnpm gate` exit 0.

**Unverified / open.** `buildTrace` folds an already-collected stream; it does not wrap a live `agent.stream()` as a sink, and there is no OTel SDK adapter or exporter transport — both are additive on the same seam. `scoreRun` compares by JSON value, enough for a transcript's scalar/array fields.

**Next.** Start S10 (persistent sessions and memory): a session that persists across runs behind the store seam, so a second run reads the first run's memory.

**Blockers.** None. T-14, T-16, T-18, T-21 and T-25 wait on the owner.

**Artifacts.** `packages/core/src/monitoring/trace.ts`; `packages/core/src/monitoring/eval.ts`; `packages/core/test/observability.test.ts`; `packages/core/test/golden/fibonacci.transcript.json`; `docs/01-project.md` (S9 `done`); `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md` (Phase 3).


## 2026-10-16T17:55:00+03:00 — S8 lands: a run checkpoints and resumes, and an approval gate holds a tool call

**State.** Pre-release and clean. S8 (durable runs and human-in-the-loop) is complete: the milestone reads `done`, its live row (T-35) is archived, and no S8 row is open.

**Did.** A step now serializes to plain JSON (`StepJSON`, `stepToJSON`/`stepFromJSON` in `memory/steps.ts`, identity and timing included) with `AgentMemory.toJSON`/`restore`. Added the `RunStore` seam plus a `MemoryRunStore` (`session/run-store.ts`) and the approval seam `withApproval`/`ApprovalHandler`/`ToolApprovalError` (`agent/approval.ts`). Wired `AgentOptions.store`/`approve` and `run(task, { reset, checkpoint })` into `MultiStepAgent`: `reset:false` loads the checkpoint and continues, each completed step saves, and `approve` rebuilds the registry through `withApproval` so both agent flavours gate at the one seam. Exported and pinned the five new names.

**Verified.** Core suite 33 files and 325 tests, exit 0. `run-store.test.ts` stops a run at `maxSteps`, resumes it from a `MemoryRunStore` checkpoint with `reset:false`, and finishes; `approval.test.ts` (4 cases) proves a denied call never runs the tool. `pnpm typecheck`, `lint`, `depcruise` (288 modules) exit 0.

**Unverified / open.** Only in-memory checkpointing ships; a durable store implements the same seam (S10). Resume rebuilds memory only — it does not re-emit prior events. A mid-step interrupt still ends the run.

**Next.** Start S9: an `AgentEvent` trace exporter seam and a golden-transcript eval harness.

**Blockers.** None. T-14, T-16, T-18, T-21, T-25 wait on the owner.

**Artifacts.** `packages/core/src/session/run-store.ts`; `packages/core/src/agent/approval.ts`; `packages/core/src/memory/steps.ts`; `packages/core/src/agent/multi-step-agent.ts`; `packages/core/test/run-store.test.ts`; `packages/core/test/approval.test.ts`.


## 2026-10-16T15:30:00+03:00 — S7 closes: the example app delegates to a child agent end to end

**State.** Pre-release and clean. S7 multi-agent is complete: the milestone reads `done`, its live task row (T-34) is archived, and T-35 (S8) is the live row.

**Did.** Closed S7 by proving delegation in the example app: added `createDelegationRun()` to `examples/vite-app/src/agent.ts` — a `CodeAgent` whose scripted program calls a managed agent (`researcher`) from sandboxed QuickJS code — and `examples/vite-app/test/delegation.test.ts` drives it through the real executor. Recorded S7 `done` in the spec, marked and archived T-34, opened T-35 (S8: resumable state plus an approval seam), and updated the roadmap plan.

**Verified.** `pnpm vitest run --project example-vite-app` 3 files and 8 tests, exit 0; `pnpm gate` exit 0 (pack-smoke OK, site 74 pages). Docs: validator 0 errors, `rotate --check` exit 0.

**Unverified / open.** The delegation demo is not wired into the example's React UI — only its factory and test exist, so the page still renders the greet demo. That is a deliberate skip, not a gap in S7. Child-to-parent event forwarding stays out of scope.

**Next.** Start T-35 (S8): design the store/resume seam, then the approval seam.

**Blockers.** None. T-14 (publish), T-16, T-18, T-21 and T-25 wait on the owner.

**Artifacts.** `examples/vite-app/src/agent.ts` (`createDelegationRun`); `examples/vite-app/test/delegation.test.ts`; `docs/04-tasks.md`; `docs/01-project.md` (S7 `done`); `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md` (Phase 1).


## 2026-10-16T14:20:00+03:00 — S7's core lands: a manager delegates to a child agent exposed as a tool, with no change to the loop

**State.** Pre-release and clean. S7 multi-agent is implemented and verified at the library level; only the example-app delegation run is outstanding, so the milestone reads `in_progress`.

**Did.** Added `managedAgent()` (`packages/core/src/agent/managed-agent.ts`): it wraps a child agent as a tool taking a `task` (plus optional `additional_args`), wraps the task in upstream's managed-agent prompt, runs the child, and wraps the answer in the report prompt. `AgentOptions.managedAgents` folds each child into the manager's tool registry, so both `CodeAgent` and `ToolCallingAgent` execute and advertise it with no loop change; the prompt lists them in a "team members" section apart from the tool list. Exported `managedAgent` and `MANAGED_AGENT_INPUT_SCHEMA`; updated the public-surface pin and the template drift test.

**Verified.** `pnpm gate` exit 0 on 2026-10-16: 314 core tests (8 new), every project green, depcruise and site clean. Delegation proven by `packages/core/test/managed-agent.test.ts` — a parent calls `junior`, the child runs, and its report folds back as the observation.

**Unverified / open.** The `examples/vite-app` delegation run named in plan Phase 1 is not done. Child-to-parent event forwarding was dropped from the exit criterion: a tool call has no event channel. S8-S11 remain unstarted.

**Next.** Run a managed agent in `examples/vite-app` to close S7, then start T-35 (S8).

**Blockers.** None. T-14 (publish), T-16 and T-18 still wait on the owner.

**Artifacts.** `packages/core/src/agent/managed-agent.ts`; `packages/core/src/agent/multi-step-agent.ts` (`managedAgents` fold); `packages/core/src/prompts/templates.ts`; `packages/core/test/managed-agent.test.ts`; `docs/01-project.md`; `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md`.


## 2026-10-16T12:45:00+03:00 — the owner approved the post-0.1.0 roadmap; S7–S11 are in the spec and decision 0018 is accepted

**State.** Pre-release and clean. The roadmap proposed earlier this session is approved: milestones S7 (multi-agent) through S11 (guardrails + structured output) are in the project spec, the platform gaps are named non-goals, and decision 0018 records the boundary. Phase 1 is next.

**Did.** Recorded the owner's approval. `docs/01-project.md` (approval-only) gained the S7–S11 milestone rows, a scope-in bullet, a platform-gaps non-goal, and revision 9 authorising the change. Decision 0018 moved from proposed to accepted and its follow-up closed, with the index row updated. Task T-33 (approve) is done and archived; T-34 (multi-agent) is now live. The roadmap plan moved to approved.

**Verified.** `python scripts/validate_context.py --root .` → 0 errors, exit 0; `python scripts/rotate.py --check` → exit 0.

**Unverified / open.** No phase code is written yet — S7–S11 are approved scope, not delivered work. The competitor capability claims remain the vendors' own framing.

**Next.** Start T-34 (S7): expose a managed agent as a tool and a handoff path, mirrored from upstream, behind the core's tool seam.

**Blockers.** None for S7. T-14 (publish) stays blocked on registry credentials and a public repository; T-16 and T-18 still wait on the owner.

**Artifacts.** `docs/01-project.md` (Milestones, revision 9), `docs/09-decisions/0018-post-0.1.0-scope-boundary.md`, `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md`, `docs/04-tasks.md` (T-34), `docs/tasks/archive-2026.md` (T-33).


## 2026-10-16T12:30:00+03:00 — the post-0.1.0 roadmap is scoped from a competitor scan and recorded, pending owner approval

**State.** Pre-release; the tree is clean after five fixes landed in the previous session. The owner asked what the port lacks against the frameworks a TypeScript team would otherwise choose, then to capture it as plan, tasks, milestones and memory. The scan is recorded; the roadmap is a draft plan, a proposed decision and one live task row. No code was written this session.

**Did.** Scanned the neighbouring agent frameworks (OpenAI Agents SDK JS, Mastra, Vercel AI SDK, LangGraph/LangChain.js, Google ADK) against the shipped surface and wrote the findings, an 18-row gap table, to `docs/research/2026-10-16-agent-framework-landscape.md`. Drafted a phased roadmap (S7 multi-agent → S11 guardrails + structured output) as `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md`; proposed decision 0018 drawing the line between the six production gaps it adopts and the platform gaps that stay out; added T-33 (owner approves) live and indexed 0018. Appended two lessons to memory.

**Verified.** `python scripts/validate_context.py --root .` → 0 errors, 15 warnings, exit 0; `python scripts/rotate.py --check` → exit 0.

**Unverified / open.** The roadmap, the S7–S11 milestones and decision 0018 are unapproved. `docs/01-project.md` is approval-only and was not edited, so its milestone table still ends at S6 and S1.5. The competitor capability claims are the vendors' own framing, not executed here.

**Next.** The owner reads the research and the plan, then approves or amends T-33, which moves decision 0018 to accepted and adds S7–S11 to the spec.

**Blockers.** T-33 is blocked on the owner. T-14 (publish) stays blocked on registry credentials and a public repository.

**Artifacts.** `docs/research/2026-10-16-agent-framework-landscape.md`, `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md`, `docs/09-decisions/0018-post-0.1.0-scope-boundary.md`, `docs/04-tasks.md` (T-33), `docs/memory/general.md`.


## 2026-10-16T00:35:00+03:00 — the UI is verified live; the CLI's dropped environment was the last defect before a release

**State.** The v1 functional scope is done across eleven packages and unpublished. The owner asked whether the browser app works and what comes next. Verified live it does, scripted and against Gemini. The one defect, the CLI passing no environment to the run, is fixed; everything else waits on the owner.

**Did.** Drove `examples/vite-app` with `agent-browser`: scripted mode finished in two steps, a live Gemini task called both `greet` and `add`, a pure-code task returned 720, console clean. Fixed the CLI: `runSmolagent` defaults its injected `env` to an empty map so its tests stay hermetic, and the bin never passed `process.env`, so no provider key reached an adapter; `main()` now takes `env` and forwards it. Added a lint ignore for the vendored agent-skill bundles.

**Verified.** `pnpm gate` exit 0 — 120 files, 818 tests, 11 packages packed, docs site 71 pages. `pnpm vitest run --project cli` PASS 7 files/52 tests; `--project example-vite-app` PASS 2 files/7 tests. Live with `agent-browser`: scripted PASS; live Gemini `add`→42 and `greet`→"Hello, Ada!" PASS; factorial→720 PASS; console error-free.

**Unverified / open.** The first live turn carried no code block and the loop nudged it ("No action found…"); the retry works. The exec-pyodide real-runtime suite flaked once (5000 ms timeout) and passed on re-run. The chat surface renders a fixed `TRANSCRIPT` (`examples/vite-app/src/App.tsx:19`) and its tools are only `greet`/`add`, so a web-search prompt draws a fabricated answer.

**Next.** Take the owner's Phase-2 decisions (T-16, T-18, T-21, T-25), then run `docs/10-runbooks/publish-0.1.0.md`.

**Blockers.** T-14 needs registry credentials and a public repository; T-16, T-18, T-21 and T-25 need owner decisions.

**Artifacts.** `docs/plans/2026-10-16-release-0.1.0-readiness-plan.md`; `packages/cli/src/main.ts`; `examples/vite-app/src/App.tsx`.


## 2026-10-14T22:05:00+03:00 — the live UI's "Failed" was the dev server answering the wasm with HTML

**State.** The owner reported that the browser app marked every run `Failed`, showed only the
first step, and asked whether the fault was the UI or the agent, how many steps are allowed,
whether the page had ever been tested live, and whether a CLI could replace it.

**Did.** Root-caused it to the example's dev wiring — not the agent, not the React layer. The
QuickJS variant finds its engine with `new URL("emscripten-module.wasm", import.meta.url)`;
Vite's dependency pre-bundle relocated that module into `node_modules/.vite/deps`, so the URL
named a file that does not exist and the dev server answered it with `index.html`. Added
`optimizeDeps.exclude` for the variant to `examples/vite-app/vite.config.ts`, pinned it with a
case in `test/resolution.test.ts`, and documented it in the example README and the memory shard.

**Verified.** Driven with `agent-browser` against the running dev server: scripted mode reads
`Finished`, 2 steps, `greet:ok`; a live Gemini task — "Compute 15 * 4 and log it. Then, in a
second step, answer with twice that value." — reads `Finished`, 2 steps, with both programs and
`final_answer(120)`; the console carries no error. `vite preview` over the built app reads
`Finished`, 2 steps. `pnpm gate` exit 0.

**Unverified / open.** The CLI has no Gemini `--model-type`; `--model-type OpenAIModel
--api-base .../v1beta/openai` is the only route and is unverified. The default budget is 20
steps (`packages/core/src/agent/multi-step-agent.ts:95`) and the page exposes no control for it.

**Next.** Verify the CLI's OpenAI-compatible route against Gemini, then decide whether the CLI
gains a native Gemini type.

**Blockers.** Unchanged: T-14 needs registry credentials; T-16, T-18, T-21 and T-25 need owner
decisions.

**Artifacts.** `examples/vite-app/vite.config.ts`;
`examples/vite-app/test/resolution.test.ts`; `docs/memory/general.md`.


## 2026-10-14T18:52:00+03:00 — the audit finds one real defect, and the pre-publish pass closes it

**State.** The owner asked whether the project works and every feature is done and
tested before publishing. An audit of 107 test files and 771 tests, and a triage
of its 17 design gaps, found one defect blocking a coherent 0.1.0 on the QuickJS
and Node path: `getServerSnapshot` was missing, so React handed
`useSyncExternalStore` the live snapshot and a server render threw. Every other
gap is superseded by a plan or a decision, deferred, or was never a promise.

**Did.** Implemented the server snapshot in core and passed it as the hook's third
argument in react, with a server-render test that fails without it. Wrote the
missing facade README, an examples guide and a root README that doubles as the
site index, and added four runnable examples as vitest projects. Extended the pack
smoke to run a real agent from the tarballs. Made the facade's QuickJS engine
peers optional, as its own plan specifies, and repaired the root vitest projects
glob, which `examples/README.md` had broken.

**Verified.** `pnpm gate` exit 0 at 119 test files and 809 tests, 281 modules and
718 dependencies cruised, eleven packages packed and installed, the run printing
`pack-smoke run OK: Hello, world!`, site at 70 pages. Core is 30 files and 299
tests, react 11 and 48; both new tests fail when the snapshot is returned live.
`pnpm install --frozen-lockfile` exits 0; the validator reports `new: []`.

**Unverified / open.** The remaining audit findings are recorded as T-28 to T-30
rather than fixed: the snapshot cannot feed `ChatSurface`, `agent.on` takes one
argument where the design sketches two, and `code.delta` is never emitted.

**Next.** Commit, push, then watch `CI` on the revision.

**Blockers.** T-14 needs registry credentials; T-16, T-18, T-21 and T-25 need
owner decisions.

**Artifacts.** `packages/core/src/session/agent-session.ts`;
`packages/react/test/server-render.test.tsx`; `packages/smolagents-ts/README.md`;
`vitest.config.ts`.


## 2026-10-14T15:40:00+03:00 — probe C is measured, and the close of T-13 is verified

**State.** T-13's last two gaps are filled and the numbers in the entry below are
superseded. The styled package's suite is now 5 files and 22 tests, because Task
6's probe test landed; the full gate exits 0 at 113 test files and 796 tests, 279
modules and 712 dependencies cruised, eleven packages packed and installed, and
the site at 70 pages, one more than before because this session added a report.

**Did.** Drove the example's production build in headless Edge over the DevTools
Protocol by keyboard alone, and read its accessibility tree. Wrote the report and
pasted the measured results into the plan. Added the probe test that pins the
sheet's shape: five tokens, each reading an input name that is not its own, and
every selector scoped to a class this package owns. Fixed two things the harness's
own scratch directory caused — the linter linted it, and the pack walker crashed
on a browser profile it found there — so `.dsh/` is now ignored by both, on the
precedent `.superpowers/` already set.

**Verified.** `pnpm gate` exit 0 with the counts above; `--project react-ui` 5
files and 22 tests; the validator 0 errors, 0 warnings, 14 baselined, `new: []`.
In the browser both styled wrappers report `role: none` and `ignored: true`, so
they add nothing to the accessibility tree at all; the live cancel button is a tab
stop and the disabled composer is skipped.

**Unverified / open.** No screen reader was run — the accessibility tree is the
browser's own computation. The plan's four open questions are still the owner's.

**Next.** Take the owner's decision batch.

**Blockers.** Unchanged: T-14 needs registry credentials, and T-16, T-18, T-19,
T-21 and T-25 each wait on a decision rather than on work.

**Artifacts.** `docs/reports/2026-10-14-t13-probe-c-keyboard.md`;
`packages/react-ui/test/stylesheet.probe.test.ts`;
`docs/plans/2026-10-14-t13-l4-l5-plan.md`.


## 2026-10-14T15:35:00+03:00 — the gate was green while CI was red

**State.** The gate exits 0 locally at 114 test files and 800 tests — and it was
green locally while CI was red. Both commits this session failed the `CI`
workflow at `pnpm typecheck`: `examples/vite-app` could not resolve
`@smolagents-ts/react-ui`, because the example's compiler `paths` mapped every
workspace package to source except that one, and the workflow typechecks before it
builds. The `context` and `Pages` workflows passed throughout.

**Did.** Added the missing entry, then brought the example's `paths` in line with
its two alias configs: a mapped source file imports its siblings by scoped name, so
`@smolagents-ts/react` was missing as well. Pinned all three resolver configs to
each other with `examples/vite-app/test/resolution.test.ts`. Closed the owner's
decision batch: items 8 and 9 are implemented, and 10 to 13 were already answered
by decisions 0014 and 0010 and by T-20. Item 9's premise was stale — streamed usage
shipped at 10:03 in `2ac32fe` — and the live defect was that OpenAI sends
`"usage": null` on every non-final chunk and the adapter threw on it.

**Verified.** `pnpm gate` exit 0 at the counts above. With all twelve `dist/`
directories moved away, `pnpm typecheck` exits 0; that is CI's own condition, and
it is the check that catches this class.

**Unverified / open.** The new guard reads the three configs as text and compares
their coverage; it does not check that an alias points at the right package.
`gemini.ts` has the same null-shape the models fix closed and was left alone.

**Next.** Push, then watch `CI` on the pushed commit, because the local gate
cannot see this defect.

**Blockers.** T-14 needs registry credentials; T-16, T-18, T-21 and T-25 need
decisions; T-19 and T-24 are deferred.

**Artifacts.** `examples/vite-app/test/resolution.test.ts`;
`examples/vite-app/tsconfig.json`; `packages/exec-remote/src/sandbox.ts`;
`packages/models/src/openai-compatible.ts`; `docs/memory/general.md`.


## 2026-10-14T14:40:00+03:00 — the remote executors land as the tenth package

**State.** T-13's fifth module is delivered: `@smolagents-ts/exec-remote` is the tenth
published package and its suite is 11 files and 57 tests. The full gate exits 0 — 106
test files, 746 tests, 262 modules and 650 dependencies cruised, publint clean on ten
packages, the site at 69 pages. The docs site landed earlier, so T-13 has L4/L5 left.

**Did.** Built the package: a `RemoteSandbox` seam with three backends, a host-owned
frame protocol over the child's stdio for the process path, the Jupyter stdin channel for
Docker, and E2B refusing the round trip by name. Added the scoped entry, the component
rule, the router row, the attribution rows, the changeset and the runbook with its check
script. Fixed a defect the live run exposed: the executor's host-error mapping dropped the
`cause` each backend attaches, so a missing daemon reported only that the sandbox could
not start; it now walks a bounded cause chain, with a test. Filed decision 0017 and T-25.

**Verified.** `pnpm gate` exit 0; the package suite 11 files and 57 tests; the live
process check five ok in 334 ms; the validator `new: []`, 14 baselined, 0 errors. Both
live Docker and E2B paths were attempted and failed, for want of a daemon and a
credential.

**Unverified / open.** Both live paths are unexecuted and the runbook says so; the Docker
round trip is exercised only against a fake kernel; decision 0017 is not yet the owner's;
the gate now needs Python on `PATH`, which no manifest declares.

**Next.** Build L4/L5 per its filed plan, starting with the first three tasks. `react-ui`
is an eleventh package, and the workspace may not grow one until this commit lands.

**Blockers.** None. T-14, T-16, T-18, T-19, T-21 and T-25 stay owner-gated.

**Artifacts.** `docs/plans/2026-10-14-t13-remote-executors-plan.md`,
`docs/10-runbooks/exec-remote-live-backends.md`, `docs/09-decisions/0017-release-age-quarantine.md`.


## 2026-10-14T14:05:00+03:00 — the Pyodide executor lands, and the remote executors are planned

**State.** T-13's fourth module is delivered: `@smolagents-ts/exec-pyodide` is the
ninth package, its suite is 9 files and 55 tests, and the full gate exits 0 (95
files, 689 tests, 227 modules and 566 dependencies cruised, publint clean on nine
packages, the site at 65 pages). Task 5's plan is filed; exec-remote is next, then
L4/L5.

**Did.** Built the package: an injectable loader, one runtime per run, a Python
prelude with a `BaseException` answer signal, a JSON tool bridge, the import
allow-list, batched stream capture, and a deadline race that poisons the runtime
when a stop wins. Filed decision 0016 (in-process, fidelity not security) and T-24
(the worker interrupt path). Added the scoped entry, the component rule, the router
row, the attribution row, the browser-probe runbook and the measured results, and
wrote the remote-executor plan on the client reconnaissance.

**Verified.** `pnpm gate` exit 0 on this tree; probe A measured a guest awaiting a
host tool settled by a real timer, so `asyncToolCalls` is true; probe B measured a
2,912 ms browser cold start and a 29,375 B page bundle with the runtime external;
probe C confirmed the pack smoke reaches no registry for `pyodide`; the validator
reports `new: []`, 0 errors and 0 warnings.

**Unverified / open.** No live remote backend was exercised and no injected double
exists yet; the cold start is one headless Chrome against one CDN.
`timers` stays false: nothing on the host can interrupt a synchronous guest loop.

**Next.** Execute `docs/plans/2026-10-14-t13-remote-executors-plan.md`: the process
backend, then Docker, then E2B.

**Blockers.** T-14 awaits registry credentials; T-16, T-18 and T-21 await owner
decisions.

**Artifacts.** `packages/exec-pyodide/src/executor.ts`,
`docs/09-decisions/0016-pyodide-in-process-and-fidelity.md`,
`docs/plans/2026-10-14-t13-remote-executors-plan.md`,
`docs/10-runbooks/exec-pyodide-browser-probe.md`.


## 2026-10-14T15:00:00+03:00 — L4 and L5 land, and T-13 closes

**State.** T-13's last module is delivered, so every module S6's design row names
is present and the row is `done`. L4 ships inside `@smolagents-ts/react` as the
two patterns that compose the primitives — `RunInspector` and `ChatSurface` —
and L5 as the eleventh package, `@smolagents-ts/react-ui`, a styled layer of
four wrappers over both plus one stylesheet a consumer copies and then owns. The
full gate exits 0: 112 test files and 793 tests, 278 modules and 708 dependencies
cruised, publint clean on eleven packages, pack-smoke installing and importing
eleven packages, the site at 69 pages.

**Did.** Added the two patterns to the react barrel, taking its pinned surface
from ten names to twelve. Built the styled package: one wrapper file per part of
the tree, each rendering a single owned `smol-` element around the component it
composes and authoring no accessibility of its own, plus a 140-line sheet whose
five tokens read distinct input names because a token referring to itself is
invalid rather than a fallback. Registered the component — router row, scoped
entry and rule file, which the pack requires in one change — and corrected the
react entry, which still recorded ten runtime names, an 8-file suite and the
claim that every element carries a class name; that last is true of the
primitives and false of the patterns. The example page now renders the styled
layer, so the copy-in path is exercised in a browser. Closed the exec-remote
review's fifteen findings across two commits. Recorded one lesson: the same
resolver-config omission landed twice, in a package's test tsconfig and in the
example's vitest config.

**Verified.** `pnpm gate` exit 0 with the counts above; `pnpm vitest run
--project react` 10 files and 46 tests; `--project react-ui` 4 files and 19
tests; `--project example-vite-app` 3 tests; the validator 0 errors, 0 warnings,
15 baselined, `new: []`. The copy-in claim was measured in a real browser rather
than jsdom: with no override the token resolves to `#ffffff`, and a consumer
sheet setting `--smol-surface` afterwards wins by source order. The two resolver
gaps were each proven by moving the dependency's `dist/` away and re-running,
which is the check that catches them, because CI tests before it builds.

**Unverified / open.** The keyboard drive of the example in a real browser is
still running as this entry is written. The L4/L5 plan's four open questions are
the owner's: whether the styled layer ships a dark theme, whether the corpus
grows a tool scenario, whether core exposes its step list publicly, and how the
five internal packages are described. No live provider call was made this
session.

**Next.** Take the owner's decision batch: T-14's publish, the T-16 and T-18
investigations, T-19, T-21, T-25, and the four plan questions above.

**Blockers.** T-14 needs registry credentials and stays the owner's. T-16, T-18,
T-19, T-21 and T-25 each wait on an owner decision, not on work.

**Artifacts.** `packages/react-ui/src/index.ts`; `packages/react-ui/src/styles.css`;
`packages/react/src/run-inspector.tsx`; `packages/react/src/chat-surface.tsx`;
`examples/vite-app/src/App.tsx`; `rules/components/react-ui.md`;
`docs/plans/2026-10-14-t13-l4-l5-plan.md`.



## 2026-10-14T12:25:00+03:00 — the MCP client lands, live-checked, and Pyodide is measured

**State.** T-13's third module is delivered: `@smolagents-ts/mcp` builds, typechecks,
lints and cruises clean, its suite is 9 files and 106 tests, and the full gate exits 0
(86 files, 634 tests, 205 modules and 517 dependencies cruised, publint clean on eight
packages). The live check passed against
`@modelcontextprotocol/server-everything@1.0.0`: the root entry refused a stdio
parameter, the client negotiated `2025-11-25`, listed 13 tools and answered the echo
call. Task 4's reconnaissance is filed: Pyodide 314.0.7 installs 13.24 MiB, loads in
about two seconds in Node, has no teardown API, and can be interrupted only from a
worker.

**Did.** Reviewed the delegated package, then fixed what the live check exposed: a
transport error or close now settles everything in flight on its connection and the
connection remembers why, so a spawn that fails reports in milliseconds instead of
leaving the process to exit on an unsettled top-level await. Corrected the runbook:
Windows cannot spawn `npx` (ENOENT) or `npx.cmd` (EINVAL), so it installs the pinned
server and spawns `process.execPath` with its entry. Wrote the reconnaissance, two
memory lessons, the plan's measured results, the T-13 row and this entry.

**Verified.** PASS — `pnpm gate` exit 0 on the tree. PASS — the live check's four lines
and exit 0. PASS — the validator `new: []`, 14 baselined, 0 errors, 0 warnings, and
`rotate.py --check` exit 0.

**Unverified / open.** No browser loaded Pyodide; the reconnaissance names the
unmeasured numbers. The package is unpublished (T-14).

**Next.** Write Task 4's plan for `exec-pyodide` from the reconnaissance, then build it.

**Blockers.** T-14 waits on registry credentials; T-16, T-18 and T-21 on the owner.

**Artifacts.** `packages/mcp/`, `docs/10-runbooks/mcp-live-check.md`,
`docs/research/2026-10-14-pyodide-recon.md`.


## 2026-10-14T11:45:00+03:00 — the docs site is live, and T-20 retires the parity cast

**State.** The pushed revision is green everywhere, and the site answers at
https://ahmadmhmdsy.github.io/smolagents-ts/ : the numbered documents render with a sidebar,
decision 0014 has its own page, and the browser example is served under `example/` with its
assets. T-20 is done: `MultiStepAgent.steps` is public, so the parity suite reads the loop's
typed steps with no cast, and the failed-run case is covered.

**Did.** Committed the alias fix (`3ac484e`), the docs site with the records (`699e3b7`) and
the dropped test tsconfig (`11d774d`); the entry above called the deployment unverified, and
the fetch below supersedes that line. Then exposed `steps` on the loop, replaced the parity
test's cast, added the failed-run assertion, closed T-20, and wrote the deployment lesson.

**Verified.** PASS — `pnpm gate` exit 0 on a tree with every `dist/` deleted, and `pnpm test`
alone exits 0 there, which is what the two CI-only failures were about. PASS — the CI, Pages
and context workflows are all `success` on `11d774d`. PASS — the site root, the decision page
and the example each answer 200. PASS — the core suite is 30 files and 297 tests, exit 0.

**Unverified / open.** No browser drove the deployed example: a 200 and a relative asset path
are not a rendered page. Nothing is published to npm.

**Next.** Task 3 of the v1.5 plan: write the MCP client's plan, then build it.

**Blockers.** T-14 waits on registry credentials; T-16, T-18 and T-21 wait on the owner.

**Artifacts.** `packages/core/src/agent/multi-step-agent.ts`, `apps/docs-site/`,
`docs/plans/2026-10-14-s1.5-parity-harness-plan.md`.
<!-- rotate:end -->

Rotated entries: `docs/handoff/archive-2026.md`. Rotation moves; it never deletes.


## 2026-10-14T11:35:00+03:00 — the docs site lands, and two CI-only defects are fixed

**State.** T-13's second module is delivered: `apps/docs-site` renders `README.md` and
every `docs/**/*.md` into `apps/docs-site/site/`, copies the browser example's build
beside them, published by `.github/workflows/pages.yml`. T-22 is closed: decision
0014 keeps the five internal packages implementation, and each gained a signpost README.
CI was red on two defects no local run could see, and both are fixed. MCP, `exec-pyodide`, the remote executors and L4/L5 remain.

**Did.** Delegated Task 2 to a subagent and reviewed it: ten modules, four test files and
22 tests, the Pages workflow, the router row, `rules/components/docs-site.md`, the
`site:build` stage, and the ESLint ignore the built tree needed. Fixed the two CI
failures: the facade's test project and both examples' configs never aliased the internal
sources, so the test stage resolved a `dist/` a fresh checkout lacks; and
`pnpm -r --filter ./packages/*` died on bash, which expands the glob before pnpm sees it.
Wrote decision 0014 and the five READMEs, closed T-22, filed T-23, and added two lessons.

**Verified.** PASS — a clean-tree run with every `dist/` deleted: `pnpm test` and the
full `pnpm gate` exit 0. PASS — the alias is load-bearing: a config pointing it at a
missing path fails to resolve, and the real one passes. PASS — the validator reports
`new: []`, 14 baselined, 0 errors, 0 warnings; `rotate.py --check` exits 0.

**Unverified / open.** The Pages deployment has not run: the site's evidence is its own
suite and a built tree, not a fetched page. No frozen-lockfile install was made, and
nothing is published.

**Next.** Task 3 of the v1.5 plan: write the MCP client package's plan, then build it.

**Blockers.** T-14 waits on registry credentials; T-16, T-18 and T-21 wait on the owner.

**Artifacts.** `apps/docs-site/`, `docs/09-decisions/0014-internal-packages-stay-implementation.md`,
`docs/plans/2026-10-14-v1.5-modules-plan.md`.


## 2026-10-14T10:45:00+03:00 — the first v1.5 module lands and the browser example runs

**State.** T-13's first module is delivered: `@smolagents-ts/cli`, a seventh workspace
package with a `smolagent` bin, upstream's flags and factories, and no third-party
dependency. T-12 is done: `examples/vite-app` runs the React layer over a real QuickJS
executor in a browser tab, and the engine bundles as a WASM asset, retiring the plan's
fallback. Decision 0012 fixes the host: the example is a Vite SPA and the docs site
publishes its build beside the documents. MCP, `exec-pyodide`, the remote executors and
L4/L5 remain.

**Did.** Wrote decision 0012 and the T-12 plan; built `examples/vite-app` (twelve files,
two tests) and wired it into the workspace; added the README's browser section. Delegated
T-13's CLI to a subagent and reviewed it: twelve modules, six test files and 49 tests in
`packages/cli/`, its scoped entry and component rule, the router row, the pack smoke's
seventh package, and `.changeset/v1-5-cli-package.md`. Closed T-12 and recorded results in
both plans.

**Verified.** PASS — `pnpm vitest run --project example-vite-app`: one file, two tests,
exit 0. PASS — `pnpm --filter example-vite-app run build`: 179 modules, exit 0, the engine
emitted as a 503.13 kB `.wasm` asset. PASS — `pnpm vitest run --project cli`: six files, 49
tests, exit 0. PASS — the validator reports `new: []`, 14 baselined, 0 errors, 0 warnings.

**Unverified / open.** No browser was driven: the example's evidence is a jsdom test and a
production build, not a clicked page. The CLI sits outside the fixed group at 0.0.0, so its
`minor` changeset cuts 0.1.0 alone. Nothing is published.

**Next.** Task 2 of the v1.5 plan: the docs site that renders the documents and publishes
the example's build.

**Blockers.** T-14 waits on registry credentials; T-16, T-18 to T-22 wait on the owner.

**Artifacts.** `docs/09-decisions/0012-web-surface-host.md`,
`docs/plans/2026-10-14-v1.5-modules-plan.md`, `examples/vite-app/`, `packages/cli/`.


## 2026-10-14T03:20:00+03:00 — the v1 roadmap is closed: S3, S4, S5, S6's v1 share and S1.5 are reached

**State.** Every v1 milestone the design record names is reached. S3, S4 and S5 read `done`;
S1.5 reads `done` (entry above); S6 reads `in_progress` because its design row also names the
v1.5 modules — the six packages' publish shape, the facade, the tarball smoke and 0.1.0 are
delivered, and T-13 owns the rest. Nothing is published, and no owner row was closed for the owner.

**Did.** Executed `docs/plans/2026-10-14-s6-distribution-plan.md` (`aa0589a`) task by task:
publish metadata and the licence copy (`e04733d`), the facade (`cba0db4`), its component record
(`13fa0f6`), pack-smoke coverage (`95e2b4c`), the changesets release (`a27bee1`), the runnable
Node example (`191fb1c`), the README sections (`78cc03f`), per-changelog notes (`3484794`), and
the records with decision 0006 (`49bd15d`). Then delegated S1.5 and reviewed it commit by commit.

**Verified.** PASS — `pnpm gate` exit 0 on this revision (`.superpowers/gate-verify.txt`): 66
files and 453 tests, depcruise 158 modules and 395 dependencies with no violations, six publint
"All good!", `ci:check OK`, `pack-smoke OK: 6 packages`. PASS — the validator reports `new: []`,
14 baselined, 0 errors, 0 warnings; `rotate.py --check` exits 0; the tree is clean.

**Unverified / open.** No publish was attempted: T-14 waits on registry credentials and a
repository URL this tree has none of. S1.5's two measured divergences are open owner decisions.

**Next.** The owner answers T-5, T-10, T-12, T-14, T-16 and T-18, or picks the first T-13 module.

**Blockers.** T-5, T-10, T-12, T-13, T-14, T-16 and T-18 wait on the owner.

**Artifacts.** `docs/01-project.md:118`, `docs/plans/2026-10-14-s6-distribution-plan.md`,
`docs/09-decisions/0006-distribution-shape.md`, `packages/smolagents-ts/`.


## 2026-10-14T03:10:32+03:00 — S1.5 is complete: the parity harness compares our loop with upstream

**State.** A differential harness now holds this loop against the release it is derived from.
Five scenarios replay through both sides: the Python leg records upstream 1.14.0 on Python
3.13.7 into committed traces, and `pnpm gate` replays the same corpus through our `CodeAgent`
offline. It measured two real divergences, both owner-gated. S6 is unchanged: T-13 and T-14
still wait on the owner.

**Did.** Executed `docs/plans/2026-10-14-s1.5-parity-harness-plan.md`'s seven tasks: the plan
(`cf2fcf8`); the shared corpus (`f73957b`); the recorder and its five recordings (`9540402`);
the differential suite, plus the corpus corrections its first measurement forced (`2ad7d8f`);
a guard refusing a scenario that declares tools (`c9f21fe`); the re-recording runbook
(`792fbec`); the decision record (`8053e62`); and this record.

**Verified.** PASS — `pnpm gate` exit 0 (`.superpowers/gate-s1.5.txt`): 66 files and 453
tests, depcruise 158 modules and 395 dependencies with no violations, six "All good!" from
publint, `ci:check OK`, `pack-smoke OK: 6 packages`. PASS — the core suite alone: 30 files and
296 tests, exit 0, six of them the parity cases. PASS — the validator reports `new: 0`, 0
errors, 0 warnings; `rotate.py --check` exits 0.

**Unverified / open.** The Python leg is not in CI, so nothing detects upstream drifting
between two recordings; re-recording is a runbook procedure. Our scripted executor returns the
corpus's observation rather than computing it, so executor semantics stay with S4's tests.

**Next.** The owner decides T-16 (planning cadence) and T-18 (max-steps ending); otherwise
choose the first T-13 module.

**Blockers.** T-13, T-14, T-16 and T-18 wait on the owner.

**Artifacts.** `docs/plans/2026-10-14-s1.5-parity-harness-plan.md`,
`docs/10-runbooks/record-parity-traces.md`, `docs/09-decisions/0007-parity-harness-scope.md`,
`packages/core/test/parity.test.ts`.


## 2026-10-14T02:45:00+03:00 — S6 is complete: the six packages are publishable

**State.** The project is installable: six packages at 0.1.0, a `smolagents-ts`
facade that re-exports the five internal ones, tarballs that install and import,
and a runnable Node example. S5 was complete before this session. The CLI, MCP,
the remote executors, `exec-pyodide`, the docs site and L4/L5 are T-13's, and
nothing has been published.

**Did.** Executed `docs/plans/2026-10-14-s6-distribution-plan.md`'s eight tasks:
registry metadata and a licence copier for the five packages (`e04733d`); the
facade under `packages/smolagents-ts/**` (`cba0db4`); its component registration
(`13fa0f6`); the pack smoke over its subpaths (`95e2b4c`); the fixed group and
0.1.0 (`a27bee1`, `3484794`); `examples/node-script` (`191fb1c`); the README's
install and quick-start sections (`78cc03f`); and this record.

**Verified.** PASS — `pnpm gate` exit 0 (`.superpowers/gate-s6.txt`): 65 files and
447 tests, depcruise 157 modules and 388 dependencies with no violations, six
"All good!" from publint, `ci:check OK`, `pack-smoke OK: 6 packages`. PASS — the
context validator against the baseline reports no new finding, 0 errors, 0
warnings. PASS — `pnpm example:node` prints `Hello, world!`.

**Unverified / open.** The publish itself: no registry credentials and no
repository URL, so no manifest names one (T-14). The React example waits on
T-13's host choice (T-12). Rotation refuses an entry over its per-entry cap, so
the two oldest entries moved to `docs/handoff/archive-2026.md` by hand; T-10
tracks the over-cap S2 entry there.

**Next.** Choose the first module in T-13 and write its plan.

**Blockers.** T-13 and T-14 wait on the owner.

**Artifacts.** `docs/plans/2026-10-14-s6-distribution-plan.md`,
`docs/09-decisions/0006-distribution-shape.md`, `packages/smolagents-ts/AGENTS.md`.


## 2026-10-14T02:31:12+03:00 — S5 is complete: the React layer renders a run

**State.** `@smolagents-ts/react` exports four hooks and two compound primitives over
`AgentSession`, and the core's snapshot carries a `planning` lane. S5 is done; the runnable
example its definition also names is T-12, gated on S6's docs site. S6 and S1.5 have no plan.

**Did.** Executed the nine tasks of `docs/plans/2026-10-14-s5-react-layer-plan.md` in ten
commits (`c0d3690`..`cc7daa8`, then this record): the toolchain, `useAgentSession`,
`useAgentRun`, `useAgentEvent`, the core planning lane, `AgentRun` and `AgentStep` with
three leaf primitives, the composition and accessibility tests, and the pinned barrel. Four
findings the plan did not name, and decision 0005's three divergences from design section 10,
are in the plan's Measured results and the memory shard.

**Verified.** `pnpm gate` exit 0 — `.superpowers/gate-s5.txt`: 63 files and 444 tests, lint,
depcruise at 149 modules and 379 dependencies with no violations, build, publint, attw,
`ci:check OK`, `pack-smoke OK: 5 packages`. The react project alone is 8 files and 35 tests,
the core 29 and 290.

**Unverified / open.** No example app, no live model call, and no released artifact: the
package stays private, so its changeset line is inert until S6 picks a version line.

**Next.** Plan S6 (distribution), leaving the publish itself as the owner's gate.

**Blockers.** T-5, T-10 and T-12 stay with the owner.

**Artifacts.** `packages/react/AGENTS.md`, `docs/09-decisions/0005-react-layer-surface.md`.


## 2026-10-14T01:22:29+03:00 — S4 is complete: agent code runs in QuickJS

**State.** `@smolagents-ts/exec-quickjs` exports `QuickJSExecutor`, and `CodeAgent` now
releases its executor when a run ends. S4 is done; S5 (the React layer) has no plan yet.

**Did.** Executed the seven tasks of `docs/plans/2026-10-14-s4-quickjs-executor-plan.md`
in six commits (`e3c1d5d`..`05c24a4`): the guest program, the executor over one synchronous
QuickJS-WASM realm, the end-to-end tests under a real `CodeAgent`, the core release hook,
the barrel with a pinned surface test, and this record. Four findings the plan did not
name, each recorded in its Notes: a failed step's observation now carries the error text;
a platform with no usable WASM binary fails with a typed error, per
`rules/components/exec-quickjs.md`; the prelude declares with `var` and captures a step's
declarations in an epilogue; and a dropped stream iterator releases nothing.

**Verified.** `pnpm gate` exit 0 on the final tree — `.superpowers/gate-s4.txt`. The
exec-quickjs suite is six files and twenty-nine tests, the core suite 28 files and 288
tests; the validator reports `new: 0` with 0 errors and 0 warnings against the baseline,
and `rotate.py --check` exits 0.

**Unverified / open.** No live model call: the loop ran on `MockModel` and the golden
transcript. `capabilities.cpuTimeLimitMs` is deliberately absent, since the only budget is
the caller's `timeoutMs`. A consumer that abandons `agent.stream()` without `return()`
keeps the guest alive until it calls `dispose()` — measured, not assumed.

**Next.** Write and execute the S5 plan: the React layer's hooks and headless primitives.

**Blockers.** T-5 (the pruning-walker decision is still proposed) and T-10 (a past handoff
entry is over the pack's per-entry cap) stay with the owner.

**Artifacts.** `packages/exec-quickjs/src/executor.ts`, `packages/exec-quickjs/AGENTS.md`,
`docs/plans/2026-10-14-s4-quickjs-executor-plan.md`, `.changeset/s4-exec-quickjs.md`.


## 2026-10-14T00:29:15+03:00 — S3 is complete: the tool ecosystem ships

**State.** `@smolagents-ts/tools` exports `ToolCollection`, `htmlToText`, `userInputTool`,
`duckDuckGoSearchTool` and `visitWebpageTool` beside `VERSION`, and depends on the core
for `Tool` and `ToolContext`. S3 is done; S4 has no plan yet.

**Did.** Executed the seven tasks of `docs/plans/2026-10-14-s3-tool-system-plan.md`, one
commit each: the collection over the core registry, the HTML helper, the three default
tools with fixtures, the barrel with a pinned surface test, and this record. Two changes
the plan did not name: the tools project aliases core to its source in `vitest.config.ts`
and widens `rootDir` in `tsconfig.test.json`, because it now typechecks core's files.

**Verified.** `pnpm gate` exit 0 on the final tree, `ci:check` OK and five packages
installed and imported from tarballs; the tools suite seven files and twenty-eight tests,
`typecheck` and `build` exit 0; the validator reports no new findings with zero errors
and zero warnings; `rotate.py --check` exits 0.

**Unverified / open.** No default tool has run against the live endpoint or a real page:
every fixture is hand-shaped from documentation. Search reads the Instant Answer JSON
rather than scraping results, so it returns a summary and related topics where upstream
returns ranked links — a divergence recorded in the plan and the tool's description. One
older inline entry is over the pack's per-entry cap, so `rotate.py --apply` aborts;
T-10 holds that for the owner.

**Next.** Write and execute the S4 plan: the `CodeExecutor` implementations,
`exec-quickjs`, final-answer bridging and async tool-call bridging.

**Blockers.** None for S4; T-5 stays with the owner.

**Artifacts.** `packages/tools/`, `packages/tools/AGENTS.md`,
`docs/plans/2026-10-14-s3-tool-system-plan.md`, `docs/tasks/archive-2026.md`.


## 2026-10-14T00:09:45+03:00 — S2 is complete: three adapters ship and the model layer closes

**State.** `@smolagents-ts/models` exports five adapters — `OpenAICompatibleModel`,
`AnthropicModel`, `GeminiModel`, `HuggingFaceModel` and `CustomModel` — so all four
tier-1 providers of S2 exist and `docs/01-project.md` marks S2 done. Every adapter
reaches the network through an injected fetch, and neither the tests nor an import
needs a key.

**Did.** Executed the eight tasks of
`docs/plans/2026-10-13-s2b-anthropic-gemini-huggingface-plan.md` in seven commits
(`8424350`..`bda2663`), plus the unused import the gate's lint step found (`99282a2`),
plus this record: the Anthropic Messages adapter with its `system` field,
`tool_use`/`tool_result` blocks and named-event stream; the Gemini
`generateContent` adapter and its `alt=sse` stream; the HuggingFace router as a
subclass of the OpenAI adapter that asks for streamed usage; the barrel with its
pinned surface; and an end-to-end test that drives the Anthropic adapter through a
real `ToolCallingAgent`. T-7 moved to `docs/tasks/archive-2026.md`,
`packages/models/AGENTS.md` now names the adapters and the measured count, and five
lessons went to `docs/memory/general.md`.

**Verified.** `pnpm gate` exit 0 — `.superpowers/gate-s2b.txt`: 44 files and 351
tests, lint, depcruise at 105 modules and 243 dependencies with no violations,
build, publint, attw, `ci:check OK`, and `pack-smoke OK: 5 packages installed and
imported from tarballs`. The models project alone is 13 files and 62 tests. The
validator reports `new: 0` with 0 errors and 0 warnings, and `rotate.py --check`
exits 0.

**Unverified / open.** No live provider call was made for any of the three adapters;
every fixture is hand-shaped from published documentation, so each wire format is
faithful to its document rather than to an endpoint exercised today. Gemini's
JSON-array stream form is deliberately unread and its adapter pins `alt=sse`. The
`supports`/`capabilities` drift in the design record is still an owner decision, and
nothing in this milestone touched `packages/core`.

**Next.** S3 (the tool system), or the release work S2 leaves open — package subpaths
and the changeset merge — whichever the owner picks.

**Blockers.** T-5 waits on the owner:
`docs/09-decisions/0003-pruning-surface-walker.md` is proposed, not accepted.

**Artifacts.** `packages/models/src/anthropic.ts`, `packages/models/src/gemini.ts`,
`packages/models/src/huggingface.ts`, `.changeset/s2b-model-adapters.md`,
`docs/plans/2026-10-13-s2b-anthropic-gemini-huggingface-plan.md`.


## 2026-10-13T20:40:53+03:00 — main is the S2a state; the branch is gone

**State.** The work sits on `main` at `79a4f9c` and `context-pack-adoption` is deleted, so the
next session starts from the default branch with nothing left to integrate.

**Did.** Fast-forwarded `main` from `e4e4b5a` to `79a4f9c` — twelve commits: the pack
adoption, the S2a plan, and the S2a implementation — then removed the merged branch.

**Verified.** `pnpm test` on `main`: 38 files and 319 tests, exit code 0, on the tree the gate
already passed. Working tree clean. T-7 moved to in_progress.

**Unverified / open.** Unchanged from the entry below: no live provider call, the
`supports`/`capabilities` drift still open, T-5 still with the owner, S2b unplanned.

**Next.** Write the S2b plan for the Anthropic, Gemini and HuggingFace adapters (T-7).

**Blockers.** T-5 waits on the owner; `docs/09-decisions/0003-pruning-surface-walker.md` is
proposed, not accepted.

**Artifacts.** `docs/04-tasks.md`, `git log --oneline -1`.


## 2026-10-13T20:54:22+03:00 — the S2b plan is written; execution is the next step

**State.** `main` is at `964c702` plus this entry. S2a is merged and its branch is gone;
S2b is planned but not executed, so `docs/04-tasks.md` still shows T-7 in progress.

**Did.** Wrote `docs/plans/2026-10-13-s2b-anthropic-gemini-huggingface-plan.md`: eight
tasks for the Anthropic, Gemini and HuggingFace adapters, each with its files, steps, a
red/green command and a commit. Also corrected the S2a fixture comment that called a
hand-shaped completion a recording.

**Verified.** The validator reports `new: 0` with no errors and no warnings;
`rotate.py --check` exits 0; the plan carries the `Contract` heading a new `docs/` file
needs.

**Unverified / open.** No adapter from this plan exists yet, and the Anthropic and Gemini
wire facts come from published documentation rather than from a call this project made.

**Next.** Execute the plan task by task, starting with the Anthropic adapter.

**Blockers.** T-5 still waits on the owner.

**Artifacts.** `docs/plans/2026-10-13-s2b-anthropic-gemini-huggingface-plan.md`,
`.superpowers/validate-s2b-plan.json`.


## 2026-10-13T20:09:21+03:00 — S2a landed: the seam is closed and one real adapter ships

**State.** `@smolagents-ts/models` holds a working provider adapter, and the core loop
passes tool schemas while keeping streamed tool calls and usage. A caller can run a
`ToolCallingAgent` against OpenAI or any endpoint that copies its wire format, in Node or in
a browser tab, because the adapter reaches the network through an injected fetch and imports
no Node builtin. Anthropic, Gemini and HuggingFace are unbuilt, so the model layer is partial
by design rather than by omission.

**Did.** Executed the nine tasks of
`docs/plans/2026-10-13-s2a-model-seam-and-openai-compatible-plan.md` in eight code commits
(`511f5e4`..`85f194e`) plus this record. Four core defects closed: the advertised schemas now reach the
request, `toMessages()` renders an assistant tool call with its results, the streaming branch
keeps what it accumulated, and `AgentSession` no longer drops a call reported as failed
first. New files: `packages/models/src/transport.ts`, `sse.ts`, `openai-compatible.ts` and
`custom.ts`; `tsconfig.base.json` gained a path mapping to the core source. T-2 and T-6
moved to the archive and T-7 (S2b) opened.

**Verified.** `pnpm gate` exit 0 — `.superpowers/gate-s2a.txt`: 38 files and 319 tests, lint,
depcruise at 94 modules with the new `core-no-models` rule proven by a probe that was then
deleted, build, publint, attw, and `pack-smoke OK: 5 packages installed and imported from
tarballs`. The plan's pre-registered `workspace:*` risk did not materialize: one
`npm install` resolved the sibling tarball. The context validator, run with the baseline
after these records were written, reports no new findings.

**Unverified / open.** No live provider call was made; every fixture is recorded, so the wire
format is faithful to the documented shape rather than to an endpoint exercised today. The
streaming path and `CustomModel` are covered by tests and by no shipped agent, because both
shipped agents return `prefersStreaming = false`. The design record still sketches the
capability field as `supports` where the shipped interface says `capabilities`; that drift
is an owner decision and this plan deliberately left it alone. S2b has no plan yet.

**Next.** Write the S2b plan for the Anthropic, Gemini and HuggingFace adapters (T-7).

**Blockers.** T-5 waits on the owner: `docs/09-decisions/0003-pruning-surface-walker.md` is
proposed, not accepted.

**Artifacts.** `packages/models/src/openai-compatible.ts`,
`packages/models/test/agent-e2e.test.ts`,
`docs/plans/2026-10-13-s2a-model-seam-and-openai-compatible-plan.md`.


## 2026-10-13T19:41:34+03:00 — the S2a plan is written; execution is the next step

**State.** S2 is in progress and now has a plan it can be executed from. Nothing under
`packages/` has changed since the S0/S1 report, so the library is exactly where it was:
core green, ToolCallingAgent still unusable against a real provider.

**Did.** Wrote `docs/plans/2026-10-13-s2a-model-seam-and-openai-compatible-plan.md` with
nine tasks, and split S2 because four tier-1 adapters are four independent wire formats:
S2a is the seam plus `OpenAICompatibleModel` and `CustomModel`, S2b is Anthropic, Gemini
and HuggingFace. The plan front-loads four measured core defects — the loop never passes
`tools`, the streaming branch returns `toolCalls: []` with `EMPTY_TOKEN_USAGE`,
`toMessages()` drops assistant tool calls, and `AgentSession` drops a call whose failure
arrives first. T-2 moved to in_progress and T-6 (execute the plan) was added.

**Verified.** `python scripts/validate_context.py --root . --baseline docs/.baseline.json
--json` reports `{"new": 0, "baselined": 14, "errors": 0, "warnings": 0}`, and
`rotate.py --check` exits 0. The plan's first run produced four warnings; rewording three
quoted comments and one control line took them to zero. No code was run this session.

**Unverified / open.** Every code change the plan proposes is unexecuted, so all of it is a
proposal rather than a result, and the last green gate remains the close-out at `ba48d0b`.
The plan's pre-registered risk is `pnpm pack` rewriting `workspace:*` to `0.0.0` while
`pack-smoke.mjs` installs all five tarballs at once; Task 5 Step 6 measures that and names
the fallback. No fresh session has answered the five boot questions.

**Next.** Execute Task 1 of the plan, or have the plan reviewed first.

**Blockers.** None. T-5 waits on the owner.

**Artifacts.** `docs/plans/2026-10-13-s2a-model-seam-and-openai-compatible-plan.md`,
`docs/04-tasks.md`, `docs/memory/general.md`.


## 2026-10-13T19:34:09+03:00 — the adoption is closed out; S2 chosen; both pack patches recorded

**State.** The context pack is adopted and accepted, and S2 (model layer) is the
milestone in progress. The library is unchanged from the S0/S1 report: core
green, ToolCallingAgent still unusable against a real provider.

**Did.** Closed the adoption ledger — T-1 done, T-3 answered (S2), T-4 accepted —
and rotated those rows to `docs/tasks/archive-2026.md`; answered both open
questions in `docs/01-project.md` (revision 3); accepted
`docs/09-decisions/0001-pack-walk-excludes-vendored-trees.md`; added
`docs/09-decisions/0003-pruning-surface-walker.md` with `iter_surface()` in
`scripts/_packmodel.py`, now used by `walk()`, `c00_adapt()` and
`Pack.scoped_agents()`; corrected the false runtime claim in 0001 and added its
lesson to `docs/memory/general.md`.

**Verified.** `python scripts/validate_context.py --root . --baseline
docs/.baseline.json --json` reports `{"new": [], "baselined": 14, "errors": 0,
"warnings": 0}`, byte-identical before and after the pruner, in 433 ms against
179,240 ms before it. `pnpm gate` exited 0 on this tree at `e4e4b5a` and no
package source has changed since.

**Unverified / open.** No fresh session has answered the five boot questions from
the repository alone, so readability stays unproven. Bun and Deno are not
installed here, so those runtime legs are CI-only. Both pack patches are local
deviations; T-5 waits on the owner.

**Next.** Write the S2 plan, then execute it from a reviewed brief.

**Blockers.** None. T-2 waits on the S2 plan's tasks, T-5 on the owner.

**Artifacts.** `docs/09-decisions/0003-pruning-surface-walker.md`,
`.superpowers/validate-before-prune.json`, `docs/01-project.md`.


## 2026-10-13T18:47:31+03:00 — context pack adopted; S1 state recorded

**State.** Branch `context-pack-adoption` off `main` at `e4e4b5a`: the context
pack 2.0.0 is installed and its project facts are written. The library is where
the S0/S1 report left it — core green, ToolCallingAgent not yet usable against
a real provider.

**Did.** Installed the pack (57 files copied, 3 skipped, 10 skeletons created),
moved the five component entries to `packages/<id>/AGENTS.md` and rewrote the
router's component table; wrote `docs/01-project.md`, `docs/02-environment.md`,
`docs/06-glossary.md` and `docs/07-sources-of-truth.md` from measured facts; added
one decision record, one runbook, one decision-index row and two lessons; merged
three ignore lines into `.gitignore`; and patched `SKIP_TOP` so the pack's
walker stays out of the gitignored vendored trees.

**Verified.** `pnpm gate` at this tree: exit 0 — typecheck on 5 projects, lint,
depcruise 85 modules / 173 dependencies, 31 test files / 277 tests, build on 5
packages, publint clean on 5, attw, `ci:check`, pack:smoke. Per package: core
273 tests, the other four 1 each. `setup.py markers` reports 0 home markers.
`python scripts/validate_context.py --root .`: 0 errors, 14 warnings, all
inherited from pre-existing documents.

**Unverified / open.** No fresh session has answered the five boot questions from
the repository alone, so documentation readability is unproven. Bun and Deno are
not installed here, so those runtime legs are CI-only. The pack patch is a local
deviation and needs the owner's confirmation (T-4).

**Next.** Re-read this branch in a fresh session, answer the five boot questions
from the repository alone, then record the S2/S4 order.

**Blockers.** None for the adoption. T-3 waits on the owner's milestone choice,
which is also the ground the ToolCallingAgent gaps sit on.

**Artifacts.** `docs/02-environment.md`, `docs/09-decisions/0001-pack-walk-excludes-vendored-trees.md`, `docs/10-runbooks/gate.md`, `.superpowers/gate-output-adoption.txt`.
