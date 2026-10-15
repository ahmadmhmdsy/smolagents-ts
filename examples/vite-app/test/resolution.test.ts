import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * This app resolves workspace packages through three configs -- the compiler's
 * `paths`, the test runner's aliases, and the dev server and build's aliases -- and
 * all three must point at source rather than at a built `dist/`. CI runs
 * `typecheck` before `build`, so a config that resolves through `node_modules`
 * works on every developer's machine, which has built the packages, and on no
 * fresh checkout. The omission has now been made in two of the three, so all
 * three are pinned here, and they are pinned to each other rather than to a list
 * this test would have to be taught about: a name one config covers, every
 * config covers.
 *
 * The names are the scoped ones as well as the facade's, because a mapped source
 * file imports its siblings by package name. That is the failure this test
 * exists for: mapping `@smolagents-ts/react-ui` to its source pulls in a file
 * that imports `@smolagents-ts/react`, which only resolves if the compiler was
 * told about that name too.
 */

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const repoRoot = join(appRoot, "..", "..");

const CONFIGS = [
  "tsconfig.json",
  "vitest.config.ts",
  "vite.config.ts",
] as const;

const read = (name: string): string =>
  readFileSync(join(appRoot, name), "utf8");

/** The alias configs write their finders as regular expressions, so a scoped name
 *  appears with the slash escaped. Accept either spelling. */
const namesIt = (source: string, name: string): boolean =>
  source.includes(name) || source.includes(name.split("/").join("\\/"));

/** Every published workspace package name, facade included. */
const workspaceNames = (): string[] => {
  const dir = join(repoRoot, "packages");
  return readdirSync(dir)
    .map((entry) => join(dir, entry, "package.json"))
    .filter((manifest) => existsSync(manifest))
    .map(
      (manifest) =>
        (JSON.parse(readFileSync(manifest, "utf8")) as { name: string }).name,
    )
    .filter(
      (name) => name === "smolagents-ts" || name.startsWith("@smolagents-ts/"),
    )
    .sort();
};

/** Every workspace package this app depends on directly. */
const directDeps = (): string[] => {
  const manifest = JSON.parse(read("package.json")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })
    .filter(
      (name) => name === "smolagents-ts" || name.startsWith("@smolagents-ts/"),
    )
    .sort();
};

describe("the app's resolver configs", () => {
  it("maps every direct dependency in every config", () => {
    for (const config of CONFIGS) {
      const source = read(config);
      for (const name of directDeps()) {
        expect(
          namesIt(source, name),
          `${config} has no entry for ${name}`,
        ).toBe(true);
      }
    }
  });

  it("covers the same workspace names in every config", () => {
    const sources = new Map(CONFIGS.map((config) => [config, read(config)]));
    const covered = workspaceNames().filter((name) =>
      CONFIGS.some((config) => namesIt(sources.get(config) ?? "", name)),
    );
    expect(covered.length, "no config maps a workspace name").toBeGreaterThan(
      0,
    );
    for (const config of CONFIGS) {
      for (const name of covered) {
        expect(
          namesIt(sources.get(config) ?? "", name),
          `${config} omits ${name}`,
        ).toBe(true);
      }
    }
  });

  it("resolves every compiler path to a source file, not to a built one", () => {
    // tsconfig.json is plain JSON here. If it ever grows a comment this throws
    // rather than silently skipping the check, which is the failure we want.
    const tsconfig = JSON.parse(read("tsconfig.json")) as {
      compilerOptions?: { paths?: Record<string, string[]> };
    };
    for (const [name, targets] of Object.entries(
      tsconfig.compilerOptions?.paths ?? {},
    )) {
      expect(targets[0], `${name} does not resolve to a source file`).toMatch(
        /\/src\/index\.ts$/,
      );
    }
  });
});

/**
 * The QuickJS engine locates its own binary with
 * `new URL("emscripten-module.wasm", import.meta.url)`, and the dev server's dependency
 * pre-bundle moves that module into `node_modules/.vite/deps`, where the relative URL names a
 * file that does not exist. The server answers the request with `index.html`; the browser
 * reports "Incorrect response MIME type. Expected 'application/wasm'", then "expected magic
 * word 00 61 73 6d, found 3c 21 64 6f", and every run dies on its first step.
 *
 * No other test here can see that failure. They run in Node, where the engine loads from disk
 * and `vite build` rewrites the URL correctly; only the dev server pre-bundles, and only a
 * browser shows the result. So the exclusion is the whole fix, and this is its guard: the
 * engine stays out of the pre-bundle, which is what leaves the module where its own
 * `import.meta.url` resolves to the file the server will serve.
 */
describe("the dev server's dependency pre-bundle", () => {
  it("keeps the QuickJS engine out of it", () => {
    const source = read("vite.config.ts");
    const block = /optimizeDeps\s*:\s*\{[^}]*\}/.exec(source)?.[0];
    expect(block, "vite.config.ts declares no optimizeDeps block").toBeDefined();
    expect(
      namesIt(block ?? "", "@jitl/quickjs-wasmfile-release-sync"),
      "the QuickJS engine is pre-bundled, so the dev server cannot serve its wasm",
    ).toBe(true);
  });
});
