import { AgentGenerationError } from "../errors.js";
import { type ChatCompletion, type ChatCompletionChunk, type FinishReason, type GenerateOptions, type Model, type ToolCallRequest, modelCapabilities } from "../model.js";
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
  }

  async generate(messages: readonly ChatMessage[], _options?: GenerateOptions): Promise<ChatCompletion> {
    const turn = this.take(messages);
    return {
      content: turn.content ?? "",
      toolCalls: turn.toolCalls === undefined ? [] : turn.toolCalls.map((call) => ({ ...call })),
      usage: turn.usage ?? EMPTY_TOKEN_USAGE,
      finishReason: turn.finishReason ?? "stop",
    };
  }

  async *generateStream(
    messages: readonly ChatMessage[],
    _options?: GenerateOptions,
  ): AsyncIterable<ChatCompletionChunk> {
    const turn = this.take(messages);
    const content = turn.content ?? "";
    const size = this.chunkSize > 0 ? this.chunkSize : content.length;
    if (content.length === 0) {
      yield { delta: "", finishReason: turn.finishReason ?? "stop" };
      return;
    }
    for (let offset = 0; offset < content.length; offset += size) {
      const delta = content.slice(offset, offset + size);
      // The finish reason rides on the final content chunk: the test contract is that the
      // delta sequence is exactly the content chunks, with no trailing empty-delta chunk.
      yield offset + size >= content.length
        ? { delta, finishReason: turn.finishReason ?? "stop" }
        : { delta };
    }
  }

  private take(messages: readonly ChatMessage[]): MockTurn {
    this.calls.push([...messages]);
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
  return typeof input === "string" ? { content: input } : input;
}
