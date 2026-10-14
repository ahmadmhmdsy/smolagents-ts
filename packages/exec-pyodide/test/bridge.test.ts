import { describe, expect, it } from "vitest";
import { ToolRegistry, noopLogger, tool, type Tool, type ToolCallEvent } from "@smolagents-ts/core";
import { z } from "zod";

import { ToolBridge } from "../src/bridge.js";

const weather = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  execute: (input) => "sunny in " + input.city,
});

const boom = tool({
  name: "boom",
  description: "Always fails.",
  inputSchema: z.object({}),
  execute: () => {
    throw new Error("kaboom");
  },
});

function makeBridge(tools: readonly Tool[], signal?: AbortSignal) {
  const events: ToolCallEvent[] = [];
  const bridge = new ToolBridge({
    tools: new ToolRegistry(tools),
    signal: signal ?? new AbortController().signal,
    stepIndex: 3,
    logger: noopLogger,
    fetch: globalThis.fetch,
    onToolCall: (event) => events.push(event),
  });
  return { bridge, events };
}

const parse = async (bridge: ToolBridge, name: string, args: unknown): Promise<Record<string, unknown>> =>
  JSON.parse(await bridge.call(name, JSON.stringify(args))) as Record<string, unknown>;

describe("ToolBridge", () => {
  it("returns a success envelope and reports requested then result", async () => {
    const { bridge, events } = makeBridge([weather]);
    const envelope = await parse(bridge, "get_weather", { city: "Paris" });
    expect(envelope).toEqual({ ok: true, value: "sunny in Paris" });
    expect(events.map((event) => event.type)).toEqual(["requested", "result"]);
    expect(events[0]).toMatchObject({ type: "requested", callId: "call_1", name: "get_weather" });
    expect(events[1]).toMatchObject({ type: "result", callId: "call_1", output: "sunny in Paris" });
    if (events[1]?.type === "result") {
      expect(events[1].durationMs).toBeGreaterThanOrEqual(0);
    }
    expect(bridge.toolCallCount).toBe(1);
  });

  it("numbers call ids in order across calls", async () => {
    const { bridge, events } = makeBridge([weather]);
    await parse(bridge, "get_weather", { city: "A" });
    await parse(bridge, "get_weather", { city: "B" });
    expect(events.filter((event) => event.type === "requested").map((event) => event.callId)).toEqual([
      "call_1",
      "call_2",
    ]);
    expect(bridge.toolCallCount).toBe(2);
  });

  it("refuses an unknown tool with a failed event only", async () => {
    const { bridge, events } = makeBridge([weather]);
    const envelope = await parse(bridge, "nope", {});
    expect(envelope.ok).toBe(false);
    expect(envelope.error).toBe("Unknown tool: nope");
    expect(events.map((event) => event.type)).toEqual(["failed"]);
    if (events[0]?.type === "failed") {
      expect(events[0].error.code).toBe("AGENT_TOOL_CALL");
    }
  });

  it("refuses arguments that are not JSON", async () => {
    const { bridge, events } = makeBridge([weather]);
    const envelope = JSON.parse(await bridge.call("get_weather", "{not json")) as Record<string, unknown>;
    expect(envelope.ok).toBe(false);
    expect(envelope.error).toBe("Arguments for get_weather were not JSON");
    expect(events.map((event) => event.type)).toEqual(["failed"]);
  });

  it("refuses arguments the schema rejects", async () => {
    const { bridge, events } = makeBridge([weather]);
    const envelope = await parse(bridge, "get_weather", { city: 7 });
    expect(envelope.ok).toBe(false);
    expect(String(envelope.error)).toContain("Invalid arguments for get_weather:");
    expect(events.map((event) => event.type)).toEqual(["failed"]);
  });

  it("reports a throwing tool as requested then failed and names the tool", async () => {
    const { bridge, events } = makeBridge([boom]);
    const envelope = await parse(bridge, "boom", {});
    expect(envelope.ok).toBe(false);
    expect(envelope.error).toBe('Tool "boom" failed: kaboom');
    expect(events.map((event) => event.type)).toEqual(["requested", "failed"]);
    if (events[1]?.type === "failed") {
      expect(events[1].error).toMatchObject({ name: "Error", message: "kaboom", code: "AGENT_TOOL_CALL" });
    }
  });

  it("fails before reaching the tool when the signal is already aborted", async () => {
    let executed = 0;
    const counted = tool({
      name: "counted",
      description: "Counts calls.",
      inputSchema: z.object({}),
      execute: () => {
        executed += 1;
        return "ran";
      },
    });
    const controller = new AbortController();
    controller.abort();
    const { bridge, events } = makeBridge([counted], controller.signal);
    const envelope = await parse(bridge, "counted", {});
    expect(envelope.ok).toBe(false);
    expect(envelope.error).toBe("Code execution was cancelled");
    expect(executed).toBe(0);
    expect(events.map((event) => event.type)).toEqual(["failed"]);
  });

  it("fails when the signal aborts while the tool runs", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = tool({
      name: "slow",
      description: "Waits for a gate.",
      inputSchema: z.object({}),
      execute: async () => {
        await gate;
        return "late";
      },
    });
    const controller = new AbortController();
    const { bridge, events } = makeBridge([slow], controller.signal);
    const pending = bridge.call("slow", "{}");
    controller.abort();
    release();
    const envelope = JSON.parse(await pending) as Record<string, unknown>;
    expect(envelope.ok).toBe(false);
    expect(envelope.error).toBe("Code execution was cancelled");
    expect(events.map((event) => event.type)).toEqual(["requested", "failed"]);
  });

  it("fails and does not run the tool once disabled", async () => {
    let executed = 0;
    const counted = tool({
      name: "counted",
      description: "Counts calls.",
      inputSchema: z.object({}),
      execute: () => {
        executed += 1;
        return "ran";
      },
    });
    const { bridge } = makeBridge([counted]);
    bridge.disable();
    const envelope = await parse(bridge, "counted", {});
    expect(envelope.ok).toBe(false);
    expect(executed).toBe(0);
  });

  it("degrades a value JSON cannot express to its string form", async () => {
    const big = tool({
      name: "big",
      description: "Returns a bigint.",
      inputSchema: z.object({}),
      execute: () => 10n,
    });
    const { bridge } = makeBridge([big]);
    const envelope = await parse(bridge, "big", {});
    expect(envelope).toEqual({ ok: true, value: "10" });
  });
});
