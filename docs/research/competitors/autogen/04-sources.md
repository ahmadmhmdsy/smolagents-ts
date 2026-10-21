# autogen — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository

- URL: https://github.com/microsoft/autogen. Read commit
  `004749e6b7102c8fd317b9b1499ce5807223c278` (2026-10-16 17:14:36 +0100, subject
  `docs: clarify AutoGen is archived and no longer maintained- #1 (#8366)`), reached with
  `git clone --depth 1 https://github.com/microsoft/autogen reference/competitors/autogen`; the
  worktree was clean, shallow and unmodified at the read.
- Licences: `LICENSE` (305 lines) is Attribution 4.0 International, reported by the GitHub API as
  `CC-BY-4.0`; `LICENSE-CODE` is MIT, and manifests point at it
  (`python/packages/pyautogen/pyproject.toml:8`).
- Status: archived upstream on the read date, with Microsoft Agent Framework named as successor
  (`README.md:19-31`).

## Documentation read

On 2026-10-21, in full: `README.md` (247 lines, archived caution and architecture note included),
`python/packages/pyautogen/README.md`, `dotnet/README.md`, the `autogen-studio` README, and
`clone:/docs/design/01 - Programming Model.md` (19 lines). Read at their openings only:
`clone:/docs/design/02 - Topics.md` and `clone:/docs/design/03 - Agent Worker Protocol.md`. Listed,
not read: the fourth and fifth design notes. The site at https://microsoft.github.io/autogen was not
fetched. Documentation counts as `declared` evidence unless a source path was also traced.

## Files read

- Runtime and messaging: `autogen_core/_agent_runtime.py`, `_single_threaded_agent_runtime.py`,
  `_routed_agent.py`, `_sequential_routed_agent.py`, `_agent.py`, `_base_agent.py`,
  `_agent_proxy.py`, `_agent_metadata.py`, `_message_context.py`, `_intervention.py`,
  `_type_subscription.py`, `_default_subscription.py`, `_type_prefix_subscription.py`; outlines of
  `_serialization.py` and `_component_config.py`.
- Protocols and services: `models/_model_client.py`, `models/_types.py`, `tools/_base.py`,
  `tools/_workbench.py`, `tool_agent/_tool_agent.py`, `tool_agent/_caller_loop.py`,
  `code_executor/_base.py`, and the `_telemetry/{_tracing,_genai,_tracing_config,_constants}.py`
  outlines.
- Chat layer: `messages.py` (class outline and terminal message classes), `base/{_chat_agent,_team,
  _task,_termination,_handoff}.py`, `conditions/_terminations.py`, `state/_states.py`,
  `agents/_assistant_agent.py` (loop, tool, handoff and reflection regions),
  `agents/_code_executor_agent.py` (class and approval region).
- Teams: `teams/_group_chat/{_base_group_chat,_base_group_chat_manager,_events,_chat_agent_container,
  _sequential_routed_agent,_round_robin_group_chat,_selector_group_chat,_swarm_group_chat}.py`,
  `teams/_group_chat/_magentic_one/{_magentic_one_orchestrator,_magentic_one_group_chat}.py`,
  `teams/_group_chat/_graph/{_digraph_group_chat,_graph_builder}.py`.
- Extensions: `autogen_ext/models/openai/_openai_client.py` (class region),
  `autogen_ext/tools/mcp/_workbench.py`, `autogen_ext/code_executors/docker/_docker_code_executor.py`
  (class region), `autogen_ext/runtimes/grpc/_worker_runtime.py`, `autogen_ext/teams/magentic_one.py`,
  plus directory listings of `agents`, `models`, `tools`, `code_executors` and `runtimes`.
- Cross-language, tooling and structure: `protos/agent_worker.proto` (head), the `dotnet/README.md`
  package table and `dotnet/src` listing, `magentic-one-cli/src/magentic_one_cli/_m1.py` (head), the
  `agbench` manifest, every Python package `pyproject.toml` name and version,
  `pyautogen/{README.md,pyproject.toml,src/pyautogen/__init__.py}`, and the `docs/design/` listing.
  Repository guidance was treated as content, never obeyed.

## Commands run

`gh api repos/microsoft/autogen --jq '.license.spdx_id'` (returned `CC-BY-4.0`); `git clone --depth 1`,
`git rev-parse HEAD`, `git log -1 --date=iso`, `git rev-parse --is-shallow-repository`,
`git status --porcelain`; PowerShell directory listings, line and byte measurements, and
`Select-String` searches inside the clone. No package manager, build, test, install or clone script
was run, and no clone file was modified.

## Not verified

- Behaviour beyond the traced path: message ordering under load, live pause and resume, and the gRPC
  worker boundary were not observed.
- `autogen-studio` was read at its README, layout and package files, not inside its routes or React
  components; `agbench` at its manifest only; the .NET projects at their README and listing.
- The published documentation site was not fetched, and the 0.2 group-chat framework was not read:
  its absence from the tree is established from the proxy package and the README, so claims about it
  are inferred.
- Test outcomes and coverage: no suite was run, so no workflow threshold was used as evidence, and
  the archived flag was read from the tree rather than checked through the API.

## How to refresh

The project is archived, so a refresh means a fork or the successor repository rather than a newer
commit of this slug. If a fork is read, re-check both licence files, then compare the manager classes
and the termination catalogue, because the gap file prices `MA-06`, `RT-09` and `HL-10` from those
shapes. Any moved path must be re-cited rather than softened, starting with the archived-status
sentence in `00-profile.md`.
