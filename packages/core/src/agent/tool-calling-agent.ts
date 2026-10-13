import { type AgentErrorInfo, AgentToolCallError } from "../errors.js";
import type { AgentEvent } from "../events.js";
import type { ActionStep } from "../memory/steps.js";
import type { ChatCompletion } from "../model.js";
import { buildToolCallingAgentSystemPrompt } from "../prompts/system-prompt.js";
import type { Tool, ToolContext } from "../tool/tool.js";
import type { ToolCall } from "../types.js";
import { FINAL_ANSWER_TOOL_NAME, type ActionOutcome, type InterpretedAction } from "./action.js";
import { MultiStepAgent, type AgentOptions, type RunContext } from "./multi-step-agent.js";

// Re-exported so callers can import it beside the agent that uses it. The binding itself is
// declared once, in action.ts, so the package's public star-exports stay unambiguous.
export { FINAL_ANSWER_TOOL_NAME };

export type ToolCallingAgentOptions = AgentOptions;

/**
 * The structured-tool-call agent. Same loop as CodeAgent, different action language.
 */
export class ToolCallingAgent<TOut = unknown> extends MultiStepAgent<TOut> {
  constructor(options: ToolCallingAgentOptions) {
    super(options);
  }

  /** Tool calls arrive on generate(), never on the chunk stream. */
  protected override get prefersStreaming(): boolean {
    return false;
  }

  /** A tool-calling provider is given tool_calls and tool results, not Observations. */
  protected override get transcriptStyle(): "observation" | "tool-messages" {
    return "tool-messages";
  }

  protected override buildSystemPrompt(): string {
    const customInstructions = this.customInstructionsValue;
    return buildToolCallingAgentSystemPrompt({
      toolDescriptions: this.tools.renderDescriptions(),
      ...(customInstructions === undefined ? {} : { customInstructions }),
    });
  }

  protected override interpret(completion: ChatCompletion): InterpretedAction {
    const raw = completion.content;
    if (completion.toolCalls.length === 0) return { kind: "empty", raw };
    return { kind: "toolcalls", raw, calls: completion.toolCalls };
  }

  protected override async *executeAction(
    action: InterpretedAction,
    step: ActionStep,
    context: RunContext,
  ): AsyncGenerator<AgentEvent, ActionOutcome> {
    const stepIndex = context.stepIndex;
    const requests = action.calls ?? [];
    const calls: ToolCall[] = [];
    const observations: string[] = [];
    let isFinalAnswer = false;
    let finalValue: unknown;

    yield {
      type: "toolcalls.requested",
      stepIndex,
      calls: requests.map((request, index) => ({
        id: request.id === "" ? "call-" + String(index) : request.id,
        name: request.name,
        arguments: parseArgumentsOrRaw(request.arguments),
      })),
    };

    for (const [index, request] of requests.entries()) {
      const callId = request.id === "" ? "call-" + String(index) : request.id;

      let args: unknown;
      try {
        args = request.arguments.trim() === "" ? {} : JSON.parse(request.arguments);
      } catch {
        const info = new AgentToolCallError(
          "Arguments for tool " + request.name + " are not valid JSON: " + request.arguments,
          { stepIndex },
        ).info;
        yield { type: "action.failed", callId, name: request.name, error: info };
        calls.push({ id: callId, name: request.name, arguments: request.arguments, error: info.message });
        observations.push("Error: " + info.message);
        continue;
      }

      if (request.name === FINAL_ANSWER_TOOL_NAME) {
        const value = extractAnswer(args);
        calls.push({ id: callId, name: request.name, arguments: args, result: value, durationMs: 0 });
        yield { type: "action.result", callId, name: request.name, output: value, durationMs: 0 };
        observations.push("Final answer: " + display(value));
        isFinalAnswer = true;
        finalValue = value;
        continue;
      }

      const definition = this.tools.get(request.name);
      if (definition === undefined) {
        const info = new AgentToolCallError("Unknown tool: " + request.name, { stepIndex }).info;
        yield { type: "action.failed", callId, name: request.name, error: info };
        calls.push({ id: callId, name: request.name, arguments: args, error: info.message });
        observations.push("Error: " + info.message);
        continue;
      }

      const parsed = definition.inputSchema.safeParse(args);
      if (!parsed.success) {
        const info = new AgentToolCallError(
          "Invalid arguments for tool " + request.name + ": " + parsed.error.message,
          { stepIndex },
        ).info;
        yield { type: "action.failed", callId, name: request.name, error: info };
        calls.push({ id: callId, name: request.name, arguments: args, error: info.message });
        observations.push("Error: " + info.message);
        continue;
      }

      yield { type: "action.requested", callId, name: request.name, args: parsed.data };
      const startedAt = Date.now();
      const result = await this.invoke(definition, parsed.data, callId, stepIndex, context);
      const durationMs = Date.now() - startedAt;

      if (result.ok) {
        calls.push({ id: callId, name: request.name, arguments: parsed.data, result: result.output, durationMs });
        yield { type: "action.result", callId, name: request.name, output: result.output, durationMs };
        observations.push("Tool " + request.name + " returned: " + display(result.output));
      } else {
        calls.push({ id: callId, name: request.name, arguments: parsed.data, error: result.error.message, durationMs });
        yield { type: "action.failed", callId, name: request.name, error: result.error };
        observations.push("Error: " + result.error.message);
      }
    }

    step.toolCalls = calls;
    return {
      observations: observations.join("\n"),
      isFinalAnswer,
      value: finalValue,
    };
  }

  private async invoke(
    definition: Tool,
    args: unknown,
    callId: string,
    stepIndex: number,
    context: RunContext,
  ): Promise<{ ok: true; output: unknown } | { ok: false; error: AgentErrorInfo }> {
    const toolContext: ToolContext = {
      signal: context.signal,
      fetch: globalThis.fetch,
      callId,
      stepIndex,
      logger: this.logger,
    };
    try {
      return { ok: true, output: await definition.execute(args, toolContext) };
    } catch (error) {
      return {
        ok: false,
        error: new AgentToolCallError(error instanceof Error ? error.message : String(error), { stepIndex })
          .info,
      };
    }
  }
}

function parseArgumentsOrRaw(raw: string): unknown {
  try {
    return raw.trim() === "" ? {} : JSON.parse(raw);
  } catch {
    return raw;
  }
}

function extractAnswer(args: unknown): unknown {
  if (typeof args === "object" && args !== null && "answer" in args) {
    return (args as { answer: unknown }).answer;
  }
  return args;
}

function display(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
