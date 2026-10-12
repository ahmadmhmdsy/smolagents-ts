import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

// The architecture config is plain CommonJS, so it can be read directly today, before zod is installed.
const loadCjs = createRequire(import.meta.url);
const config = loadCjs(join(repoRoot, ".dependency-cruiser.cjs")) as {
  forbidden: {
    name: string;
    from?: { path?: string };
    to?: { path?: string; pathNot?: string; dependencyTypes?: string[] };
  }[];
  options: { exclude: { path: string } };
};

// Each assertion here shells out to `pnpm exec depcruise`, which starts a Node process and walks the
// package. Measured in this repo: 4.2-4.4 s per assertion idle and 5.6-22.2 s under load (the pnpm
// shim alone costs 1.8-2.5 s). Vitest's 5000 ms default is therefore a coin flip, not a budget. These
// assertions set their own generous bound; every other test keeps the default, so a genuinely hung
// test still fails fast.
const DEPCRUISE_TIMEOUT_MS = 120_000;

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
      const stderr = (error as { stderr?: string }).stderr ?? "";
      throw new Error("dependency-cruiser failed: " + (stdout + stderr).slice(0, 2000), { cause: error });
    }
    const report = JSON.parse(output) as { summary: { violations: unknown[] } };
    expect(report.summary.violations).toEqual([]);
  }, DEPCRUISE_TIMEOUT_MS);

  it("core-no-extra-runtime-deps exempts zod however pnpm resolves it", () => {
    const rule = config.forbidden.find((candidate) => candidate.name === "core-no-extra-runtime-deps");
    expect(rule).toBeDefined();
    const exempt = new RegExp(rule?.to?.pathNot ?? "");
    expect(exempt.test("node_modules/zod/index.d.ts")).toBe(true);
    expect(exempt.test("node_modules/.pnpm/zod@4.6.7/node_modules/zod/index.d.ts")).toBe(true);
    expect(exempt.test("../../node_modules/.pnpm/zod@4.6.7/node_modules/zod/index.d.ts")).toBe(true);
    expect(exempt.test("node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.d.ts")).toBe(false);
    expect(exempt.test("node_modules/.pnpm/zodfoo@1.0.0/node_modules/zodfoo/index.d.ts")).toBe(false);
  });

  it("a source-dependency rule refuses packages no manifest declares", () => {
    const rule = config.forbidden.find((candidate) => candidate.from?.path === "^packages/[^/]+/src");
    expect(rule).toBeDefined();
    expect(rule?.to?.dependencyTypes).toContain("npm-no-pkg");
  });

  it("options.exclude cannot match inside node_modules", () => {
    const excluded = new RegExp(config.options.exclude.path);
    expect(excluded.test("node_modules/.pnpm/vitest@5.0.3_@types+node@26/node_modules/vitest/dist/index.d.ts")).toBe(false);
    expect(excluded.test("packages/core/dist/index.js")).toBe(true);
  });
});
