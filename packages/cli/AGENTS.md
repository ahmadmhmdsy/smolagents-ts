# cli — scoped entry

## What this component is

`@smolagents-ts/cli` is the Node command line over the agent loop. It ports the
argument surface and the interactive setup of upstream `cli.py`, maps upstream's
model and tool names onto this port's adapters, and renders the core's `AgentEvent`
stream at three verbosity levels. The bin is named `smolagent`; the importable
surface is the same parser, factories, renderer and run function the bin uses.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/cli/src/index.ts` | the parser, the factories, the renderer and `runSmolagent` |
| bin | `packages/cli/src/main.ts` | carries the shebang; exit codes 0, 1, 2, 3 and 130 |
| arguments | `packages/cli/src/args.ts` | the hand-rolled parser, `USAGE`, the defaults and the seven durability flags |
| model factory | `packages/cli/src/model-factory.ts` | upstream names onto `HuggingFaceModel` and `OpenAICompatibleModel` |
| tool factory | `packages/cli/src/tool-factory.ts` | the two defaults, and the refusals by name |
| renderer | `packages/cli/src/renderer.ts` | `renderEvent`, `display` and `supportsColor` |
| interactive setup | `packages/cli/src/interactive.ts` | the questions and their defaults |
| terminal | `packages/cli/src/terminal.ts` | the readline prompter and the writer |
| run function | `packages/cli/src/run.ts` | builds the agent, wires the file store and resume, drains the stream, answers an exit code |
| errors | `packages/cli/src/errors.ts` | one class per refusal, each carrying its exit code |
| store binding | `packages/cli/src/store.ts` | `nodeRunFileSystem` and the default state directory, the Node half of the core's file store |
| version marker | `packages/cli/src/version.ts` | the value the pack smoke imports |

## Smallest validation command

    pnpm vitest run --project cli

Expected result: eleven files with seventy-six tests, exit code 0. Measured on
2026-10-21 as "Test Files 8 passed (8)" and "Tests 59 passed (59)"; the extra
case covers recognising a symlinked entry point as the main module, the durability
surface added the tenth file and its seven cases (four parser, three in-process
park-and-resume), the conversation lookup added two cases (parser and in-process), the fork
flags added two more (parser and in-process), and the Phase 1 exit criterion added the
eleventh file and its two cases, moving the count to 76. The end-to-end case drives the real
`CodeAgent` with the core's `MockModel` and `ScriptedExecutor`, so the suite needs no
provider and no key. Run
`pnpm --filter @smolagents-ts/cli run typecheck` beside it: the runner erases
types, so only the compiler checks the factory's option shapes.

## Boundaries

The package owns the command line: its parser, its questions, its factories and its
renderer. It owns no agent loop, no model adapter, no tool and no executor. The loop,
the events and the testing doubles come from the core; the adapters come from the
models package; the two defaults come from the tools package.
`@smolagents-ts/exec-quickjs` is an optional peer, loaded only when a code run has
no injected executor.

## Hazards

- A key reaches an adapter through `--api-key` or, when that flag is absent, the
  provider's documented environment variable. Nothing here prints a key, and the
  interactive setup asks for no secret, because a terminal echoes what is typed.
- Upstream's `LiteLLMModel` and `TransformersModel` have no adapter in this port.
  The model factory refuses each by name; folding either onto an adapter that exists
  would send a caller's request somewhere they did not choose.
- The interactive menu still offers `OpenAIServerModel`, which upstream's own loader
  does not handle, and it still discards the action-type answer. Both behaviours are
  ported from `cli.py` and recorded in the plan's measured results.
- The parser is hand-rolled because `--imports` and `--tools` take a space-separated
  list, which `node:util`'s `parseArgs` does not model.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule: `rules/components/cli.md`.

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
