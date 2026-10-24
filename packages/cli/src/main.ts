#!/usr/bin/env node
import { realpathSync } from "node:fs";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArguments } from "./args.js";
import { CliError, HelpRequested } from "./errors.js";
import { interactiveMode, type InteractiveSelection } from "./interactive.js";
import { supportsColor } from "./renderer.js";
import { runSmolagent, type RunSmolagentOptions } from "./run.js";
import { createTerminalPrompter, type Prompter, writeTo } from "./terminal.js";
import { defaultToolCatalog } from "./tool-factory.js";

export interface MainOptions {
  /**
   * The environment a provider key is read from. Defaults to the process's own, which is
   * the whole point of the parameter: `runSmolagent` defaults to an empty map so that its
   * tests never read the host's environment, and the bin is the caller that must supply it.
   */
  env?: Readonly<Record<string, string | undefined>>;
  /** Injected instead of the real run, so a test can see the options the bin assembles. */
  run?: (options: RunSmolagentOptions) => Promise<number>;
  /** Injected instead of the terminal's prompter, so a test can drive interactive setup. */
  createPrompter?: () => Prompter;
}

/**
 * The bin: parse, set up, run.
 *
 * Exit codes match the error hierarchy: 0 for a completed run or for --help, 2 for a
 * command line the parser rejects, 130 for interactive setup ended by EOF or Ctrl+C, 3 for a
 * durable run parked on an approval, and 1 for everything else. With no prompt and no
 * --resume the interactive setup asks for the configuration before the run.
 */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  options: MainOptions = {},
): Promise<number> {
  let args;
  try {
    args = parseArguments(argv);
  } catch (error) {
    if (error instanceof HelpRequested) {
      process.stdout.write(error.usage + "\n");
      return 0;
    }
    if (error instanceof CliError) {
      process.stderr.write(error.message + "\n");
      return error.exitCode;
    }
    throw error;
  }

  let selection: InteractiveSelection;
  if (args.prompt === undefined && args.resume === undefined) {
    const prompter = (options.createPrompter ?? createTerminalPrompter)();
    try {
      selection = await interactiveMode({
        print: writeTo(process.stdout),
        prompter,
        catalog: defaultToolCatalog(),
      });
    } catch (error) {
      if (error instanceof CliError) {
        process.stderr.write("\n" + error.message + "\n");
        return error.exitCode;
      }
      throw error;
    } finally {
      prompter.close();
    }
  } else {
    selection = {
      prompt: args.prompt ?? "",
      tools: args.tools,
      modelType: args.modelType,
      modelId: args.modelId,
      imports: args.imports,
      actionType: args.actionType,
      ...(args.provider === undefined ? {} : { provider: args.provider }),
      ...(args.apiBase === undefined ? {} : { apiBase: args.apiBase }),
      ...(args.apiKey === undefined ? {} : { apiKey: args.apiKey }),
    };
  }

  // The environment is passed explicitly. Without it a key reaches no adapter, and the
  // USAGE text and the component entry both promise that HF_TOKEN and OPENAI_API_KEY are read.
  return (options.run ?? runSmolagent)({
    ...selection,
    verbosityLevel: args.verbosityLevel,
    color: supportsColor(process.stdout.isTTY, process.env),
    env: options.env ?? process.env,
    stateDir: args.stateDir,
    ...(args.runId === undefined ? {} : { runId: args.runId }),
    ...(args.resume === undefined ? {} : { resume: args.resume }),
    ...(args.approve === undefined ? {} : { approve: args.approve }),
  });
}

/**
 * Whether the module at `moduleUrl` is the script the runtime was asked to run.
 *
 * `import.meta.url` is the real path (Node resolves a symlink before loading), while
 * `process.argv[1]` keeps the path the caller typed. Comparing the URLs alone therefore
 * fails for a package-manager bin symlink, and the CLI silently exits 0. Resolve both
 * sides, and fall back to the URL comparison when either path no longer exists.
 */
export function isMainModule(moduleUrl: string, scriptPath: string | undefined): boolean {
  if (scriptPath === undefined) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(scriptPath);
  } catch {
    return moduleUrl === pathToFileURL(scriptPath).href;
  }
}

const invokedAsBin = isMainModule(import.meta.url, process.argv[1]);

if (invokedAsBin) {
  process.exitCode = await main();
}
