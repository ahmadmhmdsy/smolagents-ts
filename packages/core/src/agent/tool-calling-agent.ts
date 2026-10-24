import {
  type AgentErrorInfo,
  AgentCancelledError,
  AgentError,
  AgentToolCallError,
  EffectOutcomeUnknownError,
  ToolTimeoutError,
} from "../errors.js";
import type { AgentEvent } from "../events.js";
import type { ActionStep } from "../memory/steps.js";
import type { ChatCompletion } from "../model.js";
import { buildToolCallingAgentSystemPrompt } from "../prompts/system-prompt.js";
import { extractCodeBlock } from "../utils/parse-code-blocks.js";
import type { Tool, ToolContext } from "../tool/tool.js";
import type { ToolCall } from "../types.js";
import { FINAL_ANSWER_TOOL_NAME, type ActionOutcome, type InterpretedAction } from "./action.js";
import { ToolApprovalPendingError } from "./approval.js";
import { digestOf } from "../utils/digest.js";
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

  /** The schemas travel on the request, but only to a model that can call a tool. */
  protected override get advertisesTools(): boolean {
    return this.model.capabilities.toolCalls;
  }

  /** A tool-calling provider is given tool_calls and tool results, not Observations. */
  protected override get transcriptStyle(): "observation" | "tool-messages" {
    return "tool-messages";
  }

  protected override buildSystemPrompt(): string {
    const customInstructions = this.customInstructionsValue;
    const toolCalls = this.model.capabilities.toolCalls;
    const base = buildToolCallingAgentSystemPrompt({
      toolDescriptions: toolCalls ? this.renderToolDescriptions() : "",
      managedAgentDescriptions: toolCalls ? this.renderManagedAgents() : "",
      ...(customInstructions === undefined ? {} : { customInstructions }),
    });
    if (toolCalls) return base;
    // A model that cannot call tools cannot be handed the answer as a final_answer call. The
    // schema is bound in the prompt instead, and the loop repairs a wrong-shaped reply turn by
    // turn: that path is what makes structured output universal (decision 0020).
    return (
      base +
      "\n\nTEXT ANSWERS\nThis model cannot call tools, so do not emit a tool call. Reply with the final answer as JSON text" +
      (this.answerJsonSchema() === undefined ? "." : ", satisfying the schema below.") +
      this.answerSchemaText()
    );
  }

  protected override interpret(completion: ChatCompletion): InterpretedAction {
    const raw = completion.content;
    if (completion.toolCalls.length > 0) return { kind: "toolcalls", raw, calls: completion.toolCalls };
    // A tool-less model answers in its text, and a fenced or bare JSON object is the answer.
    if (!this.model.capabilities.toolCalls && raw.trim() !== "") {
      return { kind: "final", raw, output: parseTextAnswer(raw) };
    }
    return { kind: "empty", raw };
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
        const invalid = this.invalidAnswer(value);
        if (invalid !== undefined) {
          // A wrong-shaped answer spends the run's repair budget; past it, answerFailure throws.
          const correction = this.answerFailure(invalid, context.finishReason, stepIndex);
          const info = new AgentToolCallError(invalid, { stepIndex }).info;
          yield { type: "action.failed", callId, name: request.name, error: info };
          calls.push({ id: callId, name: request.name, arguments: args, error: invalid, durationMs: 0 });
          observations.push(correction);
          continue;
        }
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
      const approvals: AgentEvent[] = [];
      this.captureApprovals((decision) => approvals.push(this.approvalEvent(decision)));
      let result: Awaited<ReturnType<ToolCallingAgent["invoke"]>>;
      try {
        result = await this.invoke(definition, parsed.data, callId, stepIndex, context);
      } catch (error) {
        // A park or a typed refusal must reach the loop; the decision it made still goes out
        // first, so the stream shows the ask, never a call that silently vanished.
        this.captureApprovals(undefined);
        for (const event of approvals) yield event;
        throw error;
      }
      this.captureApprovals(undefined);
      for (const event of approvals) yield event;
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
    const stepId = context.openStep?.stepId;
    let retried = false;
    if (stepId !== undefined) {
      const recorded = this.journalLookup(context, stepId, callId);
      if (recorded !== undefined && recorded.state !== "intent" && recorded.result !== undefined) {
        // The effect finished before the crash: return its recorded result, run nothing.
        return recorded.result as { ok: true; output: unknown } | { ok: false; error: AgentErrorInfo };
      }
      if (recorded?.state === "intent") {
        if (definition.idempotent !== true) {
          throw new EffectOutcomeUnknownError(
            "Tool " +
              definition.name +
              " was announced for call " +
              callId +
              " but its record has no result; it is not declared idempotent, so the run will not guess.",
            { stepIndex },
            definition.name,
            callId,
          );
        }
        retried = true;
      } else {
        const intentFailure = await this.journalIntent(
          context,
          stepId,
          callId,
          definition.name,
          digestOf(args),
        );
        if (intentFailure !== undefined) throw intentFailure;
      }
    }
    let result: { ok: true; output: unknown } | { ok: false; error: AgentErrorInfo };
    try {
      result = { ok: true, output: await definition.execute(args, toolContext) };
    } catch (error) {
      // Cancellation is the run's outcome, not this call's failure; it must not be flattened into
      // a tool-call error. A timed-out tool keeps its own typed code so the reader sees the limit.
      // A park and any other typed error are the loop's to report, so they pass through as-is.
      if (stepId !== undefined) this.discardIntent(context, stepId, callId);
      if (error instanceof AgentCancelledError) throw error;
      if (error instanceof ToolApprovalPendingError) throw error;
      // A timed-out tool is this call's failure, not the run's; check it before the general
      // typed-error pass-through, because its class is an AgentError too.
      if (error instanceof ToolTimeoutError) {
        result = { ok: false, error: error.info };
      } else if (error instanceof AgentError) {
        throw error;
      } else {
        result = {
          ok: false,
          error: new AgentToolCallError(error instanceof Error ? error.message : String(error), {
            stepIndex,
          }).info,
        };
      }
    }
    if (stepId !== undefined) {
      const doneFailure = await this.journalResult(
        context,
        stepId,
        callId,
        result,
        retried ? "unknown" : "done",
      );
      if (doneFailure !== undefined) throw doneFailure;
    }
    return result;
  }
}

/** Read a text reply as the answer: fenced or bare JSON when it parses, the text itself otherwise. */
function parseTextAnswer(raw: string): unknown {
  const text = (extractCodeBlock(raw) ?? raw).trim();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
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
