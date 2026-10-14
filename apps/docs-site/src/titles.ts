import { Lexer, Marked } from "marked";
import type { Tokens } from "marked";
import { plainText } from "./html.js";

const inline = new Marked({ gfm: true });

/**
 * The text of the file's own first depth-1 `# ` heading, or undefined when it has none.
 * A lexer is used rather than a line scan so a `# ` inside a fenced code block or a
 * blockquote is never mistaken for the title.
 */
export function firstHeading(markdown: string): string | undefined {
  for (const token of Lexer.lex(markdown)) {
    const heading = token as Tokens.Heading;
    if (heading.type === "heading" && heading.depth === 1) {
      return inlinePlain(heading.text);
    }
  }
  return undefined;
}

function inlinePlain(raw: string): string {
  return plainText(inline.parseInline(raw, { async: false })).replace(/\s+/g, " ").trim();
}

/** The group a source path belongs to: its first path segment. */
export function groupLabel(sourcePath: string): string {
  const segment = sourcePath.split("/")[0];
  return segment !== undefined && segment.length > 0 ? segment : sourcePath;
}

/** A GitHub-style anchor slug for a heading. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A slug unique within one page: a repeat gets a numeric suffix. */
export function uniqueSlug(base: string, seen: Map<string, number>): string {
  const slug = base.length > 0 ? base : "section";
  const count = seen.get(slug) ?? 0;
  seen.set(slug, count + 1);
  return count === 0 ? slug : slug + "-" + String(count);
}
