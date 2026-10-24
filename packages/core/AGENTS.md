# core — scoped entry

## What this component is

`@smolagents-ts/core` is the published runtime and the only package a caller
needs for a complete agent: the ReAct loop, its memory and steps, the
`AgentEvent` stream, the typed errors, the prompt templates, the tool,
executor and model interfaces, `AgentSession`, middleware and the `Monitor`.
It is isomorphic by contract — the ECMA-262 language plus the ECMA-429 minimum
common web API subset — and imports no Node builtin, no DOM and no React.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/core/src/index.ts` | the runtime names pinned by `packages/core/test/public-surface.test.ts` |
| agent loop | `packages/core/src/agent/multi-step-agent.ts` | the base loop; `code-agent.ts` and `tool-calling-agent.ts` specialise it |
| session store | `packages/core/src/session/agent-session.ts` | the snapshot shape React subscribes to; a session `checkpoint` continues the agent's memory across turns |
| checkpoint store | `packages/core/src/session/run-store.ts` | the `RunStore` seam a run checkpoints to and resumes from |
| approval gate | `packages/core/src/agent/approval.ts` | `withApproval` asks before a tool call runs |
| guardrail seam | `packages/core/src/agent/guardrail.ts` | `AgentOptions.guardrails` tripwires and `AgentOptions.outputSchema` gate the final answer |
| trace exporter | `packages/core/src/monitoring/trace.ts` | folds an `AgentEvent` stream into one OTel-shaped `TraceSpan` tree |
| eval harness | `packages/core/src/monitoring/eval.ts` | `scoreRun` checks a completed run against a transcript's expectations |
| testing doubles | `packages/core/src/testing/` | `MockModel` and `ScriptedExecutor` drive the golden transcripts |

## Smallest validation command

    pnpm vitest run --project core

Expected result: 37 test files and 367 tests pass, exit code 0. Measured on
2026-10-21 as "Test Files 37 passed (37)" and "Tests 363 passed (363)";
Phase 0.1's approval suite replaced two boolean cases with eight named ones,
Phase 0.2's schema binding added three, the snapshot envelope eight, and the
repair budget three and the redaction rule one, so the count moved to 382. The
adoption revision reported 27 and 273; the S2a work reported 28 and 286, and
S4's two release tests took it to 288; S5's planning-lane test added the
twenty-ninth file and its two cases, S1.5's parity suite added the thirtieth file
and its six cases, S7's managed-agent suite added the thirty-first file and its
eight cases, S8's resume and approval suites added the thirty-second and
thirty-third files and their six cases, S9's observability suite added the
thirty-fourth file and its four cases, S10's session-persistence suite added the
thirty-fifth file and its two cases, and S11's guardrail suite added the
thirty-sixth file and its five cases; the core-loop-fixes suite added the
thirty-seventh file and its twenty-one cases, and two typed-error rebuilder cases
followed.

Use `pnpm typecheck` as well when a type changed and no test covers it.

## Boundaries

This component owns the loop and its event contract. It owns no model provider,
no default tool, no JavaScript engine and no React: those belong to `models`,
`tools`, `exec-quickjs` and `react`. The isomorphism rule is not a preference —
`packages/core/test/architecture.test.ts` and
`packages/core/test/architecture-guard.test.ts` enforce it.

## Hazards

- `packages/core/test/golden/fibonacci.transcript.json` is a real but partial
  regression test: a fixture mutation that changes only a thought, the generated
  code or the log text still passes.
- `packages/core/test/architecture-guard.test.ts` writes into the source tree
  and restores it, so do not run the suite while editing `packages/core/src`.
- The public surface is pinned by test, which means an export added without
  updating the pinned list fails the suite instead of slipping through.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule: `rules/components/core.md`.

<!--
Fill rules:
- Cap: this entry stays at or under 6 KB. Detail that pushes it past the cap
  belongs in rules/components/<id>.md or in docs/, not here.
- Ban: carry no root policy. No rule text, no obligation, no precedence level,
  and no restated project fact -- point at the file that owns each. The
  strength keywords are defined and written in capitals only in
  rules/00-index.md; any of them appearing here reads as a restated root
  obligation and fails validation, so this form contains none of them even in
  lowercase.
- Keep the phrase "smallest validation" in the heading above: a scoped entry
  that does not name one fails validation.
- Add this component's row to the component table in the root AGENTS.md, with
  the id, the path scope, this file's path, and rules/components/<id>.md. A
  scoped entry with no row fails validation.
- One id everywhere: the component-table id, the directory name, and the rule
  file name are the same string.
- The component rule file form and its registry requirement are described in
  rules/components/README.md.
-->
