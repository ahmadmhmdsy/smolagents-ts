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

## 2026-10-25T19:12:00+03:00 — D-04 decided: the parity corpus stays on the 1.14.0 release

**State.** Four of the twelve decisions are settled; no code changed. `T-21` is closed.

**Did.** The owner chose to keep the corpus on the observed release instead of re-recording it against the design's dev commit. Decision [`0029`](../09-decisions/0029-the-parity-corpus-stays-on-the-release.md): the design's pin names what the design read (`main` at `96f33fa`, `v1.27.0.dev0`, 2026-10-06), each recording names what the corpus observed (`1.14.0` on Python 3.13.7), neither is a support range. [`docs/01-project.md`](01-project.md) now states that split and that no upstream API-compatibility range is claimed; the recording runbook gained the re-record rule — a deliberate comparison with a purpose, moving the suite constant, the runbook and the recordings in one change.

**Verified.** Every recording already stamps `meta.upstreamVersion`, the suite asserts it against `PINNED_UPSTREAM_VERSION` (`parity.test.ts:28`, `:244`), and the runbook pins the install command, so the corpus cannot silently compare across releases.

**Unverified / open.** Re-recording against `1.27.0.dev0` was not attempted: it needs a git-commit install and the recorder's imports are unproven there. That is a future comparison, not a correction.

**Next.** D-05: the 0.1.0 gate.

**Blockers.** None.

**Artifacts.** [`2026-10-25-open-decisions-plan.md`](plans/2026-10-25-open-decisions-plan.md), [`0029`](../09-decisions/0029-the-parity-corpus-stays-on-the-release.md), [`01-project.md`](01-project.md), [`record-parity-traces.md`](10-runbooks/record-parity-traces.md).

## 2026-10-25T18:56:00+03:00 — D-03 decided: the supply-chain posture is confirmed

**State.** Three of the twelve decisions are settled; no code changed. `T-25` is closed.

**Did.** The owner confirmed decision [`0017`](../09-decisions/0017-release-age-quarantine.md) unchanged: the release-age quarantine and the three exact-version e2b exclusions stay. The confirmation adds two things the record lacked: the exemptions apply to this development tree only and ship with no package, and every exclusion is temporary — delete it at the next vendor-peer bump unless a frozen-lockfile install still needs it. Both are written in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) where the list is maintained.

**Verified.** The settings are unchanged since 0017 and CI installs with `--frozen-lockfile` (`ci.yml:30`, `ci.yml:66`), so neither the list nor the resolution can drift in CI. The one open weakness — a local install may append a fourth entry to the tracked list — is recorded for the D-12 hardening batch.

**Unverified / open.** Nothing implemented; the exclusion-list guard is deferred.

**Next.** D-04: which upstream the parity recordings track.

**Blockers.** None.

**Artifacts.** [`2026-10-25-open-decisions-plan.md`](plans/2026-10-25-open-decisions-plan.md), [`pnpm-workspace.yaml`](../pnpm-workspace.yaml), [`04-tasks.md`](04-tasks.md).
<!-- rotate:end -->
