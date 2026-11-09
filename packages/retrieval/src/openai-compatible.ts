import { type EmbedOptions, type Embedder } from "./embedder.js";
import { RetrievalError } from "./errors.js";

export interface OpenAICompatibleEmbedderOptions {
  /** Everything before "/embeddings", such as `https://api.openai.com/v1` or `http://localhost:11434/v1`. */
  readonly baseUrl: string;
  /** The embedding model name the server knows. */
  readonly model: string;
  /** Sent as a bearer token when set. A local runtime usually needs none. */
  readonly apiKey?: string;
  /** Asks the server for shorter vectors, where the model supports it. */
  readonly dimensions?: number;
  /** Texts per request. Defaults to 64. */
  readonly batchSize?: number;
  /** Defaults to the global fetch. */
  readonly fetch?: typeof globalThis.fetch;
}

/** An embeddings request the server answered with an HTTP error or a body this package cannot read. */
export class EmbeddingRequestError extends RetrievalError {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "EmbeddingRequestError";
    this.status = status;
  }
}

interface EmbeddingsResponse {
  data?: { index?: number; embedding?: unknown }[];
}

/**
 * An embedder over an OpenAI-compatible `/embeddings` endpoint: OpenAI itself, and local runtimes
 * such as Ollama, LM Studio, llama.cpp and vLLM. It reaches the network only when `embed` is
 * called, and the key is never put in an error message.
 */
export function openAICompatibleEmbedder(options: OpenAICompatibleEmbedderOptions): Embedder {
  const url = options.baseUrl.replace(/\/+$/, "") + "/embeddings";
  const batchSize = options.batchSize ?? 64;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError("openAICompatibleEmbedder: batchSize must be a positive integer, got " + String(batchSize));
  }
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);

  const embedBatch = async (texts: readonly string[], signal: AbortSignal | undefined): Promise<number[][]> => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (options.apiKey !== undefined) headers["authorization"] = "Bearer " + options.apiKey;
    const body: Record<string, unknown> = { model: options.model, input: texts };
    if (options.dimensions !== undefined) body["dimensions"] = options.dimensions;
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      ...(signal === undefined ? {} : { signal }),
    });
    if (!response.ok) {
      throw new EmbeddingRequestError(
        "Embeddings request to " + url + " failed with HTTP " + String(response.status),
        response.status,
      );
    }
    const parsed = (await response.json()) as EmbeddingsResponse;
    if (!Array.isArray(parsed.data)) {
      throw new EmbeddingRequestError("Embeddings response from " + url + " has no data array");
    }
    const ordered = [...parsed.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    return ordered.map((item, position) => {
      const embedding = item.embedding;
      if (!Array.isArray(embedding) || !embedding.every((value) => typeof value === "number")) {
        throw new EmbeddingRequestError(
          "Embeddings response from " + url + " item " + String(position) + " is not a number array",
        );
      }
      return embedding as number[];
    });
  };

  return {
    id: "openai-compatible:" + options.model,
    ...(options.dimensions === undefined ? {} : { dimensions: options.dimensions }),
    async embed(texts: readonly string[], embedOptions?: EmbedOptions): Promise<number[][]> {
      const vectors: number[][] = [];
      for (let start = 0; start < texts.length; start += batchSize) {
        vectors.push(...(await embedBatch(texts.slice(start, start + batchSize), embedOptions?.signal)));
      }
      return vectors;
    },
  };
}
