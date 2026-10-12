import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolDefinitionError, tool } from "../src/tool/tool.js";

describe("tool()", () => {
  it("keeps an explicit name", () => {
    const t = tool({
      name: "get_weather",
      description: "Get the weather.",
      inputSchema: z.object({ city: z.string() }),
      execute: () => "sunny",
    });
    expect(t.name).toBe("get_weather");
  });

  it("rejects a missing name when the schema has no title", () => {
    expect(() =>
      tool({
        description: "no name",
        inputSchema: z.object({ a: z.string() }),
        execute: () => 1,
      }),
    ).toThrow(ToolDefinitionError);
  });

  it("falls back to the schema title", () => {
    const schema = z.object({ a: z.string() }).describe("add_one");
    const t = tool({ description: "Add one.", inputSchema: schema, execute: () => 1 });
    expect(t.name).toBe("add_one");
  });

  it("rejects a name that is not an identifier", () => {
    expect(() =>
      tool({ name: "not a name", description: "d", inputSchema: z.object({}), execute: () => 1 }),
    ).toThrow(/identifier/i);
  });

  it("produces a JSON Schema spec for the model", () => {
    const t = tool({
      name: "get_weather",
      description: "Get the weather.",
      inputSchema: z.object({ city: z.string(), units: z.enum(["celsius", "fahrenheit"]).optional() }),
      execute: () => "sunny",
    });
    const spec = t.toSpec();
    expect(spec.name).toBe("get_weather");
    expect(spec.description).toBe("Get the weather.");
    expect(spec.inputSchema.type).toBe("object");
    expect(spec.inputSchema.required).toEqual(["city"]);
  });

  it("passes validated input to execute", async () => {
    const seen: unknown[] = [];
    const t = tool({
      name: "echo",
      description: "Echo.",
      inputSchema: z.object({ value: z.string() }),
      execute: (input) => {
        seen.push(input);
        return input.value;
      },
    });
    const parsed = t.inputSchema.parse({ value: "hi" });
    expect(await t.execute(parsed, {} as never)).toBe("hi");
    expect(seen).toEqual([{ value: "hi" }]);
  });
});
