import { describe, expect, it } from "vitest";
import { userInputTool } from "../src/defaults/user-input.js";
import { toolContext } from "./helpers.js";

describe("userInputTool", () => {
  it("asks the injected function with the question", async () => {
    const asked: string[] = [];
    const entry = userInputTool({
      ask: (question) => {
        asked.push(question);
        return "yes";
      },
    });

    const answer = await entry.execute({ question: "Continue?" }, toolContext());

    expect(asked).toEqual(["Continue?"]);
    expect(answer).toBe("yes");
  });

  it("waits for an asynchronous answer", async () => {
    const entry = userInputTool({ ask: () => Promise.resolve("later") });

    await expect(entry.execute({ question: "Now?" }, toolContext())).resolves.toBe("later");
  });

  it("advertises the question it takes", () => {
    const entry = userInputTool({ ask: () => "x" });

    expect(entry.toSpec()).toEqual({
      name: "user_input",
      description: "Asks the user for input.",
      inputSchema: {
        type: "object",
        properties: {
          question: { type: "string", description: "The question to ask the user." },
        },
        required: ["question"],
        additionalProperties: false,
      },
    });
  });

  it("honours a custom name and description", () => {
    const entry = userInputTool({ ask: () => "x", name: "confirm", description: "Confirm it." });

    expect(entry.name).toBe("confirm");
    expect(entry.description).toBe("Confirm it.");
  });
});
