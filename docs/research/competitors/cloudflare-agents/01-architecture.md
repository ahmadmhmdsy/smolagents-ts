# cloudflare-agents — architecture

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository layout

The clone is a pnpm workspace orchestrated by Nx. `packages/agents` is the core and everything
else either hosts it or extends it:

| path | contents |
|---|---|
| `packages/agents/src/index.ts` | the `Agent` host class (10,390 lines): state, RPC, schedules, sub-agent routing, agent-tools, email, workflows |
| `packages/agents/src/lifecycle/` | the vendored runtime substrate: lifecycle, capability contract, job queue, job driver, host context |
| `packages/agents/src/state/, streams/, tasks/, schedules/, websockets/, sessions/, mcp/, dynamic-agents/, queue/, context/, skills/` | one capability per directory, each owning its own tables |
| `packages/agents/src/chat/` | the shared chat layer: turn queue, resumable stream adapter, resume handshake, recovery engine, protocol constants |
| `packages/agents/src/routing/, sub-routing.ts, agent-routing.ts` | URL routing for top-level agents and nested facets |
| `packages/ai-chat/` and `packages/think/` | the two chat hosts; `Think` is a 19,982-line class, `AIChatAgent` a 7,825-line one |
| `packages/codemode/` | model-written programs over connectors, with a durable pause/approve runtime |
| `packages/voice/, hono-agents/, fake-model/, worker-bundler/, shell/` | voice stack, Hono adapter, test model, bundler, deprecated workspace shell |
| `design/` | RFCs and architecture records, including a 2,793-line chat-recovery foundation RFC |
| `clone:/docs/agents/` | 49 pages of published documentation |
| `examples/, guides/, openai-sdk/, experimental/, site/` | demos, tutorials, SDK examples, unshipped experiments, deployed sites |

## The host primitive: an Agent is a Durable Object

`Agent` extends `DurableObject` (`packages/agents/src/index.ts:1106`) and holds a `Lifecycle`
installed as a field initializer (`:1114`). The constructor (`:1863`) wires a route transport
(`:1867`), an event sink that forwards lifecycle events into observability (`:1874`), and a host
invoker that runs capability callbacks inside the agent's tracing scope (`:1892`). It then
constructs the scheduler (`:1904`), queue (`:1933`), tasks (`:1958`), schema migration
(`:2001-2018`) and the MCP client manager (`:1990`), and registers seven capabilities on the
lifecycle in one chain (`:2032-2041`).

`Lifecycle.install` (`packages/agents/src/lifecycle/durable-object-lifecycle.ts:196`) replaces
the object's handlers and installs the runtime ones (`:252`): fetch (`:523`), WebSocket message
(`:582`), start (`:659`), alarm (`:850`) and a WebSocket upgrade entry. Startup runs inside
`blockConcurrencyWhile` (`:707`): capability `onStart` hooks first, then the host's own hook
(`:714`), so a capability's migrations finish before application code sees work.

The host context is an `AsyncLocalStorage` exposed as `getCurrentAgent()` (`:1011`), which is how
a scheduled callback or a capability can reach the agent instance without a global. Identity is
not stored by the framework: it is the Durable Object's own name, read from `ctx.id.name`, and
the `name` getter (`:5391`) maps it back to the logical name through the facet path.

## Capabilities, the extension seam

A capability is a class over the lifecycle with named hooks; `use()` (`:289`) registers it and
routes unmatched events to it. Table rows cite the implementation of each:

| capability | source | durable state | role |
|---|---|---|---|
| `State` | `packages/agents/src/state/index.ts:68` | `cf_agents_state` | one validated JSON document per agent, broadcast on change |
| `WebSockets` | `packages/agents/src/websockets/websockets.ts` | connection attachments | hibernating connections, tags, protocol frames |
| `Scheduler` | `packages/agents/src/schedules/scheduler.ts:164` | job queue | cron, date and interval schedules over named callbacks |
| `Queue` | `packages/agents/src/queue/queue.ts` | `cf_agents_queues` | serial per-key work queues with retry |
| `Tasks` | `packages/agents/src/tasks/tasks.ts:231` | `cf_agents_task_runs/steps` | replayable, journaled, generation-fenced execution |
| `Streams` | `packages/agents/src/streams/streams.ts:183` | `cf_agents_streams/blocks` | durable append-only log with cursors and blocking reads |
| `Sessions` | `packages/agents/src/sessions/core.ts` | six `cf_agents_session_*` tables | messages, chunks, compactions, config, attachments |
| `MCPClientManager` | `packages/agents/src/mcp/client/index.ts:389` | `cf_agents_mcp_servers` | connects an agent to remote MCP servers |
| `DynamicAgents` | `packages/agents/src/dynamic-agents/dynamic-agents.ts` | `cf_agents_sub_agents` | creates and routes facet sub-agents |

Ordering is load-bearing: `state` is installed before `websockets` because connection protocol
frames carry state, `tasks` after `mcp` because a chat host may start a task that needs a tool
catalogue, and `dynamicAgents` last because it only contributes services. The repository's own
`design/rfc-durable-object-lifecycle.md` states the ordering rule and the catch-all behaviour;
that document is `declared` evidence for why the order cannot be permuted freely.

## One alarm, one queue

A Durable Object has exactly one alarm, so the substrate turns it into a scheduler for arbitrary
work. `JobQueue` (`packages/agents/src/lifecycle/job-queue.ts:182`) owns one table:

- `cf_agents_jobs` (`:205-219`) holds `id, capability, fn, time, payload, retry_options,
  singleflight, hung_timeout_seconds, exclusive, recovery_loop, running, execution_started_at`.
  It is `WITHOUT ROWID` (`:219`) and keyed by `id` alone.
- `push` (`:223`) upserts on `id` but only while the row's `capability` matches the pusher
  (`:242-253`), so two capabilities cannot overwrite each other's work; a same-id push also clears
  any in-flight dispatch marker so newer durable intent wins (`:251-252`).
- `cancel` (`:281`) and `reschedule` (`:296`) are owner-scoped the same way.
- `nextAlarmTime` (`:466`) computes one timestamp from three candidate sets: exclusive jobs
  (`:468`), ready jobs (`:478`) and the hung-timeout recheck for in-flight single-flight work
  (`:490-494`), so a stuck attempt still wakes the object even with no due row.

`JobDriver` (`packages/agents/src/lifecycle/job-driver.ts`) is the loop the alarm runs: claim,
dispatch through the owning capability's `onJob`, settle with retry, deferral or reschedule, then
re-arm. The lifecycle constructs it with the queue in its constructor
(`durable-object-lifecycle.ts:218`), forwards `alarm()` to `runAlarm` (`:850`) and resolves the
dispatch target from the job's capability (`:865`). A memory-limit circuit breaker with a strike
budget guards the alarm (#1825 per the design record), and `abortWithoutAlarmRetry` (`:240`)
exists so a reset does not re-arm a retry the driver did not intend.

The payoff is that a capability never owns a timer. It pushes a row, tells the lifecycle the row
changed, and the lifecycle derives the next physical alarm from the table. That is why schedules,
tasks, retries and cleanup can all be one mechanism.

## Scheduling

`Scheduler` (`packages/agents/src/schedules/scheduler.ts:164`) is a vocabulary over the job queue.
It parses a date, a delay, a cron expression or an interval, validates it, resolves the named
callback and pushes a job whose `fn` is the callback name (`:842`). Recurrence is decided after
each run (`:388-398`): cron and interval jobs reschedule from the current clock, one-shots
complete. `onStart` migrates legacy rows out of the old `cf_agents_schedules` table and drops it
(`:200-274`), which is why a 0.29 install can read a 0.1 database.

`Agent#schedule` delegates to it (`packages/agents/src/index.ts:3303`), as do
`scheduleEvery` (`:3345`), `getScheduleById` (`:3380`), `listSchedules` (`:3405`) and
`cancelSchedule` (`:3423`). The synchronous `getSchedule`/`getSchedules` are deprecated because
they cannot cross a Durable Object boundary (`:3364-3394`). Schedules are owner-scoped: a facet's
schedule belongs to the facet, and a root-owned dispatch handles routed work
(`scheduler.ts:401`), which is what makes `this.schedule()` inside a sub-agent work at all.

## State

`State` (`packages/agents/src/state/index.ts:68`) is deliberately small: one row, one schema
version key (`:41`), one table (`:110-115`). `get()` (`:129`) lazily loads and falls back to the
initial value when the row is missing or corrupt; `set()` (`:192`) validates through the host's
`validateStateChange`, persists, updates the cache and calls `onChanged`. The host then broadcasts
the new state to every protocol-enabled connection except the sender
(`packages/agents/src/index.ts:2572`) and runs the persistence hook on `waitUntil` so a slow
listener cannot delay the write (`:2588-2610`).

`setState` (`:2618`) refuses to run inside a readonly connection context (`:2619-2623`), which is
the enforcement point for the readonly-connection feature; client-originated state changes are
validated by the same synchronous hook (`:2739`). There is no state history: a single JSON
document is the whole model, and facets keep their own.

## Streams

`Streams` (`packages/agents/src/streams/streams.ts:183`) is a durable append-only log, not a
buffer: the header comment states the design constraints directly (`:1-14`) — block tables, no
alarm involvement, in-isolate fanout for live readers. Chunks are cut into 256 KiB blocks
(`:47`), a write is capped at 1 MiB (`:52`, `DEFAULT_MAX_CHUNK_BYTES`), and every chunk carries
a monotonically increasing sequence number so a reader has a cursor rather than an offset.

`open()` (`:222`) is idempotent and rejects a tag conflict (`:243`); `read()` (`:274`) takes a
cursor, and `readBatches()` (`:297`) implements replay-then-tail: deliver stored blocks, then
switch to live delivery while reporting that the reader is up to date (`:330`). `status` and
`list` (`:364`, `:371`) expose the log's bounds. Rows live in `cf_agents_streams` (`:256`) and
`cf_agents_stream_blocks` (`:1076`); a legacy single-table layout (`cf_agents_stream_chunks`) is
still folded in on read (`:188-192`).

## Tasks: durable replay

`Tasks` (`packages/agents/src/tasks/tasks.ts:231`) is the control-flow counterpart. A definition
runs from the beginning on every attempt (`:224-226`): completed steps return journaled results,
sleeps consult persisted deadlines, and interrupted work replays. A run is accepted and driven by
a claim with a deadline derived from the step budget (`:116`); the claim is pushed forward while
the attempt is live (`:482-487`) and acts as the recovery backstop if the process dies. Writes
are generation-fenced (`packages/agents/src/tasks/store.ts:47`), so a stale attempt cannot commit
over a newer one, and an idempotency key or run id makes acceptance idempotent (`:388`). Runs and
steps live in `cf_agents_task_runs` and `cf_agents_task_steps` (`store.ts:97`, `:134`).

The important shape is that this is a *journal*, not a checkpoint: the unit of durability is a
step whose result is written once and replayed thereafter, and the replay path is the same code
path as the first execution.

## WebSockets and connection state

The `WebSockets` capability (774 lines) owns hibernating connections. An upgrade is accepted
through the lifecycle's `acceptWebSocket` service (`durable-object-lifecycle.ts:354`), and all
per-connection state rides the platform attachment, so a hibernated connection wakes with its
tags, readonly flag and internal keys intact (`websockets/connection.ts:291`,
`connection-flags.ts:221`). The capability carries the wire protocol but `Agent` drives the
connect sequence because it must decide whether a connection belongs to a facet
(`index.ts:1144-1161`). State sync, identity and MCP catalog frames are all protocol text frames;
`shouldSendProtocolMessages` (`:2712`) lets binary-only clients opt out.

## Sub-agents are facets

A child agent is a Durable Object facet of its parent: same machine, own SQLite, own alarm-less
lifecycle that routes through the parent. `subAgent(Cls, name)` (`index.ts:5637`) resolves or
creates it and returns a typed stub that exposes the child's user methods while hiding
`keyof Agent`. `parentAgent(Cls)` (`:5482`) is the symmetric stub upward; `parentPath` and
`selfPath` (`:5414`, `:5423`) expose the chain. Initialization goes through `_cf_initAsFacet`
(`:5383`), which records the child in `cf_agents_sub_agents` (`dynamic-agents/registry.ts:56`).
Clients reach a child by URL: `/agents/{parent}/{name}/sub/{child}/{name}` (`sub-routing.ts`, 552
lines). `onBeforeSubAgent` (`:5299`) is the access gate, and the repository documents a loopback
pattern for dynamic isolates (`design/loopback.md`).

The design consequence: isolation is free because a facet is a real object with its own storage,
and composition is a typed RPC call because the parent holds a stub.

## MCP: three lanes

MCP support is split by protocol era, and the split is visible in the entry points:

- **Stateless** — `createStatelessMcpHandler` (`packages/agents/src/mcp/server/handler-stateless.ts:134`)
  wraps an SDK v2 server factory. It rejects v1-only options with an explanatory error
  (`:144-161`) and can serve a legacy-compatibility lane beside the stateless one (`:177`).
- **Legacy** — `McpAgent` (`mcp/server/legacy-agent.ts`, 713 lines) with the sessionful
  transport, event store and SSE keepalive under `mcp/server/`.
- **Legacy compatibility** — a v2 transport that answers old clients without sessions
  (`handler-legacy-compat.ts`); GET and DELETE are rejected and server-initiated sampling or
  elicitation cannot be delivered.

Host and origin validation default on: the stateless handler rejects an unestablishable Host
(`:195-215`) and validates Origin against localhost, the workers.dev host and configured CORS
(`:217-245`). The client manager persists servers in `cf_agents_mcp_servers`
(`mcp/client/index.ts:539`), restores them in `onStart` (`:438`) and keeps an OAuth continuation
(`:1493`).

## Chat and resumable streaming

The chat layer (`packages/agents/src/chat/`) is shared by both hosts. A turn is serialised
through a `TurnQueue`; chunks append to a `ResumableStream` (`chat/resumable-stream.ts:197`) over
`Streams`; a `ResumeHandshake` (`chat/resume-handshake.ts:92`) implements notify (`:108`), the
request tree (`:131`) and the ACK tree (`:229`). The frames are constants at
`chat/protocol.ts:18-47`.

Recovery is its own subsystem: engine (`chat/recovery-engine.ts:398`), incident budgets, stall
watchdog and codec. `ChatRecoveryConfig` cannot be disabled, so every chat host pays for it.

## One run's data flow: a chat turn

1. A client opens a WebSocket. `Lifecycle#fetch` (`durable-object-lifecycle.ts:523`) accepts the
   upgrade through the `WebSockets` service and the connection is registered with its attachment.
2. `Agent` sends identity (`cf_agent_identity`) and the current state frame; if a stream is live,
   `ResumeHandshake#notifyStreamResuming` offers a resume (`chat/resume-handshake.ts:108`).
3. The client sends `cf_agent_use_chat_request`; the host enqueues the turn on its `TurnQueue` so
   turns for one agent are serialised.
4. The host calls the model through the AI SDK, streaming deltas.
5. Each delta is appended to the active `ResumableStream`, which writes blocks through `Streams`
   and fans the chunk out to live sockets.
6. If the socket drops, the client reconnects and sends `cf_agent_stream_resume_request`; the
   handshake answers with `STREAM_RESUMING`, `STREAM_PENDING`, `STREAM_RESUME_NONE` or a terminal
   replay depending on which of active, pending, terminal or pre-stream state exists (`:131-188`).
7. The client ACKs; the server replays stored blocks from the client's cursor and then tails live
   data (`chat/resume-handshake.ts:229-279`, `streams.ts:297`).
8. On completion the host persists messages and parts into the `Sessions` tables, settles the
   stream atomically with the message write where possible (`resumable-stream.ts:708-735`) and
   broadcasts the terminal frame.
9. If the object is evicted mid-turn, the alarm wakes it and the `Tasks` journal replays the
   completed steps.
10. A turn interrupted with no client connected leaves a pending terminal record; the next resume
    delivers it on a replayed stream (`:290-347`).
11. Schedules, queue items and agent-tool calls repeat this shape one level down.
12. State changes broadcast to every protocol connection except the sender (`index.ts:2577-2583`).

## State and persistence model

Every durable fact is a SQLite table in the object that owns it. The inventory at this commit:

| table | owner | holds |
|---|---|---|
| `cf_agents_state` | `State` | the agent's single JSON document plus a schema version key |
| `cf_agents_jobs` | `Lifecycle` | every due unit of work for every capability |
| `cf_agents_streams`, `cf_agents_stream_blocks` | `Streams` | stream metadata and 256 KiB blocks with sequence cursors |
| `cf_agents_task_runs`, `cf_agents_task_steps` | `Tasks` | run acceptance, claims, generations and journaled step results |
| `cf_agents_mcp_servers` | `MCPClientManager` | server URL, auth continuation, options and capabilities |
| `cf_agents_session_messages`, `..._message_chunks`, `..._compactions`, `..._config` | `Sessions` | transcript, chunked large parts, compaction records, per-agent config |
| `cf_agents_session_attachment_*` | `Sessions` | attachment metadata, chunks and references |
| `cf_agents_sub_agents` | `DynamicAgents` | the facet registry: class, name and path |
| `cf_agents_context_blocks` | `context` | durable context blocks for prompt assembly |
| `cf_agents_queues` | `Queue` | ordered queue items |
| `cf_agents_workflows`, `cf_agents_runs`, `cf_agents_facet_runs`, `cf_agents_fibers`, `cf_agent_tool_runs` | `Agent` | legacy workflow, run, fiber and agent-tool records kept for migration and recovery |
| `cf_agents_schedules` | legacy | read only by the scheduler's migration, then dropped |

Two properties follow. First, eviction cannot lose accepted work: acceptance and the queue row
are in the same database. Second, the schema is per-object and migrated at startup under
`blockConcurrencyWhile` (`index.ts:1590` keeps the migrations and `:1834` reads the version), so a
fleet upgrade is a per-object forward migration, not a global one.

## Transport and streaming

- **WebSocket** carries state sync, identity, RPC, streamed responses, approval and chat;
  `AgentClient` (`client.ts:492`) and `useAgent` (`react.tsx:352`) are the browser side.
- **SSE** (`streams/sse.ts:21`) lets a client consume a durable stream without a socket.
- **HTTP** routes requests (`agent-routing.ts`) and serves MCP handlers inside a Worker.
- **Email, webhooks and workflows** are further ingress paths with their own docs pages.
- **RPC** is gated by `@callable()` (`callable-decorator.ts:25`) over `Serializable` types.

## Build and test stack

`tsdown` builds ESM with type declarations from entries declared in `packages/agents/scripts/build.ts`;
`check:exports` verifies that every `package.json` export has a built file. Formatting and linting
are oxfmt and oxlint. Tests are Vitest, mostly inside the Workers runtime through
`@cloudflare/vitest-pool-workers`, split into projects (workers, node, react, voice, channels,
chat primitives, x402, browser, webmcp) plus a type-level suite and an e2e suite that kills
processes to test recovery. `design/test-coverage-matrix.md` maps features to the layer that
proves them.

