# langchainjs — competitor profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Identity

| field | value |
|---|---|
| repository | https://github.com/langchain-ai/langchainjs |
| register row | Tier 2, depth D2, slug `langchainjs`; the register calls it the breadth reference for tools, retrievers, vector stores and agent executors (`docs/research/competitors/README.md:66`) |
| licence | MIT, as declared at `libs/langchain/package.json:6` and `libs/langchain-classic/package.json:6`; `gh api repos/langchain-ai/langchainjs --jq '.license.spdx_id'` returned `MIT` on 2026-10-21 |
| read commit | `6c79aa96b4f288c808fa17fb4491bffc7deb472b`, committed 2026-10-21 17:04:50 +0100, subject `chore(deps): bump @modelcontextprotocol/client from 2.2.0 to 2.3.0 (#11999)` |
| clone | `git clone --depth 1 https://github.com/langchain-ai/langchainjs reference/competitors/langchainjs`; shallow and clean at the read |
| stack | pnpm workspaces plus Turborepo, TypeScript ESM, Node `>=20`, zod `^3.25.76 \|\| ^4`; the v1 agent runtime is built on `@langchain/langgraph` `^1.4.18` and `@langchain/langgraph-checkpoint` `^1.1.5` (`libs/langchain/package.json:77-80`) |
| packages | `langchain` 1.5.18, `@langchain/core`, `@langchain/classic` 1.0.54, `@langchain/textsplitters`, `langchain-mcp-adapters`, `create-langchain-integration`, 32 first-party provider packages under `libs/providers` |
| size signal | 359 TypeScript files under `libs/langchain-core/src`, 159 under `libs/langchain/src`, 32 provider packages, one package of standard integration tests |

## What it is

LangChain.js is a framework of interoperable interfaces, not a runtime: `Runnable` for
anything invokable and streamable, messages and tool calls, chat model adapters,
embeddings, vector stores, retrievers, callback managers and prompt and parser
utilities. The v1 release adds one product on top of those interfaces: `createAgent`, a
ReAct agent with a middleware extension system. Its breadth comes from integrations:
model providers, vector stores and toolkits mostly live outside this repository, in the
companion `langchain-community` and partner packages.

The current agent is a class named `ReactAgent` that owns a compiled LangGraph state
graph (`libs/langchain/src/agents/ReactAgent.ts:164`, `:181`) and delegates `invoke` and
`stream` to it. The loop itself, its checkpointer and its stream modes belong to
`@langchain/langgraph`, a separate repository and a direct dependency; this repository
supplies the nodes, the middleware system and the type layer around it.

## Current versus legacy

This is the distinction a reader must not miss. In v1 the `langchain` package was
reduced to the essential building blocks and the agent, and the v0.x surface moved to a
separate package, `@langchain/classic`: "functionality from LangChain v0.x that has been
moved out of the main `langchain` package as part of the v1.0 release"
(`libs/langchain-classic/README.md:3`). The classic package still ships `AgentExecutor`
(`libs/langchain-classic/src/agents/executor.ts:352`), `initializeAgentExecutor`
(`libs/langchain-classic/src/agents/index.ts:44-47`), the legacy chains, memory,
indexing and community re-exports, at version 1.0.54, described in its manifest as "Old
abstractions from LangChain.js" (`libs/langchain-classic/package.json:4`).

The current path is `createAgent` and middleware, exported from `langchain`
(`libs/langchain/src/agents/index.ts:176`, re-exported at
`libs/langchain/src/index.ts:54`, middleware at `:59`). The core package also keeps
v0.x-shaped types without an implementation: `AgentAction`, `AgentFinish` and
`AgentStep` in `libs/langchain-core/src/agents.ts:1-18` exist for callbacks and the
classic package. A reader who finds `AgentExecutor` in the tree has found the legacy
world; the current agent is `ReactAgent`.

## Why it is in the register

The register row is exact: tools, retrievers, vector stores and agent executors are the
four capabilities where this repository defines a standard many other projects adopt.
Our baseline has one tool shape, no embeddings and no retrievers, and an agent loop we
wrote ourselves; this dive records what the standard interface for each looks like,
which implementation choices carry the breadth, and what a library our size should
refuse.

## How it is positioned against us

| family | langchainjs | this port at the baseline |
|---|---|---|
| shape | framework of interfaces plus one agent built on a graph runtime | library with one loop, pluggable executors and optional vendor peers |
| agent | `createAgent` over a compiled LangGraph state graph with middleware | hand-written code-action and tool-calling loops with a fixed middleware chain (RT-08) |
| extension | typed middleware contributing state, tools and hooks around model and tool calls | one middleware array around each step |
| tools | `tool()` accepting Zod v3, Zod v4, JSON Schema and serializable schemas; client and provider-hosted tools | `tool()` with one Zod schema, JSON Schema emitted for the model (TL-01) |
| structured output | `withStructuredOutput` on every chat model plus agent-level tool or provider strategies | seam-only provider support; final answer validated by the loop (GR-02, GR-05) |
| retrieval | embeddings, vector store and retriever interfaces, with implementations in other packages | absent (MD-06, and no row for retrieval at all) |
| tracing | callback managers, run tree, LangSmith, console, event and log stream tracers | local span tree and typed events, no exporter (OB-01, OB-02) |
| dependency weight | a graph runtime and checkpoint package as direct dependencies | no runtime dependency; vendor SDKs are optional peers |

## Limits of this read

No published page was read: the environment's web-fetch tool failed on 2026-10-21 with
"multiple usable web providers are registered (http, deepseek-fetch-api); configure one
explicitly", so `https://docs.langchain.com` is located only through links in the
READMEs. Every documentation claim below is marked `declared`; only claims traced into
the clone are `implemented`. The agent loop is partly delegated to
`@langchain/langgraph`, which was not read, so statements about graph execution,
checkpoint formats and stream modes stop at the call boundary in `ReactAgent`. Retrieval
implementations outside this repository were not read either.

## Folder map

- `libs/langchain` — the v1 package: `src/agents` (agent, nodes, middleware,
  transformers), `src/chat_models` (universal model init), `src/tools`, `src/prompts`,
  `src/storage`, `src/load`.
- `libs/langchain-core` — the interfaces: `runnables`, `messages`, `tools`,
  `language_models`, `vectorstores.ts`, `retrievers`, `embeddings.ts`, `callbacks`,
  `tracers`, `documents`, `document_loaders`, `output_parsers`, `prompts`, `stores.ts`,
  `caches`.
- `libs/langchain-classic` — the v0.x surface kept for compatibility: chains, memory,
  agents (including `AgentExecutor`), indexes, vectorstores, output parsers.
- `libs/langchain-textsplitters`, `libs/langchain-mcp-adapters`,
  `libs/create-langchain-integration` — splitting, MCP tool adapters and integration
  scaffolding.
- `libs/providers` — 32 first-party provider packages; `libs/langchain-standard-tests` —
  the shared integration test suite.
- the clone's `clone:/docs/core_docs` is an empty directory at this commit; the documentation site is
  external.

The companion files: `02-features-inventory.md` records the capability set row by row,
`03-gap-and-lessons.md` prices it against the baseline, and `04-sources.md` records the
read.
