import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { AgentEvent } from "../src/events.js";
import { AgentMemory } from "../src/memory/memory.js";
import { buildTrace } from "../src/monitoring/trace.js";
import { sendRunMessage } from "../src/session/messages.js";
import { translateRecord, type RunRecord } from "../src/session/run-record.js";
import { MemoryRunStore } from "../src/session/run-store.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import type { ChatMessage, ToolCallRequest } from "../src/types.js";

const RUN = "condense-run";
const TASK = "Collect three notes and answer.";

function call(name: string, args: unknown, id: string): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

function turn(...calls: ToolCallRequest[]): {
  content: string;
  finishReason: "tool_calls";
  toolCalls: ToolCallRequest[];
} {
  return { content: "", finishReason: "tool_calls", toolCalls: calls };
}

function answerTurn(value: unknown): ReturnType<typeof turn> {
  return turn(call(FINAL_ANSWER_TOOL_NAME, { answer: value }, "answer"));
}

function noteTool() {
  return tool({
    name: "note",
    description: "Write a note.",
    inputSchema: z.object({ text: z.string() }),
    execute: (input: { text: string }) => input.text + " " + "x".repeat(180),
  });
}

/** Characters outside the system prompt, so a threshold is about the history, not the prompt. */
function historyChars(messages: readonly ChatMessage[]): number {
  return messages
    .filter((message) => message.role !== "system")
    .reduce((total, message) => total + message.content.length, 0);
}

function condensingOptions(overrides: Record<string, unknown> = {}) {
  return {
    softLimit: 300,
    hardLimit: 1_000_000,
    keepRecent: 1,
    estimate: historyChars,
    summarize: (forgotten: readonly { id: string }[]) => "condensed " + forgotten.length + " step(s)",
    ...overrides,
  };
}

async function runWith(
  options: Record<string, unknown>,
  turns: readonly ReturnType<typeof turn>[],
  extra: { store?: MemoryRunStore; withMessage?: boolean } = {},
): Promise<{ events: AgentEvent[]; model: MockModel; agent: ToolCallingAgent }> {
  const store = extra.store ?? new MemoryRunStore();
  const tools = extra.withMessage === true
    ? [
        noteTool(),
        tool({
          name: "notify",
          description: "Send the run a message.",
          inputSchema: z.object({}),
          async execute() {
            await sendRunMessage(store, RUN, { from: "user", text: "keep the constraint" });
            return "noted";
          },
        }),
      ]
    : [noteTool()];
  const model = new MockModel(turns as never);
  const agent = new ToolCallingAgent({
    model,
    tools,
    store,
    condensation: condensingOptions(options),
  });
  const events: AgentEvent[] = [];
  for await (const event of agent.stream(TASK, { runId: RUN })) events.push(event);
  return { events, model, agent };
}

function condensed(events: readonly AgentEvent[]) {
  return events.filter((event) => event.type === "memory.condensed");
}

function recordOf(store: MemoryRunStore): RunRecord {
  const stored = store.load(RUN);
  if (stored === undefined) throw new Error("the store holds no record for run " + RUN);
  return translateRecord(stored, RUN);
}

describe("condensation as a step and an event", () => {
  it("condenses at the soft limit and hides the forgotten step from the transcript", async () => {
    const store = new MemoryRunStore();
    const { events, model, agent } = await runWith({}, [
      turn(call("note", { text: "first" }, "n1")),
      turn(call("note", { text: "second" }, "n2")),
      turn(call("note", { text: "third" }, "n3")),
      answerTurn("done"),
    ], { store });

    const [firstAction] = agent.steps.filter((step) => step.kind === "action");
    expect(firstAction).toBeDefined();
    const firstObservation = "first " + "x".repeat(180);

    const found = condensed(events);
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found[0]).toMatchObject({
      trigger: "soft",
      forgotten: [firstAction?.id],
      summary: "condensed 1 step(s)",
    });

    // The third model call is the first one built after the condensation.
    const thirdCall = model.calls[2] ?? [];
    expect(thirdCall.some((message) => message.content.includes(firstObservation))).toBe(false);
    expect(thirdCall.some((message) => message.content.includes("Earlier steps, condensed:"))).toBe(true);
    expect(thirdCall.some((message) => message.content.includes("condensed 1 step(s)"))).toBe(true);
    expect(thirdCall[0]?.role).toBe("system");
    expect(thirdCall.some((message) => message.content === TASK)).toBe(true);

    // The record keeps every step, the forgotten one included.
    const record = recordOf(store);
    expect(record.memory.steps.some((step) => step.id === firstAction?.id)).toBe(true);
    expect(record.memory.steps.some((step) => step.kind === "condensation")).toBe(true);
  });

  it("projects a reloaded record identically and never condenses twice", async () => {
    const store = new MemoryRunStore();
    const { agent } = await runWith({}, [
      turn(call("note", { text: "first" }, "n1")),
      turn(call("note", { text: "second" }, "n2")),
      turn(call("note", { text: "third" }, "n3")),
      answerTurn("done"),
    ], { store });
    const record = recordOf(store);
    const systemPrompt = record.memory.steps.find((step) => step.kind === "system_prompt");
    const firstAction = agent.steps.filter((step) => step.kind === "action")[0];

    const memory = new AgentMemory();
    memory.restore(record.memory.steps);
    const projected = memory.toMessages({
      systemPrompt: systemPrompt?.kind === "system_prompt" ? systemPrompt.systemPrompt : "",
    });
    const again = memory.toMessages({
      systemPrompt: systemPrompt?.kind === "system_prompt" ? systemPrompt.systemPrompt : "",
    });

    expect(projected).toEqual(again);
    expect(projected.some((message) => message.content.includes("first " + "x".repeat(180)))).toBe(false);
    const condensations = record.memory.steps.filter((step) => step.kind === "condensation");
    expect(condensations.length).toBeGreaterThanOrEqual(1);
    expect(projected.filter((message) => message.content.includes("Earlier steps, condensed:"))).toHaveLength(
      condensations.length,
    );
    expect(record.memory.steps.some((step) => step.id === firstAction?.id)).toBe(true);
  });

  it("condenses under the hard limit with a deterministic summary when the summarizer throws", async () => {
    const store = new MemoryRunStore();
    const { events, model } = await runWith({
      softLimit: 1_000_000,
      hardLimit: 300,
      summarize: () => {
        throw new Error("the summarizer is down");
      },
    }, [
      turn(call("note", { text: "first" }, "n1")),
      turn(call("note", { text: "second" }, "n2")),
      turn(call("note", { text: "third" }, "n3")),
      answerTurn("done"),
    ], { store });

    const found = condensed(events);
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found[0]?.trigger).toBe("hard");
    expect(found[0]?.summary).toMatch(/Condensed 1 earlier step\./);
    // The run proceeded: the model was asked again after the hard condensation.
    expect(model.calls.length).toBeGreaterThanOrEqual(4);
  });

  it("defers a soft condensation whose summarizer throws and leaves the transcript intact", async () => {
    const store = new MemoryRunStore();
    const { events, model } = await runWith({
      summarize: () => {
        throw new Error("the summarizer is down");
      },
    }, [
      turn(call("note", { text: "first" }, "n1")),
      turn(call("note", { text: "second" }, "n2")),
      turn(call("note", { text: "third" }, "n3")),
      answerTurn("done"),
    ], { store });

    expect(condensed(events)).toHaveLength(0);
    const thirdCall = model.calls[2] ?? [];
    expect(thirdCall.some((message) => message.content.includes("first " + "x".repeat(180)))).toBe(true);
  });

  it("never forgets the task, the system prompt, a message step or the recent window", async () => {
    const store = new MemoryRunStore();
    const { events, agent } = await runWith({}, [
      turn(call("note", { text: "first" }, "n1")),
      turn(call("notify", {}, "m1")),
      turn(call("note", { text: "second" }, "n2")),
      turn(call("note", { text: "third" }, "n3")),
      answerTurn("done"),
    ], { store, withMessage: true });

    const record = recordOf(store);
    const forgotten = new Set(condensed(events).flatMap((event) => event.forgotten ?? []));
    expect(forgotten.size).toBeGreaterThan(0);

    const ids = new Set(record.memory.steps.map((step) => step.id));
    for (const id of forgotten) expect(ids.has(id)).toBe(true);

    const message = record.memory.steps.find((step) => step.kind === "message");
    const task = record.memory.steps.find((step) => step.kind === "task");
    const prompt = record.memory.steps.find((step) => step.kind === "system_prompt");
    expect(message).toBeDefined();
    expect(forgotten.has(message?.id ?? "")).toBe(false);
    expect(forgotten.has(task?.id ?? "")).toBe(false);
    expect(forgotten.has(prompt?.id ?? "")).toBe(false);

    const actions = agent.steps.filter((step) => step.kind === "action");
    const lastAction = actions[actions.length - 1];
    expect(forgotten.has(lastAction?.id ?? "")).toBe(false);
    // Only action steps are candidates, so every forgotten id is an action.
    for (const id of forgotten) {
      expect(actions.some((step) => step.id === id)).toBe(true);
    }
  });

  it("shows the forgetting in the trace", async () => {
    const { events, agent } = await runWith({}, [
      turn(call("note", { text: "first" }, "n1")),
      turn(call("note", { text: "second" }, "n2")),
      turn(call("note", { text: "third" }, "n3")),
      answerTurn("done"),
    ]);

    const firstAction = agent.steps.filter((step) => step.kind === "action")[0];
    const trace = buildTrace(events, () => 0);
    const forgetting = trace.children.find((child) => child.name === "memory.condensed");
    expect(forgetting).toBeDefined();
    expect(forgetting?.attributes.trigger).toBe("soft");
    expect(forgetting?.attributes.forgotten).toEqual([firstAction?.id]);
    expect(forgetting?.attributes.summary).toBe("condensed 1 step(s)");
  });
});
