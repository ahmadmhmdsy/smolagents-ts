# huggingface/smolagents — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Status is one of three strengths. **implemented** means the source path was traced
end to end; **declared** means a doc example or docstring claims it and no
first-class API backs it; **inferred** means the behaviour is reasoned from
structure only. Every evidence pointer is relative to the clone root at commit
`96f33fa`. Documentation links were read on 2026-10-21.

## The action loop

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| code-as-action step | implemented | `src/smolagents/agents.py:1505-1803`, `:1630-1720` | model reply is mined for a fenced block; the block goes to the executor; log text and return value become the observation | one action language can compose tools and control flow |
| tool-calling step | implemented | `src/smolagents/agents.py:1215-1502`, `:1300-1360` | tools are described as a JSON schema; model tool calls are parsed, executed and answered by role | works with models and tasks that suit one call at a time |
| parallel tool calls | implemented | `src/smolagents/agents.py:1426-1434` | calls run in a thread pool with a copied context and results are re-ordered by call id | wall-clock latency when a step issues independent calls |
| structured action output | implemented | `src/smolagents/agents.py:1546-1547`, `:1657`, `:1690` | an internal JSON schema constrains the action message for the code agent | fewer malformed code blocks on models with schema support |
| step budget and forced ending | implemented | `src/smolagents/agents.py:545`, `:606-637` | after the last permitted step the agent asks for an answer once more and records an error-flagged step | return something usable even when the budget is exhausted |
| final-answer checks | implemented | `src/smolagents/agents.py:613-618` | caller callables receive answer, memory and agent and may raise | a verification hook without a new pipeline stage |
| run result object | implemented | `src/smolagents/agents.py:195-253`, `:506-536` | output, full step dictionaries, timing, summed usage and a two-value state | give callers a record to store, score or render |

## Planning

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| initial plan | implemented | `src/smolagents/agents.py:550-552`, `:643-680` | a first planning call runs before step one, stopped at a terminator, and the plan is fenced into a step | commit to a decomposition before acting |
| plan update | implemented | `src/smolagents/agents.py:681-738` | every N steps the plan is refreshed from a reduced transcript with the remaining budget as a variable | keep direction without replaying the full history |
| summary-mode projection | implemented | `src/smolagents/memory.py:174-183`, `:203-206`; `src/smolagents/agents.py:758-770` | summary mode drops the system prompt and earlier plans from the message list | cheaper, less biasing planning context |
| plan review by a human | declared | `examples/plan_customization/plan_customization.py:62-97`, `:110` | a planning-step callback prints the plan, may rewrite `step.plan`, or cancels the run | approval workflow built from public parts, not a dedicated API |

## Managed agents

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| child exposed as a tool | implemented | `src/smolagents/agents.py:369-387` | the child's name and description become a tool with a task argument; calling it runs the child | composition with no orchestration framework |
| report wrapping | implemented | `src/smolagents/agents.py:868-890`, `:286-334` | the child's answer is inserted into a report template; an optional flag appends a reduced transcript of its work | keep the manager's context compact and uniform |
| nested definitions | implemented | `tests/test_agents.py:2381-2443` | save and load recurse into managed agents, each with its own tool files and prompt file | ship a whole hierarchy as one Space |

## Streaming

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| model delta stream | implemented | `src/smolagents/models.py:214`, `:1309`; `src/smolagents/agents.py:658-670` | adapters yield content deltas and optional usage; the loop accumulates text and tokens | progressive output and one final message for memory |
| run as a generator | implemented | `src/smolagents/agents.py:256`, `:494-496` | a single union type covers deltas, tool calls, tool outputs, steps and the final answer | one iterator drives a console, a notebook or a web UI |
| browser bridge | implemented | `src/smolagents/gradio_ui.py:96-163`, `:248`, `:279-289` | steps and deltas become Gradio chat messages with titles, footnotes and images | a demo UI without a protocol to maintain |

## Callbacks, interrupt and resume

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| typed step callbacks | implemented | `src/smolagents/memory.py:280-316`; `src/smolagents/agents.py:416-434`, `:620-623` | a registry maps step classes to callbacks, walks the class hierarchy and adapts to one or two parameters | observe or alter every step without subclassing the loop |
| metrics as a callback | implemented | `src/smolagents/agents.py:434`, `src/smolagents/monitoring.py:100-118` | the monitor is registered only for action steps and prints durations and token totals | zero wiring for the common case |
| interrupt | implemented | `src/smolagents/agents.py:754-756`, `:546-547` | a flag is raised at the next iteration boundary and becomes an agent error | cancel a runaway loop from a UI thread |
| in-process resume | implemented | `src/smolagents/agents.py:440`, `:477-480` | a second run with reset off keeps the existing memory and appends a new task | continue after a cancellation or a review pause |
| one step at a time | implemented | `src/smolagents/agents.py:782-787` | a public method runs one action step and returns its last yielded object | build custom loops, tests and stepwise UIs |

## Prompts and system messages

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| typed template dictionary | implemented | `src/smolagents/agents.py:102-107`, `:125-192` | Jinja rendering with strict undefined variables, grouped per agent kind and shared sections | fail loudly on a missing variable |
| template resources and overrides | implemented | `src/smolagents/agents.py:316-326`, `:1547-1554` | YAML files load as package resources; a custom set is checked for required keys | customise wording without forking the loop |
| per-agent prompt builders | implemented | `src/smolagents/agents.py:1215-1300`, `:1505-1630` | each subclass fills the variables its template declares, including tool lists and imports | one engine, two very different system prompts |

## Tools

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| tool protocol and validation | implemented | `src/smolagents/tools.py:70-106`, `:144-196`, `:231-251` | class attributes declare schema; a decorator validates names, types and signatures at class creation | catch authoring mistakes before a model sees the tool |
| function decorator | implemented | `src/smolagents/tools.py:1061-1080`; `src/smolagents/_function_type_hints_utils.py:97` | docstring and type hints become the inputs dictionary; the function keeps its source | one-line tools for simple helpers |
| argument validation | implemented | `src/smolagents/tools.py:144-196`; `tests/test_tools.py:954-1050` | declared input types are checked against the call, including nullability | reject bad model arguments with a useful error |
| source serialisation | implemented | `src/smolagents/tools.py:292-359`, `:368-390` | the tool's code is extracted, imports become requirements, and reload executes the source | move a tool definition to disk or a Space |
| loaders for external tools | implemented | `src/smolagents/tools.py:517`, `:600`, `:742`, `:763`, `:895-910` | adapters wrap Hub tools, Spaces, Gradio demos, LangChain tools and MCP servers | widen the tool supply without writing Python |
| trust gate on Hub load | implemented | `src/smolagents/tools.py:521-560`; `src/smolagents/agents.py:1097-1099` | loading code from the Hub refuses unless the caller passes an explicit trust flag | acknowledgement before remote code runs |

## Execution

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| AST walking interpreter | implemented | `src/smolagents/local_python_executor.py:1688-1765`, `:58-60`, `:130`, `:1572` | the tree is evaluated operator by operator with an import allowlist, operation and iteration caps and a final-answer exception | dependency-free execution with a small attack surface |
| executor selection | implemented | `src/smolagents/agents.py:1516`, `:1583-1616` | `executor_type` names one of five implementations; a factory builds it with keyword arguments | local speed or remote isolation from one option |
| remote executors | implemented | `src/smolagents/remote_executors.py:53-135`, `:335`, `:551`, `:726`, `:859` | a shared base installs tool code, ships variables, runs code, raises on errors and cleans up | real isolation while the model stays local |
| Docker kernel path | implemented | `src/smolagents/remote_executors.py:551-700` | a Jupyter kernel gateway runs in a Python image with a generated token and a mapped port | a local container without a cloud vendor |
| interpreter as a tool | implemented | `src/smolagents/default_tools.py:39-80` | the tool-calling agent gets a python tool that wraps the same interpreter | code execution for JSON-style agents |

## State and its transport

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| agent save | implemented | `src/smolagents/agents.py:892-968` | a folder with a JSON definition, prompts, tool sources, nested agents, requirements and an app script | a runnable, inspectable artifact |
| registry-based load | implemented | `src/smolagents/agents.py:1010-1062`, `:1064-1158` | class names resolve through allowlists for models and agents | portable definitions without arbitrary imports |
| Space publication | implemented | `src/smolagents/agents.py:1160-1212` | the saved folder is uploaded as a Gradio Space | one-click sharing of an agent |
| safe serializer | implemented | `src/smolagents/serialization.py:45-380`; `src/smolagents/remote_executors.py:115-133` | JSON with type tags; pickle rejected by default; deserializer source is generated for the sandbox | transfer variables to a remote kernel without pickle |

## Observability and presentation

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| monitor | implemented | `src/smolagents/monitoring.py:81-118` | accumulates per-step durations and input and output token counts | a cheap run summary at the end |
| logger and verbosity | implemented | `src/smolagents/monitoring.py:120-260` | Rich console with task, rule, markdown, code, message and tree renderers plus four levels | readable runs without a UI |
| replay | implemented | `src/smolagents/memory.py:248-277`; `src/smolagents/agents.py:859-866` | memory steps are printed back to the console, optionally with their inputs | post-mortem reading, not resumption |
| telemetry | declared | `pyproject.toml:69-73`; `tests/test_telemetry.py:26-36`; https://huggingface.co/docs/smolagents/tutorials/inspect_runs (2026-10-21) | the extra installs OpenTelemetry plus an OpenInference instrumentor for this library | observable runs without owning an exporter |

## Models and resilience

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| adapters and registry | implemented | `src/smolagents/models.py:1205`, `:1456`, `:2070` | provider adapters share the API base; a registry stores the reloadable ones | one loop over many providers |
| rate limiting and backoff | implemented | `src/smolagents/utils.py:497-560`; `src/smolagents/models.py:1138-1200` | a per-request delay plus exponential retry with jitter, restricted to rate-limit failures | survive provider throttling |
| role conversion and stop support | implemented | `src/smolagents/models.py:282`, `:332`, `:418` | messages are rewritten per provider and stop sequences are dropped for models that reject them | one message shape across incompatible APIs |

## Entry points

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| command line | implemented | `src/smolagents/cli.py:120-294`; `pyproject.toml:139-141` | argparse prompt plus flags, or a Rich questionnaire; two console scripts | a task from a terminal with no code |
| Gradio UI | implemented | `src/smolagents/gradio_ui.py:279-289`, `:422` | a chat interface over the same streaming bridge | a shareable demo |
| browser demo | implemented | `src/smolagents/vision_web_browser.py:66-80`, `:240` | Selenium and helium tools plus a callback that attaches screenshots and prunes older ones | a worked example of callback-shaped observations |
| multimodal return types | implemented | `src/smolagents/agent_types.py:74-140`, `:254-273` | wrappers that behave like text, images or audio and stringify specially | final answers and observations that are not text |
| error taxonomy | implemented | `src/smolagents/utils.py:92-140` | one base error that logs and serialises, with parsing, generation, execution, tool and budget subclasses | retry what the model can fix, raise what it cannot |

## Notable implementation notes

- The loop appends a step in a `finally` block, so a failed step is still
  recorded and still yielded; a generation error is re-raised while other agent
  errors are stored on the step and become the next prompt context
  (`src/smolagents/agents.py:577-604`).
- Planning renders a Rich `Live` display inside the generator rather than in the
  renderer (`src/smolagents/agents.py:662`, `:717`). A consumer that does not
  want UI must tolerate it; a design that separates events from rendering avoids
  this.
- The forced final answer is a separate model call with no tools and no code
  execution; if that call fails, the error text becomes the answer
  (`src/smolagents/agents.py:625-637`, `:810-853`).
- After the forced ending the loop yields the previous action step a second time
  and then the final-answer step (`src/smolagents/agents.py:606-611`). It is
  harmless for a list consumer and visible to a streaming consumer.
- `Monitor` is registered only for action steps, so planning tokens are not in its
  running totals, while `RunResult` sums action and planning steps
  (`src/smolagents/agents.py:434`, `:506-521`). Two accounting paths give two
  numbers for the same run.
- `RunResult.token_usage` becomes null if any action or planning step lacks usage;
  the alternative, partial sums, was rejected (`src/smolagents/agents.py:509-521`).
- Images are stored inside action steps and counted as messages on the next turn;
  the browser demo drops old screenshots by mutating earlier steps
  (`src/smolagents/memory.py:112-124`, `src/smolagents/vision_web_browser.py:71-73`).
- Summary mode is the only context-reduction mechanism in the library: no
  compaction, no summarising model call, no token-budget trimming
  (`src/smolagents/agents.py:684`, `:758-770`).
- The planning prompt is fenced: the plan string embeds the model's raw output in
  a code fence, and the update path also embeds the original task
  (`src/smolagents/agents.py:678-680`, `:736-738`).
- The code agent appends a closing code tag to the model output before storing it,
  so later turns continue from a closed block
  (`src/smolagents/agents.py:1690-1695`, `src/smolagents/utils.py:189-232`).
- Step callbacks support both one-argument and two-argument callables by
  inspecting the signature, and they dispatch through the step's class hierarchy
  (`src/smolagents/memory.py:313-316`).
- The callback type is not part of the serialised agent: a reloaded agent loses
  its callbacks and its final-answer checks, with a logged warning
  (`src/smolagents/agents.py:970-1008`).
- The interpreter's timeout runs the evaluation in a thread that cannot be killed;
  on timeout the caller gets an error but the code keeps running
  (`src/smolagents/local_python_executor.py:298-316`). This is the clearest
  argument against a hand-rolled executor.
- The final answer escapes user code as a `BaseException` subclass so a broad
  `except Exception` in generated code cannot swallow it
  (`src/smolagents/local_python_executor.py:1572-1581`).
- Two CLI defects are upstream behaviour rather than design: the interactive action
  type answer is overwritten with `"code"` and the interactive menu offers a model
  class the factory does not handle (`src/smolagents/cli.py:158`, `:168`,
  `:195-216`).
- Managed agents cannot use a remote executor in the same run, because the child's
  model call would happen inside the sandbox without credentials; the documented
  workaround is to run the whole agent there
  (https://huggingface.co/docs/smolagents/tutorials/secure_code_execution, 2026-10-21).
