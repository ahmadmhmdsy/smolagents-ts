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
| checkpoint store | `packages/core/src/session/run-store.ts` | the `RunStore` seam a run checkpoints to and resumes from; `file-run-store.ts` beside it is `FileRunStore` over an injected `RunFileSystem`; both answer `latestForConversation` |
| approval gate | `packages/core/src/agent/approval.ts` | `withApproval` asks before a tool call runs |
| guardrail seam | `packages/core/src/agent/guardrail.ts` | `AgentOptions.guardrails` tripwires and `AgentOptions.outputSchema` gate the final answer |
| trace exporter | `packages/core/src/monitoring/trace.ts` | folds an `AgentEvent` stream into one OTel-shaped `TraceSpan` tree |
| eval harness | `packages/core/src/monitoring/eval.ts` | `scoreRun` checks a completed run against a transcript's expectations |
| testing doubles | `packages/core/src/testing/` | `MockModel` and `ScriptedExecutor` drive the golden transcripts |

## Smallest validation command

    pnpm vitest run --project core

Expected result: 62 test files and 676 tests pass, exit code 0. Phase 0's approval, schema, snapshot, budget and
deadline suites moved the count to 386; the store contract added the thirty-eighth file and its
sixty cases (446); the budget suite added the thirty-ninth and seven cases (458); the run record
and resume suites added the fortieth and its cases (479); the ownership fence moved it to 496;
the effects journal added the forty-first and the redacted-journal pass (503); the file store the
forty-second (509); the conversation lookup a thirteenth contract mode and two cases (517); the
fork suite the forty-third and two cases (519); Phase 2.1's child-report suite the
forty-fourth file and its seven cases (527); Phase 2.3's path suite the forty-fifth and five
cases (532); Phase 2.6's message suite the forty-sixth and ten cases (542); Phase 2.7's wait
suite the forty-seventh and eleven cases (553, six of them the contract's new watch mode); and
Phase 2.2's transfer suite the forty-eighth and five cases (562, four of them new pins);
Phase 2.4's background-child suite the forty-ninth and five cases (571, four of them new pins);
Phase 2.8's claim-board suite the fiftieth and five cases (585, nine of them new pins);
Phase 2's close added the fifty-first, the six-case exit criterion (591); Phase 3.1's
condensation suite the fifty-second and six cases (598, the step class a new pin); and
Phase 3.2's event-log suite the fifty-third and four cases (603, `readEvents` a new pin); and
Phase 3's close added the fifty-fourth, the two-case exit criterion (605); and Phase 4.4's
tool-policy suite the fifty-fifth and fifteen cases (620, `ToolPolicyDeniedError` a new pin); and
Phase 4.5's generator-and-hosted suite the fifty-sixth and nine cases (631, `ToolHostedError` a
new pin); Phase 5.1's exporter suite the fifty-seventh and five (639, three pins); Phase 5.2's pricing
suite the fifty-eighth, seven (652, six); Phase 5's close the fifty-ninth, three (655); Phase 6.1 (660); Phase 6.3 (662); 0027 (669); 0028 (676).

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
