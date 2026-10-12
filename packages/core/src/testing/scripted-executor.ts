import type {
  CodeExecutor,
  CodeResult,
  ExecuteOptions,
  ExecutorCapabilities,
  ExecutorLanguage,
} from "../executor.js";

export type ScriptedHandler = (
  code: string,
  options: ExecuteOptions,
) => Promise<CodeResult> | CodeResult;

export interface ScriptedExecutorOptions {
  language?: ExecutorLanguage;
  /** Exact-code dispatch, checked before the handler. */
  results?: Record<string, CodeResult>;
  handler?: ScriptedHandler;
  capabilities?: Partial<ExecutorCapabilities>;
}

const DEFAULT_CAPABILITIES: ExecutorCapabilities = {
  language: "javascript",
  isolation: "none",
  asyncToolCalls: true,
  timers: true,
  network: "host-mediated",
};

/** The common case: the guest called final_answer. */
export function finalAnswerResult(value: unknown, logs = ""): CodeResult {
  return { logs, isFinalAnswer: true, value, durationMs: 0, toolCallCount: 0 };
}

/**
 * A deterministic executor double. Records what it ran and answers from a script, so the
 * whole agent loop can be tested without a sandbox (design spec section 11).
 */
export class ScriptedExecutor implements CodeExecutor {
  readonly language: ExecutorLanguage;
  readonly capabilities: ExecutorCapabilities;
  readonly executed: string[] = [];

  private readonly results: Record<string, CodeResult>;
  private readonly handler: ScriptedHandler | undefined;
  /** Scripted mode: a configured script with no handler rejects on unrecorded code. */
  private readonly scripted: boolean;

  constructor(options: ScriptedExecutorOptions = {}) {
    this.language = options.language ?? "javascript";
    this.capabilities = {
      ...DEFAULT_CAPABILITIES,
      language: this.language,
      ...options.capabilities,
    };
    this.results = options.results ?? {};
    this.handler = options.handler;
    this.scripted = options.results !== undefined;
  }

  execute(code: string, options: ExecuteOptions): Promise<CodeResult> {
    this.executed.push(code);
    const recorded = this.results[code];
    if (recorded !== undefined) return Promise.resolve(recorded);
    const handler = this.handler;
    if (handler !== undefined) {
      // Defer the call so a synchronously throwing handler becomes a rejection rather than a
      // synchronous throw, which would escape execute()'s Promise<CodeResult> contract.
      return Promise.resolve().then(() => handler(code, options));
    }
    if (!this.scripted) {
      return Promise.resolve({ logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 });
    }
    return Promise.reject(
      new Error("ScriptedExecutor has no scripted result for code: " + code),
    );
  }
}
