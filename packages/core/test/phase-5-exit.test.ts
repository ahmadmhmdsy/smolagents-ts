import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { AgentEvent } from "../src/events.js";
import type { RunResult } from "../src/agent/run-result.js";
import { createOtlpHttpExporter } from "../src/monitoring/otel.js";
import type { ModelPrice } from "../src/monitoring/pricing.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import type { TokenUsage, ToolCallRequest } from "../src/types.js";

const noop = tool({
  name: "noop",
  description: "Do nothing.",
  inputSchema: z.object({}),
  execute: () => "ok",
});

function call(name: string, args: unknown, id: string): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

const usage = (input: number, output: number): TokenUsage => ({
  inputTokens: input,
  outputTokens: output,
  totalTokens: input + output,
});

const PRICED: ModelPrice = {
  provider: "mock",
  modelPrefix: "mock",
  currency: "USD",
  effectiveDate: "2026-01-01",
  inputPerMTokUsd: 3,
  outputPerMTokUsd: 15,
  source: "https://example.test/prices",
};

function workTurn(total: number, id: string) {
  return {
    content: "",
    finishReason: "tool_calls" as const,
    toolCalls: [call("noop", {}, id)],
    usage: usage(1, total - 1),
  };
}

function answerTurn(total: number, id: string) {
  return {
    content: "",
    finishReason: "tool_calls" as const,
    toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "done" }, id)],
    usage: usage(1, total - 1),
  };
}

async function drain(agent: ToolCallingAgent, task: string): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of agent.stream(task)) events.push(event);
  return events;
}

function resultOf(events: readonly AgentEvent[]): RunResult {
  const last = events.at(-1);
  if (last?.type !== "run.completed") {
    throw new Error("the run did not complete: " + String(last?.type));
  }
  return last.result as RunResult;
}

interface OtlpSpan {
  name?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
}
interface OtlpExport {
  resourceSpans?: Array<{
    resource?: { attributes?: Array<{ key?: string; value?: { stringValue?: string } }> };
    scopeSpans?: Array<{ spans?: OtlpSpan[] }>;
  }>;
}

function spansOf(payload: OtlpExport): OtlpSpan[] {
  return payload.resourceSpans?.[0]?.scopeSpans?.[0]?.spans ?? [];
}

describe("the phase 5 exit criterion", () => {
  it("emits a span tree only when the caller installed an exporter", async () => {
    const posted: unknown[] = [];
    const fetchSpy = (async (_url: unknown, init?: RequestInit) => {
      posted.push(JSON.parse(String(init?.body ?? "{}")));
      return new Response("", { status: 200 });
    }) as typeof fetch;

    const quiet = new MockModel({ responses: [answerTurn(11, "a")] });
    const quietEvents = await drain(new ToolCallingAgent({ model: quiet, tools: [noop] }), "answer");
    expect(quietEvents.at(-1)?.type).toBe("run.completed");
    expect(posted).toHaveLength(0);

    const exporter = createOtlpHttpExporter({
      url: "https://collector.test/v1/traces",
      fetch: fetchSpy,
      serviceName: "phase-5-exit",
    });
    const traced = new MockModel({ responses: [workTurn(10, "b"), answerTurn(11, "c")] });
    const agent = new ToolCallingAgent({ model: traced, tools: [noop], exporter });
    const events = await drain(agent, "answer");
    expect(events.at(-1)?.type).toBe("run.completed");
    expect(posted).toHaveLength(1);

    const payload = posted[0] as OtlpExport;
    const names = spansOf(payload).map((span) => span.name);
    expect(names).toEqual(["run", "step.0", "tool.noop", "step.1"]);
    const resource = payload.resourceSpans?.[0]?.resource?.attributes ?? [];
    expect(resource.some((attribute) => attribute.key === "service.name")).toBe(true);
    const spans = spansOf(payload);
    expect(spans[0]?.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(spans[1]?.parentSpanId).toBe(spans[0]?.spanId);
    expect(spans[0]?.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("stops before the next model call when priced spending crosses the cap", async () => {
    const model = new MockModel({ responses: [workTurn(1000, "a"), answerTurn(11, "b")] });
    const agent = new ToolCallingAgent({
      model,
      tools: [noop],
      priceTable: [PRICED],
      limits: { maxCostUsd: 0.001 },
    });
    const events = await drain(agent, "work");
    expect(events.at(-1)).toMatchObject({ type: "run.limitReached", reason: "limitCostUsd" });
    expect(model.callCount).toBe(1);
  });

  it("fails open on an unknown price rather than costing it as zero", async () => {
    const model = new MockModel({ responses: [answerTurn(11, "a")], id: "mock-unpriced" });
    const agent = new ToolCallingAgent({ model, tools: [noop], limits: { maxCostUsd: 0.001 } });
    const events = await drain(agent, "answer");
    expect(events.at(-1)?.type).toBe("run.completed");
    const result = resultOf(events);
    expect(result.cost).toBeUndefined();
    expect(result.costBasis).toBe("unknown");
  });
});
