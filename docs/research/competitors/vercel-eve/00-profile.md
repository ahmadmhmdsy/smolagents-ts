# vercel/eve — repository profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Identity**

| field | value |
|---|---|
| Repository | https://github.com/vercel/eve |
| Owner | Vercel |
| Licence | Apache-2.0, SPDX id from the GitHub repository endpoint on 2026-10-21 |
| Licence file | `LICENSE`, Apache License Version 2.0, read in full; `NOTICE` sits beside it |
| Read commit | `c543585422cae0faf200965027bd53ac5cadc82a` |
| Commit date | 2026-10-20 23:00:02 -0400 |
| Commit subject | `feat(eve)!: replace numeric session limits with a limits.sessionUsage function (#5028)` |
| Upstream branch | `main`, pushed 2026-10-21T14:05:37Z |
| Version read | `0.81.1` (`packages/eve/package.json:3`) |
| Language | TypeScript; Node 24 or newer (`package.json:50`) |
| Packaging | pnpm 12.7.0 workspace driven by turbo (`package.json:46`, `:52`) |
| Scale | 6,739 checked-out files; `packages/eve/src` holds 2,902 TypeScript files, 1,075 of them tests, 564,329 lines |
| Documentation | https://eve.dev/, generated from `clone:/docs` by `apps/docs` |
| Clone | `reference/competitors/vercel-eve`, shallow `main`, clean tree |
| Read on | 2026-10-21, depth D3 |

**What the project is**

An agent here is a folder. Instructions, tools, connections, skills, subagents,
sandbox, hooks, channels and schedules are files whose names come from their
paths, and a compiler turns that tree into a manifest plus artifacts under
`.eve` (`packages/eve/src/compiler/compile-agent.ts:79-88`,
`clone:/docs/reference/agent-files.md:32-43`). Nothing needs registering in
code: a file at a supported slot is the capability.

The runtime is a durable workflow rather than a resident process. A session is
one workflow; a turn is one delivered message and the work it starts; a step is
the checkpoint where one model call and its inline tool calls commit
(`clone:/docs/concepts/execution-model-and-durability.mdx:10-22`). Messages,
cancellations, approval answers and child results reach a suspended run through
workflow hooks, so a session can wait days and continue where it stopped.

Work that must outlive a step becomes a task. `execute`, workflow-tool and
subagent calls run as durable child runs, and the turn parks while they work;
`task` and `serve` bodies keep a task resumable across calls, with
`eve__task_wait` and `eve__task_cancel` as model-visible controls
(`packages/eve/src/shared/action-types.ts:139-160`,
`clone:/docs/tools/tasks.md:212-217`). This is the part of the framework that
differs most from an in-process agent loop.

Around that core sit channels (HTTP, Slack and messaging entry points),
connections to MCP and OpenAPI services, compaction and memory, sandbox
providers, a typed TypeScript client under `eve/client`, and an eval harness.
The published package `eve` carries the framework and the `eve` CLI; the sibling
packages are internal libraries or extensions such as code, git and computer
use.

Documentation is treated as a product surface. The site holds 107 markdown
pages, and the repository keeps 47 issue-backed research notes that state a
problem, the proposed authoring API and the externally observable semantics
before implementation. Most "why" answers in this dive come from those notes
or from the docs, and each one was checked against the source.

**Why it is in the register**

It is the closest neighbour to the durable-agent direction on our roadmap.
Filesystem authoring, resumable turns, approval as a paused turn, subagents,
skills and a streaming client are the same list we are designing, solved in a
TypeScript framework with a published client and a real deployment story.

It is also the cleanest test of our decision 0018 workspace-sandbox non-goal:
almost every feature above stands on a managed `/workspace` with shell access,
so the dive prices what that exclusion defers instead of assuming it away.
The project is pre-1.0 and ships breaking changes in minor versions, which makes
it a live design laboratory rather than settled practice; where a doc promises
something the source does not implement, the divergence is filed as a finding.

**How it is positioned against us**

| dimension | vercel/eve | this port |
|---|---|---|
| authoring | a directory of files compiled into a manifest | TypeScript calls composing an agent |
| loop | a durable workflow whose step checkpoints a model call | an in-process loop checkpointing between steps |
| state | workflow run state plus one durable session record | a `RunStore` checkpoint per step |
| execution | a managed `/workspace` with shell, files and seeded skills | a QuickJS-WASM guest or a remote kernel |
| network | sandbox network policy, credentials brokered app-side | a declared policy, unconfined in the process backend |
| multi-agent | tasks and declared subagents with their own slots | a managed agent called inline as a tool |
| HITL | a parked turn resumed by a hook | an approval gate that allows or denies one call |
| streaming | a durable NDJSON event log with resumable cursors | a typed in-process event stream |
| client | `eve/client` over HTTP, reconnect from an index | React layers over `AgentSession` |
| deployment | Vercel Workflow, the local world, or a Postgres world | a library the host process runs |
| release | published pre-1.0 with changesets | unpublished 0.1.0; T-14 blocks it |
| docs | a published site plus issue-backed research notes | numbered documents and records |

**How to read the rest of this folder**

- `01-architecture.md` covers the layout, the compile and runtime abstractions,
  one turn's path, persistence, streaming and the build stack.
- `02-features-inventory.md` holds capability rows with status, pointer,
  mechanics and rationale, grouped by the six focus seams.
- `03-gap-and-lessons.md` buckets gaps against baseline row ids and names the
  patterns worth copying or avoiding.
- `04-sources.md` records the commit, licence, URLs, files read, commands,
  unverified claims and refresh steps.

**Limits of this read**

- Nothing was installed, built, started or executed. Every runtime claim comes
  from source or documentation, never from a live session.
- The Workflow SDK and the Vercel runtime are dependencies, not vendored code;
  where the engine decides behaviour it is marked inferred.
- No sandbox provider was exercised: Vercel snapshots, Docker images,
  microsandbox and just-bash are read from configuration and adapter types.
- Channels beyond the HTTP flow, the eval harness, computer use, git and
  self-modification packages, and the benchmark apps were sampled, not traced.
- The clone is shallow, so commit history and release notes are unavailable;
  intent is read from research notes, docs and code shape.
- `main` moves and the project is pre-1.0, so line numbers hold only at the
  pinned commit.
- Clone paths whose first segment would collide with our validator carry a
  `clone:/` prefix; every other pointer is relative to the clone root.
