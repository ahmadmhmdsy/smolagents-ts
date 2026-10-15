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
<!-- rotate:end -->
