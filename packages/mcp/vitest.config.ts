import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "mcp",
    fileParallelism: false,
  },
  resolve: {
    // Resolve core to its source, because the gate runs this project before any build
    // exists: the workspace link in node_modules points at a dist/ that is not there yet.
    alias: {
      "@smolagents-ts/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      // The stdio subpath resolves through the package's published "exports" map, which
      // points at a dist/ the gate has not built yet. Point the subpath at its source so
      // the stdio suite runs beside the rest of the project.
      "@smolagents-ts/mcp/stdio": fileURLToPath(
        new URL("./src/transports/stdio.ts", import.meta.url),
      ),
    },
  },
});
