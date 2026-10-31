# tools — scoped entry

## What this component is

`@smolagents-ts/tools` holds the default tools and the group a caller assembles them
into. `ToolCollection` names a set of tools and converts to the core's `ToolRegistry` at
the agent boundary; `htmlToText`, `userInputTool`, `duckDuckGoSearchTool` and
`visitWebpageTool` ship beside it. Every tool is built with the core's `tool()` and
carries a Zod input schema.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/tools/src/index.ts` | the six names the surface test pins |
| tool group | `packages/tools/src/collection.ts` | `ToolCollection`; a duplicate name is a `ToolDefinitionError` |
| html helper | `packages/tools/src/html.ts` | `htmlToText`; text, not Markdown |
| user input | `packages/tools/src/defaults/user-input.ts` | `userInputTool({ ask })` |
| web search | `packages/tools/src/defaults/duckduckgo-search.ts` | `duckDuckGoSearchTool`; DuckDuckGo's Instant Answer JSON |
| visit page | `packages/tools/src/defaults/visit-webpage.ts` | `visitWebpageTool`; `maxChars` defaults to 20000 |
| version marker | `packages/tools/src/version.ts` | the value the smoke test asserts |
| fixtures | `packages/tools/test/fixtures/` | hand-shaped from published documentation, never a capture |

## Smallest validation command

    pnpm vitest run --project tools

Expected result: seven files with fifty-four tests, exit code 0. Run
`pnpm --filter @smolagents-ts/tools run typecheck` beside it: the runner erases types, so
only the compiler checks the mapping from a schema to the input its execute receives.

## Boundaries

The package owns the tool factories, the group and the default tools. It owns no agent
loop, no model and no executor. The `Tool` interface and `ToolContext` it implements are
defined in the core, and the core does not import from here.

## Hazards

- A default tool that touches the network changes what generated code can do; the schema
  and the description both name it before the tool ships.
- A default tool that needs something from its environment takes it as a parameter —
  `userInputTool`'s `ask`, and `fetch` on the network tools — because this package runs
  in a browser as well as in Node and has no host of its own.
- Zod is the runtime contract here, so a schema change is a public API change and needs
  the same care as an exported type.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule: `rules/components/tools.md`.
