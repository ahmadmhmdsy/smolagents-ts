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
## 2026-10-14T03:10:32+03:00 — S1.5 is complete: the parity harness compares our loop with upstream

**State.** A differential harness now holds this loop against the release it is derived from.
Five scenarios replay through both sides: the Python leg records upstream 1.14.0 on Python
3.13.7 into committed traces, and `pnpm gate` replays the same corpus through our `CodeAgent`
offline. It measured two real divergences, both owner-gated. S6 is unchanged: T-13 and T-14
still wait on the owner.

**Did.** Executed `docs/plans/2026-10-14-s1.5-parity-harness-plan.md`'s seven tasks: the plan
(`cf2fcf8`); the shared corpus (`f73957b`); the recorder and its five recordings (`9540402`);
the differential suite, plus the corpus corrections its first measurement forced (`2ad7d8f`);
a guard refusing a scenario that declares tools (`c9f21fe`); the re-recording runbook
(`792fbec`); the decision record (`8053e62`); and this record.

**Verified.** PASS — `pnpm gate` exit 0 (`.superpowers/gate-s1.5.txt`): 66 files and 453
tests, depcruise 158 modules and 395 dependencies with no violations, six "All good!" from
publint, `ci:check OK`, `pack-smoke OK: 6 packages`. PASS — the core suite alone: 30 files and
296 tests, exit 0, six of them the parity cases. PASS — the validator reports `new: 0`, 0
errors, 0 warnings; `rotate.py --check` exits 0.

**Unverified / open.** The Python leg is not in CI, so nothing detects upstream drifting
between two recordings; re-recording is a runbook procedure. Our scripted executor returns the
corpus's observation rather than computing it, so executor semantics stay with S4's tests.

**Next.** The owner decides T-16 (planning cadence) and T-18 (max-steps ending); otherwise
choose the first T-13 module.

**Blockers.** T-13, T-14, T-16 and T-18 wait on the owner.

**Artifacts.** `docs/plans/2026-10-14-s1.5-parity-harness-plan.md`,
`docs/10-runbooks/record-parity-traces.md`, `docs/09-decisions/0007-parity-harness-scope.md`,
`packages/core/test/parity.test.ts`.
## 2026-10-14T02:45:00+03:00 — S6 is complete: the six packages are publishable

**State.** The project is installable: six packages at 0.1.0, a `smolagents-ts`
facade that re-exports the five internal ones, tarballs that install and import,
and a runnable Node example. S5 was complete before this session. The CLI, MCP,
the remote executors, `exec-pyodide`, the docs site and L4/L5 are T-13's, and
nothing has been published.

**Did.** Executed `docs/plans/2026-10-14-s6-distribution-plan.md`'s eight tasks:
registry metadata and a licence copier for the five packages (`e04733d`); the
facade under `packages/smolagents-ts/**` (`cba0db4`); its component registration
(`13fa0f6`); the pack smoke over its subpaths (`95e2b4c`); the fixed group and
0.1.0 (`a27bee1`, `3484794`); `examples/node-script` (`191fb1c`); the README's
install and quick-start sections (`78cc03f`); and this record.

**Verified.** PASS — `pnpm gate` exit 0 (`.superpowers/gate-s6.txt`): 65 files and
447 tests, depcruise 157 modules and 388 dependencies with no violations, six
"All good!" from publint, `ci:check OK`, `pack-smoke OK: 6 packages`. PASS — the
context validator against the baseline reports no new finding, 0 errors, 0
warnings. PASS — `pnpm example:node` prints `Hello, world!`.

**Unverified / open.** The publish itself: no registry credentials and no
repository URL, so no manifest names one (T-14). The React example waits on
T-13's host choice (T-12). Rotation refuses an entry over its per-entry cap, so
the two oldest entries moved to `docs/handoff/archive-2026.md` by hand; T-10
tracks the over-cap S2 entry there.

**Next.** Choose the first module in T-13 and write its plan.

**Blockers.** T-13 and T-14 wait on the owner.

**Artifacts.** `docs/plans/2026-10-14-s6-distribution-plan.md`,
`docs/09-decisions/0006-distribution-shape.md`, `packages/smolagents-ts/AGENTS.md`.

## 2026-10-14T02:31:12+03:00 — S5 is complete: the React layer renders a run

**State.** `@smolagents-ts/react` exports four hooks and two compound primitives over
`AgentSession`, and the core's snapshot carries a `planning` lane. S5 is done; the runnable
example its definition also names is T-12, gated on S6's docs site. S6 and S1.5 have no plan.

**Did.** Executed the nine tasks of `docs/plans/2026-10-14-s5-react-layer-plan.md` in ten
commits (`c0d3690`..`cc7daa8`, then this record): the toolchain, `useAgentSession`,
`useAgentRun`, `useAgentEvent`, the core planning lane, `AgentRun` and `AgentStep` with
three leaf primitives, the composition and accessibility tests, and the pinned barrel. Four
findings the plan did not name, and decision 0005's three divergences from design section 10,
are in the plan's Measured results and the memory shard.

**Verified.** `pnpm gate` exit 0 — `.superpowers/gate-s5.txt`: 63 files and 444 tests, lint,
depcruise at 149 modules and 379 dependencies with no violations, build, publint, attw,
`ci:check OK`, `pack-smoke OK: 5 packages`. The react project alone is 8 files and 35 tests,
the core 29 and 290.

**Unverified / open.** No example app, no live model call, and no released artifact: the
package stays private, so its changeset line is inert until S6 picks a version line.

**Next.** Plan S6 (distribution), leaving the publish itself as the owner's gate.

**Blockers.** T-5, T-10 and T-12 stay with the owner.

**Artifacts.** `packages/react/AGENTS.md`, `docs/09-decisions/0005-react-layer-surface.md`.

## 2026-10-14T01:22:29+03:00 — S4 is complete: agent code runs in QuickJS

**State.** `@smolagents-ts/exec-quickjs` exports `QuickJSExecutor`, and `CodeAgent` now
releases its executor when a run ends. S4 is done; S5 (the React layer) has no plan yet.

**Did.** Executed the seven tasks of `docs/plans/2026-10-14-s4-quickjs-executor-plan.md`
in six commits (`e3c1d5d`..`05c24a4`): the guest program, the executor over one synchronous
QuickJS-WASM realm, the end-to-end tests under a real `CodeAgent`, the core release hook,
the barrel with a pinned surface test, and this record. Four findings the plan did not
name, each recorded in its Notes: a failed step's observation now carries the error text;
a platform with no usable WASM binary fails with a typed error, per
`rules/components/exec-quickjs.md`; the prelude declares with `var` and captures a step's
declarations in an epilogue; and a dropped stream iterator releases nothing.

**Verified.** `pnpm gate` exit 0 on the final tree — `.superpowers/gate-s4.txt`. The
exec-quickjs suite is six files and twenty-nine tests, the core suite 28 files and 288
tests; the validator reports `new: 0` with 0 errors and 0 warnings against the baseline,
and `rotate.py --check` exits 0.

**Unverified / open.** No live model call: the loop ran on `MockModel` and the golden
transcript. `capabilities.cpuTimeLimitMs` is deliberately absent, since the only budget is
the caller's `timeoutMs`. A consumer that abandons `agent.stream()` without `return()`
keeps the guest alive until it calls `dispose()` — measured, not assumed.

**Next.** Write and execute the S5 plan: the React layer's hooks and headless primitives.

**Blockers.** T-5 (the pruning-walker decision is still proposed) and T-10 (a past handoff
entry is over the pack's per-entry cap) stay with the owner.

**Artifacts.** `packages/exec-quickjs/src/executor.ts`, `packages/exec-quickjs/AGENTS.md`,
`docs/plans/2026-10-14-s4-quickjs-executor-plan.md`, `.changeset/s4-exec-quickjs.md`.
<!-- rotate:end -->

Rotated entries: `docs/handoff/archive-2026.md`. Rotation moves; it never deletes.
