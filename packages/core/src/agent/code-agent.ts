import { FINAL_ANSWER_TOOL_NAME, type ActionOutcome, type InterpretedAction } from "./action.js";
import { MultiStepAgent, type AgentOptions, type RunContext } from "./multi-step-agent.js";
import type { AgentEvent } from "../events.js";
import type { CodeExecutor, ToolCallEvent } from "../executor.js";
import type { ActionStep } from "../memory/steps.js";
import type { AgentErrorInfo } from "../errors.js";
import type { ChatCompletion } from "../model.js";
import { buildCodeAgentSystemPrompt } from "../prompts/system-prompt.js";
import type { ToolCall } from "../types.js";
import { createAsyncQueue } from "../utils/async-queue.js";
import { extractCodeBlock } from "../utils/parse-code-blocks.js";

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
    return buildCodeAgentSystemPrompt({
      toolDescriptions: this.tools.renderDescriptions(),
      language: this.executor.language === "python" ? "Python" : "JavaScript",
      ...(customInstructions === undefined ? {} : { customInstructions }),
    });
  }

  protected override interpret(completion: ChatCompletion): InterpretedAction {
    const raw = completion.content;
    const code = extractCodeBlock(raw);
    return code === null ? { kind: "empty", raw } : { kind: "code", raw, code };
  }

  protected override async *executeAction(
    action: InterpretedAction,
    step: ActionStep,
    context: RunContext,
  ): AsyncGenerator<AgentEvent, ActionOutcome> {
    if (action.code === undefined) return { observations: "", isFinalAnswer: false };

    const queue = createAsyncQueue<AgentEvent>();
    const toolCalls: ToolCall[] = [];
    let submitted: unknown;
    let submittedFinal = false;
    const stepIndex = context.stepIndex;

    const execution = this.executor
      .execute(action.code, {
        tools: this.tools,
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
    if (!settled.ok) throw settled.error;

    step.toolCalls = toolCalls;
    return {
      observations: describeExecution(settled.result.logs, settled.result.error),
      isFinalAnswer: settled.result.isFinalAnswer || submittedFinal,
      // The executor's own answer wins when it claims one; the sink is the fallback.
      value: settled.result.isFinalAnswer ? settled.result.value : submitted,
      error: settled.result.error,
    };
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

function toAgentEvent(event: ToolCallEvent): AgentEvent {
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
