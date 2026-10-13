import {
  CODE_FENCE,
  CodeAgent,
  MockModel,
  ScriptedExecutor,
  type CodeResult,
} from "@smolagents-ts/core";

/** One model turn that writes a single fenced code block. */
export function fenced(thought: string, code: string): string {
  return "Thought: " + thought + "\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

/** An executor that submits `value` as the final answer on the first step. */
export function answering(value: unknown): ScriptedExecutor {
  return new ScriptedExecutor({
    handler: (_code, options): CodeResult => {
      options.finalAnswer.submit(value);
      return { logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
    },
  });
}

/** A CodeAgent that answers `value` in one step. The executor option is required. */
export function agentThatAnswers(value: unknown): CodeAgent {
  return new CodeAgent({
    model: new MockModel([fenced("answer", "final_answer(" + JSON.stringify(value) + ")")]),
    executor: answering(value),
  });
}
