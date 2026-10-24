# 0022 — the study's refuse list is the boundary

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** proposing a capability that looks like a neighbour's, or
  asking why a feature is refused.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-24
- **Decided by:** owner, on the recommendation that the boundary stop being re-argued
- **Supersedes:** none (decision 0018 owns the scope boundary; this one adopts the item-level triggers)

## Context

Decision 0018 draws the line between the six production gaps the roadmap takes
and the platform gaps it refuses, but it does not carry the item-level reasons
the study wrote. Those live in the ranked backlog's closing table and in its
"refused outright" sentence, inside the research tree — and the research tree is
a pinned snapshot that everything else treats as history, never as the live
answer to a question. Left there, every session that proposes a graph engine, a
queue, a chat transport or a blackboard has to re-open the study, re-read the
dives and re-argue the boundary; and one of those sessions eventually wins by
attrition.

## Decision

The refuse list in the study's ranked backlog is the project's boundary. Its ten
deferred capabilities and its refused-outright set stand as written, each with
the trigger that would reopen it; a proposal that matches a row is answered by
this record, and reopening a row requires showing that its trigger fired, not
that the capability is appealing.

| refused or deferred | the trigger that reopens it |
|---|---|
| MCP sampling, elicitation and roots | a remote server we must support requires one |
| OAuth and authorisation-server work | the first authenticated remote MCP server |
| MCP server authoring | a downstream request for it |
| agent-to-agent interoperability | an interoperability request with a consumer |
| filesystem and shell workspace | a product decision to host code agents |
| snapshot of a live guest | a resumable-sandbox story worth its price |
| a chat transport protocol | a hosted product decision |
| generative UI | the same hosted product decision |
| provider router, fallback and rate limiting | the second provider outage that matters |
| local runtimes | a user who cannot send data out |

Refused outright: a graph engine, a job queue, a hosted control plane, an
exporter on by default, a sandbox we did not write, and the word "handoff" for a
clone. The blackboard default is refused by agreement but its wording waits on
the delegation decision, so it is not part of this record.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **Leave the list in the research tree** | The tree is a pinned snapshot by rule; a live "why not" needs a live home, or the argument restarts from zero each time. |
| **One decision per refused item** | Ten records for one boundary; the ceremony would dwarf the content and invite divergence. |
| **Refuse without triggers** | A refusal with no reopening condition becomes dogma, and a real user need could never move it. |

## Consequences

**Positive**

- One citation answers most "why not" proposals, and the plan's non-goals can
  point at a decision instead of a research path.
- The triggers make the boundary falsifiable: a real need reopens a row, and
  nothing else does.
- The roadmap's shape (0018, 0019) and the study's reasons stop living in two
  places with different authority.

**Negative / accepted costs**

- A row can only move by a new record, so a trigger that fires late costs a
  decision cycle.
- The list mixes product refusals with temporary deferrals, and a reader may
  treat them alike; the trigger column is what separates them.

## Reversibility

Free by construction: moving a row is a new record that cites the fired trigger.
The boundary itself is cheap to tighten and expensive to loosen, which is the
intended asymmetry.

## Follow-up

- [ ] **The plan's non-goals** point at this record instead of restating the
  refused items.
- [ ] **The blackboard row** is added, or refused on its own terms, when the
  delegation decision lands.
