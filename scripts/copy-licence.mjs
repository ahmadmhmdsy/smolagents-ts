#!/usr/bin/env node
/**
 * Copy LICENSE and NOTICE into a package before it is packed, and remove them
 * afterwards. npm packs only files under the package directory, so the copies
 * are the only way the published tarball can carry the licence text; they are
 * generated, gitignored, and never edited by hand.
 *
 * Usage: node scripts/copy-licence.mjs <copy|clean> <package directory>
 */
import { copyFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const [action, target] = process.argv.slice(2);
if ((action !== "copy" && action !== "clean") || target === undefined) {
  console.error("usage: node scripts/copy-licence.mjs <copy|clean> <package directory>");
  process.exit(2);
}

const packageDir = resolve(target);
for (const name of ["LICENSE", "NOTICE"]) {
  const destination = join(packageDir, name);
  if (action === "copy") {
    copyFileSync(join(ROOT, name), destination);
  } else if (existsSync(destination)) {
    rmSync(destination);
  }
}
