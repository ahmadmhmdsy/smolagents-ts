import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "models-gateway",
  },
  resolve: {
    // Resolve core and models to their source, because the gate runs this project before any
    // build exists: the workspace links in node_modules point at dist/ folders not there yet.
    alias: {
      "@smolagents-ts/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      "@smolagents-ts/models": fileURLToPath(new URL("../models/src/index.ts", import.meta.url)),
    },
  },
});
