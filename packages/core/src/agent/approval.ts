import { AgentError } from "../errors.js";
import type { Tool } from "../tool/tool.js";
import { digestOf } from "../utils/digest.js";

/**
 * The closed set of verdicts an approval can produce. Only `allowed-once` grants this one call:
 * there is no sticky grant, because a session-wide `always` is the hole this vocabulary closes.
 * `pending` is not a decision: the gate parks the run and a later resume settles it.
 */
export type ApprovalOutcome = "allowed-once" | "rejected" | "cancelled" | "unavailable" | "pending";

/** An outcome a resume may settle a pending request with. A resume cannot park again. */
export type SettledApprovalOutcome = Exclude<ApprovalOutcome, "pending">;

/** Per-session policy. `never` refuses before the handler is consulted — CI and headless runs want it. */
export type ApprovalPolicy = "ask" | "never";

/** What an approval handler is asked, before a tool call runs. */
export interface ApprovalRequest {
  readonly name: string;
  /** The arguments after schema validation — exactly what `execute` would receive. */
  readonly input: unknown;
  /** The id of the tool call this ask belongs to. */
  readonly requestId: string;
  /** A stable digest of `input`; a verdict for other arguments is refused. */
  readonly digest: string;
  readonly stepIndex: number;
}

/** A handler's answer, bound to the ask it answers. */
export interface ApprovalVerdict {
  readonly requestId: string;
  readonly digest: string;
  readonly outcome: ApprovalOutcome;
}

/**
 * Decide whether a tool call may run. A boolean stays accepted as shorthand —
 * `true` is `allowed-once`, `false` is `rejected` — because that is the shape callers already
 * write; anything else is malformed and fails closed.
 */
export type ApprovalHandler = (
  request: ApprovalRequest,
) => ApprovalVerdict | boolean | Promise<ApprovalVerdict | boolean>;

/** What was decided, as it is recorded in the run's event stream. */
export interface ApprovalDecision {
  readonly requestId: string;
  readonly digest: string;
  readonly name: string;
  readonly stepIndex: number;
  readonly outcome: ApprovalOutcome;
  readonly reason?: string;
}

/** Options beside a handler: the session policy, and where a decision is recorded. */
export interface ApprovalGateOptions {
  readonly policy?: ApprovalPolicy;
  readonly onDecision?: (decision: ApprovalDecision) => void;
}

/**
 * Thrown when the gate parks a run on a request it will not decide. It carries the ask, so the
 * loop can commit it as the record's `pending` object.
 */
export class ToolApprovalPendingError extends Error {
  readonly request: ApprovalRequest;

  constructor(request: ApprovalRequest) {
    super("Tool call to '" + request.name + "' is waiting for a decision");
    this.name = "ToolApprovalPendingError";
    this.request = request;
  }
}

/** Thrown when an approval does not grant a tool call, so a caller can tell a refusal from a crash. */
export class ToolApprovalError extends Error {
  readonly outcome: ApprovalOutcome;

  constructor(message: string, outcome: ApprovalOutcome = "rejected") {
    super(message);
    this.name = "ToolApprovalError";
    this.outcome = outcome;
  }
}

/**
 * Normalise whatever a handler answered into a decision. A verdict for another call, another
 * input, an unknown outcome or a non-boolean non-verdict value is refused; only `allowed-once`
 * lets the call through.
 */
function resolveVerdict(
  request: ApprovalRequest,
  raw: ApprovalVerdict | boolean | undefined,
): { outcome: ApprovalOutcome; reason?: string } {
  if (raw === true) return { outcome: "allowed-once" };
  if (raw === false) return { outcome: "rejected", reason: "denied by the approval handler" };
  if (raw === undefined || raw === null || typeof raw !== "object") {
    return { outcome: "unavailable", reason: "the approval handler returned no verdict" };
  }
  const verdict = raw as Partial<ApprovalVerdict>;
  if (verdict.requestId !== request.requestId) {
    return {
      outcome: "rejected",
      reason: "the verdict names call " + String(verdict.requestId) + ", not " + request.requestId,
    };
  }
  if (verdict.digest !== request.digest) {
    return {
      outcome: "rejected",
      reason: "the verdict names a different input digest (arguments changed after the ask)",
    };
  }
  switch (verdict.outcome) {
    case "allowed-once":
    case "rejected":
    case "cancelled":
    case "unavailable":
    case "pending":
      return { outcome: verdict.outcome };
    default:
      return { outcome: "unavailable", reason: "unknown approval outcome: " + String(verdict.outcome) };
  }
}

/**
 * Wrap a tool so every call passes the approval gate first. Both agent flavours resolve their
 * tools from the registry — generated code through the executor, structured calls through the
 * agent — so gating once, here at the seam every caller routes through, covers both.
 */
export function withApproval(
  entry: Tool,
  approve: ApprovalHandler,
  options: ApprovalGateOptions = {},
): Tool {
  return {
    ...entry,
    async execute(input, context) {
      const request: ApprovalRequest = {
        name: entry.name,
        input,
        requestId: context.callId,
        digest: digestOf(input),
        stepIndex: context.stepIndex,
      };

      let decision: ApprovalDecision;
      if (options.policy === "never") {
        decision = {
          requestId: request.requestId,
          digest: request.digest,
          name: request.name,
          stepIndex: request.stepIndex,
          outcome: "rejected",
          reason: "the session approval policy is 'never'",
        };
      } else {
        let resolved: { outcome: ApprovalOutcome; reason?: string };
        try {
          resolved = resolveVerdict(request, await approve(request));
        } catch (error) {
          // A typed refusal (a resume settlement that does not match this call) must stay typed;
          // flattening it into "unavailable" would hide the reason from the caller.
          if (error instanceof AgentError) throw error;
          resolved = {
            outcome: "unavailable",
            reason: error instanceof Error ? error.message : String(error),
          };
        }
        decision = {
          requestId: request.requestId,
          digest: request.digest,
          name: request.name,
          stepIndex: request.stepIndex,
          ...resolved,
        };
      }

      options.onDecision?.(decision);

      // A park is not a refusal: the loop turns it into a waiting record instead of a failure.
      if (decision.outcome === "pending") throw new ToolApprovalPendingError(request);

      if (decision.outcome !== "allowed-once") {
        const reason = decision.reason === undefined ? "" : ": " + decision.reason;
        throw new ToolApprovalError(
          "Tool call to '" + entry.name + "' was " + decision.outcome + reason,
          decision.outcome,
        );
      }
      return entry.execute(input, context);
    },
  };
}
