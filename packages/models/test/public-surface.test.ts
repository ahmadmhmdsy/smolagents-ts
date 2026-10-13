import { describe, expect, it } from "vitest";
import * as barrel from "../src/index.js";

describe("the models public surface", () => {
  it("exports exactly the pinned names", () => {
    // Adding an export is a deliberate act: extend this list in the same commit and say
    // why in the message, so a name never reaches a consumer unnoticed.
    expect(Object.keys(barrel).sort()).toEqual(["CustomModel", "OpenAICompatibleModel", "VERSION"]);
  });
});
