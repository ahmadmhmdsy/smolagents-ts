import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

// The suite runs against the workspace sources so a change to the core or to the
// tools is exercised without a build. The executor alias is what lets the
// lazy import in src/run.ts resolve during the end-to-end test.
export default defineProject({
  test: {
    name: "cli",
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@smolagents-ts/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      "@smolagents-ts/models": fileURLToPath(new URL("../models/src/index.ts", import.meta.url)),
      "@smolagents-ts/tools": fileURLToPath(new URL("../tools/src/index.ts", import.meta.url)),
      "@smolagents-ts/exec-quickjs": fileURLToPath(
        new URL("../exec-quickjs/src/index.ts", import.meta.url),
      ),
    },
  },
});
