# retrieval — scoped entry

## What this component is

`@smolagents-ts/retrieval` adds retrieval to an agent without changing the
agent. It embeds passages into a vector store and finds the ones closest to a
query, then hands them to a model in one of two ways: `augment(task)` puts them
into the task before `run()`, and `asTool()` gives the model a tool that returns
them. It ships an in-memory cosine store, a dependency-free hashing embedder for
tests and offline use, and an embedder for any OpenAI-compatible `/embeddings`
endpoint, which covers hosted providers and the local runtimes. It depends on
the core and zod alone.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/retrieval/src/index.ts` | everything below, plus `VERSION` |
| retriever | `packages/retrieval/src/retriever.ts` | `Retriever`, `formatContext`, `CONTEXT_HEADING` |
| store | `packages/retrieval/src/store.ts` | the `VectorStore` seam and `InMemoryVectorStore` |
| embedder seam | `packages/retrieval/src/embedder.ts` | `Embedder` and `normalize` |
| hashing embedder | `packages/retrieval/src/hashing.ts` | deterministic feature hashing, no network |
| HTTP embedder | `packages/retrieval/src/openai-compatible.ts` | `openAICompatibleEmbedder` over an injected fetch |
| documents | `packages/retrieval/src/document.ts` | `RetrievalDocument`, `ScoredDocument`, metadata values |
| errors | `packages/retrieval/src/errors.ts` | the dimension and count refusals |
| version marker | `packages/retrieval/src/version.ts` | the value the pack smoke imports |

## Smallest validation command

    pnpm vitest run --project retrieval

Expected result: four files, exit code 0. The suite needs no network and no key:
the HTTP embedder is driven by a recorded response through an injected fetch,
and the agent tests run on the core's `MockModel`. Run
`pnpm --filter @smolagents-ts/retrieval run typecheck` beside it.

## Boundaries

The package owns the retriever, the store seam, its in-memory store and two
embedders. It owns no agent loop, no model adapter and no document loader:
splitting files into passages is the caller's step, and a hosted vector database
plugs in through the `VectorStore` seam from outside this package. The root
entry reaches no Node builtin, and the architecture test enforces it.

## Hazards

- The hashing embedder matches shared words, not meaning. It is the test and
  offline default; a semantic search needs a model embedder.
- Vectors from two embedders do not mix. A store keeps the dimension of its
  first vector and refuses others, but two models with one dimension still
  produce incomparable vectors; re-index when the embedder changes.
- `augment` with no match returns the task unchanged, so a run cannot tell from
  the task alone whether retrieval found anything; read `retrieve` for that.
- The context block is cut at `maxChars`: passages that do not fit are left out
  whole, and only a first passage longer than the cap is sliced.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule: `rules/components/retrieval.md`.

<!--
Fill rules:
- Cap: this entry stays at or under 6 KB. Detail that pushes it past the cap
  belongs in rules/components/<id>.md or in docs/, not here.
- Ban: carry no root policy. No rule text, no obligation, no precedence level,
  and no restated project fact -- point at the file that owns each. The
  strength keywords are defined and written in capitals only in
  rules/00-index.md; any of them appearing here reads as a restated root
  obligation and fails validation, so this form contains none of them even in
  lowercase.
- Keep the phrase "smallest validation" in the heading above: a scoped entry
  that does not name one fails validation.
- Add this component's row to the component table in the root AGENTS.md, with
  the id, the path scope, this file's path, and rules/components/<id>.md. A
  scoped entry with no row fails validation.
- One id everywhere: the component-table id, the directory name, and the rule
  file name are the same string.
- The component rule file form and its registry requirement are described in
  rules/components/README.md.
-->
