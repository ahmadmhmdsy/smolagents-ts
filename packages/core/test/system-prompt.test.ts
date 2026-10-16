import { describe, expect, it } from "vitest";
import { templateVariables } from "../src/prompts/populate-template.js";
import { buildCodeAgentSystemPrompt } from "../src/prompts/system-prompt.js";
import { CODE_AGENT_SYSTEM_TEMPLATE, CODE_FENCE } from "../src/prompts/templates.js";

describe("CODE_AGENT_SYSTEM_TEMPLATE", () => {
  it("declares exactly the variables the builder supplies", () => {
    expect(templateVariables(CODE_AGENT_SYSTEM_TEMPLATE).sort()).toEqual([
      "codeFence",
      "customInstructions",
      "language",
      "managedAgents",
      "toolDescriptions",
    ]);
  });

  it("names the final answer contract", () => {
    expect(CODE_AGENT_SYSTEM_TEMPLATE).toContain("final_answer");
  });

  it("requires an Observation before the next step", () => {
    expect(CODE_AGENT_SYSTEM_TEMPLATE).toMatch(/Observation/);
  });

  it("carries all six upstream examples", () => {
    const tasks = [
      "oldest person in this document",
      "5 + 3 + 1294.678",
      "variable 'question' about the image",
      "Stanislaus Ulam",
      "Guangzhou or Shanghai",
      "current age of the pope",
    ];
    for (const task of tasks) {
      expect(CODE_AGENT_SYSTEM_TEMPLATE).toContain(task);
    }
  });

  it("carries all eleven numbered rules", () => {
    const rules = [
      "1. Always provide a 'Thought:'",
      "2. Use only variables that you have defined",
      "3. Always use the right arguments for the tools",
      "4. For tools WITHOUT JSON output schema",
      "5. For tools WITH JSON output schema",
      "6. Call a tool only when needed",
      "7. Don't name any new variable with the same name as a tool",
      "8. Never create any notional variables",
      "9. There is no module system",
      "10. The state persists between code executions",
      "11. Don't give up!",
    ];
    for (const rule of rules) {
      expect(CODE_AGENT_SYSTEM_TEMPLATE).toContain(rule);
    }
  });

  it("keeps upstream's notional-tools disclaimer", () => {
    expect(CODE_AGENT_SYSTEM_TEMPLATE).toMatch(/Above examples were using notional tools/);
  });
});

describe("buildCodeAgentSystemPrompt", () => {
  it("leaves no placeholder behind", () => {
    const prompt = buildCodeAgentSystemPrompt({ toolDescriptions: "- get_weather(city)" });
    expect(prompt).not.toContain("{{");
  });

  it("includes the tool descriptions", () => {
    const prompt = buildCodeAgentSystemPrompt({ toolDescriptions: "- get_weather(city)" });
    expect(prompt).toContain("- get_weather(city)");
  });

  it("defaults the language to JavaScript and the fence to the code fence", () => {
    const prompt = buildCodeAgentSystemPrompt({ toolDescriptions: "none" });
    expect(prompt).toContain("JavaScript");
    expect(prompt).toContain(CODE_FENCE);
  });

  it("honours an explicit language", () => {
    const prompt = buildCodeAgentSystemPrompt({ toolDescriptions: "none", language: "Python" });
    expect(prompt).toContain("Python");
  });

  it("says so when there are no tools", () => {
    const prompt = buildCodeAgentSystemPrompt({ toolDescriptions: "" });
    expect(prompt).toMatch(/no tools/i);
  });

  it("inserts custom instructions after the rules and before the closing line", () => {
    const prompt = buildCodeAgentSystemPrompt({
      toolDescriptions: "none",
      customInstructions: "Always answer in French.",
    });
    // Upstream places custom_instructions after the rules and before "Now Begin!".
    expect(prompt).toContain("Always answer in French.");
    expect(prompt.indexOf("Always answer in French.")).toBeGreaterThan(prompt.indexOf("Don't give up!"));
    expect(prompt.trimEnd().endsWith("Now Begin!")).toBe(true);
  });

  it("omits custom instructions cleanly when none are given", () => {
    const prompt = buildCodeAgentSystemPrompt({ toolDescriptions: "none" });
    expect(prompt.trimEnd().endsWith("Now Begin!")).toBe(true);
  });
});
