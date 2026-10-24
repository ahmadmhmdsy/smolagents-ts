import { describe, expect, it } from "vitest";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { TransferTarget } from "../src/agent/transfer.js";
import { ToolDefinitionError } from "../src/tool/tool.js";
import type { AgentEvent } from "../src/events.js";
import { translateRecord } from "../src/session/run-record.js";
import { MemoryRunStore } from "../src/session/run-store.js";
import { MockModel } from "../src/testing/mock-model.js";
import type { ToolCallRequest } from "../src/types.js";

function call(name: string, args: unknown, id: string): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

function transferTo(name: string, reason?: string): ToolCallRequest {
  return call("transfer_to_" + name, reason === undefined ? {} : { reason }, "transfer");
}

function answer(value: unknown, id = "answer"): ToolCallRequest {
  return call(FINAL_ANSWER_TOOL_NAME, { answer: value }, id);
}

function turn(...calls: ToolCallRequest[]): {
  content: string;
  finishReason: "tool_calls";
  toolCalls: ToolCallRequest[];
} {
  return { content: "", finishReason: "tool_calls", toolCalls: calls };
}

function targetAgent(name: string): ToolCallingAgent {
  return new ToolCallingAgent({ model: new MockModel([turn(answer("handled", name))]) });
}

function declared(): TransferTarget {
  return {
    name: "researcher",
    description: "Researches a topic and reports sources.",
    agent: targetAgent("researcher"),
  };
}

describe("a declared transfer", () => {
  it("is exposed as one tool named after the target and no more", () => {
    const agent = new ToolCallingAgent({
      model: new MockModel([]),
      transfers: [declared()],
    });

    const names = agent.tools.list().map((entry) => entry.name);
    expect(names).toContain("transfer_to_researcher");
    expect(names.filter((name) => name.startsWith("transfer_to_"))).toEqual(["transfer_to_researcher"]);
    const declaredTool = agent.tools.get("transfer_to_researcher");
    expect(declaredTool).toBeDefined();
    expect(declaredTool?.description).toContain("Researches a topic");
    expect(agent.transfers.map((entry) => entry.name)).toEqual(["researcher"]);
  });

  it("ends the run with the target on the result, the record and a terminal event", async () => {
    const store = new MemoryRunStore();
    const agent = new ToolCallingAgent({
      model: new MockModel([turn(transferTo("researcher", "this needs sources"))]),
      store,
      transfers: [declared()],
    });
    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));

    const result = await agent.run("Research the topic.", { runId: "run-transfer" });

    expect(result.state).toBe("success");
    expect(result.transfer?.target).toBe("researcher");
    expect(result.transfer?.reason).toBe("this needs sources");
    const transferred = events.filter((event) => event.type === "run.transferred");
    expect(transferred).toHaveLength(1);
    expect(events.some((event) => event.type === "run.completed")).toBe(false);

    const loaded = store.load("run-transfer");
    expect(loaded).toBeDefined();
    if (loaded === undefined) return;
    const record = translateRecord(loaded, "run-transfer");
    expect(record.status).toBe("completed");
    expect(record.transfer?.target).toBe("researcher");
  });

  it("refuses a target whose name is not an identifier or that names this agent", () => {
    const invalid = () => {
      const bad = declared();
      return new ToolCallingAgent({
        model: new MockModel([]),
        transfers: [{ ...bad, name: "not a name" }],
      });
    };
    expect(invalid).toThrow(ToolDefinitionError);

    const duplicate = () => {
      const first = declared();
      return new ToolCallingAgent({
        model: new MockModel([]),
        transfers: [first, { ...declared(), agent: targetAgent("second") }],
      });
    };
    expect(duplicate).toThrow(ToolDefinitionError);

    const blank = () => {
      const bad = declared();
      return new ToolCallingAgent({
        model: new MockModel([]),
        transfers: [{ ...bad, description: "  " }],
      });
    };
    expect(blank).toThrow(ToolDefinitionError);
  });

  it("leaves a call for an undeclared target as an ordinary tool error", async () => {
    const agent = new ToolCallingAgent({
      model: new MockModel([turn(transferTo("editor")), turn(answer("done"))]),
      transfers: [declared()],
    });
    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));

    const result = await agent.run("Edit the draft.");

    expect(result.state).toBe("success");
    expect(result.transfer).toBeUndefined();
    const failed = events.filter((event) => event.type === "action.failed");
    expect(failed.length).toBeGreaterThan(0);
    expect(JSON.stringify(failed[0])).toContain("transfer_to_editor");
    expect(events.some((event) => event.type === "run.transferred")).toBe(false);
  });

  it("leaves a run without a transfer unchanged", async () => {
    const store = new MemoryRunStore();
    const agent = new ToolCallingAgent({
      model: new MockModel([turn(answer("plain"))]),
      store,
    });

    const result = await agent.run("Say plain.", { runId: "run-plain" });

    expect(result.state).toBe("success");
    expect("transfer" in result).toBe(false);
    const loaded = store.load("run-plain");
    expect(loaded).toBeDefined();
    if (loaded === undefined) return;
    expect(translateRecord(loaded, "run-plain").transfer).toBeUndefined();
  });
});
