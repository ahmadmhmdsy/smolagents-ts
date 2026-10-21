# cloudflare-agents — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Status vocabulary follows the method: `implemented` means the source path was traced end to end,
`declared` means a type, flag, test or document asserts the capability without a full trace here,
`inferred` means it is reasoned from structure. Every row cites this checkout.

## Host, lifecycle and durability

| capability | status | evidence | how it works and why it exists |
|---|---|---|---|
| agent host is a Durable Object | implemented | `packages/agents/src/index.ts:1106` | `Agent` extends the platform class and installs `Lifecycle` as a field (`:1114`); identity, storage, alarms and hibernation come from the host, not from the SDK |
| capability composition with ordered hooks | implemented | `packages/agents/src/lifecycle/durable-object-lifecycle.ts:289`, `:340-380` | `use()` registers a capability; capability `onStart` hooks run in registration order before the host hook (`design/durable-object-lifecycle.md:20-25`) so migrations finish before traffic |
| single alarm derived from a job queue | implemented | `packages/agents/src/lifecycle/job-queue.ts:205`, `:466` | one table (`cf_agents_jobs`) holds every due unit; `nextAlarmTime` folds exclusive, ready and hung-recheck candidates into one timestamp |
| job ownership and idempotent push | implemented | `job-queue.ts:242-253` | a same-id push only updates a row owned by the pushing capability, so two capabilities cannot clobber each other's work |
| exclusive jobs and deadman pre-arm | declared | `design/alarm-coordination.md:23-31` | an exclusive job suppresses other candidates while pending; a pre-alarm fires before the loop drives due work so a crash still wakes the object |
| hung-attempt detection | implemented | `job-queue.ts:169`, `design/lifecycle-work-queue.md:28` | single-flight jobs carry a hung timeout; the recheck candidate re-arms the alarm for a stuck attempt |
| memory-limit circuit breaker | declared | `durable-object-lifecycle.ts:225`, `design/alarm-coordination.md` | the driver is constructed with a memory-limit hook and a strike budget so repeated alarm OOMs stop re-arming |
| startup migration under `blockConcurrencyWhile` | implemented | `packages/agents/src/index.ts:1590`, `:1834`, `durable-object-lifecycle.ts:707` | every table and schema version is created before the first request; the version key makes the migration per-object and forward-only |
| fire-and-forget lifetime extension | implemented | `index.ts:3450`, `:3510` | `keepAlive()` and `keepAliveWhile()` hold the invocation open for work that outlives the handler (documented at `clone:/docs/agents/long-running-agents.md`) |
| compatibility with legacy run/fiber records | implemented | `index.ts:1615-1706` | legacy `cf_agents_workflows`, `cf_agents_runs`, `cf_agents_fibers` and `cf_agent_tool_runs` tables are created and kept for migration and recovery, not deleted |

## State, connections and memory

| capability | status | evidence | how it works and why it exists |
|---|---|---|---|
| one validated JSON state document | implemented | `packages/agents/src/state/index.ts:68`, `:129`, `:192` | `get` lazily loads with a corrupt-row fallback; `set` validates, persists, caches and notifies; one row means no merge policy to get wrong |
| bidirectional state sync | implemented | `index.ts:2572`, `:2618` | a server write broadcasts a `cf_agent_state` frame to every protocol connection except the sender; a client write enters the same validation path |
| readonly connections | implemented | `index.ts:2632`, `:2644`, `design/readonly-connections.md` | a connection can be marked readonly; `setState` throws inside that context (`:2619-2623`), so a viewer cannot mutate shared state |
| protocol opt-out for binary clients | implemented | `index.ts:2712` | `shouldSendProtocolMessages` lets MQTT-style clients suppress identity, state and MCP catalogue frames while keeping RPC |
| hibernating connection state | implemented | `packages/agents/src/websockets/connection.ts:291`, `connection-flags.ts:221` | tags, readonly and internal keys ride the platform attachment so a woke connection keeps its identity and permissions |
| session transcript persistence | implemented | `packages/agents/src/sessions/core.ts:147-188` | messages, chunked large parts, compaction records and config are four tables; large parts are chunked rather than dropped |
| transcript compaction | implemented | `sessions/compaction-helpers.ts:23` | a compaction record summarises older messages so the prompt has a bounded history without losing the transcript |
| attachment store | implemented | `sessions/attachment-store.ts:60-82` | metadata, chunks and references are separate tables so an attachment can outlive a turn and be referenced many times |
| durable context blocks | declared | `packages/agents/src/context/sqlite-provider.ts:38`, `:141` | context blocks persist in `cf_agents_context_blocks` and are searched for prompt assembly (`clone:/docs/agents/context.md`) |
| agent skills | implemented | `packages/agents/src/skills/registry.ts:95`, `runner.ts:1057` | a registry compiles `SKILL.md` sources from a manifest, R2 or workspace and exposes activation tools plus a runner |

## Scheduling and queues

| capability | status | evidence | how it works and why it exists |
|---|---|---|---|
| date, delay and cron schedules | implemented | `packages/agents/src/schedules/scheduler.ts:164`, `packages/agents/src/index.ts:3303` | `schedule(when, callback, payload)` parses the form, validates it and pushes a job whose `fn` is the callback name |
| intervals with idempotent registration | implemented | `index.ts:3345`, `:3322` | `scheduleEvery` is idempotent on callback, interval and payload, so calling it in `onStart` does not accumulate rows across wakes |
| recurrence after execution | implemented | `scheduler.ts:388-398` | cron reschedules from the wall clock, interval from the finish time; one-shots complete, and retry policy is applied before recurrence |
| schedule read and cancel APIs | implemented | `index.ts:3380`, `:3405`, `:3423` | async reads that work inside sub-agents; the deprecated synchronous variants throw across an object boundary |
| legacy schedule migration | implemented | `scheduler.ts:200-274` | old `cf_agents_schedules` rows are pushed into the job queue once and the old table is dropped |
| routed schedules for facets | implemented | `scheduler.ts:401`, `index.ts:3410-3418` | a facet's schedule is owned by the facet; dispatch and ownership checks cross the parent boundary, and deleting a sub-agent bulk-cleans its prefix |
| serial queue per key | implemented | `packages/agents/src/queue/queue.ts:118` | queue items run in order per key with retry through the same job machinery; `cf_agents_queues` holds them |

## Durable streams and chat resume

| capability | status | evidence | how it works and why it exists |
|---|---|---|---|
| durable append-only stream log | implemented | `packages/agents/src/streams/streams.ts:183`, `:222` | chunks are written as 256 KiB blocks (`:47`) under a 1 MiB chunk ceiling (`:52`); `open` is idempotent and tag-scoped (`:243`) |
| cursor reads with replay-then-tail | implemented | `streams.ts:274`, `:297`, `:330` | a reader supplies a sequence cursor, gets stored blocks, then live data with an explicit up-to-date signal; no consumer state is stored in the producer |
| SSE resume with `Last-Event-ID` | implemented | `streams/sse.ts:21`, `design/rfc-streams.md:70` | the stream's sequence number is the SSE event id, so a reconnecting `EventSource` resumes without a custom header |
| retention and cleanup | declared | `design/rfc-streams.md:106`, `:192` | completed streams keep a 10-minute grace window and abandoned ones an hour, swept by a queue job rather than an alarm |
| chat stream adapter | implemented | `packages/agents/src/chat/resumable-stream.ts:197` | maps turn lifecycle onto `Streams`, owns retention, and settles the stream atomically with the message write where possible (`:708-735`) |
| resume handshake | implemented | `chat/resume-handshake.ts:92`, `:131` | server half of the reconnect protocol: notify, then a decision tree across active, pending, pre-stream, terminal-replay and idle states |
| terminal replay after disconnect | implemented | `chat/resume-handshake.ts:290-347` | a turn that ended while nobody was connected leaves a pending terminal record; the next resume replays content and then the error on a resumed stream |
| chat recovery engine | implemented | `chat/recovery-engine.ts:398`, `chat/recovery-incident.ts:74`, `chat/stall-watchdog.ts` | interrupted turns are detected, budgeted and resumed; a watchdog aborts a stalled stream; the host cannot disable durable recovery |
| two chat hosts on one layer | implemented | `packages/ai-chat/src/index.ts`, `packages/think/src/think.ts`, `design/chat-shared-layer.md:3` | `AIChatAgent` and `Think` share `agents/chat` for streaming, persistence and protocol, diverging only in host-owned pieces |

## Tasks: durable replayable execution

| capability | status | evidence | how it works and why it exists |
|---|---|---|---|
| accepted runs with idempotent identity | implemented | `packages/agents/src/tasks/tasks.ts:365`, `:388` | `run` accepts a definition plus input once per `runId` or idempotency key and hands back a handle |
| replay from the top | implemented | `tasks.ts:224-226`, `design/rfc-fibers.md:65` | every attempt re-executes the handler; completed steps return journaled results and sleeps read persisted deadlines |
| generation fencing | implemented | `tasks/store.ts:47`, `design/rfc-fibers.md:52` | each claim writes a generation and every write is fenced by it, so a stale attempt cannot commit over a newer one |
| claim backstop | implemented | `tasks.ts:116`, `:482`, `:505` | a live attempt pushes its claim deadline forward; if the isolate dies the deadline wakes the object and the run is reclaimed |
| interruption evidence | declared | `design/rfc-fibers.md:74` | `step.interrupted` records the step name and attempt so a handler can tell a replay from a first run |
| step-based retry and timeouts | implemented | `tasks/replay.ts`, `tasks/engine-port.ts` | retry is per step, with an engine port so a host can replace the driver; the design record is `design/rfc-fibers.md` |

## Sub-agents, facets and agent-tools

| capability | status | evidence | how it works and why it exists |
|---|---|---|---|
| sub-agent as a facet | implemented | `packages/agents/src/index.ts:5637`, `design/rfc-sub-agents.md:17-21` | `subAgent(Cls, name)` gets or creates a child Durable Object colocated on the parent's machine, with its own storage |
| typed stub that hides host methods | implemented | `design/rfc-sub-agents.md:57-65`, `index.ts:5637` | the stub exposes the child's user methods and excludes `keyof Agent`, so a caller cannot reach framework internals by accident |
| parent direction and path | implemented | `index.ts:5482`, `:5414`, `:5423` | `parentAgent(Cls)` opens a stub upward and `parentPath`/`selfPath` expose the chain for logging and routing |
| nested URL routing | implemented | `packages/agents/src/sub-routing.ts`, `agent-routing.ts` | `/agents/{parent}/{name}/sub/{child}/{name}` resolves to the facet; the parent strips the prefix and forwards |
| access gate | implemented | `index.ts:5299` | `onBeforeSubAgent(request, child)` may rewrite the request, return a response, or allow |
| facet lifecycle operations | declared | `packages/agents/src/dynamic-agents/dynamic-agents.ts:798`, `:815` | abort and delete exist on the manager; deleting a sub-agent also cleans root-owned bookkeeping for its prefix |
| awaited agent-tool runs | implemented | `index.ts:5684`, `agent-tools.ts` | a chat agent can be invoked as a tool, with the parent owning the run record and the child owning the turn |
| detached agent-tool runs | implemented | `index.ts:5684-5698`, `:6476` | a detached run survives the parent request; a reconcile tick re-attaches it and `inspectAgentToolRun` reads its snapshot |
| progress reporting from a child | implemented | `index.ts:5675`, `:5661` | `reportProgress` emits an ephemeral `data-agent-progress` part and persists a latest-wins snapshot for recovery |

## Human-in-the-loop

| capability | status | evidence | how it works and why it exists |
|---|---|---|---|
| approval gate on a connector call | implemented | `packages/codemode/src/connectors/base.ts:28`, `:156-172` | `requiresApproval` marks a method; a gated call returns a control marker instead of executing |
| pause as a normal tool output | implemented | `packages/think/src/think.ts:16090-16105`, `design/think-execute-hitl.md:11` | the turn ends naturally with `{status:"paused", executionId, pending}` as the tool result, so no special pause frame or loop state exists |
| approve, reject and list from a client | implemented | `think.ts:16181`, `:16343`, `:16117`, `:16099` | `approveExecution`/`rejectExecution` are `@callable`; `pendingExecutions` and `pendingApprovals` reconcile approval cards on load |
| idempotent approval claim | implemented | `think.ts:16215-16236` | approving deletes the pending row first, so tabs or retries cannot double-run a side effect; the outcome replaces the paused part |
| durable-pause action approvals | implemented | `think.ts:16204-16236` | a parked action keeps its descriptor and runs through a ledger on approval, with authorization taken at pause time |
| stale pause expiry | implemented | `packages/codemode/src/proxy-tool.ts:82` | `expirePaused(maxAgeMs)` sweeps abandoned pauses so a forgotten card cannot resume months later |
| transcript truncation of paused args | implemented | `packages/think/src/tools/execute.ts:257-268` | the model-facing paused output truncates large arguments while the runtime facet keeps the full args for the real resume |
| approval mapping from the AI SDK | implemented | `design/think-execute-hitl.md:25` | `ToolSetConnector` maps `needsApproval` onto the connector's `requiresApproval`, so hosts keep one vocabulary |

## MCP

| capability | status | evidence | how it works and why it exists |
|---|---|---|---|
| stateless MCP server | implemented | `packages/agents/src/mcp/server/handler-stateless.ts:134` | wraps an SDK v2 server factory in a Worker route with CORS, auth context and a stateless/legacy dispatch; no session state exists |
| legacy compatibility lane | implemented | `handler-stateless.ts:177`, `mcp/server/handler-legacy-compat.ts`, `design/mcp.md:9` | old protocol requests are answered without a session; GET and DELETE are rejected and server-initiated sampling fails |
| sessionful legacy server | implemented | `packages/agents/src/mcp/server/legacy-agent.ts` | `McpAgent` keeps the SDK v1 session, SSE transport and a durable event store for replay |
| explicit package boundaries | declared | `design/mcp.md:5-21` | Stateless, Legacy and Legacy compatibility are separate terms; `McpServer` stays owned by the upstream package and is not re-exported |
| host and origin validation | implemented | `handler-stateless.ts:195-245` | a Host header must be establishable and an Origin must be localhost, the workers.dev host or the configured CORS origin; requests without Origin stay valid |
| client manager with persisted servers | implemented | `packages/agents/src/mcp/client/index.ts:389`, `:438`, `:539` | servers persist in `cf_agents_mcp_servers` with URL, auth, options and capabilities and are restored in `onStart` before work |
| OAuth continuation | implemented | `mcp/client/connection.ts:49-54`, `mcp/client/do-oauth-client-provider.ts` | connection state models `AUTHENTICATING`; the auth continuation persists so a callback landing after hibernation still completes |
| tool catalogue and namespaced invocation | implemented | `mcp/client/index.ts:2030`, `:2376` | tools from many servers are aggregated under a namespace prefix and invoked through the same manager |
| x402 payment support | declared | `mcp/client/x402.ts:275-300` | a tool call that requires payment is retried with an encoded payment token carried in a reserved field |

## Tools, integrations and observability

| capability | status | evidence | how it works and why it exists |
|---|---|---|---|
| codemode execute tool | implemented | `packages/think/src/tools/execute.ts:237`, `packages/codemode/src/executor.ts:464` | the model writes a program over connector namespaces; a sandbox executes it and returns one result, which collapses many tool round trips |
| connector catalogue | implemented | `packages/codemode/src/connectors/base.ts`, `toolset.ts` | connectors expose typed methods, search and describe helpers so the model can discover what a program may call |
| browser automation | declared | `packages/agents/src/browser/browser.ts:200`, `browser/cdp-connection.ts` | a named persistent browser rides a capability with a session store and sweep, driven over CDP |
| web search and fetch tools | implemented | `packages/agents/src/web/search/index.ts`, `web/fetch/index.ts` | AI SDK, pi and TanStack adapters over platform services, with a shared URL policy |
| email ingress and sending | declared | `packages/agents/src/email.ts`, `email-send.ts` | signature-checked email is routed to an agent and replies are sent through the Email binding |
| workflows integration | declared | `packages/agents/src/workflows.ts:79` | `AgentWorkflow` bridges the Workflows product to an agent instance |
| webhooks and push notifications | declared | `clone:/docs/agents/webhooks.md`, `clone:/docs/agents/push-notifications.md` | documented ingress and notification paths; no source trace in this read |
| observability events | implemented | `packages/agents/src/observability/agent.ts:7` | lifecycle and capability events are forwarded to an event sink; schema version is independent of the package version |
| voice stack | declared | `packages/agents/src/voice/index.ts:289`, `voice/sfu.ts` | server mixins, provider contracts, Workers AI providers and an SFU bridge |

## Client and surface

| capability | status | evidence | how it works and why it exists |
|---|---|---|---|
| WebSocket agent client | implemented | `packages/agents/src/client.ts:492` | `AgentClient` over partysocket with reconnect, state cache and RPC stubs |
| React hooks | implemented | `packages/agents/src/react.tsx:352` | `useAgent` exposes state, RPC and sub-agent routing with cache TTL |
| callable RPC | implemented | `packages/agents/src/callable-decorator.ts:25`, `serializable.ts:47` | `@callable()` marks a method; `Serializable` types constrain arguments, and the client gets a typed stub |
| sub-agent selection from the client | declared | `packages/agents/src/sub-routing.ts:172`, `react.tsx:352` | `useAgent({sub: [...]})` addresses a facet through the nested route |
| framework-neutral chat transport | implemented | `packages/agents/src/chat/ws-chat-transport.ts`, `chat/react.tsx` | the AI SDK transport and React hooks that consume the protocol, kept in a separate subpath so core does not depend on React |
| Hono adapter | declared | `packages/hono-agents` | mounts agent routing in a Hono app |

## Platform, docs and distribution

| capability | status | evidence | how it works and why it exists |
|---|---|---|---|
| many narrow package entry points | implemented | `packages/agents/package.json` | 77 subpath exports, each with a build entry and an export check; peers such as `ai` and `react` are optional |
| runnable examples | declared | `examples/` | 56 example directories, including a playground that exercises most features |
| published documentation | declared | `clone:/docs/agents/` | 49 pages, Diátaxis-structured, with an upstream sync rule in `clone:/docs/AGENTS.md` |
| release process | declared | `.changeset/`, `.github/workflows/release.yml` | changesets gate public API changes; CI runs build, check and affected tests before publish |
| durable test harness | implemented | `packages/agents/src/e2e-tests/` | e2e tests kill and restart objects to prove recovery, and a coverage matrix maps feature to layer |
| experimental harness tree | declared | `packages/agents/src/harness/` | hosts for CLI agents (Claude Code, Codex) in containers, plus a session store; listed, not read here |

## Notable implementation notes

- **Durability is a host property, not a loop property.** There is no agent-loop checkpoint file in
  the sense `RunStore` gives us: the loop is the host's `fetch`/alarm handler, and the durable
  artifacts are the job row, the task step, the stream block and the session message. A process
  can be evicted between any two awaits because each of those is committed before the await
  returns.
- **The alarm is a single shared resource that every feature composes with.** Schedules, retries,
  retention sweeps, recovery ticks and detached reconcile work all push jobs rather than arming
  timers. The cost is that one misbehaving job can delay every other due job, which is why the
  driver has exclusive jobs, a hung recheck and a memory-limit breaker.
- **Streams and tasks are different durability primitives.** Streams durably keep *data* for a
  reader that may reconnect later; tasks durably keep *control flow* for an attempt that may be
  replayed. Chat needs both, which is why the chat layer is the largest subsystem.
- **Sub-agents are isolation by construction.** A facet is a real object with its own SQLite, so
  there is no serializer, no shared mutable state and no in-process boundary to enforce.
- **HITL is expressed as model-visible output.** The pause is a tool result, not a framework
  suspension, so the transcript, the client and the model all agree on what happened without a
  side channel; the durable claim makes approval idempotent.
- **Backwards compatibility is paid in code, not hidden.** Three MCP lanes, two scheduling
  generations, deprecated synchronous schedule getters, legacy run/fiber tables and a legacy
  chat-stream schema fold all remain in the tree.
- **Migration is per object and forward-only.** Schema versions live in the object's SQLite; a
  fleet upgrade races nothing because each object migrates under `blockConcurrencyWhile` on its
  next wake.
- **The design tree carries the invariants.** Ordering, alarm arbitration and recovery budgets are
  written in `design/` RFCs, including a 2,793-line chat-recovery record; code comments point back
  to those documents instead of restating them.
