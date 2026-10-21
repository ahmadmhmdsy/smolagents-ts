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
## 2026-10-21T16:10:00+03:00 — remediation committed, eleven-stage gate green, stale worktrees gone

**State.** HEAD `5b5fab8` is the review remediation on top of the four merged fix branches; the tree is clean. `pnpm gate` (eleven stages) exits 0: 134 test files / 945 tests, eleven packages built, publint/attw clean, `ci:check` OK, pack smoke green (11 tarballs incl. the `mcp/stdio` and `exec-remote` subpaths), site build green (76 pages). 32 stale worktrees (28 review exports, 4 merged fix worktrees) are removed and pruned; one empty ignored directory is held by a running process. CI has not run on this tree; `main` is not pushed yet.

**Did.** Committed version identity (0.1.0 in eleven packages, `version:check` in gate and CI, changelogs, publish runbook), executor hardening (process env allow-list, `network: "direct"`, write-time log caps, Docker port/memory/pid limits, the rule's Contract paragraph), the CLI bin symlink guard, StrictMode, the docs-site skip link, CI-gated Pages, the self-reading pack smoke, and the docs truth pass.

**Verified.** `pnpm gate` exit 0 at `5b5fab8` (`.superpowers/gate-output.txt`); validator 0 errors, no unbaselined warning; `git worktree list` only main; clean tree.

**Unverified / open.** CI and Pages have not run on the pushed tree. T-14 needs registry credentials. Backend `SandboxRunResult.outputs` stays step-bounded; the dockerode `HostConfig` mapping is type-checked only; the two `checks.py` hardening items are unscheduled.

**Next.** Push `main`, watch CI, confirm Pages deploys only the CI-proved sha.

**Blockers.** T-14 needs registry credentials; T-16, T-18, T-21, T-25 need the owner's decision.

**Artifacts.** `docs/reports/2026-10-21-full-project-review.md` (addendum); `docs/09-decisions/0019-post-0.1.0-roadmap-is-s7-s11.md`; `docs/10-runbooks/gate.md`; commit `5b5fab8`.

## 2026-10-21T15:55:00+03:00 — the review's fixes are merged, and the docs truth pass closes its drift

**State.** The 2026-10-21 review's fixes are merged as four commits (`e2c18fa`, `c5c4f5a`, `3c8d776`, `b323ae6`; HEAD `b323ae6`). This session ran the docs truth pass it asked for. 0.1.0 is unpublished; CI has never run on this tree. The 2026-10-16 entry's "whole post-0.1.0 roadmap" line overstated: S7–S11 was the closed roadmap, and 0018's sixth gap was never scheduled — 0019 records that.

**Did.** `scripts/_packmodel.py` skips `.claude`, so ignored worktree copies stop failing validation. `docs/10-runbooks/gate.md` lists the eleven stages in `package.json` order with eleven-package counts and the newest verified gate. `docs/06-glossary.md` and `docs/07-sources-of-truth.md` are corrected. `docs/09-decisions/0019-post-0.1.0-roadmap-is-s7-s11.md` supersedes 0018's sixth gap. `docs/04-tasks.md` marks T-14, T-16, T-18, T-21, T-25 `blocked`; `docs/08-coordination.md` keeps T-13 `stale` and records this claim; the plans are marked landed. Stale test counts in every scoped entry are re-measured, `docs/memory/general.md` gains a lesson correcting the `network` reading, and `docs/.baseline.json` absorbs the two contract warnings with a 2026-11-20 review date.

**Verified.** `python scripts/validate_context.py --root .` exit 0, 0 errors, 16 baselined warnings; `--baseline` reports none new. `python scripts/selftest.py` pass, 23 tests. Own runs (files / tests): core 37 / 363, cli 8 / 59, react 11 / 51, tools 7 / 32, models 13 / 71; five more come from their owners' runs today.

**Unverified / open.** No full gate at `b323ae6`; other remediation scopes were uncommitted, so the tree is not the merged tree.

**Next.** Run the full gate on the merged tree and record it as the runbook's newest verified gate.

**Blockers.** T-14 needs registry credentials; T-16, T-18, T-21, T-25 need the owner's decision.

**Artifacts.** `docs/reports/2026-10-21-full-project-review.md`; 0019; `docs/10-runbooks/gate.md`.

## 2026-10-16T21:20:00+03:00 — S11 lands: guardrails halt a run, the schema binds the final answer

**State.** Pre-release and clean. S11 (guardrails and structured output) is complete: the milestone reads `done`, its row (T-38) is archived, and no live task row is open. S7 through S11 — the whole post-0.1.0 roadmap — have landed this session; only the standing later candidates remain unscheduled.

**Did.** `AgentOptions` gained `guardrails` (an `input` and an `output` tripwire) and `outputSchema` (a caller-supplied zod schema). The loop runs the input tripwire after `run.started` (before the model is asked), and both output checks in one shared `complete()` choke point serving both completion paths (the code agent's final call and the tool-calling agent's final answer): a tripped wire or a schema mismatch emits `run.failed` with a new `AgentGuardrailError` (code `AGENT_GUARDRAIL`) instead of `run.completed`, and a passing schema reports its validated value as the output.

**Verified.** Core suite 36 files and 340 tests, exit 0. `packages/core/test/guardrail.test.ts` (5 cases) covers an input halt (proving the model was not asked, via an empty script), an input pass, an output halt, a schema reject and a schema accept-and-coerce. `pnpm typecheck`, `lint` and `pnpm gate` exit 0.

**Open.** A tripwire returns a reason string rather than throwing — one function per direction, composed by the caller; no array form. `run()` rebuilds errors from event data, so the failure is an `AgentError` carrying the guardrail name and code, not an `AgentGuardrailError` instance.

**Next.** No scheduled milestone remains. Likely next is a fresh roadmap or the first release (T-14 publish), which waits on the owner's registry credentials.

**Blockers.** None. T-14, T-16, T-18, T-21 and T-25 wait on the owner.

**Artifacts.** `packages/core/src/agent/guardrail.ts`; `packages/core/src/errors.ts`; `packages/core/test/guardrail.test.ts`; `docs/01-project.md`; `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md` (Phase 5).

## 2026-10-16T20:45:00+03:00 — S10 lands: a session continues the agent's memory across turns behind the store seam

**State.** Pre-release and clean. S10 (persistent sessions and memory) is complete: the milestone reads `done`, its row (T-37) is archived, and no live task row is open. S7 through S10 have landed this session.

**Did.** Gave `AgentSession` an `AgentSessionOptions.checkpoint` and made `send(task, { reset })` thread it into `agent.run`: with a checkpoint set, a turn continues the agent's prior memory (`reset:false`, checkpointed by the S8 store seam); with none, each turn is fresh. A new session naming the same checkpoint over the same `RunStore` reads the earlier turns. No new store type — the session reuses `RunStore`, so S10 is one option and one line.

**Verified.** Core suite 35 files and 333 tests, exit 0. `packages/core/test/session-persistence.test.ts` runs one session to a checkpoint, then a fresh agent and session over the same `MemoryRunStore` read the first turn's task; a second case shows no checkpoint starts fresh. `pnpm typecheck`, `lint`, `depcruise` and `pnpm gate` exit 0.

**Unverified / open.** Only the agent's memory persists; the session snapshot (the React step view) is not rehydrated from the store, so a reload shows an empty step list though the model still sees prior turns. A `SessionStore` for the snapshot is deferred.

**Next.** Start S11 (guardrails and structured output): a guardrail seam with input/output tripwires and a schema-bound final answer.

**Blockers.** None. T-14, T-16, T-18, T-21 and T-25 wait on the owner.

**Artifacts.** `packages/core/src/session/agent-session.ts` (`AgentSessionOptions`); `packages/core/test/session-persistence.test.ts`; `docs/01-project.md` (S10 `done`); `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md` (Phase 4).
<!-- rotate:end -->
