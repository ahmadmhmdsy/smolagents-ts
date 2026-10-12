import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("the boundary guard is real", () => {
  it("flags a node: import inside core/src", () => {
    const probe = join(repoRoot, "packages/core/src/__probe.ts");
    writeFileSync(probe, "import { readFileSync } from 'node:fs';\nexport const x = readFileSync;\n");
    try {
      const report = depcruise("packages/core/src");
      const names = report.summary.violations.map((v) => v.rule.name);
      expect(names).toContain("core-no-node-builtins");
    } finally {
      rmSync(probe, { force: true });
    }
  });

  it("passes again once the probe is removed", () => {
    expect(depcruise("packages/core/src").summary.violations).toEqual([]);
  });
});
