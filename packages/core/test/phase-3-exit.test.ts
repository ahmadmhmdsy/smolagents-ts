import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { AgentEvent } from "../src/events.js";
import { buildTrace } from "../src/monitoring/trace.js";
import { readEvents } from "../src/session/event-log.js";
import { FileRunStore, type RunFileSystem } from "../src/session/file-run-store.js";
import { translateRecord, type RunRecord } from "../src/session/run-record.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import type { ChatMessage, ToolCallRequest } from "../src/types.js";

const RUN = "exit-run";
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

function condensing() {
  return {
    softLimit: 300,
    hardLimit: 1_000_000,
    keepRecent: 1,
    estimate: historyChars,
    summarize: (forgotten: readonly { id: string }[]) => "condensed " + forgotten.length + " step(s)",
  };
}

class MemoryFiles implements RunFileSystem {
  readonly files = new Map<string, string>();

  async read(path: string): Promise<string | undefined> {
    return this.files.get(path);
  }

  async write(path: string, data: string): Promise<void> {
    this.files.set(path, data);
  }

  async rename(from: string, to: string): Promise<void> {
    const data = this.files.get(from);
    if (data === undefined) throw new Error("rename source does not exist: " + from);
    this.files.delete(from);
    this.files.set(to, data);
  }

  async delete(path: string): Promise<void> {
    this.files.delete(path);
  }

  async list(): Promise<string[]> {
    return [...this.files.keys()];
  }
}

async function stream(agent: ToolCallingAgent, options: { reset?: boolean } = {}): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of agent.stream(TASK, { runId: RUN, ...options })) events.push(event);
  return events;
}

describe("Phase 3 exit criterion", () => {
  it("condenses a long session and the trace shows the forgetting event", async () => {
    const store = new FileRunStore(new MemoryFiles());
    const agent = new ToolCallingAgent({
      model: new MockModel([
        turn(call("note", { text: "first" }, "n1")),
        turn(call("note", { text: "second" }, "n2")),
        turn(call("note", { text: "third" }, "n3")),
        answerTurn("done"),
      ]),
      tools: [noteTool()],
      store,
      condensation: condensing(),
    });

    const events = await stream(agent);
    const condensed = events.filter((event) => event.type === "memory.condensed");
    expect(condensed.length).toBeGreaterThanOrEqual(1);
    expect(condensed[0]?.forgotten.length).toBeGreaterThan(0);

    const trace = buildTrace(events);
    const spans: { name: string; attributes: Record<string, unknown> }[] = [];
    const walk = (span: { name: string; attributes: Record<string, unknown>; children: readonly unknown[] }): void => {
      spans.push(span);
      for (const child of span.children) walk(child as typeof span);
    };
    walk(trace as never);
    const forgetting = spans.find((span) => span.name === "memory.condensed");
    expect(forgetting).toBeDefined();
    expect(forgetting?.attributes.forgotten).toEqual(condensed[0]?.forgotten);

    // The record keeps the step and the event, so a reload shows the same forgetting.
    const stored = await store.load(RUN);
    const record = translateRecord(stored as RunRecord, RUN);
    expect(record.memory.steps.some((step) => step.kind === "condensation")).toBe(true);
    expect(record.events?.some((entry) => entry.event.type === "memory.condensed")).toBe(true);
  });

  it("gives a reconnecting reader only the events after its cursor, across a second store", async () => {
    const files = new MemoryFiles();
    const first = new ToolCallingAgent({
      model: new MockModel([
        turn(call("note", { text: "first" }, "n1")),
        turn(call("note", { text: "second" }, "n2")),
        answerTurn("done"),
      ]),
      tools: [noteTool()],
      store: new FileRunStore(files),
      condensation: condensing(),
    });
    await stream(first);

    // The reader that was away kept this cursor: everything up to here it already has.
    const away = await readEvents(new FileRunStore(files), RUN);
    expect(away.events.length).toBeGreaterThan(0);
    expect(away.truncated).toBe(false);

    // The run continues while the reader is away; a second store is what a restart looks like.
    const second = new ToolCallingAgent({
      model: new MockModel([answerTurn("done again")]),
      tools: [noteTool()],
      store: new FileRunStore(files),
      condensation: condensing(),
    });
    const live = await stream(second, { reset: false });

    const reconnect = await readEvents(new FileRunStore(files), RUN, away.cursor);
    expect(reconnect.events.map((event) => event.seq)).toEqual(live.map((event) => event.seq));
    for (const event of reconnect.events) expect(event.seq).toBeGreaterThan(away.cursor);
    expect(reconnect.cursor).toBe(live[live.length - 1]?.seq);
    expect(reconnect.truncated).toBe(false);
  });
});
