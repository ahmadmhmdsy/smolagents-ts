import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

const at = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

// The example consumes the published names, so the runner maps them to the
// sources the packages build from: the gate runs the tests before it builds, and
// the packed tarballs are the pack smoke's business rather than this project's.
export default defineProject({
  resolve: {
    alias: [
      { find: /^smolagents-ts$/, replacement: at("../../packages/core/src/index.ts") },
      { find: /^smolagents-ts\/models$/, replacement: at("../../packages/models/src/index.ts") },
      { find: /^smolagents-ts\/tools$/, replacement: at("../../packages/tools/src/index.ts") },
      { find: /^smolagents-ts\/exec\/quickjs$/, replacement: at("../../packages/exec-quickjs/src/index.ts") },
      { find: /^smolagents-ts\/react$/, replacement: at("../../packages/react/src/index.ts") },
      // The sources above import each other by package name, so the internal names need the
      // same mapping: without them the facade's first import resolves to a dist/ that a
      // fresh checkout does not have.
      { find: /^@smolagents-ts\/core$/, replacement: at("../../packages/core/src/index.ts") },
      { find: /^@smolagents-ts\/models$/, replacement: at("../../packages/models/src/index.ts") },
      { find: /^@smolagents-ts\/tools$/, replacement: at("../../packages/tools/src/index.ts") },
      { find: /^@smolagents-ts\/exec-quickjs$/, replacement: at("../../packages/exec-quickjs/src/index.ts") },
      { find: /^@smolagents-ts\/react-ui$/, replacement: at("../../packages/react-ui/src/index.ts") },
      { find: /^@smolagents-ts\/react$/, replacement: at("../../packages/react/src/index.ts") },
    ],
  },
  test: {
    name: "example-live-provider",
  },
});
