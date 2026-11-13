/**
 * What a gateway said about one request, read from its response headers (decision 0040). A
 * gateway's routing, cost and cache result arrive only as headers, so the model seam never sees
 * them; this is where they surface. Every field is optional because a gateway sends what it
 * knows, and a gateway that is not OmniRoute fills only `headers`.
 */
export interface GatewayResponse {
  /** The upstream provider that served the request (`X-OmniRoute-Provider`). */
  readonly provider?: string;
  /** The upstream model id that served the request (`X-OmniRoute-Model`). */
  readonly model?: string;
  /** What the gateway says the request cost, in US dollars (`X-OmniRoute-Response-Cost`). */
  readonly costUsd?: number;
  /** Whether the gateway answered from its cache (`X-OmniRoute-Cache`). */
  readonly cache?: "hit" | "miss";
  /** How many upstreams failed before one answered (`X-OmniRoute-Fallback-Attempts`). */
  readonly fallbackAttempts?: number;
  /** The gateway's measured latency for the request (`X-OmniRoute-Latency-Ms`). */
  readonly latencyMs?: number;
  /** The routing decision as the gateway wrote it, unparsed (`X-OmniRoute-Decision`). */
  readonly decision?: string;
  /** The gateway's id for the request (`X-OmniRoute-Request-Id`). */
  readonly requestId?: string;
  /** Every response header whose name starts with a configured prefix, names lowercased. */
  readonly headers: Readonly<Record<string, string>>;
}

/** The header prefix read when a caller names none. */
export const DEFAULT_GATEWAY_HEADER_PREFIXES: readonly string[] = ["x-omniroute-"];

function finiteNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function text(value: string | null): string | undefined {
  return value === null || value === "" ? undefined : value;
}

function cacheResult(value: string | null): "hit" | "miss" | undefined {
  const lowered = value?.trim().toLowerCase();
  return lowered === "hit" || lowered === "miss" ? lowered : undefined;
}

/**
 * Reads a response's headers into a `GatewayResponse`. A header that is absent, empty or not a
 * number where one is expected is left out rather than guessed, so a field is present only when
 * the gateway stated it.
 */
export function readGatewayHeaders(
  headers: Headers,
  prefixes: readonly string[] = DEFAULT_GATEWAY_HEADER_PREFIXES,
): GatewayResponse {
  const lowered = prefixes.map((prefix) => prefix.toLowerCase());
  const matched: Record<string, string> = {};
  headers.forEach((value, name) => {
    const key = name.toLowerCase();
    if (lowered.some((prefix) => key.startsWith(prefix))) matched[key] = value;
  });

  const fields: { -readonly [K in keyof GatewayResponse]: GatewayResponse[K] } = { headers: matched };
  const provider = text(headers.get("x-omniroute-provider"));
  if (provider !== undefined) fields.provider = provider;
  const model = text(headers.get("x-omniroute-model"));
  if (model !== undefined) fields.model = model;
  const costUsd = finiteNumber(headers.get("x-omniroute-response-cost"));
  if (costUsd !== undefined) fields.costUsd = costUsd;
  const cache = cacheResult(headers.get("x-omniroute-cache"));
  if (cache !== undefined) fields.cache = cache;
  const fallbackAttempts = finiteNumber(headers.get("x-omniroute-fallback-attempts"));
  if (fallbackAttempts !== undefined) fields.fallbackAttempts = fallbackAttempts;
  const latencyMs = finiteNumber(headers.get("x-omniroute-latency-ms"));
  if (latencyMs !== undefined) fields.latencyMs = latencyMs;
  const decision = text(headers.get("x-omniroute-decision"));
  if (decision !== undefined) fields.decision = decision;
  const requestId = text(headers.get("x-omniroute-request-id"));
  if (requestId !== undefined) fields.requestId = requestId;
  return fields;
}
