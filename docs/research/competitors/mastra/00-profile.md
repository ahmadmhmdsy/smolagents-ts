# mastra — competitor profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Identity

| field | value |
|---|---|
| repository | https://github.com/mastra-ai/mastra |
| register row | Tier 1, depth D3, slug `mastra` |
| licence | GitHub reports SPDX `NOASSERTION` (key `other`). `LICENSE.md` states Apache-2.0 for the repository except the `ee/` directories, which carry their own `ee/LICENSE` |
| read commit | `b2d862354c63541de60d4c2e13c90f514e8a1e04`, committed 2026-10-21 17:30 +0200 |
| clone | `reference/competitors/mastra`, shallow (`--depth 1`), worktree clean at the read |
| language and stack | TypeScript; pnpm workspace driven by Turborepo; Vitest tests colocated with source; Node-first runtime |
| size signal | roughly 11.9k lines in `agent.ts`, 6.0k in `workflow.ts`, 4.3k in `packages/memory/src/index.ts` and 3.0k in `processors/runner.ts`, all measured on the read commit |
| documentation source | the clone ships its docs site source, published at https://mastra.ai/docs |

## What it is

Mastra is an agent framework for TypeScript teams building product features, not a
research harness. An `Agent` owns a model, instructions, tools, memory and processors;
a run streams typed chunks; the agentic loop that drives the model is itself built from
the framework's workflow primitive, so the same suspend, resume and snapshot machinery
used by hand-written workflows also governs a model call and a tool call.

Around that loop the repository ships a memory subsystem with threads, working memory
and an observational-memory compressor; an evaluation stack with scorer builders, gate
semantics, datasets and experiments; an MCP server that exposes agents, tools and
workflows over stdio and Streamable HTTP; and a processor pipeline that both guardrails
and memory plug into.

The code is organised as a monorepo of narrow packages with a very large core. Feature
work is steered towards processors by the repository's own contribution rule, which is
visible in the clone's `packages/core/AGENTS.md`: a feature that can be a processor
avoids changing core internals and can be registered for every user by default.

## Why it is in the register

The register row names agents, workflows with suspend and resume, memory, evals and
scorers, MCP server authoring, and processors and guardrails. Each maps onto live work
of ours:

- agents: the supervisor and sub-agent shape, delegation hooks, task-completion scoring
- workflows: suspend and resume as a first-class step result, snapshots, resumption
  claims, recovery of interrupted runs
- memory: thread and resource identity, working memory with atomic merge, semantic recall
- evals: scorer pipelines, sampling and filters, gates, datasets and experiments
- MCP server: conversions of tools and agents, continuations that require more input
- processors: a general extension seam that we currently approximate with middleware and
  a single guardrail hook

## How it is positioned against us

Mastra is a platform-shaped framework: more packages, more configuration, a storage
abstraction per concern, and a deployment story. This port is a library-shaped runtime:
one program authored by the model, executed in a sandbox, with an isomorphic core and a
small published surface.

The comparison that matters is therefore not feature count. It is whether their depth
in durability, memory and evaluation can be reached through our seams without importing
their shape. The evidence says the durable and processor seams are where the distance
is largest, and that the distance is mostly in state modelling rather than in code
volume.

| family | mastra | this port at the baseline |
|---|---|---|
| action space | tool-call JSON turns, with a documented code mode | model-authored program in a sandbox, the default |
| durability | snapshot per run, resumption claims, ownership leases | checkpoint between steps, one in-memory store |
| memory | threads, working memory, semantic recall, observational memory | session checkpoint across turns |
| evaluation | scorers, gates, datasets, experiments, LLM judges | one expectation-shaped scorer |
| MCP | client and server, with continuations | client with tools only |
| guardrails | a processor pipeline with built-ins and retry budgets | one input and output tripwire seam |

## Limits of this read

- Shallow clone: no history, no tags, no blame. Every claim is pinned to the commit above.
- Reading was concentrated on `packages/core`, `packages/memory`, `packages/mcp` and
  `packages/evals`. Store adapters, deployers, client SDKs and the `ee/` tree were not read;
  the licence carve-out also keeps `ee/` out of scope by rule.
- The clone's documentation was used for rationale only, and only three pages were read in
  full (suspend and resume, guardrails, agent networks); the rest of the docs tree was
  located but not read. Documentation is marked `declared` evidence, never `implemented`.
- Nothing was installed, built, tested or executed. The evented engine and the worker mode
  were read, not observed; runtime behaviour beyond the traced call path is inferred.
- Documentation URLs in these files map the clone's page paths onto the published site.
  They were not fetched live, so a page may have moved since the commit.
