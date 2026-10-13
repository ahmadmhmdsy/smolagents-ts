import { ToolDefinitionError, ToolRegistry, tool } from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolCollection } from "../src/collection.js";

function makeTool(name: string) {
  return tool({
    name,
    description: "A tool named " + name + ".",
    inputSchema: z.object({ value: z.string() }),
    execute: ({ value }) => value,
  });
}

describe("ToolCollection", () => {
  it("keeps insertion order and reports its size", () => {
    const collection = new ToolCollection({ tools: [makeTool("first"), makeTool("second")] });

    expect(collection.size).toBe(2);
    expect(collection.list().map((entry) => entry.name)).toEqual(["first", "second"]);
    expect(collection.has("first")).toBe(true);
    expect(collection.get("missing")).toBeUndefined();
  });

  it("refuses a duplicate name", () => {
    const collection = new ToolCollection();
    collection.add(makeTool("once"));

    expect(() => collection.add(makeTool("once"))).toThrow(ToolDefinitionError);
  });

  it("names a group built from tools", () => {
    const named = ToolCollection.fromTools([makeTool("only")], "weather");

    expect(named.name).toBe("weather");
    expect(named.list().map((entry) => entry.name)).toEqual(["only"]);
    expect(ToolCollection.fromTools([]).name).toBe("tools");
  });

  it("hands the same tools to the core registry", () => {
    const entry = makeTool("lookup");

    const registry = ToolCollection.fromTools([entry]).toRegistry();

    expect(registry).toBeInstanceOf(ToolRegistry);
    expect(registry.size).toBe(1);
    expect(registry.get("lookup")).toBe(entry);
  });

  it("is iterable", () => {
    const collection = ToolCollection.fromTools([makeTool("a"), makeTool("b")]);

    expect([...collection].map((entry) => entry.name)).toEqual(["a", "b"]);
  });

  it("renders the advertisement of each tool", () => {
    const collection = ToolCollection.fromTools([makeTool("lookup")]);

    expect(collection.toSpecs()).toEqual([
      {
        name: "lookup",
        description: "A tool named lookup.",
        inputSchema: {
          type: "object",
          properties: { value: { type: "string" } },
          required: ["value"],
          additionalProperties: false,
        },
      },
    ]);
  });
});
