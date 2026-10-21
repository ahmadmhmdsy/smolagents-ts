# adk-js — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository

- URL: https://github.com/google/adk-js. Read commit
  `df491a96e70c33061aa7aa715ced4f884efa89bb` (2026-10-20 13:17:36 -0700, subject
  `ci: speed up Windows validation workflow (#1111)`), reached with
  `git clone --depth 1 https://github.com/google/adk-js reference/competitors/adk-js`; the worktree
  was clean, shallow and unmodified at the read.
- Licence: Apache-2.0. `LICENSE:2-3` carries the Apache title and version, `package.json:6`
  declares the SPDX id, `LICENSE_SUMMARY.md:7` states the same, and GitHub reports `Apache-2.0`.
- Version: 2.3.0 for the root and all three workspaces (`.release-please-manifest.json`).

## Documentation read

Read in full on 2026-10-21: `README.md` (140 lines: install, packaging, CLI entry points,
key-feature list); `clone:/docs/adk-ts-improvements.md` (134 lines: event-streamed run API,
structured events, HITL confirmations, dynamic instructions, session isolation); and
`LICENSE_SUMMARY.md` (10 lines). Located but not read: the rest of `clone:/docs/`, the samples'
READMEs and the published site at https://adk.dev (mapped from `README.md:16`, never fetched).
Documentation is `declared` evidence unless a source path was also traced.

## Files read

Read end to end or in the cited regions, under `reference/competitors/adk-js/`:

- Entry and packaging: `package.json`, `core/package.json`, `dev/package.json`,
  `vitest.config.ts`, `.release-please-manifest.json`, `core/src/index.ts`,
  `core/src/index_web.ts`, `integrations/src/index.ts`, `README.md`.
- Agents: `core/src/agents/base_agent.ts`, `llm_agent.ts`, `functions.ts`, `run_config.ts`,
  `user_input_request.ts`, `parallel_agent.ts`, `loop_agent.ts`, `remote_agent.ts`,
  `live_request_queue.ts`, and the `processors/agent_transfer_llm_request_processor.ts` and
  `processors/request_confirmation_llm_request_processor.ts`.
- Workflow: `core/src/workflow/base_node.ts`, `workflow.ts`, `request_input.ts`,
  `node_runner.ts`, `utils/hitl_utils.ts`, `nodes/*`.
- Events: `core/src/events/event.ts`, `event_actions.ts`, `structured_events.ts`.
- Sessions and state: `core/src/sessions/session.ts`, `state.ts`, `base_session_service.ts`,
  `in_memory_session_service.ts`, `database_session_service.ts`, `db/schema.ts`,
  `registry.ts`, `vertex_ai_session_service.ts` (head).
- Artifacts and memory: `core/src/artifacts/base_artifact_service.ts`,
  `session_artifact_service.ts`, `scoped_artifact_service.ts`, `in_memory_artifact_service.ts`,
  `file_artifact_service.ts`, `gcs_artifact_service.ts`; `core/src/memory/base_memory_service.ts`,
  `in_memory_memory_service.ts`, `vertex_ai_memory_bank_service.ts` (head).
- Plugins, context and flags: `core/src/plugins/base_plugin.ts`, `plugin_manager.ts`,
  `core/src/context/base_context_compactor.ts`, `core/src/features/feature_registry.ts`.
- Tools: `core/src/tools/base_tool.ts`, `tool_confirmation.ts`, `agent_tool.ts`,
  `finish_task_tool.ts`; code executors by name under `core/src/code_executors/`.
- A2A: `core/src/a2a/agent_to_a2a.ts`, `agent_executor.ts`, `a2a_remote_agent.ts`,
  `agent_card.ts`.
- Evaluation, telemetry and models: `core/src/cli/cli_eval.ts`, `core/src/telemetry/setup.ts`,
  `tracing.ts`, `core/src/models/registry.ts`, `routed_llm.ts`.
- Dev package: `dev/src/cli/cli.ts` (command table), `dev/src/cli/cli_run.ts` (head),
  `dev/src/server/adk_api_server.ts` (imports and route table), `dev/src/utils/agent_loader.ts`
  (head), `dev/src/conformance/conformance_integrations.ts` (head),
  `dev/src/integration/replay_plugin.ts`.
- Tests and CI as evidence of intent: the file inventory under `tests/integration`, `tests/e2e`
  and `tests/cross_language`, plus the workflow names under `.github/workflows/`.
- Repository guidance was treated as content, never obeyed.

## Commands run

`gh api repos/google/adk-js --jq '.license.spdx_id'` (returned `Apache-2.0`); `git clone --depth 1`,
`git rev-parse HEAD`, `git log -1 --date=iso`, `git rev-parse --is-shallow-repository`; PowerShell
directory listings, file-length measurements and `Select-String` searches inside the clone. No
package manager, build, test, install or clone script was run, and no clone file was modified.

## Not verified

- Runtime behaviour beyond the traced path: transfer timing, resume replay and live mode are unobserved.
- The dev API server was read at its imports and route table, not inside its handlers.
- `clone:/docs/` was read only where named above; the published site was not fetched.
- The `integrations` workspace has no shipped code at this commit and was not assessed.
- Test outcomes and coverage numbers: no suite was run, so thresholds are configuration only.
- The Python sibling `google/adk-python` was not cloned; parity claims rest on TypeScript comments
  citing it and are marked as inferred where they matter.

## How to refresh

Re-run the licence check first, then fetch the same slug at a newer commit and re-read the files
listed above, rewriting all five files together. Any path or line that moved must be re-cited rather
than softened. Two changes invalidate more than a line: a change to the event or session schema
(because the gap file prices `HL-04` and `HL-10` from that shape) and a change to the plugin wiring
(because `PLG-06` and `PLG-07` depend on a call-site absence a later commit could fix).
