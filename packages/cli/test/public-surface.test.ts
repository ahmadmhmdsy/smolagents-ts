import { describe, expect, it } from "vitest";
import * as barrel from "../src/index.js";

describe("the cli public surface", () => {
  it("exports exactly the pinned names", () => {
    // Adding an export is a deliberate act: extend this list in the same commit and say
    // why, so a name never reaches a consumer unnoticed.
    expect(Object.keys(barrel).sort()).toEqual([
      "ACTION_TYPES",
      "API_MODEL_TYPES",
      "CliError",
      "CliUsageError",
      "DEFAULT_ACTION_TYPE",
      "DEFAULT_MODEL_ID",
      "DEFAULT_MODEL_TYPE",
      "DEFAULT_STATE_DIRECTORY",
      "DEFAULT_TOOLS",
      "DEFAULT_VERBOSITY_LEVEL",
      "HF_TOKEN_VARIABLE",
      "HelpRequested",
      "INTERACTIVE_MODEL_ID",
      "INTERACTIVE_MODEL_TYPES",
      "LEOPARD_PROMPT",
      "MissingExecutorError",
      "OPENAI_API_KEY_VARIABLE",
      "USAGE",
      "UnsupportedActionTypeError",
      "UnsupportedModelTypeError",
      "UnsupportedToolError",
      "VERSION",
      "createTerminalPrompter",
      "defaultToolCatalog",
      "defaultToolNames",
      "display",
      "interactiveMode",
      "loadModel",
      "loadTools",
      "nodeRunFileSystem",
      "parseArguments",
      "renderEvent",
      "resolveApiKey",
      "runSmolagent",
      "supportsColor",
      "writeTo",
    ]);
  });

  it("ships a version string", () => {
    expect(typeof barrel.VERSION).toBe("string");
    expect(barrel.VERSION.length).toBeGreaterThan(0);
  });
});
