import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolDefinitionError, tool } from "../src/tool/tool.js";
import { ToolRegistry } from "../src/tool/registry.js";

const weather = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({
    city: z.string().describe("City name"),
    units: z.enum(["celsius", "fahrenheit"]).optional(),
  }),
  execute: () => "sunny",
});

const add = tool({
  name: "add",
  description: "Add two numbers.",
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  execute: ({ a, b }) => a + b,
});

describe("ToolRegistry", () => {
  it("starts empty", () => {
    expect(new ToolRegistry().size).toBe(0);
  });

  it("accepts tools in the constructor", () => {
    expect(new ToolRegistry([weather, add]).size).toBe(2);
  });

  it("looks tools up by name", () => {
    const registry = new ToolRegistry([weather]);
    expect(registry.get("get_weather")).toBe(weather);
    expect(registry.get("nope")).toBeUndefined();
    expect(registry.has("get_weather")).toBe(true);
  });

  it("rejects a duplicate name", () => {
    const registry = new ToolRegistry([weather]);
    expect(() => registry.add(weather)).toThrow(ToolDefinitionError);
  });

  it("lists every tool", () => {
    expect(new ToolRegistry([weather, add]).list().map((t) => t.name)).toEqual(["get_weather", "add"]);
  });

  it("renders every spec for the model", () => {
    const specs = new ToolRegistry([weather, add]).toSpecs();
    expect(specs.map((s) => s.name)).toEqual(["get_weather", "add"]);
  });

  it("renders readable descriptions, marking optional arguments", () => {
    const text = new ToolRegistry([weather]).renderDescriptions();
    expect(text).toContain("get_weather");
    expect(text).toContain("Get the current weather for a city.");
    expect(text).toMatch(/city\s*\(string, required\)/);
    expect(text).toMatch(/units\s*\(string, optional\)/);
  });

  it("renders an empty string when there are no tools", () => {
    expect(new ToolRegistry().renderDescriptions()).toBe("");
  });
});
