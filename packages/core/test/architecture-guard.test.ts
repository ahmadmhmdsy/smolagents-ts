import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

// depcruise's own entry, run under this Node with no shell: an args array with `shell: true` is
// concatenated unescaped (Node's DEP0190), and skipping the pnpm shim also saves its start-up cost.
const DEPCRUISE_PACKAGE = join(repoRoot, "node_modules/dependency-cruiser");
const DEPCRUISE_BIN = join(
  DEPCRUISE_PACKAGE,
  (JSON.parse(readFileSync(join(DEPCRUISE_PACKAGE, "package.json"), "utf8")) as { bin: Record<string, string> }).bin
    .depcruise ?? "bin/dependency-cruiser.mjs",
);

function depcruise(target: string): { summary: { violations: { rule: { name: string } }[] } } {
  const output = execFileSync(
        process.execPath,
        [DEPCRUISE_BIN, target, "--config", ".dependency-cruiser.cjs", "--output-type", "json"],
    { encoding: "utf8", cwd: repoRoot, timeout: DEPCRUISE_CHILD_TIMEOUT_MS },
  );
  return JSON.parse(output);
}

// Each assertion here shells out to `pnpm exec depcruise`, which starts a Node process and walks the package.
// Measured in this repo: 3.0-4.9 s per assertion at rest and 5.6-22.2 s under load (the pnpm shim alone costs
// 1.8-2.5 s), against Vitest's 5000 ms default - a coin flip, not a budget. Two bounds are needed, and not just
// because of the measured range: Vitest evaluates its timeout only after a synchronous test body returns, so the
// test bound alone cannot preempt a child that hangs. The child bound below is what actually stops one; it is
// deliberately below the test bound so a stuck depcruise surfaces as a failed assertion, not a stuck suite.
const DEPCRUISE_TIMEOUT_MS = 120_000;
const DEPCRUISE_CHILD_TIMEOUT_MS = 60_000;

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
