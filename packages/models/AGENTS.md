# models — scoped entry

## What this component is

`@smolagents-ts/models` holds provider adapters behind the core's `Model`
interface: one wire protocol per adapter, the mapping into `ChatMessage`, and the
streaming form of a completion. It ships `OpenAICompatibleModel`, which speaks to
every endpoint that copies OpenAI's chat-completions format, `AnthropicModel` and
`GeminiModel`, which each map a block-shaped wire of their own, `HuggingFaceModel`,
which is the OpenAI adapter pointed at the Inference Providers router, and
`CustomModel`, which turns two functions into a model.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/models/src/index.ts` | `VERSION` and the five adapters |
| OpenAI-compatible adapter | `packages/models/src/openai-compatible.ts` | one request per turn, streaming and not |
| Anthropic adapter | `packages/models/src/anthropic.ts` | the Messages API: a `system` field, `tool_use` and `tool_result` blocks, named stream events |
| Gemini adapter | `packages/models/src/gemini.ts` | `generateContent`, and `streamGenerateContent` pinned to `alt=sse` |
| HuggingFace adapter | `packages/models/src/huggingface.ts` | the router: the OpenAI mapping, a different host |
| custom model | `packages/models/src/custom.ts` | a model defined by functions |
| HTTP transport | `packages/models/src/transport.ts` | the injected fetch, `joinUrl`, `postJson`, `HttpError` |
| SSE reader | `packages/models/src/sse.ts` | incremental event-stream parsing |
| recorded fixtures | `packages/models/test/fixtures/` | one per provider and per form, named with the provider's prefix |
| version marker | `packages/models/src/version.ts` | the value the smoke test asserts |

## Smallest validation command

    pnpm vitest run --project models

Expected result: 13 test files and 74 tests pass, exit code 0. It is a resolution
and wire-format check: every test drives an injected fetch against a recorded
fixture, so no test reaches a live provider.

## Boundaries

The package owns adapters and their wire formats. It owns no retry or budget
policy, no agent loop and no credential store. The core owns the interface it
implements, and the core must never import from here.

## Hazards

- Every test drives an injected fetch against a recorded fixture, so the suite
  needs no key; an adapter added without one would be the first to need a live
  call.
- A provider format change is invisible until an adapter pins a fixture; treat
  the first adapter as the one that created that habit, and re-record when a
  provider moves.
- A fixture is hand-shaped from the provider's published documentation and never
  a live capture, and the test that reads it says so; a comment claiming a
  recording is a provenance claim that nothing in the repository can support.
- A streamed request asks the provider for usage (`stream_options.include_usage`),
  because a provider that is not asked reports no tokens on a streamed response and
  the run cannot be priced; a host that rejects the field needs an option rather
  than a silent drop.
- The test tsconfig widens `rootDir`, because the base tsconfig maps
  `@smolagents-ts/core` to its source and core's files then join this project's
  program.

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
