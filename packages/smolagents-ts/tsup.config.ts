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
    "react/index": "src/react/index.ts",
  },
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
});
