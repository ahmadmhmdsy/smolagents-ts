import type { ReactNode } from "react";
import type { ToolCallView } from "@smolagents-ts/core";
import { renderValue } from "./final-answer.js";

const STATUS_TEXT: Record<ToolCallView["status"], string> = {
  pending: "running",
  ok: "done",
  error: "failed",
};

export interface ToolCallProps {
  readonly call: ToolCallView;
  readonly children?: ReactNode;
}

/**
 * One tool call. The status text is the only live region, and it reads the store's status,
 * which is set from `action.result` / `action.failed` — never from a provisional call — so
 * a completion is announced once.
 */
export function ToolCall({ call, children }: ToolCallProps) {
  return (
    <div className="agent-tool-call" data-tool={call.name} data-status={call.status}>
      <span className="agent-tool-call-name">{call.name}</span>
      <span role="status" aria-live="polite">
        {STATUS_TEXT[call.status]}
      </span>
      {call.output === undefined ? null : (
        <pre className="agent-tool-call-output">{renderValue(call.output)}</pre>
      )}
      {call.error === undefined ? null : <pre className="agent-tool-call-error">{call.error}</pre>}
      {children}
    </div>
  );
}
