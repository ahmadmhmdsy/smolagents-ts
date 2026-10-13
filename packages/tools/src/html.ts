const DROPPED = /<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi;
const COMMENT = /<!--[\s\S]*?-->/g;
const HEADING = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
const LIST_ITEM = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
const LINK = /<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
const BLOCK_END = /<\/(?:p|div|section|article|ul|ol|tr|blockquote|pre|table|header|footer|main|nav)\s*>/gi;

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#[0-9a-fx]+|[a-z]+);/gi, (match: string, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1]?.toLowerCase() === "x";
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return match;
      return String.fromCodePoint(code);
    }
    return NAMED[body.toLowerCase()] ?? match;
  });
}

/**
 * The readable text of an HTML document. This is not a Markdown converter: it keeps the
 * words, the heading levels, the list items and the links, and drops everything a reader
 * would not see.
 */
export function htmlToText(html: string): string {
  const text = html
    .replace(COMMENT, "")
    .replace(DROPPED, "")
    .replace(HEADING, (_match: string, level: string, inner: string) => {
      return "\n\n" + "#".repeat(Number(level.slice(1))) + " " + inner + "\n\n";
    })
    .replace(LIST_ITEM, (_match: string, inner: string) => "\n- " + inner)
    .replace(LINK, (_match: string, double: string, single: string, inner: string) => {
      const href = double === "" ? single : double;
      return inner.trim() === "" ? "" : "[" + inner.trim() + "](" + href + ")";
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(BLOCK_END, "\n\n")
    .replace(/<[^>]*>/g, "");

  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
