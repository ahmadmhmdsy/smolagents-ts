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
<!-- rotate:end -->
