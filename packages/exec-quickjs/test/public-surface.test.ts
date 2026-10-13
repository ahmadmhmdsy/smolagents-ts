import { describe, expect, it } from "vitest";
import * as barrel from "../src/index.js";

describe("the exec-quickjs public surface", () => {
  it("exports exactly the pinned names", () => {
    // Adding an export is a deliberate act: extend this list in the same commit and say why
    // in the message, so a name never reaches a consumer unnoticed. The seam's types
    // (CodeExecutor, ExecuteOptions, CodeResult) stay in the core.
    expect(Object.keys(barrel).sort()).toEqual([
      "QuickJSExecutor",
      "VERSION",
      "buildGuestSource",
    ]);
  });
});
