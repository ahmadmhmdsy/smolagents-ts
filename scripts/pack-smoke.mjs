#!/usr/bin/env node
/**
 * Pack every package, install the tarballs into a throwaway consumer, import every
 * published entry point, and assert the exports resolve.
 *
 * This catches what unit tests cannot: a missing file in "files", a broken "exports"
 * map, an ESM/CJS mismatch, a .d.ts that does not resolve.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PACKAGES = ["core", "models", "tools", "exec-quickjs", "exec-pyodide", "exec-remote", "react", "react-ui", "cli", "mcp"];
/** The published name: its tarball is the only one that is not scoped. */
const FACADE = "smolagents-ts";

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

/**
 * Pyodide is a regular dependency of exec-pyodide and installs about 13 MiB of wasm and
 * stdlib, so the consumer resolves it from the workspace's own installed copy through a
 * "file:" spec rather than the registry, exactly as react is. The consumer import check
 * only imports each barrel, and the barrel's pyodide import is lazy, so a "file:" install
 * that leaves pyodide's own dependencies unresolved is enough for this smoke.
 */
function pyodideSpec() {
  const found = [
    join(ROOT, "packages", "exec-pyodide", "node_modules", "pyodide"),
    join(ROOT, "node_modules", "pyodide"),
  ].find((dir) => existsSync(join(dir, "package.json")));
  if (found === undefined) throw new Error("pyodide is not installed in the workspace");
  return "pyodide@" + pathToFileURL(found).href;
}

const workspace = mkdtempSync(join(tmpdir(), "smolagents-pack-smoke-"));

try {
  for (const name of [...PACKAGES, FACADE]) {
    run("pnpm", ["pack", "--pack-destination", workspace], join(ROOT, "packages", name));
  }

  const found = readdirSync(workspace).filter((f) => f.endsWith(".tgz"));
  const tarballFor = (pattern) => {
    const match = found.find((f) => pattern.test(f));
    if (!match) {
      throw new Error("no tarball matching " + pattern + "; found: " + found.join(", "));
    }
    return join(workspace, match);
  };
  const tarballs = [
    ...PACKAGES.map((name) => tarballFor(new RegExp("^smolagents-ts-" + name + "-"))),
    // The facade's tarball is "smolagents-ts-<version>.tgz": the scoped packages
    // start with the same prefix, so the version digit is what separates them.
    tarballFor(/^smolagents-ts-\d/),
  ];

  writeFileSync(
    join(workspace, "package.json"),
    JSON.stringify({ name: "consumer", private: true, type: "module" }, null, 2),
  );

  run("npm", ["install", "--no-audit", "--no-fund", ...tarballs, peerSpec(), pyodideSpec()], workspace);

  // The styled layer ships its stylesheet as plain text rather than as an imported module, so
  // "files" has to carry it into the tarball and dist/styles.css has to reach the consumer
  // intact. The token block is the theming contract, so each token name is read from the
  // installed copy rather than the workspace source.
  const stylesPath = join(workspace, "node_modules", "@smolagents-ts", "react-ui", "dist", "styles.css");
  if (!existsSync(stylesPath)) {
    throw new Error("the packed react-ui carries no dist/styles.css");
  }
  const styles = readFileSync(stylesPath, "utf8");
  if (styles.trim().length === 0) {
    throw new Error("the packed react-ui dist/styles.css is empty");
  }
  for (const token of ["--smol-surface", "--smol-text", "--smol-accent", "--smol-radius", "--smol-gap"]) {
    if (!styles.includes(token)) {
      throw new Error("the packed react-ui dist/styles.css is missing " + token);
    }
  }

  const imports = [];
  const assertions = [];
  PACKAGES.forEach((name, i) => {
    imports.push("import { VERSION as v" + i + " } from '@smolagents-ts/" + name + "';");
    assertions.push("if (typeof v" + i + " !== 'string') throw new Error('bad export from " + name + "');");
  });

  // The facade is what a caller installs, so every subpath its exports map
  // promises is imported here, through the published name rather than the
  // workspace link.
  imports.push(
    "import { VERSION as facadeVersion } from 'smolagents-ts';",
    "import * as facadeModels from 'smolagents-ts/models';",
    "import * as facadeTools from 'smolagents-ts/tools';",
    "import * as facadeQuickjs from 'smolagents-ts/exec/quickjs';",
    "import * as facadeReact from 'smolagents-ts/react';",
  );
  assertions.push(
    "if (typeof facadeVersion !== 'string') throw new Error('bad export from smolagents-ts');",
    "for (const [name, surface] of Object.entries({ models: facadeModels, tools: facadeTools, quickjs: facadeQuickjs, react: facadeReact })) {",
    "  if (Object.keys(surface).length === 0) throw new Error('smolagents-ts/' + name + ' re-exports nothing');",
    "}",
  );

  writeFileSync(
    join(workspace, "check.mjs"),
    imports.join("\n") + "\n" + assertions.join("\n") + "\nconsole.log('pack-smoke OK');\n",
  );

  const output = run("node", ["check.mjs"], workspace);
  if (!output.includes("pack-smoke OK")) {
    throw new Error("consumer check did not report OK");
  }

  // Importing a barrel is not running it. The consumer that matters is the one that
  // builds an agent out of the installed tarballs and executes a real program in the
  // real sandbox, so the smoke does what examples/node-script does, against the packed
  // artifact rather than the workspace source. This is the only check that proves the
  // published package works rather than merely resolves.
  writeFileSync(join(workspace, "run.mjs"), "import { CODE_FENCE, CodeAgent, MockModel, tool } from 'smolagents-ts';\nimport { QuickJSExecutor } from 'smolagents-ts/exec/quickjs';\nimport { z } from 'zod';\n\nconst greet = tool({\n  name: 'greet',\n  description: 'Greet one person by name.',\n  inputSchema: z.object({ name: z.string() }),\n  execute: ({ name }) => 'Hello, ' + name + '!',\n});\nconst program = \"const message = await greet({ name: \\\"world\\\" });\\nfinal_answer(message);\";\nconst model = new MockModel([\n  \"Thought: greet the caller, then answer with the greeting.\\nCode:\\n\" + CODE_FENCE + \"\\n\" + program + \"\\n\" + CODE_FENCE,\n]);\nconst executor = new QuickJSExecutor();\ntry {\n  const agent = new CodeAgent({ model, executor, tools: [greet] });\n  const result = await agent.run('Greet the world.');\n  if (result.output !== 'Hello, world!') {\n    throw new Error('the installed package returned ' + JSON.stringify(result.output));\n  }\n  console.log('pack-smoke run OK: ' + result.output);\n} finally {\n  await executor.dispose();\n}\n");
  const runOutput = run("node", ["run.mjs"], workspace);
  if (!runOutput.includes("pack-smoke run OK: Hello, world!")) {
    throw new Error("the installed package did not run an agent");
  }

  // The CLI's published entry point is its bin, not its barrel, so the smoke runs the
  // installed bin once. --help exercises the parser and the usage text without a model.
  const cliDir = join(workspace, "node_modules", "@smolagents-ts", "cli");
  const cliManifest = JSON.parse(readFileSync(join(cliDir, "package.json"), "utf8"));
  const binField = cliManifest.bin;
  const binPath = typeof binField === "string" ? binField : binField?.smolagent;
  if (typeof binPath !== "string") {
    throw new Error("the packed cli manifest declares no smolagent bin");
  }
  const help = run("node", [join(cliDir, binPath), "--help"], workspace);
  if (!help.includes("Usage:")) {
    throw new Error("the installed smolagent bin did not print its usage");
  }

  // Name the run's own output in the summary: a silent check that never executed
  // looks exactly like one that passed.
  const runLine = runOutput.trim().split("\n").pop();
  console.log(
    "pack-smoke OK: " + (PACKAGES.length + 1) + " packages installed and imported; the cli bin ran; " + runLine,
  );
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
