/**
 * The programmatic surface of the CLI.
 *
 * The bin is the package's main consumer, but everything it builds is exported so a
 * test or a host can drive the same parser, factories, renderer and run function
 * without a terminal.
 */
export { VERSION } from "./version.js";
export {
  DEFAULT_ACTION_TYPE,
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_TYPE,
  DEFAULT_TOOLS,
  DEFAULT_VERBOSITY_LEVEL,
  INTERACTIVE_MODEL_ID,
  USAGE,
  parseArguments,
} from "./args.js";
export type { CliArguments } from "./args.js";
export {
  CliError,
  CliUsageError,
  HelpRequested,
  MissingExecutorError,
  UnsupportedActionTypeError,
  UnsupportedModelTypeError,
  UnsupportedToolError,
} from "./errors.js";
export {
  HF_TOKEN_VARIABLE,
  OPENAI_API_KEY_VARIABLE,
  loadModel,
  resolveApiKey,
} from "./model-factory.js";
export type { ModelConfig, ModelFactoryOptions } from "./model-factory.js";
export { defaultToolCatalog, defaultToolNames, loadTools } from "./tool-factory.js";
export type { ToolCatalogEntry } from "./tool-factory.js";
export { display, renderEvent, supportsColor } from "./renderer.js";
export type { RenderOptions } from "./renderer.js";
export {
  ACTION_TYPES,
  API_MODEL_TYPES,
  INTERACTIVE_MODEL_TYPES,
  LEOPARD_PROMPT,
  interactiveMode,
} from "./interactive.js";
export type { InteractiveIo, InteractiveSelection } from "./interactive.js";
export { createTerminalPrompter, writeTo } from "./terminal.js";
export type { AskOptions, Prompter, Writer } from "./terminal.js";
export { runSmolagent } from "./run.js";
export type { RunSmolagentOptions } from "./run.js";
export { DEFAULT_STATE_DIRECTORY, nodeRunFileSystem } from "./store.js";
