/**
 * The Node binding for the core's file store: it turns the injected `RunFileSystem` seam into
 * `node:fs/promises` calls inside one directory. The record's file name is the only thing the
 * core names, so this module owns the directory and refuses anything that is not a flat name.
 */
import { unwatchFile, watchFile } from "node:fs";
import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { RunFileSystem } from "@smolagents-ts/core";

/** The directory a state file lives in by default, beside the working directory. */
export const DEFAULT_STATE_DIRECTORY = ".smolagents";

/**
 * Bind the store's seam to one directory. Every method takes a flat file name; a name that could
 * walk out of the directory is refused rather than joined, because a runId is opaque text.
 */
export function nodeRunFileSystem(directory: string): RunFileSystem {
  const root = resolve(directory);

  const pathFor = (name: string): string => {
    if (name === "" || name === "." || name === ".." || /[\\/]/.test(name)) {
      throw new Error("A record file name must be flat, got: " + JSON.stringify(name));
    }
    return join(root, name);
  };

  return {
    async read(name) {
      try {
        return await readFile(pathFor(name), "utf8");
      } catch (error) {
        if (isMissing(error)) return undefined;
        throw error;
      }
    },
    async write(name, data) {
      await mkdir(root, { recursive: true });
      await writeFile(pathFor(name), data, "utf8");
    },
    async rename(from, to) {
      await rename(pathFor(from), pathFor(to));
    },
    async delete(name) {
      try {
        await unlink(pathFor(name));
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    },
    async list() {
      try {
        return await readdir(root);
      } catch (error) {
        if (isMissing(error)) return [];
        throw error;
      }
    },
    watchFile(name, onChange) {
      // A poll rather than a filesystem event: the store publishes a record by renaming a whole
      // file into place, and watchFile survives the rename that an inode watcher would lose.
      const path = pathFor(name);
      const listener = (): void => onChange();
      watchFile(path, { persistent: false, interval: 50 }, listener);
      return () => unwatchFile(path, listener);
    },
  };
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
