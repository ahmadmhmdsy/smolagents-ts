# vercel/ai — profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Identity

| field | value |
|---|---|
| repository | https://github.com/vercel/ai (GitHub slug `vercel/ai`, npm scope `@ai-sdk`) |
| slug | `vercel-ai-sdk` |
| read commit | `e741656ed17aad861d3a0bc3f571e5301fe1eb9d` |
| commit subject and date | `fix(docs): correct fx image input support (#23777)`, 2026-10-21 |
| date read | 2026-10-21 |
| clone | `reference/competitors/vercel-ai-sdk/`, shallow `--depth 1`, so exactly one commit and no history |
| licence | root `LICENSE` is a 552-byte Apache-2.0 notice, not the full template; GitHub reports `NOASSERTION`; the clone's own `AGENTS.md:11` states Apache-2.0. Treated as permissive, read at depth D3 |
| workspace | pnpm 12 workspaces (`pnpm-workspace.yaml:1`), Turborepo task graph (`turbo.json:4`), Node 22 engine floor (`package.json:59`) |
| packages | 83 directories under `packages/`, 82 published as `@ai-sdk/*` |
| core versions | `ai` 7.0.148 (`packages/ai/package.json:3`), `@ai-sdk/provider` 4.0.31 (`packages/provider/package.json:3`) |
| code volume | 605 source files under `packages/ai/src`; 3,809 TypeScript files under all `packages/*`; 1,049 `*.test.ts`; 129 `*.test-d.ts` |
| docs volume | 546 `.md`/`.mdx` files under `content/`, 25 example app directories, 13 CI workflows |
| what was read | `packages/ai`, `packages/provider`, `packages/gateway`, the `architecture/` notes, package manifests, CI config |

## What the project is

The Vercel AI SDK is a TypeScript monorepo publishing a provider-neutral model layer plus one package per vendor.
`ai` is the application-facing package: text generation, streaming, objects, embeddings, images, speech, transcription, reranking and video, each through one uniform function shape.
Vendor integrations are separate packages that implement the interfaces of `@ai-sdk/provider`, a spec package whose only runtime dependency is `json-schema` (`packages/provider/package.json:34`).

Its centre of gravity is a protocol, not a framework: the specification defines the request options, the stream part vocabulary and the result shapes that every provider must satisfy, and the core only ever calls that vocabulary.
That protocol is versioned. The checked-out tree implements `LanguageModelV4` (`packages/provider/src/language-model/v4/language-model-v4.ts:8`) while still admitting V2 and V3 providers through in-core adapters (`packages/ai/src/model/as-language-model-v4.ts:1`).

A second centre of gravity is the browser-facing stream. `streamText` converts model output into a typed UI chunk protocol with its own SSE framing, keep-alive comments and a client-side reducer, so a chat UI is a consumer of a documented wire format rather than a consumer of provider streams.

## Why it is in the register

The Lead assigned this repository against five capabilities on our roadmap:

- model abstraction and the provider registry;
- tool calling while streaming, including approval;
- structured output;
- the UI message stream protocol;
- middleware, and how a provider-neutral core is kept. That list is the reading order this dive followed.

It is the closest large neighbour to the problem our `packages/models` and `packages/core` split is trying to solve, and the one that has taken the versioned-contract route furthest.

## How it is positioned against us

| axis | this repository | our baseline row |
|---|---|---|
| action model | model writes text or tool calls; no program-writing loop, no executor abstraction | `RT-01`, `RT-02` vs `EX-01` to `EX-04` |
| model layer | versioned provider spec, one adapter per vendor, registry over ids | `MD-01`, `MD-02`, `MD-05` |
| provider routing | an AI Gateway provider is the default target for a bare model id | `MD-05`, `MD-08` |
| tool approval | approval is modelled in the spec and in the UI protocol, with signed round-trips | `HL-01`, `HL-02` |
| structured output | provider JSON response format, with a separate Output spec for text functions | `GR-02`, `GR-05`, `GR-06` |
| run durability | none in the core; persistence is a callback the caller implements | `HL-03`, `HL-04`, `HL-09` |
| event and UI surface | typed internal stream parts, then a typed UI chunk protocol over SSE | `RT-09`, `UI-05`, `UI-06` |
| guardrails | none in core; approval and tool choice are the closest mechanisms | `GR-01`, `GR-03`, `GR-04` |
| evaluation | none in core | `OB-04`, `OB-05` |

## Limits of this read

- The clone is shallow, so history, blame and release archaeology are unavailable; commit count cannot be observed (`git rev-list --count HEAD` returns 1).
- 82 `@ai-sdk/*` packages exist and no vendor adapter source was read line by line; claims about individual providers are absent rather than inferred.
- The AI Gateway is a hosted service. Request construction is readable (`packages/gateway/src/gateway-provider.ts:76`), routing, billing and auth behaviour are not observable from source.
- No dependency install, build, test or example run was performed; every dynamic statement here rests on reading code, not on observing traffic.
- `content/**` documentation was not read, so no claim relies on documented intent where source disagreed.
- Sandbox, harness, TUI and devtools packages were seen only as directory names and manifests.
- The `NOASSERTION` licence result is a GitHub classification artefact, recorded rather than resolved away.

## Where the detail lives

- structure, layers and one run's data flow: `docs/research/competitors/vercel-ai-sdk/01-architecture.md`;
- capability rows with evidence: `docs/research/competitors/vercel-ai-sdk/02-features-inventory.md`;
- gaps, buckets and copyable patterns: `docs/research/competitors/vercel-ai-sdk/03-gap-and-lessons.md`;
- commit, commands and refresh steps: `docs/research/competitors/vercel-ai-sdk/04-sources.md`.
