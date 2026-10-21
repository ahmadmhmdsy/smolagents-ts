# autogen — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Strength words are used exactly: `implemented` means the source path was traced end to end,
`declared` means a type, flag or doc claims it without a traced production path, and `inferred`
means reasoning from structure and is said so in the row. Rows are grouped by concern, and some
headings name the baseline family they serve so the gap file can cite them.

## Packaging and layering (`DS-01`)

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| PKG-01 | Core runtime as its own distribution | implemented | `python/packages/autogen-core/pyproject.toml:6-23` | 0.7.5; dependencies are pydantic, protobuf, opentelemetry-api, pillow, typing-extensions and jsonref; holds addresses, runtime, subscriptions, serializers, model and tool protocols | A worker process can depend on the runtime without the chat layer |
| PKG-02 | Chat layer on top of the runtime | implemented | `python/packages/autogen-agentchat/pyproject.toml` | 0.7.5; depends on `autogen-core`; holds messages, agents, teams, termination and state | One import for application code, no runtime idioms required |
| PKG-03 | An extension ring for implementations | implemented | `python/packages/autogen-ext/pyproject.toml` | 0.7.5; models, code executors, tools, teams and agents live outside core, each behind a core protocol | Providers change, the runtime contract does not |
| PKG-04 | Legacy names kept as proxies | implemented | `python/packages/pyautogen/pyproject.toml:12-14`; `src/pyautogen/__init__.py` | `pyautogen` 0.10.0 installs `autogen-agentchat` as a dependency and ships an empty module | An old import keeps resolving after the 0.2 code was removed |
| PKG-05 | Worker and cross-language contracts | implemented | `protos/agent_worker.proto`; `autogen_ext/runtimes/grpc/_worker_runtime.py:215` | Protobuf messages for RPC, publish and agent registration; a gRPC runtime implements `AgentRuntime` over them | Python and .NET agents can share one service |

## Runtime, addresses and messaging (`RT-09`, `OB-02`)

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| ACT-01 | Address by type and key | implemented | `autogen_core/_agent_id.py`; `_type_subscription.py:56-60` | `AgentId(type, key)`; a type subscription turns a topic source into the key, so one logical worker serves one conversation | Routing needs no registry of instances at the call site |
| ACT-02 | RPC with a future | implemented | `_agent_runtime.py:22`; `_single_threaded_agent_runtime.py:332-385`, `:466-555` | `send_message` serializes the payload, creates a future, enqueues a `SendMessageEnvelope`, links cancellation and awaits; the recipient's response comes back as a `ResponseMessageEnvelope` | A caller sees a normal coroutine; the runtime owns delivery |
| ACT-03 | Publish to a topic | implemented | `_agent_runtime.py:50`; `_single_threaded_agent_runtime.py:557-629` | Subscribers are resolved from the topic, the sender is skipped, handlers run concurrently and a handler error is stored as the background exception | Fan-out and observation without a return value |
| ACT-04 | One asyncio run loop | implemented | `_single_threaded_agent_runtime.py:105-110`, `:671-794` | The loop pulls one envelope per iteration, runs intervention hooks, dispatches a task and yields the scheduler with `sleep(0)` | Concurrency comes from asyncio, not from threads |
| ACT-05 | Intervention between send and delivery | implemented | `_intervention.py:20-64`, `:69`; `_single_threaded_agent_runtime.py:693` | An `InterventionHandler` may return a replacement message or a `DropMessage` marker, which raises a dropped exception to the caller | Policy and auditing sit on the transport, once |
| ACT-06 | Runtime snapshot of agent state | implemented, partial | `_single_threaded_agent_runtime.py:431-447`, `:449-464` | `save_state` collects each instantiated agent's own mapping under its string id; `load_state` rebuilds by parsing ids. The docstring states subscription state is not saved | A host can rebuild its agents without a database |
| MSG-01 | Envelope carries delivery context | implemented | `_single_threaded_agent_runtime.py:58-92` | Publish, send and response envelopes carry message, sender, recipient or topic, future, cancellation token, metadata and message id | Tracing and interception need ids that the handler never sees |
| MSG-02 | Pluggable serialization | implemented | `_serialization.py:14-23`, `:102`, `:133`, `:157`, `:187` | Serializer protocols keyed by data content type and type name; dataclass, Pydantic and protobuf implementations; an unknown payload class preserves bytes | The same message crosses a process boundary or stays local |
| MSG-03 | Handler-level context object | implemented | `_message_context.py:9-14` | Sender, topic id, an RPC flag, cancellation token and message id are passed to every handler | A handler can answer, cancel and trace without arguments |
| SUB-01 | Subscriptions as first-class objects | implemented | `_subscription.py`; `_type_subscription.py:10-66`; `_default_subscription.py:10-20`; `_type_prefix_subscription.py` | A subscription matches a topic and maps it to an agent id; decorators attach the default one at class definition | Topic names stay strings, routing stays a value |
| SUB-02 | Declarative handler dispatch | implemented | `_routed_agent.py:415`, `:474-486`, `:493-502` | Handlers are collected from class attributes, matched by exact message type and router predicates, first match wins, with an unhandled fallback (`:488`) | Adding a message type adds a handler, not a branch |
| SUB-03 | Serialized handling per agent | implemented | `_sequential_routed_agent.py:7-61` | `SequentialRoutedAgent` takes a FIFO lock before handling, so one agent processes one message at a time | Model state in one agent is not raced by two topics |

## AgentChat surface

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| CHT-01 | Agent protocol independent of runtime | implemented | `base/_chat_agent.py:24-92` | `ChatAgent` declares produced message types, `on_messages`, `on_messages_stream`, reset and pause hooks, save and load state, close; `Response` pairs the chat message with inner messages (`:13-19`) | Agent code does not import the runtime |
| CHT-02 | Assistant loop with a tool-call budget | implemented | `agents/_assistant_agent.py:901-1010`, `:1149-1260` | One model call, then a loop bounded by `max_tool_iterations` (default 1, `:85`); tool calls run concurrently, request and execution events are yielded as they happen | Multi-step tool use is opt-in and observable |
| CHT-03 | Reflection after tools | implemented | `agents/_assistant_agent.py:1409-1497` | With `reflect_on_tool_use` set, a second model call summarises the calls and results into the final text | A model-facing answer instead of a tool transcript |
| CHT-04 | Handoff decided from the model result | implemented | `agents/_assistant_agent.py:1327-1406`, `:1535-1575` | A call whose name matches a registered handoff becomes a `HandoffMessage` with target, message and a compressed context of the other calls; other calls still execute | Control transfer is a tool call the model already knows how to make |
| CHT-05 | Code executor agent with approval | implemented | `agents/_code_executor_agent.py:50-89`, `:140` | Extracts code blocks from incoming messages, asks `approval_func` before running, executes through a `CodeExecutor`, yields code generation and execution events | Code execution as an agent, not a tool, so a team can supervise it |
| CHT-06 | Terminal message types | implemented | `messages.py:415`, `:421`, `:433`, `:559`, `:571` | `StopMessage`, `HandoffMessage`, `ToolCallSummaryMessage`, `SelectSpeakerEvent` and `SelectorEvent` all derive from `BaseMessage`; the chat ones carry id, source, usage and metadata | A renderer can tell why a run ended without reading prose |
| CHT-07 | Task result with a stop reason | implemented | `base/_task.py:9-15`, `:19-44` | `TaskResult` carries messages and a `StopMessage`; `TaskRunner` defines run and run-stream | Public API is a value plus a reason |

## Teams, control plane and speaker selection

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| TEA-01 | Team adapts agents into the runtime | implemented | `teams/_group_chat/_base_group_chat.py:40`, `:59-61`, `:191-245` | Each participant is wrapped in a `ChatAgentContainer` registered under its own type and keyed by team id; a manager agent is registered beside them and subscribes to the group, output and own topics | The chat API reuses routing, tracing and cancellation instead of reimplementing them |
| TEA-02 | Run as an async generator over a queue | implemented | `teams/_group_chat/_base_group_chat.py:351-578`, `:534-538` | `run_stream` starts the embedded runtime, sends `GroupChatStart` to the manager, then yields whatever the manager puts on an output queue until `GroupChatTermination` arrives; `run` drains it into a `TaskResult` (`:247-349`) | Streaming, stopping and remote participants share one path |
| TEA-03 | Round robin by index | implemented | `_round_robin_group_chat.py:72-82` | `select_speaker` increments an index modulo the participant count; the index is part of manager state (`:58-70`) | Deterministic rotation needs no model call |
| TEA-04 | Selector chooses with a model | implemented | `_selector_group_chat.py:152-217`, `:232-308` | A `selector_func` may decide first; otherwise the manager renders roles and the last message into a selector prompt, asks the model for one name, retries up to three times with feedback for zero, multiple or repeated mentions | The next speaker can depend on content, not order |
| TEA-05 | Selector fallback policy | implemented | `_selector_group_chat.py:196-199`, `:302-308` | Repeats are excluded unless allowed, and after exhausted retries the previous speaker or the first participant is chosen without an error | The chat keeps moving when the model cannot choose |
| TEA-06 | Swarm follows handoffs | implemented | `_swarm_group_chat.py:16`, `:45`, `:82-98`, `:100-112` | The current speaker is state; `select_speaker` scans the reversed transcript for the newest `HandoffMessage` and returns its target, else the current speaker | Peer routing without a central chooser |
| TEA-07 | Magentic orchestrator with ledgers | implemented | `_magentic_one/_magentic_one_orchestrator.py:58`, `:134-190`, `:300-450` | Plans facts and a plan once, then each round asks for a progress ledger with satisfaction, progress, loop and next-speaker fields, retries JSON up to ten times, counts stalls and re-plans on a stall threshold | Complex tasks need a plan and a self-check, not a rotation |
| TEA-08 | Graph control plane | implemented, experimental | `_graph/_digraph_group_chat.py:25`, `:101`, `:115`, `:309`, `:551`; `_graph/_graph_builder.py:10` | Nodes are agents with `all` or `any` activation, edges may carry a string or callable condition, cycles are rejected unless some edge can exit (`:149-198`), and a manager walks the graph | Workflow order expressed as data and validated before a run |
| TEA-09 | Nested teams | implemented | `_chat_agent_container.py:89-122`; `_swarm_group_chat.py:134-138` | A container whose delegate is a `Team` runs its own stream and publishes a `GroupChatTeamResponse`; Swarm and Magentic reject nested teams | A sub-team is just another participant |
| TEA-10 | Reset, pause and resume | implemented, experimental | `_base_group_chat.py:580`, `:657`, `:703`, `:748-796` | Reset broadcasts a reset event; pause and resume call per-participant hooks over RPC without ending the run; saving walks agents by name | A user can interrupt a live team without discarding it |

## Termination and handoff

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| TER-01 | Termination as a composable object | implemented | `base/_termination.py:15`, `:59`, `:79-85`, `:92-176` | A condition is called with a delta and returns `StopMessage` or nothing; and-or nodes combine conditions; firing twice raises | The loop needs no knowledge of the stop rule |
| TER-02 | A catalogue of model-free conditions | implemented | `conditions/_terminations.py:24`, `:62`, `:111`, `:158`, `:235`, `:313`, `:358`, `:404` | Stop message, message count, text mention, caller predicate, token usage, handoff target, timeout, and an externally set flag | Most stops are bookkeeping, not judgement |
| TER-03 | Applied by the manager with a turn cap | implemented | `_base_group_chat_manager.py:195-228` | Each agent response is a delta; the condition runs, on a stop the condition is reset and the turn counter zeroed, otherwise the counter increments and `max_turns` produces its own stop message | Two stop rules, one place that enforces them |
| TER-04 | Termination state and its lifecycle | implemented | `_base_group_chat.py:256`; `_round_robin_group_chat.py:54-55` | A stopped run resets the condition, and reset does the same; an early `terminated` check in the manager stops a new run with a "already terminated" message (`_base_group_chat_manager.py:86-101`) | Re-running a team is not supposed to inherit the last verdict |
| HOF-01 | Handoff as a generated tool | implemented | `base/_handoff.py:12-51` | A `Handoff` names a target, description, tool name and message; `handoff_tool` turns it into a `FunctionTool` whose call yields the message | The model sees a normal tool; the runtime sees a message |
| HOF-02 | Handoff-aware stopping and resumption | implemented | `conditions/_terminations.py:313-341`; `_swarm_group_chat.py:188-221` | `HandoffTermination(target="user")` stops when a handoff names the target; a later run passes a `HandoffMessage` as the new task | A human turn is a new run, not a suspended call |

## Tools, models and executors

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| TOL-01 | Tool protocol with JSON schema | implemented | `tools/_base.py:34`, `:41`, `:56`, `:74` | `ParametersSchema` and `ToolSchema` are typed dictionaries; `Tool` exposes name, description, schema, argument and return types, `run_json`, state and string rendering | A model-facing schema plus a typed call, one object |
| TOL-02 | Base tool with validation and lifecycle | implemented | `tools/_base.py:96-215` | `BaseTool` validates arguments into the argument model, wraps execution in a tool span, and allows state save and load | One place for validation, tracing and state |
| TOL-03 | Streaming tools | implemented | `tools/_base.py:84`, `:217-227`; `tools/_workbench.py:194-198` | `StreamTool` yields intermediate values before the final result; a `StreamWorkbench` streams tool calls | A long tool can report progress as chat events |
| TOL-04 | Stateful tool collection | implemented | `tools/_workbench.py:78-198` | `Workbench` lists tools, calls one, and has start, stop, reset, save and load | A set of tools has a lifecycle and state, unlike a bare registry |
| TOL-05 | Tools executed by an agent | implemented | `tool_agent/_tool_agent.py:40`, `:62`; `tool_agent/_caller_loop.py:20` | `ToolAgent` handles `FunctionCall` messages and replies with `FunctionExecutionResult`; a caller loop alternates model and tool agent until no calls remain | Tool execution can be a separate process or agent |
| TOL-06 | Tool call routing in the assistant | implemented | `agents/_assistant_agent.py:1536-1614` | Handoff tools are searched first, then each workbench's tool list; a call is streamed if the workbench supports it, otherwise awaited | One call site for handoffs, streaming tools and plain tools |
| MDL-01 | Model client protocol | implemented | `models/_model_client.py:209-293` | Create and create-stream, close, actual and total usage, token counting and remaining budget, model info and capabilities | Every provider has the same shape, and the loop can budget tokens |
| MDL-02 | Provider clients outside core | implemented | `autogen_ext/models/openai/_openai_client.py:1179`, `:1520`; `autogen_ext/models/{anthropic,ollama,llama_cpp,semantic_kernel,azure,replay,cache}/` | Each adapts its SDK to the protocol; a replay client and a caching wrapper sit beside them | Core stays dependency-free; swapping a model is a config change |
| MDL-03 | Usage and capability metadata | implemented | `models/_types.py:85-94`, `:107`; `models/_model_client.py:164`, `:185` | `RequestUsage` holds prompt and completion tokens; `CreateResult` holds content, usage, finish reason, cached flag and an optional thought; `ModelInfo` declares JSON and structured output support | Termination by tokens and feature detection need numbers, not guesses |
| EXE-01 | Code executor protocol | implemented | `code_executor/_base.py:19`, `:27`, `:34-98` | `CodeBlock`, `CodeResult`, and an `execute_code_blocks` coroutine plus start, stop and restart | Executors are interchangeable and stateful |
| EXE-02 | Executors in the extension package | implemented | `autogen_ext/code_executors/{docker,jupyter,docker_jupyter,local,azure}/` | Docker and Jupyter kernels, a local command-line runner and an Azure container variant, each a `CodeExecutor` | The deployment decides the isolation story |
| EXE-03 | A deterministic approval function | implemented | `agents/_code_executor_agent.py:64-76`, `:140` | `ApprovalRequest` and `ApprovalResponse` models wrap a sync or async callable consulted per execution | A team can place a human or a policy in front of code |

## State, tracing and configuration

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| STT-01 | Versioned state models | implemented | `state/_states.py:6-11`, `:13`, `:20` | Every state model carries a type name and a version string; `TeamState.agent_states` maps a participant name to its own mapping | State is JSON with a discriminator, not an opaque blob |
| STT-02 | Team state saved by participant name | implemented | `teams/_group_chat/_base_group_chat.py:748-796`, `:798-834` | Saving calls the runtime per agent and keys snapshots by name so a remote agent behaves like a local one; loading validates the mapping and raises a clear error for pre-0.4.9 shapes | One save path for local and remote participants |
| STT-03 | Manager and container state | implemented | `state/_states.py:27-72`; `_base_group_chat_manager.py:225-245` | Manager state holds the message thread and turn counter plus type-specific fields: round-robin index, previous speaker, current speaker, or ledgers and stall counts; a container holds its buffer | A resumable team needs the transcript, the cursor and the buffers |
| STT-04 | Agent memory context | implemented | `state/_states.py:13-17`; `model_context/_buffered_chat_completion_context.py` | The assistant stores its LLM context as a mapping and rebuilds the context object on load | Conversation memory is data the host can persist |
| TRC-01 | OpenTelemetry tracing in the runtime | implemented | `_telemetry/_tracing.py:12-40`, `:28`; `_single_threaded_agent_runtime.py:357`, `:467`, `:558` | A tracer provider creates spans around create, send, publish, process, ack and intercept, with parent context taken from message metadata | One trace per message path, including cross-agent hops |
| TRC-02 | GenAI semantic conventions | implemented | `_telemetry/_genai.py:49`, `:104`, `:164` | Tool, create-agent and invoke-agent spans set operation names and GenAI attributes | A viewer can tell an agent hop from a model call |
| TRC-03 | Runtime tracing switch | implemented | `_telemetry/_tracing.py:28`; `_single_threaded_agent_runtime.py:163` | `AUTOGEN_DISABLE_RUNTIME_TRACING` equal to `true` disables spans at import; event logging is separate | Production can keep events without trace overhead |
| CFG-01 | Declarative component config | implemented | `_component_config.py:145`, `:195-204`, `:330` | `dump_component` emits provider, type and version plus a validated config; `load_component` imports the provider and reconstructs it, with a trusted-namespace check | A team can be a JSON document that a UI or a server builds |
| CFG-02 | Registered message types only | implemented | `messages.py:583`; `_chat_agent_container.py:161-165` | `MessageFactory` is the allowlist; buffering or logging an unregistered class raises | A disk or wire format only contains known types |
| CFG-03 | Structured output as a message | implemented | `messages.py:178`, `:268`; `agents/_assistant_agent.py:1153-1164` | A `StructuredMessage` wraps a Pydantic model; a factory is a declared component | Typed final answers without a separate pipeline |

## Tooling and cross-language

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| XPL-01 | Protobuf RPC between processes | implemented | `protos/agent_worker.proto` | Request, response, publish, subscription and registration messages with a payload type and content type | A service routes between workers without importing either runtime |
| XPL-02 | .NET packages on the same model | implemented | `dotnet/README.md:3-6`; `dotnet/src/Microsoft.AutoGen/{Contracts,Core,RuntimeGateway.Grpc}` | Two generations coexist: 0.2-derived `AutoGen.*` packages and event-driven `Microsoft.AutoGen.*` packages, the latter described as not stable | A C# process is a peer, not a client of Python |
| DEV-01 | Magentic-One composition | implemented | `autogen_ext/teams/magentic_one.py`; `magentic-one-cli/src/magentic_one_cli/_m1.py` | A team subclass assembles a coder, a file surfer, a web surfer and an executor, with an optional approval function and code executor; a CLI wraps it | The paper's system shipped as a productised composition |
| DEV-02 | Component-driven GUI | implemented, prototype | `python/packages/autogen-studio/README.md` | A backend serves declarative team configs to a React frontend; the README calls it a research prototype | Config-driven teams get a visual builder cheaply |

## Notable implementation notes

- The runtime's `save_state` docstring is explicit that subscriptions are not saved
  (`_single_threaded_agent_runtime.py:438`), so restored state is data only and the wiring must be
  rebuilt by the host. Our `RunStore` has the same split by construction: it stores steps, not the
  executor.
- A team run is not one function call: the manager publishes into a queue that the public
  generator reads (`_base_group_chat.py:351-578`), so an embedded runtime and a remote worker
  runtime share one code path.
- `max_turns` is enforced in the manager after the termination condition has had its say
  (`_base_group_chat_manager.py:195-228`), so the cap survives a custom condition that returns
  nothing forever.
- Magentic-One stops on a model judgement plus a stall count, not only on a predicate: satisfaction
  ends with a generated final answer (`:388-391`, `:478-513`), while stalls re-enter the outer
  planning loop (`:393-406`).
- A stopped team resets its condition, but a cancelled one may not
  (`_base_group_chat.py:256-263`), and the source recommends an external termination flag instead
  of cancellation. The proxy package is honest about the split: 0.10.0 depends on
  `autogen-agentchat>=0.6.4` and its module is empty, so an old import resolves to nothing.
