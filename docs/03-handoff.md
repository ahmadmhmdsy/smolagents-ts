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
## 2026-10-14T11:45:00+03:00 — the docs site is live, and T-20 retires the parity cast

**State.** The pushed revision is green everywhere, and the site answers at
https://ahmadmhmdsy.github.io/smolagents-ts/ : the numbered documents render with a sidebar,
decision 0014 has its own page, and the browser example is served under `example/` with its
assets. T-20 is done: `MultiStepAgent.steps` is public, so the parity suite reads the loop's
typed steps with no cast, and the failed-run case is covered.

**Did.** Committed the alias fix (`3ac484e`), the docs site with the records (`699e3b7`) and
the dropped test tsconfig (`11d774d`); the entry above called the deployment unverified, and
the fetch below supersedes that line. Then exposed `steps` on the loop, replaced the parity
test's cast, added the failed-run assertion, closed T-20, and wrote the deployment lesson.

**Verified.** PASS — `pnpm gate` exit 0 on a tree with every `dist/` deleted, and `pnpm test`
alone exits 0 there, which is what the two CI-only failures were about. PASS — the CI, Pages
and context workflows are all `success` on `11d774d`. PASS — the site root, the decision page
and the example each answer 200. PASS — the core suite is 30 files and 297 tests, exit 0.

**Unverified / open.** No browser drove the deployed example: a 200 and a relative asset path
are not a rendered page. Nothing is published to npm.

**Next.** Task 3 of the v1.5 plan: write the MCP client's plan, then build it.

**Blockers.** T-14 waits on registry credentials; T-16, T-18 and T-21 wait on the owner.

**Artifacts.** `packages/core/src/agent/multi-step-agent.ts`, `apps/docs-site/`,
`docs/plans/2026-10-14-s1.5-parity-harness-plan.md`.

## 2026-10-14T11:35:00+03:00 — the docs site lands, and two CI-only defects are fixed

**State.** T-13's second module is delivered: `apps/docs-site` renders `README.md` and
every `docs/**/*.md` into `apps/docs-site/site/`, copies the browser example's build
beside them, published by `.github/workflows/pages.yml`. T-22 is closed: decision
0014 keeps the five internal packages implementation, and each gained a signpost README.
CI was red on two defects no local run could see, and both are fixed. MCP, `exec-pyodide`, the remote executors and L4/L5 remain.

**Did.** Delegated Task 2 to a subagent and reviewed it: ten modules, four test files and
22 tests, the Pages workflow, the router row, `rules/components/docs-site.md`, the
`site:build` stage, and the ESLint ignore the built tree needed. Fixed the two CI
failures: the facade's test project and both examples' configs never aliased the internal
sources, so the test stage resolved a `dist/` a fresh checkout lacks; and
`pnpm -r --filter ./packages/*` died on bash, which expands the glob before pnpm sees it.
Wrote decision 0014 and the five READMEs, closed T-22, filed T-23, and added two lessons.

**Verified.** PASS — a clean-tree run with every `dist/` deleted: `pnpm test` and the
full `pnpm gate` exit 0. PASS — the alias is load-bearing: a config pointing it at a
missing path fails to resolve, and the real one passes. PASS — the validator reports
`new: []`, 14 baselined, 0 errors, 0 warnings; `rotate.py --check` exits 0.

**Unverified / open.** The Pages deployment has not run: the site's evidence is its own
suite and a built tree, not a fetched page. No frozen-lockfile install was made, and
nothing is published.

**Next.** Task 3 of the v1.5 plan: write the MCP client package's plan, then build it.

**Blockers.** T-14 waits on registry credentials; T-16, T-18 and T-21 wait on the owner.

**Artifacts.** `apps/docs-site/`, `docs/09-decisions/0014-internal-packages-stay-implementation.md`,
`docs/plans/2026-10-14-v1.5-modules-plan.md`.

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
<!-- rotate:end -->

Rotated entries: `docs/handoff/archive-2026.md`. Rotation moves; it never deletes.