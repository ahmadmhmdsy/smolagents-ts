import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Point at each project's own config, never at its directory: a glob over a
    // directory also matches the loose files beside the projects -- `examples/README.md`
    // is one -- and vitest refuses to start when a match is not a project.
    projects: [
      "packages/*/vitest.config.ts",
      "examples/*/vitest.config.ts",
      "apps/*/vitest.config.ts",
    ],
  },
});
