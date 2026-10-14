import { defineConfig } from "tsup";

// Two entries: the importable barrel, and the builder the "build" script runs.
// marked is a manifest dependency, so tsup keeps it external and the built
// dist/ imports it from node_modules.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    build: "src/build.ts",
  },
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
});
