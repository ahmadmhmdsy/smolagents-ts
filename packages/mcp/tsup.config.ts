import { defineConfig } from "tsup";

// Two entries. The barrel stays isomorphic — the architecture test fails it on any
// node: specifier — and the stdio transport lives behind the "@smolagents-ts/mcp/stdio"
// subpath, so a browser bundle that imports the package never reaches node:child_process.
// tsup keeps package.json's dependencies external, so core and zod are not bundled.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "transports/stdio": "src/transports/stdio.ts",
  },
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ["zod", "@smolagents-ts/core"],
});
