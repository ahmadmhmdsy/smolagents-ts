import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

const at = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineProject({
  test: {
    name: "smolagents-ts",
  },
  resolve: {
    // Resolve the five internal packages to their sources, because the gate runs this
    // project before any build exists: every workspace link points at a dist/ that is not
    // there yet, and each of these sources imports the core by its package name.
    alias: {
      "@smolagents-ts/core": at("../core/src/index.ts"),
      "@smolagents-ts/models": at("../models/src/index.ts"),
      "@smolagents-ts/tools": at("../tools/src/index.ts"),
      "@smolagents-ts/exec-quickjs": at("../exec-quickjs/src/index.ts"),
      "@smolagents-ts/react": at("../react/src/index.ts"),
    },
  },
});
