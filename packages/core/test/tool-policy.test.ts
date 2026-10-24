import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AgentError,
  CodeAgent,
  MockModel,
  ScriptedExecutor,
  ToolCallingAgent,
  ToolDefinitionError,
  ToolPolicyDeniedError,
  finalAnswerResult,
  tool,
  type AgentEvent,
  type AgentErrorInfo,
} from "../src/index.js";
import { mergeToolPolicy } from "../src/tool/policy.js";

const emptySchema = z.object({});
const FENCE = String.fromCharCode(96, 96, 96);

/** A code reply, built without a template literal so the fence cannot collide with the source. */
function fenced(code: string): string {
  return FENCE + "javascript\n" + code + "\n" + FENCE;
}

function recordingTool(name: string, calls: string[], description = name + " tool") {
  return tool({
    name,
    description,
    inputSchema: emptySchema,
    execute: () => {
      calls.push(name);
      return name + " done";
    },
  });
}

function answering(calls: string[], name = "report") {
  return [
    {
      toolCalls: [
        { id: "call-" + name, name, arguments: "{}" },
        { id: "call-answer", name: "final_answer", arguments: '{"answer":"done"}' },
      ],
    },
  ];
}

describe("mergeToolPolicy", () => {
  it("intersects two allowed sets and takes one when only one side names it", () => {
    const both = mergeToolPolicy({ allowed: ["a", "b", "c"] }, { allowed: ["b", "c", "d"] });
    expect(both.allowed).toEqual(["b", "c"]);
    expect(mergeToolPolicy(undefined, { allowed: ["a"] }).allowed).toEqual(["a"]);
    expect(mergeToolPolicy({ allowed: ["a"] }, undefined).allowed).toEqual(["a"]);
    expect(mergeToolPolicy(undefined, undefined).allowed).toBeUndefined();
  });

  it("unions hidden entries by name and keeps the first reason", () => {
    const merged = mergeToolPolicy(
      { hidden: [{ name: "a", reason: "first" }] },
      { hidden: [{ name: "a", reason: "second" }, { name: "b" }] },
    );
    expect(merged.hidden).toEqual([{ name: "a", reason: "first" }, { name: "b" }]);
  });

  it("drops a forced name the allowed set does not admit, with a reason", () => {
    const merged = mergeToolPolicy({ allowed: ["a"], forced: ["a", "b"] }, undefined);
    expect(merged.forced).toEqual(["a"]);
    expect(merged.droppedForced).toHaveLength(1);
    expect(merged.droppedForced[0]!.name).toBe("b");
    expect(merged.droppedForced[0]!.reason.length).toBeGreaterThan(0);
  });

  it("concatenates requirements and dedupes them by tool, first one winning", () => {
    const merged = mergeToolPolicy(
      { require: [{ tool: "x", reason: "one" }] },
      { require: [{ tool: "x", reason: "two" }, { tool: "y", reason: "why" }] },
    );
    expect(merged.required).toEqual([
      { tool: "x", reason: "one" },
      { tool: "y", reason: "why" },
    ]);
  });
});

describe("a hidden tool", () => {
  it("is absent from the prompt and from the request's tool specs", async () => {
    const calls: string[] = [];
    const mock = new MockModel([{ toolCalls: [
      { id: "call-answer", name: "final_answer", arguments: '{"answer":"done"}' },
    ] }]);
    const agent = new ToolCallingAgent({
      model: mock,
      tools: [recordingTool("report", calls, "report tool"), recordingTool("secret", calls, "secret tool")],
      toolPolicy: { hidden: [{ name: "secret", reason: "admin only" }] },
    });
    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));
    await agent.run("task");

    const prompt = String(mock.calls[0]![0]!.content);
    expect(prompt).toContain("- report:");
    expect(prompt).not.toContain("- secret:");
    const advertised = (mock.requestOptions[0]!.tools ?? []).map((spec) => spec.name);
    expect(advertised).toContain("report");
    expect(advertised).not.toContain("secret");
    const policy = events.find((event) => event.type === "tool.policy");
    expect(policy).toBeDefined();
    expect(policy!.type === "tool.policy" && policy!.hidden.map((entry) => entry.name)).toEqual(["secret"]);
  });

  it("fails a scripted call with AGENT_TOOL_POLICY and never runs its body", async () => {
    const calls: string[] = [];
    const secret = recordingTool("secret", calls, "secret tool");
    const executor = new ScriptedExecutor({
      results: { "final_answer(\"done\")": finalAnswerResult("done") },
      handler: async (code, options) => {
        const stub = options.tools.get("secret");
        expect(stub).toBeDefined();
        let failure: AgentErrorInfo;
        try {
          await stub!.execute({}, {
            signal: options.signal,
            fetch: globalThis.fetch,
            callId: "call-secret",
            stepIndex: options.stepIndex,
            logger: options.logger,
          });
          failure = { name: "Error", message: "the stub did not refuse", code: "AGENT_ERROR" };
        } catch (error) {
          failure = error instanceof AgentError ? error.info : { name: "Error", message: String(error), code: "AGENT_ERROR" };
        }
        options.onToolCall?.({ type: "failed", callId: "call-secret", name: "secret", error: failure });
        return { logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 1 };
      },
    });
    const agent = new CodeAgent({
      model: new MockModel([fenced("secret()"), fenced('final_answer("done")')]),
      executor,
      tools: [secret, recordingTool("report", calls)],
      toolPolicy: { hidden: [{ name: "secret", reason: "admin only" }] },
    });
    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));
    const result = await agent.run("task");

    expect(result.output).toBe("done");
    expect(calls).toEqual([]);
    const failed = events.find((event) => event.type === "action.failed");
    expect(failed).toBeDefined();
    expect(failed!.type === "action.failed" && failed!.error.code).toBe("AGENT_TOOL_POLICY");
    expect(failed!.type === "action.failed" && failed!.error.message).toContain("admin only");
  });
});

describe("a forced tool", () => {
  it("is named in the prompt and refuses the first answer until it ran in that step", async () => {
    const calls: string[] = [];
    const mock = new MockModel([
      { toolCalls: [{ id: "call-answer", name: "final_answer", arguments: '{"answer":"early"}' }] },
      ...answering(calls),
    ]);
    const agent = new ToolCallingAgent({
      model: mock,
      tools: [recordingTool("report", calls)],
      toolPolicy: { forced: ["report"] },
    });
    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));
    const result = await agent.run("task");

    expect(result.output).toBe("done");
    expect(String(mock.calls[0]![0]!.content)).toContain("This step must call: report");
    const unmet = events.filter((event) => event.type === "tool.requirementUnmet");
    expect(unmet).toHaveLength(1);
    expect(unmet[0]!.type === "tool.requirementUnmet" && unmet[0]!.tool).toBe("report");
    const refusal = events.find(
      (event) => event.type === "observation.completed" && !event.isFinalAnswer,
    );
    expect(refusal!.type === "observation.completed" && refusal!.text).toContain("must call report");
  });
});

describe("a required tool", () => {
  it("refuses the first answer with one event, then accepts the answer that follows the call", async () => {
    const calls: string[] = [];
    const mock = new MockModel([
      { toolCalls: [{ id: "call-answer", name: "final_answer", arguments: '{"answer":"early"}' }] },
      ...answering(calls),
    ]);
    const agent = new ToolCallingAgent({
      model: mock,
      tools: [recordingTool("report", calls)],
      toolPolicy: { require: [{ tool: "report", reason: "cite the report" }] },
    });
    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));
    const result = await agent.run("task");

    expect(result.output).toBe("done");
    expect(calls).toEqual(["report"]);
    const unmet = events.filter((event) => event.type === "tool.requirementUnmet");
    expect(unmet).toHaveLength(1);
    expect(unmet[0]!.type === "tool.requirementUnmet" && unmet[0]!.reason).toBe("cite the report");
  });

  it("ends the run with a guardrail failure after the repair budget", async () => {
    const calls: string[] = [];
    const mock = new MockModel([
      { toolCalls: [{ id: "a1", name: "final_answer", arguments: '{"answer":"one"}' }] },
      { toolCalls: [{ id: "a2", name: "final_answer", arguments: '{"answer":"two"}' }] },
      { toolCalls: [{ id: "a3", name: "final_answer", arguments: '{"answer":"three"}' }] },
    ]);
    const agent = new ToolCallingAgent({
      model: mock,
      tools: [recordingTool("report", calls)],
      toolPolicy: { require: [{ tool: "report", reason: "cite the report" }] },
    });
    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));
    await expect(agent.run("task")).rejects.toThrow(/guardrail|cite the report/i);
    expect(events.filter((event) => event.type === "tool.requirementUnmet")).toHaveLength(2);
    expect(calls).toEqual([]);
  });

  it("refuses a requirement naming an unknown tool at construction", () => {
    expect(() => {
      new ToolCallingAgent({
        model: new MockModel([]),
        tools: [recordingTool("report", [])],
        toolPolicy: { require: [{ tool: "missing", reason: "nowhere" }] },
      });
    }).toThrow(ToolDefinitionError);
  });
});

describe("the step's tool policy", () => {
  it("is announced as the first event after step.started", async () => {
    const calls: string[] = [];
    const mock = new MockModel(answering(calls));
    const agent = new ToolCallingAgent({
      model: mock,
      tools: [recordingTool("report", calls), recordingTool("secret", calls)],
      toolPolicy: {
        hidden: [{ name: "secret", reason: "admin only" }],
        forced: ["report"],
        require: [{ tool: "report", reason: "cite the report" }],
      },
    });
    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));
    await agent.run("task");

    const started = events.findIndex((event) => event.type === "step.started");
    const next = events[started + 1];
    expect(next!.type).toBe("tool.policy");
    if (next!.type !== "tool.policy") throw new Error("unreachable");
    expect(next!.stepIndex).toBe(0);
    expect(next!.advertised).toEqual(["report"]);
    expect(next!.hidden.map((entry) => entry.name)).toEqual(["secret"]);
    expect(next!.forced).toEqual(["report"]);
    expect(next!.required.map((entry) => entry.tool)).toEqual(["report"]);
  });

  it("comes from a provider that sees the step's context", async () => {
    const calls: string[] = [];
    const seen: { runId: string; stepIndex: number; task: string }[] = [];
    const mock = new MockModel(answering(calls));
    const agent = new ToolCallingAgent({
      model: mock,
      tools: [recordingTool("report", calls)],
      toolPolicy: (context) => {
        seen.push({ runId: context.runId, stepIndex: context.stepIndex, task: context.task });
        return { forced: ["report"] };
      },
    });
    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));
    await agent.run("task");

    expect(seen).toHaveLength(1);
    expect(seen[0]!.stepIndex).toBe(0);
    expect(seen[0]!.task).toBe("task");
    const started = events.find((event) => event.type === "run.started");
    expect(started!.type === "run.started" && started!.runId).toBe(seen[0]!.runId);
  });
});

describe("ToolPolicyDeniedError", () => {
  it("is an AgentError carrying the policy code", () => {
    const error = new ToolPolicyDeniedError("Tool \"secret\" is hidden: admin only");
    expect(error).toBeInstanceOf(AgentError);
    expect(error.code).toBe("AGENT_TOOL_POLICY");
  });
});
