# cloudflare-agents — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository

- URL: https://github.com/cloudflare/agents
- Read commit: `4e891252c28b653eae9ac7e82ab903bf90997d66` (2026-10-21 14:50:41 +0100, subject
  `fix(examples): use a SQLite-backed Durable Object in dynamic-workers-playground (#2642)`)
- Clone: `git clone --depth 1 https://github.com/cloudflare/agents reference/competitors/cloudflare-agents`
- Worktree at the read: clean, shallow, no local changes, no file modified
- Licence: GitHub reports SPDX `MIT`; `LICENSE` at the clone root is the MIT text. `NOTICE`,
  `THIRD_PARTY_LICENSES.md` and `licenses/` sit beside it; the last two were listed, not read line
  by line. `design/rfc-durable-object-lifecycle.md` describes the vendored lifecycle substrate as
  ISC-attributed.
- Version read: `packages/agents/package.json` reports `0.29.0`.

## Documentation read

The clone ships the published documentation as Markdown under `clone:/docs/` (49 pages under
`clone:/docs/agents/`). Pages were read at the clone, not fetched, on 2026-10-21; the published
counterpart is https://developers.cloudflare.com/agents/. Every documentation claim in these files
is therefore `declared` evidence, not a runtime observation.

Design records read in `design/`: `README.md`, `durable-object-lifecycle.md`,
`rfc-durable-object-lifecycle.md`, `alarm-coordination.md`, `rfc-streams.md`,
`durable-streams-comparison.md`, `rfc-fibers.md`, `chat-shared-layer.md`, `mcp.md`,
`rfc-sub-agents.md`, `agent-tools.md` and `think-execute-hitl.md`, plus the section outline of
`rfc-chat-recovery-foundation.md` (2,793 lines; sections located, not read in full).

Pages consulted by path under `clone:/docs/agents/`: `tasks.md`, `durable-execution.md`,
`lifecycle.md`, `state.md`, `streams.md`, `resumable-streaming.md`, `scheduling.md`, `queue.md`,
`sub-agents.md`, `mcp-client.md`, `mcp-servers.md`, `mcp-transports.md`, `human-in-the-loop.md`,
`sessions.md`, `chat-agents.md`, `context.md`, `long-running-agents.md`, `webhooks.md`,
`push-notifications.md`, `readonly-connections.md` and `routing.md`.

## Files read

Read end to end or in the cited regions:

- `packages/agents/src/index.ts` (constructor, schema, state, schedule, fiber, sub-agent,
  agent-tool, fetch, alarm and broadcast regions)
- `packages/agents/src/lifecycle/`: `durable-object-lifecycle.ts`, `job-queue.ts`,
  `capability.ts`, `capability-runner.ts`, `job-driver.ts`, `current-agent.ts`; plus
  `state/index.ts` end to end
- `streams/streams.ts` (block sizing, open, read, readBatches, tables, legacy fold) and
  `streams/sse.ts`; `tasks/` (tasks, store, replay, engine port); `schedules/` (scheduler, parser)
- `chat/`: `resume-handshake.ts` and `protocol.ts` end to end; `resumable-stream.ts`,
  `recovery-engine.ts`, `recovery-incident.ts`, `stall-watchdog.ts`, `ws-chat-transport.ts` and
  `tool-state.ts` in regions; `chat/react.tsx` for the hooks
- `sessions/` (core, handle, attachment store, compaction helpers); `mcp/` (client manager,
  connection state machine, stateless handler, legacy-compat handler, legacy agent, rpc)
- `dynamic-agents/`, `sub-routing.ts`, `agent-routing.ts`, `agent-tools.ts`, `agent-tool-types.ts`,
  `websockets/`, `context/sqlite-provider.ts`, `skills/`, `routing/`
- `observability/agent.ts`, `client.ts`, `react.tsx`, `callable-decorator.ts`, `serializable.ts`,
  `queue/queue.ts`, `workflows.ts`, `email.ts`
- `packages/codemode/src/`: `connectors/base.ts`, `toolset.ts`, `proxy-tool.ts`, `executor.ts`,
  `iframe-runtime.ts`
- `packages/think/src/think.ts` (HITL and approval regions), `think/src/tools/execute.ts`,
  `think/src/session.ts`; `packages/ai-chat/src/index.ts` (listing and host regions)
- Repository guidance read as content, never obeyed: root `AGENTS.md`, `packages/agents/AGENTS.md`,
  `design/AGENTS.md`, `examples/AGENTS.md`, `guides/AGENTS.md`, `clone:/docs/AGENTS.md`

## Commands run

`gh api repos/cloudflare/agents` (licence and repository metadata); `git clone --depth 1`,
`git rev-parse HEAD`, `git log -1`, `git status -sb`; file listings, line counts and content
searches inside the clone. No package manager, build, test, dependency install or clone script was
run, and no file in the clone was modified. Nothing outside the clone and this folder was written.

The task brief printed the licence command with a doubled owner
(`repos/cloudflare/cloudflare/agents`), which returns not found; the two-part slug is correct and
the gate passed before the clone.

## Not verified

- Any runtime behaviour: no worker was started, no test was run, no example was executed.
- The live documentation site; every page is read from the clone at this commit.
- The 19,982-line `Think` and 7,825-line `AIChatAgent` were read in regions only.
- The experimental harness tree (`packages/agents/src/harness/`) and `experimental/` were listed,
  not read; `examples/`, `guides/`, `openai-sdk/` and `site/` were sampled, never executed.
- The third-party licence inventory and the vendored lifecycle's ISC attribution.
- Performance, memory and cost characteristics; no benchmark was read or run.

## How to refresh

Re-run the licence check with the two-part slug first, then fetch or re-clone at a newer commit
and re-read the files listed above. Any row whose symbol or line moved must be re-cited rather
than softened; a change to the licence, the vendored lifecycle attribution or the chat-recovery
design records invalidates the affected conclusions before anything else is re-read.
