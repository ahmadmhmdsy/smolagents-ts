import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("../src", import.meta.url));
const rootEntry = resolve(srcDir, "index.ts");

const IMPORT_PATTERN = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

/**
 * Every module the root entry reaches, transitively, following relative imports and stopping
 * at package specifiers. A node: specifier is not followed: it is a failure.
 */
function rootEntryGraph(entry: string): { readonly files: string[]; readonly specifiers: string[] } {
  const files: string[] = [];
  const specifiers: string[] = [];
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    files.push(file);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1];
      if (specifier === undefined) continue;
      specifiers.push(specifier);
      if (specifier.startsWith(".")) {
        // Source imports carry the emitted ".js" extension; the file on disk is ".ts".
        const target = specifier.endsWith(".js") ? specifier.slice(0, -3) + ".ts" : specifier;
        queue.push(resolve(dirname(file), target));
        continue;
      }
      if (specifier.startsWith("node:")) {
        throw new Error("the root entry graph reaches a Node builtin: " + specifier + " in " + file);
      }
    }
  }
  return { files, specifiers };
}

describe("architecture boundaries", () => {
  it("the root entry is isomorphic and stays inside this package", () => {
    const graph = rootEntryGraph(rootEntry);
    expect(graph.files.length).toBeGreaterThan(5);
    expect(graph.files.every((file) => file.startsWith(srcDir))).toBe(true);
    expect(graph.specifiers).toContain("@smolagents-ts/core");
    // The runtime is reached through a dynamic import, and the walker sees it.
    expect(graph.specifiers).toContain("pyodide");
    expect(graph.specifiers.some((specifier) => specifier.startsWith("node:"))).toBe(false);
  });

  it("the walker fails on a graph that names node:child_process", () => {
    const fixture = fileURLToPath(new URL("./fixtures/architecture-probe.ts", import.meta.url));
    expect(() => rootEntryGraph(fixture)).toThrow(/node:child_process/);
  });
});
