import {
  AgentError,
  AgentToolCallError,
  type AgentErrorCode,
  type AgentErrorInfo,
  type Logger,
  type ToolCallEvent,
  type ToolContext,
  type ToolRegistry,
} from "@smolagents-ts/core";

/** A tool result as a JSON string, degrading a value JSON cannot express to its string form. */
export function serializeToolResult(value: unknown): string {
  try {
    const text = JSON.stringify(value ?? null) as string | undefined;
    return text ?? JSON.stringify(String(value));
  } catch {
    return JSON.stringify(String(value));
  }
}

/** The plain-data error a tool event carries. */
export function toErrorInfo(error: unknown, code: AgentErrorCode, stepIndex: number): AgentErrorInfo {
  if (error instanceof AgentError) return { ...error.info, stepIndex };
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : String(error);
  return { name, message, code, stepIndex };
}

export interface ToolBridgeOptions {
  readonly tools: ToolRegistry;
  readonly signal: AbortSignal;
  readonly stepIndex: number;
  readonly logger: Logger;
  readonly fetch: typeof globalThis.fetch;
  readonly agentPath?: readonly string[];
  readonly onToolCall?: (event: ToolCallEvent) => void;
}

/**
 * The host end of the tool call. The guest's emitted wrapper awaits this and parses the
 * envelope, so every failure travels back as data and the wrapper raises a Python
 * `RuntimeError`. That indirection is deliberate: a JavaScript function that throws, or a
 * host promise that rejects, reaches Python as `pyodide.ffi.JsException`, which a guest
 * written against upstream's executor would not recognise; the envelope keeps the error a
 * `RuntimeError`, which is what upstream's tool wrappers raise.
 *
 * Event order mirrors the QuickJS executor: a bad call reports only `failed`, a good call
 * reports `requested` then either `result` or `failed`.
 */
export class ToolBridge {
  private counter = 0;
  private calls = 0;
  private disabled = false;

  constructor(private readonly options: ToolBridgeOptions) {}

  /** How many calls the guest made, successful or not. */
  get toolCallCount(): number {
    return this.calls;
  }

  /**
   * Retire the bridge when its run ends or is abandoned. A poisoned runtime can still have live
   * Python on it, and a finished step can leave a scheduled coroutine behind; a tool call from
   * either must not reach a tool, the step's signal, or the step's onToolCall.
   */
  disable(): void {
    this.disabled = true;
  }

  /** The global the guest reaches as `__call_tool`; takes and returns one JSON string. */
  readonly call = async (name: string, argsJson: string): Promise<string> => {
    const options = this.options;
    // A retired bridge belongs to a step that has already reported; a late call from a guest
    // coroutine is refused without touching that step's count or its onToolCall.
    if (this.disabled) return JSON.stringify({ ok: false, error: "Code execution was cancelled" });
    this.calls += 1;
    this.counter += 1;
    const callId = "call_" + String(this.counter);
    const fail = (message: string): string => {
      const error = new AgentToolCallError(message, { stepIndex: options.stepIndex });
      options.onToolCall?.({ type: "failed", callId, name, error: error.info });
      return JSON.stringify({ ok: false, error: message });
    };

    if (options.signal.aborted) return fail("Code execution was cancelled");

    const tool = options.tools.get(name);
    if (tool === undefined) return fail("Unknown tool: " + name);

    let input: unknown;
    try {
      input = JSON.parse(argsJson);
    } catch {
      return fail("Arguments for " + name + " were not JSON");
    }

    const parsed = tool.inputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Invalid arguments for " + name + ": " + parsed.error.message);
    }

    options.onToolCall?.({ type: "requested", callId, name, args: parsed.data });
    const startedAt = Date.now();
    const context: ToolContext = {
      signal: options.signal,
      fetch: options.fetch,
      callId,
      stepIndex: options.stepIndex,
      logger: options.logger,
      ...(options.agentPath === undefined ? {} : { agentPath: options.agentPath }),
    };
    try {
      const output = await tool.execute(parsed.data, context);
      // The host is back in control, so a stop that arrived while the tool ran is honoured here.
      if (this.disabled || options.signal.aborted) {
        return fail("Code execution was cancelled");
      }
      options.onToolCall?.({
        type: "result",
        callId,
        name,
        output,
        durationMs: Date.now() - startedAt,
      });
      return '{"ok":true,"value":' + serializeToolResult(output) + "}";
    } catch (error) {
      const info = toErrorInfo(error, "AGENT_TOOL_CALL", options.stepIndex);
      options.onToolCall?.({ type: "failed", callId, name, error: info });
      return JSON.stringify({ ok: false, error: 'Tool "' + name + '" failed: ' + info.message });
    }
  };
}
