import { describe, expect, it } from "vitest";

import * as barrel from "../src/index.js";

describe("the exec-pyodide public surface", () => {
  it("exports exactly the pinned names", () => {
    // Adding an export is a deliberate act: extend this list in the same commit and say why.
    // The seam's types (CodeExecutor, ExecuteOptions, CodeResult) stay in the core, so the
    // three runtime names are the whole surface.
    expect(Object.keys(barrel).sort()).toEqual([
      "DEFAULT_AUTHORIZED_IMPORTS",
      "PyodideExecutor",
      "VERSION",
    ]);
  });
});
