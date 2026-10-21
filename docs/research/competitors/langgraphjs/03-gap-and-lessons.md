# LangGraph.js — gaps and lessons against our baseline

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

This file prices what the neighbour shows against the row ids in
`docs/research/competitors/_synthesis/00-our-baseline.md`. Buckets are the
method's: A roadmap follow-on behind a shipped seam, B non-goal under decision
0018 or 0019, C unconsidered, D depth gap in something we already ship. Effort
is S, M, L or XL. The seam column names where the capability would land, not a
new package unless stated.

## Gap rows

| baseline | our status | what the neighbour shows | bucket | effort | seam |
|---|---|---|---|---|---|
| HL-02 | absent | a pending pause is durable state, not an exception in flight: interrupt values are committed as `INTERRUPT` writes and surfaced in `getState` with a task id, path and namespace (`libs/langgraph-core/src/pregel/runner.ts:438-447`; `libs/langgraph-core/src/pregel/index.ts:967-1149`) | A | M | approval seam plus `RunStore` |
| HL-04 | minimal | resuming is a plain run whose input is a resume value against the same thread; no separate resume API (`libs/langgraph-core/src/pregel/io.ts:97-115`) | A | M | `RunStore` |
| HL-05 | absent | a task's writes are committed before the checkpoint that folds them, and a resume re-applies finished tasks' writes instead of re-running them (`libs/langgraph-core/src/pregel/loop.ts:2360-2379`) | A | L | `RunStore` step boundary |
| HL-06 | absent | `interrupt(value)` pauses mid-node, the resume value is returned in place, and an optional schema validates it (`libs/langgraph-core/src/interrupt.ts:126-166`) | A | M | approval seam |
| HL-07 | absent | history is a saver listing plus a run addressed at a historical `checkpoint_id`; branching is an update on that base (`https://langchain-ai.github.io/langgraphjs/concepts/time-travel/`, read 2026-10-21) | A | L | `RunStore` plus `AgentSession` |
| HL-08 | minimal | a thread id carries conversation identity while runs carry execution; a separate store holds cross-thread memory (`libs/checkpoint/src/store/base.ts:73-310`) | D | M | `AgentSession` |
| HL-09 | absent | five savers (memory, SQLite, Postgres, MongoDB, Redis) behind a five-method abstract interface (`libs/checkpoint/src/base.ts:180-357`), plus a published conformance suite for third parties (`libs/checkpoint-validation/README.md:7-14`) | A | M | `RunStore` |
| HL-10 | absent | one integer `v` on the record with read-side branches and additive SQL migrations, not a migration framework (`libs/checkpoint/src/base.ts:77`; `libs/checkpoint-postgres/src/migrations.ts:43-47`) | A | S | `StepJSON` |
| MA-02 | absent | a handoff is a tool whose return value is `Command({goto, graph: PARENT})`, so control transfer needs no new runtime primitive (`libs/langgraph-swarm/src/handoff.ts:61-99`) | A | M | managed-agent tool seam |
| MA-03 | minimal | `responseFormat` on the react agent and `structuredResponse` on the supervisor give a child a typed report, not a string (`libs/langgraph-core/src/prebuilt/react_agent_executor.ts:485-575`; `libs/langgraph-supervisor/src/supervisor.ts:118-205`) | D | S | `managed-agent.ts` output schema |
| MA-04 | absent | `Send` fans a node out over a list and the runner dispatches ready tasks in parallel under one bound (`libs/langgraph-core/src/constants.ts:263-293`; `libs/langgraph-core/src/pregel/runner.ts:287-413`) | A | M | step scheduler |
| MA-05 | absent | every node shares the graph's channels, and a separate store carries memory across threads (`libs/langgraph-core/src/channels/base.ts:45-153`) | C | L | `RunContext` |
| MA-06 | absent | supervisor and swarm ship as ordinary graphs over handoff tools; the topology is code, not an engine feature (`libs/langgraph-supervisor/src/supervisor.ts:118-205`; `libs/langgraph-swarm/src/swarm.ts:101-160`) | A | M | package over managed agents |
| MA-07 | minimal | subgraphs nest under a checkpoint namespace and replay with their parent (`libs/langgraph-core/src/pregel/replay.ts:16-82`) | D | S | managed-agent tests |
| RT-09 | implemented | the stream is a projection of loop transitions: eight selectable modes, every chunk names its subgraph path, and a protocol envelope adds sequence and lifecycle channels (`libs/langgraph-core/src/pregel/types.ts:25-33`; `libs/langgraph-core/src/stream/types.ts:51-105`) | D | M | `events.ts` |
| RT-07 | implemented | cancellation is a drain bit checked between steps plus an abort signal raced against the task batch, so a stop never tears a checkpoint (`libs/langgraph-core/src/pregel/types.ts:374-381`; `libs/langgraph-core/src/pregel/runner.ts:319-327`) | D | S | run cancellation path |
| HL-01 | implemented | a pause carries a request shape with four allowed responses and per-action flags, rather than one approve or deny (`libs/langgraph-core/src/prebuilt/interrupt.ts:10-60`) | D | M | approval seam |
| HL-03 | implemented | the checkpoint is per superstep and separate from the writes it folds; the boundary, not the step function, owns persistence (`libs/langgraph-core/src/pregel/loop.ts:1283-1289`) | D | M | `RunStore` |
| RT-14 | implemented | the snapshot for a UI carries next nodes, tasks, pending pauses and their timestamps, so a client renders a paused run without guessing (`libs/langgraph-core/src/pregel/types.ts:616-647`) | D | S | `AgentSession` snapshot |
| GR-05 | seam-only | `responseFormat` is passed to the model as `withStructuredOutput`, so the typed report comes from the provider call (`libs/langgraph-core/src/prebuilt/react_agent_executor.ts:549-564`, `:782-818`) | A | S | model capability flag |
| UI-06 | absent | the server exposes the same chunks as `text/event-stream` and the SDKs consume them with a typed protocol (`libs/langgraph-core/src/pregel/index.ts:2280-2384`) | B | L | decision 0018 keeps it out |
| CL-03 | absent | resume and approval are API operations on a thread, so a terminal client is a thin caller of the same surface (`libs/sdk/src/client/threads/index.ts:29`) | A | M | CLI plus `RunStore` |
| TL-05 | absent | retry and timeout are node policies with per-attempt budgets, so a tool node inherits them (`libs/langgraph-core/src/pregel/utils/timeout.ts:16-43`) | A | M | tool execution seam |

The bucket A rows cluster around one observation: the neighbour's durability
features are mostly one seam (a saver) plus one control write (an interrupt),
not a second engine. Our baseline already has the seam in `RunStore` and the
control point in the approval callback, which is why the prices are M rather
than L.

## Where our baseline is wrong or understated

- HL-09 reads as a large absence, but the saver contract is five methods
  (`libs/checkpoint/src/base.ts:180-357`). One JSON-file or SQLite
  implementation behind our `RunStore` would move HL-04 from minimal to
  implemented, so the "durable stores" row is S or M, not L. The
  neighbour's own answer is a memory saver as the reference implementation and
  a conformance suite for the rest.
- HL-05 cannot be closed by copying a checkpointer. The neighbour commits task
  writes before the folding checkpoint, but a resumed node still runs from its
  first line, which the human-in-the-loop page admits
  (`https://langchain-ai.github.io/langgraphjs/concepts/human_in_the_loop/`,
  read 2026-10-21). The baseline's "a mid-step crash replays the step" stays
  true; what improves is that committed task output is not lost, and a replay
  can reuse it. Price the idempotency question separately from persistence.
- HL-10 is priced as a framework gap, but the neighbour has no migration
  framework: one version integer, additive columns and read-side branches.
  A `v` field on `StepJSON` plus a reader that patches older rows is S and
  buys most of the value.
- MA-03 is understated in the neighbour's favour: their typed child report is
  ordinary structured output on the child's model call, not a new protocol. If
  we wire `ModelCapabilities.structuredOutput` (GR-05) through the managed
  agent, MA-03 and GR-05 land together at S each.
- RT-09 is implemented but thinner than the neighbour: one event union versus
  selectable projections with namespace attribution. That is a depth gap, not a
  missing capability, so it belongs in D and should not be re-scoped as a
  feature.
- The neighbour's docs say a checkpoint is written "after each step" while the
  default durability is `async` and can lose the last superstep on a crash
  (`libs/langgraph-core/src/pregel/index.ts:2168-2172`). Their numbered docs do
  not describe the durability modes at all. If we add a durability setting,
  the numbered mechanism docs must name it and the default must be chosen
  deliberately.

## Patterns worth copying

1. **Split the folded state from the writes that produced it.** A checkpoint is
   immutable state at a boundary; pending writes are task outputs that a
   resume re-applies. This is what makes replay cheaper than re-execution and
   is the single most valuable structural idea in the repository
   (`libs/checkpoint/src/base.ts:98-104`; `libs/langgraph-core/src/pregel/loop.ts:2360-2379`).
2. **Give a pause an identity.** An interrupt id derived from the namespace and
   a per-task counter survives process death and lets several pauses coexist in
   one node (`libs/langgraph-core/src/interrupt.ts:126-139`). Our approval seam
   needs the same id before it can be serialised.
3. **Separate conversation identity from execution identity.** `thread_id`
   names the durable conversation, a run names one execution, and
   `checkpoint_ns` isolates nested graphs. Three identifiers, each with one
   job, is simpler than one id doing all three (`libs/checkpoint/src/base.ts:180-357`).
4. **Make time travel a read plus a normal run.** History is a listing; replay
   is a run addressed at an old checkpoint; branching is an update on that
   base. No special replay API or wiring
   (`https://langchain-ai.github.io/langgraphjs/concepts/time-travel/`, read
   2026-10-21).
5. **Publish a conformance suite with the interface.** The neighbour ships
   `checkpoint-validation` so a third-party saver can prove itself instead of
   being reviewed by eye (`libs/checkpoint-validation/README.md:7-14`). Our
   `RunStore` seam should ship the same artefact.
6. **Additive schema evolution.** An integer version, `ADD COLUMN IF NOT
   EXISTS`, and reader-side patching kept a live database compatible without a
   migration framework (`libs/checkpoint-postgres/src/migrations.ts:43-47`).
7. **Topology as ordinary graphs.** Handoff is a tool returning a routing
   command; supervisor and swarm are packages, not runtime features
   (`libs/langgraph-swarm/src/handoff.ts:61-99`). Our MA-02 and MA-06 can be
   built the same way.
8. **Keep Node-only side effects out of the shared entry.** The package maps a
   browser condition to one build and initialises the async-context singleton
   in the Node entry before re-exporting the shared surface
   (`libs/langgraph-core/src/index.ts:1-8`; `libs/langgraph-core/package.json:72-97`).
   Our isomorphic core already benefits from the same discipline.

## Patterns to avoid

1. **Throw-based control flow for pauses.** `interrupt()` is a thrown value
   carrying an exception type, and cancellation is a thrown drain error. Both
   are caught by the runtime and turned into state, but any caller outside the
   loop sees an exception where the domain has a suspension. It also forces
   the whole node to rerun, duplicating side effects before the pause.
2. **Mega-modules in the engine.** The loop, the Pregel facade and the graph
   builder are 3,008, 2,391 and 2,188 lines respectively, with the scheduler in
   a fourth file. Auditing one behaviour means holding four files at once.
3. **Documentation that omits the guarantee.** The only conceptual mention of
   durability is a versions note; the guide's "after each step" wording
   overstates the default. A capability whose failure mode is silent data loss
   must be named where the mechanism is described.
4. **Legacy aliases kept alive beside the new path.** `checkpointDuring` maps
   onto the enum and errors on conflict; `NodeInterrupt` still exists beside
   `interrupt()`; static breakpoints still exist beside dynamic ones. Three
   ways to pause is three ways to document and test.
5. **Failing late on a missing checkpointer.** A run without a saver works
   until a node calls `interrupt`, then throws `MISSING_CHECKPOINTER`
   (`libs/langgraph-core/src/interrupt.ts:107-112`). Our equivalent is an
   approval without a store: the error should surface when the run is
   configured, not when the human is needed.
6. **Serialising state into prototype-bearing objects.** The memory saver
   carries an explicit pollution guard because thread and namespace strings
   become property keys (`libs/checkpoint/src/memory.ts:30-128`). A `Map` would
   remove the class of bug rather than defend against it.
7. **Beta features that change the checkpoint format.** Delta channels alter
   what a checkpoint contains and depend on reducer associativity and snapshot
   cadence; the file itself calls the API beta
   (`libs/langgraph-core/src/channels/delta.ts:49-70`). A format-bearing
   optimisation should wait until the format is settled.
8. **Duplicated prose in a normative page.** The pending-writes paragraph
   appears twice at the end of the persistence page
   (`https://langchain-ai.github.io/langgraphjs/concepts/persistence/`, read
   2026-10-21). Cheap to fix, and a sign the page is edited without a reader.

## Three findings that matter most

1. **Durability is an explicit three-way trade, and the default is the weak
   one.** `sync`, `async` and `exit` are resolved once per run in
   `_defaults`, with `async` as the default and `checkpointDuring` mapped
   for compatibility (`libs/langgraph-core/src/pregel/index.ts:2156-2172`).
   Their docs describe the checkpoint boundary but never this choice, so a
   reader can believe they have a guarantee they do not have. For our HL-03 and
   HL-04, this says: make the choice explicit in the API and in the numbered
   mechanism docs, and make the strongest mode the one a user gets when they
   ask for durability.
2. **An interrupt is persisted control state; resuming re-executes the node.**
   The pause is committed as an `INTERRUPT` write plus a task resume write, and
   the resume value is consumed by index when the node runs again
   (`libs/langgraph-core/src/pregel/runner.ts:438-447`;
   `libs/langgraph-core/src/interrupt.ts:126-139`). That is a complete design
   for HL-02 and HL-06 at M effort, and it is honest about the side-effect
   boundary rather than pretending to suspend a stack.
3. **State recovery and side-effect recovery are not the same problem.** The
   neighbour recovers the former well and does not solve the latter. Any design
   of ours that promises crash recovery inside a step must separate
   "reconstruct state from writes" from "do not repeat the effect", or it will
   inherit the same gap while sounding stronger.

## Open questions for the design pass

- Is `RunStore` a checkpoint store or a run archive? The neighbour separates a
  checkpointer (per-superstep state) from a store (cross-thread data). If we
  keep one seam, it needs both contracts named or it will grow into neither.
- Do we want generic pauses or approvals only? Generic is a smaller API but
  needs pause identity, ordering and a resume map; approvals-only can stay
  behind the existing callback.
- Does conversation identity belong to `AgentSession` or to a thread id in the
  store? HL-08 is minimal today because the checkpoint names one run, not a
  continuing conversation.
- Which durability default can we defend for a single-process library: the
  cheap mode with a documented loss window, or the strong mode with its
  latency?
- Is a conformance suite for `RunStore` worth shipping before the second
  implementation exists, or does it only pay off once a community implements
  the seam?
