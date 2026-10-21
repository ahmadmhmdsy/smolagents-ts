# OpenHands — gaps and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Rows name the baseline capability they extend or contradict (`docs/research/competitors/_synthesis/00-our-baseline.md`),
the bucket from `_method.md` — A a follow-on behind a shipped seam, B a non-goal held out by decision
0018, C a capability absent from our vocabulary, D a depth gap — and an effort estimate of S for a
day or less, M for two or three days, L for a week or more. Where the capability has no baseline row
at all, the nearest row is named and the absence is the finding.

Citations are relative to the SDK clone (`sdk:`) or the Canvas clone (`canvas:`); a Canvas
documentation page is written `clone:/docs/…` so no competitor path begins with `docs/`.

## Gap rows

| baseline | what they have | bucket | effort | fit |
|---|---|---|---|---|
| RT-09, HL-03, no row for condensation | an event-sourced forgetting mechanism: a `Condensation` event carries forgotten ids, a summary and an insertion offset, and the view projection applies it at read time | C | M | a new event type plus a projection filter, not a loop rewrite |
| TL-06, RT-08, no row for skills | a skill catalogue with progressive disclosure, activation bookkeeping, keyword triggers and path rules | C | M | tool registry plus a middleware step |
| RT-06, no row for stuck detection | repeated-action, repeated-error, monologue and alternating-pattern detectors, one nudge, then a terminal `STUCK` state | C | M | loop-level observation window |
| RT-02, TL-01 | tool batches run concurrently except where two calls declare the same resource | C | M | the tool contract grows a resource declaration; the loop gains a batch path |
| TL-02, TL-06 | a tool can report itself unavailable in the current environment and drops out of the schema | C | S | registry filter |
| GR-01, GR-04 | a security analyzer scores each action and a confirmation policy turns a score into a human gate that suspends the run | C | M | approval seam already exists; add scoring and suspension |
| HL-02 | an approval is a persisted status: the run parks in `WAITING_FOR_CONFIRMATION`, and the approved action executes on the next step | A | M | extends our approval gate into a serialisable state |
| HL-06 | interruption sets a token, cancels the tracked task, patches orphaned actions with synthetic errors and leaves the run `PAUSED` | A | M | extends HL-01 and HL-03; no separate interrupt action needed |
| HL-07 | the event log is a tree with a movable HEAD, so a user can fork, navigate and re-run from any event without deleting history | A | L | extends the checkpoint seam; needs a storage format change first |
| HL-09 | one JSON file per event, a length marker per file, index rebuild on load, lease-guarded single writer | A | M | a `FileRunStore` alongside `MemoryRunStore` |
| HL-04 | resume is load-then-run: settings, agent and conversation state reload, and the loop checks status before continuing | A | M | extends the process-local resume seam |
| HL-10 | a schema version with a migration chain for persisted settings, and permanent compatibility handlers for persisted events | A | S | add a version field to our checkpoint format |
| HL-08 | a conversation id owns a tree that outlives every run against it, with parent and child conversations indexed by the server | A | S | identity above the run, not inside it |
| MA-04 | children run in parallel threads, each with its own LLM copy and metrics, joined before the parent continues | A | M | the managed-agent tool can fan out without a server |
| MA-05 | children share the parent's working directory, so files are the shared state | A | M | the cheapest blackboard is the workspace; structure still needs designing |
| MA-03 | the parent reads the child's final assistant text, so the product ships a stringly-typed child result too | D | M | parity, and evidence that a typed child report is not the default |
| MA-06 | a goal controller asks a judge model whether the transcript satisfies an objective, then starts further rounds | A | L | supervisor as code, not as a prompt convention |
| MA-01 | markdown files define reusable agents with their own tools, model, limits and hooks | C | S | a loader over the managed-agent registry |
| GR-01, RT-08 | hooks at pre-tool, post-tool, user-message, session-start and stop points can refuse an action or deny a stop | C | M | middleware and the existing approval path |
| OB-04, OB-06 | the judge returns a score and a missing-items list; the workspace registers cost and posts it to an automation callback | A | M | extends run scoring and adds accounting at the run boundary |
| EX-03 | a tool-facing remote environment: the agent loop stays local while commands, files and git cross an HTTP boundary | C | L | distinct from our guest-code executables; this is where tools run |
| EX-08 | a workspace can pause and resume by stopping and restarting its environment | A | L | snapshot semantics for a live host |
| UI-06, CL-03 | the client contract for a streamed run: durable frames with sequence numbers, deltas on a side channel, resume from a cursor | B | — | decision 0018 keeps a streaming transport out; recorded for the seam's design |
| EX-05 | a filesystem and shell for the agent | B | — | decision 0018 keeps it out; the remote-environment contract above is the separable idea |
| TL-07 | a tool call can be owned by the client: the server advertises it, the browser executes it, the result returns as a message | C | M | the inverse of a provider-hosted tool, and it keeps credentials off the server |

## The three that matter most

**Condensation.** This is the gap with the highest ratio of user value to implementation cost. Their
design separates three concerns cleanly: the decision to forget (`CompactionRequirement`), the act of
forgetting (forgetting indices over atomic tool boundaries, with the system prompt pinned) and the
durable record of what happened (a `Condensation` event plus a summary event whose id is derived from
its parent). Because the record is an event, a resumed conversation renders the same shortened view,
a UI can show that compaction happened, and a test can assert on the forgotten ids rather than on a
prompt string (`sdk:…/event/condenser.py:11-96`). Our loop has no equivalent, and the likely reason is
that our run store persists steps rather than an event tree; a minimal version can still work: one
`Condensation` step type, one projection when building messages, and a summary call with its own
model.

**Skills.** The transferable insight is not the file format, it is the deliberate omission. The
catalogue shown to the model lists a skill's name and description and never its location, because
handing over the path would let the model bypass the tool that loads the body and records the
activation (`sdk:…/skills/skill.py:1562-1568`). That single decision turns a prompt section into
an auditable tool call. The second insight is that the same trigger metadata drives three delivery
paths — always-on repository context, user-message suffix on a keyword or task match, and one-shot
injection when a glob matches a touched path — so a skill author writes the trigger once.

**Delegation.** Their three mechanisms answer different questions and it is worth copying the
decomposition rather than any one mechanism. `delegate` answers "do these subtasks in parallel and
give me the text back"; `task` answers "keep a handle on a child I can resume"; child conversations
answer "run something that should be visible to the user and isolated from my working tree". None of
them returns a structured object, and all of them fold child metrics back into the parent, which is
the part our managed-agent seam lacks.

## Patterns worth copying

- Tombstone-and-project: never rewrite stored history to shrink context; append a forgetting record
  and let readers apply it. It keeps the store append-only and makes compaction observable.
- Requirement levels: distinguish a soft threshold that may be skipped from a hard threshold that must
  be met, and give the hard path a fallback that is guaranteed to make progress.
- Progressive disclosure with a forced tool boundary: advertise names and descriptions, withhold
  locations, and record every activation.
- Declared resources on tools plus a lock manager: parallel tool execution without a global lock and
  without guessing which calls conflict.
- Environment-gated tools: an unusable tool disappears from the schema instead of failing at call time.
- Split durable from ephemeral in a stream: sequence-numbered durable events replay from a cursor,
  token deltas are disposable, and a slow client is disconnected rather than served stale state.
- A claim ledger on the client for non-idempotent tool calls, keyed by conversation and tool-call id,
  so a replay cannot launch a second billable child.

## Patterns to avoid

- Four-digit-line files that mirror every async method with a sync twin. `LocalConversation` is 3,218
  lines and `EventService` 2,410, and the duplication is the reason both are that large.
- A product name attached to the client while the behaviour lives in another repository. The register
  row pointed at the shell, and the dive had to add a second clone to answer the question.
- Threads for subagents with a shared mutable workspace. It works, but a child that edits the same
  file as its parent has no collision protection, and the shared FIFO lock is only reentrant per
  thread (`sdk:…/local_conversation.py:2297-2313`).
- Persisting a union of dozens of event types without a versioned envelope. They pay for it with
  permanent deprecated-field handlers; a version field would have cost less.
- Treating the HTTP acknowledgement of a compaction request as completion. The client has to wait for
  the event, and their own comment says so (`canvas:src/hooks/use-await-context-compaction.ts:60`).

## What this suggests for us

1. Add a condensation event and projection to the core loop first (C, M). It is the only gap here that
   changes what a long run can do rather than how it is operated.
2. Add a skill catalogue with an `invoke_skill` tool and one middleware-driven trigger path (C, M),
   reusing the existing tool registry and middleware chain.
3. Add a stuck detector and an interrupt-to-paused transition (C, M; A, M) together, because both need
   the loop to distinguish "stop and resume" from "fail".
4. Move durable storage to an append-only event directory before attempting fork or navigate (A, M),
   then expose replay as a projection rather than as a stored list.
5. Defer the streaming transport and the shell workspace (B) and record why, so the next reader does
   not reopen decision 0018 without new evidence.

## Baseline corrections

- The baseline has no row for context condensation. It should: the nearest rows, RT-09 and HL-03, do
  not cover reclaiming a context window, and the omission hides the largest capability gap in this
  dive.
- The baseline has no row for skills or microagents, although the register row names microagents. A
  TL-06 extension row would make the vocabulary visible.
- HL-07 is priced as an absent capability with no implementation path. OpenHands demonstrates a path
  (event tree plus movable HEAD), so the row is bucket A with L effort rather than an open question.
- EX-05 stays bucket B by decision 0018, but the remote-environment contract is a separate idea that
  belongs beside EX-03. Keep the non-goal and keep the contract.
- MA-04 is absent on our side and shipped on theirs without a server or a queue: threads, a shared
  workspace and a join. That makes the row A with M effort, not L.
- MA-03 stays minimal, and the competitor's minimality is evidence that a typed child report is a
  design choice rather than an industry requirement.
- HL-05 crash recovery: their design reduces the loss window to one event file but does not make a
  mid-step replay idempotent either. Our absent status is closer to the state of the art than the
  baseline wording suggests.
