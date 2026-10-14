import { posix } from "node:path";
import { escapeHtml } from "./html.js";
import { groupLabel } from "./titles.js";

/** One rendered document, as the index needs it. */
export interface DocumentEntry {
  /** Repo-relative POSIX source path, e.g. `docs/09-decisions/0012-web-surface-host.md`. */
  sourcePath: string;
  /** Repo-relative POSIX output path, e.g. `docs/09-decisions/0012-web-surface-host.html`. */
  outputPath: string;
  /** The title the file's own first heading gives it. */
  title: string;
}

export interface PageLayout {
  documents: readonly DocumentEntry[];
  currentOutputPath: string;
  homeTitle: string;
  exampleCopied: boolean;
}

export interface PageOptions extends PageLayout {
  title: string;
  body: string;
}

/** A relative URL from one output page to another, both repo-relative POSIX. */
export function relativeHref(fromOutputPath: string, toOutputPath: string): string {
  return posix.relative(posix.dirname(fromOutputPath), toOutputPath);
}

/** The navigation, whose only authored words are group and site labels. */
export function renderNav(layout: PageLayout): string {
  const parts = [
    `<a class="site-title" href="${escapeHtml(relativeHref(layout.currentOutputPath, "index.html"))}">${escapeHtml(layout.homeTitle)}</a>`,
  ];

  const groups = new Map<string, DocumentEntry[]>();
  for (const document of layout.documents) {
    const label = groupLabel(document.sourcePath);
    const list = groups.get(label) ?? [];
    list.push(document);
    groups.set(label, list);
  }
  for (const [label, entries] of groups) {
    parts.push(`<p class="nav-group">${escapeHtml(label)}</p>`);
    const items = entries.map((entry) => {
      const href = escapeHtml(relativeHref(layout.currentOutputPath, entry.outputPath));
      const current = entry.outputPath === layout.currentOutputPath ? ' aria-current="page"' : "";
      return `<li><a href="${href}"${current}>${escapeHtml(entry.title)}</a></li>`;
    });
    parts.push(`<ul class="nav-list">\n${items.join("\n")}\n</ul>`);
  }

  if (layout.exampleCopied) {
    const href = escapeHtml(relativeHref(layout.currentOutputPath, "example/index.html"));
    parts.push('<p class="nav-group">example</p>');
    parts.push(`<ul class="nav-list">\n<li><a href="${href}">vite-app</a></li>\n</ul>`);
  }
  return parts.join("\n");
}

/** The complete HTML shell around one rendered body. */
export function renderPage(options: PageOptions): string {
  const css = escapeHtml(relativeHref(options.currentOutputPath, "assets/site.css"));
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(options.title)}</title>`,
    `<link rel="stylesheet" href="${css}">`,
    "</head>",
    "<body>",
    `<nav class="sidebar">\n${renderNav(options)}\n</nav>`,
    `<main class="content">\n${options.body}</main>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
