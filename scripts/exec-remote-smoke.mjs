#!/usr/bin/env node
/**
 * A live check of one remote-executor backend, end to end through the public entries.
 *
 * The process path spawns a real interpreter on this host. The Docker path needs a reachable
 * daemon and builds its own kernel-gateway image. The E2B path needs the vendor SDK installed
 * and a credential in the environment, which this script never reads or prints itself.
 *
 * Build first (`pnpm build`); the imports name the built entries on purpose, because that is
 * what a consumer installs. Nothing here runs in the gate.
 *
 * Usage: node scripts/exec-remote-smoke.mjs [process|docker|e2b]
 */

import { ToolRegistry, noopLogger } from "../packages/core/dist/index.js";
import { RemoteExecutor } from "../packages/exec-remote/dist/index.js";
import { ProcessSandbox } from "../packages/exec-remote/dist/process.js";
import { DockerSandbox } from "../packages/exec-remote/dist/docker.js";
import { E2BSandbox } from "../packages/exec-remote/dist/e2b.js";

const MARKER = "the guest computed";
const backend = process.argv[2] ?? "process";
const factories = { process: ProcessSandbox, docker: DockerSandbox, e2b: E2BSandbox };
const Sandbox = factories[backend];

if (Sandbox === undefined) {
  console.error("unknown backend: " + backend + " (expected process, docker or e2b)");
  process.exit(2);
}

const controller = new AbortController();
const executor = new RemoteExecutor({ sandbox: new Sandbox() });
const live = [];

try {
  const result = await executor.execute(
    ["total = 6 * 7", `print('${MARKER}', total)`, "final_answer(total)"].join("\n"),
    {
      tools: new ToolRegistry(),
      finalAnswer: { name: "final_answer", submit: () => undefined },
      signal: controller.signal,
      timeoutMs: 120_000,
      stepIndex: 0,
      logger: noopLogger,
      onLog: (line) => live.push(line),
    },
  );

  const checks = [
    ["the sentinel frame became the answer", result.isFinalAnswer === true],
    ["the answer crossed as a value", result.value === 42],
    ["the run buffer captured the guest's line", result.logs.includes(MARKER + " 42")],
    ["the live sink saw the same line", live.some((line) => line.includes(MARKER + " 42"))],
    ["no error was reported", result.error === undefined],
  ];

  for (const [name, ok] of checks) console.log((ok ? "ok   " : "FAIL ") + name);
  console.log(backend + ": durationMs " + result.durationMs + ", toolCallCount " + result.toolCallCount);

  if (result.error !== undefined) {
    console.log("error " + result.error.code + ": " + result.error.message);
  }

  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
} finally {
  await executor.dispose();
}
