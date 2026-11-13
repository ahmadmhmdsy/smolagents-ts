import { describe, expect, it } from "vitest";
import * as barrel from "../src/index.js";

describe("the models-gateway public surface", () => {
  it("exports exactly the pinned names", () => {
    // Adding an export is a deliberate act: extend this list in the same commit and say why
    // in the message. T-54 opened the package with these names (decision 0040).
    expect(Object.keys(barrel).sort()).toEqual([
      "DEFAULT_GATEWAY_HEADER_PREFIXES",
      "GatewayModel",
      "GatewayModelListError",
      "VERSION",
      "listGatewayModels",
      "readGatewayHeaders",
    ]);
  });
});
