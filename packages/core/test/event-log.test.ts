import { describe, expect, it } from "vitest";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { AgentEvent } from "../src/events.js";
import { readEvents } from "../src/session/event-log.js";
import { translateRecord, type RunRecord } from "../src/session/run-record.js";
import { MemoryRunStore } from "../src/session/run-store.js";
import { MockModel } from "../src/testing/mock-model.js";
import type { ToolCallRequest } from "../src/types.js";

const TASK = "answer with one";
const RUN = "run-log";

function answerTurn(value: number): {
  content: string;
  finishReason: "tool_calls";
  toolCalls: ToolCallRequest[];
} {
  return {
    content: "",
    finishReason: "tool_calls",
    toolCalls: [
      { id: "call-answer", name: FINAL_ANSWER_TOOL_NAME, arguments: JSON.stringify({ answer: value }) },
    ],
  };
}

function agentWith(model: MockModel, store?: MemoryRunStore, maxRecordedEvents?: number): ToolCallingAgent {
  return new ToolCallingAgent({
    model,
    ...(store === undefined ? {} : { store }),
    ...(maxRecordedEvents === undefined ? {} : { maxRecordedEvents }),
  });
}

async function collect(agent: ToolCallingAgent, options: Parameters<ToolCallingAgent["stream"]>[1]): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of agent.stream(TASK, options)) events.push(event);
  return events;
}

function recordOf(store: MemoryRunStore): RunRecord {
  const stored = store.load(RUN);
  if (stored === undefined) throw new Error("no record");
  return translateRecord(stored, RUN);
}

describe("the event log", () => {
  it("numbers every emitted event, strictly increasing", async () => {
    const events = await collect(agentWith(new MockModel([answerTurn(1)])), {});

    expect(events.length).toBeGreaterThan(3);
    expect(events[0]?.seq).toBe(1);
    for (let index = 1; index < events.length; index += 1) {
      expect(Number.isInteger(events[index]?.seq)).toBe(true);
      expect(events[index]!.seq).toBeGreaterThan(events[index - 1]!.seq);
    }
  });

  it("records the tail on the durable record and reads it back at a cursor", async () => {
    const store = new MemoryRunStore();
    const streamed = await collect(agentWith(new MockModel([answerTurn(2)]), store), { runId: RUN });

    const record = recordOf(store);
    const recorded = record.events ?? [];
    expect(recorded.length).toBeGreaterThan(3);
    expect(recorded.map((entry) => entry.seq)).toEqual(streamed.map((event) => event.seq));

    const cursor = recorded[recorded.length - 1]!.seq;
    const all = await readEvents(store, RUN);
    expect(all.cursor).toBe(cursor);
    expect(all.truncated).toBe(false);
    expect(all.events.map((event) => event.seq)).toEqual(streamed.map((event) => event.seq));

    const after = await readEvents(store, RUN, cursor);
    expect(after.events).toEqual([]);
    expect(after.cursor).toBe(cursor);

    const tail = await readEvents(store, RUN, 2);
    expect(tail.events.every((event) => event.seq > 2)).toBe(true);
    expect(tail.events.map((event) => event.seq)).toEqual(
      streamed.filter((event) => event.seq > 2).map((event) => event.seq),
    );
  });

  it("keeps at most maxRecordedEvents and reports truncation from an older cursor", async () => {
    const store = new MemoryRunStore();
    await collect(agentWith(new MockModel([answerTurn(3)]), store, 3), { runId: RUN });

    const recorded = recordOf(store).events ?? [];
    expect(recorded).toHaveLength(3);
    const base = recorded[0]!.seq;
    expect(base).toBeGreaterThan(0);

    const older = await readEvents(store, RUN, 0);
    expect(older.truncated).toBe(true);
    expect(older.events).toHaveLength(3);
    expect(older.events[0]?.seq).toBe(base);

    const current = await readEvents(store, RUN, base);
    expect(current.truncated).toBe(false);
    expect(current.events.map((event) => event.seq)).toEqual(
      recorded.slice(1).map((entry) => entry.seq),
    );
  });

  it("continues the sequence when a stored run is continued", async () => {
    const store = new MemoryRunStore();
    await collect(agentWith(new MockModel([answerTurn(4)]), store), { runId: RUN });
    const first = recordOf(store);
    const firstCursor = (first.events ?? []).at(-1)!.seq;

    const second = await collect(agentWith(new MockModel([answerTurn(5)]), store), {
      runId: RUN,
      reset: false,
    });
    expect(second[0]!.seq).toBeGreaterThan(firstCursor);
    for (let index = 1; index < second.length; index += 1) {
      expect(second[index]!.seq).toBeGreaterThan(second[index - 1]!.seq);
    }

    const since = await readEvents(store, RUN, firstCursor);
    expect(since.events.map((event) => event.seq)).toEqual(second.map((event) => event.seq));
    expect(since.cursor).toBe(second[second.length - 1]!.seq);
  });
});
