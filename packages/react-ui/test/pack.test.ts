import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The copy-in story: a consumer installs this package, copies dist/styles.css into a
 * stylesheet it owns, and imports the barrel. The manifest facts below make that work,
 * and nothing else reads them, so each is pinned here.
 */
// The jsdom environment replaces the global URL, and fs rejects that object, so the module's
// own file URL is resolved to a path string before the sibling manifest is read.
const manifestPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  files?: string[];
  sideEffects?: string[];
  exports?: Record<string, { types?: string; default?: string }>;
};

describe("the react-ui manifest", () => {
  it("ships dist, so the stylesheet and the barrel reach the tarball", () => {
    expect(manifest.files).toContain("dist");
  });

  it("marks the stylesheet side-effectful, so a bundler keeps it", () => {
    expect(manifest.sideEffects).toContain("**/*.css");
  });

  it("declares no .css subpath: a subpath export breaks attw", () => {
    // Deliberate. styles.css is text a consumer copies, not a module it imports, so the
    // exports map names only the root entry. A "./styles.css" (or any .css) subpath would
    // promise a condition the file cannot satisfy, which attw reports as a broken
    // resolution, so the subpath is left out on purpose.
    const subpaths = Object.keys(manifest.exports ?? {});
    expect(subpaths.filter((subpath) => subpath.endsWith(".css"))).toEqual([]);
  });

  it("points the root entry at the built declaration and bundle", () => {
    expect(manifest.exports?.["."]?.types).toBe("./dist/index.d.ts");
    expect(manifest.exports?.["."]?.default).toBe("./dist/index.js");
  });
});
