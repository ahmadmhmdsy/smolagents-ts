# models-gateway — scoped entry

## What this component is

`@smolagents-ts/models-gateway` reaches a model through an OpenAI-compatible AI
gateway such as OmniRoute and reports what the gateway's response headers say
about each request (decision 0040). `GatewayModel` composes the shipped
`OpenAICompatibleModel` and reads the headers through its injected `fetch`, so
neither the core nor the models package changes. `listGatewayModels` reads the
gateway's `GET /models`.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/models-gateway/src/index.ts` | everything below, plus `VERSION` |
| gateway model | `packages/models-gateway/src/gateway-model.ts` | `GatewayModel`, its options and the `onResponse` context |
| header reader | `packages/models-gateway/src/headers.ts` | `GatewayResponse`, `readGatewayHeaders`, the default prefix |
| model list | `packages/models-gateway/src/list-models.ts` | `listGatewayModels` and its error |
| version marker | `packages/models-gateway/src/version.ts` | the value the pack smoke imports |

## Smallest validation command

    pnpm vitest run --project models-gateway

Expected result: four files, exit code 0. The suite needs no network, no key and
no gateway: every response is hand-shaped from the research notes and served by
an injected fetch. Run `pnpm --filter @smolagents-ts/models-gateway run typecheck`
beside it.

## Boundaries

The package owns the header reader, the gateway model and the model list. It
owns no wire format: the request and the body parsing are the models package's
`OpenAICompatibleModel`. It owns no routing, retry or budget. The root entry
reaches no Node builtin, and the architecture test enforces it.

## Hazards

- Each call builds its own `OpenAICompatibleModel` around its own fetch. That is
  what keeps two concurrent calls from seeing each other's headers; a shared
  adapter with a shared slot would reintroduce the defect decision 0040 names.
- The parsed fields follow OmniRoute's header names as the research read them at
  gateway `3.8.53`. A rename there shows up as a field going missing, not as an
  error.
- `toolCalls` defaults to false. A `ToolCallingAgent` on an unpinned id sends no
  tool schemas.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule: `rules/components/models-gateway.md`.
