import process from "node:process";
import { createInterface } from "node:readline/promises";

/** A sink shaped like process.stdout, so a test can collect what the CLI prints. */
export type Writer = (text: string) => void;

export interface AskOptions {
  /** Used when the answer is empty. */
  default?: string;
  /** When set, an answer outside the list falls back to the default. */
  choices?: readonly string[];
}

export interface Prompter {
  ask(question: string, options?: AskOptions): Promise<string>;
  confirm(question: string, options?: { default?: boolean }): Promise<boolean>;
  /** Release the terminal; interactive setup calls this before the run starts. */
  close(): void;
}

/** Build a writer over a process stream. */
export function writeTo(stream: { write(chunk: string): unknown }): Writer {
  return (text: string) => {
    stream.write(text);
  };
}

/**
 * A prompter over the process's terminal.
 *
 * It never asks for a secret. A terminal echoes what is typed, and a key must not be
 * printed (rules/04-security-and-secrets.md R-04.1), so the key reaches the model
 * factory through --api-key or through the provider's environment variable instead.
 */
export function createTerminalPrompter(): Prompter {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    async ask(question: string, options: AskOptions = {}): Promise<string> {
      let hint = "";
      if (options.choices !== undefined) {
        hint = " [" + options.choices.join("/") + "]";
      } else if (options.default !== undefined && options.default.length > 0) {
        hint = " [" + options.default + "]";
      }
      const answer = (await rl.question(question + hint + ": ")).trim();
      if (answer.length === 0) return options.default ?? "";
      if (options.choices !== undefined && !options.choices.includes(answer)) {
        return options.default ?? answer;
      }
      return answer;
    },
    async confirm(question: string, options: { default?: boolean } = {}): Promise<boolean> {
      const fallback = options.default ?? false;
      const answer = (await rl.question(question + (fallback ? " [Y/n]: " : " [y/N]: ")))
        .trim()
        .toLowerCase();
      if (answer.length === 0) return fallback;
      return answer === "y" || answer === "yes";
    },
    close(): void {
      rl.close();
    },
  };
}
