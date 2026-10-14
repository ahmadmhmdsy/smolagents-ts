import { Marked } from "marked";
import type { Renderer, RendererObject, Tokens } from "marked";
import { escapeHtml, plainText } from "./html.js";
import { rewriteHref } from "./links.js";
import type { LinkContext } from "./links.js";
import { slugify, uniqueSlug } from "./titles.js";

/**
 * Render one markdown source to HTML with GFM on, every heading carrying a slug id
 * and every link rewritten for the page it will live on.
 */
export function renderMarkdown(markdown: string, context: LinkContext): string {
  const slugs = new Map<string, number>();
  const renderer: RendererObject = {
    heading(this: Renderer, { tokens, depth }: Tokens.Heading): string {
      const inner = this.parser.parseInline(tokens);
      const id = uniqueSlug(slugify(plainText(inner)), slugs);
      return `<h${depth} id="${escapeHtml(id)}">${inner}</h${depth}>\n`;
    },
    link(this: Renderer, { href, title, tokens }: Tokens.Link): string {
      const text = this.parser.parseInline(tokens);
      const target = rewriteHref(href ?? "", context);
      const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${escapeHtml(target)}"${titleAttribute}>${text}</a>`;
    },
  };
  const instance = new Marked({ gfm: true, renderer });
  return instance.parse(markdown, { async: false });
}
