#!/usr/bin/env node
/**
 * Pack every package, install the tarballs into a throwaway consumer, import every
 * published entry point, and assert the exports resolve.
 *
 * This catches what unit tests cannot: a missing file in "files", a broken "exports"
 * map, an ESM/CJS mismatch, a .d.ts that does not resolve.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PACKAGES = ["core", "models", "tools", "exec-quickjs", "react"];

/** Quote only what needs it, so paths with spaces survive the shell. */
function quote(value) {
  return value.includes(" ") ? '"' + value + '"' : value;
}

/**
 * Pass one already-quoted command string rather than an args array. With shell: true, passing args is
 * deprecated (Node DEP0190) because it is a command-injection surface, and it would also break if a temp
 * path contained a quote. A single string also lets Windows resolve the pnpm/npm .cmd shims with no
 * platform branch.
 */
function run(cmd, args, cwd) {
  const line = [cmd, ...args].map(quote).join(" ");
  return execFileSync(line, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
}

/**
 * A tarball does not carry its peers, and a package whose optional peer is absent cannot be
 * imported at all. The one peer the published entries need at import time is taken from the
 * workspace's own installed copy, so the smoke stays offline. react-dom is deliberately absent:
 * nothing imports it, and installing it would pull its scheduler dependency from the registry.
 */
function peerSpec() {
  const found = [
    join(ROOT, "packages", "react", "node_modules", "react"),
    join(ROOT, "node_modules", "react"),
  ].find((dir) => existsSync(join(dir, "package.json")));
  if (found === undefined) throw new Error("react is not installed in the workspace");
  return "react@" + pathToFileURL(found).href;
}

const workspace = mkdtempSync(join(tmpdir(), "smolagents-pack-smoke-"));

try {
  for (const name of PACKAGES) {
    run("pnpm", ["pack", "--pack-destination", workspace], join(ROOT, "packages", name));
  }

  const found = readdirSync(workspace).filter((f) => f.endsWith(".tgz"));
  const tarballs = PACKAGES.map((name) => {
    const match = found.find((f) => f.includes("smolagents-ts-" + name + "-"));
    if (!match) {
      throw new Error("no tarball for " + name + "; found: " + found.join(", "));
    }
    return join(workspace, match);
  });

  writeFileSync(
    join(workspace, "package.json"),
    JSON.stringify({ name: "consumer", private: true, type: "module" }, null, 2),
  );

  run("npm", ["install", "--no-audit", "--no-fund", ...tarballs, peerSpec()], workspace);

  const imports = [];
  const assertions = [];
  PACKAGES.forEach((name, i) => {
    imports.push("import { VERSION as v" + i + " } from '@smolagents-ts/" + name + "';");
    assertions.push("if (typeof v" + i + " !== 'string') throw new Error('bad export from " + name + "');");
  });

  writeFileSync(
    join(workspace, "check.mjs"),
    imports.join("\n") + "\n" + assertions.join("\n") + "\nconsole.log('pack-smoke OK');\n",
  );

  const output = run("node", ["check.mjs"], workspace);
  if (!output.includes("pack-smoke OK")) {
    throw new Error("consumer check did not report OK");
  }
  console.log("pack-smoke OK: " + PACKAGES.length + " packages installed and imported from tarballs");
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
