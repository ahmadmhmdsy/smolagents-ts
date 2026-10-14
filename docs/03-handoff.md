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
each other with `examples/vite-app/test/resolution.test.ts`, because the same
omission had now been made in two of the three. Closed the owner's decision batch:
items 8 and 9 are implemented, and 10, 11, 12 and 13 were already answered by
decisions 0014 and 0010 and by T-20. Item 9's premise was stale — streamed usage
shipped at 10:03 today in `2ac32fe` — and what was still wrong in that path is that
OpenAI sends `"usage": null` on every non-final chunk and the adapter threw on it.

**Verified.** `pnpm gate` exit 0 at the counts above. With all twelve `dist/`
directories moved away, `pnpm typecheck` exits 0; that is CI's own condition, and
it is the check that catches this class. The capability drift is gone from every
source file, and exec-remote reads 11 files and 73 tests, models 13 and 64.

**Unverified / open.** The new guard reads the three configs as text and compares
their coverage; it does not check that an alias points at the right package.
`gemini.ts` has the same null-shape the models fix closed and was left alone.

**Next.** Push, then watch `CI` on the pushed commit, because the local gate
cannot see this defect.

**Blockers.** T-14 needs registry credentials; T-16, T-18, T-21 and T-25 need
decisions; T-19 and T-24 are deferred by the owner and by decision 0016.

**Artifacts.** `examples/vite-app/test/resolution.test.ts`;
`examples/vite-app/tsconfig.json`; `packages/exec-remote/src/sandbox.ts`;
`packages/models/src/openai-compatible.ts`; `docs/memory/general.md`.

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
