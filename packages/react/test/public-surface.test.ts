import { describe, expect, it } from "vitest";
import * as react from "../src/index.js";

/**
 * Every runtime value the package promises. Adding a name here is a deliberate act;
 * removing one is a breaking change and should be visible in a diff. The providers and the
 * step-context readers are not here: they are the composition's internals, not the surface.
 */
const RUNTIME_EXPORTS = [
  // package metadata
  "VERSION",
  // L2 hooks
  "useAgentEvent",
  "useAgentRun",
  "useAgentRunSnapshot",
  "useAgentSession",
  "useRunEvents",
  // L3 primitives
  "AgentRun",
  "AgentStep",
  "CodeBlock",
  "FinalAnswer",
  "ToolCall",
  // L4 patterns
  "RunInspector",
  "ChatSurface",
] as const;

describe("public surface", () => {
  for (const name of RUNTIME_EXPORTS) {
    it("exports " + name, () => {
      expect(react).toHaveProperty(name);
      expect((react as Record<string, unknown>)[name]).toBeDefined();
    });
  }

  it("keeps the total export count honest", () => {
    const unexpected = Object.keys(react).filter(
      (name) => !(RUNTIME_EXPORTS as readonly string[]).includes(name),
    );
    expect(unexpected).toEqual([]);
  });

  it("carries the four primitives the design names", () => {
    expect(typeof react.AgentRun).toBe("function");
    expect(typeof react.AgentRun.Status).toBe("function");
    expect(typeof react.AgentRun.Steps).toBe("function");
    expect(typeof react.AgentRun.Cancel).toBe("function");
    expect(typeof react.AgentRun.FinalAnswer).toBe("function");
    expect(typeof react.AgentStep.Action).toBe("function");
    expect(typeof react.AgentStep.Planning).toBe("function");
    expect(typeof react.AgentStep.FinalAnswer).toBe("function");
  });
});
