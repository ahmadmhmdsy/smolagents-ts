# models — scoped entry

## What this component is

`@smolagents-ts/models` is where provider adapters will live behind the core's
`Model` interface: one wire protocol per adapter, the mapping into
`ChatMessage`, and the streaming form of a completion. The package is a
placeholder today — it exports a version marker, no adapter exists, and no run
can reach a provider.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/models/src/index.ts` | placeholder export only |
| version marker | `packages/models/src/version.ts` | the value the smoke test asserts |

## Smallest validation command

    pnpm vitest run --project models

Expected result: one file with one test, exit code 0 — the adoption run printed
"Tests 1 passed (1)". It is a resolution check, not a provider check.

## Boundaries

The package owns adapters and their wire formats. It owns no retry or budget
policy, no agent loop and no credential store. The core owns the interface it
implements, and the core must never import from here.

## Hazards

- Nothing here talks to a network yet, so any adapter added later needs a
  recorded fixture before a live call, or the suite starts needing a key.
- A provider format change is invisible until an adapter pins a fixture; treat
  the first adapter as the one that creates that habit.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule: `rules/components/models.md`.

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
