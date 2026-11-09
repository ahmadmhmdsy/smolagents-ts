import { describe, expect, it } from "vitest";
import { ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { AgentError } from "../src/errors.js";
import type { AgentEvent } from "../src/events.js";
import { AgentMemory } from "../src/memory/memory.js";
import { TaskStep, stepFromJSON, stepToJSON } from "../src/memory/steps.js";
import { MemoryMediaStore, type MediaStore } from "../src/session/media-store.js";
import { MemoryRunStore, type RunRecord } from "../src/session/run-store.js";
import { MockModel, type MockTurn } from "../src/testing/mock-model.js";
import type { ChatMessage, ContentPart, ImagePart } from "../src/types.js";

// A PNG signature, then a run of bytes no serialisation of anything else would spell.
const SENTINEL = [0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe];
const PNG: ImagePart = {
  type: "image",
  mediaType: "image/png",
  bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...SENTINEL]),
  alt: "a sign",
  detail: "low",
};
const TASK: ContentPart[] = [
  { type: "text", text: "Before" },
  PNG,
  { type: "text", text: "After" },
];
const ANSWER: MockTurn = {
  toolCalls: [{ id: "a", name: "final_answer", arguments: JSON.stringify({ answer: "done" }) }],
  finishReason: "tool_calls",
};

function seeing(responses: MockTurn[], images = true): MockModel {
  return new MockModel({ responses, capabilities: { images, audio: true } });
}

function imagesIn(messages: readonly ChatMessage[]): ContentPart[] {
  return messages.flatMap((message) =>
    typeof message.content === "string" ? [] : message.content.filter((part) => part.type === "image"),
  );
}

/** Every way the bytes could be written down: as numbers, as a keyed object, and as base64. */
function assertNoBytes(serialised: string): void {
  expect(serialised).not.toContain(SENTINEL.join(","));
  expect(serialised).not.toContain('"bytes"');
  expect(serialised).not.toContain(btoa(String.fromCharCode(...PNG.bytes)));
}

async function collect(stream: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

async function parkedRun(media: MemoryMediaStore): Promise<{ store: MemoryRunStore; runId: string }> {
  const store = new MemoryRunStore();
  const runId = "run-1";
  const agent = new ToolCallingAgent({ model: seeing([ANSWER]), tools: [], store, mediaStore: media });
  await agent.run(TASK, { runId });
  const record = store.load(runId) as RunRecord;
  // Put the record back to the state a crash leaves, so a later run continues it.
  store.commit(runId, { ...record, status: "running" }, record.generation);
  return { store, runId };
}

describe("a checkpoint of a run with media", () => {
  it("holds references and no bytes", () => {
    const step = new TaskStep("Before\nAfter", [
      { type: "text", text: "Before" },
      { type: "ref", ref: { id: "m1", mediaType: "image/png", byteLength: 16, alt: "a sign" } },
      { type: "text", text: "After" },
    ]);

    const restored = stepFromJSON(JSON.parse(JSON.stringify(stepToJSON(step)))) as TaskStep;

    expect(restored.parts).toEqual(step.parts);
    expect(restored.attachments).toEqual([
      { id: "m1", mediaType: "image/png", byteLength: 16, alt: "a sign" },
    ]);
  });

  it("writes a string task exactly as 0.1.0 did, and reads it back", () => {
    const json = stepToJSON(new TaskStep("hello"));
    expect(json).not.toHaveProperty("parts");
    const restored = stepFromJSON(json) as TaskStep;
    expect(restored.parts).toBeUndefined();
    expect(restored.task).toBe("hello");
  });
});

describe("the bytes of a run", () => {
  it("appear in no snapshot, event or trace span", async () => {
    const store = new MemoryRunStore();
    const media = new MemoryMediaStore();
    const model = seeing([ANSWER]);
    const traces: unknown[] = [];
    const exporter = { export: (trace: unknown): void => void traces.push(trace) };
    const agent = new ToolCallingAgent({ model, tools: [], store, mediaStore: media, exporter });

    const events = await collect(agent.stream(TASK, { runId: "run-1" }));

    assertNoBytes(JSON.stringify(events));
    assertNoBytes(JSON.stringify(await store.load("run-1")));
    expect(traces).toHaveLength(1);
    assertNoBytes(JSON.stringify(traces));
    expect(imagesIn(model.calls[0] ?? [])).toEqual([PNG]);
  });

  it("stay out of the result, which names the image instead", async () => {
    const agent = new ToolCallingAgent({ model: seeing([ANSWER]), tools: [] });

    const result = await agent.run(TASK);

    assertNoBytes(JSON.stringify(result.messages));
    expect(result.messages.find((message) => message.role === "user")?.content).toEqual([
      { type: "text", text: "Before" },
      { type: "text", text: "[image: a sign]" },
      { type: "text", text: "After" },
    ]);
  });

  it("leave a request's digest stable, and bound to their length", async () => {
    async function digestOf(task: ContentPart[]): Promise<string | undefined> {
      const store = new MemoryRunStore();
      const agent = new ToolCallingAgent({ model: seeing([ANSWER]), tools: [], store });
      await agent.run(task, { runId: "run-1" });
      const entries = (store.load("run-1") as RunRecord).journal ?? [];
      return entries.find((entry) => entry.toolName === "")?.argsDigest;
    }
    const longer: ImagePart = { ...PNG, bytes: Uint8Array.from([...PNG.bytes, 0]) };

    const digest = await digestOf(TASK);

    expect(digest).toMatch(/^v1:/);
    expect(await digestOf(TASK)).toBe(digest);
    expect(await digestOf([TASK[0] as ContentPart, longer, TASK[2] as ContentPart])).not.toBe(digest);
  });

  it("keep the order of text and image", async () => {
    const model = seeing([ANSWER]);
    await new ToolCallingAgent({ model, tools: [] }).run(TASK);

    expect(model.calls[0]?.find((message) => message.role === "user")?.content).toEqual(TASK);
  });
});

describe("a resume of a run with media", () => {
  it("finds the bytes in the store", async () => {
    const media = new MemoryMediaStore();
    const { store, runId } = await parkedRun(media);
    const model = seeing([ANSWER]);

    await new ToolCallingAgent({ model, tools: [], store, mediaStore: media }).run("Go on", { runId, reset: false });

    expect(imagesIn(model.calls[0] ?? []).map((part) => (part as ImagePart).bytes)).toEqual([PNG.bytes]);
  });

  it("fails by name when the bytes are gone, with no call and the record unchanged", async () => {
    const { store, runId } = await parkedRun(new MemoryMediaStore());
    const before = JSON.stringify(await store.load(runId));
    const model = seeing([ANSWER]);

    const agent = new ToolCallingAgent({ model, tools: [], store, mediaStore: new MemoryMediaStore() });
    const events = await collect(agent.stream("Go on", { runId, reset: false }));

    expect(model.callCount).toBe(0);
    const failed = events.find((event) => event.type === "run.failed");
    expect(failed).toMatchObject({ error: { code: "AGENT_MEDIA_MISSING" } });
    expect(JSON.stringify(await store.load(runId))).toBe(before);
  });

  it("treats bytes of the wrong length as gone", async () => {
    const media = new MemoryMediaStore();
    const { store, runId } = await parkedRun(media);
    const shortened: MediaStore = {
      put: (part) => media.put(part),
      get: () => PNG.bytes.subarray(0, 8),
      delete: (id) => media.delete(id),
    };

    const agent = new ToolCallingAgent({ model: seeing([ANSWER]), tools: [], store, mediaStore: shortened });
    const error = await agent.run("Go on", { runId, reset: false }).then(
      () => undefined,
      (failure: unknown) => failure as AgentError,
    );

    expect(error?.code).toBe("AGENT_MEDIA_MISSING");
  });

  it("refuses a model that cannot take what the run holds", async () => {
    const media = new MemoryMediaStore();
    const { store, runId } = await parkedRun(media);
    const model = seeing([ANSWER], false);

    const agent = new ToolCallingAgent({ model, tools: [], store, mediaStore: media });
    const events = await collect(agent.stream("Go on", { runId, reset: false }));

    expect(model.callCount).toBe(0);
    expect(events.find((event) => event.type === "run.failed")).toMatchObject({
      error: { code: "AGENT_UNSUPPORTED_CONTENT" },
    });
  });
});

describe("a transcript with no bytes behind a reference", () => {
  it("reads as a placeholder instead of dropping the attachment", () => {
    const memory = new AgentMemory();
    memory.addStep(
      new TaskStep("Look", [
        { type: "text", text: "Look" },
        { type: "ref", ref: { id: "m1", mediaType: "image/png", byteLength: 8, alt: "a sign" } },
      ]),
    );

    const task = memory.toMessages().find((message) => message.role === "user");

    expect(task?.content).toEqual([
      { type: "text", text: "Look" },
      { type: "text", text: "[image: a sign]" },
    ]);
  });
});

describe("the store", () => {
  it("names bytes by a ref that carries their description", async () => {
    const media = new MemoryMediaStore();
    const ref = media.put(PNG);

    expect(ref).toMatchObject({ mediaType: "image/png", byteLength: PNG.bytes.byteLength, alt: "a sign", detail: "low" });
    expect(media.get(ref)).toEqual(PNG.bytes);
    media.delete(ref.id);
    expect(await media.get(ref)).toBeUndefined();
  });
});
