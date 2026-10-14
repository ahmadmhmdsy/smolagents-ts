import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** Walk up from a directory until the repository root (the one holding pnpm-workspace.yaml). */
export function findRepoRoot(startDirectory: string): string {
  let directory = resolve(startDirectory);
  for (;;) {
    if (existsSync(join(directory, "pnpm-workspace.yaml"))) return directory;
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error("no pnpm-workspace.yaml above " + startDirectory);
    }
    directory = parent;
  }
}

/** The blob URL prefix for a manifest repository field, with no trailing slash. */
export function githubBlobBase(repositoryUrl: string, branch = "main"): string {
  const cleaned = repositoryUrl
    .trim()
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const match =
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/.exec(cleaned) ??
    /^git@github\.com:([^/]+)\/([^/]+)$/.exec(cleaned);
  const owner = match?.[1];
  const repository = match?.[2];
  if (owner === undefined || repository === undefined) {
    throw new Error("cannot derive a GitHub owner and repository from " + repositoryUrl);
  }
  return "https://github.com/" + owner + "/" + repository + "/blob/" + branch;
}
