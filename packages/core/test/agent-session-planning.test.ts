import { describe, expect, it } from "vitest";
import { CodeAgent } from "../src/agent/code-agent.js";
import { CODE_FENCE } from "../src/prompts/templates.js";
import { AgentSession } from "../src/session/agent-session.js";
import { MockModel } from "../src/testing/mock-model.js";
import type { CodeResult } from "../src/executor.js";
import { ScriptedExecutor } from "../src/testing/scripted-executor.js";

function fenced(code: string): string {
  return "Thought: working.\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

/** Answers only when the code asks for the final answer, so the first step stays open. */
const answeringExecutor = new ScriptedExecutor({
  handler: (code, options): CodeResult => {
    if (code.includes("final_answer")) options.finalAnswer.submit(7);
    return { logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
  },
});

describe("AgentSession's planning lane", () => {
  it("collects one entry per planning step and closes it with the completed text", async () => {
    const agent = new CodeAgent({
      model: new MockModel([
        "Plan: do the thing",
        fenced("compute()"),
        fenced("final_answer(7)"),
      ] as never),
      executor: answeringExecutor,
      // Two steps of interval: only the initial plan lands before the run answers.
      planningInterval: 2,
    });
    const session = new AgentSession(agent);
    await session.send("Q");

    const snapshot = session.getSnapshot();
    expect(snapshot.status).toBe("success");
    expect(snapshot.planning).toHaveLength(1);
    expect(snapshot.planning[0]?.stepIndex).toBe(0);
    expect(snapshot.planning[0]?.status).toBe("complete");
    expect(snapshot.planning[0]?.text).toContain("Plan: do the thing");
    expect(snapshot.planning[0]?.text).toContain("Here are the facts I know");
    expect(Object.isFrozen(snapshot.planning)).toBe(true);
  });

  it("leaves the lane empty when planning is disabled", async () => {
    const agent = new CodeAgent({
      model: new MockModel([fenced("final_answer(1)")] as never),
      executor: new ScriptedExecutor({
        handler: (_code, options): CodeResult => {
          options.finalAnswer.submit(1);
          return { logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
        },
      }),
    });
    const session = new AgentSession(agent);
    await session.send("Q");

    expect(session.getSnapshot().planning).toEqual([]);
  });
});
