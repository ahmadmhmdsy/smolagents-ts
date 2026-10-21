# crewAI — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Source citations are relative to the clone root `reference/competitors/crewai/`; a documentation page inside the
clone is written `clone:/docs/edge/en/...`, as explained in `04-sources.md`. Status is `implemented` when a path
was traced end to end and `declared` when only a type, flag or documentation page asserts the behaviour.

## Crew and process model

The framework supplies the composition we leave to the caller: a task list, a dispatcher and two ways to run
it. Both processes end in the same `_execute_tasks` walk, so the difference is only who owns a task when it
starts.

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| role prompt pack | implemented | `lib/crewai/src/crewai/utilities/i18n.py:11-60`, `lib/crewai/src/crewai/translations/en.json:11` | prompts load from a JSON pack; a project may pass `prompt_file` to replace it wholesale | role text becomes data that can be audited and translated |
| agent prompt templates | implemented | `lib/crewai/src/crewai/agent/core.py:279-285` | system, user and response templates can be overridden per agent | teams want their own ReAct wording |
| per-task prompt assembly | implemented | `lib/crewai/src/crewai/utilities/prompts.py:93-130`, `lib/crewai/src/crewai/task.py:1044-1050` | the system side is role, tools and format; the user side adds the description plus the expected criteria | criteria must steer generation before any tool runs |
| sequential process | implemented | `lib/crewai/src/crewai/crew.py:1522-1524`, `lib/crewai/src/crewai/crew.py:1571-1640` | tasks run in declaration order and finished results feed later context | ordering is enough for a fixed pipeline |
| hierarchical process | implemented | `lib/crewai/src/crewai/crew.py:1526-1529`, `lib/crewai/src/crewai/crew.py:1727-1730` | the manager receives every task even when `task.agent` names someone else | a planner can reorder work without editing the list |
| manager construction | implemented | `lib/crewai/src/crewai/crew.py:1531-1562` | built from the i18n role, goal and backstory with two delegation tools and delegation allowed; a supplied manager has tools cleared and the run raises | delegation is the manager's only legitimate action |
| tool injection per task | implemented | `lib/crewai/src/crewai/crew.py:1658-1725` | delegation, code execution, multimodal, app, MCP, memory and file tools are merged into the agent's tools | a role gains capability from configuration, not from a subclass |

## Task model and result

A task is a small record with four kinds of field: what to do, what counts as done, where the result lands,
and what validates it. The interesting part is that the record keeps a typed value beside the text that is
actually handed on.

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| task fields | implemented | `lib/crewai/src/crewai/task.py:150-263` | description, expected output, owning agent, context list, async flag, JSON and pydantic output types, tools, guardrails | one declaration covers execution, handoff and validation |
| task execution | implemented | `lib/crewai/src/crewai/task.py:809-958` | the agent runs, the result is exported to a typed value if requested, a `TaskOutput` is built, then guardrails run | one place owns the boundary between agent text and task result |
| task output record | implemented | `lib/crewai/src/crewai/tasks/task_output.py:15-72` | carries raw text, the pydantic value, a JSON dict, the agent, messages and tool failures | a consumer may need the text, the object or the failure list |
| typed export | implemented | `lib/crewai/src/crewai/task.py:1197-1213`, `lib/crewai/src/crewai/utilities/converter.py:206-274` | the requested model type is applied to the raw string before the record is closed | the producer's contract should hold at the producer |
| crew output | implemented | `lib/crewai/src/crewai/crew.py:1932-1970`, `lib/crewai/src/crewai/crews/crew_output.py` | final output lists per-task outputs, the last raw text, tokens and usage | a caller needs the chain, not only the last answer |

## Handoff and delegation

This is the axis. Sequential handoff is a string built from earlier results; hierarchical handoff is a tool
call that names a coworker. Neither carries a type across the boundary.

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| delegation tool pair | implemented | `lib/crewai/src/crewai/tools/agent_tools/agent_tools.py:16-36` | returns delegate-work and ask-question tools whose descriptions interpolate the crew's role list | the model needs addresses and call shapes |
| delegation schemas | implemented | `lib/crewai/src/crewai/tools/agent_tools/delegate_work_tool.py`, `lib/crewai/src/crewai/tools/agent_tools/ask_question_tool.py` | task, context and coworker fields | a recipient, a job and its background are the minimum payload |
| delegation execution | implemented | `lib/crewai/src/crewai/tools/agent_tools/base_agent_tools.py:46-124` | the role name is sanitised (whitespace, casefold, quotes), matched against the roster, a fresh task is created with a generic expected result and the child's answer returns as text | any listed role is reachable without a separate registry |
| restatement instruction | implemented | `lib/crewai/src/crewai/translations/en.json:58-59` | both tool descriptions say the coworker knows nothing and every necessary detail must be explained | the child cannot read the parent transcript |
| delegation accounting | implemented | `lib/crewai/src/crewai/task.py:1148`, `lib/crewai/src/crewai/tools/tool_usage.py:596-608` | counters increment per coworker when the call is parsed | limits and traces need a per-agent count |
| unknown coworker | implemented | `lib/crewai/src/crewai/translations/en.json:48`, `lib/crewai/src/crewai/tools/agent_tools/base_agent_tools.py:88-108` | a formatted error lists the valid roles instead of raising | a mistyped address should teach the model |
| default sequential context | implemented | `lib/crewai/src/crewai/crew.py:1878-1887`, `lib/crewai/src/crewai/utilities/formatter.py:13-26` | the unspecified sentinel aggregates every earlier raw output, joined by a divider; an explicit list narrows it | later tasks see the whole chain unless told otherwise |

## Validation and repair

Validation happens once, at the producing boundary, and has three layers: ask for the shape in the prompt,
validate strictly, and repair by asking a model when parsing fails. Guardrails are a fourth, heavier layer that
re-runs the task.

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| schema instruction in prompt | implemented | `lib/crewai/src/crewai/agent/utils.py:62-91`, `lib/crewai/src/crewai/translations/en.json:29` | the JSON schema of the requested output type is appended to the task prompt | the model should aim at the shape before validation |
| strict conversion | implemented | `lib/crewai/src/crewai/utilities/converter.py:245-266`, `:277-293` | parse JSON, validate against the model, return a dict for JSON output and an instance for pydantic | a typed task fails closed rather than passing prose |
| partial JSON extraction | implemented | `lib/crewai/src/crewai/utilities/converter.py:296-348` | a regex finds an embedded object, parses leniently and validates it; otherwise conversion falls through | agents wrap JSON in explanation |
| model coercion fallback | implemented | `lib/crewai/src/crewai/utilities/converter.py:351-380`, `:150-174`, `lib/crewai/src/crewai/utilities/internal_instructor.py:14` | a failed parse calls the function-calling model (or the agent's model) with repair instructions, retrying to a cap | a wrong shape costs a second model call, not a run |
| output guardrails | implemented | `lib/crewai/src/crewai/task.py:1327-1440`, `lib/crewai/src/crewai/translations/en.json:55` | validators run in sequence; on failure the task is executed again with the validator error as context, up to `guardrail_max_retries` | a programmatic check is cheaper than a reviewer |
| no typed handoff | implemented | `lib/crewai/src/crewai/crew.py:1883-1887`, `lib/crewai/src/crewai/tasks/task_output.py:15-72` | context joins raw strings; pydantic and JSON values remain on the producing task's record | context is model text, not an object graph |

## Memory

Four legacy memory types were replaced by one class with an LLM in the save path and a scored recall path.
Memory is on by default when configured, saves after every agent finish and injects matches into the next task's
prompt.

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| unified memory class | implemented | `lib/crewai/src/crewai/memory/unified_memory.py:76-165` | one model with scope tree, LLM analysis, recall, consolidation and a single-worker save pool | one store beats four special cases |
| composite recall score | implemented | `lib/crewai/src/crewai/memory/unified_memory.py:100-147` | semantic 0.5, recency 0.3 with a 30-day half-life, importance 0.2; confidence thresholds trigger deeper exploration | relevance is more than cosine distance |
| automatic save and recall | implemented | `lib/crewai/src/crewai/agents/agent_builder/base_agent_executor.py:31-69`, `lib/crewai/src/crewai/agent/core.py:757-823` | a finished answer is distilled into facts and stored; each task prompt gains up to five matches | memory works without user code |
| memory tools | implemented | `lib/crewai/src/crewai/crew.py:1694-1696`, `lib/crewai/src/crewai/translations/en.json:65-66` | recall and save tools are injected whenever memory resolves | automatic selection may be incomplete, so search stays available |
| storage and legacy aliases | implemented | `lib/crewai/src/crewai/memory/unified_memory.py:92-95`, `lib/crewai/src/crewai/memory/storage/factory.py`, `lib/crewai/src/crewai/crew.py:2353-2368` | LanceDB by default or a qdrant-edge backend, a factory for both; reset maps the four old names onto memory | local-first with no server dependency |

## Flows

Flows are the event-driven orchestration layer and the second half of the register line. A flow is a class
whose methods are decorated as start points, listeners or routers; its methods may call crews, so the two
layers compose rather than compete.

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| decorator graph DSL | implemented | `lib/crewai/src/crewai/flow/__init__.py:22`, `clone:/docs/edge/en/concepts/flows.mdx:100-110` | `@start`, `@listen` and `@router` methods form a graph; `or_` and `and_` combine triggers | orchestration that is not a crew |
| flow runtime | implemented | `lib/crewai/src/crewai/flow/runtime/__init__.py:1-7` | a metaclass compiles the decorated methods into a structure and the runtime dispatches listeners | decorators become an executable graph |
| crews as flow nodes | implemented | `clone:/docs/edge/en/concepts/flows.mdx:231,238-240` | a flow method calls `Crew(...).crew().kickoff()`; usage metrics aggregate across every crew | crews are steps inside a larger workflow |
| state and persistence | implemented | `clone:/docs/edge/en/concepts/flows.mdx:88`, `lib/crewai/src/crewai/flow/__init__.py:25` | a typed state object with a generated identity, plus a `persist` decorator | multi-step workflows must resume |

## Durability, evaluation and telemetry

Two durability generations coexist: task-output replay by id and an event-bus checkpoint runtime. Evaluation is
an LLM judge over N runs; training is feedback capture injected into future prompts. Telemetry is OpenTelemetry
spans with privacy-scoped attributes.

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| checkpoint runtime | implemented | `lib/crewai/src/crewai/state/checkpoint_listener.py:1-60`, `lib/crewai/src/crewai/crew.py:995-1015`, `clone:/docs/edge/en/concepts/checkpointing.mdx:8,29,52` | an event listener snapshots crew, flow and agent state; kickoff can start from a checkpoint and fork or restore | a long run should survive a crash |
| replay by task id | implemented | `lib/crewai/src/crewai/crew.py:2101-2141` | stored task outputs reload, the first incomplete task is found and the rest rerun | debugging should not repay for finished work |
| training | implemented | `lib/crewai/src/crewai/crew.py:943-993`, `lib/crewai/src/crewai/agent/utils.py:225`, `clone:/docs/edge/en/concepts/training.mdx:10-14` | human feedback per iteration is pickled and later injected as training data into the prompt | few-shot improvement without fine-tuning |
| testing | implemented | `lib/crewai/src/crewai/crew.py:2299-2344`, `clone:/docs/edge/en/concepts/testing.mdx:10-14,39-45` | N iterations run, an evaluator model scores tasks from 1 to 10, a table is printed | regressions surface before deployment |
| tool cache | implemented | `lib/crewai/src/crewai/agents/cache/cache_handler.py:23-60`, `lib/crewai/src/crewai/tools/tool_usage.py:558-569` | an in-memory dict keyed by tool name and serialised input, guarded by a read-write lock; failed outputs are never stored | identical calls repeat within a task |
| manager shares the cache | implemented | `lib/crewai/src/crewai/crew.py:1556-1561` | the manager receives the crew's cache handler when caching is enabled | delegated calls dedupe with the rest |
| telemetry exporter | implemented | `lib/crewai/src/crewai/telemetry/telemetry.py:69-160,230`, `clone:/docs/edge/en/telemetry.mdx:26,42-49` | a private tracer provider batches OTLP/HTTP spans to a vendor endpoint; environment flags opt out; attributes exclude prompts and record only exception class names | adoption metrics without user content |
| event bus | implemented | `lib/crewai/src/crewai/events/event_bus.py`, `lib/crewai/src/crewai/state/checkpoint_listener.py:1-60`, `lib/crewai/src/crewai/telemetry/telemetry.py:264` | crew, task, agent, flow and memory emit typed events; tracing, telemetry and checkpointing subscribe | one extension point instead of hooks at each call site |

## Tools and tool use

The action space is a tool catalogue plus a ReAct grammar. Selection is by exact name after sanitisation,
arguments are validated against the tool's schema, and failures become typed records instead of exceptions.

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| tool selection | implemented | `lib/crewai/src/crewai/tools/tool_usage.py:810`, `lib/crewai/src/crewai/translations/en.json:52` | a requested name is matched against available tools; a miss returns the valid list as an error | a wrong name should be correctable next step |
| argument validation | implemented | `lib/crewai/src/crewai/tools/tool_usage.py:939`, `lib/crewai/src/crewai/translations/en.json:51-53` | parsed arguments are checked against the tool's schema before the call | a malformed call should not reach the implementation |
| usage limits | implemented | `lib/crewai/src/crewai/tools/tool_usage.py:581-595` | per-tool attempt counts are checked and an exceeded limit becomes a failure result | a looping model must be stopped cheaply |
| typed tool failures | implemented | `lib/crewai/src/crewai/tools/tool_usage.py:587-590`, `lib/crewai/src/crewai/agents/cache/cache_handler.py:23-44` | failures carry a reason and are excluded from the cache | the loop can retry and the cache stays honest |

## Notable implementation notes

The delegation boundary is the sharpest evidence in the read. The child task created by the delegation tool
(`lib/crewai/src/crewai/tools/agent_tools/base_agent_tools.py:112-120`) carries the parent's description and a
one-line generic expectation, with no output type, no guardrail and no context list. The child's `TaskOutput`
is discarded; only the returned string reaches the manager as a tool observation. A typed result therefore
cannot cross a delegation even when the child agent could have produced one.

Prompt cost is cumulative and mostly invisible. One task prompt may contain the role block, the tool catalogue
and ReAct format, the task text, the expected criteria, a JSON schema, retrieved memories and the assembled
context; a hierarchical delegation adds the manager's own role prompt, the delegation tool schemas and a
restatement of the parent context. Only the context length is bounded by a caller-visible setting.

The cache refuses failures deliberately (`lib/crewai/src/crewai/agents/cache/cache_handler.py:23-44`), which
keeps a retry from replaying a stale error. The cost of the choice is that a transient failure is retried at
full price.

Replay and checkpointing are not the same mechanism. Replay trusts stored task outputs and reruns the tail;
checkpointing snapshots state through the event bus and supports fork and restore. Neither makes a mid-task
crash idempotent, because the unit of resumption is a task, not a step.

The prompt pack is a configuration surface, not an implementation detail. Role wording, the ReAct format, the
expected-criteria sentence and the schema instruction all live in `translations/en.json` or in per-agent
templates, so a team can change how delegation is described without touching Python. That also means prompt
cost can drift without a code review diff.
