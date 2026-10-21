import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { duckDuckGoSearchTool } from "../src/defaults/duckduckgo-search.js";
import { recorder, toolContext } from "./helpers.js";

/** The Instant Answer response the endpoint documents, kept as a fixture so the suite needs no network. */
const instantAnswer = readFileSync(
  new URL("./fixtures/duckduckgo-instant-answer.json", import.meta.url),
  "utf8",
);

describe("duckDuckGoSearchTool", () => {
  it("reads the summary and the related topics", async () => {
    const { fetch, urls } = recorder(instantAnswer);
    const entry = duckDuckGoSearchTool({ fetch, baseUrl: "https://example.test/search" });

    const answer = await entry.execute({ query: "TypeScript" }, toolContext());

    expect(urls[0]).toBe(
      "https://example.test/search?q=TypeScript&format=json&no_html=1&no_redirect=1",
    );
    expect(answer).toBe(
      [
        "TypeScript is a programming language. (https://en.wikipedia.org/wiki/TypeScript)",
        "- TypeScript - Wikipedia (https://en.wikipedia.org/wiki/TypeScript)",
        "- TypeScript (disambiguation) (https://en.wikipedia.org/wiki/TypeScript_(disambiguation))",
        "- Deno - Wikipedia (https://en.wikipedia.org/wiki/Deno_(software))",
      ].join("\n"),
    );
  });

  it("limits the topics it lists", async () => {
    const { fetch } = recorder(instantAnswer);
    const entry = duckDuckGoSearchTool({ fetch, maxResults: 1 });

    const answer = await entry.execute({ query: "TypeScript" }, toolContext());

    expect(answer.split("\n")).toHaveLength(2);
    expect(answer).toContain("TypeScript - Wikipedia");
    expect(answer).not.toContain("Deno");
  });

  it("says so when the endpoint knows nothing", async () => {
    const { fetch } = recorder(JSON.stringify({ RelatedTopics: [] }));
    const entry = duckDuckGoSearchTool({ fetch });

    await expect(entry.execute({ query: "zzzz" }, toolContext())).resolves.toBe(
      "No results found.",
    );
  });

  it("reports a failing endpoint", async () => {
    const { fetch } = recorder("rate limited", "application/json", 500);
    const entry = duckDuckGoSearchTool({ fetch });

    await expect(entry.execute({ query: "TypeScript" }, toolContext())).rejects.toThrow(
      /status 500/,
    );
  });

  it("passes the run's signal to the fetch", async () => {
    const controller = new AbortController();
    let seen: AbortSignal | null | undefined;
    const fetchImpl = ((_url: string, init?: RequestInit) => {
      seen = init?.signal;
      return Promise.resolve(new Response(instantAnswer));
    }) as typeof globalThis.fetch;

    await duckDuckGoSearchTool({ fetch: fetchImpl }).execute(
      { query: "TypeScript" },
      toolContext({ signal: controller.signal }),
    );

    expect(seen).toBe(controller.signal);
  });

  it("advertises the query it takes", () => {
    const entry = duckDuckGoSearchTool();

    expect(entry.name).toBe("web_search");
    expect(entry.toSpec().inputSchema).toEqual({
      type: "object",
      properties: { query: { type: "string", description: "The search query to perform." } },
      required: ["query"],
      additionalProperties: false,
    });
  });
});
