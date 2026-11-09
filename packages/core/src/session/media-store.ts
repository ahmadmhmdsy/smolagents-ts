import type { AudioPart, ImagePart, MediaRef } from "../types.js";

/**
 * Where a run's media bytes live. Memory, checkpoints, events and traces hold a `MediaRef`, so a
 * run that must resume in another process needs a store that outlives this one, supplied the way
 * a `RunStore` is. The framework reads and writes here and never deletes from a caller's store:
 * how long bytes are kept is the caller's retention decision.
 */
export interface MediaStore {
  /** Keep the bytes and name them. The ref's id must be unique within the store. */
  put(part: ImagePart | AudioPart): MediaRef | Promise<MediaRef>;
  /** The bytes a ref names, or undefined when the store no longer holds them. */
  get(ref: MediaRef): Uint8Array | undefined | Promise<Uint8Array | undefined>;
  delete(id: string): void | Promise<void>;
}

/** The ref a store returns for a part, so a store of any kind describes bytes the same way. */
export function mediaRefFor(part: ImagePart | AudioPart, id: string): MediaRef {
  return {
    id,
    mediaType: part.mediaType,
    byteLength: part.bytes.byteLength,
    ...(part.type === "image" && part.alt !== undefined ? { alt: part.alt } : {}),
    ...(part.type === "image" && part.detail !== undefined ? { detail: part.detail } : {}),
  };
}

/** A store for one process. Bytes end with it, so a run cannot resume anywhere else. */
export class MemoryMediaStore implements MediaStore {
  private readonly held = new Map<string, Uint8Array>();

  put(part: ImagePart | AudioPart): MediaRef {
    const ref = mediaRefFor(part, crypto.randomUUID());
    this.held.set(ref.id, part.bytes);
    return ref;
  }

  get(ref: MediaRef): Uint8Array | undefined {
    return this.held.get(ref.id);
  }

  delete(id: string): void {
    this.held.delete(id);
  }
}
