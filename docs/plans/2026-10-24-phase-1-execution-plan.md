# Plan — Phase 1 execution: the durability spine

**Contract**
- **Role:** the execution plan for Phase 1 of the 2026-10-22 research plan; item by item, with a pre-registered acceptance test and a rollback for each.
- **Mutability:** the order and the criteria are frozen once work starts; a correction goes into `## Changes`, never into a quiet rewrite.
- **Read when:** starting or resuming Phase 1.
- **Update when:** an item lands, or a criterion proves wrong.

- **Status:** active
- **Owner:** owner
- **Created:** 2026-10-24T15:10:00+03:00
- **Opened by:** owner, "continue to next phase" (2026-10-24)
- **Parent plan:** [`2026-10-22-apply-the-competitor-findings-plan.md`](docs/plans/2026-10-22-apply-the-competitor-findings-plan.md)
- **Task row:** `T-42`
- **Design source:** [`15-durability-design-brief.md`](docs/research/competitors/_synthesis/15-durability-design-brief.md), decisions [`0023`](docs/09-decisions/0023-one-identity-per-run.md) and [`0024`](docs/09-decisions/0024-publication-waits-for-corrections.md)

## Goal

Make a run a durable record instead of a checkpoint of steps: one record type with one
commit boundary, a pending request that a later process can settle, one writer at a time,
an effects journal that replays instead of re-running, a file store that passes the
contract, a CLI that can resume and approve, a conversation that outlives a run, and a
fork from a named step. Eight items, strictly ordered — each extends the type the one
before it introduced.

## Preconditions

- Decision `0023` is accepted and owns the vocabulary: `runId`, `waiting`, `pending`,
  `resume`; `interrupted` is a dead process, never a human pause.
- Phase 0 is closed at `bf3c667`; `pnpm gate` exits 0; core reports 39 files, 460 tests.
- The Phase 0.8 store contract exists at `packages/core/test/contract/run-store.contract.ts`;
  every store item extends it rather than writing a second suite.
- A source change waits for its acceptance test, which is written to fail first.
- Nothing is published (`0024`), so the record's version bump has no external reader.

## Waves

| wave | items | writer | why together |
|---|---|---|---|
| A | 1.1, 1.2, 1.3, 1.4 | one loop writer | each extends `RunRecord` and the loop's single commit boundary; no two may land in parallel |
| B | 1.5, 1.6, 1.7, 1.8 | one loop writer, one CLI writer in 1.6 only | the store and the surface; 1.6 needs 1.2 and 1.5 first |

A wave ends with `pnpm gate` exit 0 and the contract suite green. Each item ends at one
commit; the item's entry in `## Changes` records what was built, not what was intended.

## Wave A — the record

### 1.1 — a run is a record with one commit boundary

**Today.** `RunStore` saves and loads a `RunSnapshot` — a format version and the memory's
steps — under a caller string called `checkpoint` (`RunOptions.checkpoint`). There is no
run identity, no status, no record; `persist()` writes memory alone, and a resumed run
trusts whatever steps it finds.

**Change.** A new `RunRecord` (in `packages/core/src/session/run-record.ts`) with
`schemaVersion`, `runId`, `status` (`running | waiting | completed | failed | interrupted`),
`generation`, `step` (the open step, cleared by the commit that closes it), the memory
snapshot, and `createdAt` / `updatedAt`. `RUN_RECORD_VERSION = 2`: version 1 is the
Phase 0.5 envelope, version 0 the bare step array, and the reader translates both forward
— v1 and v0 records load as `interrupted` at generation 0 rather than failing, because the
risk table buys one phase of dual reading. A version above 2 is refused with a typed error
that names both numbers. The store interface becomes `commit(runId, record)` and
`load(runId)`; the store never decides a boundary, it only stores what the loop hands it.
`RunOptions.checkpoint` is renamed `runId` (`0023`); `AgentOptions.store` keeps its name.
The loop gets one commit helper and calls it at the step boundary, at success, at failure
and at the step cap; every call writes one complete record.

**Files.** `packages/core/src/session/run-record.ts` (new),
`packages/core/src/session/run-store.ts`, `packages/core/src/agent/multi-step-agent.ts`,
`packages/core/src/agent/run-result.ts`, `packages/core/src/errors.ts`,
`packages/core/src/index.ts`, `packages/core/test/contract/run-store.contract.ts`,
`packages/core/test/run-store.test.ts`, `packages/core/test/public-surface.test.ts`.

**Acceptance (pre-registered).** A scripted run with a store commits exactly once per
recorded step plus one terminal commit; the record names the run id, status `completed`,
and the run's steps in order. A run that throws commits status `failed` with the steps
before the failure. A v1 envelope and a bare v0 array load and translate to a record; a
record stamped version 3 is refused with a typed error naming 3. The ten-mode contract
suite passes against the new interface for `MemoryRunStore` and the suite's double.

**Rollback.** Revert the commit; the interface and the suite revert together, and no
published caller exists to break.

### 1.2 — a pending request as state, and `resume`

**Today.** An approval verdict is one of four outcomes and is consumed synchronously; a
run cannot park on it, and nothing durable carries a request id. `RunState` has two
values, and the only way to continue a run is to reload its steps.

**Change.** The verdict set gains a fifth outcome, `pending`: the gate stops the run
instead of deciding it, and the loop commits the record as `waiting` with a
`pending` object — `kind: "approval"`, the request id, the input digest, the tool name,
the step index and an optional `expiresAt` — then ends the run with `RunState "waiting"`
and a `run.waiting` event. `RunOptions.resume` accepts `{requestId, outcome}`; a resume
loads the record, checks the request id and digest, settles the request once (a
`settlements` list is appended to the record, never truncated), emits `run.resumed`, and
re-enters the unfinished step. At the gate a settled approval is honoured only when its
digest matches the ask in the same step — a resumed step generates fresh call ids, so the
binding is digest-and-step, not call id. A wrong request id, a mismatched digest, a
settlement past `expiresAt`, and a second settlement of the same request each fail typed
and run no effect.

**Files.** `packages/core/src/agent/approval.ts`, `packages/core/src/agent/multi-step-agent.ts`,
`packages/core/src/session/run-record.ts`, `packages/core/src/agent/run-result.ts`,
`packages/core/src/events.ts`, `packages/core/src/errors.ts`, `packages/core/src/index.ts`,
`packages/react/src/agent-run.tsx` (status text), `packages/core/test/approval.test.ts`,
`packages/core/test/events.test.ts`, `packages/core/test/session-resume.test.ts`.

**Acceptance.** A run parks on the first gated call: the record is `waiting`, carries the
request id and digest, and the tool did not run; a second agent resuming with
`{requestId, outcome: "allowed-once"}` finishes the run and the tool ran once; a second
resume of the same request reports the settled state and runs nothing; a wrong request id
and a digest mismatch are refused typed; an expired request is refused typed; the event
stream holds one `run.waiting` and one `run.resumed` around the park.

**Rollback.** Revert the commit; the fifth outcome is additive, the record fields are
optional, and `run.waiting` / `run.resumed` have no producer once reverted.

### 1.3 — one owner at a time, and repair forward

**Today.** After 1.1 a record has a status but no owner and no fence; two processes can
both load it and both commit, and the last write wins.

**Change.** `generation` becomes the fence and `owner` names the holder. The store gains
`claim(runId, expectedGeneration, owner)`, which compare-and-sets the generation and
returns the claimed record, and `commit(runId, record, expectedGeneration)`, which refuses
a writer whose generation is stale. Two typed errors carry the outcome:
`RunClaimedError` when a live claim loses, `StaleWriterError` when a commit loses. A
terminal status clears `owner`. A resume of a `running` record left by a dead process
claims it, keeps every step the record holds, appends one synthetic `completed` closer for
the open `step` (`state: "interrupted"`) — never truncates — and then runs forward; the
record gains `completed` for this, and the loop writes an entry per finished step.

**Files.** `packages/core/src/session/run-record.ts`, `packages/core/src/session/run-store.ts`,
`packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/errors.ts`,
`packages/core/src/index.ts`, `packages/core/test/contract/run-store.contract.ts`,
`packages/core/test/run-store.test.ts`.

**Acceptance.** Two resumers race: exactly one claim succeeds, the loser gets
`RunClaimedError`, and `generation` advances once. A writer that read generation 3 and
commits after another claim reached 4 gets `StaleWriterError`, the stored record is
byte-identical, and the run stays resumable. A resume of a crashed `running` record keeps
all its steps, appends one interrupted closer naming the open step, and finishes the run.

**Rollback.** Revert the commit; the fence is additive to the interface and the record
fields are optional for old stores.

### 1.4 — an effects journal

**Today.** After 1.3 a crashed run keeps steps but nothing records what happened inside
one, so a resume re-runs the interrupted step's effects and cannot tell a finished effect
from an unknown one.

**Change.** The record gains a `journal`: one entry per external effect — the model
request and each wrapped tool call — with `stepId`, `callId`, `toolName`, `argsDigest`,
`state` (`intent | done | unknown`) and, for `done`, the result and usage. The loop
writes `intent` before an effect and `done` after it; the commit after the step carries
both. On resume a `done` entry returns its recorded result instead of running the effect;
an `intent` without a result is surfaced as `EffectOutcomeUnknown` — the explicit in-doubt
state — and is retried only when the tool declares itself idempotent
(`ToolDefinition.idempotent`), which the record notes with `state: "unknown"` after the
retry. The model request is journaled the same way so a resumed step does not pay for it
twice.

**Files.** `packages/core/src/session/run-record.ts`, `packages/core/src/agent/multi-step-agent.ts`,
`packages/core/src/tool/tool.ts`, `packages/core/src/errors.ts`,
`packages/core/src/index.ts`, `packages/core/test/journal.test.ts`,
`packages/core/test/run-store.test.ts`.

**Acceptance.** A crash between steps resumes at the next step and the previous step's
tool counter does not move. A crash after a tool ran but before its journal result is
surfaced as `EffectOutcomeUnknown` and is not retried. The same fixture with the tool
declared idempotent retries once, the counter reads two, and the record's entry says
`unknown`. A journaled `done` model request is not repeated on resume.

**Rollback.** Revert the commit; the journal field is optional and absent from old records,
which replay as today.

## Wave B — the surface

### 1.5 — a file store that passes the contract

**Today.** The only shipped store is `MemoryRunStore`; the temporary-file double lives in
the test and passes the suite, but no store a caller can keep is shipped.

**Change.** `FileRunStore` in core over an injected `RunFileSystem` seam (read, write,
rename, delete, list) so core stays isomorphic; each record is one JSON file named by the
run id, written to a temporary file and renamed into place. `nodeRunFileSystem()` in the
CLI package binds the seam to `node:fs/promises`. The contract suite grows a record group
(commit, load, claim, stale refusal, conversation lookup) and both the in-memory filesystem
double and the real temporary directory pass it.

**Files.** `packages/core/src/session/file-run-store.ts` (new),
`packages/core/src/session/run-store.ts`, `packages/core/src/index.ts`,
`packages/cli/src/store.ts` (new), `packages/core/test/contract/run-store.contract.ts`,
`packages/core/test/file-run-store.test.ts`.

**Acceptance.** The contract suite passes for `FileRunStore` over a temporary directory;
two commits of one run leave one file; a torn write (a rename from a missing temporary)
leaves the previous record intact; the Node binding round-trips a record through a real
temporary directory in the CLI package's test.

**Rollback.** Delete the new files; the seam is additive and nothing requires the store.

### 1.6 — `--resume` and `--approve` in the CLI

**Today.** The CLI starts a run and drains it; it has no store, no run id and no way to
answer a parked approval.

**Change.** The parser gains `--run-id <id>`, `--resume <runId>`, `--approve <requestId>`
and `--state-dir <dir>` (default `.smolagents` beside the working directory); the run
function builds the agent with a `FileRunStore`, parks with exit code 3 when the run waits,
and resumes and settles when `--resume` and `--approve` are given. The usage text and the
renderer name the waiting state and the pending request id.

**Files.** `packages/cli/src/args.ts`, `packages/cli/src/run.ts`,
`packages/cli/src/errors.ts`, `packages/cli/src/renderer.ts`,
`packages/cli/src/store.ts`, `packages/cli/test/args.test.ts`,
`packages/cli/test/run.test.ts`, `docs/10-runbooks/` (a resume runbook).

**Acceptance.** A parser fixture accepts the four flags and rejects a resume without
`--state-dir` when none exists; an end-to-end test in one process parks a run with exit 3,
then a second CLI invocation resumes by id, approves the request, and finishes with exit 0;
the manual two-process run is recorded in the phase report.

**Rollback.** Revert the commit; the store file stays harmless.

### 1.7 — a conversation that outlives a run

**Today.** After 1.6 a run is addressable but two runs of one conversation share nothing;
the record has no conversation id and the store cannot find the newest run of one.

**Change.** `RunRecord.conversationId` (optional) and `RunOptions.conversationId`; the
store gains `latestForConversation(conversationId)` returning the newest record, and the
CLI gains `--conversation <id>` which resumes the newest run of the conversation when one
exists and otherwise starts a new run tagged with it.

**Files.** `packages/core/src/session/run-record.ts`, `packages/core/src/session/run-store.ts`,
`packages/core/src/session/file-run-store.ts`, `packages/core/src/agent/multi-step-agent.ts`,
`packages/core/src/index.ts`, `packages/cli/src/args.ts`, `packages/cli/src/run.ts`,
`packages/core/test/contract/run-store.contract.ts`, `packages/core/test/run-store.test.ts`.

**Acceptance.** Two runs with one conversation id: the second record points at the same
conversation, `latestForConversation` returns the second, and a third invocation with
`--conversation` resumes the second rather than starting a fourth; a conversation id with
no run starts one and records it.

**Rollback.** Revert the commit; the field and the lookup are optional and unread.

### 1.8 — fork from a named step

**Today.** After 1.4 a run replays its journal, but there is no way to branch: the only
parent relationship is none, and forking would re-run effects.

**Change.** `RunOptions.fork` accepts `{fromRunId, atStep}`; the new run gets a fresh
`runId`, copies the parent's memory and journal through that step, records
`parentRunId` / `parentStep`, clears `pending` and `owner`, starts at generation 0, and
replays the copied journal so no recorded effect runs again. The record gains
`parentRunId` and `parentStep`.

**Files.** `packages/core/src/session/run-record.ts`, `packages/core/src/agent/multi-step-agent.ts`,
`packages/core/src/session/run-store.ts`, `packages/core/src/index.ts`,
`packages/core/test/fork.test.ts`, `packages/cli/src/run.ts`, `packages/cli/src/args.ts`.

**Acceptance.** A three-step run is forked at step 1; the fork's record names the parent
and the step, its journal returns the parent's step-1 effect result without running the
tool again (the counter does not move), and the fork finishes with its own run id. A fork
of a waiting run clears the pending request instead of inheriting it.

**Rollback.** Revert the commit; the option is additive.

## Verification per item

1. The acceptance test exists and fails before the change.
2. The item's unit suite and the store contract pass: `pnpm vitest run --project core`
   (plus `--project cli` for 1.5–1.8).
3. `pnpm gate` exits 0; `python scripts/validate_context.py --root . --baseline docs/.baseline.json`
   reports 0 errors, 0 warnings; `python scripts/rotate.py --check` is clean.
4. One commit per item; nothing pushed.

## Phase close

- The exit criterion in the parent plan runs as one test: a run parks on an approval, the
  first process stores it, a second process reads the record, refuses a wrong owner,
  resumes and finishes; separately, a crash after a tool call resumes without repeating it.
- A manual two-process run is recorded in the phase report, written when the last item lands.
- `docs/04-tasks.md` closes `T-42`; the parent plan's Phase 1 rows are checked against
  the code before the report is written.

## Changes

*(newest first; an entry is written when an item lands or a criterion proves wrong)*

- **2026-10-24 — 1.6 as built.** The parser reads `--run-id`, `--resume`, `--approve`
  and `--state-dir`; `--approve` without `--resume` is a usage error, because a settlement needs
  a run to settle. A durable run (`--run-id`, or a resume) gets a `FileRunStore` over
  `nodeRunFileSystem`, with the state directory resolved against the working directory and
  `.smolagents` as the default. A headless process cannot ask anyone, so the approval handler
  answers `pending`: the loop commits the request and parks, and the CLI exits **3** instead of
  0 or 1. Resuming loads the record first — a missing state directory names `--state-dir`, an
  absent record names the run, and a waiting run without `--approve` prints the request id it
  needs. `--approve <requestId>` settles it as `allowed-once` and re-enters the parked step; the
  task is read back from the record, so the prompt need not be retyped. The renderer names the
  waiting state and the exact resume command, and a runbook walks the two invocations.
- **Acceptance.** Parser fixtures cover the four flags and the `--approve`-needs-`--resume`
  refusal. `resume-e2e` parks a real `CodeAgent` at exit 3, reads the stored request id,
  resumes in a second invocation and finishes at exit 0, with the tool run once and the parked
  model request replayed rather than paid for twice. Two refusal cases cover the missing
  directory and the unknown run. The parser cannot decide whether a directory exists, so that
  check lives in the run function beside the store it serves — a refinement of the item's
  wording, not of its behaviour.
- **Public surface.** No new export; `stateDir` is required on `CliArguments` because the parser
  always fills the default, and optional on `RunSmolagentOptions`.

- **2026-10-24 — 1.5 as built.** `FileRunStore` ships in core over an injected `RunFileSystem`
  (`read`, `write`, `rename`, `delete`, `list`), so core stays isomorphic. A run is one file
  named `encodeURIComponent(runId) + ".json"`; a commit writes a random temporary name, renames
  it into place, and deletes the temporary on failure, so a torn write leaves the previous record
  authoritative. A stale commit is refused before the temporary is written; a claim reads, bumps
  the fence and writes the claimed record. The CLI supplies the Node half —
  `nodeRunFileSystem(directory)` plus `DEFAULT_STATE_DIRECTORY` — which owns the directory,
  creates it on first write and refuses any file name that is not flat, because a runId is
  opaque text.
- **Certification.** The conformance suite's hand-built temporary-file double was replaced by
  the shipped `FileRunStore` over a Node seam, so all three stores (memory, async memory, file)
  now pass the same twelve modes; the contract needed no new mode. `file-run-store.test.ts`
  adds the four acceptance checks: one file after two commits, a stale refusal, a failed rename
  leaving the previous record, and a run id with path characters staying one flat file.
- **Acceptance order.** The core test was red on the missing module before `FileRunStore`
  existed; the CLI test was re-run red with the binding temporarily moved aside, then restored.
- **Public surface.** `FileRunStore`, `RunFileSystem` and `nodeRunFileSystem` are pinned;
  core grew from 503 to 509 tests and the CLI from 59 to 63.

- **2026-10-24 — 1.4 as built.** `RunRecord` gains optional `journal`
  `[{stepId, callId, toolName, argsDigest, state: intent | done | unknown, result?, usage?, at}]`;
  a model request is an entry with `toolName ""` and `callId "model"`. The loop writes the
  intent and commits it *before* the effect, then writes the result and commits again; a replay
  returns the recorded result and runs nothing. An `intent` with no result means the effect may
  have run: a non-idempotent tool raises `EffectOutcomeUnknownError` (`AGENT_EFFECT_UNKNOWN`,
  carrying `toolName` and `callId`) and the run fails without retrying; a tool whose
  `ToolDefinition.idempotent` is true is retried once and its entry becomes `unknown`. Model
  requests are journaled and replayed too, so a resumed step does not pay for the same generation
  twice. The four failure modes from the brief (crash between steps, crash after effect, idempotent
  retry, model not repeated) are the acceptance tests.
- **Identity and ordering.** `stepId` is the attempt id: a fresh UUID per attempt, reused when a
  repair or a parked resume re-enters the recorded attempt, so a step's entries bind to it.
  Commits are serialised through one tail promise, because a code block may announce several
  effects concurrently. The step in flight is not durable: every non-terminal commit carries
  `memory` from the last boundary (plus `step`), which is what lets `parkRun` restore memory
  without the unfinished step.
- **CodeAgent.** The executor receives a wrapped `ToolRegistry` whose tools journal around the
  call, so generated code replays finished effects like structured calls. A replay that hits an
  unknown outcome surfaces inside the code as a tool failure rather than a loop failure — a
  limitation recorded here, not solved in 1.4.
- **Redaction.** A tripped answer guardrail now also rewrites the answering step's journal entries
  to `[redacted]`, so a blocked answer never reaches the record through the journal path.
- **Superseded count.** 1.1's commit counts are superseded: each step now writes intent and result
  commits beside its boundary, so the store test asserts monotonic actions and one terminal
  commit instead of exact totals. The public surface gains `EffectOutcomeUnknownError`;
  `JournalEntry` and `JournalState` are exported from `run-store`. Core grew from 496 to 503 tests.

- **2026-10-24 — 1.3 as built.** `generation` is the fence and `owner` names its holder;
  `RunRecord` gains optional `owner`, `step {index, stepId, startedAt}` and
  `completed [{stepId, index, state, result?, usage?, finishedAt}]`. The seam gains
  `claim(runId, expectedGeneration, owner)` — a compare-and-set refused with
  `RunClaimedError` — and `commit(runId, record, expectedGeneration)`, refused with
  `StaleWriterError` before a byte is written. `MemoryRunStore` and the temporary-file
  double both fence; the contract gained a `claim` and a `stale` mode with rejecting
  counterexamples, so it now runs twelve modes against each store.
- **Repair forward.** Continuing a stored run claims it first, and a resume is validated
  against the record *before* the claim, so a wrong request id runs no effect and leaves no
  owner. A waiting record is claimed, settled and committed `running`; a `running` record
  left by a dead process is claimed and repaired: every step kept, one synthetic
  `completed` closer appended for the open `step` with `state: "interrupted"`, and the
  loop re-enters that index. A completed record is claimed but not repaired, because a
  session may continue it as a fresh turn.
- **One entry per finished step.** The loop records the step when it adds it and closes it
  at the boundary (the answering step is closed by `complete()`), so every commit carries
  `step` while a step is in flight and `completed` accumulates one entry per finished
  step. The list is appended to and never truncated; the parked step is dropped from memory
  and never gets an entry, because it did not run.
- **Ownership lifecycle.** A terminal commit drops `owner` and `step`; a pause keeps the
  owner while the record waits. Commits carry the claimed generation, so a writer overtaken
  by a later claim gets `StaleWriterError` instead of last-write-wins. Core grew from 479
  to 496 tests.
- **Left to 1.4.** Effects inside an interrupted step still run again; the repair guarantees
  the step is named, not that its side effects are known.

- **2026-10-24 — 1.2 as built.** The approval verdict set gains `pending`: the gate records the
  decision, throws `ToolApprovalPendingError`, the loop drops the unfinished step, and commits
  the record `waiting` with `pending {kind, requestId, toolName, argsDigest, stepIndex, createdAt,
  expiresAt?}`. The run ends with a `run.waiting` event whose `RunResult` has `state "waiting"`
  and the request; `run()` returns it rather than throwing, so a caller reads the pause from the
  result. `RunState` therefore gains a third value, which the design brief did not name.
- **Resume.** `RunOptions.resume {requestId, outcome}` requires `runId`; the loop loads the record,
  refuses typed on a missing run, an unknown request id, a status that is not waiting, an expired
  `expiresAt`, or a request already in `settlements` (which reports that settlement), appends one
  settlement, commits the pause consumed as `running`, emits `run.resumed`, and re-enters the
  unfinished step at its original index. The gate binds the settlement to digest-and-step, since
  a resumed step generates fresh call ids; a call with other arguments throws
  `RunApprovalMismatchError` and runs no effect.
- **Gate always present on resume.** Tools are gated at construction only when a handler or the
  `never` policy needs it, so a resumed run without a handler would have run ungated; resume now
  installs the gate before the loop. This is why `MultiStepAgent.tools` is no longer `readonly`.
- **Settlements accumulate.** The list is appended to and never truncated; the pending object is
  removed by the commit that consumes the pause. Two processes resuming the same request still
  race until 1.3 adds the claim and generation fence.
- **Session and UI.** `SessionStatus` gains `waiting`, the session applies `run.waiting`, and the
  React status table names it.

- **2026-10-24 — 1.1 as built.** A run is a `RunRecord` under a `runId`: schema version, status
  (`running | waiting | completed | failed | interrupted`), generation, the memory steps, and
  timestamps. `RUN_RECORD_VERSION` is 2 while `RUN_SNAPSHOT_VERSION` 1 is the legacy envelope;
  the version 1 envelope and the version 0 bare array both translate forward as a record whose
  process died (`interrupted`, generation 0), and a version above 2 throws
  `RunRecordVersionError` naming both numbers. `RunStore` is now `commit(runId, record)` /
  `load(runId)`; the store stores, the loop decides the boundary.
- **One identity.** `RunOptions.checkpoint` is renamed `runId` and the durable id is also the
  run's event identity, so `RunResult.runId` is the durable id when one was given (0023).
  `AgentSessionOptions.checkpoint` keeps its session-vocabulary name and reaches the loop as
  `runId`; renaming the session option belongs to 1.7's conversation identity, not here.
- **Terminal statuses.** The loop commits `running` after each non-answering step and one
  terminal write: `completed` on success and `failed` for a thrown run, a cancellation, a budget
  stop and the step cap — the record's closed set has no "cancelled" and `interrupted` is
  reserved for a dead process. The answering step is committed only by the terminal write, so no
  step commits twice. A throw that escapes the loop (a subclass `interpret`) still commits
  `failed`, from `stream()`'s catch.
- **Contract suite.** The ten modes and their rejecting counterexamples are unchanged; only the
  fixture and the helper functions now speak records. Core grew from 460 to 466 tests.
- **Left open.** Two-process use is only testable once the file store lands in 1.5; until then the
  record's `runId` empty on a legacy translation is filled from the store key by the caller.

