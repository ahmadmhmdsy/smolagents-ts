# agno-agi/agno — repository profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Identity**

| field | value |
|---|---|
| Repository | https://github.com/agno-agi/agno |
| Owner | Agno |
| Licence | Apache-2.0, SPDX id returned by the GitHub repository endpoint on 2026-10-21 |
| Licence file | `LICENSE`, 11,343 bytes, Apache License Version 2.0; no `NOTICE` file at the root |
| Read commit | `7a4febfa9de7a6c1f5e420fad88e4e8db956aef4` |
| Commit date | 2026-10-21 12:14:43Z |
| Commit subject | `chore: Release v3.1.8 (#11208)` |
| Upstream branch | `main`, pushed 2026-10-21T14:35:18Z |
| Version read | `3.1.8` (`libs/agno/pyproject.toml`) |
| Language | Python 3.9 to 3.13 (`libs/agno/pyproject.toml`) |
| Packaging | one PyPI distribution, `agno`, with optional extras for models, tools, OS and storage |
| Scale | 7,289 tracked files; `libs/agno/agno` holds 1,409 of them across 47 top-level entries |
| Repository description | Build, run, and manage agent platforms |
| Read on | 2026-10-21, depth D2 (published documentation and repository metadata, no clone) |

**What the project is**

Agno is three products in one repository. The SDK gives a Python programmer
three composition primitives: an agent, a team of agents, and a workflow of
steps. AgentOS turns those definitions into a FastAPI service that the operator
hosts, with database-backed sessions, memory, knowledge, tracing, authorization,
scheduling and a job queue. The Control Plane is a hosted web application that
connects from the operator's browser to that service for chat, trace inspection,
approvals and schedules.

The pitch is ownership of the stack: your models, your database, your
containers. The README frames it as build, run and manage, and every layer has
a named artefact: `Agent`, `AgentOS`, `os.agno.com`. The platform half is not a
separate repository; it is inside the installed package as the `os`, `sandbox`,
`job_queue`, `scheduler` and `registry` modules, which is the single most
important fact for our comparison.

Repository layout follows that split. `libs/agno` holds the SDK and the runtime;
`libs/agnoctl` holds the CLI that also publishes as `agno`; `libs/agno_infra` is
an older infrastructure CLI for Docker and cloud templates; `cookbook` holds 18
numbered example groups plus framework integrations; `scripts` and `.github`
hold the release and CI machinery. The documentation is not in this repository:
`agno-agi/docs` is a separate MDX repository rendered at docs.agno.com.

**A correction to the brief**

The assignment assumed a Python half and a TypeScript half in conversation.
That pairing does not exist in this repository. All 7,289 files are Python,
configuration, Markdown or data; the only TypeScript is one cookbook demo
frontend for the AG-UI protocol under `cookbook/05_agent_os/16_agui/openui`.
The TypeScript product is a sibling repository, `agno-agi/agent-ui`, a Next.js
chat client for AgentOS under MIT, last pushed 2026-05-08. It is a client of
the runtime, not a port of the SDK, so a TypeScript-versus-Python comparison
belongs to the client, not the agent framework.

**Why it is in the register**

It is the strongest platform-shaped neighbour: the same capability list we
deliberately keep out of a library (sessions, memory, tracing, authorization,
scheduling, deployment) is the product here. Reading it tells us which of those
capabilities are genuinely runtime concerns and which are separable seams a
library could expose without shipping a server.

It is also the clearest test of decision 0018. Agno does not merely allow a
workspace sandbox; it ships a root-scoped `Workspace` toolkit with confirmation
gates, a database-backed `FileSystem`, and a sandbox module with checkpoints.
Pricing that surface is the point of the bucket rows in the gap file.

**How it is positioned against us**

| dimension | agno-agi/agno | this port |
|---|---|---|
| unit of composition | agent, team, workflow classes | agent plus a managed-agent tool |
| authoring | Python calls inside a hosted service | TypeScript calls inside a host process |
| runtime | your FastAPI app, your database | a library the caller's process runs |
| sessions | rows in `agno_sessions` and `agno_runs` | an in-memory `RunStore` checkpoint |
| memory | per-user records in `agno_memories` | none; the caller supplies context |
| retrieval | `Knowledge` over a vector database | absent by decision 0018 |
| tools | Python functions, 100+ toolkits, MCP | Zod tools, a registry, MCP client |
| guardrails | input pre-hooks with built-ins | input and output tripwires |
| HITL | paused runs plus persisted approvals | a gate that allows or denies |
| durability | checkpoint at tool batches, continue by id | checkpoint between steps |
| observability | OpenTelemetry into your database | an in-process span tree |
| access control | JWT, scopes, service accounts, quotas | none; the host decides |
| deployment | templates for nine targets plus a CLI | none; unpublished |
| licence | Apache-2.0 | MIT, if T-14 lands |

**Limits of this read**

- No clone was made. The licence permits one, and the brief scoped this to a
  shallow documentation read; every claim is labelled implemented, declared or
  inferred from that evidence.
- No install, import, build, test or server start happened, so latency, table
  provisioning and streaming behaviour are documented, not observed.
- The repository metadata was read through the GitHub API at the pinned commit;
  the documentation pages were read as Markdown from docs.agno.com.
- Depth is D2: there is no `01-architecture.md`, and the runtime internals are
  described only as far as the docs expose them.
- `main` moves daily, so a claim holds at this commit and no later one.