import { tool, type Tool } from "@smolagents-ts/core";
import { z } from "zod";

export interface UserInputToolOptions {
  /** How the question reaches the user. Injected, because this package has no host. */
  ask: (question: string) => string | Promise<string>;
  name?: string;
  description?: string;
}

/**
 * Asks the person running the agent. Upstream reads from the process's standard input;
 * this package is isomorphic, so the host supplies the function that asks.
 */
export function userInputTool(options: UserInputToolOptions): Tool<z.ZodType, string> {
  return tool({
    name: options.name ?? "user_input",
    description: options.description ?? "Asks the user for input.",
    inputSchema: z.object({
      question: z.string().describe("The question to ask the user."),
    }),
    execute: async ({ question }) => String(await options.ask(question)),
  });
}
