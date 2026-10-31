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
  /**
   * Lets the tool reach loopback, link-local and private addresses, and leaves redirects to
   * the fetch. Off by default, because a model picks the URL and a page it reads can steer it.
   * The check reads the URL, not DNS: a public name that resolves to a private address still
   * passes, so a deployment that holds secrets on its network filters egress as well.
   */
  allowPrivateNetwork?: boolean;
  name?: string;
  description?: string;
}

const TRUNCATED = "\n\n[truncated]";
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const REDIRECTS: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);
const LOCAL_NAME = /(?:^|\.)(?:localhost|local|internal)$/;
/** An IPv4 address carried in IPv6: mapped, compatible, or the NAT64 prefix. */
const EMBEDDED_V4 = /^(?:::(?:ffff:)?|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/;

function isPrivateV4(octets: readonly number[]): boolean {
  const [a = 0, b = 0] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateV6(host: string): boolean {
  if (host === "::" || host === "::1") return true;
  if (/^f[cd]/.test(host) || /^fe[89ab]/.test(host)) return true;
  const embedded = EMBEDDED_V4.exec(host);
  if (embedded === null) return false;
  const high = Number.parseInt(embedded[1] ?? "0", 16);
  const low = Number.parseInt(embedded[2] ?? "0", 16);
  return isPrivateV4([high >> 8, high & 255, low >> 8, low & 255]);
}

/** Reads the host the URL parser normalised, so a decimal or hex address is already dotted. */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("[")) return isPrivateV6(host.slice(1, -1));
  if (/^[0-9.]+$/.test(host)) return isPrivateV4(host.split(".").map(Number));
  return LOCAL_NAME.test(host);
}

/** A model picks the URL, so only a web page is fetched: never file:, data: or the like. */
function webUrl(raw: string, allowPrivateNetwork: boolean): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("visit_webpage needs an absolute http(s) URL, not " + JSON.stringify(raw));
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("visit_webpage only fetches http(s) URLs, not " + url.protocol);
  }
  if (!allowPrivateNetwork && isPrivateHost(url.hostname)) {
    throw new Error(
      "visit_webpage does not fetch a private or local address: " +
        url.hostname +
        ". Pass allowPrivateNetwork to allow it.",
    );
  }
  return url;
}

/**
 * Fetches the page and follows redirects here rather than in fetch, because a public page can
 * redirect to a private address and every hop needs the check the first URL had.
 */
async function fetchPage(
  fetchImpl: typeof globalThis.fetch,
  url: string,
  signal: AbortSignal | undefined,
  allowPrivateNetwork: boolean,
): Promise<Response> {
  let target = webUrl(url, allowPrivateNetwork);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetchImpl(target.href, {
      headers: { accept: "text/html" },
      redirect: allowPrivateNetwork ? "follow" : "manual",
      ...(signal === undefined ? {} : { signal }),
    });
    // A browser hides a manual redirect's status and location, so it cannot be checked.
    if (response.type === "opaqueredirect") {
      throw new Error(
        "Visiting " + url + " redirected, and this fetch hides where to. Pass allowPrivateNetwork to follow it.",
      );
    }
    const location = REDIRECTS.has(response.status) ? response.headers.get("location") : null;
    if (location === null) return response;
    await response.body?.cancel().catch(() => undefined);
    target = webUrl(new URL(location, target).href, allowPrivateNetwork);
  }
  throw new Error("Visiting " + url + " redirected more than " + String(MAX_REDIRECTS) + " times.");
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
      const response = await fetchPage(
        options.fetch ?? ctx.fetch,
        url,
        ctx.signal,
        options.allowPrivateNetwork ?? false,
      );
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error("Visiting " + url + " failed with status " + String(response.status));
      }
      const text = htmlToText(await readCapped(response, maxBytes));
      return text.length <= maxChars ? text : text.slice(0, maxChars) + TRUNCATED;
    },
  });
}
