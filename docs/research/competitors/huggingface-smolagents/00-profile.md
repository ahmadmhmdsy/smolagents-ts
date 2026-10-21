# huggingface/smolagents — repository profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Identity**

| field | value |
|---|---|
| Repository | https://github.com/huggingface/smolagents |
| Owner | Hugging Face |
| Licence | Apache-2.0, SPDX id returned by the GitHub licence API on 2026-10-21 |
| Licence file | `LICENSE`, Apache License Version 2.0, read in full before the clone |
| Read commit | `96f33faaf028479119ec8d34507b47694cf14e34` |
| Commit date | 2026-10-06 11:38:53 +0200 |
| Commit subject | Bump doc-builder workflow pin (#2906) |
| Upstream branch | `main`, upstream pushed 2026-10-06T18:35:07Z |
| Version read | `1.27.0.dev0` (`src/smolagents/__init__.py:17`) |
| Language | Python, `requires-python = ">=3.10"` (`pyproject.toml:13`) |
| Packaging | setuptools, one distribution named `smolagents`, two console scripts (`pyproject.toml:139-141`) |
| Documentation | https://huggingface.co/docs/smolagents, built from the repository's own tutorial tree |
| Clone | `reference/competitors/huggingface-smolagents`, gitignored, clean working tree |
| Read on | 2026-10-21, depth D3 |

**What the project is**

smolagents is Hugging Face's Python agent library. One abstract loop,
`MultiStepAgent`, is specialised twice: `CodeAgent` asks the model for a Python
program and runs it in an executor, while `ToolCallingAgent` asks for JSON tool
calls and executes them one by one or in parallel (`src/smolagents/agents.py:1215`,
`:1505`). Both agents share the same memory, planning, callback and result
machinery, which is why a single read covers both.

Around the loop sits a tool ecosystem. A tool is a class with typed attributes
and a `forward` method; a decorator turns a typed function into one; collections
load tools from Hub Spaces, Gradio demos, LangChain and MCP servers
(`src/smolagents/tools.py:106`, `:1061`, `:895`). Tools are data to the prompt
writers: one renderer emits a Python signature for code agents, another emits a
JSON schema for tool-calling agents.

Multi-agent work is composition, not orchestration. A managed agent is exposed
to its manager as a callable tool named and described by the child, and the
child's answer is wrapped in a report before it re-enters the manager's context
(`src/smolagents/agents.py:369`, `:868`). There is no handoff primitive, no
shared blackboard and no supervisor type.

Execution is layered. The default executor is a hand-written AST interpreter with
an import allowlist and operation and time caps, and its own docstring says it is
not a security sandbox (`src/smolagents/local_python_executor.py:1693`).
E2B, Modal, Docker and Blaxel executors run the same code in a remote process
behind a shared abstract base (`src/smolagents/remote_executors.py:53`).

Distribution is Hub-shaped. An agent can be saved as a folder holding its JSON
definition, prompts, tool sources, requirements and a generated Gradio app, then
pushed as a Space and reloaded through a class allowlist
(`src/smolagents/agents.py:892`, `:1010`, `:1160`). The package also ships a CLI
and a Selenium browser demo (`src/smolagents/cli.py:262`,
`src/smolagents/vision_web_browser.py:240`).

**Why it is in the register**

The register names it "the upstream this port follows", and it is the only
repository where bucket E applies. The TypeScript surface copies its result
object, its monitor, its prompt variables and its CLI arguments, so reading the
original tells us which of our shapes are deliberate ports and which are
divergences worth keeping. It is also the cheapest place to see how a mature
Python library solves capabilities we are still designing: managed agents,
planning cadence, step callbacks, tool serialisation, remote executors and a
restricted interpreter.

**How it is positioned against us**

| dimension | upstream | this port |
|---|---|---|
| runtime | CPython process, Python at least 3.10 | TypeScript packages on Node and in the browser |
| action language | Python program or JSON tool call | JavaScript program in a WASM guest or JSON tool call |
| default execution | AST interpreter in process | QuickJS-WASM guest |
| isolation claim | explicitly not a sandbox | the guest is the isolation boundary |
| run state | a memory list in the process, no store | checkpoint after each step through `RunStore` |
| streaming | step objects and raw deltas from one generator | typed event stream |
| telemetry | none in-repo, external OpenInference instrumentor | local span tree, no exporter |
| multi-agent | child wrapped as a tool | the same idea, plus an approval gate |
| distribution | one PyPI package with console scripts | eleven ESM packages behind a facade |
| browser-native core | absent | the differentiator |

**How to read the rest of this folder**

- `01-architecture.md`: layout, abstractions, one run end to end, state, streaming, build.
- `02-features-inventory.md`: capability rows with status, evidence, mechanics and rationale.
- `03-gap-and-lessons.md`: bucketed gaps against baseline row ids, patterns to copy, patterns to avoid.
- `04-sources.md`: commit, licence, URLs, files read, commands run, what was not verified.

**Limits of this read**

- Modules listed in `04-sources.md` were read line by line; `models.py` and
  `local_python_executor.py` were read selectively at provider and AST-operator
  branches, so a few statements there are marked inferred.
- Nothing was installed, built, imported or executed. The tests and documentation
  files are evidence of intent and coverage, not of passing behaviour.
- No container, sandbox or Hub endpoint was exercised; remote execution and Hub
  publishing are read from source and docstrings only.
- MCP support delegates to the external `mcpadapt` package
  (`src/smolagents/mcp_client.py:33`), which is not vendored and was not read.
  Transport details are therefore declared, not traced.
- The clone is shallow, so commit history, release notes and issue threads were
  not available; every "why" answer comes from a docstring, a doc file or the
  shape of the code.
- Line numbers hold only at the read commit. Upstream `main` moves, and the
  version string says this is a development build.
- Upstream documentation is cited by URL rather than by a backticked path,
  because paths in that tree would collide with our own `docs/` validator rule.
- The CLI carries two defects that this port reproduced; they are recorded as
  upstream behaviour in `03-gap-and-lessons.md`, not treated as intended design.
