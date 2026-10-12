#!/usr/bin/env node
/**
 * Assert the CI workflow's structure, not its spelling.
 *
 * The pnpm version is read from package.json's packageManager field and compared with what the workflow
 * installs, so the two cannot drift apart unnoticed.
 */
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const workflow = parse(readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const failures = [];
function check(name, fn) {
  try {
    if (fn() === false) throw new Error("assertion returned false");
  } catch (error) {
    failures.push(name + ": " + error.message);
  }
}

check("gate job exists", () => Boolean(workflow.jobs && workflow.jobs.gate));
check("runtime-matrix job exists", () => Boolean(workflow.jobs && workflow.jobs["runtime-matrix"]));
check("gate node matrix is 22/24/26", () =>
  JSON.stringify(workflow.jobs && workflow.jobs.gate && workflow.jobs.gate.strategy.matrix.node) ===
  JSON.stringify(["22", "24", "26"]));
check("runtime matrix is node/bun/deno", () =>
  JSON.stringify(workflow.jobs && workflow.jobs["runtime-matrix"] && workflow.jobs["runtime-matrix"].strategy.matrix.runtime) ===
  JSON.stringify(["node", "bun", "deno"]));

const declared = /^pnpm@(.+)$/.exec(pkg.packageManager || "");
const declaredVersion = declared && declared[1];
check("packageManager declares a pnpm version", () => typeof declaredVersion === "string");
check("every pnpm/action-setup step agrees with packageManager", () => {
  const jobs = Object.values(workflow.jobs || {});
  const steps = jobs.flatMap((job) => job.steps || []);
  const setup = steps.filter((step) => String(step.uses || "").startsWith("pnpm/action-setup"));
  if (setup.length === 0) throw new Error("no pnpm/action-setup step found");
  for (const step of setup) {
    const version = step.with && step.with.version;
    if (version === undefined) continue; // action-setup reads packageManager itself
    if (String(version) !== String(declaredVersion)) {
      throw new Error("workflow pins pnpm " + version + " but packageManager declares " + declaredVersion);
    }
  }
  return true;
});

if (failures.length > 0) {
  for (const failure of failures) console.error("  - " + failure);
  throw new Error("ci:check FAILED: " + failures.length + " assertion(s) failed");
}
console.log("ci:check OK: 2 jobs, node 22/24/26, runtime node/bun/deno, pnpm " + declaredVersion);
