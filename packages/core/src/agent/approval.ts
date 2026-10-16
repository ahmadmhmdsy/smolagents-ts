import type { Tool } from "../tool/tool.js";

/** What an approval handler is asked, before a tool call runs. */
export interface ApprovalRequest {
  readonly name: string;
  /** The arguments after schema validation — exactly what `execute` would receive. */
  readonly input: unknown;
  readonly stepIndex: number;
}

/** Decide whether a tool call may run. Return false, or a promise of false, to deny it. */
export type ApprovalHandler = (request: ApprovalRequest) => boolean | Promise<boolean>;

/** Thrown when an approval handler denies a tool call, so a caller can tell a denial from a crash. */
export class ToolApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolApprovalError";
  }
}

/**
 * Wrap a tool so every call passes the approval handler first. Both agent flavours resolve their
 * tools from the registry — generated code through the executor, structured calls through the
 * agent — so gating once, here at the seam every caller routes through, covers both.
 */
export function withApproval(entry: Tool, approve: ApprovalHandler): Tool {
  return {
    ...entry,
    async execute(input, context) {
      const allowed = await approve({ name: entry.name, input, stepIndex: context.stepIndex });
      if (!allowed) {
        throw new ToolApprovalError(
          "Tool call to '" + entry.name + "' was denied by the approval handler.",
        );
      }
      return entry.execute(input, context);
    },
  };
}
