/**
 * The programmatic surface of the docs site builder.
 *
 * The barrel exports the pure pieces the builder is assembled from, so a test can
 * check the link rewriter, the title derivation and the page shell without touching
 * the filesystem, plus the one function that does the file I/O.
 */
export { escapeHtml, plainText } from "./html.js";
export { rewriteHref } from "./links.js";
export type { LinkContext, PageMap } from "./links.js";
export { firstHeading, groupLabel, slugify, uniqueSlug } from "./titles.js";
export { renderMarkdown } from "./render.js";
export { relativeHref, renderNav, renderPage } from "./page.js";
export type { DocumentEntry, PageLayout, PageOptions } from "./page.js";
export { findRepoRoot, githubBlobBase } from "./paths.js";
export { SITE_CSS } from "./stylesheet.js";
export { buildSite } from "./site.js";
export type { SiteInput, SiteResult } from "./site.js";
