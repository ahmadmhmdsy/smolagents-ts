# LangGraph.js — architecture of the runtime, state model and persistence

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Repository layout**

| path | package at read commit | role |
|---|---|---|
| `libs/langgraph-core` | `@langchain/langgraph@1.5.1` | the engine: graph, pregel, channels, streaming, prebuilt agents |
| `libs/langgraph` | `langgraph@1.0.47` | private facade that re-exports the core |
| `libs/checkpoint` | `@langchain/langgraph-checkpoint@1.2.0` | checkpoint record, saver and store interfaces, serde, memory savers |
| `libs/checkpoint-sqlite` | `1.1.0` | SQLite saver |
| `libs/checkpoint-postgres` | `1.1.0` | Postgres saver and store |
| `libs/checkpoint-mongodb` | `1.5.0` | MongoDB saver and store |
| `libs/checkpoint-redis` | `1.1.0` | Redis saver |
| `libs/checkpoint-validation` | `1.2.0` | conformance harness for third-party savers |
| `libs/langgraph-api` | `@langchain/langgraph-api@1.5.4` | the server: HTTP API, queue, storage, webhooks, cron |
| `libs/langgraph-cli` | `1.5.4` | dev/build/deploy CLI |
| `libs/langgraph-ui` | `1.5.4` | Studio front end |
| `libs/sdk` | `@langchain/langgraph-sdk@1.12.5` | typed HTTP client |
| `libs/sdk-react`, `sdk-vue`, `sdk-svelte`, `sdk-angular` | `1.2.5` each | framework clients |
| `libs/langgraph-supervisor` | `1.1.3` | supervisor topology as a package |
| `libs/langgraph-swarm` | `1.0.4` | swarm topology and handoff tools |
| `libs/langgraph-cua` | `1.0.4` | computer-use loop |
| `libs/create-langgraph` | `1.1.5` | project generator |

Version numbers are the workspace manifests at the pinned commit; every row
was read from its package manifest name and version fields.

**Core abstractions**

| abstraction | home | what it owns |
|---|---|---|
| `StateGraph` | `libs/langgraph-core/src/graph/state.ts:404` | schema normalisation, nodes, edges, branches, compile |
| `Annotation` | `libs/langgraph-core/src/graph/annotation.ts:62` | a channel per state key, reducer or last value |
| `CompiledStateGraph` | `libs/langgraph-core/src/graph/state.ts:1689` | a `Pregel` with resolved channels and hidden bookkeeping nodes |
| `Pregel` | `libs/langgraph-core/src/pregel/index.ts` | public run surface: invoke, stream, state reads, updates |
| `PregelLoop` | `libs/langgraph-core/src/pregel/loop.ts:400` | superstep state machine, checkpoint writes, interrupt bookkeeping |
| `PregelRunner` | `libs/langgraph-core/src/pregel/runner.ts` | task dispatch, retry, timeout, write commit |
| `BaseChannel` | `libs/langgraph-core/src/channels/base.ts:45` | update, checkpoint, get, consume, finish, availability |
| `Command` | `libs/langgraph-core/src/constants.ts:558` | resume value, state update, goto routing, parent graph target |
| `Send` | `libs/langgraph-core/src/constants.ts:263` | map-reduce: push a node with an explicit argument |
| `interrupt` | `libs/langgraph-core/src/interrupt.ts:126` | throw a resumable pause from inside a node |
| `BaseCheckpointSaver` | `libs/checkpoint/src/base.ts:180` | getTuple, list, put, putWrites, deleteThread, delta history |
| `BaseStore` | `libs/checkpoint/src/store/base.ts` | namespaced key-value memory with filter/vector search |
| `ReplayState` | `libs/langgraph-core/src/pregel/replay.ts:16` | subgraph checkpoint cursor during a parent replay |

The public entry is deliberately split: `src/index.ts` initialises the
AsyncLocalStorage singleton and re-exports `web.ts`, while the manifest maps
the browser condition to `dist/web.js` (`libs/langgraph-core/src/index.ts:1-8`;
`libs/langgraph-core/package.json:72-97`). Node-only side effects never enter
the browser build.

**One run, end to end**

1. `compile()` resolves the state schema to channels, attaches nodes and
   edges, adds the hidden branch/read/write machinery and validates the graph
   (`libs/langgraph-core/src/graph/state.ts:1394-1631`).
2. `_defaults()` resolves stream mode, static interruption lists, checkpointer,
   store, cache and durability for this call, with the config winning over the
   compiled default (`libs/langgraph-core/src/pregel/index.ts:2091-2188`).
3. The stream iterator refuses a `recursionLimit` below one, and a configured
   checkpointer without any `configurable` block is rejected up front
   (`libs/langgraph-core/src/pregel/index.ts:2509-2523`).
4. `PregelLoop` initialises, then `_first()` loads the latest checkpoint tuple
   and decides whether the caller addressed a specific `checkpoint_id`
   (`libs/langgraph-core/src/pregel/loop.ts:1640-1939`).
5. Input becomes writes: a plain object maps to input channels, a `Command`
   maps to resume or update writes, `null` maps to no new input
   (`libs/langgraph-core/src/pregel/loop.ts:1699-1769`,
   `libs/langgraph-core/src/pregel/io.ts:71-121`), and a checkpoint the thread
   has moved past gets a fork checkpoint before execution resumes
   (`libs/langgraph-core/src/pregel/loop.ts:1811-1822`).
6. The opening checkpoint is saved with source `input`
   (`libs/langgraph-core/src/pregel/loop.ts:1909-1910`).
7. Each `tick()` applies pending writes to channels, asks the trigger and
   edge machinery for the next tasks, and runs them with a concurrency bound
   (`libs/langgraph-core/src/pregel/loop.ts:1190-1407`).
8. A task's writes are committed to the saver as pending writes; a thrown
   interrupt becomes `INTERRUPT` writes and a thrown error becomes `ERROR`
   writes (`libs/langgraph-core/src/pregel/runner.ts:436-465`).
9. After the task batch settles, the loop writes the superstep checkpoint
   with source `loop`, and in sync durability awaits it before the next
   dispatch (`libs/langgraph-core/src/pregel/loop.ts:1283-1289`).
10. Static `interruptBefore` and `interruptAfter` convert the boundary into an
    interrupt without executing or without continuing past the node
    (`libs/langgraph-core/src/pregel/loop.ts:1292-1297`,
    `libs/langgraph-core/src/pregel/loop.ts:1378-1382`).
11. Exit durability skips per-superstep persistence and writes the terminal
    checkpoint, including accumulated delta writes, when the run finishes
    (`libs/langgraph-core/src/pregel/loop.ts:2209-2353`).
12. Output channels are read for the return value, while stream chunks are
    emitted as `[namespace, mode, payload]` for every subscribed mode
    (`libs/langgraph-core/src/pregel/index.ts:2745-2772`).

**State and persistence model**

A checkpoint is one immutable record per superstep. The v4 shape carries a
numeric format version, a UUIDv6 identifier, a timestamp, the channel values,
the channel versions and the per-node versions seen
(`libs/checkpoint/src/base.ts:18-46`). Metadata adds the source (`input`,
`loop`, `update`, `fork`), the step number, parent checkpoint ids by
namespace, and delta-channel counters (`libs/checkpoint/src/types.ts:17`;
`libs/langgraph-core/src/pregel/checkpoint.ts:39-46`). Pending writes are stored
beside the checkpoint, not inside it; a `CheckpointTuple` returns the
checkpoint, its config, its parent config and the pending writes
(`libs/checkpoint/src/base.ts:98-104`).

Special channels get fixed negative write indexes so a retried task cannot
collide with a concurrent task's ordinary write: error, scheduled, interrupt
and resume writes are table-driven (`libs/checkpoint/src/base.ts:386-391`);
savers honour the split between replaceable special writes and ignored
duplicate regular writes (`libs/checkpoint-sqlite/src/index.ts:549-593`).
Subgraph state is isolated by `checkpoint_ns`, a pipe-joined path of node and
task segments, so one thread holds the parent and every nested graph
(`libs/langgraph-core/src/constants.ts:147-148`).

| saver | storage shape | evidence |
|---|---|---|
| memory | nested null-prototype objects; writes keyed `taskId,idx` | `libs/checkpoint/src/memory.ts:106-128` |
| SQLite | `checkpoints` and `writes` tables, WAL, replace-vs-ignore write policy | `libs/checkpoint-sqlite/src/index.ts:185-228`, `:529-594` |
| Postgres | JSONB checkpoints, per-channel-version blobs, bytea writes, migration table | `libs/checkpoint-postgres/src/migrations.ts:7-47` |
| MongoDB, Redis | declared savers; internals not read | `libs/checkpoint-mongodb/package.json:2`, `libs/checkpoint-redis/package.json:2` |

The Postgres layout is the informative one: channel values are normalised
into `checkpoint_blobs` keyed by channel and version, so an unchanged channel
is not rewritten, while the checkpoint row keeps the version map and the JSON
metadata (`libs/checkpoint-postgres/src/sql.ts:66-135`). Schema evolution is
additive: a migrations table records integers, and a column is added with
`ADD COLUMN IF NOT EXISTS` (`libs/checkpoint-postgres/src/migrations.ts:43-47`);
readers patch old rows forward instead of migrating them
(`libs/checkpoint/src/memory.ts:245-252`).

`DeltaChannel` is the memory-saving variant: it stores only a sentinel in
`channel_values` and reconstructs value by replaying ancestor writes through
an associative reducer, with a full snapshot every N updates or 5,000
supersteps (`libs/langgraph-core/src/channels/delta.ts:49-70`,
`libs/langgraph-core/src/pregel/checkpoint.ts:17-46`). Savers expose
`getDeltaChannelHistory` so replay can walk the ancestor chain
(`libs/checkpoint/src/base.ts:180-357`).

A separate store keeps cross-thread memory: namespaced items with metadata,
filter and vector search, batch operations and put-time indexing
(`libs/checkpoint/src/store/base.ts:73-310`); the Postgres store adds TTL
sweeping and HNSW/IVFFlat index configuration
(`libs/checkpoint-postgres/src/store/index.ts:88-106`,
`libs/checkpoint-postgres/src/store/modules/ttl-manager.ts:1-38`).

**Durability model**

| mode | behaviour | evidence |
|---|---|---|
| `sync` | awaits pending writes and the superstep checkpoint before the next node runs | `libs/langgraph-core/src/pregel/loop.ts:1284-1289`; `libs/langgraph-core/src/tests/durability.sync.test.ts:1-7` |
| `async` | schedules persistence and continues; default when nothing is configured | `libs/langgraph-core/src/pregel/index.ts:2168-2172` |
| `exit` | no per-superstep checkpoint; one terminal checkpoint at the end | `libs/langgraph-core/src/pregel/loop.ts:2209-2353` |

The deprecated `checkpointDuring` flag maps false to `exit` and true to
`async`, and setting both options is an error
(`libs/langgraph-core/src/pregel/index.ts:2156-2166`). The honest guarantee is
per-superstep state persistence in `sync` and `async` and terminal-state
persistence in `exit`; nothing here makes node side effects exactly-once,
which the documentation itself says when it explains that a resumed node runs
again from its beginning.

**Streaming and transport**

`streamMode` is a union of eight names: `values`, `updates`, `debug`,
`messages`, `checkpoints`, `tasks`, `custom` and `tools`
(`libs/langgraph-core/src/pregel/types.ts:25-33`). A single call may subscribe
to several modes, and every chunk carries the namespace path that produced it
(`libs/langgraph-core/src/pregel/stream.ts:30-31`). Tool lifecycle events are
synthesised from LangChain callbacks into the `tools` mode
(`libs/langgraph-core/src/pregel/stream.ts:200-301`); nodes may push custom
data with a writer, and the server encodes the same chunks as
`text/event-stream`.

Newer clients consume a protocol envelope rather than raw tuples: sequence
number, method, namespace and payload, with `lifecycle` and `input` channels
synthesised by transformers (`libs/langgraph-core/src/stream/types.ts:51-105`).
The event and payload types are generated from a CDDL schema in a separate
`@langchain/protocol` package (`libs/langgraph-core/src/stream/types.ts:16-43`;
`libs/langgraph-core/package.json:31-35`). `streamEvents` in v3 mode attaches
a companion checkpoint envelope to the `values` event so a UI can offer
branching without a second subscription (`libs/langgraph-core/src/pregel/stream.ts:10-28`).

**Build, test and release stack**

The workspace is pnpm 10.27.0 with turbo, oxlint and oxfmt, changesets for
release, and Node 22/24/26 engines (`package.json:3-25`). Tests are vitest,
with a browser mode and a docker-compose integration mode declared as scripts
in the core manifest (`libs/langgraph-core/package.json:16-28`); the suite
includes direct durability, time-travel, interrupt and checkpointer files.
Savers can be validated against a published conformance harness rather than
reviewed by eye (`libs/checkpoint-validation/README.md:7-14`).
