# Handoff archive -- 2026

Rotated entries, newest first. Rotation moves; it never deletes.

---

## 2026-10-16T12:30:00+03:00 — the post-0.1.0 roadmap is scoped from a competitor scan and recorded, pending owner approval

**State.** Pre-release; the tree is clean after five fixes landed in the previous session. The owner asked what the port lacks against the frameworks a TypeScript team would otherwise choose, then to capture it as plan, tasks, milestones and memory. The scan is recorded; the roadmap is a draft plan, a proposed decision and one live task row. No code was written this session.

**Did.** Scanned the neighbouring agent frameworks (OpenAI Agents SDK JS, Mastra, Vercel AI SDK, LangGraph/LangChain.js, Google ADK) against the shipped surface and wrote the findings, an 18-row gap table, to `docs/research/2026-10-16-agent-framework-landscape.md`. Drafted a phased roadmap (S7 multi-agent → S11 guardrails + structured output) as `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md`; proposed decision 0018 drawing the line between the six production gaps it adopts and the platform gaps that stay out; added T-33 (owner approves) live and indexed 0018. Appended two lessons to memory.

**Verified.** `python scripts/validate_context.py --root .` → 0 errors, 15 warnings, exit 0; `python scripts/rotate.py --check` → exit 0.

**Unverified / open.** The roadmap, the S7–S11 milestones and decision 0018 are unapproved. `docs/01-project.md` is approval-only and was not edited, so its milestone table still ends at S6 and S1.5. The competitor capability claims are the vendors' own framing, not executed here.

**Next.** The owner reads the research and the plan, then approves or amends T-33, which moves decision 0018 to accepted and adds S7–S11 to the spec.

**Blockers.** T-33 is blocked on the owner. T-14 (publish) stays blocked on registry credentials and a public repository.

**Artifacts.** `docs/research/2026-10-16-agent-framework-landscape.md`, `docs/plans/2026-10-16-post-0.1.0-roadmap-plan.md`, `docs/09-decisions/0018-post-0.1.0-scope-boundary.md`, `docs/04-tasks.md` (T-33), `docs/memory/general.md`.

## 2026-10-16T00:35:00+03:00 — the UI is verified live; the CLI's dropped environment was the last defect before a release

**State.** The v1 functional scope is done across eleven packages and unpublished. The owner asked whether the browser app works and what comes next. Verified live it does, scripted and against Gemini. The one defect, the CLI passing no environment to the run, is fixed; everything else waits on the owner.

**Did.** Drove `examples/vite-app` with `agent-browser`: scripted mode finished in two steps, a live Gemini task called both `greet` and `add`, a pure-code task returned 720, console clean. Fixed the CLI: `runSmolagent` defaults its injected `env` to an empty map so its tests stay hermetic, and the bin never passed `process.env`, so no provider key reached an adapter; `main()` now takes `env` and forwards it. Added a lint ignore for the vendored agent-skill bundles.

**Verified.** `pnpm gate` exit 0 — 120 files, 818 tests, 11 packages packed, docs site 71 pages. `pnpm vitest run --project cli` PASS 7 files/52 tests; `--project example-vite-app` PASS 2 files/7 tests. Live with `agent-browser`: scripted PASS; live Gemini `add`→42 and `greet`→"Hello, Ada!" PASS; factorial→720 PASS; console error-free.

**Unverified / open.** The first live turn carried no code block and the loop nudged it ("No action found…"); the retry works. The exec-pyodide real-runtime suite flaked once (5000 ms timeout) and passed on re-run. The chat surface renders a fixed `TRANSCRIPT` (`examples/vite-app/src/App.tsx:19`) and its tools are only `greet`/`add`, so a web-search prompt draws a fabricated answer.

**Next.** Take the owner's Phase-2 decisions (T-16, T-18, T-21, T-25), then run `docs/10-runbooks/publish-0.1.0.md`.

**Blockers.** T-14 needs registry credentials and a public repository; T-16, T-18, T-21 and T-25 need owner decisions.

**Artifacts.** `docs/plans/2026-10-16-release-0.1.0-readiness-plan.md`; `packages/cli/src/main.ts`; `examples/vite-app/src/App.tsx`.

## 2026-10-14T22:05:00+03:00 — the live UI's "Failed" was the dev server answering the wasm with HTML

**State.** The owner reported that the browser app marked every run `Failed`, showed only the
first step, and asked whether the fault was the UI or the agent, how many steps are allowed,
whether the page had ever been tested live, and whether a CLI could replace it.

**Did.** Root-caused it to the example's dev wiring — not the agent, not the React layer. The
QuickJS variant finds its engine with `new URL("emscripten-module.wasm", import.meta.url)`;
Vite's dependency pre-bundle relocated that module into `node_modules/.vite/deps`, so the URL
named a file that does not exist and the dev server answered it with `index.html`. Added
`optimizeDeps.exclude` for the variant to `examples/vite-app/vite.config.ts`, pinned it with a
case in `test/resolution.test.ts`, and documented it in the example README and the memory shard.

**Verified.** Driven with `agent-browser` against the running dev server: scripted mode reads
`Finished`, 2 steps, `greet:ok`; a live Gemini task — "Compute 15 * 4 and log it. Then, in a
second step, answer with twice that value." — reads `Finished`, 2 steps, with both programs and
`final_answer(120)`; the console carries no error. `vite preview` over the built app reads
`Finished`, 2 steps. `pnpm gate` exit 0.

**Unverified / open.** The CLI has no Gemini `--model-type`; `--model-type OpenAIModel
--api-base .../v1beta/openai` is the only route and is unverified. The default budget is 20
steps (`packages/core/src/agent/multi-step-agent.ts:95`) and the page exposes no control for it.

**Next.** Verify the CLI's OpenAI-compatible route against Gemini, then decide whether the CLI
gains a native Gemini type.

**Blockers.** Unchanged: T-14 needs registry credentials; T-16, T-18, T-21 and T-25 need owner
decisions.

**Artifacts.** `examples/vite-app/vite.config.ts`;
`examples/vite-app/test/resolution.test.ts`; `docs/memory/general.md`.

## 2026-10-14T18:52:00+03:00 — the audit finds one real defect, and the pre-publish pass closes it

**State.** The owner asked whether the project works and every feature is done and
tested before publishing. An audit of 107 test files and 771 tests, and a triage
of its 17 design gaps, found one defect blocking a coherent 0.1.0 on the QuickJS
and Node path: `getServerSnapshot` was missing, so React handed
`useSyncExternalStore` the live snapshot and a server render threw. Every other
gap is superseded by a plan or a decision, deferred, or was never a promise.

**Did.** Implemented the server snapshot in core and passed it as the hook's third
argument in react, with a server-render test that fails without it. Wrote the
missing facade README, an examples guide and a root README that doubles as the
site index, and added four runnable examples as vitest projects. Extended the pack
smoke to run a real agent from the tarballs. Made the facade's QuickJS engine
peers optional, as its own plan specifies, and repaired the root vitest projects
glob, which `examples/README.md` had broken.

**Verified.** `pnpm gate` exit 0 at 119 test files and 809 tests, 281 modules and
718 dependencies cruised, eleven packages packed and installed, the run printing
`pack-smoke run OK: Hello, world!`, site at 70 pages. Core is 30 files and 299
tests, react 11 and 48; both new tests fail when the snapshot is returned live.
`pnpm install --frozen-lockfile` exits 0; the validator reports `new: []`.

**Unverified / open.** The remaining audit findings are recorded as T-28 to T-30
rather than fixed: the snapshot cannot feed `ChatSurface`, `agent.on` takes one
argument where the design sketches two, and `code.delta` is never emitted.

**Next.** Commit, push, then watch `CI` on the revision.

**Blockers.** T-14 needs registry credentials; T-16, T-18, T-21 and T-25 need
owner decisions.

**Artifacts.** `packages/core/src/session/agent-session.ts`;
`packages/react/test/server-render.test.tsx`; `packages/smolagents-ts/README.md`;
`vitest.config.ts`.

## 2026-10-14T15:40:00+03:00 — probe C is measured, and the close of T-13 is verified

**State.** T-13's last two gaps are filled and the numbers in the entry below are
superseded. The styled package's suite is now 5 files and 22 tests, because Task
6's probe test landed; the full gate exits 0 at 113 test files and 796 tests, 279
modules and 712 dependencies cruised, eleven packages packed and installed, and
the site at 70 pages, one more than before because this session added a report.

**Did.** Drove the example's production build in headless Edge over the DevTools
Protocol by keyboard alone, and read its accessibility tree. Wrote the report and
pasted the measured results into the plan. Added the probe test that pins the
sheet's shape: five tokens, each reading an input name that is not its own, and
every selector scoped to a class this package owns. Fixed two things the harness's
own scratch directory caused — the linter linted it, and the pack walker crashed
on a browser profile it found there — so `.dsh/` is now ignored by both, on the
precedent `.superpowers/` already set.

**Verified.** `pnpm gate` exit 0 with the counts above; `--project react-ui` 5
files and 22 tests; the validator 0 errors, 0 warnings, 14 baselined, `new: []`.
In the browser both styled wrappers report `role: none` and `ignored: true`, so
they add nothing to the accessibility tree at all; the live cancel button is a tab
stop and the disabled composer is skipped.

**Unverified / open.** No screen reader was run — the accessibility tree is the
browser's own computation. The plan's four open questions are still the owner's.

**Next.** Take the owner's decision batch.

**Blockers.** Unchanged: T-14 needs registry credentials, and T-16, T-18, T-19,
T-21 and T-25 each wait on a decision rather than on work.

**Artifacts.** `docs/reports/2026-10-14-t13-probe-c-keyboard.md`;
`packages/react-ui/test/stylesheet.probe.test.ts`;
`docs/plans/2026-10-14-t13-l4-l5-plan.md`.

## 2026-10-14T15:35:00+03:00 — the gate was green while CI was red

**State.** The gate exits 0 locally at 114 test files and 800 tests — and it was
green locally while CI was red. Both commits this session failed the `CI`
workflow at `pnpm typecheck`: `examples/vite-app` could not resolve
`@smolagents-ts/react-ui`, because the example's compiler `paths` mapped every
workspace package to source except that one, and the workflow typechecks before it
builds. The `context` and `Pages` workflows passed throughout.

**Did.** Added the missing entry, then brought the example's `paths` in line with
its two alias configs: a mapped source file imports its siblings by scoped name, so
`@smolagents-ts/react` was missing as well. Pinned all three resolver configs to
each other with `examples/vite-app/test/resolution.test.ts`. Closed the owner's
decision batch: items 8 and 9 are implemented, and 10 to 13 were already answered
by decisions 0014 and 0010 and by T-20. Item 9's premise was stale — streamed usage
shipped at 10:03 in `2ac32fe` — and the live defect was that OpenAI sends
`"usage": null` on every non-final chunk and the adapter threw on it.

**Verified.** `pnpm gate` exit 0 at the counts above. With all twelve `dist/`
directories moved away, `pnpm typecheck` exits 0; that is CI's own condition, and
it is the check that catches this class.

**Unverified / open.** The new guard reads the three configs as text and compares
their coverage; it does not check that an alias points at the right package.
`gemini.ts` has the same null-shape the models fix closed and was left alone.

**Next.** Push, then watch `CI` on the pushed commit, because the local gate
cannot see this defect.

**Blockers.** T-14 needs registry credentials; T-16, T-18, T-21 and T-25 need
decisions; T-19 and T-24 are deferred.

**Artifacts.** `examples/vite-app/test/resolution.test.ts`;
`examples/vite-app/tsconfig.json`; `packages/exec-remote/src/sandbox.ts`;
`packages/models/src/openai-compatible.ts`; `docs/memory/general.md`.

## 2026-10-14T14:40:00+03:00 — the remote executors land as the tenth package

**State.** T-13's fifth module is delivered: `@smolagents-ts/exec-remote` is the tenth
published package and its suite is 11 files and 57 tests. The full gate exits 0 — 106
test files, 746 tests, 262 modules and 650 dependencies cruised, publint clean on ten
packages, the site at 69 pages. The docs site landed earlier, so T-13 has L4/L5 left.

**Did.** Built the package: a `RemoteSandbox` seam with three backends, a host-owned
frame protocol over the child's stdio for the process path, the Jupyter stdin channel for
Docker, and E2B refusing the round trip by name. Added the scoped entry, the component
rule, the router row, the attribution rows, the changeset and the runbook with its check
script. Fixed a defect the live run exposed: the executor's host-error mapping dropped the
`cause` each backend attaches, so a missing daemon reported only that the sandbox could
not start; it now walks a bounded cause chain, with a test. Filed decision 0017 and T-25.

**Verified.** `pnpm gate` exit 0; the package suite 11 files and 57 tests; the live
process check five ok in 334 ms; the validator `new: []`, 14 baselined, 0 errors. Both
live Docker and E2B paths were attempted and failed, for want of a daemon and a
credential.

**Unverified / open.** Both live paths are unexecuted and the runbook says so; the Docker
round trip is exercised only against a fake kernel; decision 0017 is not yet the owner's;
the gate now needs Python on `PATH`, which no manifest declares.

**Next.** Build L4/L5 per its filed plan, starting with the first three tasks. `react-ui`
is an eleventh package, and the workspace may not grow one until this commit lands.

**Blockers.** None. T-14, T-16, T-18, T-19, T-21 and T-25 stay owner-gated.

**Artifacts.** `docs/plans/2026-10-14-t13-remote-executors-plan.md`,
`docs/10-runbooks/exec-remote-live-backends.md`, `docs/09-decisions/0017-release-age-quarantine.md`.

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

## 2026-10-14T15:00:00+03:00 — L4 and L5 land, and T-13 closes

**State.** T-13's last module is delivered, so every module S6's design row names
is present and the row is `done`. L4 ships inside `@smolagents-ts/react` as the
two patterns that compose the primitives — `RunInspector` and `ChatSurface` —
and L5 as the eleventh package, `@smolagents-ts/react-ui`, a styled layer of
four wrappers over both plus one stylesheet a consumer copies and then owns. The
full gate exits 0: 112 test files and 793 tests, 278 modules and 708 dependencies
cruised, publint clean on eleven packages, pack-smoke installing and importing
eleven packages, the site at 69 pages.

**Did.** Added the two patterns to the react barrel, taking its pinned surface
from ten names to twelve. Built the styled package: one wrapper file per part of
the tree, each rendering a single owned `smol-` element around the component it
composes and authoring no accessibility of its own, plus a 140-line sheet whose
five tokens read distinct input names because a token referring to itself is
invalid rather than a fallback. Registered the component — router row, scoped
entry and rule file, which the pack requires in one change — and corrected the
react entry, which still recorded ten runtime names, an 8-file suite and the
claim that every element carries a class name; that last is true of the
primitives and false of the patterns. The example page now renders the styled
layer, so the copy-in path is exercised in a browser. Closed the exec-remote
review's fifteen findings across two commits. Recorded one lesson: the same
resolver-config omission landed twice, in a package's test tsconfig and in the
example's vitest config.

**Verified.** `pnpm gate` exit 0 with the counts above; `pnpm vitest run
--project react` 10 files and 46 tests; `--project react-ui` 4 files and 19
tests; `--project example-vite-app` 3 tests; the validator 0 errors, 0 warnings,
15 baselined, `new: []`. The copy-in claim was measured in a real browser rather
than jsdom: with no override the token resolves to `#ffffff`, and a consumer
sheet setting `--smol-surface` afterwards wins by source order. The two resolver
gaps were each proven by moving the dependency's `dist/` away and re-running,
which is the check that catches them, because CI tests before it builds.

**Unverified / open.** The keyboard drive of the example in a real browser is
still running as this entry is written. The L4/L5 plan's four open questions are
the owner's: whether the styled layer ships a dark theme, whether the corpus
grows a tool scenario, whether core exposes its step list publicly, and how the
five internal packages are described. No live provider call was made this
session.

**Next.** Take the owner's decision batch: T-14's publish, the T-16 and T-18
investigations, T-19, T-21, T-25, and the four plan questions above.

**Blockers.** T-14 needs registry credentials and stays the owner's. T-16, T-18,
T-19, T-21 and T-25 each wait on an owner decision, not on work.

**Artifacts.** `packages/react-ui/src/index.ts`; `packages/react-ui/src/styles.css`;
`packages/react/src/run-inspector.tsx`; `packages/react/src/chat-surface.tsx`;
`examples/vite-app/src/App.tsx`; `rules/components/react-ui.md`;
`docs/plans/2026-10-14-t13-l4-l5-plan.md`.


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
<!-- rotate:end -->

Rotated entries: `docs/handoff/archive-2026.md`. Rotation moves; it never deletes.

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

## 2026-10-14T00:29:15+03:00 — S3 is complete: the tool ecosystem ships

**State.** `@smolagents-ts/tools` exports `ToolCollection`, `htmlToText`, `userInputTool`,
`duckDuckGoSearchTool` and `visitWebpageTool` beside `VERSION`, and depends on the core
for `Tool` and `ToolContext`. S3 is done; S4 has no plan yet.

**Did.** Executed the seven tasks of `docs/plans/2026-10-14-s3-tool-system-plan.md`, one
commit each: the collection over the core registry, the HTML helper, the three default
tools with fixtures, the barrel with a pinned surface test, and this record. Two changes
the plan did not name: the tools project aliases core to its source in `vitest.config.ts`
and widens `rootDir` in `tsconfig.test.json`, because it now typechecks core's files.

**Verified.** `pnpm gate` exit 0 on the final tree, `ci:check` OK and five packages
installed and imported from tarballs; the tools suite seven files and twenty-eight tests,
`typecheck` and `build` exit 0; the validator reports no new findings with zero errors
and zero warnings; `rotate.py --check` exits 0.

**Unverified / open.** No default tool has run against the live endpoint or a real page:
every fixture is hand-shaped from documentation. Search reads the Instant Answer JSON
rather than scraping results, so it returns a summary and related topics where upstream
returns ranked links — a divergence recorded in the plan and the tool's description. One
older inline entry is over the pack's per-entry cap, so `rotate.py --apply` aborts;
T-10 holds that for the owner.

**Next.** Write and execute the S4 plan: the `CodeExecutor` implementations,
`exec-quickjs`, final-answer bridging and async tool-call bridging.

**Blockers.** None for S4; T-5 stays with the owner.

**Artifacts.** `packages/tools/`, `packages/tools/AGENTS.md`,
`docs/plans/2026-10-14-s3-tool-system-plan.md`, `docs/tasks/archive-2026.md`.

## 2026-10-14T00:09:45+03:00 — S2 is complete: three adapters ship and the model layer closes

**State.** `@smolagents-ts/models` exports five adapters — `OpenAICompatibleModel`,
`AnthropicModel`, `GeminiModel`, `HuggingFaceModel` and `CustomModel` — so all four
tier-1 providers of S2 exist and `docs/01-project.md` marks S2 done. Every adapter
reaches the network through an injected fetch, and neither the tests nor an import
needs a key.

**Did.** Executed the eight tasks of
`docs/plans/2026-10-13-s2b-anthropic-gemini-huggingface-plan.md` in seven commits
(`8424350`..`bda2663`), plus the unused import the gate's lint step found (`99282a2`),
plus this record: the Anthropic Messages adapter with its `system` field,
`tool_use`/`tool_result` blocks and named-event stream; the Gemini
`generateContent` adapter and its `alt=sse` stream; the HuggingFace router as a
subclass of the OpenAI adapter that asks for streamed usage; the barrel with its
pinned surface; and an end-to-end test that drives the Anthropic adapter through a
real `ToolCallingAgent`. T-7 moved to `docs/tasks/archive-2026.md`,
`packages/models/AGENTS.md` now names the adapters and the measured count, and five
lessons went to `docs/memory/general.md`.

**Verified.** `pnpm gate` exit 0 — `.superpowers/gate-s2b.txt`: 44 files and 351
tests, lint, depcruise at 105 modules and 243 dependencies with no violations,
build, publint, attw, `ci:check OK`, and `pack-smoke OK: 5 packages installed and
imported from tarballs`. The models project alone is 13 files and 62 tests. The
validator reports `new: 0` with 0 errors and 0 warnings, and `rotate.py --check`
exits 0.

**Unverified / open.** No live provider call was made for any of the three adapters;
every fixture is hand-shaped from published documentation, so each wire format is
faithful to its document rather than to an endpoint exercised today. Gemini's
JSON-array stream form is deliberately unread and its adapter pins `alt=sse`. The
`supports`/`capabilities` drift in the design record is still an owner decision, and
nothing in this milestone touched `packages/core`.

**Next.** S3 (the tool system), or the release work S2 leaves open — package subpaths
and the changeset merge — whichever the owner picks.

**Blockers.** T-5 waits on the owner:
`docs/09-decisions/0003-pruning-surface-walker.md` is proposed, not accepted.

**Artifacts.** `packages/models/src/anthropic.ts`, `packages/models/src/gemini.ts`,
`packages/models/src/huggingface.ts`, `.changeset/s2b-model-adapters.md`,
`docs/plans/2026-10-13-s2b-anthropic-gemini-huggingface-plan.md`.

## 2026-10-13T20:40:53+03:00 — main is the S2a state; the branch is gone

**State.** The work sits on `main` at `79a4f9c` and `context-pack-adoption` is deleted, so the
next session starts from the default branch with nothing left to integrate.

**Did.** Fast-forwarded `main` from `e4e4b5a` to `79a4f9c` — twelve commits: the pack
adoption, the S2a plan, and the S2a implementation — then removed the merged branch.

**Verified.** `pnpm test` on `main`: 38 files and 319 tests, exit code 0, on the tree the gate
already passed. Working tree clean. T-7 moved to in_progress.

**Unverified / open.** Unchanged from the entry below: no live provider call, the
`supports`/`capabilities` drift still open, T-5 still with the owner, S2b unplanned.

**Next.** Write the S2b plan for the Anthropic, Gemini and HuggingFace adapters (T-7).

**Blockers.** T-5 waits on the owner; `docs/09-decisions/0003-pruning-surface-walker.md` is
proposed, not accepted.

**Artifacts.** `docs/04-tasks.md`, `git log --oneline -1`.

## 2026-10-13T20:54:22+03:00 — the S2b plan is written; execution is the next step

**State.** `main` is at `964c702` plus this entry. S2a is merged and its branch is gone;
S2b is planned but not executed, so `docs/04-tasks.md` still shows T-7 in progress.

**Did.** Wrote `docs/plans/2026-10-13-s2b-anthropic-gemini-huggingface-plan.md`: eight
tasks for the Anthropic, Gemini and HuggingFace adapters, each with its files, steps, a
red/green command and a commit. Also corrected the S2a fixture comment that called a
hand-shaped completion a recording.

**Verified.** The validator reports `new: 0` with no errors and no warnings;
`rotate.py --check` exits 0; the plan carries the `Contract` heading a new `docs/` file
needs.

**Unverified / open.** No adapter from this plan exists yet, and the Anthropic and Gemini
wire facts come from published documentation rather than from a call this project made.

**Next.** Execute the plan task by task, starting with the Anthropic adapter.

**Blockers.** T-5 still waits on the owner.

**Artifacts.** `docs/plans/2026-10-13-s2b-anthropic-gemini-huggingface-plan.md`,
`.superpowers/validate-s2b-plan.json`.

## 2026-10-13T20:09:21+03:00 — S2a landed: the seam is closed and one real adapter ships

**State.** `@smolagents-ts/models` holds a working provider adapter, and the core loop
passes tool schemas while keeping streamed tool calls and usage. A caller can run a
`ToolCallingAgent` against OpenAI or any endpoint that copies its wire format, in Node or in
a browser tab, because the adapter reaches the network through an injected fetch and imports
no Node builtin. Anthropic, Gemini and HuggingFace are unbuilt, so the model layer is partial
by design rather than by omission.

**Did.** Executed the nine tasks of
`docs/plans/2026-10-13-s2a-model-seam-and-openai-compatible-plan.md` in eight code commits
(`511f5e4`..`85f194e`) plus this record. Four core defects closed: the advertised schemas now reach the
request, `toMessages()` renders an assistant tool call with its results, the streaming branch
keeps what it accumulated, and `AgentSession` no longer drops a call reported as failed
first. New files: `packages/models/src/transport.ts`, `sse.ts`, `openai-compatible.ts` and
`custom.ts`; `tsconfig.base.json` gained a path mapping to the core source. T-2 and T-6
moved to the archive and T-7 (S2b) opened.

**Verified.** `pnpm gate` exit 0 — `.superpowers/gate-s2a.txt`: 38 files and 319 tests, lint,
depcruise at 94 modules with the new `core-no-models` rule proven by a probe that was then
deleted, build, publint, attw, and `pack-smoke OK: 5 packages installed and imported from
tarballs`. The plan's pre-registered `workspace:*` risk did not materialize: one
`npm install` resolved the sibling tarball. The context validator, run with the baseline
after these records were written, reports no new findings.

**Unverified / open.** No live provider call was made; every fixture is recorded, so the wire
format is faithful to the documented shape rather than to an endpoint exercised today. The
streaming path and `CustomModel` are covered by tests and by no shipped agent, because both
shipped agents return `prefersStreaming = false`. The design record still sketches the
capability field as `supports` where the shipped interface says `capabilities`; that drift
is an owner decision and this plan deliberately left it alone. S2b has no plan yet.

**Next.** Write the S2b plan for the Anthropic, Gemini and HuggingFace adapters (T-7).

**Blockers.** T-5 waits on the owner: `docs/09-decisions/0003-pruning-surface-walker.md` is
proposed, not accepted.

**Artifacts.** `packages/models/src/openai-compatible.ts`,
`packages/models/test/agent-e2e.test.ts`,
`docs/plans/2026-10-13-s2a-model-seam-and-openai-compatible-plan.md`.

## 2026-10-13T19:41:34+03:00 — the S2a plan is written; execution is the next step

**State.** S2 is in progress and now has a plan it can be executed from. Nothing under
`packages/` has changed since the S0/S1 report, so the library is exactly where it was:
core green, ToolCallingAgent still unusable against a real provider.

**Did.** Wrote `docs/plans/2026-10-13-s2a-model-seam-and-openai-compatible-plan.md` with
nine tasks, and split S2 because four tier-1 adapters are four independent wire formats:
S2a is the seam plus `OpenAICompatibleModel` and `CustomModel`, S2b is Anthropic, Gemini
and HuggingFace. The plan front-loads four measured core defects — the loop never passes
`tools`, the streaming branch returns `toolCalls: []` with `EMPTY_TOKEN_USAGE`,
`toMessages()` drops assistant tool calls, and `AgentSession` drops a call whose failure
arrives first. T-2 moved to in_progress and T-6 (execute the plan) was added.

**Verified.** `python scripts/validate_context.py --root . --baseline docs/.baseline.json
--json` reports `{"new": 0, "baselined": 14, "errors": 0, "warnings": 0}`, and
`rotate.py --check` exits 0. The plan's first run produced four warnings; rewording three
quoted comments and one control line took them to zero. No code was run this session.

**Unverified / open.** Every code change the plan proposes is unexecuted, so all of it is a
proposal rather than a result, and the last green gate remains the close-out at `ba48d0b`.
The plan's pre-registered risk is `pnpm pack` rewriting `workspace:*` to `0.0.0` while
`pack-smoke.mjs` installs all five tarballs at once; Task 5 Step 6 measures that and names
the fallback. No fresh session has answered the five boot questions.

**Next.** Execute Task 1 of the plan, or have the plan reviewed first.

**Blockers.** None. T-5 waits on the owner.

**Artifacts.** `docs/plans/2026-10-13-s2a-model-seam-and-openai-compatible-plan.md`,
`docs/04-tasks.md`, `docs/memory/general.md`.

## 2026-10-13T19:34:09+03:00 — the adoption is closed out; S2 chosen; both pack patches recorded

**State.** The context pack is adopted and accepted, and S2 (model layer) is the
milestone in progress. The library is unchanged from the S0/S1 report: core
green, ToolCallingAgent still unusable against a real provider.

**Did.** Closed the adoption ledger — T-1 done, T-3 answered (S2), T-4 accepted —
and rotated those rows to `docs/tasks/archive-2026.md`; answered both open
questions in `docs/01-project.md` (revision 3); accepted
`docs/09-decisions/0001-pack-walk-excludes-vendored-trees.md`; added
`docs/09-decisions/0003-pruning-surface-walker.md` with `iter_surface()` in
`scripts/_packmodel.py`, now used by `walk()`, `c00_adapt()` and
`Pack.scoped_agents()`; corrected the false runtime claim in 0001 and added its
lesson to `docs/memory/general.md`.

**Verified.** `python scripts/validate_context.py --root . --baseline
docs/.baseline.json --json` reports `{"new": [], "baselined": 14, "errors": 0,
"warnings": 0}`, byte-identical before and after the pruner, in 433 ms against
179,240 ms before it. `pnpm gate` exited 0 on this tree at `e4e4b5a` and no
package source has changed since.

**Unverified / open.** No fresh session has answered the five boot questions from
the repository alone, so readability stays unproven. Bun and Deno are not
installed here, so those runtime legs are CI-only. Both pack patches are local
deviations; T-5 waits on the owner.

**Next.** Write the S2 plan, then execute it from a reviewed brief.

**Blockers.** None. T-2 waits on the S2 plan's tasks, T-5 on the owner.

**Artifacts.** `docs/09-decisions/0003-pruning-surface-walker.md`,
`.superpowers/validate-before-prune.json`, `docs/01-project.md`.

## 2026-10-13T18:47:31+03:00 — context pack adopted; S1 state recorded

**State.** Branch `context-pack-adoption` off `main` at `e4e4b5a`: the context
pack 2.0.0 is installed and its project facts are written. The library is where
the S0/S1 report left it — core green, ToolCallingAgent not yet usable against
a real provider.

**Did.** Installed the pack (57 files copied, 3 skipped, 10 skeletons created),
moved the five component entries to `packages/<id>/AGENTS.md` and rewrote the
router's component table; wrote `docs/01-project.md`, `docs/02-environment.md`,
`docs/06-glossary.md` and `docs/07-sources-of-truth.md` from measured facts; added
one decision record, one runbook, one decision-index row and two lessons; merged
three ignore lines into `.gitignore`; and patched `SKIP_TOP` so the pack's
walker stays out of the gitignored vendored trees.

**Verified.** `pnpm gate` at this tree: exit 0 — typecheck on 5 projects, lint,
depcruise 85 modules / 173 dependencies, 31 test files / 277 tests, build on 5
packages, publint clean on 5, attw, `ci:check`, pack:smoke. Per package: core
273 tests, the other four 1 each. `setup.py markers` reports 0 home markers.
`python scripts/validate_context.py --root .`: 0 errors, 14 warnings, all
inherited from pre-existing documents.

**Unverified / open.** No fresh session has answered the five boot questions from
the repository alone, so documentation readability is unproven. Bun and Deno are
not installed here, so those runtime legs are CI-only. The pack patch is a local
deviation and needs the owner's confirmation (T-4).

**Next.** Re-read this branch in a fresh session, answer the five boot questions
from the repository alone, then record the S2/S4 order.

**Blockers.** None for the adoption. T-3 waits on the owner's milestone choice,
which is also the ground the ToolCallingAgent gaps sit on.

**Artifacts.** `docs/02-environment.md`, `docs/09-decisions/0001-pack-walk-excludes-vendored-trees.md`, `docs/10-runbooks/gate.md`, `.superpowers/gate-output-adoption.txt`.
