import { VERSION } from "../version.js";
import type { TraceSpan } from "./trace.js";

/** The identity a run hands an exporter: who ran, on which model, and for which task. */
export interface SpanExportContext {
  readonly runId: string;
  readonly modelId: string;
  readonly provider: string;
  readonly task: string;
}

/**
 * The seam a caller installs to receive a finished trace. It is called once per run, after the
 * terminal event, and never from a package import: an agent that was not given one exports
 * nothing. A throw or a rejected promise is logged and swallowed, so telemetry cannot fail a run.
 */
export interface SpanExporter {
  export(trace: TraceSpan, context: SpanExportContext): void | Promise<void>;
}

/** The OTLP/HTTP JSON shaping options. */
export interface OtlpExportOptions {
  /** The resource's service name. Omitted, the payload carries no resource attributes. */
  readonly serviceName?: string;
  /** The 32-hex trace id. Omitted, it is derived from the trace's run id. */
  readonly traceId?: string;
  /** Carry task text, code, tool arguments and outputs as attributes. Off by default. */
  readonly includePayloads?: boolean;
}

export interface OtlpAttributeValue {
  readonly stringValue?: string;
  readonly intValue?: string;
  readonly doubleValue?: number;
  readonly boolValue?: boolean;
}

export interface OtlpAttribute {
  readonly key: string;
  readonly value: OtlpAttributeValue;
}

export interface OtlpStatus {
  readonly code: 1 | 2;
  readonly message?: string;
}

export interface OtlpSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: 1;
  readonly startTimeUnixNano: string;
  readonly endTimeUnixNano: string;
  readonly attributes: readonly OtlpAttribute[];
  readonly status: OtlpStatus;
}

export interface OtlpExport {
  readonly resourceSpans: readonly {
    readonly resource: { readonly attributes: readonly OtlpAttribute[] };
    readonly scopeSpans: readonly {
      readonly scope: { readonly name: string; readonly version: string };
      readonly spans: readonly OtlpSpan[];
    }[];
  }[];
}

/** Attributes that carry the work's text rather than its shape; dropped unless asked for. */
const PAYLOAD_KEYS = new Set(["task", "text", "code", "logs", "observation", "summary", "args", "output"]);

/** The GenAI attribute names an OTel backend filters on. */
const GEN_AI_MODEL = "gen_ai.request.model";
const GEN_AI_PROVIDER = "gen_ai.provider.name";
const GEN_AI_OPERATION = "gen_ai.operation.name";
const GEN_AI_TOOL = "gen_ai.tool.name";
const GEN_AI_INPUT_TOKENS = "gen_ai.usage.input_tokens";
const GEN_AI_OUTPUT_TOKENS = "gen_ai.usage.output_tokens";

function hash32(text: string, seed: number): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * A run id is a UUID in practice, so its 32 hex digits are the trace id. Anything else is hashed
 * to 32 hex digits, four independent 32-bit words, so two runs do not share a trace id by accident.
 */
function traceIdFor(runId: string): string {
  const hex = runId.replace(/-/g, "").toLowerCase();
  if (/^[0-9a-f]{32}$/.test(hex)) return hex;
  return [0, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
    .map((seed) => hash32(runId, seed).toString(16).padStart(8, "0"))
    .join("");
}

function spanIdFor(traceId: string, index: number): string {
  return traceId.slice(0, 8) + (index + 1).toString(16).padStart(8, "0");
}

function unixNano(ms: number): string {
  return (BigInt(Math.trunc(ms)) * 1_000_000n).toString();
}

function toAttribute(key: string, value: unknown): OtlpAttribute | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return { key, value: { stringValue: value } };
  if (typeof value === "boolean") return { key, value: { boolValue: value } };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { key, value: { intValue: String(value) } }
      : { key, value: { doubleValue: value } };
  }
  return { key, value: { stringValue: JSON.stringify(value) } };
}

function statusOf(span: TraceSpan): OtlpStatus {
  if (span.status === "ok") return { code: 1 };
  const error = span.attributes["error"];
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "the run failed";
  return { code: 2, message };
}

function attributesOf(span: TraceSpan, includePayloads: boolean): OtlpAttribute[] {
  const isTool = span.name.startsWith("tool.");
  const attributes: OtlpAttribute[] = [];
  const push = (key: string, value: unknown): void => {
    const attribute = toAttribute(key, value);
    if (attribute !== undefined) attributes.push(attribute);
  };
  if (span.name === "run") {
    push(GEN_AI_OPERATION, "invoke_agent");
    if (typeof span.attributes["modelId"] === "string") push(GEN_AI_MODEL, span.attributes["modelId"]);
    if (typeof span.attributes["provider"] === "string") {
      push(GEN_AI_PROVIDER, span.attributes["provider"]);
    }
    const usage = span.attributes["usage"];
    if (typeof usage === "object" && usage !== null) {
      const tokens = usage as { inputTokens?: unknown; outputTokens?: unknown };
      if (typeof tokens.inputTokens === "number") push(GEN_AI_INPUT_TOKENS, tokens.inputTokens);
      if (typeof tokens.outputTokens === "number") push(GEN_AI_OUTPUT_TOKENS, tokens.outputTokens);
    }
  } else if (isTool) {
    push(GEN_AI_OPERATION, "execute_tool");
    if (typeof span.attributes["name"] === "string") push(GEN_AI_TOOL, span.attributes["name"]);
  } else if (span.name.startsWith("step.")) {
    push(GEN_AI_OPERATION, "step");
  }
  for (const [key, value] of Object.entries(span.attributes)) {
    if (key === "error" || key === "modelId" || key === "provider") continue;
    if (key === "usage" && span.name === "run") continue;
    if (PAYLOAD_KEYS.has(key)) {
      if (!includePayloads) continue;
      // A payload key keeps its meaning on a tool span, where arguments and output are the call.
      if (isTool && key === "args") {
        push("tool.arguments", value);
        continue;
      }
      if (isTool && key === "output") {
        push("tool.output", value);
        continue;
      }
    }
    push(key, value);
  }
  return attributes;
}

function flatten(
  span: TraceSpan,
  traceId: string,
  parentSpanId: string | undefined,
  options: Required<Pick<OtlpExportOptions, "includePayloads">> & { readonly traceId: string },
  next: { index: number },
): OtlpSpan[] {
  const spanId = spanIdFor(traceId, next.index);
  next.index += 1;
  const flat: OtlpSpan = {
    traceId,
    spanId,
    ...(parentSpanId === undefined ? {} : { parentSpanId }),
    name: span.name,
    kind: 1,
    startTimeUnixNano: unixNano(span.startTimeMs),
    endTimeUnixNano: unixNano(span.endTimeMs),
    attributes: attributesOf(span, options.includePayloads),
    status: statusOf(span),
  };
  const spans = [flat];
  for (const child of span.children) {
    spans.push(...flatten(child, traceId, spanId, options, next));
  }
  return spans;
}

/**
 * Map one trace tree to an OTLP/HTTP JSON export: a single resource, one scope named after the
 * package, and every span in depth-first order with its parent wired by id. The mapping is pure, so
 * a caller can ship it through any transport, and it carries no prompt text unless asked to.
 */
export function toOtlpExport(trace: TraceSpan, options: OtlpExportOptions = {}): OtlpExport {
  const runId = typeof trace.attributes["runId"] === "string" ? trace.attributes["runId"] : "";
  const traceId = options.traceId ?? traceIdFor(runId);
  const includePayloads = options.includePayloads === true;
  const resourceAttributes: OtlpAttribute[] = [];
  if (options.serviceName !== undefined) {
    resourceAttributes.push({ key: "service.name", value: { stringValue: options.serviceName } });
  }
  const spans = flatten(
    trace,
    traceId,
    undefined,
    { includePayloads, traceId },
    { index: 0 },
  );
  return {
    resourceSpans: [
      {
        resource: { attributes: resourceAttributes },
        scopeSpans: [
          {
            scope: { name: "@smolagents-ts/core", version: VERSION },
            spans,
          },
        ],
      },
    ],
  };
}

export interface OtlpHttpExporterOptions {
  /** The full traces URL, e.g. http://localhost:4318/v1/traces. */
  readonly url: string;
  /** The fetch to send with. Defaults to globalThis.fetch; injected in tests. */
  readonly fetch?: typeof globalThis.fetch;
  /** Headers added to every request, e.g. an authorization header. */
  readonly headers?: Readonly<Record<string, string>>;
  /** The resource's service name. */
  readonly serviceName?: string;
  /** Carry payload attributes. Off by default. */
  readonly includePayloads?: boolean;
}

/**
 * An OTLP/HTTP exporter: it POSTs the mapped payload to a collector and rejects on a non-2xx
 * answer. Created only when a caller asks for it; importing the package creates nothing and
 * touches no network.
 */
export function createOtlpHttpExporter(options: OtlpHttpExporterOptions): SpanExporter {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  return {
    async export(trace: TraceSpan, context: SpanExportContext): Promise<void> {
      const payload = toOtlpExport(trace, {
        traceId: traceIdFor(context.runId),
        includePayloads: options.includePayloads === true,
        ...(options.serviceName === undefined ? {} : { serviceName: options.serviceName }),
      });
      const response = await fetchImpl(options.url, {
        method: "POST",
        headers: { "content-type": "application/json", ...options.headers },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("The OTel collector answered " + String(response.status));
      }
    },
  };
}
