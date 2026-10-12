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

// F2 of the S0 Task 8 review: nothing above reads a step's `run`, so a deleted stage left CI green while
// running nothing. package.json's `gate` script is canonical; the workflow must run exactly those stages,
// in order, so a stage can neither be dropped from the workflow nor renamed out from under it.
check("gate job installs dependencies", () => {
  const runs = ((workflow.jobs && workflow.jobs.gate && workflow.jobs.gate.steps) || []).map((step) =>
    String(step.run || "").trim());
  if (!runs.includes("pnpm install --frozen-lockfile")) {
    throw new Error("no 'pnpm install --frozen-lockfile' step in the gate job");
  }
  return true;
});
check("gate job runs every stage of scripts.gate, in order", () => {
  const script = pkg.scripts && pkg.scripts.gate;
  if (typeof script !== "string") throw new Error("package.json has no scripts.gate");
  const prefix = "pnpm ";
  const stages = script.split("&&").map((part) => part.trim()).filter(Boolean).map((part) => {
    if (!part.startsWith(prefix)) throw new Error("scripts.gate stage is not a pnpm command: " + part);
    return part.slice(prefix.length).trim();
  });
  const runs = (workflow.jobs.gate.steps || []).map((step) => String(step.run || "").trim())
    .filter((run) => run.startsWith(prefix) && run !== "pnpm install --frozen-lockfile")
    .map((run) => run.slice(prefix.length).trim());
  if (runs.length !== stages.length) {
    throw new Error("workflow runs " + runs.length + " stage(s), scripts.gate declares " + stages.length +
      ": workflow " + JSON.stringify(runs) + " vs canonical " + JSON.stringify(stages));
  }
  for (let i = 0; i < stages.length; i++) {
    if (runs[i] !== stages[i]) {
      throw new Error("stage " + (i + 1) + " is \"" + runs[i] + "\" in the workflow but \"" + stages[i] +
        "\" in scripts.gate (canonical order " + JSON.stringify(stages) + ")");
    }
  }
  return true;
});
check("runtime-matrix runs runtime-smoke once per runtime, under its own condition", () => {
  const steps = workflow.jobs["runtime-matrix"].steps || [];
  const smoke = steps.filter((step) => String(step.run || "").includes("scripts/runtime-smoke.mjs"));
  const expected = {
    node: "node scripts/runtime-smoke.mjs",
    bun: "bun scripts/runtime-smoke.mjs",
    deno: "deno run -A scripts/runtime-smoke.mjs",
  };
  if (smoke.length !== 3) throw new Error("expected 3 runtime-smoke run steps, found " + smoke.length);
  for (const runtime of Object.keys(expected)) {
    const command = expected[runtime];
    const matches = smoke.filter((step) => String(step.run || "").trim() === command);
    if (matches.length !== 1) throw new Error("expected exactly one \"" + command + "\" step, found " + matches.length);
    const condition = String(matches[0].if || "").trim();
    const wanted = "matrix.runtime == '" + runtime + "'";
    if (condition !== wanted) {
      throw new Error("\"" + command + "\" runs under if: " + (condition || "(none)") + ", expected " + wanted);
    }
  }
  return true;
});

if (failures.length > 0) {
  for (const failure of failures) console.error("  - " + failure);
  throw new Error("ci:check FAILED: " + failures.length + " assertion(s) failed");
}
console.log("ci:check OK: 2 jobs, node 22/24/26, runtime node/bun/deno, pnpm " + declaredVersion);
