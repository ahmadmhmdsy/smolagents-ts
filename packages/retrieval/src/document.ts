/** A metadata value a store can filter on. */
export type MetadataValue = string | number | boolean;

/** One passage the caller hands in. The caller splits documents into passages; this package does not. */
export interface RetrievalDocument {
  readonly id: string;
  readonly text: string;
  readonly metadata?: Readonly<Record<string, MetadataValue>>;
}

/** A passage with its cosine similarity to the query: 1 is the same direction, 0 unrelated. */
export interface ScoredDocument extends RetrievalDocument {
  readonly score: number;
}
