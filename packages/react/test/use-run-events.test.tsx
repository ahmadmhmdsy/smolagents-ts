import { describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { CodeAgent, MockModel, readEvents, type AgentEvent } from "@smolagents-ts/core";
import { useRunEvents } from "../src/use-run-events.js";
import { answering, fenced } from "./helpers.js";
import { MemoryRunStore } from "@smolagents-ts/core";

const TASK = "answer with one";
const RUN = "run-events";

function agentThatAnswersWith(store: MemoryRunStore, value: number, maxRecordedEvents?: number): CodeAgent {
  return new CodeAgent({
    model: new MockModel([fenced("answer", "final_answer(" + String(value) + ")")]),
    executor: answering(value),
    store,
    ...(maxRecordedEvents === undefined ? {} : { maxRecordedEvents }),
  });
}

async function run(agent: CodeAgent, options: { reset?: boolean } = {}): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of agent.stream(TASK, { runId: RUN, ...options })) events.push(event);
  return events;
}

function seqs(events: readonly AgentEvent[]): number[] {
  return events.map((event) => event.seq);
}

describe("useRunEvents", () => {
  it("reads the recorded tail and reports the cursor", async () => {
    const store = new MemoryRunStore();
    const streamed = await run(agentThatAnswersWith(store, 1));

    const { result } = renderHook(() => useRunEvents(store, RUN));
    await waitFor(() => expect(result.current.events.length).toBeGreaterThan(0));

    expect(seqs(result.current.events)).toEqual(seqs(streamed));
    expect(result.current.cursor).toBe(streamed[streamed.length - 1]!.seq);
    expect(result.current.truncated).toBe(false);
  });

  it("resumes after the cursor a caller kept, delivering only later events", async () => {
    const store = new MemoryRunStore();
    await run(agentThatAnswersWith(store, 2));
    const first = await readEvents(store, RUN);
    const second = await run(agentThatAnswersWith(store, 3), { reset: false });

    const { result } = renderHook(() => useRunEvents(store, RUN, { fromSeq: first.cursor }));
    await waitFor(() => expect(result.current.events.length).toBeGreaterThan(0));

    expect(seqs(result.current.events)).toEqual(seqs(second));
    expect(result.current.cursor).toBe(second[second.length - 1]!.seq);
  });

  it("appends the events a live run commits, once each", async () => {
    const store = new MemoryRunStore();
    const agent = agentThatAnswersWith(store, 4);
    const { result } = renderHook(() => useRunEvents(store, RUN));

    const streamed = await act(async () => run(agent));
    await waitFor(() => expect(result.current.cursor).toBe(streamed[streamed.length - 1]!.seq));

    expect(seqs(result.current.events)).toEqual(seqs(streamed));
    expect(new Set(seqs(result.current.events)).size).toBe(result.current.events.length);
  });

  it("says so when the cursor is older than the retained tail", async () => {
    const store = new MemoryRunStore();
    await run(agentThatAnswersWith(store, 5, 3));

    const { result } = renderHook(() => useRunEvents(store, RUN, { fromSeq: 1 }));
    await waitFor(() => expect(result.current.events.length).toBeGreaterThan(0));

    expect(result.current.truncated).toBe(true);
    expect(result.current.events).toHaveLength(3);
  });
});
