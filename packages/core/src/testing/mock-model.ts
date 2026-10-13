import { AgentGenerationError } from "../errors.js";
import { type ChatCompletion, type ChatCompletionChunk, type FinishReason, type GenerateOptions, type Model, modelCapabilities } from "../model.js";
import type { ToolCallRequest } from "../types.js";
import { type TokenUsage, EMPTY_TOKEN_USAGE } from "../types.js";
import type { ChatMessage } from "../types.js";

export interface MockTurn {
  content?: string;
  toolCalls?: ToolCallRequest[];
  usage?: TokenUsage;
  finishReason?: FinishReason;
}

export type MockTurnInput = string | MockTurn;

export interface MockModelOptions {
  responses: MockTurnInput[];
  id?: string;
  /** Split streamed content into chunks of this many characters. 0 means one chunk. */
  chunkSize?: number;
}

/**
 * A deterministic scripted model. Every loop test in this project replays a fixed
 * transcript through it, which is what makes the ReAct cycle testable without a provider.
 */
export class MockModel implements Model {
  readonly id: string;
  readonly provider = "mock";
  readonly capabilities = modelCapabilities({ streaming: true, toolCalls: true });

  private readonly turns: MockTurn[];
  private readonly chunkSize: number;
  private index = 0;

  /** Every transcript passed to generate or generateStream, in call order. */
  readonly calls: ChatMessage[][] = [];

  /** The options each of those calls was made with, in the same order. */
  readonly requestOptions: GenerateOptions[] = [];

  constructor(input: MockTurnInput[] | MockModelOptions) {
    if (Array.isArray(input)) {
      this.turns = input.map(normalizeTurn);
      this.id = "mock";
      this.chunkSize = 0;
    } else {
      this.turns = input.responses.map(normalizeTurn);
      this.id = input.id ?? "mock";
      this.chunkSize = input.chunkSize ?? 0;
    }
  }

  get callCount(): number {
    return this.index;
  }

  get remaining(): number {
    return this.turns.length - this.index;
  }

  reset(): void {
    this.index = 0;
    this.calls.length = 0;
    this.requestOptions.length = 0;
  }

  async generate(messages: readonly ChatMessage[], options?: GenerateOptions): Promise<ChatCompletion> {
    const turn = this.take(messages, options);
    return {
      content: turn.content ?? "",
      toolCalls: turn.toolCalls === undefined ? [] : turn.toolCalls.map((call) => ({ ...call })),
      usage: { ...(turn.usage ?? EMPTY_TOKEN_USAGE) },
      finishReason: turn.finishReason ?? "stop",
    };
  }

  async *generateStream(
    messages: readonly ChatMessage[],
    options?: GenerateOptions,
  ): AsyncIterable<ChatCompletionChunk> {
    const turn = this.take(messages, options);
    const content = turn.content ?? "";
    const size = this.chunkSize > 0 ? this.chunkSize : content.length;
    if (content.length === 0) {
      yield { delta: "", finishReason: turn.finishReason ?? "stop" };
      yield* this.usageChunk(turn);
      return;
    }
    for (let offset = 0; offset < content.length; offset += size) {
      const delta = content.slice(offset, offset + size);
      // The finish reason rides on the final content chunk, so the delta sequence is
      // exactly the content chunks; a usage report, when there is one, follows them.
      yield offset + size >= content.length
        ? { delta, finishReason: turn.finishReason ?? "stop" }
        : { delta };
    }
    yield* this.usageChunk(turn);
  }

  /** A real provider reports usage on a trailing textless chunk. So does this one. */
  private *usageChunk(turn: MockTurn): Iterable<ChatCompletionChunk> {
    if (turn.usage !== undefined) yield { delta: "", usage: { ...turn.usage } };
  }

  private take(messages: readonly ChatMessage[], options?: GenerateOptions): MockTurn {
    this.calls.push([...messages]);
    this.requestOptions.push(options ?? {});
    const turn = this.turns[this.index];
    if (turn === undefined) {
      throw new AgentGenerationError(
        "MockModel script exhausted after " + String(this.index) + " responses",
      );
    }
    this.index += 1;
    return turn;
  }
}

function normalizeTurn(input: MockTurnInput): MockTurn {
  if (typeof input === "string") return { content: input };
  const turn: MockTurn = { ...input };
  if (input.toolCalls !== undefined) turn.toolCalls = input.toolCalls.map((call) => ({ ...call }));
  return turn;
}
