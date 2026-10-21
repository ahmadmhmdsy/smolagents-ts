# cloudflare-agents — gaps and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## How the gap table works

Every row names the baseline id it extends, the bucket it falls in, what "matching" would mean in
our terms, the seam a change would land behind, and an effort price (`S` a day or less, `M` two to
three days, `L` a week or more, `XL` a product). Buckets are the method's: `A` roadmap follow-on,
`B` non-goal, `C` unconsidered, `D` depth gap. A row is a design note, not a commitment.

## Bucket C — unconsidered, the most valuable rows

These have no baseline id at all. The nearest row is named so the backlog can file them, but the
capability itself is absent from our vocabulary.

| capability | nearest id | what matching means for us | seam | effort |
|---|---|---|---|---|
| a durable append-only log for a run's stream, readable by a cursor from a later process | RT-04, RT-09 | a run's events stop being an in-process iterator and become a row log with a sequence cursor, so a subscriber that joins late replays and then tails; retention is a policy on the log, not on the producer | new `RunEventLog` beside `RunStore`, fed by the existing event emitter | M |
| one durable timer for every deferred unit of work, with the queue as the source of truth | HL-04 | every deferred behaviour (retry, schedule, sweep, recovery tick) is a row and one host adapter owns the timer; the library derives the next wake from its own table | a `RunStore` sibling, `WorkQueue`, or a host adapter contract | M |
| a capability registry with ordered lifecycle phases over a host object | RT-08 | a supported way to add state, transport and background work to an agent without editing the loop, with declared start/stop order and event routing | middleware is the nearest seam; a phase-ordered registry is more than middleware | L |
| identity and routing derived from the host, not from configuration | HL-08 | an agent instance named by its host address, with parent/child paths and a typed way to reach a child agent without a registry | absent; `AgentSession` naming is per run | M |
| a replay journal for a run whose writes are generation-fenced | HL-05 | a resumed attempt cannot commit over a newer attempt, and every write states which attempt it belongs to | `RunStore` | M |
| a detached child-run ledger, so a background child can be inspected and re-attached after a restart | MA-04 | the parent owns a run record for a child it is not awaiting; a reconcile tick repairs the relationship after a crash | `RunStore` per run, not per agent | L |

## Bucket A — roadmap follow-on behind a shipped seam

| capability | extends | what matching means for us | seam | effort |
|---|---|---|---|---|
| mid-step replay (a step's effects are journaled, not re-executed) | HL-05 | the unit of durability becomes a recorded step result with a fence, so a crash inside a step does not replay a tool call's side effect | `RunStore` | L |
| concrete durable stores (SQLite first, file second) | HL-09 | a store that survives process exit and is tested against the same conformance suite as the memory store | `RunStore` | S |
| a pending approval as serialized state a queue or UI can carry | HL-02 | an approval becomes a row: the run suspends, the decision arrives later and from elsewhere, and resuming is idempotent | `packages/core/src/agent/approval.ts` plus `RunStore` | M |
| a typed structured child report | MA-03 | a child returns a schema-validated object, not a string | `packages/core/src/agent/managed-agent.ts:53` | S |
| background or parallel subagents | MA-04 | a child runs without the parent awaiting it, with a handle to inspect, cancel or collect | `managed-agent.ts` plus a run ledger | L |
| shared state between parent and child | MA-05 | a declared scope a child can read and write, with the parent as owner of the durable copy | `AgentSession` / `RunContext` | L |
| time travel: re-run from step N with a new value | HL-07 | steps addressable by index and a replay path that starts at a chosen step | `RunStore` journal | M |
| checkpoint schema versioning | HL-10 | every persisted step or checkpoint carries a version and a migration function | `RunStore` | S |

## Bucket D — depth gaps in something we ship

| capability | extends | what a deeper version means | current depth | effort |
|---|---|---|---|---|
| checkpoint granularity | HL-03 | a checkpoint after every tool call and every model turn, with an interruption marker, instead of one per step | one checkpoint per step (`packages/core/src/agent/multi-step-agent.ts:369-380`) | M |
| approval durability | HL-01 | the gate survives the process and the decision is recorded, instead of a denial failing one call and an approval living only in memory | in-process gate | M |
| run resumption across processes | HL-04 | resumption with a claim and a lease, so two processes cannot both resume the same run | seam plus memory store | M |
| event fidelity during recovery | RT-04 | a late subscriber can reconstruct what already streamed, which needs the cursor log above | events are delivered live only | M |

## Bucket B — recorded non-goals

| capability | bucket | why it stays out | evidence |
|---|---|---|---|
| MCP server authoring | B | decision 0018 keeps it out; MC-07 stays absent | their three-lane server (`design/mcp.md:5`) shows the compatibility cost of owning the server side |
| a workspace sandbox with filesystem and shell | B | decision 0018 keeps it out; our answer is the executor bag (EX-01 to EX-04) | their workspace is the platform's computer product, not a library feature |
| a streaming UI transport and chat protocol | B | decision 0018 keeps it out; UI-06 stays absent | their chat layer is 2,793 lines of RFC plus a 1,332-line recovery engine, which supports the decision |
| voice and realtime | B | decision 0018 keeps it out | `packages/agents/src/voice/` is a large standalone stack |
| deployment and hosting | B | decision 0018 keeps it out; DS-05 is tracked separately | their deployment model assumes Workers and wrangler |
| provider routing and local runtimes | not a gap | decision 0019 removed these from the roadmap; their SDK defers to the AI SDK | `packages/agents/src/models/` are experimental adapters |

## What we have that they lack

1. **An executor abstraction.** EX-01 to EX-04 ship four executor kinds behind one contract:
   QuickJS in WASM, Pyodide in process, a host process, Docker and E2B. Their sandbox is the
   Workers isolate or a bundled worker; there is no equivalent plug-in point for a different
   guest runtime (`packages/codemode/src/executor.ts:464` is a single executor, not a family).
2. **Portable distribution.** Our packages run on Node, Bun and Deno and the gate proves it
   (DS-02). Their SDK is Workers-first: the tests run in the Workers runtime and the deployment
   target is wrangler, so a Node deployment is not a supported path.
3. **A small, readable core.** A host class of 10,390 lines and a 19,982-line chat host is a
   maintenance surface we do not carry.
4. **Middleware around a step** (RT-08) is a first-class seam, where their extension seam is a
   capability that must understand lifecycle phases.
5. **Cancellation as an abort signal with a typed event** (RT-07) is simpler than their mix of
   request-cancel frames, recovery attempts and watchdog aborts.

## Patterns worth copying

1. **Make the queue the only timer.** `cf_agents_jobs`
   (`packages/agents/src/lifecycle/job-queue.ts:205`) is the record of every deferred unit and
   `nextAlarmTime` (`:466`) derives one wake from it. Copy the shape, not the platform: a
   `RunStore` sibling that owns deferred work would let retries, schedules and sweeps share one
   clock. Price M.
2. **A journaled step with a fence.** `tasks/store.ts:47` fences every write by generation, and
   `design/rfc-fibers.md:65` states the rule: an interrupted attempt replays, and evidence tells
   the handler it is a replay. This is the single highest-value idea for HL-05. Price L.
3. **A stream log decoupled from its producer.** `streams.ts:183` keeps chunks in blocks with a
   cursor and settles retention separately (`design/rfc-streams.md:106`). A run's events would
   become inspectable after the fact with no change to the loop. Price M.
4. **A pause that is model-visible output.** `design/think-execute-hitl.md:11` makes the pause a
   normal tool result, so the transcript is the state and approval is an ordinary callable. For
   HL-02 this is a better fit than a suspension primitive. Price M.
5. **An owner-scoped queue verb.** `job-queue.ts:242-253` scopes a push by capability so one
   feature cannot overwrite another's work; the same trick protects a shared run store from
   cross-feature id collisions. Price S.
6. **Cheap isolation by construction.** A facet is a child object with its own storage
   (`design/rfc-sub-agents.md:17`), so nothing is serialized and no shared mutable state exists.
   Not copyable without a host, but the lesson is to keep isolation in the substrate. Price XL.

## Patterns to avoid

1. **The mega-class.** `packages/agents/src/index.ts` is 10,390 lines and `Think` is 19,982. The
   repository admits the cost in its own guidance ("be surgical with edits"); a ten-thousand-line
   file is a review and merge hazard we should not imitate.
2. **Compatibility lanes as a permanent tax.** Three MCP lanes, two scheduling generations, a
   deprecated synchronous schedule getter and a legacy stream-table fold all survive in the tree.
   Compatibility is right for a platform with installed users; a new library should not start
   there.
3. **A recovery subsystem that grows its own RFC.** Two design records at 2,793 and 2,354 lines
   describe chat recovery. The capability is real, but the lesson is to design the state machine
   once, small, before it acquires an incident module and a watchdog.
4. **Mandatory durability configuration.** `ChatRecoveryConfig` accepts `true` or a tuning object
   and cannot be disabled, which makes every host pay the complexity even when it does not need
   it. Our seam should stay optional and explicit.
5. **Deprecated synchronous twins.** `getSchedule`/`getSchedules` remain because crossing an object
   boundary is impossible synchronously, so an async API had to be added beside them. Avoid
   shipping a synchronous facade that the real implementation cannot satisfy.
6. **One alarm as a contention point.** Every deferred feature shares one event loop; a slow job
   delays the rest, which is why hung detection and a memory breaker exist. If we copy the queue,
   we need the same protections or a partitioned design.
7. **Replay that re-executes a model call.** The task journal replays a handler from the top, so
   a step that is not journaled repeats its work. That is correct for a durable host and dangerous
   for a library whose steps call paid APIs; the fence and the idempotency key are not optional.
8. **Tests that only run on the platform.** Their suites are Workers-runtime-first, so a
   contributor cannot validate behaviour on a laptop without the toolchain. Our Node/Bun/Deno gate
   is an advantage worth keeping.

## What it should change for us

1. **Ship a durable `RunStore` on SQLite (HL-09).** It is the cheapest way to make HL-04 real and
   it matches their acceptance model: one row per run, one row per step, a claim column. Price S.
2. **Add a journaled step with generation fencing (HL-05).** This is the item that separates "a
   checkpoint" from "replayable execution". Reuse `StepJSON`, add `generation` and an
   `interrupted` marker, and keep replay-from-the-top as the documented model. Price L.
3. **Make a pending approval serializable (HL-02).** Adopt the two-part shape: the pause is
   recorded as state, and approval is claimed exactly once before the effect runs. Do not copy
   the codemode runtime; copy the claim-before-effect rule (`think.ts:16215-16236`). Price M.
4. **Add a run event log behind the existing emitter (new C row).** Keep it out of `RunStore`: a
   log wants retention and cursors, a checkpoint wants the latest state. Price M.
5. **Keep scheduling out of the library core; define a host-adapter contract.** Their scheduler is
   a capability over a platform alarm. Ours should be a small interface a CLI or service fills,
   with an in-memory implementation for tests. Price M.
6. **Do not chase their chat stack.** The transcript, resume protocol and recovery engine are the
   largest and most expensive part of their tree and decision 0018 already keeps the UI transport
   out. Record it, cite the cost, move on.
7. **Leave buckets B alone.** MCP server authoring, workspaces, voice and deployment stay
   non-goals; nothing in this repository changes decision 0018's reasons.

## Baseline corrections

The baseline holds up on the evidence seen here. Two notes for the next rewrite:

- HL-03's status is accurate, but the row hides a real difference: their unit of durability is a
  step *result*, while ours is a whole-run snapshot between steps. The gap table above prices the
  difference as D rather than pretending the row covers it.
- HL-04's `minimal` is fair; the seam exists and only an in-memory store ships. This dive found no
  shipped store that our baseline failed to mention.

## Confidence

The evidence is source-level for everything marked `implemented`, but nothing in this clone was
executed, so the following remain unmeasured: real replay cost for a chat turn, alarm contention
under load, the retention sweep's actual effect on SQLite size, and whether the recovery engine's
budgets behave as the RFC says under repeated eviction. A benchmark or a runnable example would
change the effort prices for the two L items, not their direction.
