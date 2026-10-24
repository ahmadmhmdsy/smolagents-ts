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
<!-- rotate:end -->
