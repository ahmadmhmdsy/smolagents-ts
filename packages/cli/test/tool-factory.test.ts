import { describe, expect, it } from "vitest";
import { UnsupportedToolError } from "../src/errors.js";
import { defaultToolCatalog, defaultToolNames, loadTools } from "../src/tool-factory.js";

describe("the default tool catalog", () => {
  it("lists the two defaults in the table's order", () => {
    expect(defaultToolNames()).toEqual(["web_search", "visit_webpage"]);
  });

  it("describes every entry", () => {
    for (const entry of defaultToolCatalog()) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});

describe("loadTools", () => {
  it("answers with no tools when asked for none", () => {
    expect(loadTools([])).toEqual([]);
  });

  it("resolves a default by name", () => {
    const tools = loadTools(["web_search"]);

    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe("web_search");
  });

  it("resolves both defaults, each with its schema", () => {
    const tools = loadTools(["web_search", "visit_webpage"]);

    expect(tools.map((tool) => tool.name)).toEqual(["web_search", "visit_webpage"]);
    expect(typeof tools[0]?.toSpec).toBe("function");
  });

  it("refuses python_interpreter by name", () => {
    try {
      loadTools(["python_interpreter"]);
      throw new Error("loadTools should have refused python_interpreter");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedToolError);
      expect((error as Error).message).toContain("python_interpreter");
    }
  });

  it("refuses a Space name carrying a slash", () => {
    expect(() => loadTools(["owner/space-tool"])).toThrow(UnsupportedToolError);
  });

  it("names the recognized defaults when a name is unknown", () => {
    try {
      loadTools(["weather"]);
      throw new Error("loadTools should have refused weather");
    } catch (error) {
      expect((error as Error).message).toContain("weather");
      expect((error as Error).message).toContain("web_search");
      expect((error as Error).message).toContain("visit_webpage");
    }
  });
});
