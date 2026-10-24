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
<!-- rotate:end -->
