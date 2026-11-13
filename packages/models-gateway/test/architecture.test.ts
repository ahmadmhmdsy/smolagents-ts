import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("../src", import.meta.url));
const rootEntry = resolve(srcDir, "index.ts");

// Anchored to statements: an error message such as "response from " + url must not read as an import.
const IMPORT_PATTERN = /^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm;

/**
 * Every module the root entry reaches, transitively, following relative imports and
 * stopping at package specifiers. `node:` is not followed: it is a failure.
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
      const specifier = match[1] ?? match[2];
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
  it("the root entry reaches no node: specifier and stays inside this package", () => {
    const graph = rootEntryGraph(rootEntry);
    expect(graph.files.length).toBeGreaterThan(3);
    expect(graph.files.every((file) => file.startsWith(srcDir))).toBe(true);
    expect(graph.specifiers).toContain("@smolagents-ts/core");
    expect(graph.specifiers).toContain("@smolagents-ts/models");
    expect(graph.specifiers.some((specifier) => specifier.startsWith("node:"))).toBe(false);
  });

  it("names no package other than core and models", () => {
    const graph = rootEntryGraph(rootEntry);
    const external = new Set(graph.specifiers.filter((specifier) => !specifier.startsWith(".")));
    expect([...external].sort()).toEqual(["@smolagents-ts/core", "@smolagents-ts/models"]);
  });

  it("the walker fails on a graph that names a Node builtin", () => {
    const fixture = fileURLToPath(new URL("./fixtures/architecture-probe.ts", import.meta.url));
    expect(() => rootEntryGraph(fixture)).toThrow(/node:fs/);
  });
});
