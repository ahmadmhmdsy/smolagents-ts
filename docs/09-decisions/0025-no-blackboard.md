# 0025 — no blackboard: a report, a message, and a claim board

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** designing delegation, a child message, or shared state between
  agents.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-24
- **Decided by:** owner, approving the adoptable list from the harness dive and delegating the wording
- **Supersedes:** none; it closes the blackboard row that 0022 left open

## Context

The study's delegation question (`MA-05`) was "confirm in writing that there is no
shared blackboard by default". It stayed open because the answer depends on what
delegation is for, and the plan had only one shape: a parent calls a child exposed as
a tool, and the child's prose comes back.

The harness dive (`docs/research/competitors/deepseek-harness/`) settled it with a
working counter-example. That tree ships agent teams with peer messaging, and still
has no blackboard: a message is a normal user message written into the recipient's
own record and delivered at its next step boundary; a shared task board stores an
owner, a status, a dependency edge and an advisory write scope, and no payload; a
child's answer can be a value validated against a schema. Every place where data
could have accumulated was refused, and the refusal is what keeps the coordination
story to three seams instead of a store.

## Decision

There is no shared data blackboard. A child and its parent exchange exactly three
things, and each has a home:

1. **A typed report.** The child's answer is a value validated against a declared
   schema, with a failure channel separate from the value; the report is the child's
   durable output and is recorded in the parent's run.
2. **A message.** A send is an ordinary record entry in the recipient's run, carrying
   the sender's name; it is delivered when the recipient takes its next step, and an
   inactive child resumes for it. Acceptance is not processing: the sender learns that
   the entry exists, not that the child acted on it.
3. **A claim board, only when a background child exists.** It stores an owner, a
   status, a dependency edge and an advisory write scope; it never stores data. A
   field that carries a payload turns it into the blackboard this record refuses.

Two rules bound the surface. The delegation features are **opt-in**: an explicit
import or option, off by default, never enabled by prose in a prompt — composition is
the gate. And the **team shelf is out of scope**: a durable roster of named peer
sessions, nine coordination tools and a client panel are a product shell, not a
library seam; they would be a new decision with a product reason.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **One shared object the runtime owns** | It needs key ownership, write-conflict resolution, projection and replay: a small state engine with every later concurrency bug ours. An object the caller creates and passes keeps that burden where it belongs. |
| **A durable mailbox with queued and delivered states** | The neighbour built one, then replaced delivery with direct inbox writes and kept the decoder only for old logs; the extra guarantee was not worth a second owner. |
| **No messaging, reports only** | A background child that outlives the parent call cannot be steered, and a parked child cannot be woken; the report is necessary but not sufficient. |
| **A shared scratchpad with a reducer** | Cheap to describe, expensive to make replayable: every write needs an author, a step and an ordering answer, which is exactly what the run record already gives a report. |

## Consequences

**Positive**

- One reason answers "where does shared state live": in a report, in a message that is
  a record entry, or in a caller-owned object.
- The background child and its claim board are the only new durable rows, and they
  arrive together, guarded by a flag.
- The refusal is testable: a field on the board that carries data fails review, and a
  message that claims the recipient acted fails a test.

**Negative / accepted costs**

- A parent cannot hand a child a live view of its own working state; the child gets a
  prompt and messages, so a task that needs continuous shared context stays in one
  process.
- Three primitives instead of one board means three seams to document, and the
  message seam must define what "accepted" means in every store.

## Reversibility

The blackboard can be reconsidered only by a new record that names the product need;
the three seams are additive and can be withdrawn one at a time, because nothing
else depends on them jointly.

## Follow-up

- [ ] **The plan's Phase 2** is cut into a first slice (typed report, message, wait,
  agent path) and a second slice (background child, cold resume, claim board).
- [ ] **The plan's non-goals** cite this record for the blackboard and the team
  shelf; `0022` stays frozen and its held row is answered here rather than edited
  there.
- [ ] **The Phase 0 refinements** stay inside 0.1, 0.4, 0.5, 0.7, 0.8 and 0.9; no new
  phase item is opened for them.
