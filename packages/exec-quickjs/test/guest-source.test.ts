import { describe, expect, it } from "vitest";
import {
  CALL_TOOL_GLOBAL,
  FINAL_ANSWER_GLOBAL,
  LOG_GLOBAL,
  buildGuestSource,
  collectDeclaredNames,
} from "../src/guest-source.js";

describe("collectDeclaredNames", () => {
  it("finds every declaration shape", () => {
    const names = collectDeclaredNames(
      [
        "const total = 1;",
        "let counter = 2;",
        "var legacy = 3;",
        "function helper(a) { return a; }",
        "async function later() {}",
        "class Widget {}",
        "const { city, temp } = weather;",
        "const [first, ...rest] = list;",
      ].join("\n"),
    );
    expect(names).toEqual([
      "total",
      "counter",
      "legacy",
      "helper",
      "later",
      "Widget",
      "city",
      "temp",
      "first",
      "rest",
    ]);
  });

  it("ignores names that cannot be a binding", () => {
    expect(collectDeclaredNames("const { default: d, for: f, arguments: a } = options;")).toEqual([
      "d",
      "f",
      "a",
    ]);
  });

  it("reports each name once", () => {
    expect(collectDeclaredNames("const x = 1; x = 2; const x2 = 3;")).toEqual(["x", "x2"]);
  });
});

describe("buildGuestSource", () => {
  it("defines one global function per tool name", () => {
    const source = buildGuestSource({ code: "1", toolNames: ["get_weather", "web_search"] });
    expect(source).toContain('globalThis["get_weather"] = (args) => callTool("get_weather", args);');
    expect(source).toContain('globalThis["web_search"] = (args) => callTool("web_search", args);');
  });

  it("defines final_answer, console and the tool-call helper", () => {
    const source = buildGuestSource({ code: "1", toolNames: [] });
    expect(source).toContain("globalThis.final_answer");
    expect(source).toContain("globalThis.console");
    expect(source).toContain(CALL_TOOL_GLOBAL);
    expect(source).toContain(FINAL_ANSWER_GLOBAL);
    expect(source).toContain(LOG_GLOBAL);
  });

  it("wraps the model's code verbatim in an async IIFE", () => {
    const code = "const x = 1;\nconsole.log(x);";
    const source = buildGuestSource({ code, toolNames: [] });
    expect(source).toContain("(async () => {\n" + code + "\n");
    expect(source.endsWith("})()")).toBe(true);
  });

  it("captures what the step declared before the wrapper returns", () => {
    const source = buildGuestSource({ code: "const total = 41;\nlet note = 'a';", toolNames: [] });
    expect(source).toContain('if (typeof total !== \'undefined\') __capture("total", total);');
    expect(source).toContain('if (typeof note !== \'undefined\') __capture("note", note);');
    expect(source.indexOf('__capture("total"')).toBeGreaterThan(source.indexOf("const total = 41;"));
    expect(source.indexOf('__capture("total"')).toBeLessThan(source.indexOf("})()"));
  });

  it("names no tool when the registry is empty", () => {
    const source = buildGuestSource({ code: "final_answer(41 + 1);", toolNames: [] });
    expect(source).not.toContain('globalThis["');
  });
});
