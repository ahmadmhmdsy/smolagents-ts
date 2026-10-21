# huggingface/smolagents — architecture and one run's data flow

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository layout

| path | contents |
|---|---|
| `src/smolagents/agents.py` | 1813 lines: the loop base, `CodeAgent`, `ToolCallingAgent`, prompt dictionaries, step callbacks, save and load |
| `src/smolagents/memory.py` | 316 lines: one dataclass per step kind, the memory container, the callback registry |
| `src/smolagents/models.py` | 2102 lines: message types, role conversion, model base, API models, provider adapters, model registry |
| `src/smolagents/tools.py` | tool base and validation, code rendering, serialisation, decorator, Hub and Space loaders, collection |
| `src/smolagents/local_python_executor.py` | 1768 lines: the AST interpreter and the executor interface |
| `src/smolagents/remote_executors.py` | 902 lines: shared remote base plus E2B, Docker, Modal and Blaxel |
| `src/smolagents/serialization.py` | 514 lines: JSON-first serializer and generated deserializer source |
| `src/smolagents/monitoring.py` | 273 lines: token and timing types, `Monitor`, `AgentLogger`, verbosity levels |
| `src/smolagents/cli.py` | 294 lines: argparse entry point, interactive setup, model factory |
| `src/smolagents/gradio_ui.py` | 389 lines: chat rendering and the `stream_to_gradio` bridge |
| `src/smolagents/prompts/` | YAML prompt templates for the code agent, the tool-calling agent and structured code output |
| `tests/` | pytest suite; the interpreter and agent files are the largest |
| `examples/` | runnable scripts, including plan customisation and a Starlette integration |
| upstream documentation tree | tutorial and reference sources for the published guides |
| `pyproject.toml` | setuptools metadata, one extra per capability, pytest and ruff configuration |

## Core abstractions

**Message boundary.** `ChatMessage` (`src/smolagents/models.py:124`) carries
content blocks, optional tool calls, a token count and the provider's raw payload.
`MessageRole` adds tool-call and tool-response roles to the usual three, and a
conversion table maps those onto each provider's accepted roles when a request is
built (`src/smolagents/models.py:282`). Provider quirks stay at this edge; the
rest of the code speaks one message shape.

**Model.** `Model` is an abstract `generate` plus a `__call__`, `parse_tool_calls`
and `to_dict`; `ApiModel` adds rate limiting, retrying and error classification
(`src/smolagents/models.py:452`, `:1138`). A registry maps a class name to the
class so saved agents reload without importing arbitrary modules
(`src/smolagents/models.py:2070`).

**Tool.** A tool declares `name`, `description`, an `inputs` dictionary, an
`output_type` and a `forward` method. A class decorator validates those
attributes, checks the signature and the type hints, and wraps `forward` so a
call sanitises inputs and outputs (`src/smolagents/tools.py:70-106`, `:144-196`,
`:231`). Two renderers turn the same object into a Python signature or a JSON
schema (`src/smolagents/tools.py:258`, `:289`).

**Loop.** `MultiStepAgent` owns memory, prompts, tools, managed agents, step
callbacks, planning interval, final-answer checks and the executor slot
(`src/smolagents/agents.py:294-352`). It implements the loop and defers
`initialize_system_prompt` and `_step_stream`; the two subclasses fill those in.

**Memory.** Memory is a list of dataclass steps: task, system prompt, action,
planning, final answer. Each step knows how to serialise itself and how to
re-enter the model's context as messages (`src/smolagents/memory.py:42-211`).
`AgentMemory` adds reset, concise and full views, replay and a code extractor
(`src/smolagents/memory.py:214-278`).

**Executor.** A three-method interface: accept tools, accept variables, run a
code string and return output, logs and a final-answer flag
(`src/smolagents/local_python_executor.py:1677-1686`). The local AST interpreter
and every remote executor implement it.

**Callbacks.** A registry keyed by step class, dispatching along the step's method
resolution order and inspecting each callback's arity
(`src/smolagents/memory.py:280-316`). The loop finalises every step through it
(`src/smolagents/agents.py:620-623`).

**Telemetry and presentation.** `Monitor` sums tokens and prints a per-step
metrics line; `AgentLogger` renders tasks, rules, markdown, code, messages and a
tree view at four verbosity levels (`src/smolagents/monitoring.py:81-118`,
`:120-260`).

**Prompt layer.** Templates are Jinja strings held in a typed dictionary, filled
with `StrictUndefined` so a missing variable raises instead of rendering empty
(`src/smolagents/agents.py:102-107`, `:125-192`). Per-agent YAML files are loaded
as resources, and a caller-supplied template set is checked for the required keys
(`src/smolagents/agents.py:316-326`).

## One run, step by step

1. `run(task)` resets the interrupt flag, appends any extra arguments to the
   task text, rebuilds the system-prompt step and, when `reset` is true, clears
   memory and monitor counters (`src/smolagents/agents.py:468-480`).
2. The task becomes a `TaskStep` and is appended to memory; run variables and
   tools are pushed into the executor when one exists (`:488-492`).
3. Iteration is bounded by `max_steps`; the interrupt flag is checked at the top
   of each iteration and raises before any work (`:545-547`).
4. When planning is due, a `PlanningStep` is generated, streamed, finalised,
   timed and appended before the action step starts (`:550-567`).
5. A fresh `ActionStep` carries the step number and start time; the logger writes
   a rule (`:571-576`).
6. `_step_stream` builds messages with `write_memory_to_messages`, sends them to
   the model and parses the reply into a code block or a tool call
   (`src/smolagents/agents.py:1630-1720`, `:1300-1360`).
7. Tool or code execution yields `ToolCall` and `ToolOutput` objects, then the
   observation text and any images are attached to the step
   (`src/smolagents/agents.py:117-121`, `:1410-1480`).
8. A model call for `final_answer` ends the step with an `ActionOutput` whose
   flag is true; optional final-answer checks run before the loop stops
   (`:589-592`, `:613-618`).
9. The `finally` block finalises the step: end time, callbacks, append to memory,
   yield to the consumer and increment the step counter (`:600-604`).
10. A model error of the generation kind is re-raised; every other agent error is
    recorded on the step and the loop continues (`:594-599`).
11. If the budget runs out without a final answer, the agent makes one more model
    call for a forced answer and appends an error-flagged step (`:606-637`).
12. A `FinalAnswerStep` wraps the answer, is finalised and yielded; it has no step
    number and is not stored in memory (`:609-611`, `src/smolagents/memory.py:210`).
13. Without streaming, `run` consumes the generator, totals usage across action
    and planning steps, derives `success` or `max_steps_error` from the last
    step's error, and returns a `RunResult` (`:498-536`).

## State and persistence model

Run state lives in memory and nowhere else. There is no checkpoint store, no
resume token and no per-step record on disk; an interrupted or crashed process
loses the run. `reset=False` reuses the same in-process memory, which is the only
resume story the library offers (`src/smolagents/agents.py:440`, `:477-480`).
The planning step decides "first" versus "update" from the number of steps
already present, so an injected or retained memory produces an update plan
(`:556`, `:643`).

Persistence is about the agent definition, not a run: `save` writes `agent.json`,
`prompts.yaml`, one file per tool, a directory per managed agent, a requirements
file and a generated app (`src/smolagents/agents.py:892-968`). Reload reverses
that through the model and agent registries, and Hub loading demands an explicit
trust flag because tool files are executed (`:1010-1062`, `:1097-1099`).

The serializer is the transport for remote execution, not a state store: JSON with
type tags, pickle refused unless a caller opts in, and a generated deserializer
source string installed in the remote kernel
(`src/smolagents/serialization.py:45-380`, `src/smolagents/remote_executors.py:115-133`).

Known holes in this model, all visible in tests: tool constructor parameters are
not retained by save and reload (`tests/test_agents.py:2440-2442`), callbacks and
final-answer checks are dropped with a warning when serialising
(`src/smolagents/agents.py:970-1008`), and no schema version is written anywhere,
so a reader has no compatibility signal.

## Transport and streaming

The library is a library: it opens no server port and defines no wire protocol.
Streaming is a generator union of model deltas and step objects
(`src/smolagents/agents.py:256`), returned when `stream=True`; consumers see the
same step objects that memory stores, plus raw text chunks as they arrive
(`:494-496`). Model adapters implement delta streams and the agent aggregates
them into a message and a token count (`src/smolagents/models.py:214`,
`:1309`). The Gradio bridge converts a step to chat messages for a browser
(`src/smolagents/gradio_ui.py:96-163`). The CLI always runs with streaming on and
renders through the logger (`src/smolagents/cli.py:240-294`). Remote executors
keep their own channel to the sandbox: a kernel gateway websocket for Docker, a
provider SDK for the hosted services (`src/smolagents/remote_executors.py:551-700`).

Tool output crosses the boundary as text plus images, and the loop truncates long
observations before they reach memory; the browser demo instead mutates older
steps to drop screenshots, which is a token-budget technique rather than a memory
feature (`src/smolagents/vision_web_browser.py:66-80`).

## Build and test stack

Packaging is plain setuptools with a `src` layout and one optional extra per
capability: telemetry, toolkit, Docker, E2B, Modal, Blaxel, MCP, LiteLLM, OpenAI,
Bedrock, Transformers, vision, Gradio, MLX, vLLM and audio, plus aggregate,
test and quality extras (`pyproject.toml:24-93`). Runtime dependencies are small;
provider SDKs are optional by design. Two console scripts are declared
(`pyproject.toml:139-141`).

Tests are pytest with class-based suites for agents, tools, serialisation,
interpreter, monitoring, remote executors and CLI; ruff is configured in the same
file. The telemetry test module skips unless OpenTelemetry and the OpenInference
instrumentor are installed (`tests/test_telemetry.py:26-36`). There is no
benchmark harness in the tree. Nothing in this stack was executed for this read.

## Seams a new capability plugs into

| seam | hook | what plugs in |
|---|---|---|
| prompt templates | a typed dictionary of strings and YAML resources | new prompt sections without touching the loop |
| model | `Model.generate` and `generate_stream` | providers, local runtimes, routers |
| executor | `PythonExecutor` plus the `executor_type` string | local interpreters and remote sandboxes |
| step callbacks | `CallbackRegistry`, keyed by step class | metrics, review gates, screenshotting |
| final-answer checks | callables over answer, memory and agent | verification and policy |
| memory steps | dataclasses with `to_messages` and `dict` | new step kinds that render and persist |
| tools | `Tool` subclasses and the decorator | adapters, collections, generated tools |
| result | `RunResult` with steps, usage, timing, state | evaluation, export, UI history |
| serialisation | `to_dict` and `from_dict` with registries | portable agent definitions |
| CLI | argparse plus an interactive prompt flow | scripted and human entry points |
