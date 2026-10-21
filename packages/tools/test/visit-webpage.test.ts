import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { visitWebpageTool } from "../src/defaults/visit-webpage.js";
import { recorder, toolContext } from "./helpers.js";

/** An ordinary page, kept as a fixture so the suite needs no network. */
const page = readFileSync(new URL("./fixtures/webpage.html", import.meta.url), "utf8");

describe("visitWebpageTool", () => {
  it("answers with the words of the page", async () => {
    const { fetch } = recorder(page, "text/html");
    const entry = visitWebpageTool({ fetch });

    const text = await entry.execute({ url: "https://example.test/page" }, toolContext());

    expect(text).toContain("# Example page");
    expect(text).toContain("The first paragraph.");
    expect(text).toContain("[more](https://example.test/more)");
    expect(text).toContain("- alpha");
    expect(text).toContain("- beta");
    expect(text).not.toContain("var x = 1");
    expect(text).not.toContain("color: red");
  });

  it("marks a page it had to cut", async () => {
    const { fetch } = recorder(page, "text/html");
    const entry = visitWebpageTool({ fetch, maxChars: 10 });

    const text = await entry.execute({ url: "https://example.test/page" }, toolContext());

    expect(text).toHaveLength(10 + "\n\n[truncated]".length);
    expect(text.endsWith("[truncated]")).toBe(true);
  });

  it("reports a page it could not read", async () => {
    const { fetch } = recorder("not found", "text/html", 404);
    const entry = visitWebpageTool({ fetch });

    await expect(
      entry.execute({ url: "https://example.test/gone" }, toolContext()),
    ).rejects.toThrow(/status 404/);
  });

  it("fetches through the context when no fetch was injected", async () => {
    const { fetch, urls } = recorder(page, "text/html");
    const entry = visitWebpageTool();

    await entry.execute({ url: "https://example.test/ctx" }, toolContext({ fetch }));

    expect(urls).toEqual(["https://example.test/ctx"]);
  });

  it("refuses a URL that is not http(s) without fetching it", async () => {
    const { fetch, urls } = recorder(page, "text/html");
    const entry = visitWebpageTool({ fetch });

    for (const url of ["file:///etc/passwd", "data:text/html,hi", "not a url"]) {
      await expect(entry.execute({ url }, toolContext())).rejects.toThrow(/http\(s\) URL/);
    }
    expect(urls).toEqual([]);
  });

  it("passes the run's signal to the fetch", async () => {
    const controller = new AbortController();
    let seen: AbortSignal | null | undefined;
    const fetchImpl = ((_url: string, init?: RequestInit) => {
      seen = init?.signal;
      return Promise.resolve(new Response(page, { headers: { "content-type": "text/html" } }));
    }) as typeof globalThis.fetch;

    await visitWebpageTool({ fetch: fetchImpl }).execute(
      { url: "https://example.test/page" },
      toolContext({ signal: controller.signal }),
    );

    expect(seen).toBe(controller.signal);
  });

  it("stops reading a body past maxBytes and cancels the rest", async () => {
    let pulls = 0;
    let cancelled = false;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new TextEncoder().encode("<p>" + "a".repeat(1000) + "</p>"));
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetchImpl = (() =>
      Promise.resolve(
        new Response(endless, { headers: { "content-type": "text/html" } }),
      )) as typeof globalThis.fetch;

    const text = await visitWebpageTool({ fetch: fetchImpl, maxBytes: 4096 }).execute(
      { url: "https://example.test/huge" },
      toolContext(),
    );

    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThan(10);
    expect(text.length).toBeLessThanOrEqual(4096);
  });

  it("advertises the url it takes", () => {
    const entry = visitWebpageTool();

    expect(entry.name).toBe("visit_webpage");
    expect(entry.toSpec().inputSchema).toEqual({
      type: "object",
      properties: { url: { type: "string", description: "The URL of the webpage to visit." } },
      required: ["url"],
      additionalProperties: false,
    });
  });
});
