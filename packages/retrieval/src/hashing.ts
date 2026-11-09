import { type EmbedOptions, type Embedder, normalize } from "./embedder.js";

export interface HashingEmbedderOptions {
  /** The vector length. Defaults to 256. */
  readonly dimensions?: number;
}

const TOKEN = /[\p{L}\p{N}]+/gu;

/** 32-bit FNV-1a over the UTF-16 code units of a token. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * A deterministic embedder that needs no model and no network. Each lowercased word is hashed
 * into one of `dimensions` buckets with a sign taken from the hash, and the result is scaled to
 * unit length. Texts that share words score close; texts that share only meaning do not.
 *
 * Use it for tests, examples and offline demos. For semantic search, pass a real embedder, such
 * as `openAICompatibleEmbedder`.
 */
export function hashingEmbedder(options: HashingEmbedderOptions = {}): Embedder {
  const dimensions = options.dimensions ?? 256;
  if (!Number.isInteger(dimensions) || dimensions < 1) {
    throw new RangeError("hashingEmbedder: dimensions must be a positive integer, got " + String(dimensions));
  }
  const embedOne = (text: string): number[] => {
    const vector = new Array<number>(dimensions).fill(0);
    for (const match of text.toLowerCase().matchAll(TOKEN)) {
      const hash = fnv1a(match[0]);
      const bucket = hash % dimensions;
      vector[bucket] = (vector[bucket] ?? 0) + ((hash & 0x80000000) === 0 ? 1 : -1);
    }
    return normalize(vector);
  };
  return {
    id: "hashing-" + String(dimensions),
    dimensions,
    embed(texts: readonly string[], embedOptions?: EmbedOptions): Promise<number[][]> {
      if (embedOptions?.signal?.aborted === true) {
        return Promise.reject(embedOptions.signal.reason as Error);
      }
      return Promise.resolve(texts.map(embedOne));
    },
  };
}
