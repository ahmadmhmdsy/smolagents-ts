export type { MetadataValue, RetrievalDocument, ScoredDocument } from "./document.js";
export { type EmbedOptions, type Embedder, normalize } from "./embedder.js";
export { EmbeddingCountError, EmbeddingDimensionError, RetrievalError } from "./errors.js";
export { type HashingEmbedderOptions, hashingEmbedder } from "./hashing.js";
export {
  EmbeddingRequestError,
  type OpenAICompatibleEmbedderOptions,
  openAICompatibleEmbedder,
} from "./openai-compatible.js";
export {
  CONTEXT_HEADING,
  type RetrieveOptions,
  Retriever,
  type RetrieverOptions,
  type RetrieverToolOptions,
  formatContext,
} from "./retriever.js";
export { InMemoryVectorStore, type VectorQueryOptions, type VectorRecord, type VectorStore } from "./store.js";
export { VERSION } from "./version.js";
