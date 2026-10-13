# smolagents-ts — S0 and S1 completion report

**Date:** 2026-10-13 · **Repository:** `E:\python_projects\smolagents_ts` (branch `main`)

## Outcome

The S0 foundation (8 tasks) and the S1 core runtime (19 tasks) are implemented, each with an independent
implementer and an independent reviewer, ending in a green full gate.

| item | value |
|---|---|
| commits from the initial commit `51adb5b` | 67 |
| TypeScript source files / lines under `packages/` | 76 / 5496 |
| packages | `@smolagents-ts/core`, `models`, `exec-quickjs`, `react`, `tools` |
| measured source HEAD | `28eed02` (doc-comment repair, comments only) |
| whole-branch review verified at | `5b0499b` (the S1 public surface) |
| task reviews | 5 PASS for S1 Tasks 15-19, plus S0/S1 Tasks 1-14 reviewed earlier |
| working tree | clean |

## What was built

- **Core runtime:** `CodeAgent` (a ReAct loop whose code execution goes through a pluggable `CodeExecutor`
  seam), `ToolCallingAgent`, `AgentSession` (a `useSyncExternalStore`-shaped run store for React, with no React
  dependency), a thin `Model` seam with `MockModel`, Zod-first tools plus a registry, memory/steps, an
  `AsyncIterable<AgentEvent>` stream with `agent.on()`, middleware, a `Monitor`, an async queue, a typed error
  hierarchy, the prompt templates and the public barrel.
- **Targets:** ECMA-262 + ECMA-429, isomorphic. Nothing in `core/src` imports `node:`, Buffer, process, DOM or
  React — and that boundary is enforced by tests that really fail when the boundary is crossed.
- **S1 deliberately ships no QuickJS:** the `CodeExecutor` seam is implemented only by `ScriptedExecutor`.

## Verification

The chained `pnpm gate` passed at `5b0499b`, and every stage passed individually in the whole-branch
reviewer's own worktree at that same commit:

| stage | result |
|---|---|
| `typecheck` | 0 — 5 projects |
| `lint` | 0 — no diagnostics |
| `depcruise` | 0 — no violations (85 modules, 173 dependencies) |
| `test` | 0 — 31 files / 277 tests |
| `build` | 0 — 5 packages |
| `publint` | 0 — all good |
| `attw` | 0 — only the two policy-ignored resolutions |
| `ci:check` | 0 |
| `pack:smoke` | 0 — 5 packed tarballs installed and imported |

Beyond the gate:

- **Public surface:** the built `dist` exposes exactly 50 runtime names (`public-surface.test.ts`, 60 tests). The
  `.d.ts` carries 112 names = 50 values + 62 type-only, with no runtime name missing from the declarations.
- **Boundary reality:** `architecture-guard.test.ts` flags a real `node:` import inside `core/src` and passes
  again once it is removed, so isolation is enforced rather than asserted.
- **Consumer reality:** the packed tarball installs, imports, and runs a `CodeAgent` end to end
  (`output=20`, `state=success`), with the session snapshot showing the tool call.
- **Regression value of the golden transcript:** of 8 fixture mutations, 5 fail (event set/order, output, state,
  actionSteps, finalAnswer) and 3 still pass (thought, generated code, log text) — so it is a real regression
  test that does not pin everything it appears to.

## The honest headline: the ToolCallingAgent path is not usable against a real provider yet

Two MAJORs, both **inherited from the briefs and the plan rather than implementer errors** — every task met its
own brief:

1. **The loop never advertises tool schemas.** `multi-step-agent.ts:364/380` pass only `{signal}` to
   `generate`/`generateStream`; `GenerateOptions.tools` is populated nowhere, and `ToolRegistry.toSpecs()`
   has no caller outside its own unit test. Upstream `agents.py` does pass the callable tools. Consequently only
   `MockModel` can produce tool calls today.
2. **The session store records no tool calls on that path.** A real `ToolCallingAgent` run leaves
   `snapshot.steps[*].toolCalls` empty while the agent's own memory records both the unknown-tool error and the
   final-answer result, because `action.failed`/`action.result` without a preceding `action.requested` are
   dropped and `toolcalls.requested` is ignored.

Together with `toMessages` dropping the assistant's tool calls and emitting no `role:"tool"` result, and with
the tool-calling prompt template being a 14-line simplification of upstream's 243-line file (0 worked examples
against 6 in the CodeAgent template), the CodeAgent path is coherent end to end while the **ToolCallingAgent path
is not**. This needs an explicit decision about a follow-up milestone; it is not a blocker for S1 as scoped, but
it should not be discovered later by a consumer.

## Other carried findings (all non-blocking, all recorded with evidence)

- **Session/store:** the shared `EMPTY_TOKEN_USAGE` singleton is exposed unfrozen through the snapshot;
  `publish()` does not isolate a throwing listener, so one bad subscriber can break `reset()` and later
  subscribers; the external `AbortSignal` listener is never removed; unhandled `code.delta`/`planning` events
  still change snapshot identity.
- **Prompts and types:** `BuildCodeAgentSystemPromptOptions` is exported from source but not re-exported by the
  barrel, so the public builder's options type cannot be named by a consumer; `extractThought` has no consumer
  in `src` and leaks a literal `Code:` label; union constituents can still render as `(unknown, ...)`; the
  nested-`additionalProperties` gap is documented only in a code comment.
- **Tool-calling details:** `step.error` is never set on a per-tool failure; the shared empty-action observation
  tells a tool-calling agent to reply with a code block, contradicting its own rule.
- **Packaging/process:** the changeset is format-correct but currently inert, because `core` is `private: true`
  and `.changeset/config.json` has no `privatePackages` entry; `CodeExecutor.dispose()` is declared and
  documented but called nowhere and implemented by no S1 executor (decision D14 promised release at run end — a
  real gap deferred to S4).
- **Design-spec drift:** `supports` versus `capabilities` and the snapshot shape remain unresolved against the
  design document.

## What could not be verified

- **The upstream pin.** The plan pins `96f33faa`; the only clone on this machine is shallow at `30bb116`, so
  every fidelity claim is against `30bb116`, not the pin.
- **The deno and Bun legs, and every GitHub Actions run.** `ci:check` declares node 22/24/26 and runtime
  node/bun/deno; deno is not installed here and no Action has ever been observed running.
- **Real provider behaviour.** No adapter exists in S1 (S2/S3), so streaming, tool-call wire formats and provider
  errors are unexercised; the streaming branch is off by default and has no committed coverage.
- **`dispose()`, frequent-value stream ordering, and non-Node runtimes.**
- Semantic "documented as public" for the 62 type-only names (presence was checked; prose coverage was not).

## Process record (kept honest)

- **Nine brief-internal defects** were found across the plan (Tasks 10-18): four numeric or expectation
  contradictions, plus incomplete or un-compilable code blocks. Each was resolved by the rule that the tests are
  authoritative, with the test kept byte-for-byte, both measured values reported, and any test edit explicitly
  authorized by the controller.
- **Four controller errors were caught and corrected**, three of them by the agents rather than by me: a false
  claim that commit `e0f373a` was not green (it is), a regex that wrongly reported an import in a brief, a wrong
  warning that the 50 runtime export names were partly type-only, and a wrong "four ported examples" claim in the
  whole-branch dispatch prompt. A separate commit, `28eed02`, repairs two doc comments that an earlier
  controller commit had spliced mid-sentence.
- **Goal state:** the tracked goal is `blocked` with its 40-round budget exhausted even though this objective is
  met; a direct user turn is required to mark it complete or to open a follow-up round for the tool-calling gaps.

## Evidence index

- `.superpowers/sdd/progress.md` — the full task-by-task ledger
- `.superpowers/sdd/s1-task-{1..19}-report.md` and `s1-task-{11..19}-review.md` — task reports and reviews
- `.superpowers/sdd/whole-branch-review.md` — the whole-branch verdict and every carried item
- `.superpowers/sdd/gate-r-final.log`, `gate-r-final2.log` — gate output
- `.superpowers/sdd/final-gate-checklist.md`, `whole-branch-review-brief.md` — checklists and carry-forward list
- `docs/plans/2026-10-12-s1-core-runtime-plan.md` — the reviewed S1 plan
