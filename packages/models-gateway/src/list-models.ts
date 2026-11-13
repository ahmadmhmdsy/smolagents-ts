import type { GatewayFetch } from "./gateway-model.js";

export interface ListGatewayModelsOptions {
  /** Everything before "/models", the same base a `GatewayModel` takes. */
  baseUrl: string;
  apiKey?: string;
  fetch?: GatewayFetch;
  headers?: Readonly<Record<string, string>>;
  signal?: AbortSignal;
}

/** A gateway's `GET /models` answered with something other than an OpenAI model list. */
export class GatewayModelListError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GatewayModelListError";
    this.status = status;
  }
}

/**
 * The model ids a gateway offers, read from `GET {baseUrl}/models` in the OpenAI list shape
 * (`{ data: [{ id }] }`). The ids come back in the gateway's order. The API key is sent as a
 * bearer token and never written into an error.
 */
export async function listGatewayModels(options: ListGatewayModelsOptions): Promise<string[]> {
  const fetchImpl = options.fetch ?? (globalThis.fetch as GatewayFetch | undefined);
  if (typeof fetchImpl !== "function") {
    throw new Error("No fetch available: pass options.fetch in an environment without one");
  }
  const url = options.baseUrl.replace(/\/+$/, "") + "/models";
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      ...(options.apiKey === undefined ? {} : { authorization: "Bearer " + options.apiKey }),
      ...options.headers,
    },
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  if (!response.ok) {
    throw new GatewayModelListError(
      "HTTP " + String(response.status) + " from " + url,
      response.status,
    );
  }
  const body = (await response.json()) as { data?: unknown };
  if (!Array.isArray(body.data)) {
    throw new GatewayModelListError("The model list from " + url + " has no data array", response.status);
  }
  return body.data.flatMap((entry: unknown) => {
    const id = entry !== null && typeof entry === "object" ? (entry as { id?: unknown }).id : undefined;
    return typeof id === "string" && id !== "" ? [id] : [];
  });
}
