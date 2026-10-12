import type { AgentErrorInfo } from "../errors.js";
import type { ToolCallRequest } from "../model.js";

/**
 * The name the guest or the model calls to end the run. It lives here, in the lowest-level
 * module both agent flavours already import, so exactly one binding for it exists in the
 * package. A second declaration would make the public star-export ambiguous.
 */
export const FINAL_ANSWER_TOOL_NAME = "final_answer";

/** What the agent decided to do with one model response. */
export interface InterpretedAction {
  kind: "final" | "code" | "toolcalls" | "empty";
  /** The raw model text, kept for the ActionStep and for debugging. */
  raw: string;
  /** Set when kind is "final". */
  output?: unknown;
  /** Set when kind is "code". */
  code?: string;
  /** Set when kind is "toolcalls". */
  calls?: ToolCallRequest[];
}

/** The result of executing one action. */
export interface ActionOutcome {
  /** Everything the guest printed, plus any error text. Becomes the Observation. */
  observations: string;
  isFinalAnswer: boolean;
  /** Set when isFinalAnswer is true. */
  value?: unknown;
  error?: AgentErrorInfo;
}
