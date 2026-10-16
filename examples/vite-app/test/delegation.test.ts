import { describe, expect, it } from "vitest";
import { createDelegationRun } from "../src/agent.js";

/**
 * The delegation path, end to end in the app's own environment: the parent's generated program
 * calls a managed agent, the real QuickJS executor bridges that call, the child runs its own loop
 * against its own model, and the report it returns becomes the parent's answer.
 */
describe("delegation in the browser example", () => {
  it("runs a child agent from sandboxed code and folds its report back", async () => {
    const { agent, executor } = createDelegationRun();
    try {
      const result = await agent.run("Greet the world by delegating to the researcher.");

      expect(result.output).toContain("Hello, world!");
      expect(result.output).toContain("managed agent 'researcher'");
    } finally {
      await executor.dispose();
    }
  });
});
