# openai-agents-js — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository

| field | value |
|---|---|
| URL | https://github.com/openai/openai-agents-js |
| commit | `304e436185ad5d7e54d240896efa728533147cf3` |
| commit date | 2026-10-20 14:56:32 -0700 |
| commit subject | `chore: update versions (#2061)` |
| read date | 2026-10-21 |
| licence | SPDX `MIT`; the file `LICENSE` at the clone root holds the MIT text |
| version | `0.21.0` in the five package manifests |
| clone | `reference/competitors/openai-agents-js`, `git clone --depth 1`, clean worktree at the read |

## Documentation

All pages below were read from the clone's MDX source, not fetched live; the URLs are where the same page is published. The date is when the source was read.

| URL | date | how it was used |
|---|---|---|
| https://openai.github.io/openai-agents-js/ | 2026-10-21 | entry point, environment support and the sandbox quickstart as declared scope |
| https://openai.github.io/openai-agents-js/guides/human-in-the-loop/ | 2026-10-21 | the public approval, serialization and server-owned-snapshot story; read in full |

The other 122 pages were located by file listing only. Any sentence that rests on a doc page rather than a traced path is marked `declared` in `02-features-inventory.md`.

## Files read

| area | files |
|---|---|
| entry and config | `packages/agents-core/src/run.ts`, `runner/steps.ts`, `runner/turnPreparation.ts`, `runner/constants.ts`, `runner/streaming.ts`, `lifecycle.ts`, `model.ts` |
| agent and delegation | `agent.ts`, `handoff.ts`, `agentToolInput.ts`, `agentToolConfiguration.ts`, `runner/toolExecution.ts` |
| guardrails and approvals | `guardrail.ts`, `runner/guardrails.ts`, `runContext.ts`, `errors.ts` |
| state and sessions | `runState.ts`, `runner/sessionPersistence.ts`, `memory/session.ts`, `memory/memorySession.ts`, `packages/agents-openai/src/memory/openaiConversationsSession.ts`, `packages/agents-openai/src/memory/openaiResponsesCompactionSession.ts` |
| tracing | `tracing/processor.ts`, `tracing/provider.ts`, `tracing/spans.ts`, `tracing/config.ts`, `packages/agents-openai/src/openaiTracingExporter.ts` |
| tools and schemas | `tool.ts`, `utils/tools.ts`, `packages/agents-openai/src/tools.ts` |
| results and events | `result.ts`, `events.ts`, `types/protocol.ts` |
| provider adapter | `packages/agents-openai/src/rawModelEvents.ts`, `packages/agents-openai/src/tools.ts`, `packages/agents-openai/src/index.ts` |
| repository meta | `README.md`, `package.json` (root and packages), `packages/agents/src/index.ts`, `.agents/references/README.md` and nine of its references |

Two references were read in full per subsystem before the source: `.agents/references/runner-lifecycle.md`, `run-item-and-stream-lifecycle.md`, `schema-and-zod-boundaries.md`, `tracing-and-runtime-context.md`, `agent-definition-and-run-context.md`, `session-persistence.md`, `conversation-state-ownership.md`, `tool-execution-and-approval-lifecycle.md`, `runstate-schema-and-resume.md`. They are maintainer prose and were treated as evidence of intent, with the source checked where a claim mattered.

## Commands run

- `gh api repos/openai/openai-agents-js --jq '.license.spdx_id, .license.name, .license.url'` — returned `MIT`, `MIT License` and the licence URL. The brief's command had a doubled `openai/` segment; the corrected form above is what ran.
- `git clone --depth 1 https://github.com/openai/openai-agents-js reference/competitors/openai-agents-js`
- `git -C reference/competitors/openai-agents-js rev-parse HEAD`
- `git -C reference/competitors/openai-agents-js log -1 --format='%H %cI %s'`
- `Get-ChildItem` listings and line counts for the clone root, each package's source tree, the examples tree and the docs tree, plus a test-file census.
- File reads and content searches through the harness. No command from the clone was executed.

## What was not verified

- No install, build, type check, test run or example execution. Every runtime statement is a reading of source, types or configuration.
- CI status at the commit, and whether the test suites pass.
- The published npm artefacts at `0.21.0`; the manifest version was read, not the registry.
- `agents-realtime`, the sandbox subsystem and most of `agents-extensions` beyond package scope and dependency declarations.
- Live content of the documentation URLs; only the clone's source was read.
- Whether tests exercise the paths cited; test files were counted, not read.

## How to refresh

1. Fetch the current head: `git -C reference/competitors/openai-agents-js fetch --depth 1 origin main` then `git checkout FETCH_HEAD`, and record the new commit with `rev-parse HEAD`.
2. Re-run the census commands above; a jump in source lines or test files is a signal that a subsystem moved.
3. Re-read the two files most likely to change shape: `runState.ts` for the schema version, `memory/session.ts` for the capability interfaces.
4. Diff the cited pointers. A moved line is not a wrong claim, but a changed constant — the default turn budget, the compaction threshold, the schema version — is.
5. File a superseding read with a new date and commit. These five files stay frozen at `304e4361`; the tree is versioned by the commit it records, not by edits.
