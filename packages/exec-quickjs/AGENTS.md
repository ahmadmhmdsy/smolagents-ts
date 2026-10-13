# exec-quickjs — scoped entry

## What this component is

`@smolagents-ts/exec-quickjs` is the first real implementation of the
`CodeExecutor` seam: it runs agent-authored JavaScript in a QuickJS-WASM
realm with an explicit capability set. At the adoption revision it is a
placeholder — the barrel exports a version marker, S1 deliberately ships no
engine, and `ScriptedExecutor` in the core is the only executor in use.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/exec-quickjs/src/index.ts` | placeholder export only |
| version marker | `packages/exec-quickjs/src/version.ts` | the value the smoke test asserts |

## Smallest validation command

    pnpm vitest run --project exec-quickjs

Expected result: one test file with one test, exit code 0 — measured at the
adoption revision as "Tests 1 passed (1)". That proves the package resolves and
runs; it proves nothing about an executor, because none exists yet.

## Boundaries

This package owns the QuickJS-backed executor and the engine dependency that
comes with it. It owns no agent loop and no policy about which tools the guest
can reach: the sandbox contract belongs to the `CodeExecutor` interface in the
core.

## Hazards

- A green smoke test on an empty package is not evidence of S4 progress; read
  `packages/exec-quickjs/src/index.ts` before trusting it.
- The engine ships a prebuilt platform binary through the package manager, so a
  dependency change can break a platform that CI does not cover.
- Bridging an async tool call into the guest is the project's known high-risk
  item (design record section 9.3). Nothing here implements it yet.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule:
`rules/components/exec-quickjs.md`.

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
