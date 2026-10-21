import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { SetupCancelled } from "../src/errors.js";
import { createTerminalPrompter } from "../src/terminal.js";

/**
 * A pending readline question never settles once stdin ends, so before the prompter
 * aborted it `printf 'x\n' | smolagent` left the bin on an unsettled top-level await:
 * Node printed a warning and exited 13 after the first answer was used up.
 */
describe("createTerminalPrompter", () => {
  it("answers from the input it is given", async () => {
    const input = new PassThrough();
    const prompter = createTerminalPrompter({ input, output: new PassThrough() });
    const answer = prompter.ask("Model", { default: "m" });
    input.write("chosen\n");
    await expect(answer).resolves.toBe("chosen");
    prompter.close();
  });

  it("rejects a pending question with SetupCancelled when input ends", async () => {
    const input = new PassThrough();
    const prompter = createTerminalPrompter({ input, output: new PassThrough() });
    const answer = prompter.ask("Task");
    input.end();
    await expect(answer).rejects.toBeInstanceOf(SetupCancelled);
    prompter.close();
  });

  it("rejects every later question once input has ended", async () => {
    const input = new PassThrough();
    const prompter = createTerminalPrompter({ input, output: new PassThrough() });
    const first = prompter.ask("Task");
    input.end("only one answer\n");
    await expect(first).resolves.toBe("only one answer");
    await expect(prompter.confirm("Again?")).rejects.toBeInstanceOf(SetupCancelled);
    prompter.close();
  });

  it("rejects a pending question with exit code 130 on Ctrl+C", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode: () => input });
    const output = Object.assign(new PassThrough(), { isTTY: true, columns: 80 });
    const prompter = createTerminalPrompter({ input, output });
    const answer = prompter.ask("Task");
    input.write("\x03");
    const error: unknown = await answer.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SetupCancelled);
    expect((error as SetupCancelled).exitCode).toBe(130);
    prompter.close();
  });
});
