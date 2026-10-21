# agno — gaps and lessons for this port

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Baseline rows come from `docs/research/competitors/_synthesis/00-our-baseline.md`;
buckets and sizes follow `docs/research/competitors/_method.md`. Evidence cells
name a page read on 2026-10-21 or a module in the repository tree at the pinned
commit. A bucket B row is recorded for the register and is not a backlog item.

Rows run from the closest neighbours to the furthest, so a reader can stop at the
line that matters to them and leave the reserved items unread.

**Gaps, bucketed**

| bucket | capability | baseline row | fit | effort | evidence | what would change |
|---|---|---|---|---|---|---|
| D | a checkpoint that survives a crash inside a step | HL-05, HL-03 | `packages/core/src/session/run-store.ts` | M | `checkpoint="tool-batch"` writes after each tool batch and keeps the run RUNNING | persist a non-terminal status between batches, not only between steps |
| D | resuming a named run from another process | HL-04, HL-09 | `packages/core/src/session/run-store.ts` | L | `continue_run`, `/continue` | a stored status plus a continue-by-id entry point, instead of a second store type |
| D | time travel to a message boundary, and forking | HL-07 | `packages/core/src/session/run-store.ts` | M | checkpoint endpoints, `continue_from`, `fork` | derive boundaries from the transcript and expose an index |
| D | an approval another service can resolve | HL-02 | `packages/core/src/agent/approval.ts` | M | pending record in `agno_approvals` | serialise the requirement and let the host authorise the resolver |
| A | pausing for a human-supplied value | HL-06 | `packages/core/src/agent/approval.ts` | M | `requires_user_input` | turn the gate into an ask-or-allow decision, not only a boolean |
| D | durable store implementations | HL-09 | `packages/core/src/session/run-store.ts` | M | JSON, SQLite, Postgres and distributed adapters | ship one durable store beside `MemoryRunStore` |
| D | a format version on a checkpoint | HL-10 | `packages/core/src/session/run-store.ts` | S | migration routes and a status vocabulary | add a version field and a refusal path |
| B | a workspace with a filesystem and a shell | EX-05 | decision 0018 keeps it out | XL | `Workspace` toolkit | recorded, not queued; its absence explains most effort sizes below |
| C | a database-backed note store for the agent | none | `packages/tools/src` | S | `FileSystem` | a tool that gives the model a small durable text workspace |
| C | a checkpointable guest sandbox | EX-08 | `packages/core/src/executor.ts` | M | sandbox module providers and checkpoint stores | snapshot and restore as an executor capability |
| D | exporting spans to an external collector | OB-02 | `packages/core/src/monitoring/trace.ts` | M | `tracing=True`, OpenTelemetry | an exporter seam over the existing span tree |
| D | cost and usage aggregates | OB-06 | `packages/core/src/monitoring/monitor.ts` | S | metrics routes over daily aggregates | price the usage we already record |
| D | a regression suite over many runs | OB-05 | `packages/core/src/monitoring/eval.ts` | L | evals with judge and reliability modes | datasets and scorers on top of the expectation shape |
| D | a resumable event stream | RT-09 | `packages/core/src/events.ts` | M | buffered events and `/resume` | add a cursor and a bounded buffer to the typed stream |
| D | cancellation another process can observe | RT-07 | `packages/core/src/events.ts` | S | `cancel_run` records intent | record intent so a later process can honour it |
| C | team topology as configuration | MA-06, MA-02 | `packages/core/src/agent/managed-agent.ts` | L | `TeamMode` coordinate, route, broadcast, tasks | express composition as data rather than hand-built trees |
| C | one state object shared across a family of agents | MA-05 | `packages/core/src/agent/run-context.ts` | M | `session_state` | pass a session-scoped state bag into every run |
| C | procedures loaded on demand | TL-06, TL-01 | `packages/core/src/tool/registry.ts` | M | `SKILL.md` and three retrieval tools | a metadata list plus a body tool, no sandbox needed |
| C | a runtime seam for identity and quotas | none | `packages/react/src` transport seam is the closest | L | JWT scopes, service accounts, public-surface limits | expose a hook, do not ship a server |
| B | schedules, templates, control-plane UI | CL-01, UI-06 | decision 0018 keeps them out | XL | scheduler, nine deploy templates, os.agno.com | recorded as infrastructure the host owns |
| B | MCP server authoring and protocol interfaces | MC-07, UI-06 | decision 0018 keeps them out | XL | `mcp=True`, A2A and AG-UI adapters | recorded; the client half is ours |
| B | retrieval over a vector database | none in the baseline; decision 0018 names it | decision 0018 keeps it out | XL | `Knowledge` and 20-plus vector stores | recorded; it is the largest single omission in this comparison |
| D | a summary of older turns in context | HL-03, RT-14 | `packages/core/src/session/agent-session.ts` | S | session summaries with bounded input | summarise old turns beside the recent window |
| A | a list of resume points for a client | RT-14 | `packages/core/src/session/agent-session.ts` | S | checkpoint timeline route | derive and expose the boundaries a UI may offer |

**What we ship that this neighbour does not**

- An isomorphic loop. Our core runs in a browser, on Bun and on Deno, and the
  executors are part of that portability claim; Agno's runtime is a FastAPI
  process on a server.
- Code-as-action. Our model writes a program for a guest sandbox; Agno's model
  selects tools and Python functions, which is a different control surface.
- A small dependency footprint. Agno's wheel brings FastAPI, SQLAlchemy,
  OpenTelemetry and a database adapter into the application process by design.
- A typed error taxonomy and a Zod tool schema are library seams here; there
  they are runtime behaviours configured per agent.
- We publish nothing for a while, which is a weakness, but we also owe no
  database schema and no migration path to a user who upgrades.

**Patterns worth copying**

1. **A non-terminal status is what makes recovery possible.** Writing the run
   as RUNNING after each tool batch is the whole trick; a process that dies
   leaves a row that `/continue` can pick up under the same id.
2. **Resume in place, fork for replay.** Continuing a run keeps its identity,
   while replaying from an earlier boundary forks a new one and preserves the
   original result.
3. **Derive checkpoint boundaries from the transcript.** Two GET routes read
   message markers and truncate a snapshot, so there is no second store to keep
   consistent with the first.
4. **Say what replay does not restore.** The docs state that files and tool side
   effects are not rewound and that tools must stay idempotent, which turns a
   dangerous expectation into a documented contract.
5. **Split authorisation from mechanics.** The SDK records and resolves an
   approval; the application decides who may resolve it. A library can copy
   that boundary without shipping identity.
6. **A pause has one shape.** Confirmation, missing input and external execution
   are three requirements on one paused run, not three mechanisms.

**Patterns to avoid**

1. **Platform code inside the library package.** `agno/os`, `agno/sandbox` and
   `agno/job_queue` live in the same distribution as `Agent`, so a user who
   wants a loop also installs a server and its dependencies.
2. **One database abstraction for every feature.** Coupling the queue, the
   scheduler, approvals and traces to adapter capability means every new
   backend must implement every domain or the feature silently degrades.
3. **Crash equals failure by default.** At `max_attempts=1` a dead worker makes
   the run ERROR and waits for an operator to requeue; safe for side effects,
   unhelpful for unattended systems.
4. **A hosted control plane as the primary UI.** The browser talks to the
   runtime, but the product surface is a separate hosted application, so the
   open-source path stops at an API.
5. **Documentation in a different repository from the code.** The site is MDX in
   `agno-agi/docs`, rendered separately, which makes drift between a flag and
   its page a routine risk rather than a caught one.

**What this should change for us**

- Close `HL-05` and `HL-04` with one change: persist the run as RUNNING after
  each tool batch and add a continue-by-id entry point on the existing store.
- Add `HL-07` as a derived feature: list message boundaries and accept an index
  plus a fork flag. No checkpoint table, no replay engine.
- Give `HL-02` a row store rather than a suspended promise, and let the host
  authorise who resolves it.
- Ship the small note filesystem as a tool built on the existing executor; it is
  a bucket C row, not the `EX-05` non-goal.
- Put an exporter seam behind `OB-02` before adding any vendor integration.
- Keep `EX-05`, `MC-07`, vector stores, scheduling and deployment in bucket B.
  This dive shows how much product sits behind that line; it is a reason to hold
  the line deliberately, not to move it by accident.

**Where the baseline needs a correction**

- No row was contradicted. The status vocabulary held: everything recorded as
  absent here is absent there too, and the differences are depth, not existence.
- `HL-04` is right to say `minimal`, and this read sharpens what the missing
  piece is: the seam needs a stored non-terminal status and a continue route,
  not another store implementation.
- One vocabulary gap: a database-backed note store has no row at all. It is
  distinct from a workspace sandbox and small enough to price as a bucket C
  item rather than folding into `EX-05`.