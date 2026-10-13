/**
 * The one place an adapter is allowed to reach the network. fetch is injected rather than
 * imported, so a test can drive a recorded fixture, a browser tab uses its own fetch, and
 * this package never imports a Node builtin.
 */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export function resolveFetch(fetchImpl?: FetchLike): FetchLike {
  if (fetchImpl !== undefined) return fetchImpl;
  const global = globalThis.fetch;
  if (typeof global !== "function") {
    throw new Error("No fetch available: pass options.fetch in an environment without one");
  }
  return global as unknown as FetchLike;
}

/** An HTTP response the provider rejected, carrying enough to explain it. */
export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: string;

  constructor(status: number, body: string, url: string) {
    super("HTTP " + String(status) + " from " + url + ": " + body.slice(0, 300));
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

export function joinUrl(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/+$/, "") + path;
}

/** POSTs a JSON body and turns a rejected response into an HttpError. */
export async function postJson(
  fetchImpl: FetchLike,
  url: string,
  body: unknown,
  headers: Readonly<Record<string, string>>,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new HttpError(response.status, text, url);
  }
  return response;
}
