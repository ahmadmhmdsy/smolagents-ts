# Durability across the register — a design brief for the resume lane

**Contract**
- **Role:** cross-repo synthesis for the durability lane only.
- **Mutability:** frozen once filed at the read date.
- **Read when:** designing HL-02 through HL-10, or changing the `RunStore` seam.
- **Update when:** a newer dive supersedes one of these readings; never edit.

This brief cites ten of the filed dives, not the clones; every pointer below names a
filed record and the lines in it. Read date 2026-10-21. Row ids and status words
come from `docs/research/competitors/_synthesis/00-our-baseline.md:50-59`. No
repository was read for this brief beyond those dives, so every claim is a
synthesis of what the dives already established.

Two questions separate the ten neighbours, and neither is about maturity. What
does the stored record let a new process re-establish, and what must it re-run
to get there? A design that answers the first and not the second looks durable
and is not.

## 1 The spectrum: what a resume actually recovers

| band | record the store holds | resume re-runs | neighbours |
|---|---|---|---|
| 0 | a conversation transcript and nothing about the run | whichever turn the transcript ends at | claude-agent-sdk |
| 1 | one run document, written at turn or pause boundaries | the interrupted turn | openai-agents-js, pydantic-ai, agno |
| 2 | state at every step, event or superstep, with a pointer | the unfinished step only | langgraphjs, mastra, openhands, adk-js, vercel-eve |
| 3 | per-step state plus journaled effect results under a fence | the unfinished step, reading journaled results for finished ones | cloudflare-agents |

**Band 0 — transcript only.** `claude-agent-sdk` resumes by loading a JSONL
transcript before a fresh subprocess starts, and forks by rewriting ids into a
second transcript (`docs/research/competitors/claude-agent-sdk/02-features-inventory.md:78-82`).
Its external `SessionStore` mirror is best-effort and adapter-owned
(`:82-90`). Nothing there records which step ran, so a crash mid-turn leaves a
transcript that ends inside an effect, and recovery becomes a fresh model
decision (inferred from the reseed path). This is the floor: conversation
continuity, not run recovery.

**Band 1 — turn boundary.** `openai-agents-js` serializes a versioned
`RunState` and rebuilds it on resume, but the write point is the turn: items are
persisted per turn, and history lives behind a session interface
(`docs/research/competitors/openai-agents-js/01-architecture.md:58-70`, `:78-84`).
Pending approvals travel inside that document. `pydantic-ai` goes further and
treats message history itself as the durable record, with suspended responses
persisted by marker and resume meaning re-issue the turn
(`docs/research/competitors/pydantic-ai/01-architecture.md:138-145`). Its
durable-execution path journals model and tool calls for liveness, and the docs
separate that from snapshotting settled steps (`:141-144`). `agno` sits on the
same band with a sharper opt-in: `checkpoint="tool-batch"` writes a running
record after each batch, and `/continue` resumes under the same run id
(`docs/research/competitors/agno/02-features-inventory.md:54-56`).

**Band 2 — every step.** LangGraph commits one immutable checkpoint per
superstep, keeps pending task writes beside it, and offers sync, async and
terminal-only durability (`docs/research/competitors/langgraphjs/01-architecture.md:102-111`,
`:153-167`). Mastra materialises a run from one snapshot document, merges partial
writes into it, and persists only when the run is pending, paused or suspended
(`docs/research/competitors/mastra/01-architecture.md:81-92`, `:165-177`).
OpenHands appends one event file per event, re-derives state from the log, and
says a crash costs at most the step in flight
(`docs/research/competitors/openhands/01-architecture.md:129-143`). ADK treats
the event log as the state machine, with resumability off by default and a
pending confirmation found by scanning the log and then re-executed
(`docs/research/competitors/adk-js/01-architecture.md:109-138`). eve hydrates a
durable session projection per step and parks the turn on an inbox while work
runs elsewhere (`docs/research/competitors/vercel-eve/01-architecture.md:94-107`,
`:118-131`).

**Band 3 — journaled effects.** `cloudflare-agents` is the only neighbour that
journals results and fences the writer. Every attempt replays from the top, a
completed step returns its journaled result, and each claim writes a generation
that every later write is checked against
(`docs/research/competitors/cloudflare-agents/02-features-inventory.md:74-77`).
A claim deadline keeps a live attempt from being stolen and lets a dead isolate
be reclaimed (`:76`).

The honesty that matters across all four bands: none of them makes an external
side effect exactly-once. LangGraph says a resumed node runs again from its
start (`docs/research/competitors/langgraphjs/01-architecture.md:163-167`),
agno tells readers to keep tools idempotent
(`docs/research/competitors/agno/02-features-inventory.md:157`), and Cloudflare
gets its guarantee by claiming an approval before the effect
(`docs/research/competitors/cloudflare-agents/02-features-inventory.md:101`).
A journal buys replay of state and detection of duplicates; it does not buy a
transaction around the world.

## 2 Five decisions

### D1 — where the commit boundary sits

Every neighbour answers this with its storage and then pays for it. LangGraph
commits per superstep; OpenHands per event; Mastra per run with a merge; OpenAI
per turn; agno per tool batch; eve per host step; Cloudflare per task step. The
trade is visible in Mastra's own tests, which measure snapshot write
amplification and keep a merge helper so siblings do not clobber each other
(`docs/research/competitors/mastra/01-architecture.md:174-177`). A per-event
log shifts cost to read time and makes branches cheap; a per-run document shifts
cost to write time and needs merge rules.

**Lean:** commit per step, and add a journal entry per external effect inside the
step. Do not persist model tokens or partial reasoning. That matches the seam we
already have (`docs/research/competitors/_synthesis/00-our-baseline.md:52`) and
makes the boundary the one a caller can reason about.

### D2 — what resume re-executes

The neighbours agree on the rule and differ only in vocabulary. LangGraph
re-runs the interrupted node and consumes the resume value by index; ADK
fast-forwards completed nodes and re-runs waiting ones; Cloudflare replays from
the top against journaled results; eve retries the step; OpenAI re-enters the
loop before turn preparation. The rule: completed units are read from the
record, the incomplete unit runs again, and nothing in memory is trusted.

**Lean:** resume is replay from the last committed step. A `done` journal entry
returns its result; an entry with no result is never retried silently — it is an
explicit in-doubt state, because the alternative is guessing about the world.

### D3 — who may write a run

Five neighbours fence ownership, each with a different mechanism. Mastra takes a
lease, renews it, and rejects a second resume while allowing an unclaimed one
only behind an opt-in (`docs/research/competitors/mastra/01-architecture.md:89-92`,
`:179-183`). eve leases before claiming hooks, with a forced and a released
handoff for code-version takeover
(`docs/research/competitors/vercel-eve/01-architecture.md:149-155`). OpenHands
leases per conversation over shared storage
(`docs/research/competitors/openhands/01-architecture.md:145-148`). Cloudflare
pushes a claim deadline forward and fences writes by generation
(`docs/research/competitors/cloudflare-agents/02-features-inventory.md:75-76`).
agno's queue claims with a refreshed lease
(`docs/research/competitors/agno/02-features-inventory.md:61`).

**Lean:** ownership is a compare-and-set on the record, not a daemon. The caller
may pass an owner token; the store increments `generation` on claim, and every
commit carries the generation it read. A store that cannot fence degrades to
last-writer-wins only for single-process use, and says so.

### D4 — how a pause is represented

No neighbour holds a suspended stack. OpenAI puts interruptions inside the run
document; LangGraph commits an `INTERRUPT` write and a resume write, then
re-runs the node; Mastra refuses to overwrite a suspended snapshot; ADK scans the
event log for a confirmation and re-executes the pinned call; agno writes a row
to `agno_approvals` and lets the application authorise the resolver; Cloudflare
deletes the pending row before running the effect and sweeps abandoned pauses by
age; eve parks the turn on an inbox. The shape is uniform: a pause is a record
with an identity, a later write resolves it, and resolution is idempotent.

**Lean:** one `pending` field with a kind (approval, input, external), a
`requestId`, a digest of the arguments, and an optional `expiresAt`. Generic
kinds cost little now and prevent three mechanisms later.

### D5 — how a stored shape is versioned

The neighbours either migrate or refuse, and several do both. OpenAI stamps a
literal schema version, keeps a supported list back to 1.0, and rejects an
unsupported one with an instruction to reserialize. LangGraph puts a numeric
format version in the record, adds columns with `IF NOT EXISTS`, and patches old
rows forward in the reader. ADK keeps a `schema_version` in metadata as a
cross-language contract. OpenHands keeps a migration chain and is at persisted
model version 6. eve stamps the run with the code version and refuses commands
on a stranded run. agno's gap row asks for a version field plus a refusal path.

**Lean:** one integer on the envelope. Refuse an unknown value with a typed
error that carries the number and a recovery path; patch known older values in
the reader. Do not auto-migrate on write, and never coerce a record whose step
set the reader does not understand.

## 3 Where the neighbours converge

Six choices recur across three or more dives, which makes them the default unless
we can state a reason:

1. **One immutable record per boundary, never a mutated blob.** Superstep
   checkpoints, event files, snapshot documents, task journals and session
   projections all share the shape (`docs/research/competitors/langgraphjs/01-architecture.md:102-111`;
   `docs/research/competitors/openhands/01-architecture.md:129-133`;
   `docs/research/competitors/cloudflare-agents/01-architecture.md:146-153`).
2. **A version on the stored shape and a refusal path.** openai-agents-js,
   langgraphjs, adk-js, openhands, vercel-eve and agno's recommended fix all
   carry it.
3. **A claim or lease before writing.** mastra, vercel-eve, openhands,
   cloudflare-agents and agno.
4. **A pause is data with an id, resolved by a later write.** openai-agents-js,
   langgraphjs, adk-js, agno, cloudflare-agents.
5. **Resume re-executes the unfinished unit and reads finished ones from the
   record.** Stated by nine; claude-agent-sdk stops at transcript granularity.
6. **Side effects are the caller's idempotency problem.** langgraphjs says it
   plainly, agno documents it, cloudflare and pydantic-ai claim before acting.

They diverge on four things worth naming rather than inheriting: commit
granularity (event, superstep, turn, batch), pause generality (approval only, or
input and external too), version policy (migrate, patch forward, refuse), and
whether the store or a host enforces ownership. The first two are ours; the last
two already follow from a library with no server.

## 4 The minimum spine for HL-02 through HL-10

The spine is one interface and one record. It fits a library because it owns no
clock, no process and no transport: the caller supplies a store, and the loop
supplies the steps. `RunStore` today holds a checkpoint between steps; the
additions below are fields and calls, not a new subsystem.

### 4.1 The record

| field | type | purpose |
|---|---|---|
| `schemaVersion` | integer | HL-10; unknown value refused, never coerced |
| `runId` | string | HL-04; stable address for resume |
| `conversationId` | string, optional | HL-08; links runs that belong to one conversation |
| `agentFingerprint` | string | hash of step graph, tool names and prompt revision |
| `generation` | integer | HL-05 fence; incremented by each claim |
| `status` | enum | running, waiting, completed, failed, interrupted |
| `step` | object, nullable | current `{index, id, startedAt}` |
| `completed` | array | `{stepId, index, result, usage, finishedAt}` per finished step |
| `journal` | array | `{stepId, callId, toolName, argsDigest, state, result, at}`, state intent or done |
| `pending` | object, optional | `{kind, requestId, stepId, callId, argsDigest, createdAt, expiresAt, payload}` |
| `memory` | opaque JSON | what the loop already snapshots today |
| `parentRunId`, `parentStep` | optional | HL-07 lineage for replay and fork |
| `createdAt`, `updatedAt` | timestamps | retention and debugging |

The `journal` is the only new write path inside a step: an entry is written
before an effect starts and completed after it returns. The record itself stays
one JSON-safe document whose pieces the store may split.

### 4.2 What the loop owns

The loop numbers steps, calls the gate, journals around effects, emits events,
and asks the store to commit at each boundary. It never lets a tool write a
record. On resume it verifies the record and re-enters at the first incomplete
step; the gate reads `pending` instead of holding a promise.

### 4.3 What the caller owes

A store, a clock, a stable id scheme, the agent fingerprint, and an authorisation
rule for whoever resolves a request id. The caller either supplies idempotency
keys for external effects or accepts that an in-doubt effect is surfaced, not
retried. Two processes resuming one run get a winner and a typed conflict.

### 4.4 Resume-call semantics

`resume(runId, options)` is a state machine, not a convenience:

1. Load. Missing record returns `RunNotFound`; no run is created implicitly.
2. Verify. Unsupported `schemaVersion` returns `UnsupportedCheckpointVersion`
   with the value; a fingerprint mismatch returns `RunDefinitionChanged` unless
   the caller opts in and step ids still line up.
3. Claim. With store ownership, take the claim and bump `generation`; otherwise
   compare-and-set against the generation that was read. A live owner returns
   `RunClaimed`.
4. Replay. Completed steps are applied from `completed`; a journal entry with a
   result is returned; an entry in state intent is surfaced as
   `EffectOutcomeUnknown`.
5. Run. Execute from the first incomplete step, committing after each one with
   the fence.
6. Settle. Terminal status releases the claim; a suspend keeps `pending` and
   parks.

The returned handle exposes the record and the pending request, so a UI can
render a pause without a second read.

### 4.5 What this closes, and what it does not

| row | closure | residual |
|---|---|---|
| HL-02 | `pending` row with request id and digest | UI and authorisation live above the seam |
| HL-03 | one record per step, replacing the memory-only checkpoint | store implementations decide latency |
| HL-04 | `resume` plus claim, `generation` fence | a store that cannot fence is single-process only |
| HL-05 | journal intent and done, generation-fenced writes | external effects stay at-most-once and in-doubt is explicit |
| HL-06 | pending kind input, resume value carried in the record | value validation is the caller's |
| HL-07 | `parentRunId` and `parentStep`, step listing for replay | UI for a timeline is not in scope |
| HL-08 | `conversationId` on the record | `AgentSession` still owns cross-turn memory |
| HL-09 | the interface plus a conformance suite | one durable adapter ships first, not four |
| HL-10 | `schemaVersion` and a refusal path | migration of existing records is a follow-on |

### 4.6 What not to build

No host: no alarm, scheduler, queue daemon or lease reaper. No event-stream
replay (RT) or sandbox snapshots (EX). No token journal, distributed lock,
compaction, workflow engine or deployment world. A second store adapter and the
conformance suite pay for themselves; a coordination service does not.

## 5 Failure modes worth writing first

Each is stated so an implementer can write it without asking what the design
meant. The set also seeds the `RunStore` conformance suite LangGraph ships beside
its interface (`docs/research/competitors/langgraphjs/01-architecture.md:20`).

1. **Crash between steps.** Commit step 2, do not run step 3, load again.
   Resume runs step 3 only; the tool counter for step 2 does not move.
2. **Crash after effect, before the journal result.** Write intent, leave the
   result absent, resume. The call returns `EffectOutcomeUnknown` and does not
   silently retry.
3. **Effect retried only when declared idempotent.** Same fixture with the tool
   marked idempotent; resume runs it once more and the counter reads two, and
   the record says so.
4. **Two resumers race.** Resume from two handles at once. Exactly one claim
   succeeds, the loser gets `RunClaimed`, and `generation` advances once.
5. **Stale writer fenced.** Read generation 3, let another claim reach 4, commit
   with 3. The store rejects, the record is byte-identical, and the run stays
   resumable.
6. **Unknown schema.** Load a record stamped one version above the reader. The
   load throws with the number in the message and returns no partial record.
7. **Approval resolved twice.** Resolve a pending request twice. The effect runs
   once and the second resolution reports the settled state.
8. **Expired pause.** Resolve a request past `expiresAt`. No effect runs; the
   run reports a typed expired outcome.
9. **Store failure on commit.** Make commit throw after the step ran. The run
   fails rather than reporting success, and a reload shows the last committed
   step.
10. **Unknown run.** Resume an id that was never written. `RunNotFound`, and
    the store contains no new record.

## Provenance

Sources are the ten filed dives under `docs/research/competitors/`, at the dates
recorded in their `04-sources.md`; this brief adds no read of its own. The
exactly-once claim is a cross-dive inference from hedges in langgraphjs, agno and
cloudflare-agents, not a sentence any one dive writes. If a dive is revised, this
file is superseded, never edited.
