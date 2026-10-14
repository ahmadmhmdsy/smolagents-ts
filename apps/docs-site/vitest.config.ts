import { defineProject } from "vitest/config";

// The suite reads and writes temporary trees, so it runs against the TypeScript
// sources with no build step; fileParallelism stays off so the builder's output
// is not interleaved across files.
export default defineProject({
  test: {
    name: "docs-site",
    fileParallelism: false,
  },
});
