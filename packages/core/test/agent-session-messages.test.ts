import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CodeAgent } from "../src/agent/code-agent.js";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import { AgentSession } from "../src/session/agent-session.js";
import { MemoryRunStore } from "../src/session/run-store.js";
import { MockModel, type MockTurnInput } from "../src/testing/mock-model.js";
import { ScriptedExecutor } from "../src/testing/scripted-executor.js";
import { tool } from "../src/tool/tool.js";
import type { ToolCallRequest } from "../src/types.js";

function call(name: string, args: unknown, id = "c1"): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

function answer(value: unknown, id = "c1"): MockTurnInput {
  return {
    content: "",
    finishReason: "tool_calls",
    toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: value }, id)],
  };
}

const echo = tool({
  name: "echo",
  description: "Echo a value back.",
  inputSchema: z.object({ value: z.string() }),
  execute: async ({ value }) => value,
});

const fenced = (body: string): string => "\u0060\u0060\u0060javascript\n" + body + "\n\u0060\u0060\u0060";

describe("the snapshot's conversation (decision 0031)", () => {
  it("matches the agent's own projection once a run has committed its steps", async () => {
    const model = new MockModel([
      { content: "I will echo.", finishReason: "tool_calls", toolCalls: [call("echo", { value: "x" })] },
      answer(42),
    ]);
    const agent = new ToolCallingAgent({ model, tools: [echo] });
    const session = new AgentSession(agent);

    await session.send("Echo the value.");

    const messages = session.getSnapshot().messages;
    expect(messages).toEqual(agent.messages);
    expect(messages[0]).toEqual({ role: "user", content: "Echo the value." });
    expect(messages.some((message) => message.role === "assistant" && message.content === "42")).toBe(true);
  });

  it("does not move on a delta, only on a boundary", async () => {
    const model = new MockModel({
      responses: [
        { content: "I will echo.", finishReason: "tool_calls", toolCalls: [call("echo", { value: "x" })] },
        answer(42),
      ],
      // Short chunks force the loop to emit message.delta events before message.completed.
      chunkSize: 3,
    });
    const agent = new ToolCallingAgent({ model, tools: [echo] });
    const session = new AgentSession(agent);
    // The session reads the agent's projection once per boundary; a delta must not read it.
    const reads = vi.spyOn(agent, "messages", "get");
    const seen: { readonly type: string | null; readonly reads: number }[] = [];
    session.subscribe(() => {
      seen.push({ type: session.getSnapshot().lastEventType, reads: reads.mock.calls.length });
    });

    await session.send("Echo the value.");
    vi.restoreAllMocks();

    const deltaIndexes = seen
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.type === "message.delta")
      .map(({ index }) => index);
    expect(deltaIndexes.length).toBeGreaterThan(0);
    for (const index of deltaIndexes) {
      expect(seen[index]?.reads).toBe(seen[index - 1]?.reads);
    }
    // A boundary is where the projection is read, so the count rises there.
    const observations = seen.filter((entry) => entry.type === "observation.completed");
    expect(observations.length).toBeGreaterThan(0);
    expect(seen.at(-1)?.reads).toBeGreaterThan(0);
  });

  it("leaves the step in flight out of the conversation", async () => {
    let duringFinal: readonly { role: string; content: string }[] = [];
    const executor = new ScriptedExecutor({
      handler: (code, options) => {
        if (code.includes("final_answer")) {
          duringFinal = [...session.getSnapshot().messages];
          options.finalAnswer.submit("done");
        }
        return { logs: "", isFinalAnswer: false, durationMs: 1, toolCallCount: 0 };
      },
    });
    const model = new MockModel([fenced("compute()"), fenced("final_answer()")]);
    const session = new AgentSession(new CodeAgent({ model, executor }));

    await session.send("Run the code.");

    expect(duringFinal).toHaveLength(2);
    expect(duringFinal[0]).toEqual({ role: "user", content: "Run the code." });
    expect(duringFinal[1]?.role).toBe("assistant");
    expect(duringFinal.some((message) => message.content.includes("final_answer"))).toBe(false);
  });

  it("spans turns when the session names a checkpoint", async () => {
    const store = new MemoryRunStore();
    const first = new AgentSession(
      new ToolCallingAgent({ model: new MockModel([answer(41)]), store }),
      { checkpoint: "chat" },
    );
    await first.send("remember the number 41");

    const second = new AgentSession(
      new ToolCallingAgent({ model: new MockModel([answer("done")]), store }),
      { checkpoint: "chat" },
    );
    await second.send("what number did I ask you to remember?");

    const messages = second.getSnapshot().messages;
    expect(messages[0]).toEqual({ role: "user", content: "remember the number 41" });
    expect(
      messages.some(
        (message) => message.role === "user" && message.content === "what number did I ask you to remember?",
      ),
    ).toBe(true);
  });
});
