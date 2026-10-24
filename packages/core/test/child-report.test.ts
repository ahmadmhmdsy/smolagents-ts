import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AgentError, AgentMaxStepsError } from "../src/errors.js";
import { managedAgent, type ManagedAgent } from "../src/agent/managed-agent.js";
import { runManagedAgent } from "../src/agent/child-report.js";
import type { MultiStepAgent } from "../src/agent/multi-step-agent.js";
import type { RunResult } from "../src/agent/run-result.js";
import { noopLogger } from "../src/logger.js";
import type { ToolContext } from "../src/tool/tool.js";

const TASK = "compute 6*7 for the secret audit";
const context: ToolContext = {
  signal: new AbortController().signal,
  fetch: globalThis.fetch,
  callId: "t1",
  stepIndex: 0,
  logger: noopLogger,
};

function agentReturning(result: Partial<RunResult>): MultiStepAgent {
  const run = vi.fn(async () => ({ output: undefined, state: "success", ...result }) as unknown as RunResult);
  return { run } as unknown as MultiStepAgent;
}

function agentThrowing(error: unknown): MultiStepAgent {
  const run = vi.fn(async () => {
    throw error;
  });
  return { run } as unknown as MultiStepAgent;
}

function entry(agent: MultiStepAgent, over: Partial<ManagedAgent> = {}): ManagedAgent {
  return { name: "junior", description: "A junior who does arithmetic.", agent, ...over };
}

describe("runManagedAgent", () => {
  it("validates the child's answer against the declared schema and keeps the value", async () => {
    const report = await runManagedAgent(
      entry(agentReturning({ output: { product: 42, workings: "6*7" } }), {
        outputSchema: z.object({ product: z.number() }),
      }),
      TASK,
    );

    expect(report.stopReason).toBe("success");
    expect(report.value).toEqual({ product: 42 });
    expect(report.failure).toBeUndefined();
  });

  it("keeps a schema mismatch in the failure channel with a bounded, value-free diagnostic", async () => {
    const report = await runManagedAgent(
      entry(agentReturning({ output: { product: "not a number" } }), {
        outputSchema: z.object({ product: z.number() }),
      }),
      TASK,
    );

    expect(report.stopReason).toBe("failure");
    expect(report.value).toBeUndefined();
    expect(report.failure?.kind).toBe("schema");
    expect(report.failure?.issues?.length).toBeGreaterThan(0);
    expect(report.failure?.message.length).toBeLessThanOrEqual(300);
    // Issue paths only: never the value the child produced.
    expect(report.failure?.issues?.join(" ")).toContain("product");
    expect(report.failure?.issues?.join(" ")).not.toContain("not a number");
  });

  it("reports an exhausted child as a max_steps failure rather than throwing", async () => {
    const report = await runManagedAgent(entry(agentThrowing(new AgentMaxStepsError("Too many steps"))), TASK);

    expect(report.stopReason).toBe("max_steps");
    expect(report.value).toBeUndefined();
    expect(report.failure?.kind).toBe("agent");
    expect(report.failure?.name).toBe("AgentMaxStepsError");
  });

  it("bounds a provider diagnostic and strips the task and key-shaped tokens from it", async () => {
    const long = "detail ".repeat(200);
    const report = await runManagedAgent(
      entry(
        agentThrowing(
          new AgentError("The provider rejected " + TASK + " because sk-abcdef123456 is invalid: " + long),
        ),
      ),
      TASK,
    );

    expect(report.stopReason).toBe("failure");
    const message = report.failure?.message ?? "";
    expect(message.length).toBeLessThanOrEqual(300);
    expect(message).not.toContain("compute 6*7");
    expect(message).not.toContain("sk-abcdef123456");
    expect(message.endsWith("…")).toBe(true);
  });

  it("reports a parked child as waiting with no value", async () => {
    const report = await runManagedAgent(
      entry(agentReturning({ output: undefined, state: "waiting" })),
      TASK,
    );

    expect(report.stopReason).toBe("waiting");
    expect(report.value).toBeUndefined();
  });

  it("renders the same report template to the manager for a successful schema'd child", async () => {
    const wrapped = managedAgent(
      entry(agentReturning({ output: { product: 42 } }), {
        outputSchema: z.object({ product: z.number() }),
      }),
    );
    const output = await wrapped.execute({ task: TASK }, context);
    expect(output).toContain("Here is the final answer from your managed agent 'junior':");
    expect(output).toContain('{"product":42}');
  });

  it("renders the failure channel to the manager when the schema rejects the answer", async () => {
    const wrapped = managedAgent(
      entry(agentReturning({ output: { product: "bad" } }), {
        outputSchema: z.object({ product: z.number() }),
      }),
    );
    const output = await wrapped.execute({ task: TASK }, context);
    expect(output).toContain("could not produce a valid result");
    expect(output).not.toContain("undefined");
  });
});
