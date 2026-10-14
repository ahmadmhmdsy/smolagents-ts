import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// This project runs under jsdom, whose global URL is not Node's, so a sibling file is reached by
// resolving a path rather than by handing node:fs a file URL.
const here = dirname(fileURLToPath(import.meta.url));
const sheet = readFileSync(join(here, "..", "src", "styles.css"), "utf8");

/** The whole theming contract: five tokens, each reading an input name of its own. */
const TOKENS = ["--smol-surface", "--smol-text", "--smol-accent", "--smol-radius", "--smol-gap"];

const withoutComments = sheet.replace(/\/\*[\s\S]*?\*\//g, "");
const selectors = [...withoutComments.matchAll(/([^{}]+)\{/g)]
  .flatMap((block) => block[1]!.split(","))
  .map((selector) => selector.trim())
  .filter((selector) => selector.length > 0);

describe("the copy-in stylesheet's shape", () => {
  it("declares every token with an input name that is not its own", () => {
    for (const token of TOKENS) {
      const declared = withoutComments.match(new RegExp(`\\${token}:\\s*var\\((--[a-z-]+)`));
      expect(declared, `${token} is declared`).not.toBeNull();
      // `--smol-surface: var(--smol-surface, x)` is a cycle and is invalid rather than a fallback,
      // which is why each token reads a distinct --smol-color-* / --smol-shape-* / --smol-space-* name.
      expect(declared![1], `${token} reads a distinct input`).not.toBe(token);
    }
  });

  it("scopes every rule to a class this package owns and names no primitive class", () => {
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      if (selector === ":root") continue;
      expect(selector, `${selector} is scoped to an owned class`).toMatch(/^\.smol-/);
      expect(selector, `${selector} names no primitive class`).not.toMatch(/\.agent-/);
    }
  });

  it("applies nothing on its own, so it carries no import and fetches no resource", () => {
    expect(sheet).not.toMatch(/@import/);
    expect(sheet).not.toMatch(/url\(/);
  });
});
