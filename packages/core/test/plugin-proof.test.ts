/**
 * Decision 0039, the T-76 proof: the token and timing accounting runs as a built-in plugin on
 * `model:response` alone, with no existing test edited, and a cost logger written against the
 * public exports only — the way a user would write one — runs beside it.
 */
import { describe, expect, it } from "vitest";
import {
  CodeAgent,
  FINAL_ANSWER_TOOL_NAME,
  MemoryRunStore,
  MockModel,
  PluginError,
  ScriptedExecutor,
  ToolCallingAgent,
  definePlugin,
  deriveCost,
  finalAnswerResult,
  type ModelPrice,
  type Plugin,
  type TokenUsage,
} from "../src/index.js";
import type { Monitor } from "../src/monitoring/monitor.js";
import { MONITOR_PLUGIN_NAME } from "../src/plugin/builtin/monitor.js";
import { translateRecord } from "../src/session/run-store.js";

const USAGE: TokenUsage = { inputTokens: 1_000, outputTokens: 200, totalTokens: 1_200 };

function answerTurn(answer: unknown, usage?: TokenUsage) {
  return {
    content: "",
    finishReason: "tool_calls" as const,
    toolCalls: [
      { id: "c-" + String(answer), name: FINAL_ANSWER_TOOL_NAME, arguments: JSON.stringify({ answer }) },
    ],
    ...(usage === undefined ? {} : { usage }),
  };
}

/** The agent's per-run monitor; protected, so a test reads it the way a subclass would. */
function monitorOf(agent: object): Monitor {
  return (agent as { monitor: Monitor }).monitor;
}

const MOCK_PRICE: ModelPrice = {
  provider: "mock",
  modelPrefix: "mock",
  currency: "USD",
  effectiveDate: "2026-11-12",
  inputPerMTokUsd: 2,
  outputPerMTokUsd: 10,
  source: "test",
};

/**
 * The example: a cost logger on `model:response`. It needs nothing but the public names, and it
 * prices each live turn from the table it is given.
 */
function costLogger(options: {
  table: readonly ModelPrice[];
  log: (line: string) => void;
}): Plugin<{ models: string[] }> {
  return definePlugin({
    name: "cost-logger",
    version: "1.0.0",
    config: { models: options.table.map((row) => row.provider + "/" + row.modelPrefix) },
    setup: (api) => {
      api.on("model:response", (_completion, info) => {
        if (info.usage === undefined) return;
        const cost = deriveCost(info.usage, {
          provider: info.provider,
          model: info.modelId,
          table: options.table,
        });
        options.log(
          info.runId + "#" + info.stepIndex + " " + info.modelId + " " + (cost?.costUsd ?? "unpriced"),
        );
      });
    },
  });
}

describe("the monitor as a built-in plugin", () => {
  it("records each live completion's usage and call count", async () => {
    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn(1, USAGE)]) });

    await agent.run("answer");

    const stat = monitorOf(agent).get("mock");
    expect(stat).toMatchObject({ callCount: 1, inputTokens: 1_000, outputTokens: 200 });
    expect(stat!.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("records the streaming path, and skips a stream that reported no usage", async () => {
    class StreamingAgent extends CodeAgent {
      protected override get prefersStreaming(): boolean {
        return true;
      }
    }
    const run = async (usage?: TokenUsage) => {
      const agent = new StreamingAgent({
        model: new MockModel([
          {
            content: "```javascript\nfinal_answer(1)\n```",
            ...(usage === undefined ? {} : { usage }),
          },
        ]),
        executor: new ScriptedExecutor({ handler: async () => finalAnswerResult(1) }),
      });
      await agent.run("answer");
      return monitorOf(agent).get("mock");
    };

    expect(await run(USAGE)).toMatchObject({ callCount: 1, totalTokens: 1_200 });
    expect(await run()).toBeUndefined();
  });

  it("starts a fresh monitor per run", async () => {
    const agent = new ToolCallingAgent({
      model: new MockModel([answerTurn(1, USAGE), answerTurn(2, USAGE)]),
    });

    await agent.run("first");
    await agent.run("second");

    expect(monitorOf(agent).get("mock")?.callCount).toBe(1);
  });

  it("stays off the run record, so a resume does not count it as drift", async () => {
    const store = new MemoryRunStore();
    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn(1, USAGE)]), store });

    await agent.run("answer", { runId: "plain" });

    expect(translateRecord(store.load("plain")!).plugins ?? []).toEqual([]);
  });

  it("keeps its name: a user plugin may not take it", () => {
    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn(1)]) });
    const impostor = definePlugin({ name: MONITOR_PLUGIN_NAME, version: "9", setup: () => undefined });

    expect(() => agent.use(impostor)).toThrow(PluginError);
  });
});

describe("the cost-logger example", () => {
  it("logs each priced turn beside the built-in monitor, and stops when disposed", async () => {
    const lines: string[] = [];
    const agent = new ToolCallingAgent({
      model: new MockModel([answerTurn(1, USAGE), answerTurn(2, USAGE)]),
    });
    const handle = agent.use(costLogger({ table: [MOCK_PRICE], log: (line) => lines.push(line) }));

    const result = await agent.run("answer", { runId: "costed" });

    // 1,000 input at $2/MTok plus 200 output at $10/MTok is $0.004.
    expect(lines).toEqual(["costed#0 mock 0.004000"]);
    expect(monitorOf(agent).get("mock")?.callCount).toBe(1);
    expect(result.state).toBe("success");

    handle.dispose();
    await agent.run("again", { runId: "uncosted" });
    expect(lines).toHaveLength(1);
    expect(monitorOf(agent).get("mock")?.callCount).toBe(1);
  });

  it("is named on the run record with its config digest", async () => {
    const store = new MemoryRunStore();
    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn(1, USAGE)]), store });
    agent.use(costLogger({ table: [MOCK_PRICE], log: () => undefined }));

    await agent.run("answer", { runId: "named" });

    const plugins = translateRecord(store.load("named")!).plugins ?? [];
    expect(plugins.map((entry) => entry.name)).toEqual(["cost-logger"]);
    expect(plugins[0]!.configDigest).toMatch(/\S/);
  });
});
