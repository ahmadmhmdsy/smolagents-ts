import { defineConfig } from "tsup";

export default defineConfig({
  // The worker script ships beside the entry, where PyodideWorkerExecutor looks for it (0041).
  entry: ["src/index.ts", "src/pyodide-worker.ts"],
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ["zod", "pyodide"],
});
