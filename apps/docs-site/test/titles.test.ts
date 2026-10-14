import { describe, expect, it } from "vitest";
import { firstHeading, groupLabel, slugify, uniqueSlug } from "../src/index.js";

describe("firstHeading", () => {
  it("returns the first depth-1 heading", () => {
    expect(firstHeading("> a note\n\n# Title\n\n## Sub\n")).toBe("Title");
  });

  it("ignores deeper headings and fenced code", () => {
    expect(firstHeading("## Sub\n\n```\n# not a heading\n```\n")).toBeUndefined();
  });

  it("strips inline formatting from the heading text", () => {
    expect(firstHeading("# The `code` and [link](https://example.com)\n")).toBe(
      "The code and link",
    );
  });
});

describe("groupLabel", () => {
  it("uses the path's first segment", () => {
    expect(groupLabel("docs/09-decisions/0001-x.md")).toBe("docs");
  });
});

describe("slugify", () => {
  it("makes a github-style anchor", () => {
    expect(slugify("The CLI's `--help` Flag")).toBe("the-clis-help-flag");
  });
});

describe("uniqueSlug", () => {
  it("suffixes a repeat within one page", () => {
    const seen = new Map<string, number>();
    expect(uniqueSlug("anchor", seen)).toBe("anchor");
    expect(uniqueSlug("anchor", seen)).toBe("anchor-1");
  });
});
