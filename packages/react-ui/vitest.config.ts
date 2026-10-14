import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "react-ui",
    fileParallelism: false,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    // Resolve both workspace packages to their source, because the gate runs this project
    // before any build exists: the workspace links point at a dist/ that is not there yet.
    alias: {
      "@smolagents-ts/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      "@smolagents-ts/react": fileURLToPath(new URL("../react/src/index.ts", import.meta.url)),
    },
  },
});
