import type { MetadataValue, RetrievalDocument, ScoredDocument } from "./document.js";
import { EmbeddingDimensionError } from "./errors.js";

/** A passage and its vector, as a store keeps them. */
export interface VectorRecord {
  readonly document: RetrievalDocument;
  readonly vector: readonly number[];
}

export interface VectorQueryOptions {
  /** How many passages to return at most. */
  readonly k: number;
  /** Keeps only passages whose metadata holds every listed key with an equal value. */
  readonly filter?: Readonly<Record<string, MetadataValue>>;
}

/**
 * Where vectors live. The in-memory store is the reference; a persistent store is the caller's,
 * behind this interface.
 */
export interface VectorStore {
  /** Adds records, replacing any with the same document id. */
  upsert(records: readonly VectorRecord[]): Promise<void>;
  /** The passages closest to `vector`, best first. */
  query(vector: readonly number[], options: VectorQueryOptions): Promise<ScoredDocument[]>;
  /** Removes the passages with these ids; unknown ids are ignored. */
  delete(ids: readonly string[]): Promise<void>;
}

function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    const x = a[index] ?? 0;
    const y = b[index] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}

function matches(
  metadata: Readonly<Record<string, MetadataValue>> | undefined,
  filter: Readonly<Record<string, MetadataValue>> | undefined,
): boolean {
  if (filter === undefined) return true;
  for (const [key, value] of Object.entries(filter)) {
    if (metadata?.[key] !== value) return false;
  }
  return true;
}

/**
 * Keeps every vector in a Map and ranks by cosine similarity with a linear scan. Ties break by
 * document id, so the order is stable. The first vector fixes the dimension, and a later vector
 * of another length is refused; emptying the store clears it.
 */
export class InMemoryVectorStore implements VectorStore {
  private readonly records = new Map<string, VectorRecord>();
  private dimension: number | undefined;

  /** How many passages the store holds. */
  get size(): number {
    return this.records.size;
  }

  upsert(records: readonly VectorRecord[]): Promise<void> {
    let dimension = this.dimension;
    for (const record of records) {
      if (dimension === undefined) dimension = record.vector.length;
      else if (record.vector.length !== dimension) {
        return Promise.reject(
          new EmbeddingDimensionError(dimension, record.vector.length, "InMemoryVectorStore.upsert"),
        );
      }
    }
    this.dimension = dimension;
    for (const record of records) {
      this.records.set(record.document.id, { document: record.document, vector: [...record.vector] });
    }
    return Promise.resolve();
  }

  query(vector: readonly number[], options: VectorQueryOptions): Promise<ScoredDocument[]> {
    if (this.dimension !== undefined && vector.length !== this.dimension) {
      return Promise.reject(new EmbeddingDimensionError(this.dimension, vector.length, "InMemoryVectorStore.query"));
    }
    const scored: ScoredDocument[] = [];
    for (const record of this.records.values()) {
      if (!matches(record.document.metadata, options.filter)) continue;
      scored.push({ ...record.document, score: cosine(vector, record.vector) });
    }
    scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return Promise.resolve(scored.slice(0, Math.max(0, options.k)));
  }

  delete(ids: readonly string[]): Promise<void> {
    for (const id of ids) this.records.delete(id);
    if (this.records.size === 0) this.dimension = undefined;
    return Promise.resolve();
  }
}
