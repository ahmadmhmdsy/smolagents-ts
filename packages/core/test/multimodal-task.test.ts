import { describe, expect, it } from "vitest";
import { ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { AgentError } from "../src/errors.js";
import type { AgentEvent } from "../src/events.js";
import type { ChatCompletion, ChatCompletionChunk, Model } from "../src/model.js";
import { modelCapabilities } from "../src/model.js";
import type { AgentMemory } from "../src/memory/memory.js";
import { AgentSession } from "../src/session/agent-session.js";
import { MockModel, type MockTurn } from "../src/testing/mock-model.js";
import type { ChatMessage, ContentPart, ImagePart } from "../src/types.js";

const PNG: ImagePart = {
  type: "image",
  mediaType: "image/png",
  bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};
const TASK: ContentPart[] = [{ type: "text", text: "What is this?" }, PNG];

function call(id: string, name: string, args: object): MockTurn {
  return { toolCalls: [{ id, name, arguments: JSON.stringify(args) }], finishReason: "tool_calls" };
}

class OpenAgent extends ToolCallingAgent {
  get record(): AgentMemory {
    return this.memory;
  }
}

const ANSWER = call("a", "final_answer", { answer: "a sign" });

function seeing(responses: Array<string | MockTurn>): MockModel {
  return new MockModel({ responses, capabilities: { images: true, audio: true } });
}

function imagesIn(messages: readonly ChatMessage[]): ContentPart[] {
  return messages.flatMap((message) =>
    typeof message.content === "string" ? [] : message.content.filter((part) => part.type === "image"),
  );
}

async function collect(stream: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

async function refusal(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe("a task with media", () => {
  it("reaches every step's request", async () => {
    const model = seeing([call("n", "not_a_tool", {}), ANSWER]);
    const agent = new ToolCallingAgent({ model, tools: [] });

    await agent.run(TASK);

    expect(model.calls).toHaveLength(2);
    for (const messages of model.calls) expect(imagesIn(messages)).toEqual([PNG]);
    expect(model.calls[0]?.find((message) => message.role === "user")?.content).toEqual(TASK);
  });

  it("reaches the initial plan and the plan's update", async () => {
    const model = seeing(["the plan", call("n", "not_a_tool", {}), "the new plan", ANSWER]);
    const agent = new ToolCallingAgent({ model, tools: [], planningInterval: 1 });

    await agent.run(TASK);

    expect(model.calls).toHaveLength(4);
    for (const messages of model.calls) expect(imagesIn(messages)).toEqual([PNG]);
    const planned = model.calls[0]?.[0]?.content as readonly ContentPart[];
    expect(planned[0]?.type).toBe("text");
    expect((planned[0] as { text: string }).text).toContain("What is this?");
  });

  it("keeps the task text in events and the record of memory", async () => {
    const model = seeing([ANSWER]);
    const agent = new OpenAgent({ model, tools: [] });

    const events = await collect(agent.stream(TASK));

    const started = events.find((event) => event.type === "run.started");
    expect(started).toMatchObject({ task: "What is this?" });
    expect(JSON.stringify(agent.record.toJSON())).not.toContain("image/png");
    expect(agent.record.toChatMessages()[0]).toEqual({ role: "user", content: "What is this?" });
  });

  it("carries through a session", async () => {
    const model = seeing([ANSWER]);
    const session = new AgentSession(new ToolCallingAgent({ model, tools: [] }));

    await session.send(TASK);

    expect(imagesIn(model.calls[0] ?? [])).toEqual([PNG]);
    expect(session.getSnapshot().task).toBe("What is this?");
  });
});

describe("a task the model cannot take", () => {
  it("fails before any model call when the capability is missing", async () => {
    const model = new MockModel([ANSWER]);
    const agent = new OpenAgent({ model, tools: [] });

    const events = await collect(agent.stream(TASK));

    expect(model.callCount).toBe(0);
    expect(events.map((event) => event.type)).toEqual(["run.started", "run.failed"]);
    expect(agent.record.steps.some((step) => step.kind === "task")).toBe(false);
  });

  it("keeps the typed code through run", async () => {
    const agent = new ToolCallingAgent({ model: new MockModel([]), tools: [] });
    const error = (await refusal(agent.run(TASK))) as AgentError;
    expect(error.code).toBe("AGENT_UNSUPPORTED_CONTENT");
  });

  it("treats a model on the earlier contract as blind, whatever it declares", async () => {
    let calls = 0;
    const legacy: Model = {
      id: "old",
      provider: "old",
      capabilities: modelCapabilities({ images: true }),
      generate: (): Promise<ChatCompletion> => {
        calls += 1;
        return Promise.reject(new Error("unreachable"));
      },
      async *generateStream(): AsyncGenerator<ChatCompletionChunk> {
        calls += 1;
        await Promise.resolve();
        yield* [];
      },
    };
    const agent = new ToolCallingAgent({ model: legacy, tools: [] });

    const error = (await refusal(agent.run(TASK))) as AgentError;

    expect(error.code).toBe("AGENT_UNSUPPORTED_CONTENT");
    expect(calls).toBe(0);
  });

  it("applies the agent's media limits", async () => {
    const model = seeing([ANSWER]);
    const agent = new ToolCallingAgent({ model, tools: [], mediaLimits: { maxPartBytes: 4 } });

    const error = (await refusal(agent.run(TASK))) as AgentError;

    expect(error.code).toBe("AGENT_CONTENT_TOO_LARGE");
    expect(model.callCount).toBe(0);
  });
});

describe("a task that is only text", () => {
  it("sends a text-only parts array as the plain string", async () => {
    const asString = seeing([ANSWER]);
    await new ToolCallingAgent({ model: asString, tools: [] }).run("What is this?");
    const asParts = seeing([ANSWER]);
    await new ToolCallingAgent({ model: asParts, tools: [] }).run([{ type: "text", text: "What is this?" }]);

    expect(asParts.calls).toEqual(asString.calls);
    expect(asParts.calls[0]?.find((message) => message.role === "user")?.content).toBe("What is this?");
  });

  it("does not ask a blind model about parts that hold no media", async () => {
    const model = new MockModel([ANSWER]);
    const agent = new ToolCallingAgent({ model, tools: [] });
    await expect(agent.run([{ type: "text", text: "hi" }])).resolves.toMatchObject({ output: "a sign" });
  });
});

describe("the condensation estimate", () => {
  it("counts text and ignores the bytes", async () => {
    const big: ImagePart = { ...PNG, bytes: new Uint8Array(1_000_000) };
    big.bytes.set(PNG.bytes);
    const model = seeing([ANSWER]);
    const agent = new ToolCallingAgent({
      model,
      tools: [],
      condensation: {
        softLimit: 1000,
        hardLimit: 2000,
        keepRecent: 0,
        summarize: () => {
          throw new Error("an image alone must not cross the threshold");
        },
      },
    });

    await agent.run([{ type: "text", text: "hi" }, big]);

    expect(model.callCount).toBe(1);
  });
});
