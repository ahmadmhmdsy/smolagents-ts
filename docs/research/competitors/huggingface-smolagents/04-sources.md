# huggingface/smolagents — sources for this read

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository and read point

| item | value |
|---|---|
| Repository | https://github.com/huggingface/smolagents |
| Commit | `96f33faaf028479119ec8d34507b47694cf14e34` |
| Commit date | 2026-10-06 11:38:53 +0200, subject "Bump doc-builder workflow pin (#2906)" |
| Version string | `1.27.0.dev0` (`src/smolagents/__init__.py:17`) |
| Clone | `reference/competitors/huggingface-smolagents`, shallow `main`, clean tree |
| Read date and depth | 2026-10-21, D3 |

## Licence

The GitHub repository endpoint returned SPDX id `Apache-2.0` on 2026-10-21, and
the `LICENSE` file at the commit is the Apache License, Version 2.0, read in full.
That permits a full source read. Nothing was copied: no source file, licence header, prompt template or long comment block entered this repository.

## Documentation URLs, read 2026-10-21

Pinned to the commit so the text matches the clone; read from the clone's own
documentation sources.

- https://github.com/huggingface/smolagents/tree/96f33faaf028479119ec8d34507b47694cf14e34
- https://github.com/huggingface/smolagents/blob/96f33faaf028479119ec8d34507b47694cf14e34/docs/source/en/tutorials/inspect_runs.md
- https://github.com/huggingface/smolagents/blob/96f33faaf028479119ec8d34507b47694cf14e34/docs/source/en/tutorials/memory.md
- https://github.com/huggingface/smolagents/blob/96f33faaf028479119ec8d34507b47694cf14e34/docs/source/en/tutorials/secure_code_execution.md
- https://huggingface.co/docs/smolagents, the published site generated from that tree

## Files read

Complete reads: `src/smolagents/agents.py`, `memory.py`, `monitoring.py`,
`serialization.py`, `cli.py`, `gradio_ui.py`, `mcp_client.py`, `agent_types.py`,
`default_tools.py`, `__init__.py`, `vision_web_browser.py`, and `pyproject.toml`.

Targeted reads in `tests/` (`test_agents.py`, `test_monitoring.py`,
`test_serialization.py`, `test_tools.py`, `test_local_python_executor.py`,
`test_mcp_client.py`, `test_gradio_ui.py`, `test_telemetry.py`) and the plan
customisation example.

Sampled regions: `local_python_executor.py` limits and interface (operator
branches sampled), `remote_executors.py` base and four executor heads,
`models.py` messages and one streaming adapter, `utils.py`, and `tools.py`
validation, rendering and loader entry points.

Not read: GitHub workflows, issue templates, changelog and release notes, the
example tree beyond the plan example, and the external `mcpadapt` package.

## Commands run

- `gh api repos/huggingface/smolagents --jq '.license.spdx_id'`; the drafted form
  with a doubled owner segment returned HTTP 404, so the corrected form is the one
  recorded.
- `git clone --depth 1 https://github.com/huggingface/smolagents reference/competitors/huggingface-smolagents`.
- `git -C reference/competitors/huggingface-smolagents rev-parse HEAD`.
- `git -C reference/competitors/huggingface-smolagents status --short`.
- Read-only listing and text inspection through the agent's file tools.

No install, build or test ran, and the clone was not modified.

## What was not verified

- Whether the suite passes; tests record intent, not current behaviour.
- Hub loading, Space pushing and the trust gate, all read but not exercised.
- Remote execution: no container or sandbox started, so latency, cleanup and
  failure handling are unmeasured.
- MCP behaviour, delegated to an unread external package.
- Telemetry export shape, since no instrumentor or OpenTelemetry stack was
  installed.
- Parallel tool calls, the thread-based timeout, and every example script.
- Any performance, cost or reliability comparison; nothing was benchmarked.

## How to refresh this read

1. Fetch a newer commit into the existing clone rather than cloning again.
2. Record the new commit, date and subject before reading anything else.
3. Diff old against new, and re-read only the modules whose cited lines moved.
4. Re-verify each claim whose pointer changed, and delete a claim whose evidence
   disappeared rather than softening it.
5. Re-run the licence check if ownership or the licence file changed.
6. File a superseding record instead of editing this frozen one; the Lead decides
   which read the synthesis uses.
