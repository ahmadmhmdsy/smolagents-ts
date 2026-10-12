#!/usr/bin/env node
/**
 * Import the built core package and assert the ECMA-429 surface exists.
 * Runs unchanged under Node (node scripts/runtime-smoke.mjs), Bun
 * (bun scripts/runtime-smoke.mjs) and Deno (deno run -A scripts/runtime-smoke.mjs).
 */
const failures = [];

function check(name, fn) {
  try {
    if (fn() === false) throw new Error("returned false");
  } catch (error) {
    failures.push(name + ": " + error.message);
  }
}

const core = await import(new URL("../packages/core/dist/index.js", import.meta.url).href);

check("core exports VERSION", () => typeof core.VERSION === "string");
check("fetch", () => typeof fetch === "function");
check("AbortController", () => typeof AbortController === "function");
check("AbortSignal", () => typeof AbortSignal === "function");
check("Headers", () => typeof Headers === "function");
check("TextEncoder", () => typeof TextEncoder === "function");
check("structuredClone", () => typeof structuredClone === "function");
check("crypto.randomUUID", () => typeof globalThis.crypto?.randomUUID === "function");
check("async iterator symbol", () => typeof (async function* () {})()[Symbol.asyncIterator] === "function");

const label = typeof Deno !== "undefined" ? "deno" : typeof Bun !== "undefined" ? "bun" : "node";

if (failures.length > 0) {
  for (const failure of failures) console.error("  - " + failure);
  throw new Error("runtime-smoke FAILED (" + label + "): " + failures.length + " checks failed");
}
console.log("runtime-smoke OK (" + label + ")");
