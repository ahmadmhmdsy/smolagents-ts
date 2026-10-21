# crewAI — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository and read commit

| role | repository | clone root | commit | commit date | version |
|---|---|---|---|---|---|
| the only clone | `https://github.com/crewAIInc/crewAI` | `reference/competitors/crewai/` | `af4efdc685000172d803db06119faf0c9d082ca5` | 2026-10-21T08:35:41Z | 1.15.28 by sibling pins in `lib/crewai/pyproject.toml` |

The clone is shallow (`git clone --depth 1`), so no tag or branch history exists, and it was clean at the
recorded commit. Version identity comes from `lib/crewai/pyproject.toml:11-12`, which requires
`crewai-core==1.15.28` and `crewai-cli==1.15.28`, and from the workspace manifest at the clone root.

## Licence gate

- `gh api repos/crewAIInc/crewAI --jq '.license.spdx_id'` returned `MIT`.
- The clone's `LICENSE` is 19 lines, beginning "MIT License" and "Copyright (c) 2025 crewAI, Inc.".
- No copyleft, no missing licence file, so the read proceeded to a full clone and source-level citations.

## Citation convention

Every citation is inline code, never a Markdown link. A source path is relative to the clone root, for example
`lib/crewai/src/crewai/crew.py:1878`. Documentation pages inside the clone are written `clone:/docs/edge/en/...`
so that no competitor path begins with `docs/`, which the validator would resolve against this repository. A
citation without a line number is a file or directory whose existence and role were checked by listing.

## Files read

Root and build: `pyproject.toml`; `lib/crewai/pyproject.toml`; `lib/crewai-core/src/crewai_core/` (directory
list only); `LICENSE`.

Framework source under `lib/crewai/src/crewai/`: `process.py`; `crew.py` (manager construction, process runners,
task execution, tool injection, context aggregation, replay, test, train, memory reset); `task.py`
(fields, prompt assembly, typed-output export, guardrail retries); `tasks/task_output.py`;
`agent/core.py` (task preparation, memory retrieval, execution); `agent/utils.py` (schema and context
injection, training data); `utilities/prompts.py`; `utilities/i18n.py`; `translations/en.json`;
`utilities/converter.py`; `utilities/internal_instructor.py`; `utilities/formatter.py`;
`utilities/training_handler.py`; `agents/agent_executor.py` and `agents/agent_builder/base_agent_executor.py`;
`agents/cache/cache_handler.py`; `tools/tool_usage.py`; `tools/agent_tools/{agent_tools,base_agent_tools,
delegate_work_tool,ask_question_tool}.py`; `memory/unified_memory.py`, `memory/types.py`, `memory/memory_scope.py`,
`memory/storage/factory.py`; `flow/__init__.py`, `flow/runtime/__init__.py`; `state/checkpoint_listener.py`;
`telemetry/telemetry.py`; `events/event_bus.py`; `crews/crew_output.py`.

Clone documentation under `docs/edge/en/`: `concepts/processes.mdx`, `concepts/flows.mdx`, `concepts/memory.mdx`,
`concepts/checkpointing.mdx`, `concepts/training.mdx`, `concepts/testing.mdx`, `telemetry.mdx`.

## Commands run

`gh api` for the licence gate, retried once after a malformed owner name; `git clone --depth 1`, then `git rev-parse HEAD`, `git log -1 --format=%cI`
and `git status --porcelain` in the clone. File and directory listings established the package split and the
docs trees. Content searches (`Select-String`) located the task fields, the prompt slices, the conversion and
guardrail paths, the memory and cache call sites, and the flow exports. Line counts and file lengths came from
the file tool, not from a shell word count. Nothing was installed, imported, built, tested, executed or
networked beyond the licence gate; no clone code ran.

## External sources

- `https://docs.crewai.com` is the project's public documentation site. It was not fetched; a claim that rests
  only on a documentation page is marked `declared` in these files.
- Every documentation page cited here is a file in the clone, read on 2026-10-21 at the commit above.
- The register row for this dive is `docs/research/competitors/README.md:68` in this repository.

## Untrusted content and limits

The clone contains instruction files written for coding agents, including `AGENTS.md` and its scoped variants.
They were read as repository content, cited only where they describe intent, and never followed; invariant
claims were checked against source. A shallow clone hides release history. No runtime behaviour was observed,
so timing, cost and retry behaviour are inferred from code paths rather than measured. The hosted platform was
skipped by instruction, and frozen or translated documentation snapshots were not read.

## How to refresh

Re-clone at a newer commit, re-run the licence gate, and re-read the files listed above. The stable anchors are
the process enum, the manager construction in `crew.py`, the delegation executor in `base_agent_tools.py`, the
converter and guardrail paths in `task.py`, the prompt pack under `translations/`, and the memory and checkpoint
packages. Findings should survive a minor bump; line numbers will not.
