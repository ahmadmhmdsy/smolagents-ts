---
"@smolagents-ts/retrieval": minor
---

New package: retrieval with no change to the agent. `Retriever` embeds passages into a
`VectorStore` and hands the best matches to a model either inside the task (`augment`) or as a
tool (`asTool`). Ships `InMemoryVectorStore`, a dependency-free `hashingEmbedder`, and
`openAICompatibleEmbedder` for any OpenAI-compatible `/embeddings` endpoint, local runtimes
included. Isomorphic: it depends on the core and zod alone.
