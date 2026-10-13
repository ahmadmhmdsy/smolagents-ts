# react — scoped entry

## What this component is

`@smolagents-ts/react` will hold the L2 hooks and the L3 headless primitives
that render a run from `AgentSession`. It is a placeholder at the adoption
revision: the barrel exports a version marker, and React is a peer dependency
that the core never imports.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/react/src/index.ts` | placeholder export only |
| version marker | `packages/react/src/version.ts` | the value the smoke test asserts |

## Smallest validation command

    pnpm vitest run --project react

Expected result: one file with one test, exit code 0 — measured as "Tests 1
passed (1)" at the adoption revision. It says the package resolves, nothing
more.

## Boundaries

This package owns hooks, primitives and their accessibility behaviour. It owns
no run state of its own and no agent logic: the store it subscribes to lives in
the core. The core never imports it, and it never imports the core's internals.

## Hazards

- The package is empty while its smoke test is green, so the test count is not
  evidence of S5 progress.
- React is a peer dependency; a test that renders a primitive needs a React
  version supplied by the workspace, and a second copy of React in the tree
  breaks hooks without a useful error.

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
