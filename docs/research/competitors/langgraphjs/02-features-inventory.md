# LangGraph.js — capability inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Status vocabulary from the method: `implemented` means an end-to-end source path
was traced; `declared` means a type, flag or document asserts it and no path
was traced; `inferred` means the behaviour is reasoned from structure. Every
row names the clone-relative file and line where the capability lives.

## Graph authoring

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| typed state graph | implemented | `libs/langgraph-core/src/graph/state.ts:404` | a builder collects schema, nodes, edges and branches, then compiles | the whole product is a graph runtime |
| annotation schema with reducers | implemented | `libs/langgraph-core/src/graph/annotation.ts:62-172` | each key becomes a channel; a reducer makes a fold | declare state once, typed at both ends |
| Zod or JSON-schema state | implemented | `libs/langgraph-core/src/graph/state.ts:510-668` | schemas are normalised into the same channel factory | accept the schema style a caller already has |
| node retry policy | implemented | `libs/langgraph-core/src/pregel/utils/index.ts:56-92` | per-node attempt budget, backoff, jitter, predicate | model calls fail transiently |
| node timeout policy | implemented | `libs/langgraph-core/src/pregel/utils/timeout.ts:16-43` | per-attempt wall clock or idle timer with heartbeat | a hung call must not pin a worker forever |
| node cache policy | implemented | `libs/langgraph-core/src/pregel/utils/index.ts:100-112` | key function plus TTL over a `BaseCache` | avoid paying twice for a pure node |
| conditional edges and branches | implemented | `libs/langgraph-core/src/graph/state.ts:1241-1269` | edge functions map state to destinations | routing belongs to the graph, not the model |
| `Command` routing and state update | implemented | `libs/langgraph-core/src/constants.ts:558-658` | a node returns routing plus writes instead of an edge | one return value can move and mutate |
| `Send` map-reduce | implemented | `libs/langgraph-core/src/constants.ts:263-293` | push the same node with per-item arguments | fan out over a list without a DSL |
| subgraphs as nodes | implemented | `libs/langgraph-core/src/graph/state.ts:1039-1239` | a compiled graph is attached as a node with its own namespace | compose trees of graphs |
| recursion limit | implemented | `libs/langgraph-core/src/pregel/index.ts:2509-2514` | a run-level step cap, default 25, must be at least one | bound runaway cycles |
| per-node error handler | implemented | `libs/langgraph-core/src/graph/state.ts:1039-1239` | a handler node is auto-added for nodes that declare one | recover one node without failing the run |
| cooperative drain | implemented | `libs/langgraph-core/src/pregel/types.ts:374-381` | a run control object flips a drain bit the loop honours | stop cleanly between steps |
| parallel task dispatch | implemented | `libs/langgraph-core/src/pregel/runner.ts:287-413` | a concurrency bound drains a queue of ready tasks | supersteps exploit parallelism |

The authoring layer is deliberately thin: `addNode` rejects reserved namespace
characters and reserved names, then records retry, cache, timeout and subgraph
metadata on the node spec (`libs/langgraph-core/src/graph/state.ts:1039-1239`).
Branches are compiled into hidden write nodes rather than interpreted at run
time, which is why streaming can attribute every chunk to a node.

## Execution engine

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| superstep scheduler | implemented | `libs/langgraph-core/src/pregel/loop.ts:1190-1407` | apply writes, prepare tasks, commit, checkpoint, repeat | deterministic ordering of model work |
| deterministic task identity | implemented | `libs/langgraph-core/src/constants.ts:110-111` | UUIDv5 from namespace, checkpoint namespace, step and node | resume must match a task to its writes |
| retry defaults | implemented | `libs/langgraph-core/src/pregel/retry.ts:9-13` | three attempts, 500 ms initial, factor two, jitter, max 128 s | sane behaviour with no configuration |
| retry refusal set | implemented | `libs/langgraph-core/src/pregel/retry.ts:15-58` | aborts and common 4xx statuses are not retried | do not multiply bad requests |
| per-attempt timeout enforcement | implemented | `libs/langgraph-core/src/pregel/retry.ts:112-121` | each retry gets a fresh timer and discarded writes | a retry must not inherit a stale budget |
| cooperative cancellation | implemented | `libs/langgraph-core/src/pregel/runner.ts:319-327` | an abort signal races the task batch | let a UI cancel promptly |
| functional API | implemented | `libs/langgraph-core/src/func/index.ts:115-153` | `task()` wraps a callable; `entrypoint()` builds a Pregel | durability without a graph DSL |
| entrypoint state handoff | implemented | `libs/langgraph-core/src/func/index.ts:462-470` | `entrypoint.final` splits caller value from saved state | a workflow needs both return and memory |

The engine is one loop with explicit phases rather than a coroutine per node.
Every phase boundary is a place where a checkpoint may be written, which is
why durability can be traded against latency without changing node code.

## State channels

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| last-value channel | implemented | `libs/langgraph-core/src/channels/last_value.ts:34-48` | one write per step, concurrent writes rejected | default key semantics |
| reducer channel | implemented | `libs/langgraph-core/src/channels/binop.ts:69-101` | binary fold with an explicit overwrite value | append messages, count, merge |
| topic channel | implemented | `libs/langgraph-core/src/channels/topic.ts:61-131` | accumulate all writes or deduplicate them | fan-in from parallel branches |
| ephemeral channel | implemented | `libs/langgraph-core/src/channels/ephemeral_value.ts:28-44` | value cleared when the step finishes | transient control signals |
| delta channel | implemented (beta) | `libs/langgraph-core/src/channels/delta.ts:49-70` | sentinel in checkpoint, replay writes through an associative reducer | keep chat history checkpoints small |
| barrier channels | implemented | `libs/langgraph-core/src/channels/named_barrier_value.ts:13`, `libs/langgraph-core/src/channels/dynamic_barrier_value.ts:24` | wait until named writers arrive | join semantics for map-reduce |
| untracked channel | implemented | `libs/langgraph-core/src/channels/untracked_value.ts:21` | updated but never checkpointed | non-durable scratch space |
| channel versions | implemented | `libs/checkpoint/src/base.ts:18-46` | each write advances a per-channel version compared on resume | replay exactly the unseen writes |
| special write indexes | implemented | `libs/checkpoint/src/base.ts:386-391` | error, scheduled, interrupt and resume writes use fixed negative slots | four control writes cannot collide |

The channel layer is the reason the runtime is not a message bus: state is a
fold over writes, so a resumed run can reconstruct it from checkpoint plus
pending writes without replaying node code.

## Persistence and memory

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| checkpoint record v4 | implemented | `libs/checkpoint/src/base.ts:18-46` | immutable per-superstep value plus metadata | the unit of recovery |
| UUIDv6 checkpoint ids | implemented | `libs/checkpoint/src/base.ts:75-84` | time-ordered ids sort by creation | history listing without a sort column |
| thread identity | implemented | `libs/checkpoint/src/base.ts:180-357` | every saver call keys on `thread_id` and namespace | conversation continuity |
| subgraph namespaces | implemented | `libs/langgraph-core/src/constants.ts:147-148` | pipe-joined node and task path per subgraph | one thread holds a tree of graphs |
| pending writes beside checkpoint | implemented | `libs/checkpoint/src/base.ts:98-104` | writes are rows keyed by task and index | resume without re-running finished tasks |
| pending-write replay | implemented | `libs/langgraph-core/src/pregel/loop.ts:2360-2379` | writes of succeeded nodes are applied on resume | replay is cheaper than re-execution |
| state snapshot for a UI | implemented | `libs/langgraph-core/src/pregel/index.ts:967-1149` | values, next nodes, tasks, pending interrupts | render a paused run honestly |
| state history | implemented | `libs/langgraph-core/src/pregel/index.ts:1203-1236` | saver listing, newest first, with pending writes | time-travel pickers |
| state update and fork | implemented | `libs/langgraph-core/src/pregel/index.ts:1254-2069` | writes are applied through node writers, attributed by `asNode` | edit then continue on a branch |
| copy fork | implemented | `libs/langgraph-core/src/pregel/index.ts:1579-1614` | a checkpoint is cloned under a new step and parent | branch without changing state |
| delete a thread | implemented | `libs/checkpoint-sqlite/src/index.ts:596-605` | both tables are cleared in one transaction | data deletion requests |
| memory saver | implemented | `libs/checkpoint/src/memory.ts:106-128` | nested null-prototype objects keyed by thread and namespace | tests and single-process apps |
| SQLite saver | implemented | `libs/checkpoint-sqlite/src/index.ts:185-228` | two tables, WAL journal, replace-or-ignore write policy | local durable runs |
| Postgres saver | implemented | `libs/checkpoint-postgres/src/migrations.ts:7-47` | JSONB checkpoint, per-version blobs, bytea writes, migration table | production server persistence |
| MongoDB saver | declared | `libs/checkpoint-mongodb/package.json:2` | document store implementation; internals not read | alternative operations choice |
| Redis saver | declared | `libs/checkpoint-redis/package.json:2` | key-value implementation; internals not read | low-latency deployments |
| saver conformance harness | implemented | `libs/checkpoint-validation/README.md:7-14` | a published test suite a third-party saver must pass | protect the contract from drift |
| checkpoint format version | implemented | `libs/checkpoint/src/base.ts:77` | single `v` field read with old-row branches | evolve the record without a migration run |
| additive schema migrations | implemented | `libs/checkpoint-postgres/src/migrations.ts:43-47` | integer-versioned statements, add-column-if-missing | upgrade a live database in place |
| cross-thread store | implemented | `libs/checkpoint/src/store/base.ts:73-310` | namespaced items, filters, vector search, batch ops | memory that outlives a thread |
| store TTL and vector indexes | implemented | `libs/checkpoint-postgres/src/store/modules/ttl-manager.ts:1-38` | expires rows on a sweep; HNSW or IVFFlat index config | bound growth and rank by similarity |
| serializer | implemented | `libs/checkpoint/src/serde/jsonplus.ts:227` | JSON plus typed reconstruction of supported classes | store rich objects safely |

The distinction between a checkpoint and a pending write is the load-bearing
one. A checkpoint is the folded state at a boundary; writes are the raw task
outputs that may not have been folded yet. Losing the first is a lost run;
losing the second is a re-run of one task.

## Human in the loop and interrupts

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| dynamic interrupt | implemented | `libs/langgraph-core/src/interrupt.ts:126-166` | a node calls `interrupt(value)` and the runtime throws a typed pause | ask a human mid-node |
| checkpointer requirement | implemented | `libs/langgraph-core/src/interrupt.ts:107-112` | no saver means a typed `GraphValueError` before the pause | a pause with no state cannot resume |
| interrupt identity | implemented | `libs/langgraph-core/src/interrupt.ts:126-139` | a hash of the namespace plus a per-task counter names each pause | several pauses in one node stay distinct |
| resume value delivery | implemented | `libs/langgraph-core/src/interrupt.ts:131-139` | the matching resume write is consumed and returned | the node continues with human data |
| typed resume validation | implemented | `libs/langgraph-core/src/interrupt.ts:33-42` | a Zod schema or JSON schema parses the resume value | reject a malformed human answer |
| multiple interrupts | implemented | `libs/langgraph-core/src/pregel/algo.ts:1517-1533` | scratchpad keeps an ordered resume array per task | sequential questions in one node |
| resume map by task id | implemented | `libs/langgraph-core/src/pregel/io.ts:97-115` | a hash-keyed map answers several tasks in one command | parallel nodes can each pause |
| interrupt writes | implemented | `libs/langgraph-core/src/pregel/runner.ts:438-447` | interrupts are committed as `INTERRUPT` pending writes | pause survives process death |
| static breakpoints | implemented | `libs/langgraph-core/src/pregel/loop.ts:1378-1382` | node-name lists stop before or after a boundary | debug and step through |
| legacy node interrupt | declared | `https://langchain-ai.github.io/langgraphjs/concepts/breakpoints/` (2026-10-21) | throwing a special error pauses the node | pre-dates the function form |
| prebuilt human protocol | implemented | `libs/langgraph-core/src/prebuilt/interrupt.ts:10-60` | request plus response shape with four allowed actions | standardise approval UIs |
| paused-task description | implemented | `https://langchain-ai.github.io/langgraphjs/concepts/human_in_the_loop/` (2026-10-21) | task id, path, interrupts with value, namespace and timing | a client can render what is being asked |

Resuming re-enters the node from its first line, not from the pause point,
which the documentation states plainly at
`https://langchain-ai.github.io/langgraphjs/concepts/human_in_the_loop/` (read 2026-10-21).
So a human approval is durable and a node body is not idempotent by default.

## Durability and time travel

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| sync durability | implemented | `libs/langgraph-core/src/pregel/loop.ts:1284-1289` | writes and checkpoint settle before the next dispatch | pay latency for a real guarantee |
| async durability | implemented | `libs/langgraph-core/src/pregel/index.ts:2168-2172` | persistence is scheduled while the loop advances | default speed for local work |
| exit durability | implemented | `libs/langgraph-core/src/pregel/loop.ts:2209-2353` | writes accumulate and one checkpoint lands at the end | cheap batches where only the result matters |
| legacy checkpoint flag | implemented | `libs/langgraph-core/src/pregel/index.ts:2156-2166` | `checkpointDuring` maps onto the new enum or errors | keep old call sites working |
| replay from a checkpoint | implemented | `https://langchain-ai.github.io/langgraphjs/concepts/time-travel/` (2026-10-21) | pass null input with a historical `checkpoint_id` | inspect how a result was reached |
| fork by state update | implemented | `https://langchain-ai.github.io/langgraphjs/concepts/time-travel/` (2026-10-21) | update a historical checkpoint and continue from the new one | try a different decision |
| fork detection | implemented | `libs/langgraph-core/src/pregel/checkpoint.ts:103-114` | compare the addressed checkpoint with the thread head | never branch silently on a stale base |
| subgraph replay cursor | implemented | `libs/langgraph-core/src/pregel/replay.ts:16-82` | first visit loads the checkpoint before the replay point | nested graphs replay together |
| delta counters | implemented | `libs/langgraph-core/src/pregel/checkpoint.ts:17-46` | update and superstep counts gate a fresh snapshot | bound reconstruction work |
| interrupt replay stability | implemented | `libs/langgraph-core/src/tests/time_travel_extended.test.ts:139-173` | repeated replays reproduce the same pause value | a UI can refresh without drift |

The three durability modes are the only place where this runtime states a
guarantee. Nothing is claimed about side-effect exactly-once delivery; the
documented replay tests show the opposite, and a caller is expected to make a
node's writes idempotent where that matters.

## Streaming

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| eight stream modes | implemented | `libs/langgraph-core/src/pregel/types.ts:25-33` | a union of values, updates, debug, messages, checkpoints, tasks, custom, tools | one run, several audiences |
| multi-mode subscription | implemented | `libs/langgraph-core/src/pregel/index.ts:2745-2772` | a set of modes, each chunk tagged with its mode | a UI and a logger can listen together |
| namespace-tagged chunks | implemented | `libs/langgraph-core/src/pregel/stream.ts:30-31` | the tuple carries the subgraph path that emitted it | render nested runs |
| SSE encoding | implemented | `libs/langgraph-core/src/pregel/index.ts:2280-2384` | the set of chunks is encoded as an event stream | browser transport without a socket |
| protocol events | implemented | `libs/langgraph-core/src/stream/types.ts:51-105` | sequence, method, namespace and payload per event | ordering and deduplication |
| CDDL-generated payload types | implemented | `libs/langgraph-core/src/stream/types.ts:16-43` | types come from a shared schema package | keep wire formats honest across languages |
| v3 checkpoint envelopes | implemented | `libs/langgraph-core/src/pregel/stream.ts:10-28` | a checkpoint object rides beside each values event | branch UI without a second stream |
| tools stream mode | implemented | `libs/langgraph-core/src/pregel/stream.ts:200-301` | LangChain callbacks become tool start, event, end and error chunks | show tool progress |
| custom writer | implemented | `libs/langgraph-core/src/writer.ts:4` | a node calls the writer helper and the chunk lands on the custom mode | node-level progress |
| stream cancellation | implemented | `libs/langgraph-core/src/pregel/stream.ts:66-120` | cancelling the readable stream aborts the run signal | stop paying for abandoned work |

The stream is a projection of loop events, not a second execution path: a
chunk exists only when the loop produces the corresponding state transition.
That is why a replay can re-emit the same chunk sequence.

## Multi-agent, prebuilt and platform

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| react agent | implemented | `libs/langgraph-core/src/prebuilt/react_agent_executor.ts:485-575` | model node plus tool node loop over messages | the default agent |
| parallel tool calls | implemented | `libs/langgraph-core/src/prebuilt/tool_node.ts:41-45` | every requested call in one message runs as a task | latency |
| tool error handling | implemented | `libs/langgraph-core/src/prebuilt/tool_node.ts:21-25` | an option turns a thrown tool error into a message | keep the loop alive |
| handoff tool | implemented | `libs/langgraph-swarm/src/handoff.ts:61-99` | a tool returns `Command({goto, graph: PARENT})` | transfer control, not just output |
| swarm topology | implemented | `libs/langgraph-swarm/src/swarm.ts:101-160` | agent nodes plus an active-agent router | named agents passing work |
| supervisor topology | implemented | `libs/langgraph-supervisor/src/supervisor.ts:118-205` | a supervisor model calls agents as tools and routes | centralised delegation |
| remote graph | implemented | `libs/langgraph-core/src/pregel/remote.ts:196` | the same run surface over the server API | local client, remote execution |
| JS SDK client | implemented | `libs/sdk/src/client/index.ts:10` | assistants, threads, runs, store and cron endpoints | typed server access |
| server task queue | declared | `libs/langgraph-api/src/queue.mts:15-24` | a worker loop drains queued runs with bounded retries and webhooks; the transport sits behind storage ops and was not traced | do not drop burst requests |
| double-texting policies | declared | `https://langchain-ai.github.io/langgraphjs/concepts/double_texting/` (2026-10-21) | reject, enqueue, interrupt or roll back a concurrent run | a user sends twice |
| platform deployment | declared | `https://langchain-ai.github.io/langgraphjs/concepts/langgraph_server/` (2026-10-21) | a graph bundle, Postgres and Redis behind an HTTP API | hosted agents |

The multi-agent packages are ordinary graphs: handoff is a tool plus a command,
and the supervisor is a prompt plus a loop. No new runtime primitive was added
for multi-agent, which is worth noting when we design our own topology seam.

## Notable implementation notes

- `MemorySaver` defends against prototype pollution with a key allow-check plus
  null-prototype objects, because thread and namespace strings become property
  keys (`libs/checkpoint/src/memory.ts:30-128`).
- Savers compute the write `idx` from the channel name for four control
  channels and from the array position otherwise, so a retried task can
  overwrite its own control write without clobbering a peer
  (`libs/checkpoint-sqlite/src/index.ts:549-593`).
- In sync durability the loop awaits the set of in-flight checkpointer
  promises before it prepares the next superstep, so a slow saver costs
  latency instead of being ignored
  (`libs/langgraph-core/src/pregel/loop.ts:552-604`, `:1284-1289`).
- `MemorySaver` migrates pre-v4 pending sends on read instead of rewriting
  stored rows (`libs/checkpoint/src/memory.ts:245-252`).
- The Postgres schema keeps one blob per channel version, so an unchanged
  channel is not rewritten on every checkpoint
  (`libs/checkpoint-postgres/src/sql.ts:105-135`).
- Export maps can route the root condition to a browser build, and the Node
  entry runs side effects before re-exporting the shared surface
  (`libs/langgraph-core/package.json:72-97`).
- The workspace pins security floors in pnpm overrides and allow-lists native
  build scripts, which is a supply-chain posture rather than a feature
  (`package.json:51-135`).
- The durability enum appears in the versions index and the types but not in
  the conceptual guide; a reader of the docs alone would not learn the three modes
  (`libs/langgraph-core/src/pregel/types.ts:35`).
- A pending-writes paragraph is duplicated verbatim in the persistence page
  (`https://langchain-ai.github.io/langgraphjs/concepts/persistence/`, read 2026-10-21), a small documentation defect.
