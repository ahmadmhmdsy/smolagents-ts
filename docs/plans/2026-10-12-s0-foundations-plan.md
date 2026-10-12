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

Run: node -e "const b=require('fs').readFileSync('LICENSE');const cr=b.filter((x)=>x===13).length;console.log('bytes='+b.length+' cr='+cr);if(cr!==0||b.length!==11357)process.exit(1)"
Expected: `bytes=11357 cr=0`

Run: git hash-object LICENSE
Expected: `261eeb9e9f8b2b4b0d119366dda99c6fd7d35c64`, the same value as
`git -C smolagents rev-parse HEAD:LICENSE`.

Run the byte check as the primary evidence, and run both before Step 6 creates `.gitattributes`.
`git hash-object` applies the filters configured for the path: once `* text=auto eol=lf` exists, a CRLF file
at path `LICENSE` is normalised on the way in and hashes to the same `261eeb9e...` blob, so the hash can no
longer distinguish a CRLF import from a correct one. The measured `cr=0` byte count can, because it never
passes through a filter.

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
- Create: packages/core/tsconfig.test.json

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

- [ ] **Step 3: Add @types/node and verify the configs parse**

`packages/core/tsconfig.json` sets `include: ["src"]`, and `packages/core/src` deliberately does not exist yet:
Task 4's architecture test depends on that absence, and Task 6 creates src. So `tsc -p packages/core/tsconfig.json`
fails here with TS18003 "No inputs were found", and a config-shaped check must take its input from elsewhere.
Verify the shared base against a throwaway probe rather than seeding src:

Run: pnpm add -Dw @types/node
Expected: @types/node appears in the root package.json devDependencies.

```powershell
New-Item -ItemType Directory -Force -Path .superpowers/tmp-tscheck | Out-Null
Set-Content .superpowers/tmp-tscheck/probe.ts 'export const probe: number = 1;' -Encoding utf8
Set-Content .superpowers/tmp-tscheck/tsconfig.json '{ "extends": "../../tsconfig.base.json", "compilerOptions": { "types": ["node"] }, "include": ["probe.ts"] }' -Encoding utf8
pnpm exec tsc --noEmit -p .superpowers/tmp-tscheck/tsconfig.json
'TSC_NOEMIT_EXIT=' + $LASTEXITCODE
$matches = pnpm exec tsc --showConfig -p .superpowers/tmp-tscheck/tsconfig.json | Select-String -Pattern '"strict": true|"noUncheckedIndexedAccess": true'
'TSC_SHOWCONFIG_MATCHES=' + $matches.Count
Remove-Item -Recurse -Force .superpowers/tmp-tscheck
```

Expected: `TSC_NOEMIT_EXIT=0` and `TSC_SHOWCONFIG_MATCHES=2`.

The match count, not just an exit code, is the assertion, and both lines are printed explicitly. `Select-String`
is a cmdlet: it does not set `$LASTEXITCODE`, so the earlier `'TSC_SHOWCONFIG_EXIT=' + $LASTEXITCODE` echoed tsc's
exit code and read 0 even when nothing matched — and the pattern `"strict"|"noUncheckedIndexedAccess"` matched
`"strict": false` just as happily. That is the presence-versus-identity trap of A-11 and A-13, reproduced inside the
check written to close A-17. Measured: a base with `"strict": false` yields `TSC_SHOWCONFIG_MATCHES=1` (and `TS5052`,
exit 2), a bad `extends` path yields `TSC_NOEMIT_EXIT=2` with `TSC_SHOWCONFIG_MATCHES=0`, and the correct
base yields 0 and 2. The block's own exit code is `Remove-Item`'s, so these lines are its only evidence; the probe
is deleted again. It exists only because `packages/core/src` is not created until Task 6, and it
also proves @types/node resolves: without it the test config fails with TS2688 `Cannot find type definition file for 'node'`.

Run: node -e "const fs=require('fs');JSON.parse(fs.readFileSync('packages/core/tsconfig.json','utf8'));JSON.parse(fs.readFileSync('packages/core/tsconfig.test.json','utf8'));console.log('configs OK')"
Expected: prints configs OK

The input-dependent check of the real package configs is Task 6's gate, by which point src and test exist.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.base.json packages/core/tsconfig.json packages/core/tsconfig.test.json package.json pnpm-lock.yaml
git commit -m "build: add strict shared TypeScript configuration"
```

---

## Task 4: Architecture boundary enforcement

This is the task that makes core genuinely isomorphic. Without it, D7 is a wish.

**Superseded in part by Task 4R** (the review's F1, F2, F2b, F5, F6 and F7 fixes).

**Files:**
- Create: eslint.config.js
- Create: .dependency-cruiser.cjs
- Create: packages/core/test/architecture.test.ts
- Create: packages/core/test/architecture-guard.test.ts
- Edit: package.json, pnpm-lock.yaml (adds the `globals` devDependency)

- [ ] **Step 1: Create eslint.config.js**

Run: pnpm add -Dw globals
Expected: `globals` appears in the root package.json devDependencies. `js.configs.recommended` turns on
`no-undef`, and the repository's non-TypeScript files — this config, `.dependency-cruiser.cjs`, and the
scripts Task 8 adds — need Node globals or they fail linting.

Then create `eslint.config.js`:

```js
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
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
  // Throwaway probe trees live under .superpowers/ (the Task 3 tsconfig probe, reviewer scratch) and are
  // gitignored, so they must never be linted: measured, `eslint .` picks up .superpowers/**/*.ts and fails
  // on it, which would make Task 8's gate depend on scratch files that happen to be lying around.
  { ignores: ["**/dist/**", "**/coverage/**", "**/.superpowers/**", "smolagents/**", "reference/**", "**/*.d.ts"] },
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
  // js.configs.recommended applies to every file ESLint lints, and ESLint lints .js, .mjs and .cjs by
  // default. Without Node globals those files fail no-undef: measured, eslint . reports
  // "'module' is not defined" on .dependency-cruiser.cjs and console/process/URL on the .mjs scripts.
  {
    files: ["**/*.cjs"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
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
      throw new Error("dependency-cruiser failed: " + stdout.slice(0, 2000), { cause: error });
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
import { writeFileSync, rmSync } from "node:fs";
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

- [ ] **Step 5: Run the linter, then the tests to verify they fail**

Run: pnpm exec vitest run packages/core/test/architecture.test.ts
Expected: FAIL — the test file actually runs and its assertion fails, because packages/core/src does not
exist yet, so dependency-cruiser exits non-zero and the test throws. That is the correct failure, and it is
completed in Task 6, Step 8.

Run: pnpm lint
Expected: exit 0, no output. This task creates the lint configuration, so this task proves it runs; otherwise
the first execution is Task 6's gate, where a failure caused by this config would be misread as a Task 6
defect. Measured against this config without the Node-globals block above: `eslint .` reports
`'module' is not defined` on `.dependency-cruiser.cjs` and exits 1.

Do not use `--project core` here. The root `vitest.config.ts` is created in Task 5, and until it exists
`--project` produces a startup error — `No projects matched the filter "core"` — with exit code 1 and
without running the test at all. That exit code looks exactly like the expected failure while proving nothing.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.js .dependency-cruiser.cjs packages/core/test/architecture.test.ts packages/core/test/architecture-guard.test.ts package.json pnpm-lock.yaml
git commit -m "build: enforce isomorphic core boundaries with eslint and dependency-cruiser"
```

---

## Task 4R: Task 4 review fixes

The Task 4 reviewer returned **CHANGES_REQUIRED** (1 Critical, 3 Important, 4 Minor) with the full report at
`.superpowers/sdd/task-4-review.md`. Six findings are fixed here. F3 and F4 are not: they are the guard fixture's
`writeFileSync` placement and vitest isolation, and Task 5 owns both.

**Files:**
- Modify: .dependency-cruiser.cjs
- Modify: eslint.config.js
- Modify: packages/core/test/architecture.test.ts

**Do not touch:** `docs/plans/2026-10-12-s0-foundations-plan.md`, `docs/research/validation-report.md`,
`.superpowers/sdd/progress.md`, and anything Task 5 owns (`vitest.config.ts`,
`packages/core/vitest.config.ts`, `packages/core/tsup.config.ts`,
`packages/core/test/architecture-guard.test.ts`). Never `git add -A`, `git add .`, `git add -u`
or `git commit -a`; stage the three paths explicitly. Report an unexpected `git status` entry instead of
touching it. Write your report to `.superpowers/sdd/task-4r-report.md`.

- [ ] **Step 1: Make the zod exception match how pnpm resolves zod (F1, Critical)**

The rule `core-no-extra-runtime-deps` exists to allow exactly one dependency, zod, and it flags it instead.
dependency-cruiser resolves through the pnpm store (`preserveSymlinks: false`), so the module path is not
`node_modules/zod/...` but the store path, and the current pattern is anchored to the former:

```js
        to: { dependencyTypes: ["npm"], pathNot: "^node_modules/zod" },
```

Change the pattern to an unanchored one that requires the trailing slash:

```js
        to: { dependencyTypes: ["npm"], pathNot: "node_modules/zod/" },
```

**MEASURED**: dependency-cruiser 18.5.1 reports the zod store path as
`node_modules/.pnpm/zod@4.6.7/node_modules/zod/index.d.ts` (and the same value with a `../../` prefix in the JSON
`resolved` field). `^node_modules/zod` matches neither. The unanchored form matches the store layout, a flat
layout and the `../../`-prefixed form, and still cannot match a different package because the slash after `zod` is
required (`.../node_modules/zodfoo/index.d.ts` does not match).

- [ ] **Step 2: Anchor the exclude so it cannot match inside node_modules (F2, Important)**

The current exclude matches `/dist/` at any depth, so it deletes npm edges before any rule runs:

```js
    exclude: { path: "(^|/)(dist|coverage|smolagents|reference)/" },
```

Replace it with the anchored form:

```js
    exclude: { path: "^packages/[^/]+/(?:dist|coverage)/|^(?:dist|coverage|smolagents|reference)/" },
```

**MEASURED**: with the shipped pattern a `vitest` import in `packages/core/src` is dropped and the cruise
reports 32 modules, 21 dependencies; with the anchored pattern the same tree reports 34 modules and 34 dependencies,
and the restored leaf modules are `vitest/dist/index.d.ts`, `tsup/dist/index.js` and `vitest/config.d.ts`.
Our own build output stays excluded in both cases (`packages/*/dist` and `packages/*/coverage` modules cruised: 0).
Do not `"simplify"` this to `^(?:packages/[^/]+/)?(?:dist|coverage)/`: **MEASURED**, dependency-cruiser refuses
that shape with "The pattern ... will probably run very slowly - cowardly refusing to run" because the quantified
group nests a second quantifier.

- [ ] **Step 3: Replace a rule that goes blind once packages have manifests (F2b, Important)**

`not-to-dev-dep` classifies a dependency against the nearest `package.json` of the importing module. Today
`packages/core/package.json` does not exist, so the nearest manifest is the root's, which declares `vitest` as a
devDependency, and the rule fires. Task 6 creates `packages/NAME/package.json` declaring only `zod` (or zod plus
the quickjs packages), at which point the very same import is classified `npm-no-pkg` and the rule is silent:

```text
no packages/core/package.json -> [npm-dev,import]    -> not-to-dev-dep: 1
core/package.json declares only zod -> [npm-no-pkg,import] -> not-to-dev-dep: 0
core/package.json also declares vitest as a devDep -> [npm-dev,import] -> not-to-dev-dep: 1
```

Replace the rule with one that treats every non-declared package the same way:

```js
    {
      name: "no-undeclared-deps-from-src",
      severity: "error",
      comment: "packages/*/src may only import packages its own manifest declares.",
      from: { path: "^packages/[^/]+/src" },
      to: { dependencyTypes: ["npm-dev", "npm-no-pkg", "npm-unknown"] },
    },
```

**MEASURED** in the post-Task-6 manifest shape (nearest manifest declares only zod): the same `vitest` import that
left `not-to-dev-dep` silent makes this rule report `no-undeclared-deps-from-src` and exit 1. A declared
dependency stays allowed (`npm`), and `npm-peer` / `npm-optional` stay allowed, so the react package may
still import its peers. `core-no-extra-runtime-deps` is what then narrows core's declared dependencies to zod.

- [ ] **Step 4: Apply the core restrictions to every source extension (F5, Minor)**

`packages/core/src/__probe_scope.mts` holding `eval(...)` and `process.exit(...)` **is** linted but produces
**zero** messages with the shipped pattern, because the restriction block only claims `**/*.ts`. Widen it:

```js
    files: ["packages/core/src/**/*.{ts,tsx,mts,cts}"],
```

**MEASURED**: with the widened pattern the same probe reports two `no-restricted-globals` errors. Also widen the
test-file override from `files: ["**/*.test.ts", "**/*.test.tsx"]` to `files: ["**/*.test.{ts,tsx,mts,cts}"]`.

- [ ] **Step 5: Close the builtin list (F6, Minor)**

Add the modules the review named and their close neighbours to `FORBIDDEN_CORE_MODULES`: `timers`,
`timers/promises`, `events`, `assert`, `assert/strict`, `dns`, `dns/promises`, `tls`, `dgram`,
`cluster`, `readline`, `readline/promises`, `repl`, `string_decoder`, `perf_hooks`, `async_hooks`,
`inspector`, `v8`, `domain`, `punycode`, `querystring`, `trace_events`, `tty`,
`diagnostics_channel`, `sea`, `sqlite`, `test`, `constants`, `sys`.
Subpath specifiers need their own entry, because a `no-restricted-imports` group entry matches whole module
names: `timers` does not cover `timers/promises`, which only dependency-cruiser caught before this step.
Verify with a core/src probe importing bare `timers/promises` and `assert` plus a legitimate import that must
stay clean, then delete the probe.

- [ ] **Step 6: Make the failing gate explain itself (F7, Minor)**

dependency-cruiser writes its diagnostic to stderr, but `architecture.test.ts` reads only `error.stdout`, so the
thrown message body is empty. Include both streams:

```ts
    } catch (error) {
      const stdout = (error as { stdout?: string }).stdout ?? "";
      const stderr = (error as { stderr?: string }).stderr ?? "";
      throw new Error("dependency-cruiser failed: " + (stdout + stderr).slice(0, 2000), { cause: error });
    }
```

- [ ] **Step 7: Add the regressions that would have caught Steps 1 to 3 (permanent, no install needed)**

Add three lexical tests to `packages/core/test/architecture.test.ts`. They read the config directly, so they run
today, before zod is installed. Load it without tripping `@typescript-eslint/no-require-imports` by not naming the
function `require`:

```ts
import { createRequire } from "node:module";
import { join } from "node:path";

const loadCjs = createRequire(import.meta.url);
const config = loadCjs(join(repoRoot, ".dependency-cruiser.cjs")) as {
  forbidden: {
    name: string;
    from?: { path?: string };
    to?: { path?: string; pathNot?: string; dependencyTypes?: string[] };
  }[];
  options: { exclude: { path: string } };
};
```

1. **the zod exception matches the pnpm store layout**: `new RegExp(rule.to.pathNot)` must match
`node_modules/zod/index.d.ts`, `node_modules/.pnpm/zod@4.6.7/node_modules/zod/index.d.ts` and
`../../node_modules/.pnpm/zod@4.6.7/node_modules/zod/index.d.ts`, and must not match
`node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.d.ts` or
`node_modules/.pnpm/zodfoo@1.0.0/node_modules/zodfoo/index.d.ts`.
2. **the source-dependency rule cannot go blind**: some forbidden rule with `from.path === "^packages/[^/]+/src"` must
have `"npm-no-pkg"` in its `to.dependencyTypes`. This single assertion is what Step 3 is about, and it would
have failed before it.
3. **the exclude cannot match inside node_modules**: `new RegExp(config.options.exclude.path)` must not match
`node_modules/.pnpm/vitest@5.0.3_@types+node@26/node_modules/vitest/dist/index.d.ts`, and must match
`packages/core/dist/index.js`.

- [ ] **Step 8: Prove each new assertion can fail, then commit**

For each of the three tests above, temporarily undo its Step 1, 2 or 3 fix and confirm exactly that test fails
(`pnpm vitest run --project core -t "<test name>"`), then restore it. Then:

Run: `pnpm lint`
Expected: exit 0.

Run: `pnpm exec depcruise packages --config .dependency-cruiser.cjs`
Expected: `✔ no dependency violations found`, exit 0.

Run: `pnpm test`
Expected: unchanged failures and no new ones. `packages/core/src` still does not exist, so the tree test fails with the
same cause as before — `Can't open 'packages/core/src'` — now with that text visible in the thrown message, and
`architecture.test.ts` goes from 1 test (1 failed) to 4 tests (3 passed, 1 failed). `architecture-guard.test.ts` still
fails on F3 and F4, which Task 5 fixes.

```bash
git add .dependency-cruiser.cjs eslint.config.js packages/core/test/architecture.test.ts
git commit -m "fix(architecture): keep the zod exception and the source-dependency rule alive under pnpm"
```

---
## Task 5: Test and build tooling

**Files:**
- Create: vitest.config.ts
- Create: packages/core/vitest.config.ts
- Create: packages/core/tsup.config.ts
- Modify: packages/core/test/architecture-guard.test.ts (make its fixture self-contained; Step 3)

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
  test: {
    name: "core",
    // architecture-guard.test.ts plants a node: import inside packages/core/src and architecture.test.ts
    // asserts that same directory is clean. Run concurrently, one file's probe is the other file's
    // violation, so the outcome would depend on timing instead of on the code.
    fileParallelism: false,
  },
});
```

- [ ] **Step 3: Make the guard fixture self-contained**

`packages/core/test/architecture-guard.test.ts` writes `packages/core/src/__probe.ts`, but `writeFileSync` does
not create parent directories and `packages/core/src` only starts to exist in Task 6. **MEASURED** at this task's
state, the file is red for the wrong reason — 2 of 2 tests failed, and the rule it exists to prove was never
exercised:

```
 ❯ packages/core/test/architecture-guard.test.ts (2 tests | 2 failed) 819ms
   × flags a node: import inside core/src 6ms
   × passes again once the probe is removed 811ms
Error: ENOENT: no such file or directory, open 'packages\\core\\src\\__probe.ts'
```

Create the directory when it is missing, and remove it again only if this fixture created it, so the test can
never delete a real source directory. Replace the two import lines and the first test with:

```ts
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
```

```ts
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
  });
```

`execFileSync`, `fileURLToPath`, `describe`, `expect` and `it` keep the imports they already have; only the two
lines above change. With `fileParallelism: false` from Step 2 and this fixture the pair is order-independent.
**MEASURED**: with `packages/core/src` present (Task 6's state) 3 of 3 tests pass, 3 of 3 runs; with it absent
(this task's state) exactly one test passes — `flags a node: import inside core/src` — and both
"directory is clean" assertions fail with `ERROR: Can't open 'packages/core/src' for reading. Does it exist?`,
3 of 3 runs, leaving no directory behind.

- [ ] **Step 4: Create packages/core/tsup.config.ts**

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

- [ ] **Step 5: Verify the versions, the configs' types, and that the projects config resolves**

Run: pnpm exec tsup --version
Expected: prints 8.x.x

Run: pnpm exec vitest --version
Expected: prints 5.x.x

Those two lines prove the tools are installed, not that the three files this task creates are usable. Nothing
has loaded them yet, and the next load is Task 6's test run, so a broken config would surface two tasks later
as a Task 6 defect. Type-check the configs directly — this needs no build output and no `src/`:

Run: pnpm exec tsc --noEmit --module esnext --moduleResolution bundler --target es2022 --skipLibCheck --types node vitest.config.ts packages/core/vitest.config.ts packages/core/tsup.config.ts
Expected: **exit code 0**, no output. **MEASURED** in a clean clone at this task's state. Negative control: a config
importing a name its module does not export fails with `error TS2305` and exit 1.

Run: pnpm lint
Expected: **exit code 0**. The three new files are new lint inputs, and this is what proves the boundary rules
and the Node-globals block do not reject them. **MEASURED**: `eslint .` with all three present, exit 0, no output.

Then prove the `projects` glob and the project name resolve, which is what Task 6 relies on:

Run: pnpm exec vitest run --project core
Expected: **exit code 1**, with `Test Files 2 failed (2)` and `Tests 2 failed | 1 passed (3)`, every test name
prefixed `|core|`, exactly one test passing — `flags a node: import inside core/src` from Step 3 — and both
failures being the "directory is clean" assertions with `ERROR: Can't open 'packages/core/src' for reading. Does it exist?`,
**MEASURED** 3 of 3 runs at this task's state.

That red is the correct red and not a defect: `packages/core/src` does not exist yet, so nothing can be found
clean about it, while the rule itself is now genuinely exercised and passes. Task 6 creates the directory, after
which Step 3's pair goes green. What this command proves here is that the `projects` glob expanded, the `core`
name resolved, and both test files were collected under it. **MEASURED** in the same clone with a `packages/core/src`
holding real files (Task 6's state): `Test Files 2 passed (2)`, `Tests 3 passed (3)`, exit 0, 3 of 3 runs. The wrong
reds look different: a malformed root config reports `failed to load config`, and `--project core` before this
task's Step 2 reports `No projects matched the filter "core".` — both measured.

Run: pnpm exec vitest run --project nope
Expected: exit code 1 with `No projects were found. Make sure your configuration is correct. The filter matched no projects: nope.` — **MEASURED** verbatim. This is the negative control: it shows the `--project` filter is really
matched against the config rather than ignored.

`packages/core/tsup.config.ts` cannot be loaded before Task 6 creates `packages/core/src/index.ts`, because its
`entry` points there, so the type-check above is the only verification it can have in this task. Task 6 Step 8's
`pnpm build` is its first real load.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts packages/core/vitest.config.ts packages/core/tsup.config.ts packages/core/test/architecture-guard.test.ts package.json pnpm-lock.yaml
git commit -m "build: add vitest and tsup configs and make the architecture guard self-contained"
```

---

## Task 6: The five packages

**Files:**
- Modify: tsconfig.base.json (Step 1)
- Create, for each of core, models, tools, exec-quickjs and react: packages/NAME/package.json,
  packages/NAME/vitest.config.ts, packages/NAME/tsup.config.ts, packages/NAME/src/index.ts,
  packages/NAME/src/version.ts, packages/NAME/test/smoke.test.ts
- Create, for the four packages other than core: packages/NAME/tsconfig.json and packages/NAME/tsconfig.test.json
  (core's two exist from Task 3; Step 7 says why every package needs its own)
- Modify: pnpm-lock.yaml (rewritten by Step 8's pnpm install; staged in Step 10)

- [ ] **Step 1: Make the type declarations buildable under TypeScript 6**

tsup's dts step always sets `baseUrl` (`baseUrl: compilerOptions.baseUrl || ".",` in tsup 8.5.1), and TypeScript
6.0.3 turned `baseUrl` into a deprecation **error**. Without a silence flag every `pnpm build` fails after the
ESM half has already succeeded, so `dist/index.js` exists, no `dist/index.d.ts` is written, and publint, attw and
the pack smoke test all fail later for a reason that looks unrelated:

```
DTS Build error
error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption
'"ignoreDeprecations": "6.0"' to silence this error.
Error: error occurred in dts build
```

Add the flag the compiler itself names to `tsconfig.base.json`, next to `moduleDetection`:

```json
    "moduleDetection": "force",
    "ignoreDeprecations": "6.0",
```

**MEASURED** in a clone with this exact base config, TypeScript 6.0.3 and tsup 8.5.1: without the flag tsup exits 1
and emits only `dist/index.js` and `dist/index.js.map`; with it all five packages report `ESM Build success` and
`DTS Build success`, every `dist/index.d.ts` is 117 bytes and declares `VERSION`, `publint --strict` says
`All good!` and `attw --pack . --profile esm-only` exits 0. `tsc --noEmit -p tsconfig.test.json` still exits 0, so the
flag does not disturb the type-check.
- [ ] **Step 2: Create packages/core/package.json**

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

- [ ] **Step 3: Create packages/core/src/version.ts**

```ts
/** Kept in sync with package.json by the release workflow. */
export const VERSION = "0.0.0";
```

- [ ] **Step 4: Write the smoke test**

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

- [ ] **Step 5: Create packages/core/src/index.ts to make it pass**

```ts
export { VERSION } from "./version.js";
```

- [ ] **Step 6: Run the tests**

Run: pnpm vitest run --project core
Expected: **MEASURED** `Test Files 3 passed (3)` and `Tests 4 passed (4)` — smoke 1, architecture 1, guard 2. If
the architecture test fails, its output names the offending import: fix the import, do not relax the rule.

- [ ] **Step 7: Create the other four packages from the same template**

Create the same six files for each package below. The only differences are the package name, the vitest
project name, the runtime dependencies and the tsup external list.

| package | package name | vitest project name | runtime dependencies | tsup external |
|---|---|---|---|---|
| models | @smolagents-ts/models | models | zod | ["zod"] |
| tools | @smolagents-ts/tools | tools | zod | ["zod"] |
| exec-quickjs | @smolagents-ts/exec-quickjs | exec-quickjs | zod, quickjs-emscripten-core, @jitl/quickjs-wasmfile-release-sync | ["zod", "quickjs-emscripten-core", "@jitl/quickjs-wasmfile-release-sync"] |
| react | @smolagents-ts/react | react | zod | ["zod", "react", "react-dom", "react/jsx-runtime"] |

Each package's `vitest.config.ts` is core's with the project name changed —
`defineProject({ test: { name: "models" } })` and so on — and each package's `tsup.config.ts` is core's with the
external array replaced by the column above. Core's two config files are written in Task 5, so read them
there; do not invent a different shape.

Every package except core also needs the two tsconfig files Task 3 wrote for core. They are byte-identical,
because both `extends` paths are relative to the package directory. **MEASURED**: the tree holds only
`packages/core/tsconfig.json` and `packages/core/tsconfig.test.json`, so a package whose typecheck script says
`tsc --noEmit -p tsconfig.test.json` without that file fails and takes `pnpm typecheck` down with it:

```
error TS5058: The specified path does not exist: 'packages/models/tsconfig.test.json'.
```

`packages/NAME/tsconfig.json`:

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

`packages/NAME/tsconfig.test.json`:

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

**MEASURED** in the clone: with all five in place, `tsc --noEmit -p packages/NAME/tsconfig.test.json` exits 0 for
core, models, tools, exec-quickjs and react.

Pin the dependency ranges; the table names packages but no versions. Use `"zod": "^4.0.0"` in every
package, and for exec-quickjs `"quickjs-emscripten-core": "^0.32.0"` with
`"@jitl/quickjs-wasmfile-release-sync": "^0.32.0"` — 0.32.0 is the version the validation report measured
`(quickjs-emscripten-core@0.32.0 is 2025-09-13+f1139494)` and it is still the published latest. `release-sync` is the
design's default; the asyncify build is only the fallback ladder at design §9.3, so do not substitute it.

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

- [ ] **Step 8: Install and run everything**

Run: pnpm install
Expected: no error; quickjs-emscripten-core and the chosen variant appear in pnpm-lock.yaml. Do not depend on
the all-in-one quickjs-emscripten package (roughly 7.5-9 MB installed); the core package plus one variant is
about 1.1-1.3 MB.

Run: pnpm test
Expected: **MEASURED** `Test Files 7 passed (7)` and `Tests 8 passed (8)`, 0 failures — five smoke tests plus the
three core architecture tests (one boundary, two guard).

- [ ] **Step 9: Verify every gate passes**

Run: pnpm typecheck
Expected: exit 0, no output. This is `pnpm -r run typecheck`, so each package's own `tsc --noEmit -p`
`tsconfig.test.json` must pass; Step 7's measured per-package runs are what this aggregates.

Run: pnpm build
Expected: five `dist/index.js` and five `dist/index.d.ts` files now exist. `pnpm build` is
`pnpm -r --filter ./packages/* run build`, so it runs each package's `tsup`; **MEASURED** by running `pnpm exec tsup`
in each package directory once Step 1 was applied: five `ESM Build success` and five `DTS Build success`. Verify with:
node -e "for (const p of ['core','models','tools','exec-quickjs','react']) { for (const f of ['dist/index.js','dist/index.d.ts']) { require('fs').accessSync('packages/'+p+'/'+f); } } console.log('all builds present')"
Expected: prints all builds present

Run: pnpm lint
Expected: exit 0.

Run: pnpm depcruise
Expected: prints "no dependency violations found (N modules, M dependencies cruised)".

- [ ] **Step 10: Commit**

```bash
git add tsconfig.base.json packages pnpm-lock.yaml
git commit -m "feat: add the five package skeletons and make type declarations buildable under TypeScript 6"
```

---

## Task 7: Changesets

**Files:**
- Create: .changeset/config.json
- Create: .changeset/README.md

- [ ] **Step 1: Create .changeset without running init**

`pnpm changeset init` cannot be used here. Measured against @changesets/cli 3.0.3: it asks `Should the GitHub
integration be used for changelogs?` and, with no TTY to answer, dies with `Detected unsettled top-level await`
and exit code 13. It exposes no non-interactive flag — `changeset init --help` lists only `-h, --help` — and it
builds the config from four prompts, including the publish-access list. Write the two files instead. The
config below is what `init` writes for "no GitHub changelog, public access, base branch main"; the README is the
file `init` copies verbatim out of `@changesets/cli`.

Run: New-Item -ItemType Directory -Force -Path .changeset | Out-Null
Run: node -e "const fs=require('node:fs'),path=require('node:path');const d=path.dirname(require.resolve('@changesets/cli/package.json'));fs.copyFileSync(path.join(d,'default-files/README.md'),'.changeset/README.md');console.log('README.md ' + fs.statSync('.changeset/README.md').size + ' bytes')"
Expected: `README.md 334 bytes`. **MEASURED** against @changesets/cli 3.0.3: the shipped
`default-files/README.md` is exactly 334 bytes. Copying it keeps the README byte-identical to what `init` would
have produced; there is no reason to retype it.

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

Write that to `.changeset/config.json`. There is nothing to replace: `init` is never run.

Note: @changesets/cli and @changesets/config are different majors (3.x and 4.x); the schema URL tracks the config
package @changesets/cli pulls in, and **MEASURED** the installed one is `@changesets/config@4.0.1`. It is a
transitive dependency, so it is not importable from the root by name; its version shows in the stack traces below.

- [ ] **Step 2: Verify the config is accepted, and that it rejects a bad one**

Run: pnpm changeset status
Expected: exit 0, printing an empty `Packages to be bumped:`

**MEASURED**: `🦋 changeset v3.0.3`, then `Packages to be bumped:` with nothing under it, exit 0. The empty list
is expected and is not evidence about the config: all five packages are `private: true` by design D12, and
changesets never reports private packages. **MEASURED**: adding a changeset naming `@smolagents-ts/core` and
re-running still printed an empty list, so the output alone cannot distinguish a valid config from one that failed
open. That is exactly why the two controls below matter..

On its own that proves only that changesets parsed the file; it cannot distinguish a valid config from one
that failed open. Measure the negative control — make the config invalid, confirm the non-zero exit, then put
the file back:

Run: Set-Content .changeset/config.json '{ not valid json' -Encoding utf8
Run: pnpm changeset status
Expected: exit 1 with a `SyntaxError` raised from `readConfig`. **MEASURED**:
`SyntaxError: Expected property name or '}' in JSON at position 2 (line 1 column 3)`, thrown from
`@changesets/config@4.0.1`'s `readConfig`, exit 1.

A well-formed but invalid value is caught as well: measured, `"access": "nonsense"` exits 1 with
`Found issues in your config: - access: Invalid type: Expected ("public" | "restricted")`.

Now restore the JSON block from Step 1 verbatim and run `pnpm changeset status` once more — expected exit 0.
The restore is part of the control: the file that gets committed must be the valid one, not the broken probe.

- [ ] **Step 3: Commit**

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
- Create: scripts/check-ci.mjs
- Create: .github/workflows/ci.yml
- Edit: package.json, pnpm-lock.yaml (adds the `yaml` devDependency and the `ci:check` script)

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

- [ ] **Step 2: Prove the gate can fail, then run it**

The negative control comes first, because a gate that cannot fail is not a gate. Running it "before pnpm build"
is no longer possible by Task 8 — Task 6 Step 8 already built all five packages — so move one package's output
aside instead, and require the literal message:

Run: Move-Item packages/core/dist .superpowers/hidden-core-dist
Run: node scripts/pack-smoke.mjs
Expected: FAIL, non-zero exit, with a message naming the core package — either `no tarball for core` (if
`pnpm pack` refuses an empty `files` list) or a module-resolution error out of the consumer's
`check.mjs` (if it packs anyway). Record which one it was, verbatim: that tells you where the gate caught it.

Run: Move-Item .superpowers/hidden-core-dist packages/core/dist
Run: pnpm build && node scripts/pack-smoke.mjs
Expected: prints "pack-smoke OK: 5 packages installed and imported from tarballs".

The hidden copy goes to `.superpowers/`, which is gitignored, so a forgotten restore cannot be committed. The
rest of this mechanism has been pre-validated against a real private scoped package: `pnpm pack` exits 0 and
names the tarball `smolagents-ts-core-0.0.0.tgz`; `npm install <tgz>` installs the tarball plus `zod` from the
registry (`added 2 packages`), after which `import { VERSION } from '@smolagents-ts/core'` resolves;
`publint --strict` reports `All good!`; and `attw --pack --profile esm-only` exits 0 with
`node16 (from ESM)` and `bundler` both green.

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
        # No version input. packageManager in package.json (pnpm@12.3.4) is the single source of truth, and
        # action-setup reads it for pnpm 11+. Pinning 10 here contradicted packageManager and would install
        # with a pnpm older than the one that wrote the lockfile.
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
      - run: pnpm ci:check
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
        # No version input. packageManager in package.json (pnpm@12.3.4) is the single source of truth, and
        # action-setup reads it for pnpm 11+. Pinning 10 here contradicted packageManager and would install
        # with a pnpm older than the one that wrote the lockfile.
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

- [ ] **Step 5: Verify the workflow file structurally, and pin its pnpm version to packageManager**

A regex for `name: CI` would pass on a workflow that installs the wrong package manager, which is exactly the
defect this step exists to catch: the workflow pinned pnpm 10 while `packageManager` requires 12.3.4. Parse the
YAML and assert the facts instead.

Run: pnpm add -Dw yaml
Expected: `yaml` appears in the root package.json devDependencies.

Create `scripts/check-ci.mjs`:

```js
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
```

Then edit the root `package.json`: add `"ci:check": "node scripts/check-ci.mjs"` to `scripts`, and
insert `&& pnpm ci:check` immediately before `&& pnpm pack:smoke` in the `gate` script.

Run: pnpm ci:check
Expected: prints "ci:check OK: 2 jobs, node 22/24/26, runtime node/bun/deno, pnpm 12.3.4"

- [ ] **Step 6: Run the whole gate**

Run: pnpm gate
Expected: every stage exits 0 and the final line is
"pack-smoke OK: 5 packages installed and imported from tarballs".

- [ ] **Step 7: Commit**

```bash
git add scripts/pack-smoke.mjs scripts/runtime-smoke.mjs scripts/check-ci.mjs .github/workflows/ci.yml package.json pnpm-lock.yaml
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
