import { tool, type Tool } from "@smolagents-ts/core";
import { z } from "zod";

const DEFAULT_BASE_URL = "https://api.duckduckgo.com/";

export interface DuckDuckGoSearchToolOptions {
  /** Overrides the context's fetch; a test injects one. */
  fetch?: typeof globalThis.fetch;
  /** How many related topics the answer lists. Defaults to 5. */
  maxResults?: number;
  baseUrl?: string;
  name?: string;
  description?: string;
}

interface RelatedTopic {
  Text?: string;
  FirstURL?: string;
  /** The endpoint nests a group under this key instead of listing it flat. */
  Topics?: RelatedTopic[];
}

interface InstantAnswer {
  AbstractText?: string;
  AbstractURL?: string;
  Answer?: string;
  RelatedTopics?: RelatedTopic[];
}

function flatten(topics: readonly RelatedTopic[] | undefined, into: RelatedTopic[] = []): RelatedTopic[] {
  for (const topic of topics ?? []) {
    if (topic.Topics === undefined) into.push(topic);
    else flatten(topic.Topics, into);
  }
  return into;
}

function line(topic: RelatedTopic): string | undefined {
  const text = topic.Text?.trim();
  if (text === undefined || text === "") return undefined;
  const url = topic.FirstURL?.trim();
  return url === undefined || url === "" ? text : text + " (" + url + ")";
}

/**
 * Searches the web through DuckDuckGo's Instant Answer endpoint. Upstream calls a library
 * that reads the search page; this port reads the endpoint's documented JSON, so it answers
 * with a summary and related topics rather than with ranked links.
 */
export function duckDuckGoSearchTool(
  options: DuckDuckGoSearchToolOptions = {},
): Tool<z.ZodType, string> {
  const maxResults = options.maxResults ?? 5;
  return tool({
    name: options.name ?? "web_search",
    description:
      options.description ??
      "Searches the web for a query and returns what the search engine says about it.",
    inputSchema: z.object({
      query: z.string().describe("The search query to perform."),
    }),
    execute: async ({ query }, ctx) => {
      const base = options.baseUrl ?? DEFAULT_BASE_URL;
      const url =
        base + "?q=" + encodeURIComponent(query) + "&format=json&no_html=1&no_redirect=1";
      const response = await (options.fetch ?? ctx.fetch)(url, {
        headers: { accept: "application/json" },
        signal: ctx.signal,
      });
      if (!response.ok) {
        throw new Error("DuckDuckGo search failed with status " + String(response.status));
      }
      const body = (await response.json()) as InstantAnswer;

      const lines: string[] = [];
      const answer = body.Answer?.trim();
      if (answer !== undefined && answer !== "") lines.push(answer);
      const abstract = body.AbstractText?.trim();
      if (abstract !== undefined && abstract !== "") {
        const source = body.AbstractURL?.trim();
        lines.push(source === undefined || source === "" ? abstract : abstract + " (" + source + ")");
      }
      for (const topic of flatten(body.RelatedTopics).slice(0, maxResults)) {
        const rendered = line(topic);
        if (rendered !== undefined) lines.push("- " + rendered);
      }
      return lines.length === 0 ? "No results found." : lines.join("\n");
    },
  });
}
