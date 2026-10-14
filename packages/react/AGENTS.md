# react — scoped entry

## What this component is

`@smolagents-ts/react` renders a run from `AgentSession`. It holds the L2
hooks that read the session's snapshot — `useAgentSession`, `useAgentRun`,
`useAgentEvent`, `useAgentRunSnapshot` — the L3 headless primitives that
render it: `AgentRun` with `Status`, `Steps`, `Cancel` and `FinalAnswer`,
and `AgentStep` with `Action`, `Planning`, `FinalAnswer`, `Code`,
`ToolCalls`, `Logs` and `Observation` — and the L4 patterns that compose the
primitives into a whole view: `RunInspector` for a run and `ChatSurface` for a
transcript with a composer. Nothing is styled: the primitives carry class names
and the stylesheet belongs to the caller. The patterns carry none, so a consumer
that styles one wraps it, which is what the package beside this one does. The
package publishes beside the facade like the other internal ones;
`docs/09-decisions/0006-distribution-shape.md` owns that shape.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/react/src/index.ts` | the twelve runtime names pinned by `packages/react/test/public-surface.test.ts` |
| hooks | `packages/react/src/session.ts`, `use-agent-run.ts`, `use-agent-event.ts` | one hook per file |
| run primitives | `packages/react/src/agent-run.tsx`, `agent-step.tsx` | each renders a class name the caller styles |
| run patterns | `packages/react/src/run-inspector.tsx`, `chat-surface.tsx` | compose the primitives into a whole view; carry no class name |
| composition context | `packages/react/src/context.ts` | internal: only `useAgentRunSnapshot` and the override-map type reach the barrel |
| version marker | `packages/react/src/version.ts` | |

## Smallest validation command

    pnpm vitest run --project react

Expected result: 11 test files and 48 tests pass, exit code 0. Measured on
2026-10-14 as "Test Files 11 passed (11)" and "Tests 48 passed (48)". The
adoption revision reported one file and one test; the surface test is what
remains of that smoke test, the rest is the layer, and the server-render test
added the eleventh file and its two cases.

## Boundaries

This package owns hooks, the primitives and their accessibility behaviour. It
owns no run state and no agent logic: the store is the core's `AgentSession`,
reached through `useSyncExternalStore`. The core never imports it, and it
imports the core's barrel rather than its internals. React alone is the optional
peer; `react-dom` is not a dependency of this package.

## Hazards

- The jsdom environment does not clean up between tests on its own; the cleanup
  runs from the `afterEach` in `packages/react/test/setup.ts`.
- The vitest project aliases `@smolagents-ts/core` to the core's source, while
  the declaration build resolves it through the core's published types, so a
  core type added in the same session needs the core's build before this
  package's `build`.
- `AgentRun` starts its run from an effect keyed on the session and the task,
  and `useAgentRun` builds a session per agent identity, so an agent created
  inline in a render body starts a new session on every render.
- `AgentStep.Code`, `.Logs`, `.Observation` and `.ToolCalls` read the step
  from context and throw outside `AgentStep.Action` or `.FinalAnswer`.
- A tool call renders `aria-live` without a status role, so the run's status
  stays the only status region in the tree.
- The step leaves render the snapshot; the model's streamed text is not rendered
  word by word, and `AgentRun` does not cancel its run when it unmounts.
- A step's logs come only from the executor's `onLog` callback, so a test
  double that never calls it renders an empty logs region.
- The run patterns render no class name and take none, so a consumer styles one
  by wrapping it rather than by targeting it.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule: `rules/components/react.md`.

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
