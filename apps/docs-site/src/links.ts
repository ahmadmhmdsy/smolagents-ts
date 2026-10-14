import { posix } from "node:path";

/** Rendered markdown source path to output page path, both repo-relative and POSIX. */
export type PageMap = ReadonlyMap<string, string>;

export interface LinkContext {
  /** The linking markdown file's repo-relative POSIX path, e.g. `docs/plans/a.md`. */
  sourcePath: string;
  /** Every rendered markdown source mapped to the page it becomes. */
  pages: PageMap;
  /** The blob URL prefix a non-document relative link resolves against, no trailing slash. */
  blobBase: string;
}

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Resolve one markdown link for one page.
 *
 * An absolute, protocol-relative or pure-fragment link is returned untouched. A link
 * that names a rendered markdown file becomes a relative URL to that page, measured
 * from the linking page's own output directory. Anything else relative becomes a
 * repository blob URL.
 */
export function rewriteHref(href: string, context: LinkContext): string {
  const raw = href.trim();
  if (raw.length === 0 || raw.startsWith("#")) return raw;
  if (EXTERNAL.test(raw)) return raw;

  const cut = raw.search(/[?#]/);
  const pathPart = cut === -1 ? raw : raw.slice(0, cut);
  const suffix = cut === -1 ? "" : raw.slice(cut);
  if (pathPart.length === 0) return raw;

  const target = resolveTarget(pathPart, context.sourcePath);
  const page = context.pages.get(target);
  if (page !== undefined) {
    const sourceOutput =
      context.pages.get(context.sourcePath) ?? context.sourcePath.replace(/\.md$/, ".html");
    return posix.relative(posix.dirname(sourceOutput), page) + suffix;
  }
  return context.blobBase.replace(/\/+$/, "") + "/" + target + suffix;
}

function resolveTarget(pathPart: string, sourcePath: string): string {
  if (pathPart.startsWith("/")) return normalize(pathPart.slice(1));
  // A `docs/...` link is written from the repository root in this tree, not from the
  // linking file's directory, so it is read as root-relative before falling back.
  if (pathPart.startsWith("docs/")) return normalize(pathPart);
  return normalize(posix.join(posix.dirname(sourcePath), pathPart));
}

function normalize(path: string): string {
  const normalized = posix.normalize(path);
  return normalized.startsWith("./") ? normalized.slice(2) : normalized;
}
