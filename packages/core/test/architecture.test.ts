import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

describe("architecture boundaries", () => {
  it("dependency-cruiser reports no violations", () => {
    let output: string;
    try {
      output = execFileSync(
        "pnpm",
        ["exec", "depcruise", "packages/core/src", "--config", ".dependency-cruiser.cjs", "--output-type", "json"],
        { encoding: "utf8", cwd: repoRoot, shell: process.platform === "win32" },
      );
    } catch (error) {
      const stdout = (error as { stdout?: string }).stdout ?? "";
      throw new Error("dependency-cruiser failed: " + stdout.slice(0, 2000));
    }
    const report = JSON.parse(output) as { summary: { violations: unknown[] } };
    expect(report.summary.violations).toEqual([]);
  });
});
