# S6 — the distribution Implementation Plan

## Contract

- **Role:** the implementation plan for milestone S6 of
  `docs/design/2026-10-12-smolagents-ts-v1-design.md`.
- **Mutability:** once execution starts the steps below are frozen: a step that
  turned out wrong gets a note under the task that owns it, and the step's own
  text is not rewritten. Measured results are appended at the end.
- **Read when:** executing S6, or reviewing what S6 was supposed to deliver.
- **Update when:** a task's measured result differs from its prediction, or a
  task is added or dropped.

**Goal:** make the project installable as one published package — the five
internal packages gain the metadata a registry needs, a new `smolagents-ts`
facade re-exports them under the design's subpaths, the packed tarballs are
proven to install and import, and the first version is cut with a changelog —
while the publish itself stays the owner's gate.

**Architecture:** the design's section 5.2 asks for one installable package
assembled from the internal ones, with React and the heavy backends as optional
peers and zod as the only runtime dependency. The spike measured that an
umbrella which *inlines* the internal packages cannot publish honest types with
this toolchain: tsup bundles the runtime but keeps `@smolagents-ts/*` external
in the `.d.ts` files under `dts: true`, `dts: { resolve: true }` and
`dts: { resolve: [...] }` alike, so the declarations would name packages a
consumer does not have. S6 therefore publishes the internal packages beside the
facade and lets the facade re-export them: `smolagents-ts` is the documented
entry point, one install pulls the rest, and every declaration resolves to a
package that exists on the registry. The divergence is recorded as decision
0006. The facade's entries are thin (`export * from "@smolagents-ts/core"`), so
it has no runtime of its own and no build order of its own beyond its
dependencies'.

**Tech Stack:** pnpm 12.3.4 workspaces, TypeScript 6, tsup 8.5.1 (ESM only),
changesets 3 with a `fixed` group, publint, `@arethetypeswrong/cli` with
`--profile esm-only`, vitest 5, the existing `scripts/pack-smoke.mjs`.

**Spec:** design section 5.2 (distribution shape, D12), section 5.1 (repository
layout), section 14 (the S6 row); `docs/01-project.md`'s S6 row; decision 0006.

**Depends on:** S0–S5, all done. Nothing here changes the core, models, tools,
exec-quickjs or react sources; every task touches manifests, packaging, docs, or
a new package.

**Dependency order:** 1 → 2 → 3 → 4 → 5 → 8, and 6 → 7, with 6 and 7 free to
land between any of the others. Task 2 needs task 1's decision only for its
prose; task 5 needs task 1 and task 2 in place; task 8 needs everything.

**Task ownership:** one writer at a time. Tasks 1, 4, 5 and 8 own
`packages/*/package.json`, `scripts/` and `.changeset/`; tasks 2 and 3 own
`packages/smolagents-ts/**` plus the root `AGENTS.md` component table; tasks 6
and 7 own `examples/**` and `README.md`. No two tasks in this plan share a file.

## Spike findings (measured 2026-10-14)

The spike built the facade, packed it, and pointed the toolchain at it before
this plan was written. Each row names the measurement, not a belief.

| # | Question | Measurement | Finding |
|---|---|---|---|
| F1 | Does tsup inline the internal packages into the facade's declarations? | `pnpm --filter smolagents-ts build` with `noExternal: [/^@smolagents-ts\//]`: the JS bundled (a 66.20 KB shared chunk), but `dist/index.d.ts` stayed 37 bytes of `export * from '@smolagents-ts/core';` — unchanged under `dts: true`, `dts: { resolve: true }` and `dts: { resolve: [...] }` | Inlining is a runtime-only story here; the facade's types must resolve to published packages, so the internal packages get published |
| F2 | Does a facade that re-exports its dependencies build and pass the packaging gates? | `pnpm --filter smolagents-ts build` exit 0 (each entry ~105 B), `publint` "All good!", `attw --pack . --profile esm-only` exit 0 | The thin facade is the shape that passes |
| F3 | Does `pnpm pack` rewrite the `workspace:*` ranges, and does `publishConfig.dependencies` override them? | The tarball's manifest reads `"@smolagents-ts/core": "0.0.0"` … five entries, plus `"zod": "^4.0.0"`; the `publishConfig.dependencies` override had no effect | The workspace ranges are rewritten to the current version; the override is inert and is not carried into the plan |
| F4 | Can one tsconfig serve both the build and the typecheck? | With the internal packages mapped to their sources, the dts build failed `TS6059` ("not under rootDir"), and with the sources excluded the typecheck failed the same way because `pnpm typecheck` runs before `pnpm build` | The facade needs two configs: the build resolves through `node_modules`, the typecheck maps the five sources and widens `rootDir` |
| F5 | Does a new package join the test run on its own? | `pnpm vitest run --project smolagents-ts` exit 0, 1 file and 1 test — after the package gained a `vitest.config.ts`, because the root config's `projects` is the glob `packages/*` | A new package needs its own project config, and its own test file |
| F6 | Do the architecture and lint gates accept the new package? | `pnpm lint` exit 0; `pnpm depcruise` "no dependency violations found (157 modules, 388 dependencies cruised)" | No rule change is needed for the facade; its imports are declared dependencies |
| F7 | Does the pack smoke cover a package named without a scope? | `scripts/pack-smoke.mjs` matches tarballs by `"smolagents-ts-" + name + "-"`, so the facade's tarball (`smolagents-ts-0.0.0.tgz`) matches no name in the list | Task 4 gives the facade its own tarball matcher and its own subpath imports |

## Spec coverage

| Design line | What it asks for | Where it lands |
|---|---|---|
| 5.2 | One installable package, `smolagents-ts`, assembled from the internal packages | Task 2, with the divergence recorded in decision 0006 |
| 5.2 | The `exports` map: `.`, `./models`, `./tools`, `./exec/quickjs`, `./react`, `./package.json` | Task 2 |
| 5.2 | ESM-only, no legacy fields; React an optional peer; heavy backends behind subpaths | Task 2 keeps the shape; task 1 keeps the internal peers |
| 5.2 | `dependencies: { "zod": "^4.0.0" }` | Diverged: the five internal packages are dependencies too (F1). Decision 0006 |
| 5.2 | `./models/anthropic` and its siblings | Dropped: the models package ships one barrel with `sideEffects: false`, so a bundler tree-shakes it. Decision 0006 |
| 5.2 | Backwards compatibility enforced by publint and attw in CI | Tasks 1, 2 and 4 put both gates over the tarballs; task 8 runs them |
| 5.1 | `examples/node-script` — server/CLI usage | Task 6 |
| 5.1 | `examples/vite-app`, `examples/next-app` — browser and SSR usage | Deferred with T-12, which owns the React example and its host |
| 14 | S6: CLI, MCP, remote executors, `exec-pyodide`, docs site, L4/L5 | Deferred to T-13, because 5.1 and 10.3 name those packages v1.5+ and L4 after v1 |
| 14 | S6: public publish | Owner gate, T-14 |
| 3.1 | LICENSE and NOTICE travel with what is published | Task 1 |
| 15 | The README's first line is frozen | Task 7 adds sections below it and edits nothing above |

## File structure

| Path | Responsibility |
|---|---|
| `scripts/copy-licence.mjs` (new) | copies `LICENSE` and `NOTICE` into a package before it is packed, and removes the copies after |
| `packages/*/package.json` (5 modified) | registry metadata: description, keywords, licence, engines, access, `files`, the prepack hooks |
| `packages/smolagents-ts/package.json` (new) | the facade: the design's `exports` map, the five dependencies, zod, the optional peers |
| `packages/smolagents-ts/src/**` (new) | five one-line re-exports, one per subpath |
| `packages/smolagents-ts/tsup.config.ts` (new) | five entries, ESM, declarations, no bundling of the dependencies |
| `packages/smolagents-ts/tsconfig.json`, `tsconfig.test.json` (new) | the build config and the widened typecheck config (F4) |
| `packages/smolagents-ts/vitest.config.ts` (new) | the package's own test project (F5) |
| `packages/smolagents-ts/test/surface.test.ts` (new) | pins the five subpaths and the names they carry |
| `packages/smolagents-ts/AGENTS.md` (new) | the scoped entry the pack requires of a component |
| the facade's rule file under `rules/components/` (new) | the component's rule file |
| `AGENTS.md` (modified) | the component-table row for the facade |
| `scripts/pack-smoke.mjs` (modified) | packs and imports the facade's subpaths |
| `.changeset/config.json` (modified) | the `fixed` group that keeps the six versions together |
| `.changeset/s6-first-release.md` (new) | the minor changeset that cuts 0.1.0 |
| `examples/node-script/**` (new) | a runnable Node example and its test |
| `vitest.config.ts` (modified) | the projects glob gains `examples/*` |
| `package.json` (modified) | the `example:node` script |
| `README.md` (modified) | Install and Quick start, below the frozen first line |
| `docs/09-decisions/0006-*.md`, its README row (new) | the two divergences from 5.2 |
| `docs/01-project.md`, `docs/04-tasks.md`, `docs/03-handoff.md`, `docs/tasks/archive-2026.md` | the milestone's records (task 8) |

## Tasks

### Task 1: the five internal packages become publishable

**Files:**
- Create: `scripts/copy-licence.mjs`
- Modify: `packages/core/package.json`, `packages/models/package.json`, `packages/tools/package.json`, `packages/exec-quickjs/package.json`, `packages/react/package.json`
- Modify: `.gitignore` (the generated copies)

- [ ] **Step 1: Write the licence copier**

Create `scripts/copy-licence.mjs`:

```js
#!/usr/bin/env node
/**
 * Copy LICENSE and NOTICE into a package before it is packed, and remove them
 * afterwards. npm packs only files under the package directory, so the copies
 * are the only way the published tarball can carry the licence text; they are
 * generated, gitignored, and never edited by hand.
 *
 * Usage: node scripts/copy-licence.mjs <copy|clean> <package directory>
 */
import { copyFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const [action, target] = process.argv.slice(2);
if ((action !== "copy" && action !== "clean") || target === undefined) {
  console.error("usage: node scripts/copy-licence.mjs <copy|clean> <package directory>");
  process.exit(2);
}

const packageDir = resolve(target);
for (const name of ["LICENSE", "NOTICE"]) {
  const destination = join(packageDir, name);
  if (action === "copy") {
    copyFileSync(join(ROOT, name), destination);
  } else if (existsSync(destination)) {
    rmSync(destination);
  }
}
```

- [ ] **Step 2: Add the metadata to core**

In `packages/core/package.json`, remove `"private": true` and add these fields beside `"sideEffects"`:

```json
  "description": "The runtime: the agent loop, its memory and steps, the event stream, the typed errors, the prompt templates, the tool, executor and model interfaces, AgentSession, middleware and the Monitor.",
  "keywords": ["smolagents", "agents", "ai", "llm", "typescript", "agent-loop"],
  "license": "Apache-2.0",
  "engines": { "node": ">=22.12" },
  "publishConfig": { "access": "public" },
```

and change `files` and `scripts` to:

```json
  "files": ["dist", "LICENSE", "NOTICE"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit -p tsconfig.test.json",
    "prepack": "node ../../scripts/copy-licence.mjs copy .",
    "postpack": "node ../../scripts/copy-licence.mjs clean ."
  },
```

- [ ] **Step 3: Repeat for the other four, with their own descriptions**

Same three edits in each of `packages/models/package.json`, `packages/tools/package.json`, `packages/exec-quickjs/package.json` and `packages/react/package.json`, with these descriptions and keywords:

| package | description | keywords |
|---|---|---|
| `@smolagents-ts/models` | "Provider adapters behind the core's Model interface: OpenAI-compatible, Anthropic, Gemini, Hugging Face and a model defined by functions." | `["smolagents", "llm", "openai", "anthropic", "gemini", "huggingface"]` |
| `@smolagents-ts/tools` | "The default tools and the collection that assembles them, each built with the core's tool() and a Zod schema." | `["smolagents", "agents", "tools", "web-search"]` |
| `@smolagents-ts/exec-quickjs` | "The default CodeExecutor: agent-authored JavaScript in a QuickJS-WASM realm, with the async tool-call bridge." | `["smolagents", "code-execution", "quickjs", "wasm", "sandbox"]` |
| `@smolagents-ts/react` | "The L2 hooks and L3 headless primitives that render an AgentSession: AgentRun, AgentStep, unstyled and accessible." | `["smolagents", "react", "hooks", "headless", "agents"]` |

The react package keeps its existing `peerDependencies`, `peerDependenciesMeta` and `devDependencies` blocks unchanged.

- [ ] **Step 4: Ignore the generated copies**

Append to `.gitignore`:

```text
packages/*/LICENSE
packages/*/NOTICE
```

- [ ] **Step 5: Pack one package and read the tarball's manifest**

Run: `pnpm --filter @smolagents-ts/core pack --pack-destination .superpowers/spike`
Expected: exit 0, and `tar -xOf .superpowers/spike/smolagents-ts-core-0.0.0.tgz package/package.json` shows `"license": "Apache-2.0"`, `"publishConfig": { "access": "public" }` and no `"private"` key. `tar -tzf` the same tarball lists `package/LICENSE` and `package/NOTICE`.

- [ ] **Step 6: Confirm the copies are gone and the gates still pass**

Run: `git status --short packages`
Expected: no `LICENSE` or `NOTICE` line under `packages/`, because `postpack` removed them.

Run: `pnpm publint && pnpm attw`
Expected: every package reports "All good!" and attw exits 0 for all five.

- [ ] **Step 7: Commit**

```bash
git add scripts/copy-licence.mjs .gitignore packages
git commit -F .superpowers/commit-msg.txt
```

with `.superpowers/commit-msg.txt` holding:

```text
chore(release): make the five internal packages publishable

Each package gains the fields a registry reads: a description, keywords, the
Apache-2.0 licence, the Node floor, public access for the scoped name, and the
two licence files in its tarball. A prepack hook copies LICENSE and NOTICE into
the package directory and a postpack hook removes them again, so the copies are
generated rather than a second home for the text.

The packages stay version 0.0.0 until task 5 cuts the first release.
```

### Task 2: the smolagents-ts facade

**Files:**
- Create: `packages/smolagents-ts/package.json`, `tsup.config.ts`, `tsconfig.json`, `tsconfig.test.json`, `vitest.config.ts`
- Create: `packages/smolagents-ts/src/index.ts`, `src/models/index.ts`, `src/tools/index.ts`, `src/exec/quickjs.ts`, `src/react/index.ts`
- Create: `packages/smolagents-ts/test/surface.test.ts`

- [ ] **Step 1: Write the failing surface test**

Create `packages/smolagents-ts/test/surface.test.ts`:

```ts
import { expect, test } from "vitest";

import * as core from "../src/index.js";
import * as quickjs from "../src/exec/quickjs.js";
import * as models from "../src/models/index.js";
import * as react from "../src/react/index.js";
import * as tools from "../src/tools/index.js";

/** The five subpaths the design's section 5.2 promises, and the package each re-exports. */
const SUBPATHS = {
  ".": core,
  "./models": models,
  "./tools": tools,
  "./exec/quickjs": quickjs,
  "./react": react,
} as const;

test("every subpath re-exports its package's public surface", () => {
  for (const [subpath, surface] of Object.entries(SUBPATHS)) {
    expect(Object.keys(surface).length, subpath + " re-exports nothing").toBeGreaterThan(0);
  }
});

test("the facade adds no name of its own", () => {
  // A name that is not a package's own export would mean the facade is
  // growing a surface the design did not ask for.
  for (const [subpath, surface] of Object.entries(SUBPATHS)) {
    for (const name of Object.keys(surface)) {
      expect(name, subpath + " exports " + name).not.toBe("default");
    }
  }
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `pnpm vitest run --project smolagents-ts`
Expected: FAIL — the project does not exist yet, so vitest reports that no project matches, or the imports do not resolve.

- [ ] **Step 3: Write the five entries**

`packages/smolagents-ts/src/index.ts`:

```ts
export * from "@smolagents-ts/core";
```

`packages/smolagents-ts/src/models/index.ts`:

```ts
export * from "@smolagents-ts/models";
```

`packages/smolagents-ts/src/tools/index.ts`:

```ts
export * from "@smolagents-ts/tools";
```

`packages/smolagents-ts/src/exec/quickjs.ts`:

```ts
export * from "@smolagents-ts/exec-quickjs";
```

`packages/smolagents-ts/src/react/index.ts`:

```ts
export * from "@smolagents-ts/react";
```

- [ ] **Step 4: Write the manifest**

Create `packages/smolagents-ts/package.json`:

```json
{
  "name": "smolagents-ts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "description": "Agents that think in code, natively in TypeScript: the agent runtime, the provider adapters, the default tools, the QuickJS executor and the React layer under one name.",
  "keywords": ["smolagents", "agents", "ai", "llm", "typescript", "code-generation"],
  "license": "Apache-2.0",
  "engines": { "node": ">=22.12" },
  "publishConfig": { "access": "public" },
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./models": { "types": "./dist/models/index.d.ts", "default": "./dist/models/index.js" },
    "./tools": { "types": "./dist/tools/index.d.ts", "default": "./dist/tools/index.js" },
    "./exec/quickjs": { "types": "./dist/exec/quickjs.d.ts", "default": "./dist/exec/quickjs.js" },
    "./react": { "types": "./dist/react/index.d.ts", "default": "./dist/react/index.js" },
    "./package.json": "./package.json"
  },
  "files": ["dist", "LICENSE", "NOTICE"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit -p tsconfig.test.json",
    "prepack": "node ../../scripts/copy-licence.mjs copy .",
    "postpack": "node ../../scripts/copy-licence.mjs clean ."
  },
  "dependencies": {
    "@smolagents-ts/core": "workspace:*",
    "@smolagents-ts/models": "workspace:*",
    "@smolagents-ts/tools": "workspace:*",
    "@smolagents-ts/exec-quickjs": "workspace:*",
    "@smolagents-ts/react": "workspace:*",
    "zod": "^4.0.0"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18",
    "quickjs-emscripten-core": "^0.32.0",
    "@jitl/quickjs-wasmfile-release-sync": "^0.32.0"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "react-dom": { "optional": true }
  }
}
```

`private` stays `true` until task 5; a private package still packs and still runs through publint, attw and the pack smoke.

- [ ] **Step 5: Write the two tsconfigs and the tsup config**

`packages/smolagents-ts/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist",
    "paths": {}
  },
  "include": ["src"]
}
```

The empty `paths` overrides the base mapping of `@smolagents-ts/core` to core's source, so the build resolves every internal package through `node_modules`, where the workspace links it to its built output.

`packages/smolagents-ts/tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node"],
    "noEmit": true,
    "rootDir": "../..",
    "paths": {
      "@smolagents-ts/core": ["../core/src/index.ts"],
      "@smolagents-ts/models": ["../models/src/index.ts"],
      "@smolagents-ts/tools": ["../tools/src/index.ts"],
      "@smolagents-ts/exec-quickjs": ["../exec-quickjs/src/index.ts"],
      "@smolagents-ts/react": ["../react/src/index.ts"]
    }
  },
  "include": ["src", "test"]
}
```

The typecheck runs before the build in the gate, so it reads the five sources; that widens the program past this package and needs the wider `rootDir` (F4).

`packages/smolagents-ts/tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

// Each entry is a thin re-export of the package that owns the code: the
// internal packages are published beside this one, so bundling them here would
// duplicate their runtime and their declarations.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "models/index": "src/models/index.ts",
    "tools/index": "src/tools/index.ts",
    "exec/quickjs": "src/exec/quickjs.ts",
    "react/index": "src/react/index.ts"
  },
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false
});
```

- [ ] **Step 6: Write the vitest project**

Create `packages/smolagents-ts/vitest.config.ts`:

```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "smolagents-ts"
  }
});
```

- [ ] **Step 7: Install, build, typecheck and test**

Run: `pnpm install --no-frozen-lockfile`
Expected: "Scope: all 7 workspace projects", exit 0.

Run: `pnpm --filter smolagents-ts build`
Expected: five entries, each under 200 bytes, plus a `.d.ts` per entry; exit 0.

Run: `pnpm --filter smolagents-ts typecheck`
Expected: exit 0.

Run: `pnpm vitest run --project smolagents-ts`
Expected: 1 file, 2 tests, exit 0.

- [ ] **Step 8: Put the tarball through both packaging gates**

Run: `pnpm --filter smolagents-ts exec publint`
Expected: "All good!" and exit 0.

Run: `pnpm --filter smolagents-ts exec attw --pack . --profile esm-only`
Expected: every subpath green, exit 0.

- [ ] **Step 9: Commit**

```text
feat(release): add the smolagents-ts facade

The design's distribution shape asks for one installable package over the
internal ones. Its five entries are thin re-exports — the runtime, the provider
adapters, the default tools, the QuickJS executor and the React layer — and its
exports map carries the subpaths section 5.2 promises. publint and attw pass on
the packed tarball, and the package's own vitest project pins the five subpaths.
```

### Task 3: the facade is a pack component

**Files:**
- Create: `packages/smolagents-ts/AGENTS.md`, the facade's rule file under `rules/components/`
- Modify: `AGENTS.md` (the component table)

- [ ] **Step 1: Write the component rule**

Create the component's rule file under `rules/components/`, named for the component id:

```md
# Component rule: smolagents-ts

**The facade owns no implementation.**
Every name it exports comes from a package that owns it, and its entries carry
no logic. A behaviour that needs code here belongs in the package that owns the
name, and the facade re-exports it afterwards.

**One published name per package.**
The facade is the documented entry point; the internal packages are published
because the declarations must resolve, not because a caller should import them.
A new subpath is added to the exports map and to the surface test in the same
change.

**A version is cut for all six together.**
The facade depends on the internal packages, so their versions move as one
group through the changeset fixed group; a release that moves one and not the
others publishes a manifest whose ranges no longer match what shipped.
```

- [ ] **Step 2: Add the row to the component table**

In the root `AGENTS.md`, append to the component table, keeping the column order:

```md
| smolagents-ts | `packages/smolagents-ts/` | `packages/smolagents-ts/AGENTS.md` | `rules/components/<id>.md` |
```

- [ ] **Step 3: Write the scoped entry**

Create `packages/smolagents-ts/AGENTS.md`:

```md
# smolagents-ts — scoped entry

## What this component is

`smolagents-ts` is the package a caller installs. It holds no implementation:
each of its five entries re-exports one internal package — the core runtime at
the root, `./models`, `./tools`, `./exec/quickjs` and `./react` — so one install
carries the whole stack and every declaration resolves. It is the documented
entry point; the internal packages are published beside it because its
declarations name them.

## Entry points

| entry point | path | notes |
|---|---|---|
| root | `src/index.ts` | re-exports `@smolagents-ts/core` |
| models | `src/models/index.ts` | re-exports `@smolagents-ts/models` |
| tools | `src/tools/index.ts` | re-exports `@smolagents-ts/tools` |
| executor | `src/exec/quickjs.ts` | re-exports `@smolagents-ts/exec-quickjs` |
| react | `src/react/index.ts` | re-exports `@smolagents-ts/react` |
| surface test | `test/surface.test.ts` | pins the five subpaths |

## Smallest validation command

    pnpm vitest run --project smolagents-ts

Expected result: 1 file and 2 tests pass, exit code 0. The packaging gates are
the other half: `pnpm --filter smolagents-ts exec publint` and
`pnpm --filter smolagents-ts exec attw --pack . --profile esm-only`.

## Boundaries

This component owns the exports map, the subpath entries and the published
name. It owns no runtime behaviour and no type of its own: every name belongs to
the package that implements it, and a name added here without a home there is a
defect.

## Hazards

- The build config resolves the internal packages through `node_modules` while
  the typecheck config maps them to their sources, because the gate typechecks
  before it builds. Changing one config without the other breaks one of the two.
- `react-dom` is an optional peer that nothing imports; the pack smoke installs
  React from the workspace but not `react-dom`, whose `scheduler` dependency
  would need the registry.
- `pnpm pack` rewrites the `workspace:*` ranges to the current version, so a
  tarball packed before the fixed-group bump pins the old version.
- The pack smoke matches tarballs by name, and this package's name is not
  scoped; its tarball needs its own matcher in `scripts/pack-smoke.mjs`.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule: the file in
`rules/components/` named for this component's id.
```

- [ ] **Step 4: Validate the pack**

Run: `python scripts/validate_context.py --root . --json --baseline docs/.baseline.json`
Expected: `new: []`, `baselined: 14`, 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```text
docs(pack): register the facade as a component

A new package is a new component: it gets a scoped entry, a row in the router's
component table, and a rule file. The rule says the facade owns no
implementation and that the six versions move together.
```

### Task 4: the pack smoke covers the facade

**Files:**
- Modify: `scripts/pack-smoke.mjs`

- [ ] **Step 1: Pack the facade too**

In `scripts/pack-smoke.mjs`, add beside the existing `PACKAGES` constant:

```js
const FACADE = "smolagents-ts";
```

and pack it as well:

```js
for (const name of [...PACKAGES, FACADE]) {
  run("pnpm", ["pack", "--pack-destination", workspace], join(ROOT, "packages", name));
}
```

- [ ] **Step 2: Give the facade its own matcher**

Replace the tarball lookup with one that handles the unscoped name:

```js
const found = readdirSync(workspace).filter((f) => f.endsWith(".tgz"));
const tarballFor = (prefix) => {
  const match = found.find((f) => f.startsWith(prefix));
  if (!match) {
    throw new Error("no tarball for " + prefix + "; found: " + found.join(", "));
  }
  return join(workspace, match);
};
const tarballs = [
  ...PACKAGES.map((name) => tarballFor("smolagents-ts-" + name + "-")),
  tarballFor(FACADE + "-"),
];
```

- [ ] **Step 3: Import every facade subpath in the consumer**

After the per-package imports, add the facade's subpaths to the generated `check.mjs`:

```js
const facadeImports = [
  "import { VERSION as facadeVersion } from 'smolagents-ts';",
  "import * as facadeModels from 'smolagents-ts/models';",
  "import * as facadeTools from 'smolagents-ts/tools';",
  "import * as facadeQuickjs from 'smolagents-ts/exec/quickjs';",
  "import * as facadeReact from 'smolagents-ts/react';",
];
const facadeAssertions = [
  "if (typeof facadeVersion !== 'string') throw new Error('bad export from smolagents-ts');",
  "for (const [name, surface] of Object.entries({ models: facadeModels, tools: facadeTools, quickjs: facadeQuickjs, react: facadeReact })) {",
  "  if (Object.keys(surface).length === 0) throw new Error('smolagents-ts/' + name + ' re-exports nothing');",
  "}",
];
```

and join them into the file the consumer runs, beside the existing lines.

- [ ] **Step 4: Report six packages**

Change the final message to:

```js
console.log("pack-smoke OK: " + (PACKAGES.length + 1) + " packages installed and imported from tarballs");
```

- [ ] **Step 5: Run it**

Run: `pnpm pack:smoke`
Expected: `pack-smoke OK: 6 packages installed and imported from tarballs`, exit 0.

- [ ] **Step 6: Commit**

```text
test(release): install and import the facade from its tarball

The pack smoke now packs the facade beside the five internal packages, gives
its unscoped tarball name its own matcher, and imports every subpath the exports
map promises — including the QuickJS executor, which needs its engine peers to
resolve.
```

### Task 5: cut the first version

**Files:**
- Modify: `.changeset/config.json`
- Create: `.changeset/s6-first-release.md`
- Modify: the six `package.json` versions and the new `CHANGELOG.md` files (by command)

- [ ] **Step 1: Put the six packages in one fixed group**

In `.changeset/config.json`, replace `"fixed": []` with:

```json
  "fixed": [
    [
      "@smolagents-ts/core",
      "@smolagents-ts/models",
      "@smolagents-ts/tools",
      "@smolagents-ts/exec-quickjs",
      "@smolagents-ts/react",
      "smolagents-ts"
    ]
  ],
```

- [ ] **Step 2: Write the changeset**

Create `.changeset/s6-first-release.md`:

```md
---
"@smolagents-ts/core": minor
"@smolagents-ts/models": minor
"@smolagents-ts/tools": minor
"@smolagents-ts/exec-quickjs": minor
"@smolagents-ts/react": minor
"smolagents-ts": minor
---

The first release: an agent whose action is a program, in TypeScript.

`smolagents-ts` is the package to install. It re-exports the runtime, the
provider adapters, the default tools, the QuickJS executor and the React layer
under one name, with React and the QuickJS engine as optional peers. The
internal packages are published beside it because its declarations name them;
they are not the documented entry point.

This release is pre-1.0 and its API can move. It is an unofficial TypeScript
implementation of the smolagents approach and is not affiliated with Hugging
Face.
```

- [ ] **Step 3: Apply the version bump**

Run: `pnpm changeset version`
Expected: the six manifests read `"version": "0.1.0"`, each package gains a `CHANGELOG.md`, and `private: true` is removed from the facade's manifest.

- [ ] **Step 4: Confirm the group moved together**

Run: `git diff --stat` and then, in PowerShell, `Get-ChildItem packages -Recurse -Filter package.json | Select-String '"version"'`
Expected: six `0.1.0` lines, and the facade's `dependencies` pin the five at `0.1.0` rather than `workspace:*`.

- [ ] **Step 5: Re-run the packaging gates on the bumped tree**

Run: `pnpm build && pnpm publint && pnpm attw && pnpm pack:smoke`
Expected: all exit 0, and the pack smoke still reports six packages.

- [ ] **Step 6: Commit**

```text
chore(release): cut 0.1.0 for the six packages

A fixed group keeps the facade and the five packages it re-exports on one
version, so a release can never publish a facade whose ranges point at a
version that did not ship. The changeset's body is what a reader sees in the
changelogs.
```

### Task 6: a runnable Node example

**Files:**
- Create: `examples/node-script/package.json`, `examples/node-script/index.mjs`, `examples/node-script/vitest.config.ts`, `examples/node-script/test/example.test.ts`
- Modify: `vitest.config.ts`, `package.json` (the `example:node` script)

- [ ] **Step 1: Write the example**

Create `examples/node-script/index.mjs`:

```js
#!/usr/bin/env node
/**
 * The smallest complete run: a CodeAgent whose model writes one program, a tool
 * the program calls, and the QuickJS executor that runs it. The model is
 * scripted, so the example needs no provider and no network; the executor is
 * the real one.
 *
 * Run: pnpm example:node
 */
import { CODE_FENCE, CodeAgent, MockModel, tool } from "smolagents-ts";
import { QuickJSExecutor } from "smolagents-ts/exec/quickjs";
import { z } from "zod";

const greet = tool({
  name: "greet",
  description: "Greet one person by name.",
  inputSchema: z.object({ name: z.string() }),
  execute: ({ name }) => "Hello, " + name + "!",
});

const program = [
  "const message = await greet({ name: \"world\" });",
  "final_answer(message);",
].join("\n");

const model = new MockModel([
  "Thought: greet the caller, then answer with the greeting.\nCode:\n" + CODE_FENCE + "\n" + program + "\n" + CODE_FENCE,
]);

export async function main() {
  const agent = new CodeAgent({
    model,
    executor: new QuickJSExecutor(),
    tools: [greet],
  });
  const result = await agent.run("Greet the world.");
  return result.output;
}

if (import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  const output = await main();
  console.log(output);
}
```

The agent and tool option names come from the S4 golden transcript and the
react fixtures; if a name differs, fix the example and note it under this task.

- [ ] **Step 2: Write its test**

Create `examples/node-script/test/example.test.ts`:

```ts
import { expect, test } from "vitest";

import { main } from "../index.mjs";

test("the example answers through a tool call in the sandbox", async () => {
  await expect(main()).resolves.toBe("Hello, world!");
});
```

- [ ] **Step 3: Write its project and manifest**

Create `examples/node-script/vitest.config.ts`:

```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "example-node-script"
  }
});
```

Create `examples/node-script/package.json`:

```json
{
  "name": "example-node-script",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node index.mjs"
  },
  "dependencies": {
    "smolagents-ts": "workspace:*",
    "zod": "^4.0.0"
  }
}
```

- [ ] **Step 4: Let the runner see the example**

In the root `vitest.config.ts`, change the projects glob:

```ts
    projects: ["packages/*", "examples/*"],
```

In the root `package.json`, add to `scripts`:

```json
    "example:node": "node examples/node-script/index.mjs",
```

- [ ] **Step 5: Install and run it**

Run: `pnpm install --no-frozen-lockfile`
Expected: "Scope: all 8 workspace projects", exit 0.

Run: `pnpm example:node`
Expected: `Hello, world!` on one line, exit 0.

Run: `pnpm vitest run --project example-node-script`
Expected: 1 file, 1 test, exit 0.

- [ ] **Step 6: Commit**

```text
docs(examples): add a runnable node example

The example is the whole stack in one file: the facade's root subpath for the
agent, its executor subpath for the sandbox, and one tool. The model is
scripted, so it runs offline, and its test runs the same function the script
does.
```

### Task 7: the README quickstart

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the sections below the frozen first line**

Insert between `## Status` and `## Licence`:

```md
## Install

Until the first release is on the registry, run the example in this repository:

    pnpm install
    pnpm example:node

The published name is `smolagents-ts`; the internal packages are published
beside it because its declarations name them, but they are not the entry point.

## Quick start

```ts
import { CODE_FENCE, CodeAgent, MockModel, tool } from "smolagents-ts";
import { QuickJSExecutor } from "smolagents-ts/exec/quickjs";
import { z } from "zod";

const greet = tool({
  name: "greet",
  description: "Greet one person by name.",
  inputSchema: z.object({ name: z.string() }),
  execute: ({ name }) => "Hello, " + name + "!",
});

const program = "const message = await greet({ name: \"world\" });\nfinal_answer(message);";
const model = new MockModel([
  "Thought: greet the caller.\nCode:\n" + CODE_FENCE + "\n" + program + "\n" + CODE_FENCE,
]);

const agent = new CodeAgent({ model, executor: new QuickJSExecutor(), tools: [greet] });
const result = await agent.run("Greet the world.");
console.log(result.output);
```

`MockModel` scripts the model so the snippet runs with no provider and no key;
swap it for an adapter from `smolagents-ts/models` to talk to a provider.
```

- [ ] **Step 2: Prove the snippet is the example**

Run: `pnpm example:node` and compare its output with the snippet's last line.
Expected: both are `Hello, world!`; the snippet is the example's body, so the README carries no code that has not run.

- [ ] **Step 3: Commit**

```text
docs: add the install and quick-start sections

The quick start is the example's own code, so the README cannot drift from
something that runs: the example's test fails first. The install section says
where the code is until the first release reaches the registry.
```

### Task 8: the gate and the milestone's records

**Files:**
- Modify: `docs/01-project.md`, `docs/04-tasks.md`, `docs/03-handoff.md`, `docs/tasks/archive-2026.md`, `docs/05-memory.md`, `docs/memory/general.md`
- Create: the distribution-shape record under `docs/09-decisions/`, its row in `docs/09-decisions/README.md`
- Modify: this plan (`## Measured results`)

- [ ] **Step 1: Run the full gate**

Run: `pnpm gate *> .superpowers/gate-s6.txt`
Expected: exit 0, with the test totals above S5's 63 files and 444 tests by the facade's file and the example's file, and `pack-smoke OK: 6 packages installed and imported from tarballs`.

- [ ] **Step 2: Record the decision**

Create the distribution-shape decision record under `docs/09-decisions/` (0006) with the pack's decision form (the Contract block from 0004 or 0005, then Context / Decision / Alternatives / Consequences / Reversibility / Follow-up), whose Decision is:

- the internal packages are published beside the facade, because tsup 8.5.1
  cannot inline their declarations (F1);
- the facade is the documented entry point and the five are implementation;
- the six versions move as one changeset fixed group;
- the design's per-adapter `./models/<provider>` subpaths are dropped, because
  the models package ships one barrel with `sideEffects: false`;
- the publish itself is the owner's gate.

Add its row to the top of `docs/09-decisions/README.md`.

- [ ] **Step 3: Update the project table and the tasks**

In `docs/01-project.md`, set S6 to `in_progress` with a note that the v1 distribution (the facade and the first version) is what S6 delivers here, and that the CLI, MCP, remote executors, `exec-pyodide`, docs site and L4/L5 are T-13's. In `docs/04-tasks.md`, add two rows:

```md
| T-13 | ship the v1.5 modules S6's row names: CLI, MCP, remote executors, exec-pyodide, docs site, L4/L5 | pending | owner | new packages, `examples/**`, `apps/**` | the owner picks the next module and its host | - |
| T-14 | publish 0.1.0 to the registry | pending | owner | `.changeset/**` | registry credentials and a repository URL, neither of which the session has | - |
```

- [ ] **Step 4: Write the handoff entry and the archive row**

Prepend a short entry inside the rotation region of `docs/03-handoff.md`. The region measured 8063 bytes of 8192 before this plan, so the entry must fit in 129 bytes of new region or the region must lose a past entry — which rotation, not this task, may do. If the entry cannot fit, put the milestone's detail in the plan's `## Measured results`, keep the handoff entry to the state, the verification and the next step, and note the squeeze.

In `docs/tasks/archive-2026.md`, under "## Closed 2026-10-14", append the S6 row citing this plan, its task commits, `.superpowers/gate-s6.txt`, the pack smoke's six packages, and the validator's `new: 0`.

- [ ] **Step 5: Append the measured results**

Append `## Measured results` to this plan: one row per task with its prediction and what the command printed, and a note for every deviation.

- [ ] **Step 6: Validate and rotate**

Run: `python scripts/validate_context.py --root . --json --baseline docs/.baseline.json`
Expected: `new: []`, 0 errors, 0 warnings.

Run: `python scripts/rotate.py --check`
Expected: exit 0.

- [ ] **Step 7: Commit**

```text
docs: record S6's distribution

The milestone's records: the decision that publishes the internal packages
beside the facade, the project table, the two owner gates the session cannot
close, the handoff entry, the archive row, and the measured results.
```

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| S6-R1 | Publishing the five internal packages enlarges the release surface beyond the design's one-package intent | certain | medium | The facade is the documented entry point and the only one the README names; decision 0006 records the reason and the reversal |
| S6-R2 | The fixed group makes every release bump all six packages | certain | low | That is the intent while the facade depends on the five; the group is one line to change |
| S6-R3 | `prepack` leaves `LICENSE` and `NOTICE` behind when a pack is interrupted | medium | low | They are gitignored, and `postpack` removes them; a stale copy is a generated file, not a second home for the text |
| S6-R4 | The typecheck and build configs drift and one of the two stops resolving | medium | high | Task 2's step 7 runs both; the scoped entry's first hazard names the pair |
| S6-R5 | The registry rejects the scoped packages without an access flag | low | medium | `publishConfig.access: "public"` on all six |
| S6-R6 | The first publish happens without the owner's review | low | high | T-14 is the owner's gate; no task here publishes |

## Rollback

The facade and the example are additive: deleting `packages/smolagents-ts`, `examples/node-script`, the facade's rule file under `rules/components/` and the router row returns the tree to S5, and `pnpm install --no-frozen-lockfile` restores the lockfile. The metadata on the five manifests is reversible field by field, and the licence copies are generated. `pnpm changeset version` is the one commit that writes versions and changelogs; reverting it is `git revert` on that commit, after which the changeset file is restored from the same commit.

## Open questions

1. **The repository URL.** No task adds `repository`, `homepage` or `bugs` to a manifest, because the project has no git remote and inventing a URL is worse than omitting one. npm warns about a missing `repository` but publishes. T-14 asks the owner for the URL.
2. **The docs site.** Section 14 names one; section 5.1 names no app for it and T-12's React example waits on the same choice. T-13 owns it.
3. **Whether the internal packages stay documented.** This plan treats them as implementation. If the owner wants them documented as first-class, the facade's rule file changes with it.
4. **The published name's availability.** `smolagents-ts` is unclaimed as far as this session can tell; no task checks the registry, because no task publishes.

## Notes

- Every number in the task steps is a prediction. The measured numbers belong in `## Measured results` and in `docs/tasks/archive-2026.md`.
- The spike's findings are this plan's evidence for the shape; F1 is the one that decided it, and task 8 records it as a decision rather than a note.
- S6's own row in the design names six more deliverables than this plan builds. They are named in T-13 rather than dropped, which is what risk R3 of the design asks for.

## Measured results

Appended after execution. The task steps above are the predictions; this section
is the measurement, and nothing above it was edited.

### The gate

| measurement | S5 | S6 |
|---|---|---|
| `pnpm gate` exit code | 0 | 0 |
| test files | 63 | 65 |
| tests | 444 | 447 |
| depcruise modules / dependencies | 149 / 379 | 157 / 388 |
| publint | five "All good!" | six "All good!" |
| `pack:smoke` | 5 packages | 6 packages |
| `ci:check` | OK | OK: 2 jobs, node 22/24/26, runtime node/bun/deno, pnpm 12.3.4 |

The two new files are the facade's surface test and the example's test; the three
new tests are those two plus the example's one. Per project, the five older
packages are unchanged from S5 (core 29 files and 290 tests, models 13/62, tools
7/28, exec-quickjs 6/29, react 8/35), and the two new projects contribute
`smolagents-ts` 1/2 and `example-node-script` 1/1. Evidence:
`.superpowers/gate-s6.txt`, exit code 0.

### Per task

| task | prediction | measured |
|---|---|---|
| 1 | five manifests publishable, the licence texts inside the tarball, no copies left behind | PASS — core's tarball carries `package/LICENSE` and `package/NOTICE`; its manifest has `license` and `publishConfig.access` and no `private`; the working tree holds no leftover copy after a pack |
| 2 | six subpaths, a declaration per entry, both configs resolving | PASS — the built entries are roughly 104 to 169 bytes each with a `.d.ts` beside each; typecheck, build and the surface test are green |
| 3 | a scoped entry, a rule file, a router row | PASS — 3672 bytes of scoped entry, three rules and one table row; two duplicate-facts warnings appeared and were cleared by rewording, not by baselining |
| 4 | the facade packs and its subpaths import from the tarball | PASS — the smoke reports six packages installed and imported |
| 5 | six versions at 0.1.0, the fixed group, six changelogs | PASS after the deviation below: the version cut succeeded once the facade stopped being private |
| 6 | the example prints its greeting and its test passes | PASS — `pnpm example:node` prints the expected line and the project's single test is green |
| 7 | install and quick start in the README, line one untouched | PASS — both sections sit between Status and Licence and line one is unchanged |
| 8 | the decision, the rows, the handoff entry and this section | PASS — written; the validator reports no new finding, no error and no warning, and `rotate.py --check` exits 0 |

### Deviations from the plan

1. **The version cut needs the facade public first.** `pnpm changeset version`
   exited 1 with "Found mixed changeset" and "ignored packages:
   smolagents-ts", because a private manifest counts as ignored. Removing
   `private` before the second run is what made it succeed; the manifest would
   have lost it in Task 5 anyway.
2. **The facade's dependencies stay `workspace:*`.** pnpm rewrites them to the
   published versions while packing, so the source manifest keeps the workspace
   protocol and no hand-edit is needed.
3. **The example's test project aliases the published names to the sources.**
   The gate runs the tests before the build, so the example resolves
   `smolagents-ts` and its subpaths through a `resolve.alias` list rather than
   through a built `dist`.
4. **The example declares both quickjs peers.** `pnpm install
   --no-frozen-lockfile` failed with a peer-dependency error because the example
   depends on the facade, whose peers are optional; naming both packages at
   `^0.32.0` in the example's dependencies is what satisfied it.
5. **The script builds the facade first.** `example:node` runs the facade's build
   and then the script, because the script imports the published names.
6. **The changelogs were rewritten by hand.** The generated bodies repeated one
   changeset paragraph in all six packages, which the duplicate-facts check
   flags; each `0.1.0` section now carries package-specific prose.
7. **The plan was assembled from four part files.** One template literal of this
   size failed to parse, so the plan was concatenated from parts and the
   placeholders were replaced afterwards.
8. **Two path references were reworded.** Prose naming a file that did not exist
   yet is an error in this pack, so the rule file and the decision are referred
   to by their directory until the file exists.
9. **The handoff region had no room, and rotation refuses an over-cap entry.**
   The new entry took the region over its cap, and the script aborts before
   moving anything when an inline entry exceeds the per-entry cap — the S2 entry
   is 2598 bytes against 2048. The two oldest entries were therefore moved to
   `docs/handoff/archive-2026.md` verbatim, which leaves three inline entries,
   a region of 5465 bytes, a green `--check` and a working `--apply`. The
   over-cap entry's fate is T-10's, and this move does not settle it.

### Not measured

- **Nothing was published.** No registry call was made, no credentials exist,
  and no manifest carries a repository URL, so T-14 stays open.
- **No CI run.** `ci:check` validates the workflow files locally; the matrix
  legs it names are CI-only.
- **No React example.** T-12 waits on T-13's host choice.
