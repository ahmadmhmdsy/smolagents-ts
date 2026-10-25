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
## 2026-10-25T22:35:00+03:00 — T-50 lands: the planning lane is upstream-shaped

**State.** `D-02` is code. `T-51` (projection) and `T-39` (gateway docs) remain before `T-48` and the `T-14` release.

**Did.** The loop now plans before the first action and every interval after it. The first plan is one user turn from `PLANNING_INITIAL_TEMPLATE` carrying the task, the tool prompts and the managed agents; every later plan is a system prelude, the summary-mode history and a user postlude carrying the tools and the remaining steps. Both calls stop at `<end_plan>`, and the stored plan is the reply wrapped as upstream wraps it. `AgentMemory.toMessages` gained `summaryMode`: the system prompt and earlier plans render nothing, an action keeps its tool calls, error and observation and loses the model output, and the task and condensation summaries stay. A planning call carries its own stop sequence and no tool schemas, so `modelOptions` takes a per-turn override. The three templates and their drift test live in `prompts/templates.ts`.

**Verified.** `pnpm vitest run --project core`: 62 files and 676 tests, exit 0; `pnpm typecheck` and `pnpm lint` clean; validator 0 errors, 0 warnings. The new `planning.test.ts` pins the cadence, both input shapes, the wrapper, the stop sequence, the budget turn and the template variables; two summary-mode cases joined `memory.test.ts`.

**Unverified / open.** No recording covers planning — all five parity scenarios declare `planningInterval: 0` — so plan quality and provider-side stop-sequence behaviour are untested. Five test scripts re-ordered; `T-48` owns the parity re-adjudication.

**Next.** `T-51`: the conversation projection into the snapshot.

**Blockers.** `T-14` on npm credentials; `T-24`, `T-52`, `T-54` on the owner.

**Artifacts.** [`planning.test.ts`](../packages/core/test/planning.test.ts), [`templates.ts`](../packages/core/src/prompts/templates.ts), [`0028`](09-decisions/0028-planning-is-structurally-upstream-shaped.md).

## 2026-10-25T22:20:00+03:00 — T-49 lands: both ceilings throw

**State.** `D-01` is code. The pre-release set is `T-50`, `T-51` and `T-39`; `T-48` re-adjudicates parity after the first two. Nothing is published.

**Did.** `0027`'s ending contract is in. `AGENT_BUDGET_EXCEEDED` and `AgentBudgetExceededError` join the typed errors and carry the `LimitStopReason` in `info.reason`, with no usage snapshot; `.run()` gains the missing `run.limitReached` branch, so a budget stop throws instead of hitting the "ended without a terminal event" guard; `RunState` loses the dead `max_steps_reached`; a child stopped by its budget reports `stopReason: "budget"`; `AgentSession` maps the new code back to `limit_reached`. Design 6.5, 6.6 and 14.1 now say a ceiling throws, and the 14.1 row drops the `max_steps_error` result claim. The background-child result helper lost the branch that built a `max_steps` report from a state the type cannot hold.

**Verified.** `pnpm typecheck` and `pnpm lint` clean; `pnpm vitest run --project core` is 61 files and 669 tests, exit 0 (six new cases over four files); validator 0 errors, 0 warnings; the pinned export list is 122.

**Unverified / open.** `AgentSession`'s code-to-status mapping has no case of its own, so the `limit_reached` path is proven by the terminal-event test, not by a session test. `D-01`'s two sub-defaults were never put to the owner: the error carries the reason only, and the child reason is spelled `"budget"`.

**Next.** `T-50`: `D-02`'s planning lane per `0028`.

**Blockers.** `T-14` on npm credentials; `T-24`, `T-52`, `T-54` on the owner.

**Artifacts.** [`errors.ts`](../packages/core/src/errors.ts), [`run-result.ts`](../packages/core/src/agent/run-result.ts), [`0027`](09-decisions/0027-a-run-that-runs-out-of-room-throws.md), [`04-tasks.md`](04-tasks.md).

## 2026-10-25T22:05:00+03:00 — D-12 decided: the register closes with a residual-risk batch

**State.** All twelve decided; no code changed. `T-57` is the batch row, and the fork test inside it may land before 0.1.0.

**Did.** The owner confirmed the batch shape. Seven phase-report notes plus D-03's exclusion-list guard become one checklist row; the fork at an in-doubt intent gets its test before the release, because the combination is legal today, reachable, and no test has seen it. Two items moved to `T-56` when D-11 made version 2 real: the v1→v2 shim test and the Anthropic streamed-split fixture. The resumed-cost sentence goes in the README budget section until `T-52` decides where guides live; the claim-board fence and the child-store rule are documented rather than enforced; and the re-baseline is the next session's first item. The six not-on-the-board additions are accepted with destinations, including a v2 deprecation policy that `T-56` now owes.

**Verified.** Nothing was built; the rotation and validator are at zero. The register has twelve rows and all are closed.

**Unverified / open.** Sixteen validator findings stay baselined with a review date of 2026-11-20, and the re-baseline is the only thing that will look at them; the live Docker and E2B check waits on an account rather than a decision.

**Next.** The pre-release set: `T-49` (endings), `T-50` (planning) and `T-51` (projection), then `T-39`; `T-48` re-adjudicates parity after the first two, and `T-14` publishes under the `0030` gate.

**Blockers.** `T-14` on credentials; `T-24`, `T-52`, `T-54` on the owner.

**Artifacts.** [the plan](plans/2026-10-25-open-decisions-plan.md), [`04-tasks.md`](04-tasks.md), [the register](plans/2026-10-25-open-decisions-plan.md).

## 2026-10-25T21:40:00+03:00 — D-11 reopened: multimodal input is in, input-only, ahead of retrieval

**State.** Eleven of twelve decided; no code changed. The owner asked for models that see and hear, so `0018`'s park is lifted for input only; `0034` fixes the scope and `T-56` is the phase row.

**Did.** The owner approved the proposed shape: two input modalities, no output modalities, bytes never URLs, references never base64, both tool slices in one phase. [`0034`](09-decisions/0034-multimodal-input-is-in-and-scheduled.md) records it: an input message may carry text, image or audio parts while every model output stays a string; the adapter contract moves to version 2 with the existing shim keeping version-1 adapters working; capabilities gain an honest audio flag; a tool may attach media by reference so the executors keep exchanging strings; snapshots carry references behind a `MediaStore` seam shaped like `RunStore`. The phase runs after 0.1.0 as 0.2.0's headline, before retrieval; D-10's "first" claim and the order section are corrected, and `01-project.md` points at the new record.

**Verified.** Nothing was built; the rotation and validator pass, and the pre-release set is untouched.

**Unverified / open.** Token accounting for image turns is provider-reported with no local estimate; audio is absent on Anthropic; prompt injection inside an image is invisible to the guardrails; this is the largest surface since Phase 6 — core types, three adapters, the projection, `react-ui` and tool results.

**Next.** D-12: the residual-risk chores, to close the register.

**Blockers.** `T-14` on credentials; `T-24`, `T-52`, `T-54` on the owner.

**Artifacts.** [`0034`](09-decisions/0034-multimodal-input-is-in-and-scheduled.md), [the plan](plans/2026-10-25-open-decisions-plan.md), [`04-tasks.md`](04-tasks.md).
<!-- rotate:end -->
