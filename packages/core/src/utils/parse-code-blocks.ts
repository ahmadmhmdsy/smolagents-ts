import { CODE_FENCE } from "../prompts/templates.js";

/**
 * Extract the first fenced code block from model output.
 *
 * Line-based rather than regex-based: a regex that is permissive enough to accept an
 * unterminated trailing block is hard to reason about, and upstream's behaviour here is
 * "the first block wins, and a block may be the whole tail of the message".
 *
 * A fence counts wherever it sits on its line, not only at the start. Upstream's pattern
 * carries no line anchor for the same reason: a model that opens its fence mid-sentence
 * ("Thought: ... {{fence}}js") is asking to be understood, and treating that as no block
 * at all throws away an answer that is already in the message. The remainder of the
 * opening line is the language tag, so the code itself starts on the next line.
 */
export function extractCodeBlock(text: string, fence: string = CODE_FENCE): string | null {
  const lines = text.split("\n");
  const collected: string[] = [];
  let inside = false;

  for (const line of lines) {
    const at = line.indexOf(fence);
    if (!inside) {
      if (at !== -1) {
        inside = true;
      }
      continue;
    }
    if (at !== -1) {
      return collected.join("\n");
    }
    collected.push(line);
  }

  return collected.length > 0 ? collected.join("\n") : null;
}

/** The reasoning the model wrote before its code block. */
export function extractThought(text: string, fence: string = CODE_FENCE): string {
  const index = text.indexOf(fence);
  const head = index === -1 ? text : text.slice(0, index);
  return head.replace(/^\s*Thought:\s*/i, "").replace(/\n\s*Thought:[\s\S]*/i, "").trim();
}

/**
 * Whether the code appears to call final_answer. Advisory only: the authoritative
 * signal is CodeExecutor having actually invoked the final-answer sink.
 */
export function hasFinalAnswerCall(code: string, name = "final_answer"): boolean {
  const escaped = name.replace(/[.*+?^`{}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^A-Za-z0-9_.$])" + escaped + "\\s*\\(").test(code);
}
