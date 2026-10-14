import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The package's boundary, checked against the sources themselves: only files under
 * `src/backends/` may reach a Node builtin or a vendor client, and the root entry may not
 * reach a backend at all. A violation here is what would make a consumer resolve dockerode
 * merely by importing the neutral names.
 */

const SRC = fileURLToPath(new URL("../src", import.meta.url));

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (entry.name.endsWith(".ts")) found.push(full);
  }
  return found;
}

function repoPath(file: string): string {
  return relative(SRC, file).split(sep).join("/");
}

describe("the package's architectural boundary", () => {
  const files = sourceFiles(SRC);

  it("found the sources it is checking", () => {
    expect(files.length).toBeGreaterThanOrEqual(12);
  });

  it("keeps every Node builtin and vendor client under src/backends/", () => {
    for (const file of files) {
      const path = repoPath(file);
      if (path.startsWith("backends/")) continue;
      const source = readFileSync(file, "utf8");
      expect(source, path + " must not import a Node builtin").not.toMatch(/from "node:/);
      expect(source, path + " must not import dockerode").not.toMatch(/"dockerode"/);
      expect(source, path + " must not import the E2B SDK").not.toMatch(/"@e2b\/code-interpreter"/);
    }
  });

  it("keeps the root entry free of every backend", () => {
    const index = readFileSync(join(SRC, "index.ts"), "utf8");
    expect(index).not.toContain("./backends/");
  });

  it("keeps each backend implementation under src/backends/", () => {
    for (const name of ["process", "docker", "e2b"]) {
      expect(files.map(repoPath)).toContain("backends/" + name + ".ts");
    }
  });
});
