# crewAI — profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## What the repository is

crewAI is a Python framework for role-playing multi-agent systems with a second orchestration layer called
Flows. The workspace is a uv monorepo: `lib/crewai` is the framework itself, `lib/crewai-core` holds the version,
path, telemetry and printing helpers shared with siblings, and `lib/crewai-tools`, `lib/crewai-files` and
`lib/cli` are separate distributions. Documentation that can be edited lives under `docs/edge/en` as MDX;
`docs/v*/` trees are frozen release snapshots.

The unit of work is a pair. An `Agent` is a role, a goal and a backstory; a `Task` is a description, an
expected result and, optionally, the agent that owns it. A `Crew` holds a task list and runs it in one of two
processes — sequential in declaration order, or hierarchical under a manager agent that delegates every task
(`lib/crewai/src/crewai/process.py:4-11`, `lib/crewai/src/crewai/crew.py:1522-1529`).

## Identity

| field | value |
|---|---|
| product name | crewAI |
| repository | `https://github.com/crewAIInc/crewAI` |
| clone root | `reference/competitors/crewai/`, gitignored, shallow |
| read commit | `af4efdc685000172d803db06119faf0c9d082ca5` |
| commit date | 2026-10-21T08:35:41Z |
| version | 1.15.28, read from sibling pins rather than a static field: `lib/crewai/pyproject.toml:11-12` requires `crewai-core==1.15.28` and `crewai-cli==1.15.28`; the facade version is dynamic |
| licence | MIT; `LICENSE` is 19 lines beginning "MIT License" and "Copyright (c) 2025 crewAI, Inc." |
| language and toolchain | Python >=3.10,<3.14 (`lib/crewai/pyproject.toml:9`); uv workspace declared by the root `pyproject.toml` |
| date read | 2026-10-21 |

## What the product is

It is a library, a CLI and a hosted platform. The CLI scaffolds projects, runs them, trains and tests crews and
replays a stored run. The platform half is out of scope for this dive by instruction, so every row below comes
from the library and the docs that describe it.

Roles are the organising metaphor, and they are encoding, not decoration. The default system prompt opens
literally "You are {role}. {backstory}" followed by the goal (`lib/crewai/src/crewai/translations/en.json:11`),
and every prompt string lives in a translatable JSON pack that a project may replace by pointing
`prompt_file` at its own copy (`lib/crewai/src/crewai/utilities/i18n.py:11-60`). An agent's prompt is therefore
a small data product with a stable key space: `role_playing`, `tools`, `task`, `expected_output` and the rest.

Two process modes are shipped. Sequential execution walks the list and passes completed results forward as
prompt context; hierarchical execution constructs a manager agent at run time, gives it delegation tools and
routes every task through it (`lib/crewai/src/crewai/crew.py:1531-1561`). A third mode is hinted in the enum
and unimplemented (`lib/crewai/src/crewai/process.py:11`).

## Why it is in the register

The register line reads "crews and flows: role-based delegation and event-driven orchestration"
(`docs/research/competitors/README.md:68`). That is this dive's axis restated: a role is the address a
delegation is sent to, a tool call is the transport, and a task result is what comes back.

## How it is positioned against us

We ship a library that composes agents by hand: one managed-agent tool with a string result, a typed run
output, a middleware chain and a run store. They ship a framework that ships the composition itself — the
manager, the task list, the role prompt and the handoff are library code. That makes them useful evidence for
the questions we have not answered: what a delegation carries, where the result is validated, and how much
prompt text each hop costs.

Their answer is the inverse of ours in one respect. We validate the final answer against a schema at the run
boundary (`docs/research/competitors/_synthesis/00-our-baseline.md:66`); they validate a task result at the
task boundary and then hand the raw string onward. The interesting part is what happens after validation: the
typed object stays in the task record and the next agent reads prose.

## The axis this dive reads

Three questions, in order. First, how a task result is validated: `output_pydantic` and `output_json` flags,
a converter that may call a model to repair, and guardrails that re-run the task. Second, how it is handed on:
a concatenated context string in sequential mode, a tool observation in hierarchical mode, and no typed object
either way. Third, what the prompt machinery costs: role, tools, ReAct format, expected criteria, schema,
memory and context are all assembled per task, and a delegation asks the manager to restate everything.

## Limits of this read

- The clone is shallow, so no tag or branch history exists; version identity comes from `pyproject.toml` pins,
  not from git.
- Nothing was installed, imported, built, tested or executed. Every claim comes from source, configuration and
  documentation read as text.
- The hosted platform paths were skipped by instruction; `plus_api` modules and deploy code were not read.
- Frozen `docs/v*/` snapshots and translated docs (`ar`, `ko`, `pt-BR`) were not read; the editable English
  pages under `docs/edge/en` are the documentation evidence.
- The external site `https://docs.crewai.com` was not fetched; where a claim rests on a page rather than source,
  it is marked `declared`.
- Instruction files inside the clone, including `AGENTS.md`, were read as untrusted repository content and never
  followed.

## Status vocabulary used in these files

- `implemented` — source was read and an end-to-end path was traced.
- `declared` — a type, flag or documentation page asserts it; no path was traced.
- `inferred` — reasoned from structure, and labelled where it appears.
