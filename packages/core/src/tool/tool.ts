import { z } from "zod";
import type { ToolSpec } from "../model.js";
import type { Logger } from "../logger.js";

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
}

export interface ToolDefinition<TIn extends z.ZodType, TOut = unknown> {
  /**
   * Defaults to the input schema's description when that description is itself a valid JavaScript
   * identifier. Set the name explicitly: it is what the model writes in generated code, it must be a
   * valid identifier, and a prose description almost never is — so treat the name as required.
   */
  name?: string;
  description: string;
  inputSchema: TIn;
  outputSchema?: z.ZodType<TOut>;
  execute: (input: z.infer<TIn>, ctx: ToolContext) => Promise<TOut> | TOut;
}

export interface Tool<TIn extends z.ZodType = z.ZodType, TOut = unknown>
  extends ToolDefinition<TIn, TOut> {
  readonly name: string;
  /** The provider-neutral advertisement handed to the model. */
  toSpec(): ToolSpec;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function resolveName(given: string | undefined, schema: z.ZodType): string | undefined {
  if (given !== undefined) return given;
  const description = schema.description;
  return description !== undefined && IDENTIFIER.test(description) ? description : undefined;
}

/**
 * Declare a tool. Schema-first by necessity: TypeScript types are erased at runtime, so
 * the contract must exist as a value (design spec section 8).
 */
export function tool<TIn extends z.ZodType, TOut = unknown>(
  definition: ToolDefinition<TIn, TOut>,
): Tool<TIn, TOut> {
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
  return {
    ...definition,
    name,
    toSpec(): ToolSpec {
      // z.toJSONSchema emits "$schema" (which providers ignore or reject) and, in input mode, omits
      // "additionalProperties: false" (which strict OpenAI-style function schemas require). Normalise both Only the root object gets `additionalProperties: false`; nested objects keep it absent, so this is not fully strict OpenAI-style (recorded for the whole-branch review).
      // here, so the prompt, the wire format and validation all stay derived from one source. Note that
      // z.toJSONSchema throws on types JSON Schema cannot express, such as z.bigint().
      const jsonSchema = z.toJSONSchema(definition.inputSchema, { io: "input" }) as Record<string, unknown>;
      delete jsonSchema["$schema"];
      if (jsonSchema["type"] === "object" && jsonSchema["additionalProperties"] === undefined) {
        jsonSchema["additionalProperties"] = false;
      }
      return {
        name,
        description: definition.description,
        inputSchema: jsonSchema,
      };
    },
  };
}
