import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

function depcruise(target: string): { summary: { violations: { rule: { name: string } }[] } } {
  const output = execFileSync(
    "pnpm",
    ["exec", "depcruise", target, "--config", ".dependency-cruiser.cjs", "--output-type", "json"],
    { encoding: "utf8", cwd: repoRoot, shell: process.platform === "win32" },
  );
  return JSON.parse(output);
}

// Each assertion here shells out to `pnpm exec depcruise`, which starts a Node process and walks the
// package. Measured in this repo: 4.2-4.4 s per assertion idle and 5.6-22.2 s under load (the pnpm
// shim alone costs 1.8-2.5 s). Vitest's 5000 ms default is therefore a coin flip, not a budget. These
// assertions set their own generous bound; every other test keeps the default, so a genuinely hung
// test still fails fast.
const DEPCRUISE_TIMEOUT_MS = 120_000;

describe("the boundary guard is real", () => {
  it("flags a node: import inside core/src", () => {
    const probe = join(repoRoot, "packages/core/src/__probe.ts");
    const srcDir = dirname(probe);
    const createdDir = !existsSync(srcDir);
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(probe, "import { readFileSync } from 'node:fs';\nexport const x = readFileSync;\n");
    try {
      const report = depcruise("packages/core/src");
      const names = report.summary.violations.map((v) => v.rule.name);
      expect(names).toContain("core-no-node-builtins");
    } finally {
      rmSync(probe, { force: true });
      if (createdDir) rmSync(srcDir, { recursive: true, force: true });
    }
  }, DEPCRUISE_TIMEOUT_MS);

  it("passes again once the probe is removed", () => {
    expect(depcruise("packages/core/src").summary.violations).toEqual([]);
  }, DEPCRUISE_TIMEOUT_MS);
});
