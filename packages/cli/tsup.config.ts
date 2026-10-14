import { defineConfig } from "tsup";

// Two entries: the importable barrel, and the bin that the manifest's "bin" field
// points at. tsup keeps package.json's dependencies and peerDependencies external,
// so the executor package stays a peer that a consumer installs on demand.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    main: "src/main.ts",
  },
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
});
