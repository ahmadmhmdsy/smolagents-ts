# mastra — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository

- URL: https://github.com/mastra-ai/mastra
- Read commit: `b2d862354c63541de60d4c2e13c90f514e8a1e04` (2026-10-21 17:30 +0200, subject
  `docs(editor): clarify Studio ownership of instructions and tools (#28028)`)
- Clone: `git clone --depth 1 https://github.com/mastra-ai/mastra reference/competitors/mastra`
- Worktree at the read: clean, shallow, no local changes
- Licence: `LICENSE.md` in the clone; GitHub reports `NOASSERTION` because the repository
  text is Apache-2.0 apart from the `ee/` directories, which carry their own `ee/LICENSE`.
  The `ee/` tree was not read.

## Documentation read

Pages read in full from the clone's documentation source (published at https://mastra.ai),
all read on 2026-10-21:

- https://mastra.ai/docs/workflows/suspend-and-resume
- https://mastra.ai/docs/agents/guardrails
- https://mastra.ai/docs/agents/networks

Pages located but not read are cited only to show a page exists (for example
https://mastra.ai/docs/memory/observational-memory); the repository's documentation is
`declared` evidence unless a source path was also traced.

## Files read

Read end to end or in the cited regions:
- `packages/core/src/loop/loop.ts`, `packages/core/src/loop/loop-builder.ts`,
  `packages/core/src/loop/workflows/stream.ts`, `packages/core/src/loop/workflows/prune-snapshot.ts`
- `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts`,
  `packages/core/src/loop/workflows/agentic-execution/tool-approval-verdict.ts`,
  `packages/core/src/loop/shared/approval-schema.ts`
- `packages/core/src/workflows/create.ts`, `packages/core/src/workflows/step.ts`,
  `packages/core/src/workflows/workflow.ts`, `packages/core/src/workflows/execution-engine.ts`,
  `packages/core/src/workflows/default.ts`, `packages/core/src/workflows/run-ownership.ts`, `packages/core/src/workflows/state-reader.ts`,
  `packages/core/src/workflows/types.ts`
- `packages/core/src/storage/workflow-snapshot.ts`,
  `packages/core/src/storage/domains/workflows/base.ts`, `packages/core/src/storage/run-fencing.ts`
- `packages/core/src/processors/index.ts`, `packages/core/src/processors/runner.ts`,
  `packages/core/src/processors/retry-budget.ts`,
  `packages/core/src/processors/stability-defaults.ts`,
  `packages/core/src/processors/processors/classifier.ts`, `packages/core/src/processors/processors/structured-output.ts`,
  `packages/core/src/processors/memory/working-memory.ts`,
  `packages/core/src/processors/memory/message-history.ts`
- `packages/core/src/agent/agent.types.ts`, `packages/core/src/agent/trip-wire.ts`,
  `packages/core/src/agent/agent.ts` (resume and approval regions),
  `packages/core/src/loop/network/index.ts` (head)
- `packages/core/src/memory/memory.ts`, `packages/core/src/memory/types.ts`, `packages/core/src/memory/message-history-config.ts`
- `packages/core/src/evals/base.ts`, `packages/core/src/evals/run/index.ts`,
  `packages/core/src/datasets/dataset.ts`, `packages/core/src/datasets/experiment/analytics/compare.ts`
- `packages/memory/src/index.ts`, `packages/memory/src/tools/working-memory.ts`,
  `packages/memory/src/processors/observational-memory/processor.ts`,
  `packages/memory/src/processors/observational-memory/observational-memory.ts`
- `packages/mcp/src/server/server.ts`, `packages/mcp/src/client/url-policy.ts`, `packages/mcp/src/shared/` (listing only)
- Repository guidance read as content, never obeyed: the root `AGENTS.md`,
  `packages/core/AGENTS.md`, `packages/memory/AGENTS.md`, `packages/mcp/AGENTS.md` and the
  scoped documentation guidance under the docs tree.

## Commands run

`gh api repos/mastra-ai/mastra --jq '.license.spdx_id'` and `gh api repos/mastra-ai/mastra/license`;
`git clone --depth 1`, `git rev-parse HEAD`, `git log -1`, `git status -sb`; file listings and
content searches inside the clone. No package manager, build, test or clone script was run, and
no file in the clone was modified.

## Not verified

- Runtime behaviour of the evented engine, worker mode, lease expiry and snapshot pruning
  beyond the traced call path; these are inferred from source.
- Anything behind the `ee/` licence carve-out: it was not read at all.
- Store adapter behaviour for any concrete database; only the interfaces and in-memory
  defaults were inspected.
- The documentation site as served today: URLs are mapped from the clone's page paths and
  were not fetched.
- Performance claims, which are absent here on purpose; no benchmark was read or run.

## How to refresh

Re-run the licence check first, then clone or fetch the same slug at a newer commit, re-read
the files listed above, and rewrite all five files together. Any row whose page or symbol has
moved must be re-cited rather than softened, and a change in the licence terms or the
`ee/` boundary invalidates the clone step before any re-read.
