# smolagents-ts — scoped entry

## What this component is

`smolagents-ts` is the package a caller installs. It holds no implementation:
each of its five entries re-exports one internal package — the core runtime at
the root, `./models`, `./tools`, `./exec/quickjs` and `./react` — so one
install carries the whole stack and every declaration resolves. It is the
documented entry point; the internal packages are published beside it because its
declarations name them.

## Entry points

| entry point | path | notes |
|---|---|---|
| root | `packages/smolagents-ts/src/index.ts` | re-exports `@smolagents-ts/core` |
| models | `packages/smolagents-ts/src/models/index.ts` | re-exports `@smolagents-ts/models` |
| tools | `packages/smolagents-ts/src/tools/index.ts` | re-exports `@smolagents-ts/tools` |
| executor | `packages/smolagents-ts/src/exec/quickjs.ts` | re-exports `@smolagents-ts/exec-quickjs` |
| react | `packages/smolagents-ts/src/react/index.ts` | re-exports `@smolagents-ts/react` |
| surface test | `packages/smolagents-ts/test/surface.test.ts` | pins the five subpaths |

## Smallest validation command

    pnpm vitest run --project smolagents-ts

Expected result: 1 test file and 2 tests pass, exit code 0. Measured on
2026-10-14 as "Test Files 1 passed (1)" and "Tests 2 passed (2)". The packaging
gates are the other half: `pnpm --filter smolagents-ts exec publint` and
`pnpm --filter smolagents-ts exec attw --pack . --profile esm-only`, both exit 0
on the packed tarball.

## Boundaries

This component owns the exports map, the subpath entries and the published
name. It owns no runtime behaviour and no type of its own: every name belongs to
the package that implements it, and a name added here without a home there is a
defect.

## Hazards

- Three configs resolve the internal packages: the build goes through
  `node_modules`, while the typecheck config's paths and the test project's
  aliases map them to their sources, because the gate typechecks and tests
  before it builds. Editing one of the three alone stops another resolving.
- `react-dom` is an optional peer that nothing imports; the pack smoke installs
  React from the workspace but not `react-dom`, whose `scheduler` dependency
  would need the registry.
- `pnpm pack` rewrites the `workspace:*` ranges to the current version, so a
  tarball packed before the fixed-group bump pins the old version.
- The pack smoke matches tarballs by name, and this package's name is not
  scoped; its tarball needs its own matcher in `scripts/pack-smoke.mjs`.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule:
`rules/components/smolagents-ts.md`.

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
