# voltagent — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository

| field | value |
|---|---|
| url | https://github.com/VoltAgent/voltagent |
| commit | `72a46c76b4507e1f98b41d5050a92bd30587eb70` |
| commit date and subject | 2026-09-27 18:57:26 -0700, `ci(changesets): version packages (#1424)` |
| clone | `reference/competitors/voltagent`, shallow, clean at the read |
| read date | 2026-10-21 |
| licence | MIT |
| published core version | 2.11.0 |

## Licence finding

There is no file named `LICENSE`; the licence lives in `LICENCE`, a single standard MIT text. The GitHub API agrees:

```
gh api repos/VoltAgent/voltagent --jq '.license.spdx_id'
MIT
```

The head of the file:

```
MIT License

Copyright (c) 2025 VoltAgent Inc.
```

29 of the 30 manifests declare `"license": "MIT"`, including the private `@voltagent/server-elysia-example`. The exception is the private `@voltagent/e2e` test app, which declares none, a normal omission for a workspace member. No enterprise folder, no `ee/` directory and no secondary commercial licence exist, and no manifest names a copyleft dependency. VoltOps, the commercial console and managed service, is not in this tree: the repository carries only its client, routes and docs.

Conclusion: the whole monorepo is MIT and can be read at full depth.

## Documentation read

Every page was read on 2026-10-21 and is also present in the clone under `website/docs/`.

| page | url |
|---|---|
| subagents | https://voltagent.dev/docs/agents/subagents/ |
| agents overview | https://voltagent.dev/docs/agents/overview/ |
| memory overview | https://voltagent.dev/docs/agents/memory/overview/ |
| working memory | https://voltagent.dev/docs/agents/memory/working-memory/ |
| tools | https://voltagent.dev/docs/agents/tools/ |
| plan agent | https://voltagent.dev/docs/agents/plan-agent/ |
| MCP | https://voltagent.dev/docs/agents/mcp/mcp/ |
| workflows overview | https://voltagent.dev/docs/workflows/overview/ |
| suspend and resume | https://voltagent.dev/docs/workflows/suspend-resume/ |
| guardrails | https://voltagent.dev/docs/guardrails/overview/ |
| observability | https://voltagent.dev/docs/observability/overview/ |
| developer console | https://voltagent.dev/docs/observability/developer-console/ |
| triggers | https://voltagent.dev/docs/triggers/ |
| evals | https://voltagent.dev/docs/evals/ |

## Source files read

Delegation and runtime: `packages/core/src/agent/agent.ts`, `packages/core/src/agent/subagent/index.ts`, `packages/core/src/agent/subagent/types.ts`, `packages/core/src/agent/hooks/index.ts`, `packages/core/src/agent/guardrail.ts`, `packages/core/src/agent/guardrails/defaults.ts`, `packages/core/src/agent/streaming/guardrail-stream.ts`, `packages/core/src/agent/open-telemetry/trace-context.ts`, `packages/core/src/agent/conversation-buffer.ts`, `packages/core/src/agent/memory-persist-queue.ts`, `packages/core/src/planagent/plan-agent.ts`, `packages/core/src/planagent/planning/index.ts`.

State and seams: `packages/core/src/memory/index.ts`, `packages/core/src/memory/types.ts`, `packages/core/src/memory/manager/memory-manager.ts`, `packages/core/src/memory/adapters/storage/in-memory.ts`, `packages/core/src/workflow/core.ts`, `packages/core/src/workflow/chain.ts`, `packages/core/src/workflow/context.ts`, `packages/core/src/workflow/suspend-controller.ts`, `packages/core/src/workflow/steps/`, `packages/core/src/tool/index.ts`, `packages/core/src/tool/manager/BaseToolManager.ts`.

MCP, tracing, server and packages: `packages/core/src/mcp/client/index.ts`, `packages/core/src/mcp/registry/index.ts`, `packages/core/src/observability/index.ts`, `packages/core/src/observability/types.ts`, `packages/core/src/observability/node/volt-agent-observability.ts`, `packages/core/src/observability/adapters/in-memory-adapter.ts`, `packages/core/src/triggers/types.ts`, `packages/core/src/voltagent.ts`, `packages/server-hono/src/routes/index.ts`, `packages/server-hono/src/routes/observability.ts`, `packages/server-core/src/index.ts`, `packages/resumable-streams/src/index.ts`, `packages/libsql/src/index.ts`, and the deprecation notices under `packages/anthropic-ai/`, `packages/google-ai/` and `packages/groq-ai/`.

Counts came from enumerating files and summing lines per package. Nothing was installed, built, tested or executed.

## Unverified

- Every runtime claim: the clone was read as text.
- The console, the managed services and the deployment path, which are outside the tree.
- Approval state round-tripping through the AI SDK; the docs assert it and the code supports it, but no run was observed.
- The resumable stream stores and the sandbox providers.

## Refresh

Re-clone at a newer commit, then re-check the subagent manager, the agent class, the memory facade and the workflow core. Repeat the licence check with the same `gh api` command, because the `LICENCE` spelling defeats an automated `LICENSE` scan.

## Citation key

Clone paths are relative to the clone root and carry a line number. Pages under `website/docs` are the clone's copy of the published docs. Our own documents are cited relative to the repository root, with a line where the claim depends on one.