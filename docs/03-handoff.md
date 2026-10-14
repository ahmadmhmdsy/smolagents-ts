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
## 2026-10-14T10:45:00+03:00 — the first v1.5 module lands and the browser example runs

**State.** T-13's first module is delivered: `@smolagents-ts/cli`, a seventh workspace
package with a `smolagent` bin, upstream's flags and factories, and no third-party
dependency. T-12 is done: `examples/vite-app` runs the React layer over a real QuickJS
executor in a browser tab, and the engine bundles as a WASM asset, retiring the plan's
fallback. Decision 0012 fixes the host: the example is a Vite SPA and the docs site
publishes its build beside the documents. MCP, `exec-pyodide`, the remote executors and
L4/L5 remain.

**Did.** Wrote decision 0012 and the T-12 plan; built `examples/vite-app` (twelve files,
two tests) and wired it into the workspace; added the README's browser section. Delegated
T-13's CLI to a subagent and reviewed it: twelve modules, six test files and 49 tests in
`packages/cli/`, its scoped entry and component rule, the router row, the pack smoke's
seventh package, and `.changeset/v1-5-cli-package.md`. Closed T-12 and recorded results in
both plans.

**Verified.** PASS — `pnpm vitest run --project example-vite-app`: one file, two tests,
exit 0. PASS — `pnpm --filter example-vite-app run build`: 179 modules, exit 0, the engine
emitted as a 503.13 kB `.wasm` asset. PASS — `pnpm vitest run --project cli`: six files, 49
tests, exit 0. PASS — the validator reports `new: []`, 14 baselined, 0 errors, 0 warnings.

**Unverified / open.** No browser was driven: the example's evidence is a jsdom test and a
production build, not a clicked page. The CLI sits outside the fixed group at 0.0.0, so its
`minor` changeset cuts 0.1.0 alone. Nothing is published.

**Next.** Task 2 of the v1.5 plan: the docs site that renders the documents and publishes
the example's build.

**Blockers.** T-14 waits on registry credentials; T-16, T-18 to T-22 wait on the owner.

**Artifacts.** `docs/09-decisions/0012-web-surface-host.md`,
`docs/plans/2026-10-14-v1.5-modules-plan.md`, `examples/vite-app/`, `packages/cli/`.

## 2026-10-14T03:20:00+03:00 — the v1 roadmap is closed: S3, S4, S5, S6's v1 share and S1.5 are reached

**State.** Every v1 milestone the design record names is reached. S3, S4 and S5 read `done`;
S1.5 reads `done` (entry above); S6 reads `in_progress` because its design row also names the
v1.5 modules — the six packages' publish shape, the facade, the tarball smoke and 0.1.0 are
delivered, and T-13 owns the rest. Nothing is published, and no owner row was closed for the owner.

**Did.** Executed `docs/plans/2026-10-14-s6-distribution-plan.md` (`aa0589a`) task by task:
publish metadata and the licence copy (`e04733d`), the facade (`cba0db4`), its component record
(`13fa0f6`), pack-smoke coverage (`95e2b4c`), the changesets release (`a27bee1`), the runnable
Node example (`191fb1c`), the README sections (`78cc03f`), per-changelog notes (`3484794`), and
the records with decision 0006 (`49bd15d`). Then delegated S1.5 and reviewed it commit by commit.

**Verified.** PASS — `pnpm gate` exit 0 on this revision (`.superpowers/gate-verify.txt`): 66
files and 453 tests, depcruise 158 modules and 395 dependencies with no violations, six publint
"All good!", `ci:check OK`, `pack-smoke OK: 6 packages`. PASS — the validator reports `new: []`,
14 baselined, 0 errors, 0 warnings; `rotate.py --check` exits 0; the tree is clean.

**Unverified / open.** No publish was attempted: T-14 waits on registry credentials and a
repository URL this tree has none of. S1.5's two measured divergences are open owner decisions.

**Next.** The owner answers T-5, T-10, T-12, T-14, T-16 and T-18, or picks the first T-13 module.

**Blockers.** T-5, T-10, T-12, T-13, T-14, T-16 and T-18 wait on the owner.

**Artifacts.** `docs/01-project.md:118`, `docs/plans/2026-10-14-s6-distribution-plan.md`,
`docs/09-decisions/0006-distribution-shape.md`, `packages/smolagents-ts/`.

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
<!-- rotate:end -->

Rotated entries: `docs/handoff/archive-2026.md`. Rotation moves; it never deletes.