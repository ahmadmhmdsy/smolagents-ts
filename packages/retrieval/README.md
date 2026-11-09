# @smolagents-ts/retrieval

Retrieval for smolagents-ts agents, with no change to the agent. Embed passages
into a vector store, find the ones closest to a query, and hand them to the
model either inside the task or through a tool.

```bash
npm install @smolagents-ts/retrieval @smolagents-ts/core
```

## Put passages into the task

```ts
import { ToolCallingAgent } from "@smolagents-ts/core";
import { Retriever, openAICompatibleEmbedder } from "@smolagents-ts/retrieval";

const retriever = new Retriever({
  embedder: openAICompatibleEmbedder({
    baseUrl: "https://api.openai.com/v1",
    model: "text-embedding-3-small",
    apiKey: process.env.OPENAI_API_KEY,
  }),
});

await retriever.add([
  { id: "refunds", text: "Refunds are issued within 30 days for damaged goods." },
  { id: "shipping", text: "Shipping is free on orders over 50 dollars." },
]);

const agent = new ToolCallingAgent({ model });
const result = await agent.run(await retriever.augment("How long do I have to ask for a refund?"));
```

`augment` places a numbered block of the best passages before the task, under a
heading that labels them as reference material rather than instructions. With
nothing matched, the task comes back unchanged.

## Or let the model ask

```ts
const agent = new ToolCallingAgent({ model, tools: [retriever.asTool()] });
```

The model gets a `retrieve` tool that takes a `query` and returns the same block.
Pass `{ name, description }` to rename it.

## Embedders

- `openAICompatibleEmbedder({ baseUrl, model, apiKey?, dimensions?, batchSize?, fetch? })`
  posts to `<baseUrl>/embeddings`. Any OpenAI-compatible server works, including
  local runtimes such as Ollama (`http://localhost:11434/v1`), LM Studio and
  vLLM. No key is read from the environment.
- `hashingEmbedder({ dimensions? })` hashes words into a fixed-size vector with
  no network. It matches shared words, not meaning: use it for tests, demos and
  offline keyword search.
- Your own: any object with `id` and `embed(texts, { signal })` that resolves to
  one vector per text.

## Stores

`InMemoryVectorStore` ranks by cosine similarity, filters on exact metadata
values, and refuses a vector whose dimension differs from the first one it
stored. A hosted vector database plugs in by implementing `VectorStore`
(`upsert`, `query`, `delete`).

## Options

| option | default | meaning |
|---|---|---|
| `k` | 4 | passages per query |
| `maxChars` | 4000 | cap on the context block; passages that do not fit are left out |
| `minScore` | 0 | passages scoring below this are dropped |
| `batchSize` | 64 | texts per `embed` call in `add` |

## License

Apache-2.0.
