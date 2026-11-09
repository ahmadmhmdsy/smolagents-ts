# Plan — retrieval as a package beside the core

**Contract**
- **Role:** the build plan for retrieval (decision 0026, scheduled by 0038), with the refuse-list test that decision 0026 requires before code, and the task row it closes.
- **Mutability:** live while `in_progress`. A phase's status and its evidence are updated in place; a change of scope is a dated entry, never a silent rewrite.
- **Read when:** working on `T-55` or on `packages/retrieval/`.
- **Update when:** a phase lands, its scope changes, or a premise stops matching the code.

- **Status:** done
- **Owner:** lead
- **Created:** 2026-11-09T23:30:00+03:00
- **Authorized by:** the owner in chat, 2026-11-09: "Provider fallback and local runtimes then Retrieval … proceed with them". That covers this plan, the build and local commits. It does not cover a push or a publish.

Status values are defined in docs/00-schema.md, the vocabulary authority.

## Goal

A caller can give an agent passages from their own documents. They can do it two ways. They can prepend the passages to the task before `run()`, so they become an ordinary user turn. Or they can hand the agent a `retrieve` tool. Either way the core loop learns nothing new, and a test needs no network.

## Why now

[`0026`](../09-decisions/0026-retrieval-is-in.md) put retrieval in scope and made a plan the gate before code. [`0038`](../09-decisions/0038-provider-fallback-and-local-runtimes-before-retrieval.md) put it after provider fallback and local runtimes. Both of those landed on 2026-11-09 (`T-71`, `T-72`), so this is next.

## Non-goals

- Ingestion: crawling, file loaders, PDF or HTML extraction. The caller hands in text.
- Chunking. The caller splits text into passages, because the right split depends on their documents.
- A hosted vector database, a server, or a daemon. One in-memory store ships. A persistent store is the caller's, behind the `VectorStore` interface.
- A default embedding provider that reaches the network. The default embedder is local and deterministic.
- Any change to the core: no new option on `run()`, no hook, no event.
- Reranking, hybrid search and query rewriting.
- A facade re-export. The package installs on its own, like `@smolagents-ts/mcp`.

## The refuse-list test

Decision 0022 refuses some shapes outright, and 0026 requires this plan to show it passes that test before code.

| 0022 refuses | does this plan add it? |
|---|---|
| a graph or workflow engine | no: retrieval is one call that returns text, or one tool |
| a job queue or scheduler | no: `add()` and `retrieve()` are awaited calls with no background work |
| a hosted control plane or a server | no: no listener, no process, no hosted store |
| an exporter or network call on by default | no: the default embedder is local; `openAICompatibleEmbedder` runs only when a caller builds it |
| a sandbox the project did not write | no: no code runs |
| a dependency for the core | no: the package depends on the core, never the reverse; the core's manifest is untouched |

## Approach

**A package of its own.** `@smolagents-ts/retrieval` depends on `@smolagents-ts/core` and `zod`, nothing else. It imports no Node builtin, so it runs in a browser bundle; an architecture test enforces this, as in `mcp`. It is outside the changesets fixed group and starts at 0.1.0.

**Three interfaces, one implementation each.**
- `Embedder`: `embed(texts, {signal})` returns one vector per text.
  - `hashingEmbedder` is the default. It hashes tokens into buckets and normalizes the result. It is deterministic and needs no model. It matches words, not meaning, and its docs say it is for tests and examples.
  - `openAICompatibleEmbedder` posts to an `/embeddings` endpoint. That covers OpenAI and the local runtimes from `T-72`. It is tested against a recorded fixture only.
- `VectorStore`: `upsert`, `query(vector, {k, filter})` and `delete`. `InMemoryVectorStore` ranks by cosine similarity and breaks ties by id, so results are stable.
- `Retriever` ties the two together. It provides:
  - `add(documents)`;
  - `retrieve(query)`, which returns scored documents;
  - `context(query)`, a numbered text block capped at `maxChars`;
  - `augment(task)`, which prepends that block to a string task or to the first parts of a parts task;
  - `asTool()`, which returns a core `tool()`.

**Message-first.** `augment()` is the main path. The passages become part of the user's turn, so they reach every adapter, every agent type and the transcript with no core change. `asTool()` is the second path, for a model that should decide when to look something up.

**Errors name the mismatch.** A store refuses a vector whose length differs from the first vector it saw. A retriever refuses an embedder that returns the wrong number of vectors. Each refusal names the counts it saw.

## Phases

### Phase 1 — The interfaces, the embedder and the store

- **Deliverable:** `Embedder`, `hashingEmbedder`, `VectorStore`, `InMemoryVectorStore`, the error classes.
- **Files:** `packages/retrieval/src/{embedder,hashing,store,errors}.ts`.
- **Exit criterion:**
  - The embedder returns the same vector for the same text and unit-length vectors.
  - The store ranks by cosine similarity, honours `k` and `filter`, and refuses a dimension mismatch.
- **Verification:** `pnpm vitest run --project retrieval`. **Status:** done.

### Phase 2 — The retriever and the tool

- **Deliverable:** `Retriever` with `add`, `retrieve`, `context`, `augment` and `asTool`; `openAICompatibleEmbedder`.
- **Files:** `packages/retrieval/src/{retriever,openai-compatible}.ts`.
- **Exit criterion:**
  - An agent run on a scripted model receives the augmented task in its first user message.
  - The tool answers a `retrieve` call with the context block.
  - The fixture-backed embedder posts the expected body and returns vectors in order.
- **Verification:** the same suite, plus `pnpm --filter @smolagents-ts/retrieval run typecheck`. **Status:** done.

### Phase 3 — Packaging and docs

- **Deliverable:** the package is registered everywhere a package is:
  - the pack smoke and the gate's clean list;
  - the component table, the component rule and a dependency-cruiser rule;
  - a README, a scoped `AGENTS.md` and a changeset.
- **Exit criterion:** `pnpm gate` exits 0.
- **Verification:** `pnpm gate`. **Status:** done.

## Risks

| Risk | Impact | Mitigation | Trigger that means it happened |
|---|---|---|---|
| A caller takes the hashing embedder for semantic search | poor recall in production | the README and the doc comment say what it is for; the example shows swapping in a real embedder | an issue reports poor recall with the default |
| Retrieved text carries instructions | prompt injection from the caller's own corpus | the context block is labelled as retrieved passages; the README says passages are data | a run follows an instruction found in a passage |
| A large corpus in memory | memory growth | documented: the in-memory store is a reference, and persistence goes behind `VectorStore` | a caller reports memory pressure |
| An embedder returns vectors of another size after a model change | a mixed store with meaningless scores | the store refuses a dimension mismatch | `EmbeddingDimensionError` in a caller's log |

## Rollback

The package is new and nothing depends on it. Rollback is reverting the `T-55` commit; the core and the other packages are unaffected.

## Open questions

- Whether a later facade release re-exports the package. Not decided here; it waits until a release has shipped retrieval on its own.

## Tasks

| Task ID | Phase | Status |
|---|---|---|
| T-55 | 1 to 3 | done |

## Notes

- 2026-11-09: written and built in one session, under the owner's order to proceed through fallback, local runtimes and retrieval.
