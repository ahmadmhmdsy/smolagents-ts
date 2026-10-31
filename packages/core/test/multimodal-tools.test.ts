import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CodeAgent } from "../src/agent/code-agent.js";
import { ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { AgentEvent } from "../src/events.js";
import { withAttachments } from "../src/media.js";
import { stepFromJSON, stepToJSON, ActionStep } from "../src/memory/steps.js";
import { CODE_FENCE } from "../src/prompts/templates.js";
import { MemoryMediaStore } from "../src/session/media-store.js";
import { MemoryRunStore, type RunRecord } from "../src/session/run-store.js";
import { MockModel, type MockTurn } from "../src/testing/mock-model.js";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";
import { tool, type ToolContext } from "../src/tool/tool.js";
import type { ChatMessage, ContentPart, ImagePart, MediaRef } from "../src/types.js";

const SENTINEL = [0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe];
const PNG: ImagePart = {
  type: "image",
  mediaType: "image/png",
  bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...SENTINEL]),
  alt: "the page",
};
const HANDLE = "Captured.\n[image attached: the page]";
const SHOWN: ContentPart[] = [{ type: "text", text: "Attached by the tools above:" }, PNG];

const screenshot = tool({
  name: "screenshot",
  description: "Take a screenshot.",
  inputSchema: z.object({}),
  execute: () => withAttachments("Captured.", [PNG]),
});

function call(id: string, name: string, args: object): MockTurn {
  return { toolCalls: [{ id, name, arguments: JSON.stringify(args) }], finishReason: "tool_calls" };
}

const ANSWER = call("b", "final_answer", { answer: "done" });
const TURNS = [call("a", "screenshot", {}), ANSWER];

function seeing(responses: MockTurn[], images = true): MockModel {
  return new MockModel({ responses, capabilities: { images, audio: true } });
}

function imagesIn(messages: readonly ChatMessage[] | undefined): ContentPart[] {
  return (messages ?? []).flatMap((message) =>
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

describe("a tool's media", () => {
  it("reaches the next model call in a user turn after the tool's message", async () => {
    const model = seeing(TURNS);

    await new ToolCallingAgent({ model, tools: [screenshot] }).run("Look");

    const next = model.calls[1] ?? [];
    expect(next.at(-2)).toMatchObject({ role: "tool", content: HANDLE });
    expect(next.at(-1)).toEqual({ role: "user", content: SHOWN });
  });

  it("leaves a run with no media exactly as it was", async () => {
    const plain = tool({ name: "plain", description: "Say hi.", inputSchema: z.object({}), execute: () => "hi" });
    const model = seeing([call("a", "plain", {}), ANSWER]);

    await new ToolCallingAgent({ model, tools: [plain] }).run("Look");

    expect(model.calls[1]?.at(-1)).toMatchObject({ role: "tool", content: "hi" });
  });

  it("stays out of every event, the record and the result", async () => {
    const store = new MemoryRunStore();
    const agent = new ToolCallingAgent({ model: seeing(TURNS), tools: [screenshot], store });

    const events = await collect(agent.stream("Look", { runId: "run-1" }));

    assertNoBytes(JSON.stringify(events));
    assertNoBytes(JSON.stringify(store.load("run-1")));
    const done = events.find((event) => event.type === "run.completed");
    expect(JSON.stringify(done)).toContain("[image: the page]");
  });

  it("round-trips by reference through a step's checkpoint form", () => {
    const ref: MediaRef = { id: "m1", mediaType: "image/png", byteLength: 16 };
    const step = new ActionStep();
    step.attachments = [ref];

    const restored = stepFromJSON(JSON.parse(JSON.stringify(stepToJSON(step)))) as ActionStep;

    expect(restored.attachments).toEqual([ref]);
  });

  it("adds nothing to the checkpoint form of a step with no media", () => {
    expect(stepToJSON(new ActionStep())).not.toHaveProperty("attachments");
  });
});

describe.each([
  { name: "without a journal", store: (): MemoryRunStore | undefined => undefined },
  { name: "with a journal", store: (): MemoryRunStore | undefined => new MemoryRunStore() },
])("a code agent's tool media, $name", ({ store }) => {
  it("gives the guest the handle and the next model call the image", async () => {
    const seen: unknown[] = [];
    let turn = 0;
    const executor = new ScriptedExecutor({
      handler: async (_code, options) => {
        turn += 1;
        if (turn > 1) return finalAnswerResult("done");
        const definition = options.tools.get("screenshot");
        const toolContext = { callId: "c1", signal: new AbortController().signal } as ToolContext;
        seen.push(await definition?.execute({}, toolContext));
        return { logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 1 };
      },
    });
    const fenced = CODE_FENCE + "\nscreenshot()\n" + CODE_FENCE;
    const model = seeing([{ content: "Thought: t\nCode:\n" + fenced }, { content: "Thought: t\nCode:\n" + fenced }]);
    const held = store();

    const agent = new CodeAgent({ model, tools: [screenshot], executor, ...(held ? { store: held } : {}) });
    const result = await agent.run("Look", held ? { runId: "run-1" } : {});

    expect(result.output).toBe("done");
    expect(seen).toEqual([HANDLE]);
    expect(model.calls[1]?.at(-1)).toEqual({ role: "user", content: SHOWN });
    if (held !== undefined) assertNoBytes(JSON.stringify(held.load("run-1")));
  });
});

describe("a refused attachment", () => {
  it("reaches the model as text, and the run goes on", async () => {
    const model = seeing(TURNS, false);

    const result = await new ToolCallingAgent({ model, tools: [screenshot] }).run("Look");

    expect(result.output).toBe("done");
    expect(model.calls[1]?.at(-1)?.role).toBe("tool");
    expect(model.calls[1]?.at(-1)?.content).toContain("[image refused:");
    expect(imagesIn(model.calls[1])).toEqual([]);
  });

  it("counts against the run's cap part by part", async () => {
    const model = seeing(TURNS);
    const twice = tool({
      name: "screenshot",
      description: "Take two.",
      inputSchema: z.object({}),
      execute: () => withAttachments("Two.", [PNG, PNG]),
    });
    // The cap counts encoded bytes: 16 bytes of PNG are 24 of base64, so one fits and two do not.
    const maxRunBytes = 30;

    await new ToolCallingAgent({ model, tools: [twice], mediaLimits: { maxRunBytes } }).run("Look");

    const toolTurn = model.calls[1]?.find((message) => message.role === "tool");
    expect(toolTurn?.content).toContain("[image attached: the page]");
    expect(toolTurn?.content).toContain("[image refused:");
    expect(imagesIn(model.calls[1])).toEqual([PNG]);
  });
});

describe("a later run over the same record", () => {
  async function parkedRun(media: MemoryMediaStore): Promise<MemoryRunStore> {
    const store = new MemoryRunStore();
    await new ToolCallingAgent({ model: seeing(TURNS), tools: [screenshot], store, mediaStore: media }).run("Look", {
      runId: "run-1",
    });
    const record = store.load("run-1") as RunRecord;
    // Put the record back to the state a crash leaves, so a later run continues it.
    store.commit("run-1", { ...record, status: "running" }, record.generation);
    return store;
  }

  it("journals a reference, so a replay holds no bytes", async () => {
    const store = await parkedRun(new MemoryMediaStore());

    const entries = (store.load("run-1") as RunRecord).journal ?? [];
    const recorded = entries.find((entry) => entry.toolName === "screenshot");

    expect(JSON.stringify(recorded)).toContain("tool-media");
    assertNoBytes(JSON.stringify(recorded));
  });

  it("finds a tool's media in the store on resume", async () => {
    const media = new MemoryMediaStore();
    const store = await parkedRun(media);
    const model = seeing([ANSWER]);

    await new ToolCallingAgent({ model, tools: [screenshot], store, mediaStore: media }).run("Go on", {
      runId: "run-1",
      reset: false,
    });

    expect(imagesIn(model.calls[0]).map((part) => (part as ImagePart).bytes)).toEqual([PNG.bytes]);
  });

  it("fails by name when a tool's media has left the store", async () => {
    const store = await parkedRun(new MemoryMediaStore());
    const model = seeing([ANSWER]);

    const agent = new ToolCallingAgent({ model, tools: [screenshot], store, mediaStore: new MemoryMediaStore() });
    const events = await collect(agent.stream("Go on", { runId: "run-1", reset: false }));

    expect(model.callCount).toBe(0);
    expect(events.find((event) => event.type === "run.failed")).toMatchObject({
      error: { code: "AGENT_MEDIA_MISSING" },
    });
  });
});
