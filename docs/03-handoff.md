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
## 2026-10-25T20:31:00+03:00 — D-08 decided: document the gateway, do not open the package

**State.** Eight of twelve decided; no code changed. The pre-release set stays D-01, D-02 and D-06; D-08 phase 0 is additive and gates nothing, and phase 1 is parked.

**Did.** The owner chose A. The gateway already works at the wire level — 5/5 wire checks and 4/4 stream irregularities absorbed with no source change — so the work is discoverability: a README subsection plus a runbook (recipe, exact CLI form, CORS, localhost-only, pinned model id, `GET /v1/models`, `AbortSignal` timeout, retry is the caller's), a `examples/gateway/` that prints SKIPPED without `OMNIROUTE_BASE_URL`, and a hand-shaped four-frame SSE fixture named by wire shape so LiteLLM and Portkey reuse it. Phase 1 needs its own record: `0019` leaves routing unscheduled, and last-response metadata is unsafe as instance state under concurrent sessions.

**Verified.** The research is offline evidence against a stand-in built from OmniRoute `3.8.53`'s own frames; no live gateway was contacted, so the docs say wire-compatible by construction, never "tested with OmniRoute".

**Unverified / open.** The example and fixture do not exist yet; `--api-base` is silently ignored without `--model-type OpenAIModel` (`T-53`); the site has no user-guide tree (`T-52`, owner).

**Next.** D-09: the Pyodide interrupt (`T-24`).

**Blockers.** None for the decision; `T-14` waits on credentials, `T-52` and `T-54` on the owner.

**Artifacts.** [`04-tasks.md`](04-tasks.md), [the plan](plans/2026-10-25-open-decisions-plan.md), [the research](../docs/research/2026-10-21-omniroute-gateway-support.md).

## 2026-10-25T20:04:00+03:00 — D-07 decided: the corpus grows a tool-calling family

**State.** Seven of twelve decisions settled; no code changed. The pre-release set stays D-01, D-02 and D-06; D-07 is the first post-release row.

**Did.** The owner chose B with two scenarios. Reading the code first corrected the row: a stub tool inside a CodeAgent scenario changes no compared field, because the step only ever records `python_interpreter` and the harness compares no prompt, code or observation text. Decision [`0032`](../09-decisions/0032-the-corpus-grows-a-tool-calling-family.md): the schema gains an `agent` axis defaulting to `code`, tool-calling turns gain `calls`, one shared `echo` stub is defined on both legs, and the family adds a success scenario and an unknown-tool failure scenario. The five existing recordings stay untouched; trace fields do not change; post-release, no public surface, no gate change.

**Verified.** Python 3.13.7 with upstream `1.14.0` is installed here, so the recordings are reproducible offline. Upstream marks an unknown-tool step errored and leaves its call list empty (`agents.py:1466`, `:597-599`); ours records the failed call and continues (`tool-calling-agent.ts:142-148`), so the failure scenario measures a known-possible divergence.

**Unverified / open.** The two traces themselves, whether the success scenario compares equal, and the failure scenario's exact `differsOn`.

**Next.** D-08: OmniRoute intake (`T-39`).

**Blockers.** None for the decision; `T-14` waits on credentials and the scope claim.

**Artifacts.** [`0032`](../09-decisions/0032-the-corpus-grows-a-tool-calling-family.md), [`parity.test.ts`](../packages/core/test/parity.test.ts), [`record.py`](../scripts/parity/record.py), [`04-tasks.md`](04-tasks.md).

## 2026-10-25T19:52:00+03:00 — D-06 decided: the snapshot carries the conversation

**State.** Six of twelve decisions settled; no code changed, nothing published. The pre-release set is D-01, D-02 and D-06, with T-49 to T-51 on the board.

**Did.** The owner chose A+A1, pre-release. Reading the code shrank the question: `AgentMemory.toChatMessages()` already existed, documented as the React shell's chat view and tested, but nothing consumed it. Decision [`0031`](../09-decisions/0031-the-snapshot-carries-the-conversation.md): the snapshot gains `messages`, recomputed at step boundaries only; `MultiStepAgent` gains one accessor delegating to the memory renderer; `ChatSurfaceProps.messages` becomes optional and defaults to the snapshot; the example drops its constant. The conversation is lossy by design (no observations, no plans) and spans turns only for a checkpointed session.

**Verified.** `toChatMessages` is referenced only in `memory.ts`, its tests and the design. The loop adds to memory before the session's boundary events (`multi-step-agent.ts:1419-1420`, `:1249`), so boundary recomputation is not a step behind. `ChatSurface` already reads the snapshot context, and the public-surface pin lists runtime exports only, so no pinned name changes.

**Unverified / open.** The wiring itself: the in-flight step is absent, a delta must not move the list, and a checkpointed session must show earlier turns. D-07 to D-12 are undiscussed.

**Next.** D-07: a tool scenario in the parity corpus (T-19).

**Blockers.** None for the decision; T-14 waits on credentials and the scope claim.

**Artifacts.** [`0031`](../09-decisions/0031-the-snapshot-carries-the-conversation.md), [`memory.ts:167`](../packages/core/src/memory/memory.ts), [`04-tasks.md`](04-tasks.md).

## 2026-10-25T19:31:00+03:00 — D-05 decided: the 0.1.0 gate is stated

**State.** Five of the twelve decisions are settled; no code changed and nothing is published. `T-14` stays blocked on the two external inputs.

**Did.** The owner approved the gate and the sequencing. Decision [`0030`](../09-decisions/0030-the-0-1-0-gate.md): 0.1.0 ships the six-phase program plus `D-01` and `D-02` (and `D-06` if decided pre-release); it publishes only when the two behaviour decisions are implemented, the gate and CI are green on the release revision, the `@smolagents-ts` scope is owned, a publish token with 2FA bypass is in place, and the release note exists. The discussion's four flagged items are now in the runbook: the stale step-3 expectation is corrected against the observed output, `EOTP` and partial-publish recovery are rows in the failure table, step 11 creates the release note from the facade tag, and the scope claim is a checklist step with commands.

**Verified.** Checked today rather than trusted: all eleven manifests read `0.1.0`; no changesets are pending; `npm view` answers `E404` for both names, so both are still unclaimed; `npm whoami` answers `ENEEDAUTH`, so no credential exists here; and the runbook had never been executed.

**Unverified / open.** The publish itself; the token class the owner's account will use; whether `gh` is authenticated on the release machine (the runbook notes the web UI as the fallback).

**Next.** D-06: whether the transcript `ChatSurface` renders is a pre-release row.

**Blockers.** None for the decision; `T-14` waits on credentials and the scope claim.

**Artifacts.** [`0030`](../09-decisions/0030-the-0-1-0-gate.md), [`publish-0.1.0.md`](10-runbooks/publish-0.1.0.md), [`2026-10-25-open-decisions-plan.md`](plans/2026-10-25-open-decisions-plan.md), [`04-tasks.md`](04-tasks.md).
<!-- rotate:end -->
