import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { RunResult } from "../src/agent/run-result.js";
import type { AgentEvent } from "../src/events.js";
import { noopLogger } from "../src/logger.js";
import { createOtlpHttpExporter, type SpanExporter } from "../src/monitoring/otel.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import type { ToolCallRequest } from "../src/types.js";

const echo = tool({
  name: "echo",
  description: "Echo the text back.",
  inputSchema: z.object({ text: z.string() }),
  execute: ({ text }) => "echoed: " + text,
});

function call(name: string, args: unknown, id: string): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

function turn(toolCalls: ToolCallRequest[], usage: { inputTokens: number; outputTokens: number }) {
  return {
    content: "",
    finishReason: "tool_calls" as const,
    toolCalls,
    usage: { ...usage, totalTokens: usage.inputTokens + usage.outputTokens },
  };
}

function answerTurn(usage: { inputTokens: number; outputTokens: number }) {
  return turn([call(FINAL_ANSWER_TOOL_NAME, { answer: "done" }, "answer-1")], usage);
}

function scriptedModel(): MockModel {
  return new MockModel({
    id: "mock-model",
    responses: [
      turn([call("echo", { text: "hi" }, "call-1")], { inputTokens: 10, outputTokens: 5 }),
      answerTurn({ inputTokens: 3, outputTokens: 2 }),
    ],
  });
}

interface Posted {
  readonly url: string;
  readonly init: RequestInit;
}

function okResponse(): Response {
  return { ok: true, status: 200, text: async () => "" } as unknown as Response;
}

function recordingFetch(response: Response = okResponse()): {
  posts: Posted[];
  fetch: typeof globalThis.fetch;
} {
  const posts: Posted[] = [];
  const fetchImpl = async (url: string, init: RequestInit): Promise<Response> => {
    posts.push({ url, init });
    return response;
  };
  return { posts, fetch: fetchImpl as unknown as typeof globalThis.fetch };
}

async function run(
  agent: ToolCallingAgent,
  task = "echo hi",
): Promise<{ events: AgentEvent[]; result?: RunResult }> {
  const events: AgentEvent[] = [];
  let result: RunResult | undefined;
  for await (const event of agent.stream(task)) {
    events.push(event);
    if (event.type === "run.completed") result = event.result as RunResult;
  }
  return { events, ...(result === undefined ? {} : { result }) };
}

function otlp(payload: unknown): Record<string, unknown> {
  return payload as Record<string, unknown>;
}

function spansOf(payload: unknown): Record<string, unknown>[] {
  const resourceSpans = otlp(payload).resourceSpans as Record<string, unknown>[];
  const scopeSpans = resourceSpans[0]?.scopeSpans as Record<string, unknown>[];
  return (scopeSpans[0]?.spans ?? []) as Record<string, unknown>[];
}

function attribute(span: Record<string, unknown>, key: string): unknown {
  const list = (span.attributes ?? []) as { key: string; value: Record<string, unknown> }[];
  return list.find((entry) => entry.key === key)?.value;
}

function textOf(span: Record<string, unknown>, key: string): string | undefined {
  const value = attribute(span, key) as Record<string, unknown> | undefined;
  if (value === undefined) return undefined;
  const picked = value.stringValue ?? value.intValue ?? value.doubleValue ?? value.boolValue;
  return picked === undefined ? undefined : String(picked);
}

function spanNamed(spans: readonly Record<string, unknown>[], name: string): Record<string, unknown> {
  const found = spans.find((span) => span.name === name);
  if (found === undefined) throw new Error("no span named " + name);
  return found;
}

const TRACES_URL = "http://collector.test/v1/traces";

describe("the OTel exporter", () => {
  it("is never wired at import: a run with no exporter makes no request at all", async () => {
    const globalFetch = vi.spyOn(globalThis, "fetch");
    try {
      const { result } = await run(new ToolCallingAgent({ model: scriptedModel(), tools: [echo] }));
      expect(result?.output).toBe("done");
      expect(globalFetch).not.toHaveBeenCalled();
    } finally {
      globalFetch.mockRestore();
    }
  });

  it("posts one OTLP payload whose spans carry model, provider, tool, step and timing", async () => {
    const { posts, fetch } = recordingFetch();
    const exporter = createOtlpHttpExporter({
      url: TRACES_URL,
      fetch,
      serviceName: "phase-5-test",
    });
    const { result } = await run(
      new ToolCallingAgent({ model: scriptedModel(), tools: [echo], exporter }),
      "echo hi",
    );
    expect(result?.output).toBe("done");
    expect(posts).toHaveLength(1);
    const posted = posts[0];
    if (posted === undefined) throw new Error("nothing was posted");
    expect(posted.url).toBe(TRACES_URL);
    expect(posted.init.method).toBe("POST");
    expect((posted.init.headers as Record<string, string>)["content-type"]).toBe(
      "application/json",
    );

    const payload = otlp(JSON.parse(String(posted.init.body)));
    const resourceSpans = payload.resourceSpans as Record<string, unknown>[];
    expect(resourceSpans).toHaveLength(1);
    const resource = resourceSpans[0]?.resource as Record<string, unknown>;
    const resourceAttributes = resource.attributes as { key: string; value: Record<string, unknown> }[];
    expect(
      resourceAttributes.find((entry) => entry.key === "service.name")?.value.stringValue,
    ).toBe("phase-5-test");
    const scopeSpans = resourceSpans[0]?.scopeSpans as Record<string, unknown>[];
    const scope = scopeSpans[0]?.scope as Record<string, unknown>;
    expect(scope.name).toBe("@smolagents-ts/core");

    const spans = spansOf(payload);
    expect(spans.map((span) => span.name)).toEqual(["run", "step.0", "tool.echo", "step.1"]);
    const root = spanNamed(spans, "run");
    const step0 = spanNamed(spans, "step.0");
    const toolSpan = spanNamed(spans, "tool.echo");
    const step1 = spanNamed(spans, "step.1");

    expect(root.traceId).toMatch(/^[0-9a-f]{32}$/);
    for (const span of spans) {
      expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(span.startTimeUnixNano).toMatch(/^\d+$/);
      expect(span.endTimeUnixNano).toMatch(/^\d+$/);
      expect(BigInt(String(span.endTimeUnixNano))).toBeGreaterThanOrEqual(
        BigInt(String(span.startTimeUnixNano)),
      );
      expect((span.status as Record<string, unknown>).code).toBe(1);
    }
    expect(toolSpan.parentSpanId).toBe(step0.spanId);
    expect(step1.parentSpanId).toBe(root.spanId);
    expect(new Set(spans.map((span) => span.spanId)).size).toBe(spans.length);

    expect(textOf(root, "gen_ai.operation.name")).toBe("invoke_agent");
    expect(textOf(root, "gen_ai.request.model")).toBe("mock-model");
    expect(textOf(root, "gen_ai.provider.name")).toBe("mock");
    expect(textOf(root, "gen_ai.usage.input_tokens")).toBe("13");
    expect(textOf(root, "gen_ai.usage.output_tokens")).toBe("7");
    expect(textOf(step0, "stepIndex")).toBe("0");
    expect(textOf(step0, "durationMs")).toMatch(/^\d+$/);
    expect(textOf(toolSpan, "gen_ai.operation.name")).toBe("execute_tool");
    expect(textOf(toolSpan, "gen_ai.tool.name")).toBe("echo");
    expect(textOf(toolSpan, "durationMs")).toMatch(/^\d+$/);
  });

  it("keeps task text, code, arguments and output out of the attributes unless asked", async () => {
    const bare = recordingFetch();
    await run(
      new ToolCallingAgent({
        model: scriptedModel(),
        tools: [echo],
        exporter: createOtlpHttpExporter({ url: TRACES_URL, fetch: bare.fetch }),
      }),
      "echo a secret task",
    );
    const barePayload = otlp(JSON.parse(String(bare.posts[0]?.init.body)));
    const bareSpans = spansOf(barePayload);
    expect(textOf(spanNamed(bareSpans, "run"), "task")).toBeUndefined();
    expect(attribute(spanNamed(bareSpans, "tool.echo"), "tool.arguments")).toBeUndefined();
    expect(attribute(spanNamed(bareSpans, "tool.echo"), "tool.output")).toBeUndefined();
    expect(JSON.stringify(barePayload)).not.toContain("echo a secret task");

    const loud = recordingFetch();
    await run(
      new ToolCallingAgent({
        model: scriptedModel(),
        tools: [echo],
        exporter: createOtlpHttpExporter({
          url: TRACES_URL,
          fetch: loud.fetch,
          includePayloads: true,
        }),
      }),
      "echo a secret task",
    );
    const loudPayload = otlp(JSON.parse(String(loud.posts[0]?.init.body)));
    const loudSpans = spansOf(loudPayload);
    expect(textOf(spanNamed(loudSpans, "run"), "task")).toBe("echo a secret task");
    expect(textOf(spanNamed(loudSpans, "tool.echo"), "tool.arguments")).toContain("hi");
    expect(textOf(spanNamed(loudSpans, "tool.echo"), "tool.output")).toBe("echoed: hi");
  });

  it("lets an exporter fail without failing the run", async () => {
    const warn = vi.fn();
    const logger = { ...noopLogger, warn };
    const throwing: SpanExporter = {
      export: () => {
        throw new Error("the collector is down");
      },
    };
    const rejecting: SpanExporter = { export: () => Promise.reject(new Error("still down")) };
    for (const exporter of [throwing, rejecting]) {
      const { events, result } = await run(
        new ToolCallingAgent({ model: scriptedModel(), tools: [echo], exporter, logger }),
      );
      expect(result?.output).toBe("done");
      expect(events.at(-1)?.type).toBe("run.completed");
    }
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]?.[0])).toContain("export");
  });

  it("exports a failed run's root span with an error status", async () => {
    const { posts, fetch } = recordingFetch();
    const { events } = await run(
      new ToolCallingAgent({
        model: new MockModel({ id: "mock-model", responses: [] }),
        tools: [],
        exporter: createOtlpHttpExporter({ url: TRACES_URL, fetch }),
      }),
    );
    expect(events.at(-1)?.type).toBe("run.failed");
    const spans = spansOf(otlp(JSON.parse(String(posts[0]?.init.body))));
    const root = spanNamed(spans, "run");
    expect((root.status as Record<string, unknown>).code).toBe(2);
    expect(String((root.status as Record<string, unknown>).message)).toContain("script exhausted");
  });
});
