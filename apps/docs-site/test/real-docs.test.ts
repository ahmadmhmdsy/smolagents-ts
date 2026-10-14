import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { buildSite } from "../src/index.js";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const outDir = mkdtempSync(join(tmpdir(), "docs-site-real-"));
const result = buildSite({
  repoRoot,
  docsDir: join(repoRoot, "docs"),
  readmePath: join(repoRoot, "README.md"),
  outDir,
  exampleDir: join(repoRoot, "examples", "vite-app", "dist"),
  blobBase: "https://github.com/ahmadmhmdsy/smolagents-ts/blob/main",
  css: "body { color: black; }",
});

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe("the real docs tree", () => {
  it("emits one page per document, plus the home page", () => {
    expect(result.documents).toBeGreaterThanOrEqual(50);
    expect(result.pages).toHaveLength(result.documents + 1);
    expect(result.pages[0]).toBe("index.html");
  });

  it("gives every page a non-empty title from its own heading", () => {
    for (const page of result.pages) {
      const html = readFileSync(join(outDir, page), "utf8");
      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim() ?? "";
      expect(title.length, page).toBeGreaterThan(0);
    }
  });

  it("leaves no unresolved relative markdown link", () => {
    for (const page of result.pages) {
      const html = readFileSync(join(outDir, page), "utf8");
      for (const match of html.matchAll(/href="([^"]+)"/g)) {
        const href = match[1] ?? "";
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) continue;
        expect(href.endsWith(".md"), page + " -> " + href).toBe(false);
      }
    }
  });
});
