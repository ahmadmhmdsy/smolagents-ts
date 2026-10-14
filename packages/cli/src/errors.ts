/**
 * The refusals the CLI raises. Each carries the exit code its caller should use,
 * so the bin never guesses what a failure means: a usage error is 2, and every
 * other refusal is 1, which is what an uncaught error in upstream cli.py
 * produces.
 */

/** The base class. exitCode defaults to 1. */
export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = new.target.name;
    this.exitCode = exitCode;
  }
}

/** A command line the parser cannot read. argparse exits 2 on one, and so does this port. */
export class CliUsageError extends CliError {
  constructor(message: string) {
    super(message, 2);
  }
}

/**
 * A model type with no adapter here. Upstream's load_model handles four names;
 * this port ships adapters for two of them, so the other two are refused with
 * the alternatives named rather than quietly mapped onto one of them.
 */
export class UnsupportedModelTypeError extends CliError {
  readonly modelType: string;

  constructor(modelType: string) {
    super(
      "Unsupported model type: " +
        modelType +
        ". This port ships InferenceClientModel (the HuggingFaceModel adapter) and " +
        "OpenAIModel (the OpenAICompatibleModel adapter); LiteLLMModel and " +
        "TransformersModel have no adapter here.",
    );
    this.modelType = modelType;
  }
}

/** An action type outside the two this port implements. */
export class UnsupportedActionTypeError extends CliError {
  readonly actionType: string;

  constructor(actionType: string) {
    super('Unsupported action type: ' + actionType + '. Use "code" or "tool_calling".');
    this.actionType = actionType;
  }
}

/**
 * A tool name that is not one of this port's defaults. Upstream also loads a
 * tool from a Hugging Face Space when the name contains a slash, and ships a
 * Python interpreter tool; neither has a counterpart here, and each is refused
 * by name.
 */
export class UnsupportedToolError extends CliError {
  readonly toolName: string;

  constructor(toolName: string, reason: string) {
    super("Unsupported tool: " + toolName + ". " + reason);
    this.toolName = toolName;
  }
}

/**
 * The code action needs a CodeExecutor, and this port's executor is a separate
 * optional package. Raised when the caller supplied none and the lazy import
 * could not resolve, with the underlying reason appended.
 */
export class MissingExecutorError extends CliError {
  constructor(cause?: unknown) {
    super(
      "The code action needs a CodeExecutor. Pass one to runSmolagent, or install " +
        "@smolagents-ts/exec-quickjs so the CLI can load its QuickJSExecutor." +
        (cause === undefined ? "" : " (" + String(cause) + ")"),
    );
  }
}

/** --help is not a failure. The parser throws this and the bin answers with exit code 0. */
export class HelpRequested extends CliError {
  readonly usage: string;

  constructor(usage: string) {
    super(usage, 0);
    this.usage = usage;
  }
}
