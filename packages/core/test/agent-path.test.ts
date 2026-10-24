import { describe, expect, it } from "vitest";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { MultiStepAgent } from "../src/agent/multi-step-agent.js";
import type { AgentEvent } from "../src/events.js";
import { translateRecord } from "../src/session/run-record.js";
import { MemoryRunStore } from "../src/session/run-store.js";
import { MockModel } from "../src/testing/mock-model.js";
import type { ToolCallRequest } from "../src/types.js";

function call(name: string, args: unknown, id: string): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

function answer(value: unknown, id = "answer"): ToolCallRequest {
  return call(FINAL_ANSWER_TOOL_NAME, { answer: value }, id);
}

function delegate(name: string, task: string, id = "delegate"): ToolCallRequest {
  return call(name, { task }, id);
}

function turn(...calls: ToolCallRequest[]): {
  content: string;
  finishReason: "tool_calls";
  toolCalls: ToolCallRequest[];
} {
  return { content: "", finishReason: "tool_calls", toolCalls: calls };
}

function listen(agent: MultiStepAgent): AgentEvent[] {
  const events: AgentEvent[] = [];
  agent.on((event) => {
    events.push(event);
  });
  return events;
}

describe("the agent path on events", () => {
  it("marks every event of a root run with an empty path", async () => {
    const agent = new ToolCallingAgent({
      model: new MockModel([turn(answer("done"))]),
    });
    const events: AgentEvent[] = [];
    for await (const event of agent.stream("say done")) events.push(event);

    expect(events.length).toBeGreaterThan(0);
    expect(new Set(events.map((event) => event.type)).size).toBeGreaterThan(1);
    for (const event of events) expect(event.agentPath).toEqual([]);
  });

  it("names the managed child that produced each of its own events", async () => {
    const child = new ToolCallingAgent({
      model: new MockModel([turn(answer(42, "child"))]),
    });
    const parent = new ToolCallingAgent({
      model: new MockModel([turn(delegate("junior", "compute 6*7")), turn(answer("42", "parent"))]),
      managedAgents: [{ name: "junior", description: "A junior who does arithmetic.", agent: child }],
    });
    const childEvents = listen(child);
    const parentEvents = listen(parent);

    await parent.run("What is 6 times 7?");

    expect(childEvents.length).toBeGreaterThan(0);
    for (const event of childEvents) expect(event.agentPath).toEqual(["junior"]);
    for (const event of parentEvents) expect(event.agentPath).toEqual([]);
  });

  it("extends the path through a second level of delegation", async () => {
    const grandchild = new ToolCallingAgent({
      model: new MockModel([turn(answer("draft", "writer"))]),
    });
    const child = new ToolCallingAgent({
      model: new MockModel([turn(delegate("writer", "draft it")), turn(answer("report", "researcher"))]),
      managedAgents: [{ name: "writer", description: "Writes the draft.", agent: grandchild }],
    });
    const parent = new ToolCallingAgent({
      model: new MockModel([turn(delegate("researcher", "research it")), turn(answer("final", "parent"))]),
      managedAgents: [{ name: "researcher", description: "Researches the topic.", agent: child }],
    });
    const grandchildEvents = listen(grandchild);
    const childEvents = listen(child);

    await parent.run("Produce the final answer.");

    expect(grandchildEvents.length).toBeGreaterThan(0);
    for (const event of grandchildEvents) expect(event.agentPath).toEqual(["researcher", "writer"]);
    for (const event of childEvents) expect(event.agentPath).toEqual(["researcher"]);
  });

  it("stores the path its run ran under on the record", async () => {
    const store = new MemoryRunStore();
    const agent = new ToolCallingAgent({
      model: new MockModel([turn(answer("done"))]),
      store,
    });

    await agent.run("say done", { runId: "run-path", agentPath: ["host"] });

    const loaded = store.load("run-path");
    expect(loaded).toBeDefined();
    if (loaded === undefined) return;
    expect(translateRecord(loaded, "run-path").agentPath).toEqual(["host"]);
  });

  it("extends a caller-supplied path instead of replacing it", async () => {
    const child = new ToolCallingAgent({
      model: new MockModel([turn(answer(1, "child"))]),
    });
    const parent = new ToolCallingAgent({
      model: new MockModel([turn(delegate("junior", "count")), turn(answer(1, "parent"))]),
      managedAgents: [{ name: "junior", description: "Counts.", agent: child }],
    });
    const childEvents = listen(child);

    const parentPaths: (readonly string[] | undefined)[] = [];
    for await (const event of parent.stream("count", { agentPath: ["host"] })) {
      parentPaths.push(event.agentPath);
    }

    expect(parentPaths.length).toBeGreaterThan(0);
    for (const path of parentPaths) expect(path).toEqual(["host"]);
    for (const event of childEvents) expect(event.agentPath).toEqual(["host", "junior"]);
  });
});
