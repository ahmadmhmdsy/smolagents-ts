# OpenHands — architecture

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Runtime citations are relative to `reference/competitors/openhands-sdk/` and carry an `sdk:` prefix.
Client citations are relative to `reference/competitors/openhands/` and carry a `canvas:` prefix;
pages under that clone's documentation tree are written `clone:/docs/…` so no competitor path is
backticked with a leading `docs/`. The runtime is at `9cb22f553b6cf0de2475563916eead4089b8a6c0`; the
client at `b70dd46bd04158f24ff3906895dcf7d5275ac2aa`.

## Repository layout

| tree | contents | size signal |
|---|---|---|
| `openhands-sdk/openhands/sdk/` | event model, conversation, agent, LLM, tool contract, context and condensers, skills, subagents, workspace interface, MCP, hooks, plugins, profiles, settings | `agent/agent.py` 1,649 lines, `conversation/impl/local_conversation.py` 3,218, `llm/llm.py` 3,503 |
| `openhands-tools/openhands/tools/` | the tool suite as separate packages: terminal, file editor, apply patch, glob, grep, browser, task tracker, task, delegate, child conversation, planning editor, ask-an-oracle, workflow | 18 package directories |
| `openhands-workspace/openhands/workspace/` | workspace backends over the SDK interface: docker, apptainer, agent sandbox, cloud, remote API | docker 15,980 bytes, cloud 38,624 |
| `openhands-agent-server/openhands/agent_server/` | FastAPI server: conversation and event services, REST and WebSocket routers, persistence, leases, Docker runtime, init and ACP routes | `event_service.py` 2,410 lines, `conversation_service.py` 3,059 |
| `clients/typescript/` | browser-compatible client mirroring the server API | separate npm package |
| `examples/`, `tests/`, `scripts/` | runnable patterns, domain-split tests, packaging helpers | integration tests split into functional, behaviour, ACP and condenser families |
| Canvas `src/api`, `src/services`, `src/stores`, `src/hooks` | HTTP adapters, launch services, Zustand stores, feature hooks | `clone:/docs/architecture.md:37-43` describes the split |

The Python side is one `uv` workspace with a single lockfile and four distributable packages sharing
the `openhands.*` namespace. The TypeScript client is an independent npm package, so the wire contract
is the seam between them, not an import.

## Core abstractions

**Event.** Every state change is an `Event` with an id, a timestamp, a source and an optional parent
id. `LLMConvertibleEvent` marks the subset that can be rendered into messages for a completion
(`sdk:openhands-sdk/openhands/sdk/event/base.py:1-199`). The event package splits actions,
observations, messages, reasoning, system prompts, condensation, errors, hooks, security analysis,
streaming deltas and resume transcripts into separate modules, so the union is large and each member
is small.

**Conversation tree and view.** The event log is a tree, not a list: `ConversationState` keeps a
movable `leaf_event_id` HEAD and a `head_is_empty` flag, and events point at parents
(`sdk:openhands-sdk/openhands/sdk/conversation/state.py:175-189`). A `View` projection applies
condensation tombstones and keeps only the branch reachable from HEAD; the cached view is what the
agent sends to the model (`sdk:openhands-sdk/openhands/sdk/context/view/view.py`, referenced from
`context/condenser/README.md:21`).

**State.** `ConversationState` is the single mutable object behind a FIFO lock. It carries the agent,
the workspace, the persistence directory, the iteration cap, stuck detection, execution status,
confirmation policy, security analyzer, activated skills and path rules, blocked action and message
maps, the tree HEAD, usage statistics, a secret registry and tags
(`sdk:openhands-sdk/openhands/sdk/conversation/state.py:82-205`).

**Execution status.** `IDLE`, `RUNNING`, `PAUSED`, `WAITING_FOR_CONFIRMATION`, `FINISHED`, `ERROR`,
`STUCK` and `DELETING` (`sdk:openhands-sdk/openhands/sdk/conversation/state.py:48-60`). The run loop
tests these states between steps; the API exposes them as the conversation's observable condition.

**Workspace.** `BaseWorkspace` declares command execution with a timeout, file upload and download,
git changes and diff, plus optional pause and resume
(`sdk:openhands-sdk/openhands/sdk/workspace/base.py:171-282`). Implementations range from
`LocalWorkspace` over `subprocess` to a Docker container running the agent server, so the same
interface covers a host directory and a sandboxed HTTP service.

**Agent.** `AgentBase` owns prompts, tool map, state initialisation and the abstract step; `Agent`
adds condensation, response dispatch, security analysis, critic support and image fallback
(`sdk:openhands-sdk/openhands/sdk/agent/base.py:102`, `agent/agent.py:415`). Both a synchronous
`step()` and an asynchronous `astep()` exist, and the loop picks based on how the conversation runs.

**Conversation.** `BaseConversation` defines send, run, pause, interrupt and close; `LocalConversation`
implements them in-process and `RemoteConversation` mirrors them over HTTP and WebSocket
(`sdk:openhands-sdk/openhands/sdk/conversation/conversation.py:1-240`). `LocalConversation` is the
largest file in the SDK because it also owns plugins, MCP tool reconciliation, skill tools, fork and
navigate, persistence, hooks and the run loop.

**Condenser.** `CondenserBase` turns a view into either a smaller view or a `Condensation` event;
`RollingCondenser` adds a hard/soft requirement split and a hard-reset fallback; the shipped strategy
is `LLMSummarizingCondenser` with a separate summarisation LLM
(`sdk:openhands-sdk/openhands/sdk/context/condenser/base.py:16-198`,
`context/condenser/llm_summarizing_condenser.py:54`).

**Tool.** `ToolDefinition` binds an action model, an observation model, an executor and JSON-schema
annotations, and exposes `declared_resources()` so parallel execution can lock shared state
(`sdk:openhands-sdk/openhands/sdk/tool/tool.py:347-406`, `:529`).

**Server services.** `ConversationService` owns the catalogue of persisted conversations, worktree
creation, startup and resume; `EventService` owns one running conversation, its event log, its
subscribers, its run slot and its lease
(`sdk:openhands-agent-server/openhands/agent_server/conversation_service.py:531`,
`event_service.py:215-286`).

## One run, end to end

1. The client posts a start request with an agent spec, a workspace spec and settings; the server
   creates a `StoredConversation` and lazily an `EventService`.
2. `EventService.start()` loads or creates the conversation directory, claims a lease when leases are
   enabled, scrubs persisted credentials, ensures the workspace directory exists and is a git
   repository, and builds the `LocalConversation` (`sdk:…/agent_server/event_service.py:1203-1250`).
3. A user message becomes a `MessageEvent` appended to the log; the service schedules a run in the
   thread pool under a run slot and an admission semaphore.
4. `LocalConversation.arun()` takes the state lock, flips the status to `RUNNING` and enters the loop
   (`sdk:…/conversation/impl/local_conversation.py:2137-2201`).
5. Before each step the loop checks pause and stuck conditions, and calls `Agent.astep()`
   (`…/local_conversation.py:2240`, `:2316`).
6. `Agent.astep()` first executes any unmatched pending action — that is how an approved confirmation
   resumes — then resolves route metadata for token limits, and calls `prepare_llm_messages` with the
   condenser (`sdk:…/agent/agent.py:917-961`).
7. If the condenser returns a `Condensation`, the step emits it and returns; the next step rebuilds
   the view with the tombstone applied (`…/agent.py:959-961`).
8. Otherwise the step sends one completion request with the tool list, security-risk prediction and a
   token callback (`…/agent.py:993-1005`).
9. The response is classified as tool calls, content, reasoning-only or empty; provider errors for
   context overflow or malformed history are converted into a `CondensationRequest` instead of
   failing the run (`…/agent.py:1069-1083`).
10. For tool calls, each becomes an `ActionEvent`; a security analyzer scores it, the confirmation
    policy decides, and either the status becomes `WAITING_FOR_CONFIRMATION` or the tools execute
    (`…/agent.py:1160-1198`, `…/response_dispatch.py:154`).
11. Tool call batches may run concurrently through `ParallelToolExecutor`, which serialises calls that
    declare the same resources and parallels the rest (`sdk:…/agent/parallel_executor.py:51-126`).
12. Observations are appended, the view advances, and the loop samples again until content without
    tool calls finishes the task or an iteration, budget or stuck limit stops it
    (`…/local_conversation.py:2378-2412`).
13. `EventService` persists each event to disk, publishes it to subscribers and forwards token deltas
    on a separate fan-out that is never persisted (`…/agent_server/event_service.py:1269-1312`).
14. On completion the status is finalised, hooks may deny a stop and re-enter the loop, and the
    WebSocket session stream carries the durable frames with sequence numbers
    (`…/local_conversation.py:2216-2238`, `…/agent_server/session_socket.py:314-412`).

## State and persistence model

A conversation directory holds `meta.json` for client-owned metadata, `base_state.json` for the agent
and conversation settings — described in source as the single source of truth for the agent — and an
`events/` directory holding one JSON file per event, with a length marker so a fresh process can
rebuild its index without reading every file
(`sdk:…/agent_server/event_service.py:288-318`, `sdk:…/conversation/event_store.py:246-289`,
`sdk:…/conversation/persistence_const.py:5`). Settings persist separately with their own schema
version and migration chain; the persisted settings model is at version 6
(`sdk:…/agent_server/persistence/models.py:147-199`).

Three properties follow from this design. First, a crash between steps loses at most the step in
flight, because the event files are append-only and the state is re-derived from them. Second, resume
in a new process is just load-then-run, which is why the server can rebuild a conversation after a
restart. Third, branches are cheap: `fork()` deep-copies the log or copies the path to a chosen event,
and `navigate_to()` moves HEAD without deleting anything
(`sdk:…/local_conversation.py:814-852`, `:959-982`).

Concurrency is guarded by a lease per conversation and by run slots on the server, so two server
instances sharing a storage directory cannot both own a conversation. Subagent conversations inherit
the parent's persistence directory under a `subagents/` child
(`sdk:openhands-tools/openhands/tools/delegate/impl.py:207-217`).

## Transport and streaming

The server exposes REST under `/api` for conversations, events, settings, secrets, skills, workspaces,
git, MCP and ACP, and WebSockets under `/sockets`. The session socket is the interesting one: frames
are envelopes, durable events carry a monotonic `seq`, a reconnecting client passes `after_seq` and
receives the missing range from disk in pages of one hundred, and streaming deltas travel on a
separate channel because they are never persisted
(`sdk:…/agent_server/session_socket.py:1-8`, `:294-312`, `:314-412`).

Backpressure is deliberate: admission is byte-bounded, a slow consumer's connection is dropped rather
than a durable frame being discarded, and the client reconnects from its cursor
(`sdk:…/agent_server/session_socket.py:63-120`). Fan-out notifies subscribers concurrently so one
socket cannot block another (`sdk:…/agent_server/pub_sub.py:85-108`).

Canvas consumes the same protocol: its event store separates durable frames from delta frames,
reconciles out-of-order durable arrivals by sequence, retires provisional streaming text when the
durable event lands, and keeps a resume cursor for the session socket
(`canvas:src/stores/use-event-store.ts:97-105`, `canvas:src/utils/session-seq-cursor.ts:1-6`,
`canvas:src/utils/handle-event-for-ui.ts:16`, `:127`).

## Build and test stack

Python: `uv` workspace, Ruff at 88 columns, Pyright rather than mypy, pre-commit hooks, pytest split
into `tests/sdk`, `tests/tools`, `tests/workspace`, `tests/agent_server` and integration families for
behaviour, functional, ACP and condenser cases. A stress suite exercises parallel subagents, many
conversations, slow webhooks and WebSocket backpressure, and is excluded from default collection.
TypeScript: npm with an exact-pinned lockfile, lint, unit tests, application build and library build.
CI includes an OpenAPI diff against the previous server release with a five-minor-release deprecation
runway for REST breaks.

This read ran none of it. The stack is recorded because it is evidence of where their quality effort
concentrates: wire-contract compatibility and failure-mode stress, not model quality.
