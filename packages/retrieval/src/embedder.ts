/** Options every embedder call accepts. */
export interface EmbedOptions {
  readonly signal?: AbortSignal;
}

/**
 * Turns texts into vectors, one per text and in the same order. An implementation may call a
 * provider; this package's default does not.
 */
export interface Embedder {
  /** A name for logs and errors, such as `hashing-256` or `openai:text-embedding-3-small`. */
  readonly id: string;
  /** The vector length, when it is known before the first call. */
  readonly dimensions?: number;
  embed(texts: readonly string[], options?: EmbedOptions): Promise<number[][]>;
}

/** Scales a vector to unit length; a zero vector stays zero. */
export function normalize(vector: number[]): number[] {
  let sum = 0;
  for (const value of vector) sum += value * value;
  if (sum === 0) return vector;
  const length = Math.sqrt(sum);
  return vector.map((value) => value / length);
}
