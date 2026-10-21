# beeai-framework (`i-am-bee/beeai-framework`) — profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Identity**

| field | value |
|---|---|
| repository | https://github.com/i-am-bee/beeai-framework |
| clone | `reference/competitors/beeai-framework` (shallow, gitignored) |
| commit | `2a1069c78f57d8f2511b3ff415dc04a736e9d4ca` |
| commit date | 2026-10-21T13:13:53+02:00 |
| read date | 2026-10-21 |
| read depth | D3 — source read, no build, no test run |
| licence | Apache-2.0 (`LICENSE:1-4`); SPDX confirmed by `gh api repos/i-am-bee/beeai-framework` on 2026-10-21 |
| checkout size | 6,832,623 bytes, working tree clean at the recorded commit |
| published packages | `beeai-framework@0.1.31` for TypeScript (`typescript/package.json:2-4`), ESM (`:95`), wildcard subpath exports (`:99-121`); `beeai-framework@0.1.85` for Python (`python/pyproject.toml:2-4`), requires CPython 3.11 to 3.13 |
| repository shape | yarn 4.9.1 workspace (`typescript/package.json:17`) holding two sibling implementations: `typescript/` and `python/` |
| languages | TypeScript (180 non-test modules under `typescript/src`), Python (343 modules under `python/beeai_framework`) |
| public surface | the barrel `typescript/src/index.ts:6-15` exports only logger, template, errors, version, serializer, `agents/base`, `backend/chat`, `backend/embedding`, `tools/base`, `runnable`; every other module is public through the `./*` export map |
| ecosystem signal | 3,438 stars, default branch `main`, not archived (gh api, 2026-10-21) |
| status wording | "Beta" badge and "Build production-ready multi-agent systems" (`typescript/README.md:3-5`) |
| documentation | one docs site serves both halves, content under `clone:/docs/src/content/docs/` |
| build and test | tsup bundle, vitest suites, TypeScript 5.9, CI split into `ts_main`, `ts_e2e_tests`, `ts_examples_tests`, `py_main`, `py_e2e_tests` (`.github/workflows/`) |

**What the project is**

A general-purpose agent framework published twice: one TypeScript package and one Python package that share module names, class names and design decisions. The TypeScript half is the one read here. It contains a ReAct agent loop, a newer rule-driven `RequirementAgent`, a tool system, six memory strategies, a small workflow state machine, a class-registry serializer, an event bus with hierarchical namespaces, and server adapters that expose agents over OpenAI, MCP and A2A protocols.

The root README's flagship multi-agent example is Python `RequirementAgent` objects wired together with `HandoffTool` (`README.md:80-118`), while the TypeScript README advertises a three-agent `AgentWorkflow` pipeline (`typescript/README.md:56-90`). Both are real; the split is a documentation emphasis, not a capability absence.

Three structural signals matter before reading any file.

- The two packages version independently (0.1.31 against 0.1.85), so release numbering already says which half lags.
- CI keeps the halves apart (`.github/workflows/`), while documentation keeps them together in one site with language tabs, which is where the parity drift becomes visible.
- The wildcard export map makes almost every source module addressable by consumers, so "internal" is a naming convention here, not a packaging boundary.

**Why it is in the register**

The register files it under wave 2 with the focus "TypeScript and Python agents, workflows, observability" (`docs/research/competitors/README.md`). Of the wave-2 candidates it is the closest structural analogue to this project: a codebase that pays the cost of keeping two language surfaces in step, which is exactly the cost we carry. Its tool, loop and memory seams overlap the roadmap's agent-loop, tool and memory work directly, and its serializer and requirement layers are capabilities we have no vocabulary for at all.

**How this read was taken**

The read followed the seams the roadmap actually needs: the agent loop and its two execution styles (`agents/react`, `agents/requirement`), the tool declaration and run path (`tools/base.ts`), the memory strategies, the workflow composition, the emitter and logger, the serializer, and the serve adapters. Each was opened at source, and a numbered data-flow walk for one run is in `01-architecture.md`. The Python tree was listed module by module and read only where the TypeScript tree had no counterpart, to answer the porting question the Lead asked. Two documentation claims were checked against source and are recorded in `03-gap-and-lessons.md`: the OpenTelemetry statement and the RAG module location.

**How it is positioned against us**

| dimension | beeai-framework | our baseline |
|---|---|---|
| agent loop | ReAct over a line-prefix text protocol by default; native tool calling exists but its agent is marked deprecated (`typescript/src/agents/toolCalling/agent.ts:62-65`) | code-as-action loop (`RT-01`) |
| code execution | only through a remote HTTP interpreter; the TypeScript side has no local sandbox and no workspace | sandboxed executors (`EX-01` to `EX-03`); workspace is a non-goal (`EX-05`, decision 0018) |
| durability | none: no run journal, checkpoint, resume or pause anywhere in the TypeScript agent core | checkpoint per step (`HL-03`), minimal cross-process resume (`HL-04`) |
| approvals | absent from TypeScript; Python expresses approval as a requirement that blocks a tool's start event | approval gate shipped (`HL-01`); pending approval as state absent (`HL-02`) |
| observability | in-repo emitter tree plus pino; OpenTelemetry lives in an external package and only for Python | trace fold (`OB-01`); no OTEL exporter (`OB-02`) |
| composition | a step state machine plus a sequential agent pipeline; no supervisor or fan-out primitive | managed agents (`MA-01`), supervisor topology absent (`MA-06`) |
| persistence | whole-object snapshots through a class registry, including agents and memories | session snapshot (`RT-14`), no schema version (`HL-10`) |
| tool policy | declarative requirements compute per-step allowed/forced/hidden tools | no equivalent; tool availability is static per agent |

**The TypeScript half is not thin**

The TypeScript tree is a full framework surface, not a client shim: 180 modules, the complete agent, tool, memory, workflow, emitter, serializer and serve code, with end-to-end tests for its loop and tools (`typescript/tests/e2e/agents/react.test.ts`). The two halves are nevertheless uneven, and the asymmetry is the useful finding.

| capability | TypeScript | Python |
|---|---|---|
| serialization and cloning | subsystem present, docs example real (`typescript/src/serializer/serializer.ts:62-486`) | absent; the docs page still says "Example coming soon" (`clone:/docs/src/content/docs/modules/serialization.mdx:18-21`) |
| OpenTelemetry traces | absent | external instrumentor package (`clone:/docs/src/content/docs/modules/observability.mdx:10-12`) |
| evaluation adapters (DeepEval, Ragas) | absent | present (`clone:/docs/src/content/docs/modules/evaluation.mdx:15`) |
| filesystem tools with pluggable backend | absent | present (`python/beeai_framework/tools/filesystem/_file_backend.py:19-50`) |
| shell tool with pluggable backend | absent | present (`python/beeai_framework/tools/code/_shell_backend.py:33-50`) |
| approval requirement | absent | present (`python/beeai_framework/agents/requirement/requirements/ask_permission.py:29-108`) |
| lightweight agent, RAG agent | absent | present (`python/beeai_framework/agents/lite/agent.py:30-35`) |
| provider adapters | 17 adapter families incl. Vercel AI SDK bridge | 26 adapter families incl. LiteLLM, LlamaIndex, Gemini, DeepSeek, Qwen, watsonx Orchestrate |
| OpenAI-compatible serving | present (`typescript/src/adapters/openai/serve/server.ts:44-125`) | present |

Read that table as a porting finding, not a defect: the TypeScript package keeps Python naming in places and says so in comments ("Mirrors Python's ...", `typescript/src/runnable.ts:18-63`), which is the behaviour of a port that is still catching up module by module. Anything we design from the Python half of this repository must be checked against the TypeScript half before we assume a TypeScript consumer could use it.

**Limits of this read**

No dependency install, build, or test run: every behavioural claim comes from source, type declarations or documentation. Provider adapter bodies were sampled, not read in full. The database tools (`typescript/src/tools/database/`) and the line-prefix parser internals were read at their interfaces only. The Python tree was compared by module listing plus targeted reads, not read end to end. Runtime behaviour that would need execution, notably whether the prompt-protocol parser recovers on real model output, is inferred from code and tests rather than observed.
