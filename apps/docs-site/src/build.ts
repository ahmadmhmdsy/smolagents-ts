import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findRepoRoot, githubBlobBase } from "./paths.js";
import { buildSite } from "./site.js";
import { SITE_CSS } from "./stylesheet.js";

interface Manifest {
  repository?: { url?: string };
}

try {
  // The repository root comes from this module's own URL, never from the process cwd:
  // the builder is run as `node dist/build.js` from wherever.
  const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, "packages/core/package.json"), "utf8"),
  ) as Manifest;
  const repositoryUrl = manifest.repository?.url;
  if (repositoryUrl === undefined) {
    throw new Error("packages/core/package.json declares no repository.url");
  }

  const result = buildSite({
    repoRoot,
    docsDir: join(repoRoot, "docs"),
    readmePath: join(repoRoot, "README.md"),
    outDir: join(repoRoot, "apps/docs-site", "site"),
    exampleDir: join(repoRoot, "examples/vite-app/dist"),
    blobBase: githubBlobBase(repositoryUrl),
    css: SITE_CSS,
    log: (message) => console.log(message),
  });

  const example = result.exampleCopied ? "example copied" : "no example";
  console.log(
    "site built: " +
      String(result.pages.length) +
      " page(s), " +
      String(result.documents) +
      " document(s), " +
      example,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
