import { defineConfig } from "tsup";

// Four entries. The root barrel stays backend-neutral: nothing it reaches imports a node:
// builtin or a vendor client. Each backend lives behind its own subpath, so a consumer that
// never imports "@smolagents-ts/exec-remote/docker" never resolves dockerode, and the two
// vendor peers stay external and optional.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    process: "src/process.ts",
    docker: "src/docker.ts",
    e2b: "src/e2b.ts",
  },
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ["zod", "@smolagents-ts/core", "dockerode", "@e2b/code-interpreter"],
});
