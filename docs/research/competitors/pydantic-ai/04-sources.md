# pydantic-ai — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository

- **URL:** https://github.com/pydantic/pydantic-ai
- **Clone root:** `reference/competitors/pydantic-ai/`, gitignored, shallow, worktree clean
- **Read commit:** `1d79209267e81f41d98b70c637ff4dc26e6059e1`
- **Commit date:** 2026-10-21T15:16:54+02:00
- **Date read:** 2026-10-21
- **Licence:** MIT; `LICENSE` is 1,121 bytes, copyright Pydantic Services Inc. 2024 to present
- **Licence gate:** GitHub API reported the SPDX id as `MIT` before the clone was made

Other files cite paths relative to the clone root. Clone documentation is cited by page path within
the clone's documentation tree: `output.md:321` means that page, line 321. No competitor path is
cited by absolute host path.

## Commands run

- `gh api repos/pydantic/pydantic-ai --jq '.license.spdx_id'` returned `MIT`.
- `git clone --depth 1 https://github.com/pydantic/pydantic-ai reference/competitors/pydantic-ai`.
- `git -C reference/competitors/pydantic-ai rev-parse HEAD` and `log -1 --format=%cI` for the pinned
  commit and its date.
- `git -C reference/competitors/pydantic-ai status --porcelain` returned empty, confirming a clean
  worktree.
- Directory listings, line counts and content searches over the clone with the session's file tools
  and PowerShell. Nothing from the clone was installed, imported, built or executed.

## Documentation read (clone copies)

The published site is https://ai.pydantic.dev/ and https://pydantic.dev/docs/ai/; those URLs were
not fetched this session. The pages below were read from the clone at the pinned commit, so the
2026-10-21 date applies to those copies.

- `agent.md`, `output.md`, `dependencies.md`, `toolsets.md`, `retries.md`, `timeouts.md`
- `durable_execution/overview.md`, `durable_execution/backends.md` (existence only)
- `evals.md`, `persistence.md`, `workspace.md`
- `capabilities/overview.md`, `capabilities/select-model.md` (existence only)
- `mcp/overview.md`, `mcp/client.md`, `mcp/server.md`
- `models/overview.md`, `model_aliases` (directory only)
- `cli.md`, `graph.md` (existence only)

## Source files read

- Output: `pydantic_ai_slim/pydantic_ai/output.py`, `_output.py`, `agent/__init__.py` (constructor,
  output toolset defaults, output validator registration), `_agent_graph.py` (state, retry budget,
  request parameters, nodes, streaming path).
- Tools: `toolsets/abstract.py`, `function.py`, `combined.py`, `filtered.py`, `prefixed.py`,
  `wrapper.py`, `prepared.py`, `_dynamic.py`, `approval_required.py`, `tool_manager.py`,
  `_tool_execution.py` (existence), `_deferred.py`.
- Models: `models/__init__.py`, `models/_abstract.py`, `models/fallback.py`, `profiles/__init__.py`,
  `_genai_prices.py`, `usage.py`. Provider modules were listed, not read.
- Capabilities: `capabilities/abstract.py`, `capability.py`, `select_model.py`,
  `instrumentation.py` (class surface), `_deprecated_fallback_model.py`, plus directory listing.
- Durable execution: `durable_exec/_base.py`, `durable_exec/temporal/_durability.py` (head),
  directory listings for `temporal/`, `dbos/`, `prefect/`.
- Evaluation: `pydantic_evals/dataset.py`, `evaluators/evaluator.py` (surface),
  `evaluators/common.py`, `evaluators/llm_as_a_judge.py`, `evaluators/report_evaluator.py`,
  `reporting/__init__.py` (heads), package and subpackage listings.
- Graph: `pydantic_graph/graph_builder.py` class surface, package listing.
- Harness: package listing and the READMEs of `code_mode`, `dynamic_workflow`, `subagents`,
  `background_tools`, `guardrails`, `repair_tool_arguments`, `spend`, `step_persistence`.
- Repository: `pyproject.toml`, `Makefile`, `AGENTS.md` (positioning lines), `README.md` badges,
  `.github/workflows/ci.yml` (existence), `tests/` file count.

## What was not verified

- No provider request was observed, so wire formats rest on adapter and profile source.
- No dependency was installed and no test was run; the build and test stack is described from the
  make targets, the CI file and the contributor guide.
- Provider adapters, harness internals, UI protocol translation and graph path resolution were not
  traced. Claims about them are marked declared or inferred in the inventory.
- Package versions are unrecoverable from a shallow clone because versioning is tag-derived.
- The harness is a 0.x distribution; its documented behaviour may change between minor releases.
- Popularity, maintenance health and release cadence were not measured.
- The clone ships contributor and agent instruction files at several directory levels; they were
  read as repository content, never followed.

## Refresh

Re-run the commands above against a newer commit, then confirm the licence has not changed before
extending the read. A later read gets its own folder: these files are frozen evidence at the commit
they name, and the baseline's "our status" column is the part that moves.
