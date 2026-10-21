# microsoft/agent-framework — profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Identity

| field | value |
|---|---|
| repository | https://github.com/microsoft/agent-framework |
| slug | agent-framework |
| commit | `02005995380d5a09167e5c43b5d0f88328979145` |
| commit subject | `Python: Improve settled approval matching (#9535)` |
| commit date | 2026-10-21 11:31 +0000 |
| date read | 2026-10-21 |
| licence | MIT, `LICENSE:1`; `gh api repos/microsoft/agent-framework --jq '.license.spdx_id'` returned `MIT` |
| clone | `reference/competitors/agent-framework/`, one commit |
| languages | C# 2,187 files, Python 1,310 files, TypeScript 86 files (front-ends only) |
| distributions | 43 Python projects, 34 in-tree .NET source projects, 337 `.csproj` files |
| docs | 53 decision records, plus `design/`, `features/` and `specs/` |
| version read | `agent-framework-core` 1.22.0 (`python/packages/core/pyproject.toml:7`) |

## What it is

Microsoft Agent Framework is an open, multi-language agent product: one design, two hand-written implementations (C# and Python), with Go maintained in a separate repository (`README.md:45`).
The stated ambition is the path from prototype to production: graph-based orchestration, durability, observability and human control, rather than a single chat loop (`README.md:33`).
It is the consolidation point for ideas that previously lived in Semantic Kernel and AutoGen; the documentation links migration guides for both (`README.md:104`).

The centre of gravity is the workflow engine, not the agent class.
Agents are one kind of executor that can be placed on a graph, and the five named orchestration patterns are builders over that same engine.
That ordering matters for a reader: the agent abstraction is deliberately thin, while execution, checkpointing and eventing are deep.

## How the surfaces relate

- The two implementations do not share generated code. They share a decision log: 53 records under `clone:/docs/decisions/`, several of which are explicitly about parity between the surfaces.
- Naming parity is handled by a written rename table rather than by mirroring names: `AIAgent` becomes `AgentProtocol`, `ChatClientAgent` becomes `ChatAgent`, and the reasons for each divergence are recorded (`clone:/docs/decisions/0005-python-naming-conventions.md:40`).
- .NET grounds its chat primitives in the external `Microsoft.Extensions.AI` abstractions, so `ChatMessage`, `ChatResponse` and `IChatClient` come from a package outside this repository (`dotnet/src/Microsoft.Agents.AI.Abstractions/ChatHistoryProvider.cs:51`).
- Python owns its own protocols instead: `SupportsChatGetResponse` and `SupportsAgentRun` are defined in core (`python/packages/core/agent_framework/_clients.py:85`, `python/packages/core/agent_framework/_agents.py:288`).
- Python is packaged provider-leading after a deliberate extraction: core keeps abstractions and middleware, and provider code moves to packages with their own namespaces (`clone:/docs/decisions/0021-provider-leading-clients.md:34`).
- TypeScript is not a third port. The 86 `.ts` files are the DevUI and sample front-ends, not a language surface for the framework.
- Parity is not uniform and the repository is honest about it: the .NET AG-UI protocol package was deleted in favour of an external SDK (`dotnet/src/Microsoft.Agents.AI.AGUI/README.md:1`), while Python still ships an `ag-ui` package with its own approval lifecycle.

## Repository layout

| tree | holds |
|---|---|
| `dotnet/` | solution `dotnet/agent-framework-dotnet.slnx`, 34 source projects, ~731 test files |
| `python/` | workspace root, 43 projects under `python/packages/`, ~325 test files |
| `clone:/docs/decisions/` | the accepted design record, the de facto parity contract |
| `clone:/docs/design/`, `clone:/docs/features/`, `clone:/docs/specs/` | implementation notes and one behavioural spec for the Python function loop |
| `declarative-agents/` | YAML samples for declarative agents and workflows |


## What it offers, in its own framing

- A graph workflow engine with sequential, concurrent, handoff and group patterns, plus a manager-driven magentic mode (`README.md:50`).
- Checkpointing, streaming and human-in-the-loop as properties of that engine, not of the agent loop.
- OpenTelemetry tracing and metrics for both agents and workflows (`README.md:54`).
- Declarative agents in YAML, agent skills, and a developer UI for local inspection (`README.md:56`, `:58`, `:62`).
- Hosting adapters, so a workflow can be served over A2A, MCP, AG-UI or an OpenAI-compatible HTTP surface.

## Where the depth sits

| area | depth | evidence |
|---|---|---|
| workflow execution | executor protocol, routing, supersteps, eventing, checkpoint and resume | `dotnet/src/Microsoft.Agents.AI.Workflows/Executor.cs:165` |
| agent composition | providers for context and history, session stores, decorator base | `dotnet/src/Microsoft.Agents.AI.Abstractions/DelegatingAIAgent.cs:28` |
| protocol boundaries | A2A, MCP, AG-UI, OpenAI-compatible hosting, all as adapter packages | `dotnet/src/Microsoft.Agents.AI.Hosting.OpenAI/EndpointRouteBuilderExtensions.Responses.cs:19` |
| product surface | 43 Python projects and 34 .NET projects on separate release trains | `python/packages/core/pyproject.toml:2` |

## A reader's summary

For agents this repository is conventional: a thin abstract agent, a session of state, a response of messages plus metadata.
For systems it is not: the same repository treats a run as a resumable graph, a pause as a value, and a protocol as an adapter.
## Read scope

Read at file level: the .NET abstractions project, the workflow engine's public types, the five orchestration builders, the Python core modules for agents, clients, sessions, middleware and feature staging, the Python workflow package, eight decision records, and both package manifests.
Not read: provider adapters, hosting internals, the DevUI front-end, sample projects, and the documentation site.
Claims about the site are declared-only and marked as such in `docs/research/competitors/agent-framework/02-features-inventory.md`.

## Judgement

The transferable idea is not the agent class. It is the seam discipline: a session holds state, providers hold behaviour, a request port pauses a run, a checkpoint makes the pause durable, and a decision log keeps two hand-written surfaces from silently diverging.
