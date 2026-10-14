import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

const at = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

// The same mapping the dev server and the build use, for the same reason: the gate runs this
// project before any package has a dist/ to resolve.
export default defineProject({
  resolve: {
    alias: [
      { find: /^smolagents-ts$/, replacement: at("../../packages/core/src/index.ts") },
      { find: /^smolagents-ts\/models$/, replacement: at("../../packages/models/src/index.ts") },
      { find: /^smolagents-ts\/tools$/, replacement: at("../../packages/tools/src/index.ts") },
      { find: /^smolagents-ts\/exec\/quickjs$/, replacement: at("../../packages/exec-quickjs/src/index.ts") },
      { find: /^smolagents-ts\/react$/, replacement: at("../../packages/react/src/index.ts") },
    ],
  },
  test: {
    name: "example-vite-app",
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
  },
});
