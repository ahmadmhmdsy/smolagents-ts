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
## 2026-10-14T14:05:00+03:00 — the Pyodide executor lands, and the remote executors are planned

**State.** T-13's fourth module is delivered: `@smolagents-ts/exec-pyodide` is the
ninth package, its suite is 9 files and 55 tests, and the full gate exits 0 (95
files, 689 tests, 227 modules and 566 dependencies cruised, publint clean on nine
packages, the site at 65 pages). Task 5's plan is filed; exec-remote is next, then
L4/L5.

**Did.** Built the package: an injectable loader, one runtime per run, a Python
prelude with a `BaseException` answer signal, a JSON tool bridge, the import
allow-list, batched stream capture, and a deadline race that poisons the runtime
when a stop wins. Filed decision 0016 (in-process, fidelity not security) and T-24
(the worker interrupt path). Added the scoped entry, the component rule, the router
row, the attribution row, the browser-probe runbook and the measured results, and
wrote the remote-executor plan on the client reconnaissance.

**Verified.** `pnpm gate` exit 0 on this tree; probe A measured a guest awaiting a
host tool settled by a real timer, so `asyncToolCalls` is true; probe B measured a
2,912 ms browser cold start and a 29,375 B page bundle with the runtime external;
probe C confirmed the pack smoke reaches no registry for `pyodide`; the validator
reports `new: []`, 0 errors and 0 warnings.

**Unverified / open.** No live remote backend was exercised and no injected double
exists yet; the cold start is one headless Chrome against one CDN.
`timers` stays false: nothing on the host can interrupt a synchronous guest loop.

**Next.** Execute `docs/plans/2026-10-14-t13-remote-executors-plan.md`: the process
backend, then Docker, then E2B.

**Blockers.** T-14 awaits registry credentials; T-16, T-18 and T-21 await owner
decisions.

**Artifacts.** `packages/exec-pyodide/src/executor.ts`,
`docs/09-decisions/0016-pyodide-in-process-and-fidelity.md`,
`docs/plans/2026-10-14-t13-remote-executors-plan.md`,
`docs/10-runbooks/exec-pyodide-browser-probe.md`.

## 2026-10-14T12:25:00+03:00 — the MCP client lands, live-checked, and Pyodide is measured

**State.** T-13's third module is delivered: `@smolagents-ts/mcp` builds, typechecks,
lints and cruises clean, its suite is 9 files and 106 tests, and the full gate exits 0
(86 files, 634 tests, 205 modules and 517 dependencies cruised, publint clean on eight
packages). The live check passed against
`@modelcontextprotocol/server-everything@1.0.0`: the root entry refused a stdio
parameter, the client negotiated `2025-11-25`, listed 13 tools and answered the echo
call. Task 4's reconnaissance is filed: Pyodide 314.0.7 installs 13.24 MiB, loads in
about two seconds in Node, has no teardown API, and can be interrupted only from a
worker.

**Did.** Reviewed the delegated package, then fixed what the live check exposed: a
transport error or close now settles everything in flight on its connection and the
connection remembers why, so a spawn that fails reports in milliseconds instead of
leaving the process to exit on an unsettled top-level await. Corrected the runbook:
Windows cannot spawn `npx` (ENOENT) or `npx.cmd` (EINVAL), so it installs the pinned
server and spawns `process.execPath` with its entry. Wrote the reconnaissance, two
memory lessons, the plan's measured results, the T-13 row and this entry.

**Verified.** PASS — `pnpm gate` exit 0 on the tree. PASS — the live check's four lines
and exit 0. PASS — the validator `new: []`, 14 baselined, 0 errors, 0 warnings, and
`rotate.py --check` exit 0.

**Unverified / open.** No browser loaded Pyodide; the reconnaissance names the
unmeasured numbers. The package is unpublished (T-14).

**Next.** Write Task 4's plan for `exec-pyodide` from the reconnaissance, then build it.

**Blockers.** T-14 waits on registry credentials; T-16, T-18 and T-21 on the owner.

**Artifacts.** `packages/mcp/`, `docs/10-runbooks/mcp-live-check.md`,
`docs/research/2026-10-14-pyodide-recon.md`.

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
<!-- rotate:end -->

Rotated entries: `docs/handoff/archive-2026.md`. Rotation moves; it never deletes.