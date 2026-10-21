# vercel/eve — sources for this read

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Repository and read point**

| item | value |
|---|---|
| Repository | https://github.com/vercel/eve |
| Commit | `c543585422cae0faf200965027bd53ac5cadc82a` |
| Commit date | 2026-10-20 23:00:02 -0400, subject "feat(eve)!: replace numeric session limits with a limits.sessionUsage function (#5028)" |
| Version string | `0.81.1` (`packages/eve/package.json:3`) |
| Clone | `reference/competitors/vercel-eve`, shallow `main`, clean tree, 6,739 files |
| Read date and depth | 2026-10-21, D3 |

**Licence**

The GitHub repository endpoint returned SPDX id `Apache-2.0` on 2026-10-21, and
`LICENSE` holds the Apache License, Version 2.0 text at that commit, read
completely; `NOTICE` sits beside it. That permits a full source read. Nothing was
copied, and short protocol shapes are quoted with attribution.

**Documentation URLs, read 2026-10-21**

Pinned to the commit so the text matches the clone; the published site is
https://eve.dev/.

- https://github.com/vercel/eve/tree/c543585422cae0faf200965027bd53ac5cadc82a
- https://github.com/vercel/eve/blob/c543585422cae0faf200965027bd53ac5cadc82a/docs/concepts/execution-model-and-durability.mdx
- https://github.com/vercel/eve/blob/c543585422cae0faf200965027bd53ac5cadc82a/docs/concepts/sessions-runs-and-streaming.md
- https://github.com/vercel/eve/blob/c543585422cae0faf200965027bd53ac5cadc82a/docs/tools/tasks.md
- https://github.com/vercel/eve/blob/c543585422cae0faf200965027bd53ac5cadc82a/docs/guides/client/streaming.mdx
- https://github.com/vercel/eve/blob/c543585422cae0faf200965027bd53ac5cadc82a/docs/subagents/index.mdx
- https://github.com/vercel/eve/blob/c543585422cae0faf200965027bd53ac5cadc82a/docs/tools/human-in-the-loop.md

**Files read**

Documentation, complete: execution model, sessions and streaming, tasks,
client streaming, subagents, skills, human-in-the-loop, sandbox, agent files,
state, context control, default harness, security model, connections, memory,
channels, agent configuration, and four research notes.

Source, complete or near-complete: the session runtime (`entry.ts`,
`program.ts`, `turn.ts`, `turn-step.ts`, `state-cursor.ts`), the durable
session store, the workflow runtime, the event stream and NDJSON reader, the
session inbox, the task table, `execution/session.ts`, `shared/action-types.ts`,
`approval/definition.ts`, `sandbox/state.ts`, the default sandbox provider and
resolver, `subagents/tool.ts`, `subagents/parent-notification.ts`, the skills
instructions and paths, and `compiler/compile-agent.ts`.

Sampled: compiler manifest and compatibility modules, channel routes, the
client reducer and follower, harness call sites, task start and steps.

Not read: channel adapters, the eval runner, benchmarks, computer use, git
and self-modification, the TUI, and the vendored `@workflow/*` engine.

**Commands run**

- `gh api repos/vercel/eve --jq '.license.spdx_id'`, returning `Apache-2.0`.
  The brief's drafted form doubled the owner segment; the correct shape is
  `gh api repos/<owner>/<repo>` with a two-part slug.
- `git clone --depth 1 https://github.com/vercel/eve reference/competitors/vercel-eve`.
- `git -C reference/competitors/vercel-eve rev-parse HEAD` and `status --short`,
  which was empty; read-only listing and text inspection through file tools.

No install, build, test, dev server or eval ran, and the clone was not
modified.

**What was not verified**

- Whether any test suite passes; tests record intent, not behaviour.
- Production workflow behaviour on Vercel: queues and hook delivery.
- Sandbox providers: no snapshot, image, template or just-bash tree ran.
- Remote subagent callbacks across two deployments.
- Model calls, compaction and token accounting, which need a provider key.
- Channels, evals, benchmarks, the browser client, cost and reliability.

**How to refresh this read**

1. Fetch into the existing clone rather than cloning again; check the tree is
   clean.
2. Capture the commit id, its date and its subject before opening any file.
3. Diff the cited ranges and re-read only modules whose lines moved.
4. Re-check the licence endpoint if ownership or the licence file changed.
5. Replace a claim whose evidence disappeared; never soften it.
6. File a superseding record rather than editing this frozen one.