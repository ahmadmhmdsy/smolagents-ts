# S0 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the smolagents-ts monorepo so that an empty-but-real package set builds, typechecks, lints, tests, and passes the published-shape gates — establishing every quality gate from commit #1.

**Architecture:** A pnpm workspace with five internal packages (core, models, tools, exec-quickjs, react). Architecture boundaries (no node:*, no React, no DOM in core) are enforced by ESLint plus dependency-cruiser rather than by convention. The umbrella distribution package is deferred to S6; S0 creates only the internal packages.

**Tech Stack:** pnpm workspaces · TypeScript 6.x strict · tsup 8 · Vitest 5 · ESLint 10 flat config · dependency-cruiser · changesets · publint · @arethetypeswrong/cli · GitHub Actions

**Spec:** [../design/2026-10-12-smolagents-ts-v1-design.md](../design/2026-10-12-smolagents-ts-v1-design.md)

**Scope note:** This plan produces **no agent behaviour**. It produces a repository where every subsequent plan can be executed TDD-style with the gates already green. That is its whole value.

---

## Spec coverage

| design spec section | implemented by |
|---|---|
| 3.1 Required artefacts | Task 2 — LICENSE, NOTICE, the README disclaimer, docs/attribution.md |
| 5.1 Repository layout | Task 1 (workspace skeleton), Task 6 (the five packages) |
| 5.2 Distribution shape | Task 8 (the published-shape gate); the umbrella package itself is S6 |
| 5.4 Runtime constraints | Task 4 (ESLint and dependency-cruiser), Task 8 (the runtime matrix) |
| 11 Testing and validation | Task 5 (Vitest wiring), Task 8 (npm-pack smoke) |
| 12 Quality gates (CI) | Task 3 (strict TS), Task 4 (boundaries), Task 5 (test and build), Task 7 (changesets), Task 8 (CI) |

Everything else in the design spec is agent, model, executor or React work and is deliberately absent here:
this plan adds no runtime code beyond a version constant.

---

## File structure

```text
smolagents_ts/
├─ package.json                       root scripts + devDependencies, private
├─ pnpm-workspace.yaml                workspace globs + all pnpm settings
├─ .gitignore  .editorconfig
├─ tsconfig.base.json                 shared compiler options
├─ eslint.config.js                   flat config + core boundary rules
├─ .dependency-cruiser.cjs            architecture rules
├─ vitest.config.ts                   projects: packages/*
├─ LICENSE  NOTICE  README.md
├─ .changeset/config.json
├─ .github/workflows/ci.yml           the runtime matrix
├─ scripts/pack-smoke.mjs             npm pack -> install -> import -> run
├─ docs/attribution.md                upstream file -> module mapping
└─ packages/
   ├─ core/          package.json  tsconfig.json  tsup.config.ts  src/  test/
   ├─ models/        (same shape)
   ├─ tools/         (same shape)
   ├─ exec-quickjs/  (same shape)
   └─ react/         (same shape)
```

---

## Task 1: Root workspace skeleton

**Files:**
- Create: package.json
- Create: pnpm-workspace.yaml
- Create: .gitignore
- Create: .editorconfig

- [ ] **Step 1: Create pnpm-workspace.yaml**

pnpm 12 reads **only auth and registry settings** from an `.npmrc` file; every other setting lives in
`pnpm-workspace.yaml` or the global `config.yaml`. This project needs no registry or auth overrides, so there
is no `.npmrc` at all and all three settings go here, in pnpm's camelCase form.

```yaml
packages:
  - "packages/*"
  - "examples/*"

# Fail loudly instead of silently guessing peer dependency versions.
strictPeerDependencies: true
# Do not auto-install optional peers (React) for Node-only consumers.
autoInstallPeers: false
# Reproducible CI installs.
preferFrozenLockfile: true
# esbuild ships a prebuilt platform binary; its postinstall only validates the install.
# Recording it explicitly stops pnpm from appending a placeholder to this checked-in file
# on every non-interactive install (pnpm issue 11574).
allowBuilds:
  esbuild: true
```

- [ ] **Step 2: Verify the settings are actually in effect**

Run: pnpm config get autoInstallPeers
Expected: `false`

Run: pnpm config get strictPeerDependencies
Expected: `true`

This step exists because the settings are easy to put in the wrong file. Under pnpm 12 an `.npmrc` holding
`auto-install-peers=false` is silently ignored, and the only trace of the mistake is
`settings.autoInstallPeers: true` recorded inside `pnpm-lock.yaml`.

- [ ] **Step 3: Create .gitignore**

```gitignore
node_modules/
dist/
coverage/
*.tsbuildinfo
.vitest/
.DS_Store
*.log
# reference-only clones; never committed, never built
smolagents/
reference/
```

- [ ] **Step 4: Create .editorconfig**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 5: Create package.json**

```json
{
  "name": "smolagents-ts-monorepo",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.3.4",
  "engines": { "node": ">=22.12" },
  "scripts": {
    "build": "pnpm -r --filter ./packages/* run build",
    "typecheck": "pnpm -r run typecheck",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "depcruise": "depcruise packages --config .dependency-cruiser.cjs",
    "changeset": "changeset",
    "publint": "pnpm -r --filter ./packages/* exec publint",
    "attw": "pnpm -r --filter ./packages/* exec attw --pack . --profile esm-only",
    "pack:smoke": "node scripts/pack-smoke.mjs",
    "gate": "pnpm typecheck && pnpm lint && pnpm depcruise && pnpm test && pnpm build && pnpm publint && pnpm attw && pnpm pack:smoke"
  },
  "devDependencies": {
    "@arethetypeswrong/cli": "^0.18.0",
    "@changesets/cli": "^3.0.0",
    "@eslint/js": "^10.0.0",
    "dependency-cruiser": "^18.0.0",
    "eslint": "^10.0.0",
    "prettier": "^3.0.0",
    "publint": "^0.3.0",
    "tsup": "^8.0.0",
    "typescript": "^6.0.0",
    "typescript-eslint": "^8.0.0",
    "vite": "^6.4.0",
    "vitest": "^5.0.0"
  }
}
```

- [ ] **Step 6: Install and verify the workspace resolves**

Run: pnpm install
Expected: exit code 0; a pnpm-lock.yaml is created; no error output.

Run: pnpm config get autoInstallPeers
Expected: `false` — the value now comes from pnpm-workspace.yaml (Step 2), and
`settings.autoInstallPeers: false` is recorded inside pnpm-lock.yaml.

Run: pnpm exec tsc --version
Expected: prints Version 6.0.3 (the range is `^6.0.0`; TypeScript 6 is the current major).

A non-zero `pnpm install` here means pnpm refused to run a dependency's build script. pnpm 11+
defaults `strictDepBuilds` to true and exits 1 with ERR_PNPM_IGNORED_BUILDS for any package that has a
build script and is not named in `allowBuilds`. Step 1 names esbuild, so a correct configuration
installs cleanly; if this step fails, fix `allowBuilds` rather than downgrading pnpm.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml .gitignore .editorconfig pnpm-lock.yaml
git commit -m "chore: scaffold the pnpm workspace root"
```

---

## Task 2: Licence and attribution artefacts

**Files:**
- Create: LICENSE
- Create: NOTICE
- Create: README.md
- Create: docs/attribution.md
- Create: .gitattributes

- [ ] **Step 1: Copy the upstream LICENSE verbatim**

The upstream clone has `core.autocrlf=true`, so its working-tree file is CRLF (201 CR characters) while
the blob committed upstream is LF. A plain copy would import 201 CRLF lines into a repository whose
`.editorconfig` mandates LF — and the `"begins with Apache License"` check would still pass. Normalise
after copying:

```powershell
cp smolagents/LICENSE LICENSE
(Get-Content LICENSE -Raw) -replace "`r`n", "`n" | Set-Content LICENSE -NoNewline -Encoding utf8
```

Run: git hash-object LICENSE
Expected: `261eeb9e9f8b2b4b0d119366dda99c6fd7d35c64`, the same value as
`git -C smolagents rev-parse HEAD:LICENSE`, with no CR characters in the file. This proves byte-identity with the
upstream blob; the weaker presence check does not.

- [ ] **Step 2: Create NOTICE**

```text
smolagents-ts
Copyright 2026 the smolagents-ts contributors

This product is an unofficial, independent TypeScript implementation derived from
smolagents (https://github.com/huggingface/smolagents),
Copyright Hugging Face, licensed under the Apache License, Version 2.0.

Reference revision: 96f33faaf028479119ec8d34507b47694cf14e34 (v1.27.0.dev0, 2026-10-06).

Modifications made by this project:
  - The library was reimplemented in TypeScript.
  - The Python AST interpreter (local_python_executor.py) was replaced by a pluggable
    CodeExecutor abstraction with a QuickJS-WASM default.
  - Decorator-based and type-hint-based tool definition was replaced by schema-first
    declaration using Zod.
  - The Gradio user interface was replaced by a React layer.
  - Prompt templates were translated from the Python dialect to the JavaScript dialect.

This project is not affiliated with, sponsored by, or endorsed by Hugging Face.
"smolagents" and the Hugging Face marks belong to Hugging Face.
```

- [ ] **Step 3: Create README.md with the disclaimer in the first two lines**

```markdown
> **smolagents-ts is an unofficial TypeScript implementation of the smolagents approach,
> independently developed. It is not affiliated with, sponsored by, or endorsed by Hugging Face.
> "smolagents" and the Hugging Face marks belong to Hugging Face.**

# smolagents-ts

Agents that think in code, natively in TypeScript.

An agent whose action **is** a program: the model composes tools, control flow and intermediate
values in JavaScript, executed in a sandbox, and returns a final answer.

## Status

Pre-release. Scope is specified in [docs/design/2026-10-12-smolagents-ts-v1-design.md](docs/design/2026-10-12-smolagents-ts-v1-design.md).

## Licence

Apache-2.0. Derived from [smolagents](https://github.com/huggingface/smolagents); see [NOTICE](NOTICE).
```

- [ ] **Step 4: Create docs/attribution.md**

```markdown
# Attribution

smolagents-ts is derived from [smolagents](https://github.com/huggingface/smolagents),
commit 96f33faaf028479119ec8d34507b47694cf14e34 (v1.27.0.dev0, 2026-10-06), Apache-2.0.

The table records, per upstream file, what this project does with it. It is kept current as modules are
ported; a module is not "done" until its row is accurate.

| upstream file | disposition | this project |
|---|---|---|
| src/smolagents/agents.py | port | packages/core/src/agent/* |
| src/smolagents/memory.py | port | packages/core/src/memory/* |
| src/smolagents/monitoring.py | port | packages/core/src/monitoring/* |
| src/smolagents/models.py | split (interface vs adapters) | packages/core/src/model.ts, packages/models/src/* |
| src/smolagents/tools.py | port | packages/core/src/tool/*, packages/tools/src/index.ts |
| src/smolagents/default_tools.py | port subset | packages/tools/src/defaults/* |
| src/smolagents/utils.py | port subset | packages/core/src/utils/* |
| src/smolagents/agent_types.py | port subset | packages/core/src/types.ts |
| src/smolagents/prompts/*.yaml | port, translated to the JS dialect | packages/core/src/prompts/* |
| src/smolagents/local_python_executor.py | replace | packages/exec-quickjs |
| src/smolagents/gradio_ui.py | replace | packages/react |
| src/smolagents/_function_type_hints_utils.py | drop (replaced by Zod) | — |
| src/smolagents/tool_validation.py | drop (replaced by Zod + guards) | — |
| src/smolagents/serialization.py | defer to v1.5 | planned packages/core/src/serialization |
| src/smolagents/mcp_client.py | defer to v1.5 | planned packages/mcp |
| src/smolagents/remote_executors.py | defer to v1.5 | planned packages/exec-remote |
| src/smolagents/cli.py | defer to v1.5 | planned packages/cli |
| src/smolagents/vision_web_browser.py | defer to v2 | — |
```

- [ ] **Step 5: Verify the disclaimers are present**

Run: node -e "const fs=require('fs');const l=fs.readFileSync('README.md','utf8').split(String.fromCharCode(10));if(!/not affiliated/i.test(l.slice(0,3).join(' ')))process.exit(1);console.log('README OK')"
Expected: prints README OK

Run: node -e "const s=require('fs').readFileSync('NOTICE','utf8');if(!/not affiliated/i.test(s))process.exit(1);console.log('NOTICE OK')"
Expected: prints NOTICE OK

- [ ] **Step 6: Add .gitattributes so the LF policy is enforced by git, not only by editors**

`.editorconfig` is advisory: it governs editors and nothing enforces it at commit time. The upstream clone in
this very workspace proves the failure — it has `core.autocrlf=true`, so its working tree is CRLF while its
own blobs are LF. Without a `.gitattributes`, the same file therefore differs byte-wise between two
machines, which is exactly the problem Step 1 had to work around.

```gitattributes
# Normalise to LF inside the repository and check out LF everywhere.
* text=auto eol=lf
```

Run: git check-attr -a LICENSE
Expected: reports `text: auto` and `eol: lf` for LICENSE.

- [ ] **Step 7: Commit**

```bash
git add LICENSE NOTICE README.md docs/attribution.md .gitattributes
git commit -m "docs: add Apache-2.0 licence, derivation notice, attribution map and LF policy"
```

---

## Task 3: TypeScript configuration

**Files:**
- Create: tsconfig.base.json
- Create: packages/core/tsconfig.json

- [ ] **Step 1: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "jsx": "react-jsx",

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,

    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noEmit": true,

    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowJs": false,
    "types": []
  }
}
```

Note on lib: DOM is present in the base so that the fetch / AbortSignal / Headers types resolve
isomorphically (without it, AbortSignal, fetch, Response, Headers, ReadableStream and structuredClone are all
unresolved under lib ES2023). It does **not** license DOM *runtime* usage — that is enforced by the ESLint
boundary rules in Task 4, not by the type system.

Two costs of that choice, accepted deliberately: DOM's fetch/Request/Response types are structurally
incompatible with undici's, and setTimeout resolves to the DOM signature (number) rather than NodeJS.Timeout.
Neither matters until core stores a timer handle, which S1 does not.

target ES2022 with lib ES2023 means the code is typechecked against newer APIs than it emits for; the runtime
floor (Node 22+, evergreen browsers) is what makes that safe, and it is the documented floor, not an accident.

- [ ] **Step 2: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 2b: Create packages/core/tsconfig.test.json**

"types" is a directory-wide option, not a per-directory one: putting "types": ["node"] in the config above
would let node globals typecheck inside src as well, which is exactly the boundary this task exists to hold.
The test tree gets its own config instead.

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

Note: @types/node is needed only so the *test* directory can use node:child_process. Add it to the root
devDependencies in Step 3.

- [ ] **Step 3: Add @types/node and verify the config parses**

Run: pnpm add -Dw @types/node
Expected: @types/node appears in the root package.json devDependencies.

Run: pnpm exec tsc --showConfig -p packages/core/tsconfig.json
Expected: prints the resolved configuration containing "strict": true and "noUncheckedIndexedAccess": true,
exit code 0.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.base.json packages/core/tsconfig.json package.json pnpm-lock.yaml
git commit -m "build: add strict shared TypeScript configuration"
```

---

## Task 4: Architecture boundary enforcement

This is the task that makes core genuinely isomorphic. Without it, D7 is a wish.

**Files:**
- Create: eslint.config.js
- Create: .dependency-cruiser.cjs
- Create: packages/core/test/architecture.test.ts

- [ ] **Step 1: Create eslint.config.js**

```js
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const FORBIDDEN_CORE_MODULES = [
  "fs", "path", "os", "child_process", "worker_threads", "net", "http", "https",
  "crypto", "stream", "util", "url", "zlib", "vm", "module", "process", "buffer",
];

const FORBIDDEN_CORE_GLOBALS = [
  { name: "process", message: "core must be isomorphic; pass configuration explicitly." },
  { name: "Buffer", message: "core must be isomorphic; use TextEncoder/TextDecoder." },
  { name: "require", message: "core is ESM-only." },
  { name: "module", message: "core is ESM-only." },
  { name: "__dirname", message: "core must be isomorphic." },
  { name: "__filename", message: "core must be isomorphic." },
  { name: "window", message: "core must be framework-agnostic." },
  { name: "document", message: "core must be framework-agnostic." },
  { name: "localStorage", message: "core must be framework-agnostic." },
  { name: "eval", message: "core must never evaluate code; the executor plugin does that." },
  { name: "Function", message: "the Function constructor is a code-evaluation escape hatch." },
];

export default defineConfig(
  { ignores: ["**/dist/**", "**/coverage/**", "smolagents/**", "reference/**", "**/*.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/core/src/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["node:*"], message: "core must be isomorphic: no node: imports." },
          { group: FORBIDDEN_CORE_MODULES, message: "core must be isomorphic: no Node builtins." },
          { group: ["react", "react-dom", "react/*"], message: "core must not depend on React." },
        ],
      }],
      "no-restricted-globals": ["error", ...FORBIDDEN_CORE_GLOBALS],
      "no-restricted-syntax": ["error",
        { selector: "NewExpression[callee.name='Function']", message: "no Function constructor in core." },
        { selector: "CallExpression[callee.name='Function']", message: "a bare Function(...) call is the same escape hatch." },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "no-restricted-globals": "off", "no-restricted-imports": "off" },
  },
);
```

- [ ] **Step 2: Create .dependency-cruiser.cjs**

```js
/** Architecture rules. A violation fails CI, not just review. */
module.exports = {
  forbidden: [
    {
      name: "core-no-node-builtins",
      severity: "error",
      comment: "packages/core must run in Node, browsers, Bun, Deno and Workers.",
      from: { path: "^packages/core/src" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "core-no-react",
      severity: "error",
      comment: "core is framework-agnostic (design spec 5.3, layer L0).",
      from: { path: "^packages/core/src" },
      to: { path: "^packages/react" },
    },
    {
      name: "core-no-extra-runtime-deps",
      severity: "error",
      comment: "core may depend only on zod at runtime (design spec 5.2).",
      from: { path: "^packages/core/src" },
      to: { dependencyTypes: ["npm"], pathNot: "^node_modules/zod" },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-dev-dep",
      severity: "error",
      comment: "published source may not import a devDependency.",
      from: { path: "^packages/[^/]+/src" },
      to: { dependencyTypes: ["npm-dev"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|coverage|smolagents|reference)/" },
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "types"] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
```

- [ ] **Step 3: Write the failing architecture test**

```ts
// packages/core/test/architecture.test.ts
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
```

Note: this test file lives in core's test directory, which is **exempt** from the ESLint boundary rules
(see the **/*.test.ts override) — only src ships, so only src is constrained.

- [ ] **Step 4: Add architecture probes — a negative test that the guard actually guards**

```ts
// packages/core/test/architecture-guard.test.ts
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
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: pnpm vitest run --project core architecture
Expected: FAIL — packages/core/src does not exist yet, so dependency-cruiser exits non-zero and the test
throws. This is the correct failure. It is completed in Task 6, Step 8.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.js .dependency-cruiser.cjs packages/core/test/architecture.test.ts packages/core/test/architecture-guard.test.ts
git commit -m "build: enforce isomorphic core boundaries with eslint and dependency-cruiser"
```

---

## Task 5: Test and build tooling

**Files:**
- Create: vitest.config.ts
- Create: packages/core/vitest.config.ts
- Create: packages/core/tsup.config.ts

- [ ] **Step 1: Create vitest.config.ts**

Vitest 4 removed `defineWorkspace`; the modern equivalent is the `projects` array on one root config.

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*"],
  },
});
```

- [ ] **Step 2: Create packages/core/vitest.config.ts**

Each package names its own project explicitly so that `--project core` resolves. Without a `name` a project is
auto-named after the package, i.e. `@smolagents-ts/core`.

```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "core" },
});
```

- [ ] **Step 3: Create packages/core/tsup.config.ts**

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  // zod is a real runtime dependency; everything else must stay external.
  external: ["zod"],
});
```

- [ ] **Step 4: Verify tsup and vitest are invocable**

Run: pnpm exec tsup --version
Expected: prints 8.x.x

Run: pnpm exec vitest --version
Expected: prints 5.x.x

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts packages/core/vitest.config.ts packages/core/tsup.config.ts package.json pnpm-lock.yaml
git commit -m "build: add vitest projects config and tsup build config"
```

---

## Task 6: The five packages

**Files (created for each of core, models, tools, exec-quickjs, react):**
- Create: packages/NAME/package.json
- Create: packages/NAME/vitest.config.ts
- Create: packages/NAME/tsup.config.ts
- Create: packages/NAME/src/index.ts
- Create: packages/NAME/src/version.ts
- Create: packages/NAME/test/smoke.test.ts

- [ ] **Step 1: Create packages/core/package.json**

```json
{
  "name": "@smolagents-ts/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit -p tsconfig.test.json"
  },
  "dependencies": { "zod": "^4.0.0" }
}
```

- [ ] **Step 2: Create packages/core/src/version.ts**

```ts
/** Kept in sync with package.json by the release workflow. */
export const VERSION = "0.0.0";
```

- [ ] **Step 3: Write the smoke test**

```ts
// packages/core/test/smoke.test.ts
import { describe, expect, it } from "vitest";
import { VERSION } from "../src/index.js";

describe("core package", () => {
  it("exports a version string", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Create packages/core/src/index.ts to make it pass**

```ts
export { VERSION } from "./version.js";
```

- [ ] **Step 5: Run the tests**

Run: pnpm vitest run --project core
Expected: smoke.test.ts PASSES; architecture.test.ts PASSES; architecture-guard.test.ts PASSES
(2 tests). If the architecture test fails, the failure output names the offending import — fix the
import, do not relax the rule.

- [ ] **Step 6: Create the other four packages from the same template**

Create the same five files for each package below. The only differences are the package name, the
runtime dependencies and the tsup external list.

| package | name | runtime dependencies | tsup external |
|---|---|---|---|
| models | @smolagents-ts/models | zod | ["zod"] |
| tools | @smolagents-ts/tools | zod | ["zod"] |
| exec-quickjs | @smolagents-ts/exec-quickjs | zod, quickjs-emscripten-core, @jitl/quickjs-wasmfile-release-sync | ["zod", "quickjs-emscripten-core", "@jitl/quickjs-wasmfile-release-sync"] |
| react | @smolagents-ts/react | zod | ["zod", "react", "react-dom", "react/jsx-runtime"] |

The react package additionally declares optional peers:

```json
"peerDependencies": { "react": ">=18", "react-dom": ">=18" },
"peerDependenciesMeta": {
  "react": { "optional": true },
  "react-dom": { "optional": true }
}
```

The react package has no React import in S0, so its build passes with React absent. The moment real JSX or a
React import lands, the dts step needs react + @types/react as devDependencies; add them with that task, not
this one.

Each package's src/index.ts is:

```ts
export { VERSION } from "./version.js";
```

Each package's test/smoke.test.ts is core's smoke test with the describe name changed to match.

- [ ] **Step 7: Install and run everything**

Run: pnpm install
Expected: no error; quickjs-emscripten-core and the chosen variant appear in pnpm-lock.yaml. Do not depend on
the all-in-one quickjs-emscripten package (roughly 7.5-9 MB installed); the core package plus one variant is
about 1.1-1.3 MB.

Run: pnpm test
Expected: 5 smoke tests + 3 architecture tests pass, 0 failures.

- [ ] **Step 8: Verify every gate passes**

Run: pnpm typecheck
Expected: exit 0, no output.

Run: pnpm build
Expected: five dist/index.js and five dist/index.d.ts files now exist. Verify with:
node -e "for (const p of ['core','models','tools','exec-quickjs','react']) { for (const f of ['dist/index.js','dist/index.d.ts']) { require('fs').accessSync('packages/'+p+'/'+f); } } console.log('all builds present')"
Expected: prints all builds present

Run: pnpm lint
Expected: exit 0.

Run: pnpm depcruise
Expected: prints "no dependency violations found (N modules, M dependencies cruised)".

- [ ] **Step 9: Commit**

```bash
git add packages pnpm-lock.yaml
git commit -m "feat: add core, models, tools, exec-quickjs and react package skeletons"
```

---

## Task 7: Changesets

**Files:**
- Create: .changeset/config.json
- Create: .changeset/README.md

- [ ] **Step 1: Initialise changesets**

Run: pnpm changeset init
Expected: .changeset/config.json and .changeset/README.md are created.

- [ ] **Step 2: Replace .changeset/config.json**

```json
{
  "$schema": "https://unpkg.com/@changesets/config@4.0.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

Note: @changesets/cli and @changesets/config are different majors (3.x and 4.x); the schema URL tracks the
config version that changeset init itself would write.

- [ ] **Step 3: Verify a changeset can be created and status is clean**

Run: pnpm changeset status
Expected: exits 0. A non-zero exit means the config is malformed.

- [ ] **Step 4: Commit**

```bash
git add .changeset
git commit -m "chore: adopt changesets from the first commit"
```

---

## Task 8: The published-shape gate

This is gap-closer #2 from the BC-1 decision: the packaging contract is tested before there is anything
worth packaging, so it can never be "temporarily" broken.

**Files:**
- Create: scripts/pack-smoke.mjs
- Create: scripts/runtime-smoke.mjs
- Create: .github/workflows/ci.yml

- [ ] **Step 1: Create scripts/pack-smoke.mjs**

```js
#!/usr/bin/env node
/**
 * Pack every package, install the tarballs into a throwaway consumer, import every
 * published entry point, and assert the exports resolve.
 *
 * This catches what unit tests cannot: a missing file in "files", a broken "exports"
 * map, an ESM/CJS mismatch, a .d.ts that does not resolve.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PACKAGES = ["core", "models", "tools", "exec-quickjs", "react"];

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

const workspace = mkdtempSync(join(tmpdir(), "smolagents-pack-smoke-"));

try {
  for (const name of PACKAGES) {
    run("pnpm", ["pack", "--pack-destination", workspace], join(ROOT, "packages", name));
  }

  const found = readdirSync(workspace).filter((f) => f.endsWith(".tgz"));
  const tarballs = PACKAGES.map((name) => {
    const match = found.find((f) => f.includes("smolagents-ts-" + name + "-"));
    if (!match) {
      throw new Error("no tarball for " + name + "; found: " + found.join(", "));
    }
    return join(workspace, match);
  });

  writeFileSync(
    join(workspace, "package.json"),
    JSON.stringify({ name: "consumer", private: true, type: "module" }, null, 2),
  );

  run("npm", ["install", "--no-audit", "--no-fund", ...tarballs], workspace);

  const imports = [];
  const assertions = [];
  PACKAGES.forEach((name, i) => {
    imports.push("import { VERSION as v" + i + " } from '@smolagents-ts/" + name + "';");
    assertions.push("if (typeof v" + i + " !== 'string') throw new Error('bad export from " + name + "');");
  });

  writeFileSync(
    join(workspace, "check.mjs"),
    imports.join("\n") + "\n" + assertions.join("\n") + "\nconsole.log('pack-smoke OK');\n",
  );

  const output = run("node", ["check.mjs"], workspace);
  if (!output.includes("pack-smoke OK")) {
    throw new Error("consumer check did not report OK");
  }
  console.log("pack-smoke OK: " + PACKAGES.length + " packages installed and imported from tarballs");
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run the pack smoke test**

Run: pnpm build && node scripts/pack-smoke.mjs
Expected: prints "pack-smoke OK: 5 packages installed and imported from tarballs".

Run it once before pnpm build to confirm it fails honestly (not silently):
Expected: FAIL with "no tarball for core" or an install error. A gate that cannot fail is not a gate.

- [ ] **Step 3: Create scripts/runtime-smoke.mjs**

Running the *test runner* under Bun and Deno proves Vitest can execute there, not that the library is
isomorphic — and Vite leans on Node APIs, so it is also the fragile path. This script proves the tier-1 claim
directly: it imports the built package and touches only the allowed surface, with no bundler and no runner.

```js
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
```

- [ ] **Step 4: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  gate:
    name: gate (node ${{ matrix.node }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node: ["22", "24", "26"]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: "${{ matrix.node }}"
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm depcruise
      - run: pnpm test
      - run: pnpm build
      - run: pnpm publint
      - run: pnpm attw
      - run: pnpm pack:smoke

  runtime-matrix:
    name: runtime (${{ matrix.runtime }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        runtime: [node, bun, deno]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: pnpm
      - uses: oven-sh/setup-bun@v2
        if: matrix.runtime == 'bun'
      - uses: denoland/setup-deno@v2
        if: matrix.runtime == 'deno'
        with:
          deno-version: v2.x
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      # Import the built package directly: this proves the library, not the test runner.
      - run: node scripts/runtime-smoke.mjs
        if: matrix.runtime == 'node'
      - run: bun scripts/runtime-smoke.mjs
        if: matrix.runtime == 'bun'
      - run: deno run -A scripts/runtime-smoke.mjs
        if: matrix.runtime == 'deno'
```

- [ ] **Step 5: Verify the workflow file is present and well-formed**

Run: node -e "const s=require('fs').readFileSync('.github/workflows/ci.yml','utf8');if(!/name: CI/.test(s))process.exit(1);console.log('ci.yml present, '+s.split(String.fromCharCode(10)).length+' lines')"
Expected: prints "ci.yml present, N lines"

- [ ] **Step 6: Run the whole gate**

Run: pnpm gate
Expected: every stage exits 0 and the final line is
"pack-smoke OK: 5 packages installed and imported from tarballs".

- [ ] **Step 7: Commit**

```bash
git add scripts/pack-smoke.mjs scripts/runtime-smoke.mjs .github/workflows/ci.yml
git commit -m "ci: add runtime matrix and published-shape gate"
```

---

## S0 definition of done

- [ ] pnpm gate passes end to end from a clean pnpm install.
- [ ] LICENSE, NOTICE and a README disclaimer exist; docs/attribution.md covers every upstream file.
- [ ] Five packages build to ESM + .d.ts and are importable from tarballs in a clean consumer.
- [ ] dependency-cruiser proves core imports no node:*, no React, and no runtime dependency other than zod.
- [ ] **The guard is proven live:** packages/core/test/architecture-guard.test.ts fails when a probe
  imports node:fs into core/src and passes once removed. Quote the violation output as evidence.
- [ ] A changeset can be created and pnpm changeset status exits 0.
- [ ] CI is green on both the gate matrix (Node 22, 24, 26) and the runtime-matrix, where
  scripts/runtime-smoke.mjs imports the built core package under Node, Bun and Deno.

## What S0 deliberately does not do

- It does not create the umbrella smolagents-ts package. That is S6, once there is something worth
  publishing; the internal @smolagents-ts/* names keep every package private until then.
- It does not add a browser or Workers CI job. Those arrive with S1's first isomorphic code, because a
  matrix entry with nothing to test is theatre.
- It does not add a coverage floor or a bundle-size gate. A coverage gate over an empty package measures
  nothing, and there is nothing to size yet — both gates land after S0 (design section 12).
- It keeps tsup rather than moving to tsdown. tsup 8.5.1 is current and un-deprecated but low-activity; tsdown
  is the actively maintained successor, still pre-1.0, and it would raise the Node floor to 22.18. Revisit at
  S6, once a public package's packaging actually matters.

## Handoff to S1

S1 depends on exactly three things from S0:

1. A green pnpm gate, so every S1 task can end with a real verification.
2. The boundary rules, so the S1 loop cannot accidentally acquire a Node dependency.
3. The pack-smoke gate, so the S1 public surface is importable from a tarball on the day it is written.
