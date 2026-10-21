# voltagent — competitor profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Identity

| field | value |
|---|---|
| repository | https://github.com/VoltAgent/voltagent |
| register row | Tier 1, depth D3, slug `voltagent`; recorded focus is the supervisor and subagent runtime, memory adapters, workflows and observability; wave 3 |
| licence | MIT. The root file is spelled `LICENCE`, and it is a plain MIT text with one copyright line. 29 of the 30 package manifests declare `MIT`; the private `@voltagent/e2e` test app is the sole exception. No enterprise folder, no separate commercial licence, and no copyleft anywhere in the tree |
| read commit | `72a46c76b4507e1f98b41d5050a92bd30587eb70`, committed 2026-09-27 18:57:26 -0700, subject `ci(changesets): version packages (#1424)` |
| read date | 2026-10-21 |
| clone | `reference/competitors/voltagent`, shallow (`--depth 1`), worktree clean at the read |
| published version | `@voltagent/core` 2.11.0 at the read; the workspace packages version independently through changesets |
| language and stack | TypeScript on pnpm workspaces with Nx, Lerna for publishing, Biome for lint and format, tsup for bundles, Vitest for tests, Node 20 or later |
| size signal | 590 non-test source files holding 122,923 lines across the package `src` trees. `@voltagent/core` alone is 226 files and 67,447 lines; `server-core` and `server-hono` add 16,241 lines of HTTP surface. 212 test files, and the core package carries 110 spec files |
| surrounding material | 127 Markdown pages under `website/docs`, a second documentation site under `website/actions-triggers-docs`, 87 runnable example projects, and a 343-page website in total |
| documentation source | the pages ship in the clone and are published at https://voltagent.dev/docs/ (read 2026-10-21) |
| licence file | `LICENCE` in the clone root, 21 lines: the MIT grant followed by the warranty disclaimer |
| wire surface | no wire format of its own for model calls: the framework hands plain messages and tools to the Vercel AI SDK, and wraps the official MCP client for MCP servers |
| test posture | unit suites beside the source, Vitest at the root, an end-to-end package, and no conformance or behaviour-pin apparatus |

## The published set

| package | role | weight |
|---|---|---|
| `@voltagent/core` | agent, tool, memory, workflow, guardrail, MCP, tracing, PlanAgent, workspace | 67,447 lines |
| `@voltagent/server-core` | provider-neutral handlers, schemas and business logic for the HTTP API | 10,316 lines |
| `@voltagent/server-hono`, `server-elysia`, `serverless-hono` | concrete HTTP servers over those handlers | 5,925 lines for Hono alone |
| `@voltagent/libsql`, `postgres`, `supabase`, `cloudflare-d1`, `voltagent-memory` | memory and workflow-state stores, one adapter package per database | 2,863 for LibSQL, 2,024 for Postgres |
| `@voltagent/anthropic-ai`, `google-ai`, `groq-ai` | tombstone packages: each is a `DEPRECATED.md` pointing at AI SDK models | one page each |
| `@voltagent/langfuse-exporter`, `vercel-ai-exporter` | OpenTelemetry exporters for those two ecosystems | small |
| `@voltagent/rag`, `evals`, `scorers` | retrieval, evaluation payloads and scoring primitives | 2,191 / 2,522 / small |
| `@voltagent/voice`, `sandbox-e2b`, `sandbox-daytona`, `sandbox-blaxel` | speech providers and hosted sandbox backends | thin adapters |
| `@voltagent/mcp-server`, `a2a-server`, `ag-ui` | serve agents outward over MCP, A2A or the AG-UI protocol | thin |
| `@voltagent/sdk`, `resumable-streams`, `logger`, `internal` | API client, stream resumption, logging, shared utilities | supporting |
| `@voltagent/cli`, `create-voltagent-app`, `docs-mcp` | scaffolding and a documentation MCP server | small |

## What it is

An open-source TypeScript framework for building and running agents, sold alongside a separate operations console. The framework is the half this dive reads: agents, tools, memory, workflows, guardrails, tracing and MCP clients live in `packages/core`, and a fetch-based server can expose them over HTTP.

Two design choices explain most of the code. First, the framework does not own the model loop: it builds messages and tools, then calls the Vercel AI SDK's `generateText` or `streamText` with `stepCountIs(maxSteps)` and hangs hooks, guardrails, memory persistence and spans off that call (`packages/core/src/agent/agent.ts:1393`). Second, the unit of composition is a stream of UI messages, so a run is observed by consuming `fullStream` rather than by inspecting a result object.

## Why it is in the register

Our framework has a manager that calls a child agent as a tool, a tool lifecycle, a guardrail seam and a local span tree; it has no supervisor topology, no durable memory adapter set, no workflow engine and no OpenTelemetry export (`docs/research/competitors/_synthesis/00-our-baseline.md:38`). This repository is the most complete open-source statement of those four things in TypeScript, and its delegation contract is the part our roadmap has to price.

## How it is positioned against us

The overlap is the agent runtime, not the product. They ship a server, a console and a set of managed services; we ship a library. The useful comparison is therefore per seam: how a delegated task returns, how memory is written and read around a run, how a workflow survives suspension, and what a trace costs.

## What it is opinionated about

- **Delegation is a generated tool call.** A supervisor is an ordinary agent that happens to carry a `delegate_task` tool and a system message listing its specialists (`packages/core/src/agent/subagent/index.ts:758`).
- **The supervisor prompt is code.** It is assembled from a fixed guideline list plus the subagent names, and an operator can replace it wholesale (`packages/core/src/agent/subagent/index.ts:236`).
- **Memory by omission.** An agent without a `memory` option still gets in-memory conversation storage; turning it off takes `memory: false` (`website/docs/agents/memory/overview.md:139`).
- **Traces are the product surface.** Observability is an OpenTelemetry provider with pluggable span processors, not a bespoke event log (`packages/core/src/observability/node/volt-agent-observability.ts:31`).
- **UI messages are the integration contract.** Tool approval, client-side tools, subagent progress and resumable streams all speak the AI SDK's message and stream shapes.
- **Workflows are typed builders.** Control flow is method chaining over a data object whose type grows per step, not a graph description (`website/docs/workflows/overview.md:186`).

## What it deliberately does not do

- No inference of its own: every model call goes through the AI SDK, and providers are reached as AI SDK model instances.
- No hosted console in the repository: VoltOps is a separate hosted or self-hosted product; the tree holds its client, routes and docs.
- No managed database: memory and workflow state live in adapters that a caller supplies, with in-memory defaults.
- No scheduler or external-event runtime in-process: triggers are defined here but executed by the console, and the local surface is a catalog plus route stubs.
- No agent-to-agent authority: A2A and AG-UI are thin server packages, not a second delegation model.

## How to read the rest of the dive

- `docs/research/competitors/voltagent/01-architecture.md` traces one delegation, one workflow run and one traced tool call through the layers.
- `docs/research/competitors/voltagent/02-features-inventory.md` lists the capabilities verb by verb with status and evidence.
- `docs/research/competitors/voltagent/03-gap-and-lessons.md` prices the differences against our baseline ids and separates what to copy from what to avoid.
- `docs/research/competitors/voltagent/04-sources.md` records the commit, the licence finding, the pages read and the refresh procedure.

## Limits of this read

- Claims taken from `website/docs` are labelled `declared` in `docs/research/competitors/voltagent/02-features-inventory.md`; only source-traced claims are `implemented`.
- No install, build, test or execution: the clone was read as text, so runtime behaviour is unverified.
- The agent runtime was read around the call path, the hooks and the delegation code; the 8,000-line class was not read line by line.
- The HTTP server packages were surveyed at the route and handler level; their provider-specific middleware was not traced.
- The console, the managed services and the deployment docs are outside the tree and outside this read.
- Evaluation, voice and sandbox packages were recorded as inventory items only.
