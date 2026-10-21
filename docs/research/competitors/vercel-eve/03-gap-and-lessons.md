# vercel/eve — gap analysis and lessons for this port

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Baseline row ids come from `docs/research/competitors/_synthesis/00-our-baseline.md`.
Buckets and effort sizes are defined in `docs/research/competitors/_method.md`.
Every clone pointer is relative to the clone root at commit `c543585`; a
leading `clone:/` marks a documentation path our validator would otherwise
check against our own tree.

**Gaps, bucketed**

| bucket | capability | baseline row | fit | effort | evidence | what would change |
|---|---|---|---|---|---|---|
| D | a checkpoint that survives a crash inside a model call | HL-05, HL-03 | `packages/core/src/session/run-store.ts` | L | `packages/eve/src/execution/session/turn-step.ts:110-118`, `packages/eve/src/execution/session/entry.ts:68-76` | widen the durable boundary to a whole step and make tool side effects replay-safe |
| D | resuming a run from a store another process can read | HL-04, HL-09 | `packages/core/src/session/run-store.ts` | L | `packages/eve/src/execution/durable-session-store.ts:24-67`, `packages/eve/src/execution/session-inbox/address.ts:29-40` | a durable store plus a stable address that a second process can resume |
| A | an approval that suspends instead of failing the call | HL-02 | `packages/core/src/agent/approval.ts` | M | `clone:/docs/tools/human-in-the-loop.md:12-16`, `clone:/docs/tools/tasks.md:229-239` | serialize the pending request and resume the step when an answer arrives |
| C | steering a turn that is already running | RT-07 | `packages/core/src/events.ts` | M | `clone:/docs/tools/tasks.md:245-249` | an inbound queue with a `steer` policy beside `AbortSignal` cancellation |
| C | a session command inbox | HL-08 | `packages/core/src/session/agent-session.ts` | L | `packages/eve/src/execution/session-inbox/inbox.ts:130-176` | one ordered channel carrying send, cancel, compact, clear and reset |
| D | a child agent that becomes a durable task with a receipt | MA-04, MA-01 | `packages/core/src/agent/managed-agent.ts` | L | `clone:/docs/subagents/index.mdx:13-17`, `packages/eve/src/execution/tasks/table.ts:79-97` | a call returns an id at once; the parent parks and reads the reply later |
| C | continuing a child conversation by id | MA-01, MA-03 | `packages/core/src/agent/managed-agent.ts` | M | `clone:/docs/subagents/index.mdx:246-248`, `packages/eve/src/execution/session.ts:154` | a parked child keeps history and accepts later calls on the same handle |
| A | following a child's stream from the parent | RT-09 | `packages/core/src/events.ts` | M | `clone:/docs/guides/client/streaming.mdx:267-279` | a child start event carrying a subscribable stream path |
| A | deciding who may settle an approval | HL-01 | `packages/core/src/agent/approval.ts` | M | `packages/eve/src/approval/definition.ts:111-146` | a response policy over the authenticated principal, not only a boolean |
| C | an audit record for every approval attempt | HL-01, OB-07 | `packages/core/src/monitoring/trace.ts` | S | `clone:/docs/tools/human-in-the-loop.md:183-185` | emit a candidate event before a response takes effect |
| C | loadable procedures beside tools | TL-01, TL-06 | `packages/core/src/tool/registry.ts` | M | `clone:/docs/skills.mdx:6-12`, `packages/eve/src/execution/skills/instructions.ts:29-49` | a metadata-only listing in the prompt and a body fetched on demand |
| C | an agent defined by a directory on disk | none | `packages/smolagents-ts/` | L | `clone:/docs/reference/agent-files.md:47-65`, `packages/eve/src/compiler/compile-agent.ts:79-88` | a compiled agent record loaded from files, with path-derived names |
| D | guest state that survives a process boundary | EX-07, EX-08 | `packages/core/src/executor.ts` | M | `packages/eve/src/sandbox/state.ts:7-22` | persist an executor handle and resume it instead of rebuilding the guest |
| B | a workspace with a filesystem and a shell | EX-05 | decision 0018 keeps it out | XL | `clone:/docs/sandbox/index.mdx:55-72` | recorded, not queued; its absence is why most rows above are L or XL |
| D | an enforced network policy for guest code | EX-06 | `packages/exec-remote/src/backends/` | M | `clone:/docs/sandbox/index.mdx:66`, `clone:/docs/concepts/security-model.md` | providers map the declared policy to a real control or refuse to run |
| D | a durable event log with a resumable cursor | RT-09, OB-01 | `packages/core/src/events.ts` | M | `packages/eve/src/execution/session-event-stream.ts:32-122` | append events with stable ids and read from an index after a reconnect |
| D | snapshot semantics for a client | RT-14, UI-05 | `packages/core/src/session/agent-session.ts` | S | `clone:/docs/concepts/sessions-runs-and-streaming.md:283-300` | a bounded read that pins a tail instead of following it |
| C | compaction that moves the run forward | HL-03, RT-14 | `packages/core/src/session/agent-session.ts` | L | `packages/eve/src/execution/session.ts:12-33` | summarize, then hand the compacted state to a fresh owner |
| C | a per-call cost decision | RT-11 | `packages/core/src/monitoring/monitor.ts` | S | `packages/eve/src/execution/effective-agent-config.ts:28-36` | ask a caller function before each model call instead of reporting after |
| C | a turn that never ends while work is running | HL-03 | `packages/core/src/agent/multi-step-agent.ts` | M | `clone:/docs/tools/tasks.md:212-217` | the loop returns a held stop with working ids, and a result appends rather than restarts |
| C | refusing to run a session built by another version | HL-10 | `packages/core/src/session/run-store.ts` | M | `packages/eve/src/execution/workflow-runtime.ts:296-336` | stamp the checkpoint with a format version and fail with a recovery path |
| C | one owner per session across processes | HL-04 | `packages/core/src/session/run-store.ts` | L | `packages/eve/src/execution/session/entry.ts:328-429` | a claim with a lease and a documented takeover handshake |
| B | channels, deployment and a hosted world | CL-01, UI-06 | decision 0018 keeps them out | XL | `clone:/docs/channels/overview.mdx`, `clone:/docs/concepts/execution-model-and-durability.mdx:16-24` | recorded as the context this framework assumes, not as our roadmap |
| A | eval assertions over task and turn events | OB-04 | `packages/core/src/monitoring/eval.ts` | S | `clone:/docs/evals`, `clone:/docs/tools/tasks.md:267-295` | expectations can read task receipts and waiting events, not only steps |

**What we ship that this neighbour does not**

- An isomorphic core: our loop and executors run in a browser, on Bun and on
  Deno. eve depends on a Workflow world and a server process, which is a
  different portability claim.
- Code-as-action as the primary interface. eve's model writes tool calls, and a
  workflow tool body is authored code the model cannot rewrite per turn.
- A small dependency surface. eve leans on the Workflow SDK, Nitro, the AI SDK
  and provider packages; our runtime stays inside the workspace.
- Executor portability as a declared contract. Their sandbox is a managed
  resource with provider-specific artifacts; our `ExecutorCapabilities` bag is
  the same idea without the operational footprint.
- Decision 0018 as a written boundary. Their feature set is coherent only
  because the sandbox exists, which is useful evidence for keeping that
  boundary deliberate rather than accidental.

**Patterns worth copying**

1. **A wait is a value, not a thread.** A deferred call returns `park` with the
   ids it must hear from, and the turn loop waits on one ordered inbox. Nothing
   polls and nothing holds a process open
   (`packages/eve/src/execution/session/turn.ts:203-278`).
2. **Ownership is data with a handshake.** The stable hook token, the lease, and
   the forced-versus-released handoff turn deployment rollout into an explicit
   protocol instead of an operational surprise
   (`packages/eve/src/execution/session/entry.ts:328-429`).
3. **Two-sided approval.** A request policy decides when to ask; a response
   policy decides who may answer, with the principal and auth in scope. The
   candidate event makes refusals auditable
   (`packages/eve/src/approval/definition.ts:111-166`).
4. **Progressive disclosure for procedures.** Descriptions sit in the prompt,
   bodies load on demand, and generated files land beside the skill in the
   sandbox (`clone:/docs/skills.mdx:6-33`).
5. **A documented replay contract.** The docs state which event identity a
   client may deduplicate on and which it may not, and why
   (`clone:/docs/concepts/sessions-runs-and-streaming.md:183-199`).
6. **Receipts keep the model busy.** A long call answers immediately with an id,
   and the result arrives as a normal tool result in a later step, so the
   transcript reads like a conversation rather than a blocking call
   (`clone:/docs/tools/tasks.md:135-210`).

**Patterns to avoid**

1. **Depending on an engine's semantics for correctness.** Session ownership,
   replay and hook delivery are the Workflow SDK's behaviour, so a framework
   that adopts the pattern inherits a hard external contract and a migration
   path per world.
2. **Pre-1.0 churn as a feature.** Breaking changes ship in patches, and the
   project tracks them in a generated compatibility module whose entries are
   release-note strings (`packages/eve/src/compiler/extension-compatibility.ts`).
   Claims about this repository decay in weeks.
3. **No task time limits.** A task has no deadline of its own, and a turn held
   by it keeps the session alive; the documented remedy is that a person asks
   for an update (`clone:/docs/tools/tasks.md:311-314`).
4. **At-least-once settlement that can duplicate a child's work.** The code
   accepts a replay-orphaned duplicate settling the same call
   (`packages/eve/src/shared/action-types.ts:237-267`); a library with stronger
   side-effect guarantees cannot copy that trade unexamined.
5. **One huge package.** 2,902 files and a 1,381-line manifest in a single
   published package make the public/private line expensive to hold.
6. **Docs that carry behaviour the source does not restate.** Several rules
   live only in prose, which is efficient until a refactor moves the code
   without the page.

**What this should change for us**

- Treat `HL-02` and `HL-05` as one design move: serializing a pending approval
  and widening the checkpoint to cover a model call are the same change to the
  step boundary.
- Add an inbound command seam to a running agent before adding any new loop
  feature. Steering, cancellation and a follow-up message all need it, and
  `RT-07` currently offers only an `AbortSignal`.
- Put `MA-04` behind the existing managed-agent seam: a child that returns a
  handle immediately and reports later is a smaller change than a new agent
  type.
- Open a `C` row for skills; it is absent from our vocabulary, not thin in it.
  The smallest useful version is a description in the prompt and a body tool.
- For streaming, adopt the ideas and not the transport: stable event ids, a
  bounded snapshot read and a cursor are enough to close `T-28` without an
  NDJSON lease protocol.
- Keep `EX-05` where it is. The dive prices the sandbox as XL and shows that
  most of this framework's width depends on it; that is a reason to keep the
  boundary, not to move it.

**Where the baseline needs a correction**

- `RT-05` records `code.delta` as implemented and cites a test that pins the
  deltas, while `docs/04-tasks.md` still lists `T-30` as declared-but-never-
  emitted. Both cannot stand: the evidence in the baseline row is stronger than
  the task note, so `T-30` reads stale and should be closed or narrowed. This
  dive did not open our package sources, so the correction is a pointer to the
  contradiction, not a re-verification.
- `HL-04` says resume across processes is `minimal` because only
  `MemoryRunStore` ships. eve makes the same capability a first-class run
  state, which supports the depth reading of that row rather than changing its
  status.
- No other row was contradicted by this dive. The status vocabulary survived
  the comparison: everything we call absent here is absent there too, and the
  interesting differences are depth, not existence.