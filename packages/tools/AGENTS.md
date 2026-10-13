# tools — scoped entry

## What this component is

`@smolagents-ts/tools` will hold the `tool()` ecosystem and the default tools
that opt into it. At the adoption revision it is a placeholder: a version marker
is exported, no tool is defined, and importing the package adds no capability to
any agent.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/tools/src/index.ts` | placeholder export only |
| version marker | `packages/tools/src/version.ts` | the value the smoke test asserts |

## Smallest validation command

    pnpm vitest run --project tools

Expected result: one file with one test, exit code 0, printed as "Tests 1
passed (1)" at the adoption revision. The suite currently checks resolution
only.

## Boundaries

The package owns the tool factory and the default tools. It owns no agent loop,
no model and no executor. The `Tool` interface it implements is defined in the
core, and the core must not import from here.

## Hazards

- A default tool that touches the network or the filesystem changes what
  generated code can do; both are declared in the schema and the description
  before the tool ships.
- Zod is the runtime contract here, so a schema change is a public API change
  and needs the same care as an exported type.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule: `rules/components/tools.md`.

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
