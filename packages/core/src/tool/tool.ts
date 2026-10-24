import { z } from "zod";
import { ToolHostedError } from "../errors.js";
import type { ToolSpec } from "../model.js";
import type { Logger } from "../logger.js";
import { resolveToolTimeout, withToolTimeout } from "./timeout.js";

export class ToolDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolDefinitionError";
  }
}

export interface ToolContext {
  readonly signal: AbortSignal;
  readonly fetch: typeof globalThis.fetch;
  readonly callId: string;
  readonly stepIndex: number;
  readonly logger: Logger;
  /** The agents that reached this tool call, root first; empty for a root run. */
  readonly agentPath?: readonly string[];
  /**
   * Receives progress a tool reports while it runs. A tool that returns a generator
   * reports through it; the sink is how the run turns those reports into events.
   */
  readonly onProgress?: (progress: unknown) => void;
}

/** A tool the provider runs itself: advertised to the model, never executed here. */
export interface HostedToolSpec {
  /** The provider that runs the tool, named in a refusal so a caller knows whose it is. */
  readonly provider: string;
  /** The provider's own payload, passed through untouched for an adapter to render. */
  readonly spec: Readonly<Record<string, unknown>>;
}

export interface ToolDefinition<TIn extends z.ZodType, TOut = unknown, TProgress = unknown> {
  /**
   * Defaults to the input schema's description when that description is itself a valid JavaScript
   * identifier. Set the name explicitly: it is what the model writes in generated code, it must be a
   * valid identifier, and a prose description almost never is — so treat the name as required.
   */
  name?: string;
  description: string;
  inputSchema: TIn;
  outputSchema?: z.ZodType<TOut>;
  /**
   * The tool's own deadline in milliseconds. Defaults to a finite one
   * (`DEFAULT_TOOL_TIMEOUT_MS`); 0 disables it. A tool that outlives it fails the call with
   * `ToolTimeoutError`, and an aborted run is reported as cancellation instead. A generator
   * tool is drained inside the same deadline, so the limit covers the whole tool.
   */
  timeoutMs?: number;
  /**
   * Whether calling the tool twice with the same arguments is safe. A journaled effect that
   * stopped in doubt is retried only when this is `true`; otherwise the run reports
   * `EffectOutcomeUnknownError` rather than guess. Defaults to `false`.
   */
  idempotent?: boolean;
  /**
   * Marks a tool the provider runs itself. Such a tool carries a `hosted` payload and no
   * `execute`: it is advertised with the provider's own description and never run here.
   */
  kind?: "hosted";
  /** The provider's description of a hosted tool, carried onto its specification. */
  hosted?: HostedToolSpec;
  /**
   * Validates every value a generator tool yields. A value that does not match is logged and
   * dropped; it never fails the call. Absent, every yield reaches the sink.
   */
  progressSchema?: z.ZodType<TProgress>;
  /**
   * Runs the tool. Returning an async generator drains it: each yield is progress, and the
   * generator's return value is the result. Absent on a hosted tool.
   */
  execute?: (
    input: z.infer<TIn>,
    ctx: ToolContext,
  ) => Promise<TOut> | TOut | AsyncGenerator<TProgress, TOut>;
}

export interface Tool<TIn extends z.ZodType = z.ZodType, TOut = unknown, TProgress = unknown>
  extends ToolDefinition<TIn, TOut, TProgress> {
  readonly name: string;
  /**
   * Runs the tool. Every `Tool` has one, so a container needs no narrowing: a hosted tool's
   * refuses with `ToolHostedError` rather than running a body. Declared as a method so a tool
   * with a narrower input schema stays assignable to the registry's looser `Tool`.
   */
  execute(input: z.infer<TIn>, ctx: ToolContext): Promise<TOut> | TOut;
  /** The provider-neutral advertisement handed to the model. */
  toSpec(): ToolSpec;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function resolveName(given: string | undefined, schema: z.ZodType): string | undefined {
  if (given !== undefined) return given;
  const description = schema.description;
  return description !== undefined && IDENTIFIER.test(description) ? description : undefined;
}

/** The JSON Schema a model receives for one input schema. */
function inputJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // z.toJSONSchema emits "$schema" (which providers ignore or reject) and, in input mode, omits
  // "additionalProperties: false" (which strict OpenAI-style function schemas require). Normalise both
  // here, so the prompt, the wire format and validation all stay derived from one source. Note that
  // z.toJSONSchema throws on types JSON Schema cannot express, such as z.bigint().
  //
  // Only the root object gets `additionalProperties: false`; nested objects keep it absent, so this is not
  // fully strict OpenAI-style (recorded for the whole-branch review).
  const jsonSchema = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  delete jsonSchema["$schema"];
  if (jsonSchema["type"] === "object" && jsonSchema["additionalProperties"] === undefined) {
    jsonSchema["additionalProperties"] = false;
  }
  return jsonSchema;
}

/**
 * Declare a tool. Schema-first by necessity: TypeScript types are erased at runtime, so the
 * contract must exist as a value (design spec section 8).
 */
export function tool<TIn extends z.ZodType, TOut = unknown, TProgress = unknown>(
  definition: ToolDefinition<TIn, TOut, TProgress>,
): Tool<TIn, TOut, TProgress> {
  const name = resolveName(definition.name, definition.inputSchema);
  if (name === undefined || name === "") {
    throw new ToolDefinitionError(
      "Tool has no name: pass an explicit name, or set the input schema's description to a valid identifier.",
    );
  }
  if (!IDENTIFIER.test(name)) {
    throw new ToolDefinitionError(
      "Tool name must be a valid JavaScript identifier, got: " + name,
    );
  }
  const hosted = definition.kind === "hosted";
  if (hosted && definition.hosted === undefined) {
    throw new ToolDefinitionError(
      'Tool "' + name + '" declares kind "hosted" without a hosted payload naming its provider.',
    );
  }
  if (hosted && definition.execute !== undefined) {
    throw new ToolDefinitionError(
      'Tool "' + name + '" is hosted and declares an execute; a hosted tool is run by its provider.',
    );
  }
  if (!hosted && definition.execute === undefined) {
    throw new ToolDefinitionError(
      'Tool "' + name + '" has no execute; a tool without one must declare kind "hosted" and a hosted payload.',
    );
  }
  const run = definition.execute;
  const execute =
    run === undefined
      ? async (): Promise<never> => {
          // The provider runs this tool; a caller that reaches the body anyway gets a typed refusal
          // naming it rather than a silent no-op.
          const provider = definition.hosted?.provider;
          throw new ToolHostedError(
            'Tool "' + name + '" is run by ' + String(provider) + ", not by this host.",
            provider === undefined ? {} : { provider },
          );
        }
      : (input: z.infer<TIn>, ctx: ToolContext): Promise<TOut> =>
          withToolTimeout(name, resolveToolTimeout(definition.timeoutMs), ctx.signal, () =>
            drainToolResult(name, run(input, ctx), definition.progressSchema, ctx),
          );
  return {
    ...definition,
    name,
    execute,
    toSpec(): ToolSpec {
      const inputSchema = inputJsonSchema(definition.inputSchema);
      const hostedSpec = definition.hosted;
      if (hostedSpec !== undefined) {
        return {
          name,
          description: definition.description,
          inputSchema,
          kind: "hosted",
          hosted: { provider: hostedSpec.provider, spec: { ...hostedSpec.spec } },
        };
      }
      return { name, description: definition.description, inputSchema };
    },
  };
}

/**
 * Await what a tool returned. A plain value or a promise is the result; an async generator is
 * drained, each yield reported through the sink and the return value kept as the result. The
 * drain happens inside the caller's deadline, so a generator that never settles times out.
 */
async function drainToolResult<TProgress, TOut>(
  name: string,
  produced: Promise<TOut> | TOut | AsyncGenerator<TProgress, TOut>,
  progressSchema: z.ZodType<TProgress> | undefined,
  ctx: ToolContext,
): Promise<TOut> {
  const settled = await produced;
  if (!isAsyncGenerator(settled)) return settled as TOut;
  const iterator = settled[Symbol.asyncIterator]();
  for (;;) {
    const next = await iterator.next();
    if (next.done === true) return next.value;
    reportProgress(name, next.value, progressSchema, ctx);
  }
}

function isAsyncGenerator<T>(value: unknown): value is AsyncGenerator<T, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { [Symbol.asyncIterator]?: unknown };
  return typeof candidate[Symbol.asyncIterator] === "function";
}

function reportProgress<TProgress>(
  name: string,
  progress: unknown,
  schema: z.ZodType<TProgress> | undefined,
  ctx: ToolContext,
): void {
  if (schema !== undefined) {
    const parsed = schema.safeParse(progress);
    if (!parsed.success) {
      ctx.logger.warn(
        'Tool "' + name + '" reported progress that does not match its schema: ' + parsed.error.message,
      );
      return;
    }
  }
  ctx.onProgress?.(progress);
}
