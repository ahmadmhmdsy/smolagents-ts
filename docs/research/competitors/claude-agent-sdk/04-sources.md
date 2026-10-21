# claude-agent-sdk — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository and package

| field | value |
|---|---|
| repository | https://github.com/anthropics/claude-agent-sdk-typescript |
| read commit | `9c59e061a0e49a4a99012218de66915bd407c96d` (2026-10-21T03:16:59Z), subject `chore: Update CHANGELOG.md` |
| clone | none; the tree is 353 KB and holds no agent source, so it was read through the GitHub API instead |
| package | `@anthropic-ai/claude-agent-sdk` 0.3.306, published 2026-10-21; 328 versions on the registry; 4.78 MB unpacked in 21 files |
| types | https://unpkg.com/@anthropic-ai/claude-agent-sdk@0.3.306/sdk.d.ts (10,267 lines), `sdk-tools.d.ts` (4,222), `bridge.d.ts` (396), `core.d.ts` (22) |
| licence | GitHub licence object is null; root `LICENSE.md` reads "© Anthropic PBC. All rights reserved. Use is subject to Anthropic's Commercial Terms of Service"; npm declares `SEE LICENSE IN README.md` |
| wrapper layout | README, LICENSE.md, CHANGELOG.md (95,936 bytes), CLAUDE.md, `.claude/`, `.github/`, `examples/session-stores/`, `scripts/` |

## Documentation pages read

Fetched as markdown on 2026-10-21 from the base
https://code.claude.com/docs/en/agent-sdk/ ; the package README links the same pages
under docs.claude.com, which serves HTML only, so the markdown endpoints were used.

| page | used for |
|---|---|
| `overview.md` | positioning against CLI, Client SDK and Managed Agents; capability list |
| `agent-loop.md` | loop shape, turns, budget, effort, permission modes, compaction |
| `permissions.md` | six-step evaluation ladder, rules, mode details, callback shadowing |
| `user-input.md` | `canUseTool`, approval responses, the stream-keeping workaround, limits |
| `hooks.md` | hook flow, the 33-event table, matchers, outputs |
| `subagents.md` | definitions, inheritance, invocation, forks, resume, caps |
| `sessions.md` | continue, resume, fork, capture, resume across hosts |
| `session-storage.md` | `SessionStore` contract, dual write, mirror semantics, retention |
| `streaming-output.md` | partial messages, stream event order, cut-stream behaviour, bundled CLI version |
| `mcp.md` | transports, tool search, auth, elicitation, status |
| `cost-tracking.md` | totals, per-model usage, crash recovery, cache tokens |
| `hosting.md` | subprocess model, local-disk state, containers, scaling, cost |
| `secure-deployment.md` | threat model, permission-is-not-a-sandbox, isolation guidance |
| `claude-code-features.md` | settings sources, CLAUDE.md, feature loading |
| `configuration.md` | options composition reference |

Two further pages were listed in the index but not read: `structured-outputs.md` and
`plugins.md`; their claims here rest on the type declarations and the pages above.

## Wrapper files read

- `README.md`, `LICENSE.md`, `CLAUDE.md`, package metadata for 0.3.306.
- `examples/session-stores/README.md` and `examples/session-stores/shared/conformance.ts`
  (213 lines) for the adapter contract and the 13-check suite.
- The git tree listing and the commit metadata, through the GitHub API.

## Commands run

```text
gh api repos/anthropics/claude-agent-sdk-typescript --jq '{spdx: .license.spdx_id, size: .size, branch: .default_branch, pushed: .pushed_at}'
gh api repos/anthropics/claude-agent-sdk-typescript/contents
gh api repos/anthropics/claude-agent-sdk-typescript/git/trees/main?recursive=1
gh api repos/anthropics/claude-agent-sdk-typescript/commits/main
Invoke-WebRequest https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk
Invoke-WebRequest https://unpkg.com/@anthropic-ai/claude-agent-sdk@0.3.306/<file>
Invoke-WebRequest https://code.claude.com/docs/en/agent-sdk/<page>.md
```

## What was not verified

- Nothing was installed, built, executed or type-checked; no query ran.
- The CLI binary, its control protocol frames and its permission engine were not read.
- The npm tarball's JavaScript was not inspected; only its declarations and metadata.
- The Postgres, Redis and S3 adapters were read as examples, not run against a store.
- Changelog claims were not reconciled against the binary; the changelog was used only
  as a size and cadence signal.
- Pricing, retention and commercial-terms statements are vendor text.

## Refresh

Re-fetch the commit, the registry document and the declaration file; the SDK ships
often, so a refresh should re-read `sdk.d.ts` option JSDoc first because that is where
behaviour changes are documented. Re-fetch the pages above from the same base and
compare the lines cited here. The fetched artifacts live under
`reference/competitors/claude-agent-sdk/` and are gitignored; deleting that folder
loses the exact copies the line numbers refer to, so keep it while this record is in
use.
