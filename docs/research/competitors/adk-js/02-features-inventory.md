# adk-js — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Strength words are used exactly: `implemented` means the source path was traced end to end;
`declared` means a type, flag or doc claims it but no production path was found; `inferred`
means reasoning from structure, said so in the row. Rows are grouped by our baseline families so
the gap file can cite them.

## Delegation and multi-agent

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| DEL-01 | Sub-agents declared per agent | implemented | `core/src/agents/base_agent.ts:144` | `subAgents` is a list on the config; the composer sets `parentAgent` so a child knows its parent and peers | A tree of agents is expressed in configuration, not in code that wires calls |
| DEL-02 | Transfer as a tool with a decoded target enum | implemented | `core/src/agents/processors/agent_transfer_llm_request_processor.ts:42-59`, `:160-161`; `core/src/agents/llm_agent.ts:613-620` | A per-invocation `FunctionTool` takes `agent_name` as a Zod enum of the reachable agents, so an unknown name fails argument validation | The model cannot invent a handoff target, and a bad target returns as a retryable tool error |
| DEL-03 | Transfer target computation | implemented | `core/src/agents/processors/agent_transfer_llm_request_processor.ts:136-156` | Children always qualify; parent and peers qualify unless `disallowTransferToParent` or `disallowTransferToPeers` is set | Sibling handoff without a global agent registry |
| DEL-04 | Inline execution of a transfer | implemented | `core/src/agents/llm_agent.ts:1405` | On a `transferToAgent` action the runner yields the function response and then runs the target agent's generator inside the same invocation | The conversation continues as one run, so history and state stay in one place |
| DEL-05 | Transfer persisted on the event | implemented | `core/src/events/event_actions.ts:37` | The action is stored on the event and read again by resumption routing | A transfer survives a process restart because it is session history |
| DEL-06 | Agent exposed as a tool with validated I/O | implemented | `core/src/tools/agent_tool.ts:20`, `:61-72`, `:122`, `:205` | A nested `Runner` runs the child against the parent session with a forwarding artifact service, then validates the child's output against its schema | Delegation without giving up typed results or artifact access |
| DEL-07 | Task mode with a `finish_task` tool | implemented | `core/src/agents/llm_agent.ts:369-373`, `:537`, `:693`; `core/src/tools/finish_task_tool.ts:49` | The agent loops until it calls `finish_task`, whose arguments mirror the declared output schema and become the node's output | A structured child report instead of parsing prose |
| DEL-08 | Composite sequential, parallel and loop agents | implemented, deprecated | `core/src/agents/parallel_agent.ts:42-55`; `core/src/agents/loop_agent.ts:51` | Sequential runs children in order, parallel merges branch generators with isolation scopes, loop repeats until a child escalates | Shipped before the graph existed; the deprecation notice points at `Workflow` |
| DEL-09 | Graph workflow as the composition model | implemented | `core/src/workflow/workflow.ts:137-167` | Static `edges` or a `dynamicEntry` function, a concurrency cap, per-node retry, timeout and schemas | Ordering, routing, retries and HITL in one primitive |
| DEL-10 | Agent as a workflow node and node as a tool | implemented | `core/src/agents/base_agent.ts:319-323`; `core/src/workflow/nodes/node_tool.ts` | `BaseAgent.runImpl` delegates to `runAsync`, and `NodeTool` exposes a node to a model | An agent can drive a graph and a graph can host an agent |

## Sessions, state and memory

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| SES-01 | Session record with composite identity | implemented | `core/src/sessions/session.ts:24-54` | Id, app name, user id, state, events and last-update time; app and user id form the storage key | Multi-tenant storage needs the tenant in every key |
| SES-02 | Scoped state prefixes | implemented | `core/src/sessions/state.ts:28-31` | `app:`, `user:` and `temp:` route authority, retention and promotion | One dictionary with three lifetimes |
| SES-03 | State validated against a schema | implemented | `core/src/sessions/state.ts:11`, `:74-85` | An optional Zod schema rejects undeclared keys and wrong types with `StateSchemaError` | State written by a tool is still typed |
| SES-04 | Write-order stamps on state deltas | implemented | `core/src/sessions/state.ts:127`; `core/src/sessions/base_session_service.ts:200` | Each write is stamped and a stale delta is skipped at append time | Two concurrent turns must not resurrect old values |
| SES-05 | Append-only event log with partial filtering | implemented | `core/src/sessions/base_session_service.ts:169` | `appendEvent` is the only write path; partial streaming events are never stored | The log is the replay source, so it holds only settled facts |
| SES-06 | Temp keys stripped and app/user state promoted | implemented | `core/src/sessions/base_session_service.ts:169-200`, `:289` | `temp:` entries are dropped from the delta, scoped entries are copied to their own tables, `mergeStates` re-namespaces on read | Per-turn scratch values never reach storage |
| SES-07 | Prototype-safe state maps | implemented | `core/src/sessions/base_session_service.ts:206-264` | Null-prototype dictionaries and own-key copies keep a client-supplied `__proto__` key from reaching the prototype | Session keys are attacker-controlled input |
| SES-08 | In-memory store with clone-on-read and paging | implemented | `core/src/sessions/in_memory_session_service.ts:45`, `:92`, `:120-125` | Reads return a deep clone; lists sort, paginate and can trim to recent events or a timestamp | Tests and ephemeral runs share the real semantics |
| SES-09 | Local stores for sessions and artifacts | implemented | `core/src/sessions/database_session_service.ts:104`; `core/src/artifacts/file_artifact_service.ts:59` | MikroORM over SQLite, MySQL or PostgreSQL through a connection string; file artifacts under a base directory | A program can restart with its history |
| SES-10 | Versioned cross-language database schema | implemented | `core/src/sessions/db/schema.ts:19-21`, `:40-46`, `:84-200` | Five entity tables; `schema_version` in `adk_internal_metadata`; snake_case JSON payloads; 191-character key columns | adk-python reads the same tables, so the schema is an API |
| SES-11 | Service selection from a URI | implemented | `core/src/sessions/registry.ts:22`; `core/src/artifacts/registry.ts` | `getSessionServiceFromUri` returns in-memory or database by the scheme; artifacts resolve `gs://` | Configuration, not code, picks a store |
| SES-12 | Memory service with ingest and search | implemented | `core/src/memory/base_memory_service.ts:44-60`; `core/src/memory/in_memory_memory_service.ts:22` | Two calls only: add a session, search by query with app and user scope; the in-memory implementation scans stored sessions | Cross-run recall without a vector store in the base case |
| SES-13 | Context compaction seam | implemented | `core/src/agents/llm_agent.ts:585-604`; `core/src/context/base_context_compactor.ts:13`; `core/src/agents/run_config.ts:104` | Compactors are tried in priority order by a request processor spliced in before content is built; the run config carries trigger and target token budgets | Long conversations need a summarisation hook |
| SES-14 | Feature registry with staged flags | implemented | `core/src/features/feature_registry.ts:35-40`, `:105` | A feature has a stage and a default; overrides precede `ADK_ENABLE_*` and `ADK_DISABLE_*` environment flags, and enabling a non-stable feature warns once | Risky behaviour ships dark and turns on per process |
| SES-15 | Session listing with a cursor | implemented | `core/src/sessions/base_session_service.ts:153`; `core/src/sessions/session.ts:87` | `listSessions` returns sessions and a next cursor for a user, filtered by app | A console can browse a history without loading every event |

## Human-in-the-loop and durability

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| HLT-01 | Tool confirmation as a pinned call | implemented | `core/src/tools/tool_confirmation.ts:45-57` | A confirmation records the original call, the decision and an optional payload; a mismatch raises `IntentMismatchError` with a reason code such as `arguments_mismatch` | The approval must refer to what the user actually saw |
| HLT-02 | Confirmation paused, then resumed from the log | implemented | `core/src/agents/processors/request_confirmation_llm_request_processor.ts:53-88` | The processor finds pending confirmation responses in event scope, verifies the pinned call, executes it, and emits a function response before the next model turn | A human verdict is data in the session, not a blocking thread |
| HLT-03 | Fail-closed confirmation handling | implemented | `core/src/tools/tool_confirmation.ts:63` | A malformed, untrusted or mismatched verdict aborts the invocation instead of running the tool | Silence and corruption must not read as approval |
| HLT-04 | Run pauses before executing tools | implemented | `core/src/agents/llm_agent.ts:1802`; `core/src/agents/run_config.ts:123` | `pauseOnToolCalls` ends the invocation with the calls recorded as long-running | A host drives the calls itself and resumes later |
| HLT-05 | Workflow interrupt with a response schema | implemented | `core/src/workflow/request_input.ts:26-68`; `core/src/workflow/utils/hitl_utils.ts:53` | A node returns `RequestInput`; the event carries an `adk_request_input` call with the prompt, payload and serialized schema, and the id is marked long-running | A pause is inspectable by any client without knowing the node |
| HLT-06 | Interrupt reply validated after the fact | implemented | `core/src/workflow/utils/hitl_utils.ts:88-162` | The schema survives only on the event, so replies are matched against it and a mismatch is reported without ending the session | The node that asked may never run again on resume |
| HLT-07 | Rehydration and fast-forward on resume | implemented | `core/src/workflow/workflow.ts:223-256` | Resume reconstructs node runs from events, applies stored replies, skips completed nodes and re-runs waiting ones | A resumed graph does not replay committed side effects |
| HLT-08 | Per-node rerun policy | implemented | `core/src/workflow/base_node.ts:47`; `core/src/workflow/workflow.ts:146` | `rerunOnResume` defaults to true at graph level; a node with it off completes from the stored reply instead | Some nodes are expensive and some are pure |
| HLT-09 | Resumable invocation routing | implemented | `core/src/runner/runner.ts:937`; `core/src/apps/resumability_config.ts` | With resumability on, an unanswered function response routes the next run to that call's author, with a conflicting-author check | A resumed turn goes back to the agent that asked |
| HLT-10 | Auth credentials as an interrupt kind | implemented | `core/src/workflow/utils/hitl_utils.ts:225-250`; `core/src/agents/user_input_request.ts:114-121` | A credential request is an `adk_request_credential` call; the same inspection helpers flatten input, credential and confirmation pauses | Three pause kinds share one client contract |
| HLT-11 | Pending-input inspection helpers | implemented | `core/src/agents/user_input_request.ts:78-192` | Helpers read pauses out of events, flatten the three encodings and subtract answered ids | A client can answer "what is this session waiting for" |

## Plugins and callbacks

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| PLG-01 | One plugin surface for the whole run | implemented | `core/src/plugins/base_plugin.ts`; `core/src/plugins/plugin_manager.ts:36` | A plugin subclasses `BasePlugin` and overrides the hooks it needs; the manager keeps an ordered set | One extension point instead of an adapter per concern |
| PLG-02 | First non-undefined verdict wins | implemented | `core/src/plugins/plugin_manager.ts:102-123` | `runCallbacks` iterates the set and returns the first defined result, logging an early exit | Deterministic pre-emption with no merge rules |
| PLG-03 | Plugins pre-empt per-agent callbacks | implemented | `core/src/agents/functions.ts:614-703` | Around a tool call the plugin's before/after hooks run first; the agent's own callbacks run inside, and the plugin may replace either side | A cross-cutting policy outranks a local convenience hook |
| PLG-04 | Per-agent before and after callbacks | implemented | `core/src/agents/base_agent.ts:266-288`, `:468-535` | A before callback that returns content ends the invocation with that content; an after callback can append one more event | Short-circuit an agent without touching its loop |
| PLG-05 | Tool, model and node hooks are wired | implemented | `core/src/agents/functions.ts:495`, `:614`, `:663`, `:691`; `core/src/agents/llm_agent.ts:2026-2120`; `core/src/workflow/node_runner.ts:220`, `:309` | Tool before/after/error, model before/after/error and node before/after each call the manager | Every seam that needs policy has a hook |
| PLG-06 | Plugin agent hooks exist but are never called | declared | `core/src/plugins/plugin_manager.ts:194`, `:212`; only a unit test references them (`core/test/plugins/plugin_manager_test.ts:275`) | The manager methods and the `BasePlugin` defaults exist, but no production path invokes them | An artifact of porting the Python hook list without wiring it |
| PLG-07 | Selection and compaction hooks exist but are never called | declared | `core/src/plugins/plugin_manager.ts:270`, `:288`, `:306` | `beforeToolSelection`, `beforeContextCompaction` and its after twin have manager methods and no call site | Same porting artifact as PLG-06 |
| PLG-08 | Duplicate plugin names rejected | implemented | `core/src/plugins/plugin_manager.ts:66-71` | Registration rejects a second plugin with the same name or identity | Lookups and logging key on the name |
| PLG-09 | Debug, logging and security plugins ship | inferred | `core/src/plugins/debug_logging_plugin.ts`, `core/src/plugins/logging_plugin.ts`, `core/src/plugins/security_plugin.ts` | Located by name and by their hooks in the plugin directory; not read in full | Built-ins double as worked examples |
| PLG-10 | A plugin can answer the user turn itself | implemented | `core/src/runner/runner.ts:378`, `:451` | `onUserMessageCallback` may rewrite the incoming content and `beforeRunCallback` may return content that ends the run before the agent starts | A filter can reply, refuse or rewrite without an agent change |

## Artifacts

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| ART-01 | Versioned artifacts | implemented | `core/src/artifacts/base_artifact_service.ts:88-134` | Save returns a version, load takes an optional version, and `listVersions` enumerates them; the first version is 0 | A produced file has history, not just a value |
| ART-02 | Session-facing interface and scope wrapper | implemented | `core/src/artifacts/session_artifact_service.ts:21`; `core/src/artifacts/scoped_artifact_service.ts:29` | `SessionArtifactService` is the narrower contract; `ScopedArtifactService` injects app, user and session so callers pass a name only | A tool cannot read another session's artifact by accident |
| ART-03 | Three stores | implemented | `core/src/artifacts/in_memory_artifact_service.ts:28`; `core/src/artifacts/file_artifact_service.ts:59`; `core/src/artifacts/gcs_artifact_service.ts:27` | In-memory, filesystem and Google Cloud Storage behind one interface | Local development and cloud deployment share the contract |
| ART-04 | Artifact delta on events | implemented | `core/src/events/event_actions.ts:32` | An event records a map of artifact name to version, so a client can refresh what changed | The UI learns of a new version without polling |
| ART-05 | Input blobs saved as artifacts | declared | `core/src/agents/run_config.ts:54` | A run-config flag routes user-supplied blobs into the artifact service | Large inputs should not live in the transcript |

## Evaluation

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| EVL-01 | Eval set as data | implemented | `core/src/cli/cli_eval.ts:126-167` | An eval set is JSON: named entries with a user message, expected tool uses, expected response and an optional initial session | Regression fixtures are files, not code |
| EVL-02 | Recorded session converted to eval format | implemented | `core/src/cli/cli_eval.ts:608` | A real session's invocations become eval entries, so a good run can become a fixture | Building fixtures by hand does not scale |
| EVL-03 | Mock tool output interception | implemented | `core/src/cli/cli_eval.ts:499-507` | The runner temporarily wraps each agent's existing `beforeToolCallback` with one that returns the recorded output, and restores the original afterwards | Replays are deterministic and side-effect free |
| EVL-04 | Tool-trajectory metric | implemented | `core/src/cli/cli_eval.ts:41`, `:61` | Scores the fraction of expected tool calls matched by name and arguments; default threshold 1.0 | A wrong trajectory is a hard failure even when the answer reads well |
| EVL-05 | Response-match metric | implemented | `core/src/cli/cli_eval.ts:46`, `:393`, `:470` | ROUGE-1 F-measure between expected and actual final text; default threshold 0.8 | Cheap, deterministic, model-free similarity |
| EVL-06 | Per-invocation and overall verdicts | implemented | `core/src/cli/cli_eval.ts:69-134` | Each invocation carries metric results and a status; the run aggregates and compares against criteria | One failing turn fails the eval |
| EVL-07 | Eval runner reachable from CLI and server | implemented | `core/src/cli/cli_eval.ts:660`; `dev/src/server/adk_api_server.ts:972`, `:1217` | `runEvals` is an async generator over sets; the CLI verb and the dev server both call it | CI and a UI drive the same runner |
| EVL-08 | Eval runs isolated in their own session ids | implemented | `core/src/cli/cli_eval.ts:56`, `:533` | Each eval invocation gets a session id under a reserved prefix, so a fixture run cannot leak into a user conversation | History and evaluation stay separable |

## A2A

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| A2A-01 | Server mount with fail-closed auth | implemented | `core/src/a2a/agent_to_a2a.ts:179-249` | `toA2a` loads Express lazily, serves an agent card, mounts JSON-RPC and REST handlers and refuses to mount without an authentication builder unless explicitly allowed | An unauthenticated agent endpoint must not exist by accident |
| A2A-02 | Executor mapping events onto A2A tasks | implemented | `core/src/a2a/agent_executor.ts:173` | Session events become task, artifact and status updates; the run is marked remotely delivered and streaming uses SSE | The protocol's task model is derived from the event log |
| A2A-03 | Client agent | implemented | `core/src/a2a/a2a_remote_agent.ts:129` | `RemoteA2AAgent` is a `BaseAgent` that calls a peer, streaming or unary, with request callbacks and credential scrubbing | A graph can include a remote peer as a node |
| A2A-04 | Agent-card resolution with network guards | implemented | `core/src/a2a/agent_card.ts:84-126` | Accepts object, URL, file or path; refuses link-local hosts, redirects, insecure RPC and cross-origin RPC by default | A card URL is an attacker-influenced pointer |
| A2A-05 | Remote peers cannot answer confirmations | implemented | `core/src/agents/processors/request_confirmation_llm_request_processor.ts:80-88` | A confirmation delivered over A2A is ignored unless the run config opts in | A remote peer is not the operator the gate asks |
| A2A-06 | Cross-language interop tests | implemented | `tests/cross_language/a2a/go_ts/go_a2a_ts_test.ts`; `tests/cross_language/a2a/ts_go/ts_a2a_go_test.ts` | A Go A2A peer drives a TypeScript agent and the reverse, including a hitl agent | The protocol claim is tested against a non-Google implementation |
| A2A-07 | Cancellation is a placeholder | implemented, placeholder | `core/src/a2a/agent_executor.ts:218-220` | `cancelTask` throws "not supported yet" | The protocol surface is declared before it is complete |
| A2A-08 | A remote agent owns its own tree | implemented | `core/src/agents/remote_agent.ts:186` | `RemoteAgent` throws when a caller adds sub-agents, because the peer composes its own | A remote boundary is an agent boundary |

## Event model and observability

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| EVT-01 | Event carries identity, invocation and branch | implemented | `core/src/events/event.ts:74-155` | An event extends the model response with id, invocation id, author, branch, timestamp, long-running ids, output and route | One record serves transport, storage and rendering |
| EVT-02 | Action bag on every event | implemented | `core/src/events/event_actions.ts:26-61` | State delta, artifact delta, transfer target, escalation, auth requests, tool confirmations, agent state and end-of-agent flag | Effects travel with the event that caused them |
| EVT-03 | Structured projection for clients | implemented | `core/src/events/structured_events.ts:22`, `:149` | `toStructuredEvents` maps one event to typed parts: thought, content, tool call, tool result, code, code result, error, activity and finished | Renderers switch on a small enum instead of inspecting model payloads |
| EVT-04 | Node path and isolation scope | implemented | `core/src/events/event.ts:148`, `:155` | `nodeInfo` records the graph path and output routing; `isolationScope` names the branch a node ran in | Parallel branches stay separable in one log |
| EVT-05 | OpenTelemetry spans and GenAI attributes | implemented | `core/src/agents/base_agent.ts:254-295`; `core/src/telemetry/tracing.ts:126`, `:279` | Each agent run and tool execution opens a span with the GenAI operation name; a setup helper wires providers from hooks or OTLP environment variables (`core/src/telemetry/setup.ts:66`) | Traces are vendor-neutral and exportable |

## Models, tools and execution

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| MOD-01 | Model registry by name pattern | implemented | `core/src/models/registry.ts:19-60` | A model class declares the patterns it supports; the registry resolves a name or accepts an instance, with an LRU cache | Configuration names a model without importing its class |
| MOD-02 | Routed model with failover | implemented | `core/src/models/routed_llm.ts:27-68` | A router function chooses among several models from the request and the failure context; the wrapper runs the chosen one and rewrites the request's model name | Different calls inside one agent can use different models |
| MOD-03 | Code executors as one tool family | implemented | `core/src/code_executors/base_code_executor.ts:50`; `built_in_code_executor.ts`, `container_code_executor.ts:22`, `unsafe_local_code_executor.ts`, `agent_engine_sandbox_code_executor.ts` | Built-in model execution, a Docker container, an explicitly unsafe local process and a managed sandbox | Code execution is a capability the model calls, not the loop's shape |
| TOO-01 | Function tools from Zod, long-running and auth-aware | implemented | `core/src/tools/base_tool.ts:36-97`, `:144-149`; `README.md:36` | A tool declares a Zod v3 or v4 schema, an execution body, a long-running flag and an optional confirmation check | One declaration produces the model schema, validation and dispatch |
| TOO-02 | Built-in and remote toolsets | implemented | `core/src/index.ts:118-182`; `core/package.json:64-74` | Google search, URL context, maps, retrieval, MCP, OpenAPI, skill loading and web-page tools are exported; MCP lives behind a subpath | The common integrations ship, the optional ones stay out of the barrel |
| TOO-03 | MCP tools behind their own entry point | declared | `core/package.json:64-68` | `@google/adk/tools/mcp` loads the MCP client and adapts remote tools to local ones, so the base barrel does not pull the protocol SDK | Optional transport, optional dependency |

## Dev tooling, deployment and distribution

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| DEV-01 | CLI verbs | implemented | `dev/src/cli/cli.ts:274-744` | `web`, `api_server`, `create`, `run`, `eval`, `deploy cloud_run`, `deploy agent_engine` and `integration conformance` | One entry point for the whole lifecycle |
| DEV-02 | Dev API server | implemented | `dev/src/server/adk_api_server.ts:335-1360` | Express routes for apps, sessions, events, artifacts, eval sets and results, `/run` and `/run_sse`, plus telemetry export plumbing | The dev UI and scripted clients need HTTP |
| DEV-03 | Agent loader | implemented | `dev/src/utils/agent_loader.ts` | Compiles a TypeScript or JavaScript agent file with esbuild, shims imports and imports the result | `adk run agent.ts` works without a build step |
| DEV-04 | Conformance harness and replay plugin | implemented | `dev/src/conformance/conformance_integrations.ts:21`; `dev/src/integration/replay_plugin.ts:16` | Named callbacks, tools and plugins are replayed against recorded model and tool responses in a plugin | Cross-language and scenario tests are deterministic |
| DEV-05 | Three-workspace release | implemented | `package.json:38`; `.release-please-manifest.json` | Runtime, dev tools and integrations version together through release-please | Tooling can break with the runtime without breaking users |
| DEV-06 | The CLI answers a pause from the terminal | implemented | `dev/src/cli/cli_run.ts:41-45` | The CLI reads pending inputs from the event log, words a prompt per kind and sends the reply as the next user turn | HITL is testable without a UI |

## Notable implementation notes

- The processor chain's order is load-bearing: confirmation resume runs before instructions and
  the model request, so an approved call is executed before the next turn is composed
  (`core/src/agents/llm_agent.ts:568`).
- `outputSchema` and transfer configuration are mutually exclusive, which is the typing
  expression of "a task agent finishes; a chat agent hands off".
- The transfer tool's parameter name `agent_name` and the interrupt's `response_schema` are
  wire-format choices, documented as such in source, not style choices
  (`core/src/agents/processors/agent_transfer_llm_request_processor.ts:37-40`;
  `core/src/workflow/utils/hitl_utils.ts:38-44`).
- Resumption for confirmations scans events in the agent's branch scope only, so a sibling
  branch's approval cannot unlock this one's call.
- A partial event reaches the `onEvent` plugin but never the session
  (`core/src/runner/runner.ts:571-586`).
- The evaluation runner mutates agent configuration (prepending a tool callback) and restores
  it, which is a sharp reminder that the mock seam is the callback itself, not a service.
- `remove` of a tool from the registry has no counterpart: tools are added to a request by
  `processLlmRequest`, and a duplicate name throws rather than replacing
  (`core/src/tools/base_tool.ts:170-175`).
- Code execution defaults are safe by name only: the local executor is literally called
  `unsafe_local_code_executor`, and the container executor is opt-in.
- A pause is a function call, not a text message, which is why the inspection helper had to be
  written at all: a client that renders only text shows the user nothing while the run waits
  (`core/src/agents/user_input_request.ts:7-15`).
- The persisted payload is snake_case while the runtime is camelCase, and the conversion at the
  storage boundary keeps an explicit list of keys it must not rename
  (`core/src/events/event.ts:370-403`).
- Services are chosen from configuration URIs, so the same agent runs against memory in a test and
  a database in production without a code branch (`core/src/sessions/registry.ts:22`).
