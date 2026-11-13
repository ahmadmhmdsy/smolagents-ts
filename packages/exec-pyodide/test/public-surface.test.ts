import { describe, expect, it } from "vitest";

import * as barrel from "../src/index.js";

describe("the exec-pyodide public surface", () => {
  it("exports exactly the pinned names", () => {
    // Adding an export is a deliberate act: extend this list in the same commit and say why.
    // The seam's types (CodeExecutor, ExecuteOptions, CodeResult) stay in the core, so the
    // three runtime names are the whole surface.
    // Decision 0041 adds the worker executor and its default bound beside the in-process one.
    expect(Object.keys(barrel).sort()).toEqual([
      "DEFAULT_AUTHORIZED_IMPORTS",
      "DEFAULT_WORKER_CPU_TIME_LIMIT_MS",
      "PyodideExecutor",
      "PyodideWorkerExecutor",
      "VERSION",
    ]);
  });
});
