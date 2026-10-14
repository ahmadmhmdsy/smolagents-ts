# Handoff archive -- 2026

Rotated entries, newest first. Rotation moves; it never deletes.

---

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
