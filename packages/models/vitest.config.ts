import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "models",
    fileParallelism: false,
  },
  resolve: {
    // Resolve core to its source, because the gate runs this project before any build
    // exists: the workspace link in node_modules points at a dist/ that is not there yet.
    alias: {
      "@smolagents-ts/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
    },
  },
});
