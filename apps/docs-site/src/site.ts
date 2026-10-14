import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { type DocumentEntry, renderPage } from "./page.js";
import { renderMarkdown } from "./render.js";
import { firstHeading } from "./titles.js";

export interface SiteInput {
  /** The repository root: every input path is resolved against it, never the process cwd. */
  repoRoot: string;
  /** The markdown tree to render, one page per file. */
  docsDir: string;
  /** The file rendered as the home page. */
  readmePath: string;
  /** The output directory, replaced on every build. */
  outDir: string;
  /** The example's built output, copied under `example/` when it exists. */
  exampleDir: string;
  /** The blob URL prefix a non-document relative link resolves against. */
  blobBase: string;
  /** The stylesheet written to `assets/site.css`. */
  css: string;
  log?: (message: string) => void;
}

export interface SiteResult {
  /** Every emitted HTML page, repo-relative POSIX, home first. */
  pages: string[];
  documents: number;
  exampleCopied: boolean;
}

interface Document extends DocumentEntry {
  markdown: string;
}

/**
 * Render the repository's markdown into a static site. The only text the site authors
 * is navigation: every page title comes from the file's own first `# ` heading, and a
 * file without one fails the build by name.
 */
export function buildSite(input: SiteInput): SiteResult {
  const log = input.log ?? (() => undefined);

  const readme = readFileSync(input.readmePath, "utf8");
  const homeTitle = firstHeading(readme);
  if (homeTitle === undefined) throw new Error("no # heading in: README.md");

  const documents: Document[] = [];
  const missing: string[] = [];
  for (const file of listMarkdown(input.docsDir)) {
    const sourcePath = toPosix(relative(input.repoRoot, file));
    const markdown = readFileSync(file, "utf8");
    const title = firstHeading(markdown);
    if (title === undefined) {
      missing.push(sourcePath);
      continue;
    }
    documents.push({
      sourcePath,
      outputPath: sourcePath.replace(/\.md$/, ".html"),
      title,
      markdown,
    });
  }
  if (missing.length > 0) throw new Error("no # heading in: " + missing.join(", "));
  documents.sort((a, b) => (a.sourcePath < b.sourcePath ? -1 : a.sourcePath > b.sourcePath ? 1 : 0));

  const pages = new Map<string, string>([["README.md", "index.html"]]);
  for (const document of documents) pages.set(document.sourcePath, document.outputPath);

  const exampleCopied = isDirectory(input.exampleDir);
  if (!exampleCopied) {
    log("no built example at " + input.exampleDir + "; the site omits the example link");
  }

  rmSync(input.outDir, { recursive: true, force: true });
  mkdirSync(input.outDir, { recursive: true });

  const layout = {
    documents: documents.map(({ sourcePath, outputPath, title }) => ({ sourcePath, outputPath, title })),
    homeTitle,
    exampleCopied,
  };
  const emit = (outputPath: string, title: string, body: string): void => {
    const file = join(input.outDir, outputPath);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, renderPage({ ...layout, currentOutputPath: outputPath, title, body }));
  };

  emit(
    "index.html",
    homeTitle,
    renderMarkdown(readme, { sourcePath: "README.md", pages, blobBase: input.blobBase }),
  );
  for (const document of documents) {
    emit(
      document.outputPath,
      document.title,
      renderMarkdown(document.markdown, {
        sourcePath: document.sourcePath,
        pages,
        blobBase: input.blobBase,
      }),
    );
  }

  mkdirSync(join(input.outDir, "assets"), { recursive: true });
  writeFileSync(join(input.outDir, "assets", "site.css"), input.css);
  // Pages treats a path beginning with an underscore as a Jekyll internal and drops it.
  writeFileSync(join(input.outDir, ".nojekyll"), "");

  if (exampleCopied) {
    cpSync(input.exampleDir, join(input.outDir, "example"), { recursive: true });
  }

  return {
    pages: ["index.html", ...documents.map((document) => document.outputPath)],
    documents: documents.length,
    exampleCopied,
  };
}

function listMarkdown(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listMarkdown(full));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(full);
  }
  return files.sort();
}

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}
