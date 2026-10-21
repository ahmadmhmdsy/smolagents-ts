# OpenHands — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repositories and read commits

| role | repository | clone root | commit | commit date | version |
|---|---|---|---|---|---|
| runtime | `https://github.com/OpenHands/software-agent-sdk` | `reference/competitors/openhands-sdk/` | `9cb22f553b6cf0de2475563916eead4089b8a6c0` | 2026-10-21T17:39:42+02:00 | `openhands-sdk`, `openhands-tools`, `openhands-agent-server` 1.57.0 |
| client | `https://github.com/OpenHands/OpenHands` | `reference/competitors/openhands/` | `b70dd46bd04158f24ff3906895dcf7d5275ac2aa` | 2026-10-21T13:47:02Z | `@openhands/agent-canvas` 1.29.0 |

Both clones are shallow (`git clone --depth 1`), so no tag or branch history exists; version identity
comes from `pyproject.toml` and `package.json`, and both trees were clean at the recorded commit.

## Licence gates

- `gh api repos/OpenHands/software-agent-sdk --jq '.license.spdx_id'` returned `MIT`.
- `gh api repos/OpenHands/OpenHands --jq '.license.spdx_id'` returned `MIT`.
- Each clone carries a seventeen-line `LICENSE` beginning "MIT License" and "Copyright © 2025
  OpenHands contributors". No copyleft, no missing licence, so the read proceeded to a clone.

## Citation convention

Every citation in these files is inline code, never a Markdown link. The prefix names the clone:
`sdk:` means the path is relative to `reference/competitors/openhands-sdk/`, and `canvas:` means
relative to `reference/competitors/openhands/`. The Canvas documentation tree is written
`clone:/docs/…` so no competitor path begins with `docs/`, which a validator would otherwise resolve
against our own repository. A citation without a line number is a file or directory whose existence
and role were verified by listing, not a line-level claim.

## What came from which clone

The runtime clone supplied `00-profile.md`, `01-architecture.md`, `02-features-inventory.md` and the
gap rows in `03-gap-and-lessons.md` except the four client-contract rows. The client clone supplied
the protocol description in `01-architecture.md`, the rows tagged `canvas` in
`02-features-inventory.md`, and the compaction and child-launch rows in `03-gap-and-lessons.md`.

## Files read

Runtime clone: `README.md`, `AGENTS.md`, `pyproject.toml`; `openhands-sdk/openhands/sdk/event/`
(`base.py`, `condenser.py`, `action.py`, `observation.py`); `context/condenser/` (`README.md`,
`base.py`, `llm_summarizing_condenser.py`, `pipeline_condenser.py`); `context/agent_context.py` and
`context/view/view.py`; `agent/` (`base.py`, `agent.py`, `response_dispatch.py`,
`parallel_executor.py`); `conversation/` (`conversation.py`, `state.py`, `stuck_detector.py`,
`event_store.py`, `persistence_const.py`, `impl/local_conversation.py`);
`conversation/goal/` (`controller.py`, `judge.py`, `runner.py`); `skills/` (`skill.py`,
`trigger.py`); `subagent/` (`AGENTS.md`, `load.py`, `schema.py`, `registry.py`, `scope.py`);
`tool/tool.py`; `workspace/base.py` and `workspace/remote/`; `hooks/types.py`;
`security/analyzer.py`; `openhands-tools/openhands/tools/{delegate,task,child_conversation}/`;
`openhands-workspace/openhands/workspace/docker/workspace.py` and the sibling backend directories;
`openhands-agent-server/openhands/agent_server/` (`event_service.py`, `conversation_service.py`,
`session_socket.py`, `pub_sub.py`, `persistence/models.py`).

Client clone: `package.json`, `LICENSE`, `README.md`, `clone:/docs/architecture.md`,
`src/api/agent-server-adapter.ts`, `src/services/child-conversation-launch.ts`,
`src/hooks/use-await-context-compaction.ts`, `src/stores/use-event-store.ts`, and
`src/utils/{session-seq-cursor.ts,handle-event-for-ui.ts,streaming-delta-batcher.ts}`.

## Commands run

`gh api` twice for the licence gates; `git clone --depth 1` twice; per clone `git rev-parse HEAD`,
`git log -1 --format=%cI`, `git status --porcelain`, and recursive file listings. Line counts came
from the file tool, not from a shell word-count. Greps over the runtime clone located the run-loop
call sites, socket replay handling, skill loader branches and stuck detector thresholds. Nothing was
installed, imported, built, tested, executed or networked, and no clone code ran.

## External sources

- `https://docs.openhands.dev/sdk` is named by the runtime README as the documentation home. It was
  not fetched, so behaviour it alone would prove is marked `declared` in these files.
- Both repositories are public on GitHub; the clone URLs above are the source of record for the read,
  and the read date for every claim is 2026-10-21.

## Untrusted content and limits

Both clones contain instruction files (`AGENTS.md` and scoped variants) written for coding agents
working inside those repositories. They were read as repository content, cited only as documentation
of intent, and never followed as instructions; their invariant claims were checked against source.
No runtime behaviour was observed, only inferred; a shallow clone hides release history; the Canvas
component tree was sampled; hosted and Kubernetes paths were read as configuration without execution.

## How to refresh

Re-clone at a newer commit, re-run both licence gates, re-read the files above and diff the run loop,
the condenser package, the skills loader, the delegate and task tools, and the session socket. The
findings should survive a minor bump; the line numbers will not.
