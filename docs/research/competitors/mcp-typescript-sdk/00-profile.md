# mcp-typescript-sdk — competitor profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Identity

| field | value |
|---|---|
| repository | https://github.com/modelcontextprotocol/typescript-sdk |
| register row | Tier 1, depth D3, slug `mcp-typescript-sdk`; recorded focus is the reference MCP client and server — resources, prompts, sampling, auth; wave 3 |
| licence | the GitHub licence API answers SPDX `NOASSERTION` with name `Other`. The clone's `LICENSE` file states a transition: new code and specifications Apache-2.0, documentation contributions CC-BY-4.0, contributions that have not consented to relicensing still MIT. Every package manifest declares `Apache-2.0` (six at `2.3.1`, `core-internal` at `2.0.4`). No copyleft, so the read is full depth |
| read commit | `c05225a636c679870b65f8ca4fe83a76ea1cf113`, committed 2026-10-21 01:09:57 +0300, subject `fix(server): preserve forwarded params and support modern low-level connections (#3057)` |
| read date | 2026-10-21 |
| clone | `reference/competitors/mcp-typescript-sdk`, shallow (`--depth 1`), worktree clean at the read |
| published version | `2.3.1` in the client, server, core, codemod and server-legacy manifests; `core-internal` is private at `2.0.4`; the workspace root is private at `2.0.0-alpha.0` |
| language and stack | TypeScript, pnpm workspaces at `10.26.1`, Node 20 or later; Vitest; tsc dual ESM and CJS output; ESLint and Prettier; nine published npm packages plus one private |
| size signal | `client` 33 source files and 11,346 lines, `server` 47 and 9,961, `core` 11 and 3,095; 220 test files across the packages; the end-to-end suite has 42 scenario files over a manifest of 480 requirement entries; 36 runnable example projects |
| surrounding material | 50 Markdown pages under `clone:/docs/`, a 17-file conformance harness under `test/conformance/`, and a pinned `@modelcontextprotocol/conformance` dependency |
| documentation source | the pages ship in the clone and are published at https://ts.sdk.modelcontextprotocol.io/v2/ (read 2026-10-21) |
| licence file | `LICENSE` in the clone root, 216 lines: the transition statement followed by the full Apache-2.0 text |
| wire surface | one generated type file per revision under `packages/core-internal/src/types/`, each a verbatim transcription of the specification's schema |
| test posture | unit suites per package, a 480-requirement end-to-end manifest, a pinned external conformance suite, and behaviour-surface pins |

## The published set

| package | role | weight |
|---|---|---|
| `@modelcontextprotocol/client` | the client: transports, verbs, auth, cache, middleware | 11,346 lines |
| `@modelcontextprotocol/server` | the server: `McpServer`, low-level `Server`, both HTTP entries, stdio entry, auth helpers | 9,961 lines |
| `@modelcontextprotocol/core` | the Zod wire schemas, exported for gateways and proxies | 3,095 lines |
| `@modelcontextprotocol/core-internal` | private wire-revision codecs, registries, protocol core; bundled into both sides | not published |
| `node`, `express`, `fastify`, `hono` | thin HTTP adapters over one handler; no MCP behaviour of their own | four packages |
| `@modelcontextprotocol/server-legacy` | frozen copy of v1's SSE transport and authorisation-server helpers | migration only |
| `@modelcontextprotocol/codemod` | rewrites v1 imports and call sites | migration only |

## What it is

The reference TypeScript implementation of the Model Context Protocol, and the package the ecosystem's other TypeScript MCP code is measured against. The `main` branch is v2, released 2026-07-27, and implements the `2026-07-28` specification; the `v1.x` branch keeps the older single-package `@modelcontextprotocol/sdk` alive with bug and security fixes (README, read 2026-10-21).

The axis that shapes everything is the protocol split. One wire era is the `initialize` handshake lineage (`2024-10-07` through `2025-11-25`); the other, `2026-07-28`, removes that handshake, advertises the server with `server/discover`, attaches a per-request `_meta` envelope, replaces server-to-client requests with embedded `input_required` results, and moves change notifications onto client-opened `subscriptions/listen` streams (`clone:/docs/protocol-versions.md:1`, `packages/core/src/constants.ts:1`). Both eras are served by the same client and server classes, and a connect-time negotiation step decides which one a connection speaks.

Everything else follows the shape of a standards SDK: a small protocol core with request, notification and handler plumbing; one class per transport; typed request and result schemas generated from the specification; a high-level registration API on the server and a high-level verb API on the client; and optional OAuth, caching and middleware layers on top. The code is strict by default — capability checks, era checks on both send and receive, and local schema validation of every result.

## Why it is in the register

Our MCP surface is a hand-rolled client: two transports, tools adapted to our tool interface, and a raw `request` escape hatch (`docs/research/competitors/_synthesis/00-our-baseline.md:128`). This repository is the definition of what a full client does with the same protocol, and it is the implementation the specification authors maintain. The register question — what does the reference do that we do not, and which parts belong in a library our size — is answered in `docs/research/competitors/mcp-typescript-sdk/03-gap-and-lessons.md`.

## How it is positioned against us

Not a competitor in the product sense: this ships protocol plumbing and no agent runtime, no model providers, no execution sandbox and no UI. Our overlap is one package, `packages/mcp/`. The useful comparison is therefore per verb and per seam rather than per product: they have every client verb we lack, a negotiation layer we have no analogue for, and an authorisation stack that is larger than our entire MCP package.

## What it is opinionated about

Five positions show up in the code rather than only in prose, and they are the ones worth borrowing or rejecting deliberately.

- **Strict by default.** A method the negotiated era does not define fails locally with a typed code before any bytes are written; an inbound method the era does not define is dropped. Leniency for a broken peer is treated as a bug.
- **One capability gate per verb.** The client refuses `resources/read` unless the server advertised `resources`, and refuses `resources/subscribe` unless `subscribe` is set inside that capability (`packages/client/src/client/client.ts:1422`).
- **Every walk is bounded.** Pagination aggregation has a page cap and a no-progress break; the response cache caps TTL; the multi-round-trip driver caps rounds.
- **Standard Schema at both edges.** Tool input and output schemas accept Zod, Valibot, ArkType or any compatible validator, so the SDK never owns the schema library.
- **Errors are typed and local or coded and remote.** Local failures raise `SdkError` with a string code; protocol failures cross the wire as JSON-RPC codes. The split is enforced by which class is thrown (`packages/core-internal/src/errors/sdkErrors.ts:11`).

## What it deliberately does not do

- No model runtime, provider client or agent loop: sampling asks the host for a completion and nothing more, and it is deprecated.
- No UI, prompt templates or evaluator.
- No MCP server hosting product: the handler is a fetch function, and deployments are left to the framework adapters.
- No authorisation server: the v2 stack verifies bearer tokens and publishes resource metadata; issuing tokens lives in `server-legacy`.
- No client-side durable state: sessions and resumption tokens are transport concerns, and the response cache is memory by default.

## How to read the rest of the dive

- `docs/research/competitors/mcp-typescript-sdk/01-architecture.md` follows one `callTool` round and one server-served request through the layers, and names the seams that make dual-era support possible.
- `docs/research/competitors/mcp-typescript-sdk/02-features-inventory.md` is the verb-by-verb inventory with status, evidence and the reason each capability exists.
- `docs/research/competitors/mcp-typescript-sdk/03-gap-and-lessons.md` prices the differences against our baseline and separates what to copy from what to avoid.
- `docs/research/competitors/mcp-typescript-sdk/04-sources.md` records the commit, the licence finding, the files read and the refresh procedure.

## Limits of this read

- Documentation claims are labelled `declared` in `docs/research/competitors/mcp-typescript-sdk/02-features-inventory.md`; only claims traced into source are `implemented`.
- No install, build, test or execution: the clone was read as text, so runtime behaviour and conformance results are unverified.
- The server side is surveyed at the level of entry points, postures and registration API, not traced handler by handler.
- The OAuth module was read for interfaces and orchestration seams; its RFC-specific validation functions were not traced line by line.
- The `2026-07-28` support migration page (746 lines) and the provider-specific examples were not read in full.
- Behaviour of published tarballs and the `v1.x` branch is outside this read.
- Error-message wording and log text were read where they explain a mechanism, not catalogued.