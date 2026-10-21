#!/usr/bin/env node
/**
 * Keep every package's exported VERSION constant equal to its manifest version.
 *
 * VERSION is a runtime value: a consumer reads it to learn which release it is
 * running. `@changesets/cli` rewrites package.json and the CHANGELOGs but cannot
 * see a TypeScript literal, so the two drifted apart once already — every
 * package reported 0.0.0 while the manifests said 0.1.0. `pnpm release:version`
 * runs this script right after `changeset version`, and the gate's
 * `pnpm version:check` stage fails when a literal disagrees with its manifest.
 *
 * Usage:
 *   node scripts/sync-versions.mjs          rewrite every stale marker
 *   node scripts/sync-versions.mjs --check  exit 1 and list every mismatch
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGES_DIR = fileURLToPath(new URL("../packages/", import.meta.url));
const CHECK = process.argv.includes("--check");
const MARKER = /export const VERSION = "([^"]*)";/;

/** The facade re-exports the core's value, so it carries no literal of its own. */
const WITHOUT_MARKER = new Set(["smolagents-ts"]);

const stale = [];
const updated = [];
const missing = [];
let checked = 0;

for (const name of readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()) {
  const versionFile = join(PACKAGES_DIR, name, "src/version.ts");
  const manifest = JSON.parse(
    readFileSync(join(PACKAGES_DIR, name, "package.json"), "utf8"),
  );
  let text;
  try {
    text = readFileSync(versionFile, "utf8");
  } catch {
    if (!WITHOUT_MARKER.has(name))
      missing.push(name + " has no src/version.ts");
    continue;
  }
  checked += 1;
  const match = MARKER.exec(text);
  if (match === null) {
    missing.push(name + " has no VERSION literal in src/version.ts");
    continue;
  }
  if (match[1] === manifest.version) continue;
  stale.push(
    name +
      ": src/version.ts says " +
      match[1] +
      " but package.json says " +
      manifest.version,
  );
  if (!CHECK) {
    writeFileSync(
      versionFile,
      text.replace(
        MARKER,
        'export const VERSION = "' + manifest.version + '";',
      ),
    );
    updated.push(name);
  }
}

const problems = missing.concat(CHECK ? stale : []);
if (problems.length > 0) {
  for (const problem of problems) console.error("  - " + problem);
  console.error(
    (CHECK ? "version:check" : "version:sync") +
      " FAILED: " +
      problems.length +
      " problem(s)",
  );
  process.exit(1);
}
if (CHECK) {
  console.log(
    "version:check OK: " + checked + " marker(s) match their manifests",
  );
} else {
  console.log(
    "version:sync OK: " +
      checked +
      " marker(s) checked, " +
      updated.length +
      " updated" +
      (updated.length > 0 ? ": " + updated.join(", ") : ""),
  );
}
