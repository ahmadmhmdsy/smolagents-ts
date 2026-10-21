import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SITE_CSS, buildSite } from "../src/index.js";
import type { SiteInput, SiteResult } from "../src/index.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function write(root: string, relativePath: string, content: string): void {
  const file = join(root, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "docs-site-fixture-"));
  roots.push(root);
  return root;
}

function fixtureInput(root: string, missingHeading = false, withExample = true): SiteInput {
  write(root, "README.md", "# Fixture Home\n\nRead [alpha](docs/alpha.md) and [NOTICE](NOTICE).\n");
  write(
    root,
    "docs/alpha.md",
    "# Alpha\n\n## Section One\n\nSee [beta](./beta.md) and [example](../examples/vite-app).\n",
  );
  write(root, "docs/beta.md", "# Beta\n\nBack to [home](../../README.md).\n");
  write(root, "docs/nested/gamma.md", "# Gamma\n\nUp to [alpha](../alpha.md).\n");
  if (withExample) write(root, "examples/vite-app/index.html", "<!doctype html><title>example</title>");
  if (missingHeading) write(root, "docs/notes.md", "A file with no heading at all.\n");
  return {
    repoRoot: root,
    docsDir: join(root, "docs"),
    readmePath: join(root, "README.md"),
    outDir: join(root, "site"),
    exampleDir: join(root, "examples", "vite-app"),
    blobBase: "https://github.com/owner/repo/blob/main",
    css: "body { color: black; }",
  };
}

function build(root: string, missingHeading = false, withExample = true): SiteResult {
  const result = buildSite(fixtureInput(root, missingHeading, withExample));
  return result;
}

describe("buildSite on a fixture tree", () => {
  it("emits one page per document, the stylesheet, .nojekyll and the example", () => {
    const root = fixtureRoot();
    const result = build(root);
    expect(result.pages).toEqual([
      "index.html",
      "docs/alpha.html",
      "docs/beta.html",
      "docs/nested/gamma.html",
    ]);
    expect(result.documents).toBe(3);
    expect(result.exampleCopied).toBe(true);
    for (const file of [
      "index.html",
      "docs/alpha.html",
      "docs/beta.html",
      "docs/nested/gamma.html",
      "assets/site.css",
      ".nojekyll",
      "example/index.html",
    ]) {
      expect(existsSync(join(root, "site", file))).toBe(true);
    }
  });

  it("rewrites links relative to each page and gives headings slug ids", () => {
    const root = fixtureRoot();
    build(root);
    const home = readFileSync(join(root, "site", "index.html"), "utf8");
    expect(home).toContain('href="docs/alpha.html"');
    expect(home).toContain('href="https://github.com/owner/repo/blob/main/NOTICE"');
    expect(home).toContain('<h1 id="fixture-home">');

    const alpha = readFileSync(join(root, "site", "docs", "alpha.html"), "utf8");
    expect(alpha).toContain('href="beta.html"');
    expect(alpha).toContain('href="https://github.com/owner/repo/blob/main/examples/vite-app"');
    expect(alpha).toContain('<h1 id="alpha">');
    expect(alpha).toContain('<h2 id="section-one">');

    const beta = readFileSync(join(root, "site", "docs", "beta.html"), "utf8");
    expect(beta).toContain('href="../index.html"');

    const gamma = readFileSync(join(root, "site", "docs", "nested", "gamma.html"), "utf8");
    expect(gamma).toContain('href="../alpha.html"');
    expect(gamma).toContain('href="../../assets/site.css"');
  });

  it("gives every page a skip link as its first body element and a focusable main landmark", () => {
    const root = fixtureRoot();
    const result = build(root);
    for (const page of result.pages) {
      const html = readFileSync(join(root, "site", page), "utf8");
      expect(html.match(/<body>\s*([^\n]+)/)?.[1], page).toBe(
        '<a class="skip-link" href="#main">Skip to main content</a>',
      );
      expect(html.match(/class="skip-link"/g), page).toHaveLength(1);
      expect(html, page).toContain('<main class="content" id="main" tabindex="-1">');
      expect(html.match(/<main\b/g), page).toHaveLength(1);
    }
  });

  it("styles the skip link so it is off-screen until it takes focus", () => {
    const link = /\.skip-link\s*\{([^}]*)\}/.exec(SITE_CSS)?.[1] ?? "";
    expect(link).toContain("position: absolute");
    expect(link).toMatch(/top:\s*-/);
    const focus = /\.skip-link:focus[^{]*\{([^}]*)\}/.exec(SITE_CSS)?.[1] ?? "";
    expect(focus).toMatch(/top:\s*0/);
    expect(focus).toContain("outline");
  });

  it("fails, naming the file, when a document has no heading", () => {
    const root = fixtureRoot();
    expect(() => build(root, true)).toThrow(/no # heading in: docs\/notes\.md/);
  });

  it("omits the example when its built output is absent", () => {
    const root = fixtureRoot();
    const result = build(root, false, false);
    expect(result.exampleCopied).toBe(false);
    expect(existsSync(join(root, "site", "example"))).toBe(false);
    const home = readFileSync(join(root, "site", "index.html"), "utf8");
    expect(home).not.toContain('href="example/index.html"');
  });
});
