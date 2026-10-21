# pydantic-ai — repository profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

| field | value |
|---|---|
| repository | `pydantic/pydantic-ai` |
| read commit | `1d79209267e81f41d98b70c637ff4dc26e6059e1` |
| commit date | 2026-10-21T15:16:54+02:00 |
| date read | 2026-10-21 |
| licence | MIT, SPDX confirmed through the GitHub API before cloning |
| licence file | `LICENSE`, 1,121 bytes, copyright Pydantic Services Inc. 2024 to present |
| clone | `reference/competitors/pydantic-ai/`, shallow, worktree clean |
| language | Python, `requires-python = ">=3.11"` (`pyproject.toml:48`) |
| build | `uv` workspace, hatchling plus dynamic versioning from git tags |
| register row | tier 1 deep dive, focus structured output, dependency injection, evals, durable execution |

Version identity is not recoverable from a shallow clone: every package reads its version from a
git tag through `uv-dynamic-versioning` (`pyproject.toml:5-8`), and the clone carries no tags.
The documentation describes a 2.x line and ships a v1 to v2 migration page, which is the best
available evidence of the boundary the authors themselves considered breaking.

## What it is

Pydantic AI is a provider-agnostic agent framework for Python, built by the team behind Pydantic
Validation and Logfire. An `Agent` is declared with a model, instructions, tools and an output
type; the framework runs one graph-backed loop that calls the model, executes tools and validates
the final answer. The project states its own taste plainly: a light-weight library, strong
primitives, general extension points rather than batteries (`AGENTS.md:54-56`).

The workspace is split so each concern has an owner package:

| package | role |
|---|---|
| `pydantic_ai_slim/pydantic_ai` | the framework: agent loop, tools, toolsets, output, models, providers, profiles, capabilities, durable execution |
| `pydantic_graph/pydantic_graph` | typed graph runtime the agent loop is built on |
| `pydantic_evals/pydantic_evals` | datasets, evaluators, reports |
| `clai/clai` | terminal client for an agent |
| `src/pydantic_ai_harness` | first-party capability library on top of the core |
| `src/pydantic_clai2` | capability-aware terminal client built on the harness |
| root `pydantic-ai` | metapackage aggregating the workspace and optional provider extras |

A `uv` workspace pins the packages together and resolves them locally. Documentation is a
separate tree with a navigation file that owns routes and redirects, published by a shared
documentation service rather than by the package build.

## Why it is in the register

The register sends a tier 1 dive to a repository whose mature implementation sits on our roadmap.
This one covers four of our open seams at once:

- provider-side structured output and a repair loop, which our baseline records as a declared
  capability flag with nothing behind it (GR-05) and no retry path at all (GR-06);
- dependency injection as a typed, first-class system, a concern our baseline does not name;
- datasets, evaluators and reports, where we ship a single run scored against a fixture (OB-04)
  and nothing resembling a dataset (OB-05);
- durable execution, where we ship step checkpoints and no journal (HL-03 against HL-05).

It also has a v2 API that already absorbed the lessons of its own v1, so the shape of each seam is
visible rather than hypothetical: the current tree contains deprecations, migration notes and
capability-scoped replacements for constructor arguments.

## Positioned against us

The core loop is a tool-calling loop: the model answers with a tool call or a typed final value,
and Python code executes everything else. Code-as-action does exist in their ecosystem, but as an
optional capability rather than as the loop: the harness ships a Code Mode that wraps eligible
tools behind one `run_code` tool and runs model-written Python, including `asyncio.gather`, in a
Monty sandbox, dispatching calls back through the framework (declared,
`src/pydantic_ai_harness/pydantic_ai_harness/code_mode/README.md:13-27`). Ours makes the generated
program the primary step and puts the executor abstraction in the core.

The overlap is the envelope around that difference: a run loop, tools, output validation, model
adapters, usage accounting, persistence and evaluation. That envelope is where a neighbour can
teach us something, because their constraints (a Python process, blocking SDKs, a typed
in-process dependency graph) are the opposite of ours (isomorphic JavaScript, a browser-hostable
core, executor isolation).

Four consequences worth carrying into every file:

1. Their ergonomics come from Python's type system and runtime introspection. A TypeScript port
   can copy the seam, not the mechanism.
2. Their durability story assumes a workflow engine outside the process. Ours cannot, because the
   process may be a tab, so only the journal interface is portable.
3. Their structured output is a first-class plan handed to the adapter. Ours is a per-adapter
   boolean, which is why the feature exists in our types and not on the wire.
4. Their code mode proves the capability shape works for code-as-action: one `run_code` tool, code
   that calls host tools, a sandbox behind it. The difference left to defend is that our loop
   owns the observation cycle, the streaming view and three executor backends.

## Limits of this read

- Read only. Nothing from the clone was installed, built or executed.
- Source first, documentation second. Pages under the documentation tree were read to explain
  intent, never as the sole evidence for behaviour; where a page and the source disagree, the
  source wins and the divergence is recorded.
- Coverage is deliberately uneven. The output pipeline, toolset layer, durable-execution base and
  evaluation data model were read closely. Provider adapters were sampled, not read; 42 provider
  modules plus five private helpers, of which three were opened. The harness, the terminal client and the UI adapters were
  read at directory level only, so claims about them are marked declared or inferred.
- The evaluation reporting layer was read at class-header level: field lists and render options,
  not its rendering internals.
- No provider request was traced against a live API, so every claim about wire format comes from
  the adapter and profile source, not from observed traffic.
- Counts are approximate where stated: 760 files match `tests/test_*.py` under `tests/`; 40
  modules live in the capabilities directory; 42 provider modules sit beside five private helpers.
- Behaviour at a later commit may differ. The tree is pinned at the commit above and the dive is
  frozen there.
