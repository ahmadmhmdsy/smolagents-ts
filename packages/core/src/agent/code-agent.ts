import { FINAL_ANSWER_TOOL_NAME, type ActionOutcome, type InterpretedAction } from "./action.js";
import { MultiStepAgent, type AgentOptions, type RunContext } from "./multi-step-agent.js";
import type { AgentEventPayload } from "../events.js";
import type { CodeExecutor, ToolCallEvent } from "../executor.js";
import type { ActionStep } from "../memory/steps.js";
import { type AgentErrorInfo, EffectOutcomeUnknownError } from "../errors.js";
import type { ChatCompletion } from "../model.js";
import { buildCodeAgentSystemPrompt } from "../prompts/system-prompt.js";
import { CODE_FENCE } from "../prompts/templates.js";
import type { ToolCall } from "../types.js";
import { ToolRegistry } from "../tool/registry.js";
import type { Tool, ToolContext } from "../tool/tool.js";
import { digestOf } from "../utils/digest.js";
import { createAsyncQueue } from "../utils/async-queue.js";
import { extractCodeBlock, hasFinalAnswerCall } from "../utils/parse-code-blocks.js";

export interface CodeAgentOptions extends AgentOptions {
  executor: CodeExecutor;
}

/**
 * The code-as-action agent (design spec 6.1). The model writes a code block; the
 * executor runs it; the run ends when the guest calls final_answer.
 */
export class CodeAgent<TOut = unknown> extends MultiStepAgent<TOut> {
  readonly executor: CodeExecutor;

  constructor(options: CodeAgentOptions) {
    super(options);
    this.executor = options.executor;
  }

  protected override buildSystemPrompt(): string {
    const customInstructions = this.customInstructionsValue;
    return (
      buildCodeAgentSystemPrompt({
        toolDescriptions: this.renderToolDescriptions(),
        managedAgentDescriptions: this.renderManagedAgents(),
        language: this.executor.language === "python" ? "Python" : "JavaScript",
        ...(customInstructions === undefined ? {} : { customInstructions }),
      }) +
      this.answerSchemaText() +
      this.renderToolPolicyNotice()
    );
  }

  protected override interpret(completion: ChatCompletion): InterpretedAction {
    const raw = completion.content;
    const code = extractCodeBlock(raw);
    if (code !== null) return { kind: "code", raw, code };
    // A model that answers with unfenced code has still answered. The prompt asks for a
    // fence, but a message that calls final_answer is unambiguous, and failing the step
    // would discard an answer that is already in hand. The executor stays the authority
    // on whether final_answer was really invoked, so a wrong guess costs one step, not
    // the run.
    if (hasFinalAnswerCall(raw)) return { kind: "code", raw, code: raw };
    return { kind: "empty", raw };
  }

  /**
   * The code block as far as it has arrived, read the way extractCodeBlock reads a whole reply,
   * but only from complete lines while the reply is still streaming: a partial line could turn
   * out to be the closing fence. Concatenated, the deltas equal the extracted code.
   */
  protected override streamedCode(text: string, done: boolean): string | undefined {
    const lines = text.split("\n");
    if (!done) lines.pop();
    const opening = lines.findIndex((line) => line.includes(CODE_FENCE));
    if (opening === -1) return undefined;
    const collected: string[] = [];
    for (const line of lines.slice(opening + 1)) {
      if (line.includes(CODE_FENCE)) break;
      collected.push(line);
    }
    return collected.length > 0 ? collected.join("\n") : undefined;
  }

  protected override async *executeAction(
    action: InterpretedAction,
    step: ActionStep,
    context: RunContext,
  ): AsyncGenerator<AgentEventPayload, ActionOutcome> {
    if (action.code === undefined) return { observations: "", isFinalAnswer: false };

    const queue = createAsyncQueue<AgentEventPayload>();
    this.captureApprovals((decision) => queue.push(this.approvalEvent(decision)));
    const toolCalls: ToolCall[] = [];
    let submitted: unknown;
    let submittedFinal = false;
    const stepIndex = context.stepIndex;

    const execution = this.executor
      .execute(action.code, {
        tools: this.journaledTools(context),
        finalAnswer: {
          name: FINAL_ANSWER_TOOL_NAME,
          submit: (value: unknown) => {
            submittedFinal = true;
            submitted = value;
          },
        },
        signal: context.signal,
        timeoutMs: this.executionTimeoutMs,
        stepIndex,
        logger: this.logger,
        agentPath: context.agentPath,
        onLog: (text) => {
          queue.push({ type: "logs.appended", stepIndex, text });
        },
        onToolCall: (event) => {
          queue.push(toAgentEvent(event));
          if (event.type === "requested") {
            toolCalls.push({ id: event.callId, name: event.name, arguments: event.args });
          } else if (event.type === "result") {
            completeToolCall(toolCalls, event.callId, event.output, undefined, event.durationMs);
          } else {
            completeToolCall(toolCalls, event.callId, undefined, event.error.message, 0);
          }
        },
      })
      .then(
        (result) => {
          queue.close();
          return { ok: true as const, result };
        },
        (error: unknown) => {
          queue.fail(error);
          return { ok: false as const, error };
        },
      );

    for await (const event of queue) {
      yield event;
    }

    const settled = await execution;
    this.captureApprovals(undefined);
    if (!settled.ok) throw settled.error;

    step.toolCalls = toolCalls;
    const claimed = settled.result.isFinalAnswer || submittedFinal;
    // The executor's own answer wins when it claims one; the sink is the fallback.
    const value = settled.result.isFinalAnswer ? settled.result.value : submitted;
    if (claimed) {
      const invalid = this.invalidAnswer(value);
      if (invalid !== undefined) {
        // Spends the run's repair budget; past it, answerFailure throws and ends the run.
        const correction = this.answerFailure(invalid, context.finishReason, context.stepIndex);
        return {
          observations: describeExecution(settled.result.logs, settled.result.error) + "\n" + correction,
          isFinalAnswer: false,
        };
      }
    }
    return {
      observations: describeExecution(settled.result.logs, settled.result.error),
      isFinalAnswer: claimed,
      value,
      error: settled.result.error,
    };
  }

  /**
   * The tools the executor runs, each wrapped so its effect is journaled around the call. The
   * wrapper sits outside the tool's own deadline and gate, exactly where the effect starts.
   */
  private journaledTools(context: RunContext): ToolRegistry {
    const stepId = context.openStep?.stepId;
    const registry = this.stepRegistry();
    if (stepId === undefined || !this.journals(context)) return registry;
    return new ToolRegistry(
      registry.list().map((definition) => this.journaledTool(definition, context, stepId)),
    );
  }

  private journaledTool(definition: Tool, context: RunContext, stepId: string): Tool {
    return {
      ...definition,
      execute: (input, toolContext) =>
        this.journaledCall(definition, context, stepId, input, toolContext),
    } as Tool;
  }

  private async journaledCall(
    definition: Tool,
    context: RunContext,
    stepId: string,
    input: unknown,
    toolContext: ToolContext,
  ): Promise<unknown> {
    const callId = toolContext.callId;
    const recorded = this.journalLookup(context, stepId, callId);
    if (recorded !== undefined && recorded.state !== "intent" && recorded.result !== undefined) {
      return recorded.result;
    }
    let retried = false;
    if (recorded?.state === "intent") {
      if (definition.idempotent !== true) {
        throw new EffectOutcomeUnknownError(
          "Tool " +
            definition.name +
            " was announced for call " +
            callId +
            " but its record has no result; it is not declared idempotent, so the run will not guess.",
          { stepIndex: context.stepIndex },
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
        digestOf(input),
      );
      if (intentFailure !== undefined) throw intentFailure;
    }
    try {
      const result = await definition.execute(input, toolContext);
      const doneFailure = await this.journalResult(
        context,
        stepId,
        callId,
        result,
        retried ? "unknown" : "done",
      );
      if (doneFailure !== undefined) throw doneFailure;
      return result;
    } catch (error) {
      this.discardIntent(context, stepId, callId);
      throw error;
    }
  }

  protected override async releaseResources(): Promise<void> {
    await this.executor.dispose?.();
  }
}

/**
 * What the model reads back from a step. A failed step has to say why: the executor reports
 * the guest's output and the failure separately, and an observation with no reason in it
 * leaves the model nothing to react to.
 */
function describeExecution(logs: string, error: AgentErrorInfo | undefined): string {
  if (error === undefined) return logs;
  const failure = "Error: " + error.message;
  return logs === "" ? failure : logs + "\n" + failure;
}

function toAgentEvent(event: ToolCallEvent): AgentEventPayload {
  switch (event.type) {
    case "requested":
      return { type: "action.requested", callId: event.callId, name: event.name, args: event.args };
    case "result":
      return {
        type: "action.result",
        callId: event.callId,
        name: event.name,
        output: event.output,
        durationMs: event.durationMs,
      };
    case "failed":
      return { type: "action.failed", callId: event.callId, name: event.name, error: event.error };
  }
}

function completeToolCall(
  calls: ToolCall[],
  callId: string,
  result: unknown,
  error: string | undefined,
  durationMs: number,
): void {
  const call = calls.find((entry) => entry.id === callId);
  if (call === undefined) return;
  call.durationMs = durationMs;
  if (error === undefined) call.result = result;
  else call.error = error;
}
