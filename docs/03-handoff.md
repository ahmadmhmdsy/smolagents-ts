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
<!-- rotate:end -->

Rotated entries: `docs/handoff/archive-2026.md`. Rotation moves; it never deletes.
