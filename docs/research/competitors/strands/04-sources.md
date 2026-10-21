# strands-agents/harness-sdk — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository

- URL https://github.com/strands-agents/harness-sdk, read 2026-10-21 at
  `79e0f89b7f927795839daf78ed83e13f9cc83344` (2026-10-21 12:18:36 -0400, subject
  `docs(agent-loop): recommend invocation limits for long-running agents (#5295)`).
- Clone: `git clone --depth 1 https://github.com/strands-agents/harness-sdk reference/competitors/strands`;
  shallow and clean for the whole read, nothing installed or executed.
- Licence: Apache-2.0 from `gh api repos/strands-agents/harness-sdk --jq '.license.spdx_id'` on
  2026-10-21, text at `LICENSE.APACHE`, Amazon copyright at `NOTICE:1`. No file is reproduced here.

## Remote metadata (2026-10-21)

- Repository: https://api.github.com/repos/strands-agents/harness-sdk reports 8,896 stars,
  created 2025-05-14, language TypeScript.
- Releases: https://api.github.com/repos/strands-agents/harness-sdk/releases paginates to 126
  entries. Tag prefixes are `python` 85, `typescript` 20, `harness-cli` 7, `harness-python` 6,
  `harness-typescript` 4, `mcp` 3, `python-wasm` 1; earliest of each major line is
  `python/v0.1.0` (2025-05-16) and `typescript/v1.4.0` (2026-06-01), latest are `python/v1.61.1`
  (2026-10-15) and `typescript/v1.21.0` (2026-10-14).
- npm https://registry.npmjs.org/@strands-agents%2Fsdk: latest `1.21.0`, entry created 2025-11-28.
- PyPI https://pypi.org/pypi/strands-agents/json: latest `1.61.1`, first upload 2025-05-14.

## Documentation

The documentation site was not read. The fetch tool refused with two web providers registered and
neither selected, so only the README and the in-tree guides were available; anything doc-derived
is declared, never implemented. Read: `README.md:39` (product statement and capability list),
`strands-ts/AGENTS.md` (provider pattern, no-sync-facade rule, structured-output divergence),
`strands-py/AGENTS.md` (sync facades, cooperative cancellation, MCP tasks), `harness-ts/AGENTS.md`,
`harness-py/README.md`, `team/designs/0009-mono-repository.md`, `team/designs/0012-strandslator-design.md`,
`team/designs/0020-decision-models.md` and `team/COMPATIBILITY.md`.

## Files read

TypeScript, traced in full or in the cited regions: `src/agent/` (`agent.ts`, `invocation-context.ts`,
`snapshot.ts`, `tool-caller.ts`, `continuation.ts`); `src/types/` (`agent.ts`, `messages.ts`,
`snapshot.ts`, `interrupt.ts`, `lifecycle-observer.ts`, `media.ts`); `src/tools/` (`tool.ts`,
`tool-factory.ts`, `function-tool.ts`, `zod-tool.ts`, `structured-output-tool.ts`, both executors);
`src/hooks/` and `src/middleware/` (`README.md`, `stages.ts`, `types.ts`, `registry.ts`);
`src/interventions/`, `src/plugins/plugin.ts`, `src/models/` (`model.ts`, `streaming.ts`,
`routing/router.ts`, `model-proxy.ts`), `src/retry/`, `src/background-tasks/types.ts`,
`src/session/`, `src/storage/`, `src/multiagent/` (`graph.ts`, `swarm.ts`, `snapshot.ts`),
`src/a2a/` (listing), `src/context-manager/`, `src/memory/`, `src/telemetry/`, `src/vended-tools/index.ts`,
the vended plugin and intervention directories, and the root and package manifests.

Python, only where parity was claimed: `strands-py/src/strands/sandbox/base.py` (the oracle note),
`strands-py/src/strands/models/` (module listing), `strands-py/src/strands/bidi/` (count only).

Not read: the Python agent loop, provider adapters in either language, sandbox implementations,
memory extraction, vended tool bodies, CLI internals, the site and the samples repository.

## Commands run

`gh api` for the licence, repository and paginated releases; `git rev-parse HEAD`, `git status`
and `git log -1` for the checkout; npm and PyPI JSON through `Invoke-RestMethod`; PowerShell file
and line counts with tests excluded; `Select-String` and the read tool over the files above. No
build, test, install or execution of anything from the clone.

## What was not verified

Runtime behaviour of any kind, provider wire formats and error mapping, the harness parity claim
(declared by manifests and READMEs), the inference that evals exist only in Python, the Python-only
bidi and MCP-task surfaces, and every documentation-site statement.

## How to refresh

Re-run the licence projection and the clone into the same path at a newer commit, update this file
and the identity table, then re-read the loop, the stop-reason union, the hook event list, the
middleware README, the session manager and the release metadata. A newer read supersedes this one.
