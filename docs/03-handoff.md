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
## 2026-10-25T23:05:00+03:00 — T-48 lands: parity is re-adjudicated, planning is measured

**State.** The pre-release sequence is complete: `T-49`, `T-50`, `T-51`, `T-39` and `T-48` are done. Only `T-14`'s release gate remains; every other live row is post-release work.

**Did.** Re-recorded all six traces against upstream 1.14.0: the five existing traces are identical apart from `meta.recordedAt`, so the endings and planning changes moved no compared field, and no `differsOn` set changed. Added `planning-cadence`, the scenario S1.5 declined: planning at step 0, two actions, one scripted plan. The recorder and the replay now interleave a plan only where both sides' cadence asks for one, and both refuse a plan list the run never reaches. The scenario replays equal, step kinds and model-call roles included. Corrected the runbook's "two divergences ship" note to the one that remains (the max-steps terminal shape), taught it the `plans` field, and cited `0027` in the step-budget expectation.

**Verified.** `pnpm vitest run --project core`: 63 files and 681 tests, exit 0 (parity 7); every recording carries `upstreamVersion` 1.14.0 on Python 3.13.7; the validator and the full gate green.

**Unverified / open.** The plan text is a scripted reply, not a model's plan, so the scenario measures where planning sits and what it sends, never plan quality. The tool-calling family (`T-19`) still owns the schema's `agent` axis.

**Next.** The 0.1.0 release under `T-14`.

**Blockers.** `T-14` on npm credentials and the scope claim; `T-24`, `T-52`, `T-54` on the owner.

**Artifacts.** [`planning-cadence.json`](../scripts/parity/scenarios/planning-cadence.json), [`parity.test.ts`](../packages/core/test/parity.test.ts), [`record-parity-traces.md`](10-runbooks/record-parity-traces.md), [`0027`](09-decisions/0027-the-endings-surface-only-on-the-stream.md).

## 2026-10-25T22:55:00+03:00 — T-39 lands: D-08's phase 0 ships

**State.** `D-08`'s phase 0 is done. `T-48` (parity re-adjudication) is the last live row before the `T-14` release; phase 1 stays parked behind `T-54`'s demand.

**Did.** README gained "Gateways and proxies": the two-line `OpenAICompatibleModel` recipe, the CLI form with `--api-base`, `--model-id` and `--api-key`, the browser CORS and localhost-only rules, and the pin-the-id rule. `docs/10-runbooks/gateway-through-openai-compatible.md` carries discovery through `GET /v1/models`, the model id as the determinism boundary, `AbortSignal` ownership, retry-is-the-caller's, verification and failure modes. `examples/gateway/` drives `generate`, `generateStream` and one `CodeAgent` through the adapter and prints `SKIPPED`, exit 0, without `OMNIROUTE_BASE_URL`. The fixture `openai-compatible-gateway.sse.txt` and four cases pin the keepalive drop, the `choices: []` usage chunk, the synthesized finish and the error-as-data raise without the key.

**Verified.** Models 17 files and 93 tests, example-gateway 3 tests, both exit 0; `pnpm typecheck`, lint, the validator (0/0) and the full gate green.

**Unverified / open.** No live gateway was contacted: the fixture is hand-shaped from the research note at `3.8.53`, the example's tests drive an injected fetch, and the runbook records "never executed" as its verification. An error stream replaces the body it interrupts, so that fourth frame is an inline body in the test rather than a fixture line.

**Next.** `T-48`: re-adjudicate parity against the five scenarios that declare `planningInterval: 0`.

**Blockers.** `T-14` on npm credentials; `T-24`, `T-52`, `T-54` on the owner.

**Artifacts.** [`gateway-through-openai-compatible.md`](10-runbooks/gateway-through-openai-compatible.md), [`openai-compatible-gateway.test.ts`](../packages/models/test/openai-compatible-gateway.test.ts), [`examples/gateway/index.mjs`](../examples/gateway/index.mjs), [`README.md`](../README.md:121).

## 2026-10-25T22:45:00+03:00 — T-51 lands: the snapshot carries the conversation

**State.** `D-06` is code. `T-39` (gateway docs, example, fixture) is the last implementation row before `T-48` and the `T-14` release.

**Did.** `MultiStepAgent` gained a `messages` getter over `AgentMemory.toChatMessages`, and the renderer now walks every task step, not the first, so a checkpointed memory reads as a multi-turn conversation. `AgentSessionSnapshot.messages` is additive and readonly; the session recomputes it from the agent at step boundaries only -- planning and observation completion, message completion, and every terminal transition -- guarded by a frozen event-type set, so a delta never touches it. `ChatSurfaceProps.messages` is optional and defaults to the snapshot; the vite example now renders its own run instead of a fixed `TRANSCRIPT`.

**Verified.** Core 63 files and 680 tests, react 12 and 58, react-ui 5 and 23, all exit 0; `pnpm typecheck`, the example's typecheck and suite, and the validator (0/0) clean. Four cases in the new `agent-session-messages.test.ts` pin the agent-equals-snapshot projection, the getter-read count across deltas, the in-flight step's absence, and a checkpointed second turn; react tests pin the default and the override, react-ui the styled default.

**Unverified / open.** The example's rendered conversation was checked by its typecheck, not by a browser run. The projection keeps its treatment of condensation (hidden steps still render); that is a follow-up for whichever task owns condensation in chat.

**Next.** `T-39`: the gateway phase-0 README subsection, runbook, example and hand-shaped fixture.

**Blockers.** `T-14` on npm credentials; `T-24`, `T-52`, `T-54` on the owner.

**Artifacts.** [`agent-session-messages.test.ts`](../packages/core/test/agent-session-messages.test.ts), [`agent-session.ts`](../packages/core/src/session/agent-session.ts), [`chat-surface.tsx`](../packages/react/src/chat-surface.tsx), [`0031`](09-decisions/0031-the-snapshot-carries-the-conversation.md).

## 2026-10-25T22:35:00+03:00 — T-50 lands: the planning lane is upstream-shaped

**State.** `D-02` is code. `T-51` (projection) and `T-39` (gateway docs) remain before `T-48` and the `T-14` release.

**Did.** The loop now plans before the first action and every interval after it. The first plan is one user turn from `PLANNING_INITIAL_TEMPLATE` carrying the task, the tool prompts and the managed agents; every later plan is a system prelude, the summary-mode history and a user postlude carrying the tools and the remaining steps. Both calls stop at `<end_plan>`, and the stored plan is the reply wrapped as upstream wraps it. `AgentMemory.toMessages` gained `summaryMode`: the system prompt and earlier plans render nothing, an action keeps its tool calls, error and observation and loses the model output, and the task and condensation summaries stay. A planning call carries its own stop sequence and no tool schemas, so `modelOptions` takes a per-turn override. The three templates and their drift test live in `prompts/templates.ts`.

**Verified.** `pnpm vitest run --project core`: 62 files and 676 tests, exit 0; `pnpm typecheck` and `pnpm lint` clean; validator 0 errors, 0 warnings. The new `planning.test.ts` pins the cadence, both input shapes, the wrapper, the stop sequence, the budget turn and the template variables; two summary-mode cases joined `memory.test.ts`.

**Unverified / open.** No recording covers planning — all five parity scenarios declare `planningInterval: 0` — so plan quality and provider-side stop-sequence behaviour are untested. Five test scripts re-ordered; `T-48` owns the parity re-adjudication.

**Next.** `T-51`: the conversation projection into the snapshot.

**Blockers.** `T-14` on npm credentials; `T-24`, `T-52`, `T-54` on the owner.

**Artifacts.** [`planning.test.ts`](../packages/core/test/planning.test.ts), [`templates.ts`](../packages/core/src/prompts/templates.ts), [`0028`](09-decisions/0028-planning-is-structurally-upstream-shaped.md).
<!-- rotate:end -->