import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "core",
    // architecture-guard.test.ts plants a node: import inside packages/core/src and architecture.test.ts
    // asserts that same directory is clean. Run concurrently, one file's probe is the other file's
    // violation, so the outcome would depend on timing instead of on the code.
    fileParallelism: false,
  },
});
