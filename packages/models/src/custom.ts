import {
  MODEL_ADAPTER_VERSION,
  modelCapabilities,
  type ChatCompletion,
  type ChatCompletionChunk,
  type ChatMessage,
  type GenerateOptions,
  type ModelAdapterV1,
  type ModelCapabilities,
} from "@smolagents-ts/core";

export type CustomGenerate = (
  messages: readonly ChatMessage[],
  options: GenerateOptions,
) => Promise<ChatCompletion>;

export type CustomGenerateStream = (
  messages: readonly ChatMessage[],
  options: GenerateOptions,
) => AsyncIterable<ChatCompletionChunk>;

export interface CustomModelOptions {
  id: string;
  provider?: string;
  capabilities?: Partial<ModelCapabilities>;
  generate: CustomGenerate;
  /** Without one, the model reports streaming: false and refuses to stream. */
  generateStream?: CustomGenerateStream;
}

/**
 * A model defined by functions: the seam without a wire format. It is what a test needs to
 * script a turn, and what a caller needs to plug in a transport this package does not
 * ship.
 */
export class CustomModel implements ModelAdapterV1 {
  readonly id: string;
  readonly provider: string;
  readonly capabilities: ModelCapabilities;
  readonly adapterVersion = MODEL_ADAPTER_VERSION;

  private readonly generateImpl: CustomGenerate;
  private readonly generateStreamImpl: CustomGenerateStream | undefined;

  constructor(options: CustomModelOptions) {
    this.id = options.id;
    this.provider = options.provider ?? "custom";
    this.capabilities = modelCapabilities({
      streaming: options.generateStream !== undefined,
      ...options.capabilities,
    });
    this.generateImpl = options.generate;
    this.generateStreamImpl = options.generateStream;
  }

  generate(messages: readonly ChatMessage[], options: GenerateOptions = {}): Promise<ChatCompletion> {
    return this.generateImpl(messages, options);
  }

  generateStream(
    messages: readonly ChatMessage[],
    options: GenerateOptions = {},
  ): AsyncIterable<ChatCompletionChunk> {
    const impl = this.generateStreamImpl;
    if (impl === undefined) {
      throw new Error("This CustomModel was created without a generateStream function");
    }
    return impl(messages, options);
  }
}
