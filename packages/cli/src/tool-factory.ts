import type { Tool } from "@smolagents-ts/core";
import { duckDuckGoSearchTool, visitWebpageTool } from "@smolagents-ts/tools";
import { UnsupportedToolError } from "./errors.js";

/** One entry of the table the interactive setup prints and the arg parser resolves. */
export interface ToolCatalogEntry {
  name: string;
  description: string;
  create: () => Tool;
}

/**
 * The names upstream's TOOL_MAPPING carries that this port implements.
 * python_interpreter has no counterpart and is refused by name; a name carrying a
 * slash means a Hugging Face Space upstream, which this port does not load.
 */
export function defaultToolCatalog(): ToolCatalogEntry[] {
  const webSearch = duckDuckGoSearchTool();
  const visitWebpage = visitWebpageTool();
  return [
    {
      name: webSearch.name,
      description: webSearch.description,
      create: () => duckDuckGoSearchTool(),
    },
    {
      name: visitWebpage.name,
      description: visitWebpage.description,
      create: () => visitWebpageTool(),
    },
  ];
}

/** The tool names this port recognizes, in the order the table prints them. */
export function defaultToolNames(): string[] {
  return defaultToolCatalog().map((entry) => entry.name);
}

/**
 * Resolve each requested name against the catalog. Unknown names, Space names and
 * python_interpreter are refusals with the reason in the message; a name is never
 * dropped silently, because a caller who asked for a tool must learn it is absent.
 */
export function loadTools(names: readonly string[]): Tool[] {
  const catalog = new Map(defaultToolCatalog().map((entry) => [entry.name, entry]));
  const tools: Tool[] = [];
  for (const name of names) {
    if (name.includes("/")) {
      throw new UnsupportedToolError(
        name,
        "Tools loaded from a Hugging Face Space have no counterpart in this port.",
      );
    }
    if (name === "python_interpreter") {
      throw new UnsupportedToolError(
        name,
        "This port has no Python interpreter tool; the executor runs JavaScript.",
      );
    }
    const entry = catalog.get(name);
    if (entry === undefined) {
      throw new UnsupportedToolError(
        name,
        "The recognized defaults are " + defaultToolNames().join(", ") + ".",
      );
    }
    tools.push(entry.create());
  }
  return tools;
}
