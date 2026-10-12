import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AgentSession,
  type AgentMiddleware,
  type AgentEvent,
  type CodeResult,
  CodeAgent,
  MockModel,
  ScriptedExecutor,
  ToolRegistry,
  buildCodeAgentSystemPrompt,
  tool,
} from "../src/index.js";

const CODE_FENCE = String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96);

function fenced(code: string): string {
  return "Thought: working.\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

const add = tool({
  name: "add",
  description: "Add two numbers.",
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  execute: ({ a, b }) => a + b,
});

describe("end to end", () => {
  it("runs a tool-using task through the public entry point", async () => {
    const registry = new ToolRegistry([add]);
    const executor = new ScriptedExecutor({
      handler: async (code, options): Promise<CodeResult> => {
        if (code === "final_answer(20)") {
          options.onLog?.("20");
          options.finalAnswer.submit(20);
          return { logs: "20", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
        }

        // Stand in for guest code that calls add(12, 8), exactly as a real executor would.
        const definition = options.tools.get("add");
        if (definition === undefined) throw new Error("add is not registered");
        const args = definition.inputSchema.parse({ a: 12, b: 8 });
        options.onToolCall?.({ type: "requested", callId: "c1", name: "add", args });
        const startedAt = Date.now();
        const output = await definition.execute(args, {
          signal: options.signal,
          fetch: globalThis.fetch,
          callId: "c1",
          stepIndex: options.stepIndex,
          logger: options.logger,
        });
        options.onToolCall?.({ type: "result", callId: "c1", name: "add", output, durationMs: Date.now() - startedAt });
        options.onLog?.("20");
        return { logs: "20", isFinalAnswer: false, durationMs: 0, toolCallCount: 1 };
      },
    });

    const seenSteps: number[] = [];
    const middleware: AgentMiddleware = async function* (ctx, next) {
      seenSteps.push(ctx.stepIndex);
      return yield* next();
    };

    const agent = new CodeAgent<number>({
      model: new MockModel([fenced("print(add(12, 8))"), fenced("final_answer(20)")]),
      executor,
      tools: registry,
      middleware: [middleware],
    });

    const session = new AgentSession(agent);
    const events: AgentEvent[] = [];
    session.subscribe(() => undefined);
    const off = agent.on((event) => events.push(event));
    const result = await session.send("What is 12 + 8?");
    off();

    expect(result.output).toBe(20);
    expect(result.state).toBe("success");
    expect(seenSteps).toEqual([0, 1]);
    expect(events.some((event) => event.type === "action.result")).toBe(true);

    const snapshot = session.getSnapshot();
    expect(snapshot.status).toBe("success");
    expect(snapshot.steps).toHaveLength(2);
    expect(snapshot.steps[0]?.toolCalls).toEqual([
      { id: "c1", name: "add", args: { a: 12, b: 8 }, status: "ok", output: 20, durationMs: expect.any(Number) },
    ]);
    expect(snapshot.steps[1]?.isFinalAnswer).toBe(true);
  });

  it("builds a prompt a model can actually follow", () => {
    const prompt = buildCodeAgentSystemPrompt({ toolDescriptions: new ToolRegistry([add]).renderDescriptions() });
    expect(prompt).toContain("add");
    expect(prompt).toContain("Add two numbers.");
    expect(prompt).toContain("a (number, required)");
    expect(prompt).toContain("final_answer");
  });
});
