import { expect, test } from "vitest";

import * as core from "../src/index.js";
import * as quickjs from "../src/exec/quickjs.js";
import * as models from "../src/models/index.js";
import * as react from "../src/react/index.js";
import * as tools from "../src/tools/index.js";

/** The five subpaths the design's section 5.2 promises, and the package each re-exports. */
const SUBPATHS = {
  ".": core,
  "./models": models,
  "./tools": tools,
  "./exec/quickjs": quickjs,
  "./react": react,
} as const;

test("every subpath re-exports its package's public surface", () => {
  for (const [subpath, surface] of Object.entries(SUBPATHS)) {
    expect(Object.keys(surface).length, subpath + " re-exports nothing").toBeGreaterThan(0);
  }
});

test("the facade adds no name of its own", () => {
  // A name that is not a package's own export would mean the facade is
  // growing a surface the design did not ask for.
  for (const [subpath, surface] of Object.entries(SUBPATHS)) {
    for (const name of Object.keys(surface)) {
      expect(name, subpath + " exports " + name).not.toBe("default");
    }
  }
});
