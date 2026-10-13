import { AgentError, type AgentErrorCode, type AgentErrorInfo } from "@smolagents-ts/core";

/**
 * A tool result as the guest receives it. The guest parses this with JSON.parse, so a value
 * JSON cannot express (a function, a bigint, a cycle) degrades to its string form rather
 * than failing the call the model already made.
 */
export function serializeToolResult(value: unknown): string {
  try {
    const text = JSON.stringify(value ?? null) as string | undefined;
    return text ?? JSON.stringify(String(value));
  } catch {
    // A bigint or a cycle: JSON refuses it outright, so the guest receives its string form.
    return JSON.stringify(String(value));
  }
}

/** The plain-data error an event carries. Guest errors arrive as dumped {name, message}. */
export function toErrorInfo(
  error: unknown,
  code: AgentErrorCode,
  stepIndex: number,
): AgentErrorInfo {
  if (error instanceof AgentError) return { ...error.info, stepIndex };
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : String(error);
  return { name, message, code, stepIndex };
}
