# 0026 — retrieval is in, as an opt-in seam for a later phase

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** scheduling retrieval, or considering an embeddings, vector-store
  or retriever capability.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-25
- **Decided by:** owner, answering `MD-10` while opening Phase 6
- **Supersedes:** none; it answers the open question the parent plan left at Phase 6.4

## Context

The gap matrix recorded retrieval (`MD-10`: embeddings, a vector store, a
retriever) as absent here, with `langchainjs` and `agno` carrying it and this
port carrying no row at all.
[`0018`](0018-post-0.1.0-scope-boundary.md) put every
capability outside the six production gaps into a non-goal state that a user
request can lift, and the parent plan therefore made Phase 6.4 a written answer
rather than a build: "retrieval: in or out, decided in writing". The plan
defaulted to out, and the owner deferred the question once, because "in" is the
item most likely to turn a library into a platform.

On 2026-10-25, opening Phase 6, the owner chose **in**. This record is that
answer, and nothing else: it schedules no work.

## Decision

Retrieval is part of the roadmap. It lands as an opt-in seam in a later phase,
in three parts:

1. **An embedding function**, supplied by the caller or by an adapter, behind a
   provider-neutral interface that returns vectors for texts.
2. **A vector store interface**, with the same seam shape the run store already
   has: an interface the caller implements, one in-memory implementation shipped
   as the reference, and no default that reaches the network.
3. **A retriever**, the piece that makes the seam useful: it takes a query,
   searches the store, and returns bounded documents that become a transcript
   turn the loop reads without special-casing.

Three constraints bound the design, and they come from records already accepted:

- The core loop learns nothing. No core event, no core option, no provider name:
  it sees a transcript with retrieved text in it, exactly as it sees any other
  transcript (rule 3 of the [parent plan](../plans/2026-10-22-apply-the-competitor-findings-plan.md)).
- It is opt-in and isomorphic: no server, no daemon, no crawling or ingestion
  pipeline, no hosted vector database, and no new core dependency. A caller
  brings the embedding model and the store ([`0022`](0022-the-refuse-list-is-the-boundary.md)).
- Its execution plan decides the packaging — a new package or a module on an
  existing one — and must pass the refuse-list test before any code is written.
  This record does not pick the shape.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **Keep it out** | The owner's answer, and the plan default, was out until a caller asked. The owner asked: retrieval is the capability a team reaches for after the first agent works. |
| **A full RAG platform in core** | Ingestion, chunking, a hosted store and an index lifecycle are a product, and [`0018`](0018-post-0.1.0-scope-boundary.md) refuses exactly that drift. |
| **Embeddings only, no retriever** | An embedding function alone gives a caller vectors and no use for them; the retriever is the seam that turns them into a transcript turn, so shipping one without the other would be half a feature. |
| **The retriever inside the core loop** | It would make the loop know a store and a query strategy, which is the special case the plan's third rule forbids. |

## Consequences

**Positive**

- A team can build a document-backed agent without a second library, and the
  seam stays small enough to test like the run store.
- The decision is cheap to reverse until code lands: it schedules one later
  phase and changes no shipped surface.

**Negative / accepted costs**

- Retrieval is the item that most easily becomes a platform. The boundary is
  now a review rule: an item that adds ingestion, a hosted store or a core hook
  is not this seam.
- An opt-in seam means the first version ships without the convenience of a
  default store; the caller supplies the two halves, and the docs must say so.

## Reversibility

Easy while nothing has landed: a new record can reverse this one and unschedule
the phase. Once the seam ships, removal is a package-level change before the
first release and a deprecation window after it.

## Follow-up

- [ ] **Phase 6.4** is closed by this record: the parent plan's open question is
  answered and the item is marked done with this link.
- [ ] **The parent plan's non-goals** no longer list retrieval as gated; they
  point here instead.
- [ ] **A future execution plan** decides the seam's package shape and its
  acceptance tests. No code is written before that plan is opened.
