import { describe, expect, it } from "vitest";
import { githubBlobBase, rewriteHref } from "../src/index.js";
import type { LinkContext } from "../src/index.js";

const BASE = "https://github.com/owner/repo/blob/main";
const pages = new Map<string, string>([
  ["README.md", "index.html"],
  ["docs/a.md", "docs/a.html"],
  ["docs/b.md", "docs/b.html"],
  ["docs/plans/plan.md", "docs/plans/plan.html"],
  ["docs/design/design.md", "docs/design/design.html"],
]);

const from = (sourcePath: string): LinkContext => ({ sourcePath, pages, blobBase: BASE });

describe("rewriteHref", () => {
  it("leaves absolute, protocol-relative and in-page links alone", () => {
    const cases = [
      "https://example.com/readme.md",
      "http://example.com/x",
      "mailto:someone@example.com",
      "//example.com/x.md",
      "#section",
    ];
    for (const href of cases) {
      expect(rewriteHref(href, from("docs/a.md"))).toBe(href);
    }
  });

  it("rewrites a sibling markdown link", () => {
    expect(rewriteHref("./b.md", from("docs/a.md"))).toBe("b.html");
  });

  it("rewrites a parent-directory markdown link", () => {
    expect(rewriteHref("../design/design.md", from("docs/plans/plan.md"))).toBe(
      "../design/design.html",
    );
  });

  it("rewrites a root-relative docs link and preserves the fragment", () => {
    expect(rewriteHref("docs/design/design.md#decision", from("docs/plans/plan.md"))).toBe(
      "../design/design.html#decision",
    );
  });

  it("rewrites a link to the home page", () => {
    expect(rewriteHref("../README.md", from("docs/a.md"))).toBe("../index.html");
  });

  it("sends a non-document relative link to the repository blob", () => {
    expect(rewriteHref("examples/vite-app", from("README.md"))).toBe(BASE + "/examples/vite-app");
    expect(rewriteHref("../NOTICE", from("docs/a.md"))).toBe(BASE + "/NOTICE");
  });

  it("keeps a fragment on a blob link", () => {
    expect(rewriteHref("scripts/foo.mjs#L1", from("README.md"))).toBe(BASE + "/scripts/foo.mjs#L1");
  });
});

describe("githubBlobBase", () => {
  it("derives a blob prefix from a manifest repository url", () => {
    expect(githubBlobBase("git+https://github.com/ahmadmhmdsy/smolagents-ts.git")).toBe(
      "https://github.com/ahmadmhmdsy/smolagents-ts/blob/main",
    );
  });

  it("refuses a url that names no GitHub repository", () => {
    expect(() => githubBlobBase("https://example.com/nope")).toThrow();
  });
});
