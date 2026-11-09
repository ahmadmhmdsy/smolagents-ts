import { defineConfig } from "tsup";

// One isomorphic entry: the architecture test fails it on any node: specifier.
// tsup keeps package.json's dependencies external, so core and zod are not bundled.
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ["zod", "@smolagents-ts/core"],
});
