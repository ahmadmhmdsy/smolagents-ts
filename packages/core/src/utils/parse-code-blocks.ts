import { CODE_FENCE } from "../prompts/templates.js";

/**
 * Extract the first fenced code block from model output.
 *
 * Line-based rather than regex-based: a regex that is permissive enough to accept an
 * unterminated trailing block is hard to reason about, and upstream's behaviour here is
 * "the first block wins, and a block may be the whole tail of the message".
 */
export function extractCodeBlock(text: string, fence: string = CODE_FENCE): string | null {
  const lines = text.split("\n");
  const collected: string[] = [];
  let inside = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inside) {
      if (trimmed.startsWith(fence)) {
        inside = true;
      }
      continue;
    }
    if (trimmed.startsWith(fence)) {
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
