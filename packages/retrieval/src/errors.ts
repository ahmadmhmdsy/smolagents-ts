/** The base class of every refusal this package raises. */
export class RetrievalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetrievalError";
  }
}

/** A vector whose length differs from the length the store already holds. */
export class EmbeddingDimensionError extends RetrievalError {
  readonly expected: number;
  readonly actual: number;

  constructor(expected: number, actual: number, where: string) {
    super(
      "Embedding dimension mismatch in " +
        where +
        ": expected " +
        String(expected) +
        ", got " +
        String(actual) +
        ". Every vector in one store must come from the same embedding model.",
    );
    this.name = "EmbeddingDimensionError";
    this.expected = expected;
    this.actual = actual;
  }
}

/** An embedder that returned a different number of vectors than it was given texts. */
export class EmbeddingCountError extends RetrievalError {
  readonly expected: number;
  readonly actual: number;

  constructor(expected: number, actual: number, embedderId: string) {
    super(
      "Embedder " + embedderId + " returned " + String(actual) + " vectors for " + String(expected) + " texts.",
    );
    this.name = "EmbeddingCountError";
    this.expected = expected;
    this.actual = actual;
  }
}
