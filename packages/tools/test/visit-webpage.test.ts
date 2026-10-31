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

  it.each([
    "http://localhost:8080/",
    "http://db.internal/",
    "http://printer.local/",
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://0x7f.0.0.1/",
    "http://10.0.0.1/",
    "http://100.64.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://172.16.0.1/",
    "http://192.168.1.1/",
    "http://[::1]/",
    "http://[fe80::1]/",
    "http://[fd00::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[64:ff9b::a00:1]/",
  ])("refuses %s before fetching", async (url) => {
    const { fetch, urls } = recorder(page, "text/html");
    const entry = visitWebpageTool({ fetch });

    await expect(entry.execute({ url }, toolContext())).rejects.toThrow(/private or local/);
    expect(urls).toEqual([]);
  });

  it("does not mistake a public name or address for a private one", async () => {
    const { fetch, urls } = recorder(page, "text/html");
    const entry = visitWebpageTool({ fetch });

    await entry.execute({ url: "https://internal.example.test/" }, toolContext());
    await entry.execute({ url: "http://172.32.0.1/" }, toolContext());
    await entry.execute({ url: "http://[2001:db8::1]/" }, toolContext());

    expect(urls).toHaveLength(3);
  });

  it("reaches a private address when the caller allows it", async () => {
    const { fetch, urls } = recorder(page, "text/html");
    const entry = visitWebpageTool({ fetch, allowPrivateNetwork: true });

    await entry.execute({ url: "http://127.0.0.1:3000/" }, toolContext());

    expect(urls).toEqual(["http://127.0.0.1:3000/"]);
  });

  function redirecting(...locations: string[]): { fetch: typeof globalThis.fetch; urls: string[] } {
    const urls: string[] = [];
    const fetchImpl = ((url: string) => {
      urls.push(url);
      const location = locations.shift();
      return Promise.resolve(
        location === undefined
          ? new Response(page, { headers: { "content-type": "text/html" } })
          : new Response(null, { status: 302, headers: { location } }),
      );
    }) as typeof globalThis.fetch;
    return { fetch: fetchImpl, urls };
  }

  it("follows a redirect and checks where it leads", async () => {
    const allowed = redirecting("/next");
    await visitWebpageTool({ fetch: allowed.fetch }).execute(
      { url: "https://example.test/start" },
      toolContext(),
    );
    expect(allowed.urls).toEqual(["https://example.test/start", "https://example.test/next"]);

    const refused = redirecting("http://169.254.169.254/");
    await expect(
      visitWebpageTool({ fetch: refused.fetch }).execute(
        { url: "https://example.test/start" },
        toolContext(),
      ),
    ).rejects.toThrow(/private or local/);
    expect(refused.urls).toEqual(["https://example.test/start"]);
  });

  it("stops a redirect loop", async () => {
    const { fetch, urls } = redirecting("/a", "/b", "/c", "/d", "/e", "/f", "/g");

    await expect(
      visitWebpageTool({ fetch }).execute({ url: "https://example.test/" }, toolContext()),
    ).rejects.toThrow(/redirected more than 5/);
    expect(urls).toHaveLength(6);
  });

  it("names the option when a browser hides the redirect", async () => {
    const hidden = { type: "opaqueredirect", status: 0, headers: new Headers() } as Response;
    const fetchImpl = (() => Promise.resolve(hidden)) as typeof globalThis.fetch;

    await expect(
      visitWebpageTool({ fetch: fetchImpl }).execute(
        { url: "https://example.test/" },
        toolContext(),
      ),
    ).rejects.toThrow(/allowPrivateNetwork/);
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
