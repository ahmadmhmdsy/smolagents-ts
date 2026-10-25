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

## 2026-10-25T18:45:00+03:00 — D-02 decided: the whole planning lane, structurally

**State.** Phase 6 stays closed at `d7e1677`; two of the plan's twelve decisions are settled and no code changed.

**Did.** The owner overrode the lead's cadence-only recommendation on the scale argument: planning exists for long runs, and only upstream's summary-mode update input stops the planning call growing with the transcript. Recorded in [`0028`](../09-decisions/0028-planning-is-structurally-upstream-shaped.md): plan at step 0 and every interval, an initial-plan template with task, tools and managed agents, update plans from a system prelude, summary-mode memory and a remaining-steps postlude, the `<end_plan>` stop sequence and the plan wrapper. The three templates are re-authored, so wording parity is not claimed.

**Verified.** The upstream source was read at `E:\python_projects\smolagents` (`agents.py:639-760`, `memory.py:92-206`, `prompts/code_agent.yaml:175-270`), and the port's seams were checked: `streamCompletion` already has a planning kind, `GenerateOptions.stopSequences` exists, and `AgentMemory.toMessages` is the one projection to extend.

**Unverified / open.** Nothing implemented; the lane's tests are the regression net because no parity recording enables planning.

**Next.** D-03 and D-04, the two record-only decisions, then the release gate.

**Blockers.** None.

**Artifacts.** [`2026-10-25-open-decisions-plan.md`](plans/2026-10-25-open-decisions-plan.md), [`0028`](../09-decisions/0028-planning-is-structurally-upstream-shaped.md).

## 2026-10-25T18:30:00+03:00 — D-01 decided: the run ending is a typed error

**State.** Phase 6 stays closed at `d7e1677`; the open-decisions plan is the working agenda and its first row is settled. No code changed.

**Did.** The owner answered D-01 with option A, recorded in [`0027`](../09-decisions/0027-a-run-that-runs-out-of-room-throws.md): `.run()` throws for every non-success ending, `AgentBudgetExceededError` (`AGENT_BUDGET_EXCEEDED`) joins the step error and carries the stop reason, `RunState` loses the unreachable `max_steps_reached`, `.stream()` stays the partial channel, and chapter 14.1 is corrected at implementation. A child budget stop gains its own `budget` stop reason.

**Verified.** The premises were checked against the code before the record: `.run()` has no branch for `run.limitReached`, `RunState` is built only from `success` and `waiting`, and the child mapping only recognises the step error.

**Unverified / open.** Nothing is implemented yet; the record's follow-ups wait for the register to settle.

**Next.** D-02, the planning cadence.

**Blockers.** None.

**Artifacts.** [`2026-10-25-open-decisions-plan.md`](plans/2026-10-25-open-decisions-plan.md), [`0027`](../09-decisions/0027-a-run-that-runs-out-of-room-throws.md).

## 2026-10-25T18:15:00+03:00 — open decisions plan filed; the first decision is under discussion

**State.** Phase 6 is closed at `d7e1677`; tree clean, `main` equals `origin/main`, CI green. The remaining work is collected in one decision plan, no decision is taken yet, and no code changed.

**Did.** Filed `docs/plans/2026-10-25-open-decisions-plan.md`: eleven board rows, the stale pair, twelve decisions with options and a recommendation each, the additions the board lacks, and a live register. Writing it exposed that a budget stop reaches `.run()` through the generic fallback, so a normal ending is reported as a missing terminal event; that folded into D-01.

**Verified.** The plan's claims were checked against `d7e1677` — the loop's endings, the dead `RunState` value, the stale rows' tests. No command was needed for a document.

**Unverified / open.** All twelve decisions. Implementation starts only when the register is settled.

**Next.** Owner decides D-01 (the `.run()` ending contract); then D-02 to D-05 before the release.

**Blockers.** D-05 waits on npm credentials; the rest wait on the owner.

**Artifacts.** [`2026-10-25-open-decisions-plan.md`](plans/2026-10-25-open-decisions-plan.md).

## 2026-10-25T09:50:00+03:00 — Phase 6 closed, and with it the program

**State.** Phases 0–6 are closed. `T-47` and `T-40` are done; nothing is pushed. Publication still waits on `T-14`.

**Did.** `packages/models/test/phase-6-exit.test.ts` proves the three clauses: a shimmed pre-numbering model finishes a run, a cache hint set through agent options reaches the Anthropic body, and the barrel's adapters are exactly the conformance list. The list moved to a shared test module. Report, parent plan, tasks and the execution plan closed in one commit.

**Verified.** Exit file 3 passed; core 61/662, models 16/89, whole repository 171/1317; validator 0 errors and 0 warnings; `pnpm gate` exit 0.

**Unverified / open.** No v2 exists, so the shim's translation path is unproven by construction. 6.2 reopens only when a caller asks under 0018. Retrieval has a decision and no date.

**Next.** `T-14` when the owner supplies credentials; otherwise the pending rows in the task file.

**Blockers.** None.

**Artifacts.** [`2026-10-25-phase-6-report.md`](reports/2026-10-25-phase-6-report.md).
<!-- rotate:end -->
