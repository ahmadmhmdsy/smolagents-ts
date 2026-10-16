/** Context a tripwire sees beside the value it inspects. */
export interface GuardrailContext {
  readonly task: string;
  readonly signal: AbortSignal;
}

/**
 * A tripwire. It returns a reason string to stop the run, or `undefined` to let the value through.
 * Returning a reason rather than throwing keeps the halt a value the loop turns into an
 * `AgentGuardrailError`, so a caller never has to import the error to trip a wire.
 */
export type Tripwire = (
  value: unknown,
  context: GuardrailContext,
) => string | undefined | Promise<string | undefined>;

/**
 * Tripwires on a run: `input` inspects the task before the loop starts, `output` inspects the final
 * answer before the run completes. Either may be asynchronous. A caller wanting several checks
 * composes them inside one tripwire rather than passing a list.
 */
export interface Guardrails {
  readonly input?: InputTripwire;
  readonly output?: Tripwire;
}

/** The input tripwire inspects the task, so its value is the task text. */
export type InputTripwire = (
  task: string,
  context: GuardrailContext,
) => string | undefined | Promise<string | undefined>;
