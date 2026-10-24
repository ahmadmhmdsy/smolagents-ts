import { ToolCallingAgent, MockModel, type ToolContext, type Tool, type AgentEvent } from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import { MCPClient } from "../src/client.js";
import type { MCPMessage } from "../src/json-rpc.js";
import type { MCPTransport } from "../src/transport.js";
import { recordingLogger } from "./helpers.js";

/** A server with a public tool, a tool a policy must hide, and a slow tool that reports progress. */
class ExitTransport implements MCPTransport {
  readonly sent: MCPMessage[] = [];
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: MCPMessage) => void;
  sessionId?: string;
  private calls = 0;

  start(): Promise<void> {
    return Promise.resolve();
  }

  send(message: MCPMessage): Promise<void> {
    this.sent.push(message);
    if (!("method" in message) || !("id" in message)) return Promise.resolve();
    const id = message.id;
    queueMicrotask(() => {
      if (message.method === "initialize") {
        this.reply(id, {
          protocolVersion: "2025-11-25",
          capabilities: { tools: {} },
          serverInfo: { name: "exit", version: "1" },
        });
        return;
      }
      if (message.method === "tools/list") {
        this.reply(id, {
          tools: [
            { name: "public", description: "Public tool.", inputSchema: { type: "object" } },
            { name: "secret", description: "Secret tool.", inputSchema: { type: "object" } },
            {
              name: "slow",
              description: "Slow tool.",
              inputSchema: { type: "object", properties: { ms: { type: "number" } } },
            },
          ],
        });
        return;
      }
      if (message.method === "tools/call") {
        this.calls += 1;
        const params = message.params as Record<string, unknown> | undefined;
        const meta = params?.["_meta"] as Record<string, unknown> | undefined;
        const progressToken = meta?.["progressToken"];
        this.notify("notifications/progress", { progressToken, progress: 0.5, total: 1 });
        // The reply never comes: the caller's abort is what must end the call.
        return;
      }
    });
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.onclose?.();
    return Promise.resolve();
  }

  get callCount(): number {
    return this.calls;
  }

  private notify(method: string, params: Record<string, unknown>): void {
    this.onmessage?.({ jsonrpc: "2.0", method, params });
  }

  private reply(id: string | number, result: Record<string, unknown>): void {
    this.onmessage?.({ jsonrpc: "2.0", id, result });
  }
}

function context(onProgress?: (progress: unknown) => void, signal?: AbortSignal): ToolContext {
  return {
    signal: signal ?? new AbortController().signal,
    fetch: globalThis.fetch,
    callId: "call-1",
    stepIndex: 0,
    logger: recordingLogger(),
    ...(onProgress === undefined ? {} : { onProgress }),
  };
}

async function serverWithTools(): Promise<{ transport: ExitTransport; tools: Tool[]; close: () => void }> {
  const transport = new ExitTransport();
  const client = await MCPClient.create([{ url: "http://exit.invalid/mcp" }], {
    transportFactory: () => transport,
  });
  return { transport, tools: await client.getTools(), close: () => client.disconnect() };
}

describe("the Phase 4 exit criterion, mcp half", () => {
  it("hides a tool the model must not see while the public tool stays reachable", async () => {
    const { tools, close } = await serverWithTools();
    const mock = new MockModel([
      { toolCalls: [{ id: "call-answer", name: "final_answer", arguments: '{"answer":"done"}' }] },
    ]);
    const agent = new ToolCallingAgent({
      model: mock,
      tools,
      toolPolicy: { hidden: [{ name: "secret", reason: "owner only" }] },
    });
    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));
    try {
      await agent.run("task");
    } finally {
      close();
    }

    const prompt = String(mock.calls[0]![0]!.content);
    expect(prompt).toContain("- public:");
    expect(prompt).not.toContain("- secret:");
    const advertised = (mock.requestOptions[0]!.tools ?? []).map((spec) => spec.name);
    expect(advertised).toContain("public");
    expect(advertised).not.toContain("secret");
    const policy = events.find((event) => event.type === "tool.policy");
    expect(policy?.type === "tool.policy" && policy.hidden.map((entry) => entry.name)).toEqual(["secret"]);
  });

  it("reports progress from a long call and ends it on abort", async () => {
    const { transport, tools, close } = await serverWithTools();
    try {
      const slow = tools.find((candidate) => candidate.name === "slow");
      expect(slow).toBeDefined();
      const controller = new AbortController();
      const progress: unknown[] = [];
      const call = slow!.execute(
        { ms: 5_000 },
        context((value) => {
          progress.push(value);
          controller.abort();
        }, controller.signal),
      );
      await expect(call).rejects.toThrow();
      expect(progress).toHaveLength(1);
      expect(progress[0]).toMatchObject({ progress: 0.5 });
      expect(transport.callCount).toBe(1);
    } finally {
      close();
    }
  });
});
