import { tool, type Tool } from "@smolagents-ts/core";
import { z } from "zod";
import { htmlToText } from "../html.js";

export interface VisitWebpageToolOptions {
  /** Overrides the context's fetch; a test injects one. */
  fetch?: typeof globalThis.fetch;
  /** The most characters returned. Defaults to 20000. */
  maxChars?: number;
  /** The most bytes of the body read before the rest is dropped. Defaults to 5 MiB. */
  maxBytes?: number;
  name?: string;
  description?: string;
}

const TRUNCATED = "\n\n[truncated]";
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

/** A model picks the URL, so only a web page is fetched: never file:, data: or the like. */
function webUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("visit_webpage needs an absolute http(s) URL, not " + JSON.stringify(raw));
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("visit_webpage only fetches http(s) URLs, not " + url.protocol);
  }
  return url;
}

/** Reads at most `maxBytes` of the body and cancels the rest, so a huge page cannot exhaust memory. */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  if (response.body === null) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let read = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const room = maxBytes - read;
      const chunk = value.byteLength > room ? value.subarray(0, room) : value;
      read += chunk.byteLength;
      text += decoder.decode(chunk, { stream: true });
      if (read >= maxBytes) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return text + decoder.decode();
}

/** Fetches a page and answers with its readable text, so a model reads words and not markup. */
export function visitWebpageTool(
  options: VisitWebpageToolOptions = {},
): Tool<z.ZodType, string> {
  const maxChars = options.maxChars ?? 20000;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  return tool({
    name: options.name ?? "visit_webpage",
    description:
      options.description ?? "Visits a webpage at the given URL and returns its content as text.",
    inputSchema: z.object({
      url: z.string().describe("The URL of the webpage to visit."),
    }),
    execute: async ({ url }, ctx) => {
      const target = webUrl(url);
      const response = await (options.fetch ?? ctx.fetch)(target.href, {
        headers: { accept: "text/html" },
        signal: ctx.signal,
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error("Visiting " + url + " failed with status " + String(response.status));
      }
      const text = htmlToText(await readCapped(response, maxBytes));
      return text.length <= maxChars ? text : text.slice(0, maxChars) + TRUNCATED;
    },
  });
}
