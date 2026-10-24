import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ActionStep,
  CodeAgent,
  MockModel,
  ScriptedExecutor,
  ToolCallingAgent,
  ToolHostedError,
  ToolTimeoutError,
  finalAnswerResult,
  noopLogger,
  tool,
  type AgentEvent,
  type ToolContext,
} from "../src/index.js";

const emptySchema = z.object({});
const FENCE = String.fromCharCode(96, 96, 96);

function fenced(code: string): string {
  return FENCE + "javascript\n" + code + "\n" + FENCE;
}

function context(onProgress?: (progress: unknown) => void): ToolContext {
  return {
    signal: new AbortController().signal,
    fetch: globalThis.fetch,
    callId: "call-1",
    stepIndex: 0,
    logger: noopLogger,
    ...(onProgress === undefined ? {} : { onProgress }),
  };
}

const counting = tool({
  name: "counting",
  description: "counts to two",
  inputSchema: emptySchema,
  async *execute(): AsyncGenerator<string, string, void> {
    yield "a";
    yield "b";
    return "done";
  },
});

describe("a generator tool", () => {
  it("resolves its return value and reports each yield to the sink", async () => {
    const seen: unknown[] = [];
    const output = await counting.execute({}, context((progress) => seen.push(progress)));
    expect(output).toBe("done");
    expect(seen).toEqual(["a", "b"]);
  });

  it("is drained inside its deadline, so a slow generator times out", async () => {
    const slow = tool({
      name: "slow",
      description: "never settles",
      inputSchema: emptySchema,
      timeoutMs: 20,
      async *execute(): AsyncGenerator<number, string, void> {
        yield 1;
        await new Promise(() => {
          // Deliberately never settles.
        });
        return "unreachable";
      },
    });
    await expect(slow.execute({}, context())).rejects.toBeInstanceOf(ToolTimeoutError);
  });

  it("reports progress in a tool-calling run between the request and the result", async () => {
    const mock = new MockModel([
      { toolCalls: [{ id: "call-count", name: "counting", arguments: "{}" }] },
      { toolCalls: [{ id: "call-answer", name: "final_answer", arguments: '{"answer":"done"}' }] },
    ]);
    const agent = new ToolCallingAgent({ model: mock, tools: [counting] });
    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));
    const result = await agent.run("task");

    const named = events.filter(
      (event) =>
        (event.type === "action.requested" || event.type === "action.progress" || event.type === "action.result") &&
        event.name === "counting",
    );
    expect(named.map((event) => event.type)).toEqual([
      "action.requested",
      "action.progress",
      "action.progress",
      "action.result",
    ]);
    const progress = named
      .filter((event) => event.type === "action.progress")
      .map((event) => (event.type === "action.progress" ? event.progress : undefined));
    expect(progress).toEqual(["a", "b"]);
    const answering = result.steps.filter(
      (step): step is ActionStep => step.kind === "action" && step.toolCalls.length > 0,
    );
    expect(answering[0]!.toolCalls[0]!.result).toBe("done");
  });

  it("reaches the event stream through a scripted executor too", async () => {
    const executor = new ScriptedExecutor({
      results: { 'final_answer("done")': finalAnswerResult("done") },
      handler: (code, options) => {
        if (!code.includes("counting()")) throw new Error("unexpected code: " + code);
        options.onToolCall?.({ type: "requested", callId: "call-1", name: "counting", args: {} });
        options.onToolCall?.({ type: "progress", callId: "call-1", name: "counting", progress: "a" });
        options.onToolCall?.({ type: "progress", callId: "call-1", name: "counting", progress: "b" });
        options.onToolCall?.({ type: "result", callId: "call-1", name: "counting", output: "done", durationMs: 1 });
        return { logs: "", isFinalAnswer: false, durationMs: 1, toolCallCount: 1 };
      },
    });
    const agent = new CodeAgent({
      model: new MockModel([fenced("counting()"), fenced('final_answer("done")')]),
      executor,
    });
    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));
    const result = await agent.run("task");

    expect(result.output).toBe("done");
    const progress = events
      .filter((event) => event.type === "action.progress")
      .map((event) => (event.type === "action.progress" ? event.progress : undefined));
    expect(progress).toEqual(["a", "b"]);
  });
});

describe("a hosted tool", () => {
  const hosted = tool({
    name: "vendor_search",
    description: "vendor search",
    inputSchema: z.object({ query: z.string() }),
    kind: "hosted",
    hosted: { provider: "vendor-x", spec: { maxResults: 3 } },
  });

  it("is advertised with its kind and provider payload", async () => {
    const mock = new MockModel([
      { toolCalls: [{ id: "call-answer", name: "final_answer", arguments: '{"answer":"done"}' }] },
    ]);
    const agent = new ToolCallingAgent({ model: mock, tools: [hosted] });
    await agent.run("task");

    const spec = (mock.requestOptions[0]!.tools ?? []).find((entry) => entry.name === "vendor_search");
    expect(spec).toBeDefined();
    expect(spec!.kind).toBe("hosted");
    expect(spec!.hosted).toEqual({ provider: "vendor-x", spec: { maxResults: 3 } });
  });

  it("is not in the registry the executor receives", async () => {
    const seen: (string | undefined)[] = [];
    const executor = new ScriptedExecutor({
      results: { 'final_answer("done")': finalAnswerResult("done") },
      handler: (code, options) => {
        if (!code.includes("vendor_search()")) throw new Error("unexpected code: " + code);
        seen.push(options.tools.get("vendor_search")?.name);
        return { logs: "", isFinalAnswer: false, durationMs: 1, toolCallCount: 0 };
      },
    });
    const agent = new CodeAgent({
      model: new MockModel([fenced("vendor_search()"), fenced('final_answer("done")')]),
      executor,
      tools: [hosted],
    });
    await agent.run("task");
    expect(seen).toEqual([undefined]);
  });

  it("fails a model call naming it with AGENT_TOOL_HOSTED naming the provider", async () => {
    const mock = new MockModel([
      { toolCalls: [{ id: "call-vendor", name: "vendor_search", arguments: '{"query":"x"}' }] },
      { toolCalls: [{ id: "call-answer", name: "final_answer", arguments: '{"answer":"done"}' }] },
    ]);
    const agent = new ToolCallingAgent({ model: mock, tools: [hosted] });
    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));
    const result = await agent.run("task");

    expect(result.output).toBe("done");
    const failed = events.find((event) => event.type === "action.failed");
    expect(failed).toBeDefined();
    if (failed!.type !== "action.failed") throw new Error("unreachable");
    expect(failed!.error.code).toBe("AGENT_TOOL_HOSTED");
    expect(failed!.error.message).toContain("vendor-x");
  });
});

describe("ToolHostedError", () => {
  it("refuses a direct call to a hosted tool's body and carries the provider", async () => {
    const hosted = tool({
      name: "vendor_lookup",
      description: "vendor lookup",
      inputSchema: z.object({}),
      kind: "hosted",
      hosted: { provider: "vendor-y", spec: {} },
    });
    await expect(hosted.execute({}, context())).rejects.toBeInstanceOf(ToolHostedError);
    expect(hosted.execute).toBeDefined();
  });

  it("is an error carrying the provider", () => {
    const error = new ToolHostedError("hosted by vendor-x", { provider: "vendor-x" });
    expect(error.code).toBe("AGENT_TOOL_HOSTED");
    expect(error.provider).toBe("vendor-x");
  });
});
