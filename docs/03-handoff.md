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
<!-- rotate:end -->
