import process from "node:process";
import { createInterface } from "node:readline/promises";
import { SetupCancelled } from "./errors.js";

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

/** The streams a prompter reads and echoes on; the process's own by default. */
export interface TerminalStreams {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

/**
 * A prompter over the process's terminal.
 *
 * It never asks for a secret. A terminal echoes what is typed, and a key must not be
 * printed (rules/04-security-and-secrets.md R-04.1), so the key reaches the model
 * factory through --api-key or through the provider's environment variable instead.
 */
export function createTerminalPrompter(streams: TerminalStreams = {}): Prompter {
  const rl = createInterface({
    input: streams.input ?? process.stdin,
    output: streams.output ?? process.stdout,
  });
  // A pending question never settles once stdin ends or Ctrl+C pauses it, which leaves
  // the bin on an unsettled top-level await (exit 13). Both now abort the question.
  const ended = new AbortController();
  rl.on("close", () => {
    ended.abort();
  });
  rl.on("SIGINT", () => {
    rl.close();
  });
  const readAnswer = async (text: string): Promise<string> => {
    if (ended.signal.aborted) throw new SetupCancelled();
    try {
      return await rl.question(text, { signal: ended.signal });
    } catch (error) {
      if (ended.signal.aborted) throw new SetupCancelled();
      throw error;
    }
  };
  return {
    async ask(question: string, options: AskOptions = {}): Promise<string> {
      let hint = "";
      if (options.choices !== undefined) {
        hint = " [" + options.choices.join("/") + "]";
      } else if (options.default !== undefined && options.default.length > 0) {
        hint = " [" + options.default + "]";
      }
      const answer = (await readAnswer(question + hint + ": ")).trim();
      if (answer.length === 0) return options.default ?? "";
      if (options.choices !== undefined && !options.choices.includes(answer)) {
        return options.default ?? answer;
      }
      return answer;
    },
    async confirm(question: string, options: { default?: boolean } = {}): Promise<boolean> {
      const fallback = options.default ?? false;
      const answer = (await readAnswer(question + (fallback ? " [Y/n]: " : " [y/N]: ")))
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
