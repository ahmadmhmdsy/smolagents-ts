# pydantic-ai — feature inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Status vocabulary: `implemented` means the source was read and the path traced; `declared` means a
type, flag or page claims it without a traced path; `inferred` is reasoning from structure. Paths
are clone-relative; a page name without a directory belongs to the clone's documentation tree.

## Typed output and structured output

| capability | status | evidence | how it works |
|---|---|---|---|
| typed `output_type` covering scalars, containers, dataclasses, models, functions, unions | implemented | `output.py:103-509` | the type is compiled into an `OutputSchema` and processors, at agent construction |
| tool output, the default path | implemented | `output.py:103-177`, `_output.py:1496-1632` | the output schema becomes the parameter schema of a synthetic tool the model calls |
| native output, provider-side JSON schema | implemented | `output.py:180-233`, `output.md:321-327` | the adapter sends the schema on the provider's structured-output channel |
| prompted output, schema in instructions | implemented | `output.py:237-305`, `profiles/__init__.py:40-49` | a template puts the schema in the prompt and the reply text is parsed |
| text output escape hatch | implemented | `output.py:351-379` | a marker turns a string output back into plain text rather than a tool call |
| image output | declared | `_output.py:260-297` | an image part is accepted as the final value |
| one output tool per output type | implemented | `_output.py:1496-1632`, `output.md:331` | multiple types get separate tools so no single schema grows unbounded |
| union output encoding | implemented | `_output.py:1118-1210` | a discriminated `kind`/`data` envelope keeps union branches unambiguous |
| non-object schema envelope | implemented | `_output.py:870-1014` | primitives are wrapped under a key and validated leniently on the way back |
| structured dictionary | implemented | `output.py:382-446` | a dict subclass carries an inline JSON schema for models without native models |
| choice sets | implemented | `output.py:450-546` | a fixed key set is offered with descriptions; the chosen action then runs |
| output functions with run context | implemented | `_output.py:359-440`, `output.md:276-317` | the function is called after schema validation, may be async, and may retry |
| output validators | implemented | `agent/__init__.py:2670-2724`, `_output.py:409-440` | decorated functions validate or transform the parsed value, with or without deps |
| validation retry loop | implemented | `_output.py:385-394,130-219` | a `ModelRetry` becomes a retry prompt; the budget is spent on graph state |
| automatic mode selection | implemented | `_agent_graph.py:1080-1112` | `auto` resolves to a mode from the model's profile and the chosen mode is remembered per model |
| capability gating for output | implemented | `profiles/__init__.py:63-120`, `models/__init__.py:2566-2606` | profile flags decide which mode is legal and whether return schemas travel natively |

Output is treated as a compiler problem: the declared type produces a plan (mode, schema, tools,
processors), the adapter receives the plan, and the loop owns the retry decision. Two details carry
most of the design weight. First, non-object and union outputs are always wrapped into an object
before they reach a model, because tool-argument and JSON-schema support is object-shaped almost
everywhere. Second, the retry budget is separate from tool-call retries, so a model that keeps
answering with a bad schema fails with a distinct error instead of exhausting the tool budget.

The leniency is deliberate. Partial structured output during streaming is validated with a
trailing-strings tolerant parse (`_output.py:973-990`), and an object-typed output is accepted from
either the validated branch or its JSON text form, which is what lets a provider that returns
stringified JSON still satisfy the same output type.

## Dependency injection

| capability | status | evidence | how it works |
|---|---|---|---|
| typed dependencies declared on the agent | implemented | `agent/__init__.py:593`, `dependencies.md:7-13` | `deps_type` is a type only; the value is supplied per run |
| `RunContext` as the injection carrier | implemented | `_run_context.py:177-1,061` | tools, validators, instructions and hooks receive the context and read `ctx.deps` |
| dependencies rendered into instructions | declared | `dependencies.md` | template strings can interpolate dependency fields at run time |
| test-time substitution | implemented | `agent/__init__.py:2221` | `agent.override` swaps model, toolsets and deps for a scope |

This concern has no row in our baseline, and it is bigger than convenience. Because the dependency
type is declared once, every extension point that runs user code has the same first argument, and a
test can substitute it without touching the agent. The context doubles as the observation surface:
the same object carries usage, limits, retry state and the tool identity, so a tool can read the
budget it has left without a side channel.

## Toolsets and tool execution

| capability | status | evidence | how it works |
|---|---|---|---|
| toolset as a lifecycle object | implemented | `toolsets/abstract.py:85-160` | run and step hooks, async enter/exit, list tools, provide instructions, call a tool |
| tool definition bound to validation and retries | implemented | `toolsets/abstract.py:51-82` | `ToolsetTool` carries the definition, arg validator, retry limit and callable |
| function toolset configuration | implemented | `toolsets/function.py:75-157` | retries, timeout, docstring format, strictness, sequential flag, metadata, id, instructions |
| composition wrappers | implemented | `toolsets/combined.py:25-97`, `filtered.py`, `prefixed.py`, `prepared.py`, `wrapper.py` | filter, rename, prepare definitions, wrap calls, combine with conflict detection |
| approval-required wrapper | implemented | `toolsets/approval_required.py:16` | a predicate marks calls that must be approved before execution |
| dynamic toolset | implemented | `toolsets/_dynamic.py:75-118` | the factory is re-evaluated per run step, with enter/exit transitions managed |
| toolset instructions | implemented | `toolsets/abstract.py:157`, `function.py:149-157` | a toolset contributes prompt material alongside its tools |
| name-conflict detection with remedy | implemented | `toolsets/combined.py:65-91` | duplicate names raise with a hint to the prefixing wrapper |
| retry resolution chain | implemented | `agent/__init__.py:798-807`, `tool_manager.py:272` | tool, then toolset, then run context default |
| validation separated from execution | implemented | `tool_manager.py:161-199` | a validated call records args, verdict, and any deferral before anything runs |
| end strategies for one response | implemented | `_agent_graph.py:145-172` | early, graceful and exhaustive strategies decide what runs after a valid output |
| deferred and approval-required calls | implemented | `_deferred.py:28,159`, `toolsets/approval_required.py:16` | a call can suspend the run and be answered by a later run with results |
| provider-native tools | declared | `profiles/__init__.py:14`, `capabilities/native_tool.py` | a native tool is passed to the provider instead of being executed locally |
| tool search and deferred loading | declared | `capabilities/_tool_search.py`, `toolsets/_tool_search.py` | tools can be withheld until discovered, then revealed |
| per-tool timeout | declared | `toolsets/function.py:75-157` | a timeout wraps the call |

The interesting move is that a toolset is the unit of composition for four different things at
once: tools, instructions, lifecycle, and model-visible definitions. That is why the same wrapper
machinery serves approval, deferral, prefixing, filtering and definition rewriting without the
agent knowing about any of them. A tool is not a function plus a schema; it is a definition, a
validator, a callable and a policy, and the manager owns the policy.

## Durable execution

| capability | status | evidence | how it works |
|---|---|---|---|
| durability as a capability | implemented | `durable_exec/_base.py:287-419` | the engine is an `AbstractCapability` bound to one agent |
| journaling at I/O boundaries | implemented | `_base.py:204-243`, `durable_execution/overview.md:7` | model requests and wrapped tool calls become named durable operations |
| one engine per agent | implemented | `_base.py:312-314` | binding a second engine raises rather than silently taking over dispatch |
| model rebuilt from an identifier | implemented | `_base.py:290-303` | only a model id string crosses the boundary, resolved back through the capability chain |
| engine backend tiers | declared | `durable_exec/_operation_backend.py` | callable backends execute a supplied callback; registered backends pre-register handlers |
| eight shipped engines | declared | `durable_execution/overview.md:12-25` | Temporal, DBOS, Prefect, Restate, AWS Lambda, Absurd, pgtask, Airflow |
| engine-specific constraints | implemented | `durable_exec/temporal/_durability.py:84-120` | heartbeat defaults, serialization failures surfaced as user errors, image output rejected |
| durability separated from snapshotting | declared | `durable_execution/overview.md:9-10` | a harness capability snapshots settled steps for later resume or fork |
| workspace routing across the boundary | declared | `_base.py:388-392`, `workspace.md` | a workspace is selected once and its calls are durable operations |

Durable execution is the clearest case of the project's taste for one primitive over many
features. The capability owns the model registry and the round trip; an engine supplies a backend;
the base owns naming, cache identity, codec choice and replay semantics. That is why eight engines
exist without eight forks of the agent loop, and why the same seam accepts a third-party engine
without importing internals. The cost is that a new engine author must understand cache identity
and replay determinism, which the repository's own guide treats as a compatibility contract.

## Evaluation

| capability | status | evidence | how it works |
|---|---|---|---|
| case and dataset model | implemented | `pydantic_evals/pydantic_evals/dataset.py:105,172,276` | named cases with inputs, expected output, metadata, per-case evaluators |
| dataset evaluation run | implemented | `dataset.py:276-316` | concurrency limit, retries for task and evaluators, repeat count, lifecycle hooks |
| evaluator protocol and built-ins | implemented | `evaluators/evaluator.py`, `evaluators/common.py:33-367` | equals, contains, instance, duration, LLM judge, GEval, span matching |
| LLM-as-judge with graded output | implemented | `evaluators/llm_as_a_judge.py:174-572` | a judge model returns a score plus reason through a typed grading schema |
| report with rendering and baseline comparison | implemented | `reporting/__init__.py:334,413-438` | cases, failures, analyses, averages; render against a baseline report |
| report evaluators | implemented | `evaluators/report_evaluator.py:40` | experiment-wide analyses computed over the full report |
| online evaluation | declared | `online.py`, `online_capability.py`, `_otel_emit.py` | a capability evaluates live runs and emits results to OTel |
| evaluator registry from configuration | declared | `dataset.py:1306-1348` | evaluators can be named and loaded from a registry in serialized datasets |

The report is the product, not the evaluator. Cases carry expected output and metadata, evaluators
return named scores, labels or metrics, and the report aggregates them with per-case grouping when
a case ran multiple times. Baseline comparison is built into rendering, which is what turns a pile
of scores into a regression signal.

## Observability and cost

| capability | status | evidence | how it works |
|---|---|---|---|
| instrumentation as a capability | implemented | `capabilities/instrumentation.py:98-183` | a capability wraps run, model request, tool execution and output processing |
| spans for model and tool work | implemented | `instrumentation.py:407,608,697` | hooks create and annotate spans for each phase |
| content in traces is gated | declared | `RunContext.trace_include_content` | prompt and response content is opt-in |
| token accounting | implemented | `usage.py:125-160` | per-request and per-run usage with lower-bound flags when extraction is partial |
| cost accounting | implemented | `usage.py:156-160`, `_genai_prices.py:1-29` | best-effort USD cost from a pricing snapshot; unknown stays distinct from zero |
| cost and token limits | implemented | `usage.py:514-521` | run limits cover tokens, cost and request count, checked before a request |

Cost is a first-class field rather than an afterthought: the usage object carries an optional
decimal cost, the pricing snapshot is preloaded at model construction, and limits can stop a run on
spend. A rejected fallback response still bills, and the documentation says so, which is the kind
of honesty an accounting layer needs.

## Models, profiles and providers

| capability | status | evidence | how it works |
|---|---|---|---|
| model identity contract | implemented | `models/_abstract.py:18-99` | name, system, base url, id, context window |
| model request pipeline | implemented | `models/__init__.py:524-720` | settings merge, profile resolution, message preparation, request execution |
| request parameter contract | implemented | `models/__init__.py:206-312` | tools, output mode, instruction parts, thinking and cache settings travel as one object |
| capability facts per model family | implemented | `profiles/__init__.py:55-120` | optional booleans for tools, native JSON schema, image output, caching, thinking |
| provider adapters | implemented | `providers/` | one module per provider family, owning client, auth and error mapping |
| model name inference | implemented | `models/__init__.py:1969,2070` | a string id resolves to a provider, model class and profile |
| fallback model | implemented | `models/fallback.py:99-346`, `models/overview.md:389-401` | ordered candidates, exception and response handlers, stream-until-first-event |
| dynamic model selection | implemented | `capabilities/select_model.py:11-22` | a selector runs before each request step and may return a model or an id |
| request deadlines | declared | `models/_request_timeout.py`, `timeouts.md` | one deadline bounds all provider attempts for a request |
| unsupported settings are declared, not guessed | implemented | `models/__init__.py:557-572` | a model class lists settings it ignores; warnings are emitted for meaningful ones |

Profiles are the centre of gravity. Every behaviour that varies by model family is a profile field,
and the model class declares the settings it cannot carry; the agent layer never branches on a
provider name. That is a design we can copy cheaply because our own `ModelCapabilities` interface
already exists and is simply under-populated.

## Harness, multi-agent and workspaces

| capability | status | evidence | how it works |
|---|---|---|---|
| first-party capability library | declared | `src/pydantic_ai_harness/README.md:13-15` | 66 capability modules plus complete agent stacks, built only on core primitives |
| coding and research harnesses | declared | `capabilities/overview.md:31-32` | a full agent stack is a combined capability, decomposable into its parts |
| code mode | declared | `src/pydantic_ai_harness/pydantic_ai_harness/code_mode/README.md:13-27` | eligible tools hide behind one `run_code` tool; model-written Python with loops and `asyncio.gather` runs in a Monty sandbox and calls host tools through the framework |
| dynamic workflow | declared | `src/pydantic_ai_harness/pydantic_ai_harness/dynamic_workflow/README.md:3` | one agent choreographs a team of sub-agents by writing a small Python script |
| subagents | declared | `src/pydantic_ai_harness/pydantic_ai_harness/subagents/README.md:13` | one `delegate_task(name, task)` tool over named child agents, each with its own history |
| background tools | declared | `src/pydantic_ai_harness/pydantic_ai_harness/background_tools/README.md:3` | selected tools keep running while the agent continues without waiting |
| input, output and tool-boundary guardrails | declared | `src/pydantic_ai_harness/pydantic_ai_harness/guardrails/README.md:3,12` | separate guard capabilities validate the prompt, the tool call arguments and the tool result |
| tool argument repair | declared | `src/pydantic_ai_harness/pydantic_ai_harness/repair_tool_arguments/README.md:3` | malformed JSON arguments are repaired rather than failing the call |
| cross-run spend budget | declared | `src/pydantic_ai_harness/pydantic_ai_harness/spend/README.md:12` | a budget that outlives one run and can be shared across workers |
| step persistence | declared | `src/pydantic_ai_harness/pydantic_ai_harness/step_persistence/README.md:1-12` | settled steps snapshot to a chosen media store for later resume or fork |
| sandbox workspaces | declared | `capabilities/overview.md:40-51` | filesystem, shell and cloud sandbox capabilities share one workspace protocol |
| local workspace | declared | `capabilities/local_workspace.py` | tools get a workspace handle for commands and file edits |

Two of these rows narrow a difference we otherwise claim. Code mode (`run_code`, model-written
Python, host tools bridged back through the framework) is code-as-action as a capability, so the
remaining distinction is location and executor breadth, not the idea. And their guardrails cover
the tool boundary, which our GR-01 does not: their argument is that an input guard sees only the
first request while untrusted content arrives through tool results.

## MCP

| capability | status | evidence | how it works |
|---|---|---|---|
| MCP client toolset | implemented | `pydantic_ai/mcp.py:742-981` | wraps the FastMCP client for stdio, SSE and streamable HTTP servers |
| MCP capability | declared | `capabilities/mcp.py`, `mcp/overview.md:28` | a URL-based wrapper that can opt into provider-native MCP |
| authentication, including OAuth | implemented | `mcp.py:924-981` | an auth object, a bearer string or the literal OAuth flow |
| resources, sampling, elicitation | declared | `mcp.py:747`, `mcp/client.md:7` | provided by the underlying FastMCP client rather than reimplemented |
| server authoring | absent | `mcp/server.md:7-11` | the page shows agents used inside a third-party server; no server SDK ships |

Their MCP position is the opposite of ours in effort allocation: a thin wrapper over a maintained
client library, with tools adapted into a toolset and everything protocol-level delegated. Our
MC-01/MC-02 already do the equivalent; the delta is auth and the native-provider option.

## Interfaces

| capability | status | evidence | how it works |
|---|---|---|---|
| UI protocol adapters | declared | `pydantic_ai/ui/ag_ui/`, `pydantic_ai/ui/vercel_ai/` | run events and messages are translated to a host protocol |
| local web UI | declared | `pydantic_ai/ui/_web/app.py` | a served application over the same adapters |
| terminal client | declared | `clai/clai/__init__.py:9`, `cli.md` | one entry point; a REPL shape is documented |
| realtime, image and embedding modules | declared | `realtime/`, `images/`, `embeddings/` directories | separate model families behind the same abstractions |

## Distribution and testing

| capability | status | evidence | how it works |
|---|---|---|---|
| uv workspace and metapackage | implemented | `pyproject.toml:48`, package directories | the root package aggregates workspace members and provider extras |
| optional extras per provider | implemented | `pydantic_ai_slim/pyproject.toml:15` | dependencies are dynamic, grouped per integration |
| documentation examples are tested | implemented | `tests/test_examples.py` | pages and docstrings are executed in the test suite |
| coverage and type gates | declared | `Makefile:66,120` | Pyright strict and a coverage run are part of the default target |

## Notable implementation notes

- Mode memory. The resolved output mode is cached per model for the run
  (`_agent_graph.py:1080-1112`) so a later step does not silently switch from tool output to native
  output and invalidate the prompt prefix. This is a prompt-cache concern expressed in loop code.
- Layered retries with independent budgets. The retry page enumerates transport, provider SDK,
  fallback, tool, output and hook retries, then multiplies them for a worst case
  (`retries.md:23-34`). Nothing shares a counter, and the documentation treats that as the point.
- Budget ownership. Output retries live on graph state, per-tool retries on the tool manager, and
  the run context reports the resolved value, so a tool author and a validator author see the same
  number.
- Deferral as data. An approval or a deferred call crosses a run boundary as a typed message part
  (`_deferred.py:28,159`), not as a suspended coroutine, which is what makes it serializable.
- Cache identity per operation. A durable operation is keyed by what it is, not by its position in
  a sequence (`_base.py:204-243`), so a replay that skips a completed call still resolves the rest.
- Profile-flag test matrix. The contributor guidance asks for a case per model class when a generic
  setting is forwarded, which is how a growing flag set stays honest.
- File size is the shadow of the architecture. The three files every feature touches are the three
  largest in the package: `agent/__init__.py` at 5,271 lines, `messages.py` at 6,379 and
  `_agent_graph.py` at 3,391. The seams are clean; the hubs are crowded.

## Not covered here

Provider wire formats, harness internals, UI protocol translation and the graph library's path
resolution were not traced. Rows marked declared rest on types, pages or module READMEs; a later
read should promote them or delete them. The harness rows in particular describe documented
behaviour, not a traced execution path.
