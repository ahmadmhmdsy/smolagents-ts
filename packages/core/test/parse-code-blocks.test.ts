import { describe, expect, it } from "vitest";
import { CODE_FENCE } from "../src/prompts/templates.js";
import {
  extractCodeBlock,
  extractThought,
  hasFinalAnswerCall,
} from "../src/utils/parse-code-blocks.js";

const fenced = (body: string, language = "") =>
  "Thought: let me compute.\nCode:\n" + CODE_FENCE + language + "\n" + body + "\n" + CODE_FENCE;

describe("extractCodeBlock", () => {
  it("extracts a plain fenced block", () => {
    expect(extractCodeBlock(fenced("console.log(1)"))).toBe("console.log(1)");
  });

  it("extracts a block tagged with a language", () => {
    expect(extractCodeBlock(fenced("console.log(1)", "javascript"))).toBe("console.log(1)");
  });

  it("preserves interior blank lines and indentation", () => {
    const body = "if (true) {\n\n  console.log(1);\n}";
    expect(extractCodeBlock(fenced(body))).toBe(body);
  });

  it("returns null when there is no block", () => {
    expect(extractCodeBlock("Thought: nothing here.")).toBeNull();
  });

  it("takes the first block when several are present", () => {
    const text = fenced("first()") + "\n" + fenced("second()");
    expect(extractCodeBlock(text)).toBe("first()");
  });

  it("accepts an unterminated trailing block", () => {
    expect(extractCodeBlock("Code:\n" + CODE_FENCE + "\nconsole.log(1)")).toBe("console.log(1)");
  });

  it("ignores a fence that opens and closes empty", () => {
    expect(extractCodeBlock(CODE_FENCE + "\n" + CODE_FENCE)).toBe("");
  });

  it("honours a custom fence", () => {
    expect(extractCodeBlock("~~~\n1+1\n~~~", "~~~")).toBe("1+1");
  });

  it("accepts a fence that opens mid-sentence", () => {
    const text = "Thought: ready. " + CODE_FENCE + "javascript\nfinal_answer(7)\n" + CODE_FENCE;
    expect(extractCodeBlock(text)).toBe("final_answer(7)");
  });

  it("accepts a closing fence with trailing prose", () => {
    const text = "Here it is: " + CODE_FENCE + "\nfinal_answer(7)\n" + CODE_FENCE + " and that is all.";
    expect(extractCodeBlock(text)).toBe("final_answer(7)");
  });

  it("still returns null for unfenced prose that mentions no block", () => {
    expect(extractCodeBlock("Thought: I will think about it.")).toBeNull();
  });
});

describe("extractThought", () => {
  it("strips the Thought: label", () => {
    expect(extractThought("Thought: because reasons\n" + fenced("x()"))).toBe("because reasons");
  });

  it("returns everything when there is no code block", () => {
    expect(extractThought("Just thinking.")).toBe("Just thinking.");
  });
});

describe("hasFinalAnswerCall", () => {
  it("detects a direct call", () => {
    expect(hasFinalAnswerCall("final_answer(42)")).toBe(true);
  });

  it("detects a call with whitespace and an await", () => {
    expect(hasFinalAnswerCall("await final_answer ( 42 )")).toBe(true);
  });

  it("does not match a mention inside a string", () => {
    expect(hasFinalAnswerCall('const s = "call final_answer() to finish";')).toBe(true);
  });

  it("returns false when there is no call", () => {
    expect(hasFinalAnswerCall("console.log(1)")).toBe(false);
  });

  it("does not match a property access like my.final_answer", () => {
    expect(hasFinalAnswerCall("obj.final_answer(1)")).toBe(false);
  });
});
