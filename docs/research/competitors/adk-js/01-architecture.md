# adk-js — architecture

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository layout

| path | what lives there |
|---|---|
| `core/src` | the runtime and the only published API: `@google/adk` (`core/package.json:2`) |
| `core/src/agents` | `LlmAgent`, composite agents, remote and LangGraph agents, the processor pipeline, tool-call execution, user-input inspection |
| `core/src/workflow` | the graph primitive: `BaseNode`, `Workflow`, nodes, interrupts, resume replay |
| `core/src/events` | `Event`, event actions, structured event projection |
| `core/src/sessions`, `core/src/memory`, `core/src/artifacts` | the three persistence services and their stores |
| `core/src/plugins`, `core/src/context` | the global hook surface and context compaction |
| `core/src/tools`, `core/src/auth`, `core/src/skills` | tool definitions, auth flows, skill loading |
| `core/src/a2a`, `core/src/telemetry`, `core/src/cli` | protocol surface, OpenTelemetry, the eval runner |
| `dev/src` | `@google/adk-devtools`: CLI (`dev/src/cli/cli.ts`), HTTP API server, agent loader, conformance harness, replay plugin |
| `integrations/src` | a version export only at this commit (`integrations/src/index.ts:7`) |
| `tests` | `integration` and `e2e` suites plus `cross_language`, the latter including a Go A2A peer |
| `samples` | seventeen runnable agent folders, one per capability area |

The package exposes subpath entries so that optional concerns do not load the barrel:
`./a2a`, `./agents/agent-engine`, `./artifacts/gcs`, `./sessions/database`,
`./telemetry/gcp`, `./tools/mcp` and `./tools/webmcp` (`core/package.json:22-76`). The Node
entry installs a winston logger and the browser entry installs a browser logger, each in its
own file so the shared logger module stays environment-free (`core/src/index.ts:7-15`,
`core/src/index_web.ts:7-13`).

## Core abstractions

- **`BaseNode`** is the composition primitive (`core/src/workflow/base_node.ts:86`). A node
  declares `rerunOnResume`, `waitForOutput`, a retry config, a timeout, input, output and state
  schemas, and an isolation scope (`:47-68`). Its run loop normalises yields, and a
  `RequestInput` returned or yielded by the body becomes an interrupt event rather than a value.
- **`BaseAgent`** extends `BaseNode` (`core/src/agents/base_agent.ts:90-92`): every agent is
  a node, which is why workflows can host agents and agents can host agents. An agent has
  `subAgents` (`:144`), a parent set by the composer, before and after callbacks
  (`:162`, `:174`), and a `runAsync` wrapper that opens an OTel span around `runAsyncImpl`
  (`:254`). A before-callback that returns content skips the agent and sets `endInvocation`
  (`:154-157`), and a clone rebuilds the concrete class rather than the base (`:243-244`).
- **`LlmAgent`** owns the loop that matters: a fixed processor chain (`core/src/agents/llm_agent.ts:568`),
  an optional task mode in which the model must call `finish_task` with schema-validated
  arguments (`:369-373`, `:693`), and an output schema that cannot be combined with transfer
  configuration (`:660`). The composite agents `ParallelAgent`, `SequentialAgent` and `LoopAgent` still
  ship but are marked deprecated in favour of `Workflow`, for a stated reason: the graph adds
  routing, retries, HITL and resumability that the composites lack
  (`core/src/agents/parallel_agent.ts:42-50`).
- **`Workflow`** is the graph: a static `edges` list or a `dynamicEntry` function, a
  concurrency cap, and per-node state reconstructed from prior events on resume
  (`core/src/workflow/workflow.ts:137-167`, `:223-245`). Nodes can be functions, tools,
  parallel workers or joins (`core/src/workflow/nodes/*`), and `NodeTool` exposes a node as a
  tool so an agent can call into a graph.
- **`Runner`** drives one invocation. It resolves the session, appends the user turn, picks
  the agent to resume into, runs the agent generator, persists each event that is not partial,
  and seals an aborted run with synthesised events (`core/src/runner/runner.ts:291`, `:436`,
  `:567-586`, `:601`). `runEphemeral` is the same path without a stored session (`:248`).
- **`InvocationContext`** carries the run: session, services, plugin manager, the agent being
  run, run config and the resumption handle. It is the object every processor and callback
  receives, and the reason a service can be swapped without touching the loop.
- **`PluginManager`** is one ordered hook set registered on the runner (`core/src/plugins/plugin_manager.ts:36`).
  Where both exist, plugins run before the per-agent callback and the first non-`undefined`
  return short-circuits the rest (`:31`, `:110`, `core/src/agents/llm_agent.ts:2024-2052`).
- **Services** are three narrow interfaces: sessions, memory and artifacts. Each has an
  in-memory and a cloud implementation, and session and artifact services are reachable from a
  URI registry (`core/src/sessions/registry.ts:22`).

## One run's data flow

1. The caller constructs a `Runner` with an app name, a root agent and the three services,
   then iterates `runner.runAsync({userId, sessionId, newMessage, runConfig})`
   (`core/src/runner/runner.ts:291`).
2. The session is fetched or created (`core/src/sessions/base_session_service.ts:130`), and the
   user message is appended as an `Event` carrying its `stateDelta` after internal metadata is
   filtered out of it (`core/src/runner/runner.ts:412`).
3. `determineAgentForResumption` chooses the starting agent (`:937`). With resumability on and
   an unanswered function response in the log, it routes to that call's author; otherwise it
   picks the last routable agent, or the root when no agent is resolvable.
4. The `beforeRun` plugin runs (`core/src/plugins/plugin_manager.ts:146`), then the root agent's
   `runAsync` opens a span and runs its callbacks (`core/src/agents/base_agent.ts:254`).
5. `LlmAgent` builds the model request through a fixed processor order
   (`core/src/agents/llm_agent.ts:568`): base request, auth preprocessor, identity,
   instructions, pending confirmation resume, pending input, contents, planning, interactions,
   code execution and tool filtering, with compaction spliced in before contents when compactors
   are configured (`:585-604`) and the transfer tool appended last unless every transfer
   direction is disabled (`:613-620`).
6. The model call streams responses; `beforeModelCallback` and `afterModelCallback` fire with
   plugins first, so a plugin can pre-empt an agent's own model hook
   (`core/src/agents/llm_agent.ts:2024-2052`, `:2066-2079`).
7. Function calls are dispatched by `handleFunctionCallList` (`core/src/agents/functions.ts:535`),
   which checks confirmations and auth, runs before-tool plugins and callbacks, executes, then
   runs the after-tool side. A call that needs approval or user input ends the invocation
   instead of executing, and a long-running call is recorded in `longRunningToolIds`.
8. If the response carried a transfer action, the runner yields the function-response event and
   then runs the target agent's generator inline in the same invocation
   (`core/src/agents/llm_agent.ts:1405`), closing any live connection first and sleeping for a
   fixed one second (`:1398`, `:1409`).
9. Each event passes `processAndAppendEvent`: the `onEvent` plugin may modify it, and only a
   non-partial event is appended to the session (`core/src/runner/runner.ts:567-586`).
10. Ending the run runs `afterRun` (`core/src/plugins/plugin_manager.ts:161`); an abort is
    sealed with synthesised events so a cancelled run still has a terminal record
    (`core/src/runner/runner.ts:601`).

## State and persistence model

**The three records.** A `Session` holds an id, app name, user id, a state value, its events and
a last-update stamp, keyed with app name and user id (`core/src/sessions/session.ts:24-54`).
`State` separates a committed value from a pending delta, and reserves three key prefixes:
`app:`, `user:`, `temp:` (`core/src/sessions/state.ts:28-31`). Writes are validated against an
optional Zod schema and rejected with `StateSchemaError` (`:11`, `:74-85`), and each write is
stamped with an order marker so two concurrent commits cannot silently clobber each other
(`:127`).

**Append semantics.** `appendEvent` is the single write path
(`core/src/sessions/base_session_service.ts:169`). It refuses partial events, strips `temp:`
keys from the delta before applying it, applies a state delta only when the delta is newer
than the committed write (`:200`), and copies state into null-prototype maps so a
`__proto__` key from a client cannot reach the prototype chain (`:241`). App and user state is
promoted out of the session on write, and `mergeStates` namespaces it back on read (`:289`).

**Stores.** `InMemorySessionService` clones on read so a caller cannot mutate stored events
(`core/src/sessions/in_memory_session_service.ts:45`); `DatabaseSessionService` is MikroORM over
five entity tables (`core/src/sessions/database_session_service.ts:104`). The schema is a
cross-language contract: `schema_version` lives in `adk_internal_metadata`, keys are 191
characters wide, event payloads are snake_case JSON, and the header says adk-python reads the
same tables (`core/src/sessions/db/schema.ts:19-21`, `:40-46`, `:84-200`).

**Resumability.** `ResumabilityConfig{isResumable}` defaults to false
(`core/src/apps/resumability_config.ts`). When on, the runner treats the event log as the
state machine: a pending tool confirmation is found by scanning responses in scope, matched to
the pinned call, and re-executed before the next model turn
(`core/src/agents/processors/request_confirmation_llm_request_processor.ts:53`). Workflow
interrupts work the same way: a node returns a `RequestInput`, the run stops, and on resume
the workflow rehydrates node runs from events, applies the stored replies, fast-forwards
completed nodes and re-runs the waiting ones (`core/src/workflow/workflow.ts:233-256`).

**Artifacts.** An artifact is a named value with a version list; the first save is version 0 and
each save increments (`core/src/artifacts/base_artifact_service.ts:88-134`). The session-facing
interface is separate from the app-level one (`core/src/artifacts/session_artifact_service.ts:21`),
and `ScopedArtifactService` injects app, user and session identity so callers pass only a name
(`core/src/artifacts/scoped_artifact_service.ts:29`). Events record an `artifactDelta` of name
to version, which is how a UI learns that an artifact changed.

**Memory.** `BaseMemoryService` has exactly two operations: ingest a session, and search by a
natural-language query scoped to app and user (`core/src/memory/base_memory_service.ts:44-60`).
The in-memory implementation is keyword-shaped; the cloud implementations are Vertex Memory
Bank and Vertex RAG, both exported from the barrel (`core/src/index.ts:41-43`).

## Transport and streaming

A run is an async generator of `Event` objects; partial events are yielded but not stored, so a
client can render tokens without the session growing per chunk
(`core/src/runner/runner.ts:585`). `StreamingMode` offers `NONE`, `SSE` and a reserved
`BIDI`; `createRunConfig` rejects `BIDI` and bidirectional streaming is reached through
`Runner.runLive()` instead (`core/src/agents/run_config.ts:21-34`, `:69-71`). Live mode has its
own request queue, active streaming tools and transcription entries
(`core/src/agents/live_request_queue.ts`).

A2A is an Express mount: `toA2a` registers an agent card, JSON-RPC and REST handlers, uses
JSON-only body parsing so a browser preflight is required, and refuses to mount without an
authentication builder unless the caller sets `allowUnauthenticated`
(`core/src/a2a/agent_to_a2a.ts:179-249`). The executor maps session events onto A2A task,
artifact and status events and marks the run as remotely delivered
(`core/src/a2a/agent_executor.ts:173`); the client is `RemoteA2AAgent`
(`core/src/a2a/a2a_remote_agent.ts:129`). Agent-card resolution accepts an object, URL, file or
path and fails closed on insecure RPC, cross-origin RPC, link-local hosts and redirects
(`core/src/a2a/agent_card.ts:84-126`).

The dev server is a separate package: an Express app with session, event, artifact, eval and
graph routes plus `/run`, `/run_sse` and `/run_live` (`dev/src/server/adk_api_server.ts:448`,
`:1226-1360`, `:1494`), and an
agent loader that compiles an arbitrary TypeScript agent file with esbuild and shims
(`dev/src/utils/agent_loader.ts`).

## Build and test stack

- Build: `tsc` emits declarations only and `build.js` bundles each entry with esbuild; typedoc
  produces the API docs. The root scripts fan out with `--workspaces` (`package.json:13-16`).
- Tests: six Vitest projects — `unit:core`, `unit:dev`, `unit:integrations`,
  `integration`, `e2e` and `cross-language` (`vitest.config.ts:82-188`) — and coverage gates at
  92 statements, 85 branches, 94 functions and 92 lines (`:203-207`).
- CI: `validation.yaml` for the main gate, `cross-language-integration.yml` for the Go A2A
  interop, `license-check.yml`, `container-code-executor.yml` and `release-please.yml`
  (`.github/workflows/`).
- The dev package also ships a conformance harness: a registry of named tools, callbacks and
  plugins replayed against YAML scenarios, including a plugin that replays recorded model and
  tool responses so a scenario is deterministic (`dev/src/integration/replay_plugin.ts:16`).
