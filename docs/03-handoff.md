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
<!-- rotate:end -->
