# deepseek-harness — gaps and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## How this file maps to our rows

The study's four buckets are kept. A row is a claim about *our* surface, priced in the
study's units (S = one seam and a test, M = a seam, a consumer and a fixture, L = a
new durable contract). Ids are the baseline rows of
`_synthesis/00-our-baseline.md`; the findings plan is
`docs/plans/2026-10-22-apply-the-competitor-findings-plan.md`.

## Bucket C — unconsidered, the most valuable rows

These five are not baseline rows. They are proposals for the owner, and they would be
registered as new rows only if the plan adopts them.

| row | what they have that we did not consider | price | what it would look like here |
|---|---|---|---|
| *new* | **Messages addressed to a running agent, delivered at a step boundary.** A send is an ordinary user-role message with sender attribution written into the target's record; a running target sees it at its next step, an inactive one resumes. No bus, no queue, no outbox. | M | `send(child, text)` for a background child: append to the child's record, wake it if parked, expose the sender; `RT-11`'s host steering is the same primitive with the host as sender |
| *new* | **`wait` as an edge, with a typed early exit.** `wait_agent` blocks on the next status/task/message edge registered *after* the call and returns `noProgress` at once when no peer can produce one. | S | `wait(handle | handles, {timeoutMs})` returning `{settled, timedOut, noProgress}`; the loop still owns no scheduler |
| *new* | **A claim board, not a data blackboard.** Whole task snapshots with monotonically increasing revisions, an owner, a dependency DAG and advisory write scopes; every mutation is compare-and-set. | M | only meaningful once background children exist: a durable list on the parent run record — id, owner, status, blockers, write scopes; no payload field |
| *new* | **Acceptance is not processing.** A send returns a receipt ("accepted") and never claims the target acted; a failed admission is a typed error the caller sees. | S | the message seam's result type; keeps logs honest |
| *new* | **Derive availability; persist a phase.** The durable record stores `provisioning → active \| failed` once; "running"/"inactive" is computed from the live turn. That is why "inactive" cannot be mistaken for a result. | S | the run record's child rows (Phase 2.4): phase in the record, activity from the loop |

## Bucket A — a roadmap follow-on behind a seam we already ship

| id | what they have | price | note |
|---|---|---|---|
| `MA-03` | **A typed child result validated against a schema**, with the captured value separate from the transcript (`subagent.md:107-110,248-255`). | S | our Phase 2.1 is the same idea and would be the first model-facing version of it: their `subagent` tool takes no schema, so the typed capture exists only for non-model consumers |
| `MA-04` | **A durable child catalog and cold resume**: `listChildren`/`listDescendants` read without resuming; an absent child resumes when messaged. | M | Phase 2.4's background child needs exactly this; their reconciliation rule (provisioning record + child identity + admitted initial message) is the crash-safe shape |
| `MA-02` | **Interruption that preserves the inbox**: cancel the turn, keep queued mail and ownership. | S | our stop reason (`0023` vocabulary) already distinguishes it; the queue-preservation rule is the new part |
| *new* | **A per-call result schema enforced by the compiler**: every tool declares its full result type and renders compact JSON. | S | applies to our tool seam, not the loop; closes the same "undeclared result" class as `0020` |
| `HL-01` | **Approval as a closed outcome with a session policy.** `allowed-once`/`rejected`/`cancelled`/`unavailable`; `ask`/`never` per session; `never` is enforced inside the domain before any answerer, so a late-registered answerer cannot open it; an abort settles `cancelled` and discards a late answer; the ask must happen inside an open turn so the audit pair commits. | S | our 0.1 already binds a verdict to a request id and an input digest; the closed enum, the `never` policy for CI and the "no ask outside a turn" rule are the improvements |
| *new* | **An audit pair, log-only.** `approval/asked` and `approval/decided` pair by a fresh id and never enter the transcript; the model sees the derived tool result. | S | our 0.1 already says "the decision is an event"; the pairing rule is the refinement |

## Bucket D — depth gaps in something we ship

| id | our row | their depth | what to take |
|---|---|---|---|
| `MA-05` | delegated child returns text through a template | typed capture at the backend seam; delivery policy parent vs caller; durable catalog | take the typed capture and the delivery policy; the roster is out of scope for 0.1 |
| `RT-11` | steering is planned, unbuilt | one direction-neutral send with fixed Steer scheduling; the model never chooses a scheduling mode | take "one verb, fixed semantics"; reject the second tool (`followup_task`) they deleted |
| `DS-09` | conformance suite is planned | no public conformance suite, but pinned failure modes in tests (limits, stale revision, name reuse, provisioning conflict) | borrow the *list* of pinned failures, not their harness |
| `TL-05` | no default tool deadline | tool pipeline owns approval but the job runtime owns time; no per-tool deadline claim found | no lesson; do not cite them for deadlines |

## What we have that they lack

- **A single loop.** DSH runs a full session per teammate; our Phase 2 child runs the
  same loop with a separate record. Simpler to reason about, and one writer per
  record.
- **Typed reports at the model-facing delegate.** Their team spawn takes no schema, so
  a teammate's answer is prose; our Phase 2.1 puts the schema where the model can see
  it.
- **An isolated executor by default.** QuickJS-WASM, Pyodide, remote; their team
  members share a checkout and a process, which is why their write-scope story is
  advisory by necessity.
- **A written capability-claim rule** (`0020`): their tree has an equivalent instinct
  ("declared results, compact JSON", "the domain owns authority") but no single rule
  that a declared field must be read or enforced.

## Patterns worth copying, in order of value

1. **Two stores, one authority.** Coordination state in the parent's record, messages
   in the recipient's. No distributed transaction; acceptance, delivery and
   processing stay separate facts. This is the cheapest fix to the MA-05 confusion:
   it separates "messages" from "shared data".
2. **Opt-in composition, not prompt gating.** The team ships as a bundle that mounts
   packages and disables colliding tools; the sentence telling the model to create
   teammates "only when the user asks" was deleted because the gate is composition.
   For us: ship `managedAgent`/messages behind an explicit import or option, and never
   rely on prose to prevent delegation.
3. **Edge waits and typed refusals.** `noProgress`, `TEAM_TASK_STALE_REVISION`,
   startup-validated limits: a small runtime says no in a type the caller can handle.
4. **One verb per intent.** Two messaging tools became one; the model stopped choosing
   a scheduling policy. Our Phase 2 should have exactly one `send`.
5. **Identity in the runtime context, not the spawn prompt.** Compaction erased their
   spawn-prompt identity and forks inherited a stale role; they moved it to a required
   context snapshot. For us: the child's identity and `agentPath` belong in the
   record and the runtime context, never only in the initial task string.

## Patterns to avoid

- **A durable mailbox with acknowledgements and replay.** They built one, then
  replaced delivery with direct inbox writes and kept the decoder only for old logs.
- **A task board as a shared scratchpad.** It stores claims, not data; the moment a
  board has a payload field it becomes the blackboard `MA-05` refuses.
- **A UI before the usage shape.** Nine tools and a projection panel with hover
  choreography, before the team was known to be worth it.
- **Separate profile layers per client.** Web and CLI team profiles were merged within
  a month.
- **A team that crosses processes or promises worktrees.** Their documented limits are
  exactly where a small framework would over-promise.

## What it should change for us

Nothing is applied until the owner decides. The candidates, in the plan's terms:

- **`MA-05` wording**: "no shared blackboard for *data*; a typed report and, when
  background children exist, a *claim board* for coordination; messages travel as
  ordinary record entries delivered at a step boundary." This is a refusal plus two
  permitted seams, not a reversal.
- **Phase 2 amendments**: split 2.6 into `send` and `wait`; add the cold-resume and
  reconciliation rule to 2.4; state "identity in the runtime context" as a 2.3
  requirement.
- **Phase 0 refinements**: 0.1 adopts the closed outcome enum and the `never` policy
  (S, inside the same seam); no other Phase 0 item changes.
- **The register**: this dive is the twenty-second row and the only post-synthesis
  one; the synthesis files stay frozen.

## Confidence

High on the team mechanism and the subagent seam: read at source and pinned by tests.
High on approval and jobs at the documented level. Medium on the client surfaces,
which this dive read through the package READMEs. Low on anything the 0.2.1-rc.3
release changed after this checkout; that delta is version context only.