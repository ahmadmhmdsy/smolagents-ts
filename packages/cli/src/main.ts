#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parseArguments } from "./args.js";
import { CliError, HelpRequested } from "./errors.js";
import { interactiveMode, type InteractiveSelection } from "./interactive.js";
import { supportsColor } from "./renderer.js";
import { runSmolagent } from "./run.js";
import { createTerminalPrompter, writeTo } from "./terminal.js";
import { defaultToolCatalog } from "./tool-factory.js";

/**
 * The bin: parse, set up, run.
 *
 * Exit codes match the error hierarchy: 0 for a completed run or for --help, 2 for a
 * command line the parser rejects, and 1 for everything else. With no prompt the
 * interactive setup asks for the configuration before the run.
 */
export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
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
  if (args.prompt === undefined) {
    const prompter = createTerminalPrompter();
    try {
      selection = await interactiveMode({
        print: writeTo(process.stdout),
        prompter,
        catalog: defaultToolCatalog(),
      });
    } finally {
      prompter.close();
    }
  } else {
    selection = {
      prompt: args.prompt,
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

  return runSmolagent({
    ...selection,
    verbosityLevel: args.verbosityLevel,
    color: supportsColor(process.stdout.isTTY, process.env),
  });
}

const entry = process.argv[1];
const invokedAsBin =
  entry !== undefined && import.meta.url === pathToFileURL(entry).href;

if (invokedAsBin) {
  process.exitCode = await main();
}
