import { tool, type Tool } from "@smolagents-ts/core";
import { z } from "zod";
import { htmlToText } from "../html.js";

export interface VisitWebpageToolOptions {
  /** Overrides the context's fetch; a test injects one. */
  fetch?: typeof globalThis.fetch;
  /** The most characters returned. Defaults to 20000. */
  maxChars?: number;
  name?: string;
  description?: string;
}

const TRUNCATED = "\n\n[truncated]";

/** Fetches a page and answers with its readable text, so a model reads words and not markup. */
export function visitWebpageTool(
  options: VisitWebpageToolOptions = {},
): Tool<z.ZodType, string> {
  const maxChars = options.maxChars ?? 20000;
  return tool({
    name: options.name ?? "visit_webpage",
    description:
      options.description ?? "Visits a webpage at the given URL and returns its content as text.",
    inputSchema: z.object({
      url: z.string().describe("The URL of the webpage to visit."),
    }),
    execute: async ({ url }, ctx) => {
      const response = await (options.fetch ?? ctx.fetch)(url, {
        headers: { accept: "text/html" },
      });
      if (!response.ok) {
        throw new Error("Visiting " + url + " failed with status " + String(response.status));
      }
      const text = htmlToText(await response.text());
      return text.length <= maxChars ? text : text.slice(0, maxChars) + TRUNCATED;
    },
  });
}
