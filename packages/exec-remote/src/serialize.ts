import { PickleRefusedError, SerializationError } from "./errors.js";

/**
 * The host-owned value wire. One tagged JSON vocabulary carries values in both directions:
 * Python's shim encodes a final answer or a tool argument, the host encodes a tool result.
 * The vocabulary is upstream's safe subset -- tuples, sets, frozensets, bytes, complex
 * numbers, datetimes, times, timedeltas, decimals, paths and dataclasses -- and everything
 * else is refused rather than passed through as an opaque object.
 */

const TAG = "__t";
const PICKLE_PREFIX = "pickle:";
const SAFE_PREFIX = "safe:";

export interface DecodeOptions {
  /** Accept a `pickle:` payload as raw bytes instead of refusing it. Defaults to false. */
  readonly allowPickle?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x2000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Encode one host value for the guest. Refuses what the vocabulary cannot carry. */
export function encodeValue(value: unknown, seen: Set<object> = new Set()): unknown {
  if (value === null || value === undefined) return null;
  const kind = typeof value;
  if (kind === "boolean" || kind === "number" || kind === "string") return value;
  if (kind === "bigint") return { [TAG]: "bigint", v: (value as bigint).toString() };
  if (kind === "symbol" || kind === "function") {
    throw new SerializationError("Cannot represent a " + kind + " value on the host-owned value wire.");
  }
  if (value instanceof Uint8Array) return { [TAG]: "bytes", v: bytesToBase64(value) };
  if (value instanceof ArrayBuffer) return { [TAG]: "bytes", v: bytesToBase64(new Uint8Array(value)) };
  if (value instanceof Date) return { [TAG]: "datetime", v: value.toISOString() };
  const object = value as object;
  if (seen.has(object)) throw new SerializationError("Cannot represent a cyclic value on the host-owned value wire.");
  seen.add(object);
  try {
    if (value instanceof Set) {
      return { [TAG]: "set", v: [...value].map((item) => encodeValue(item, seen)) };
    }
    if (value instanceof Map) {
      return {
        [TAG]: "dict",
        v: [...value.entries()].map(([key, item]) => [encodeValue(key, seen), encodeValue(item, seen)]),
      };
    }
    if (Array.isArray(value)) {
      return value.map((item) => encodeValue(item, seen));
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.some(([key]) => key === TAG)) {
      throw new SerializationError('Cannot represent an object with a "' + TAG + '" key: the tag namespace is reserved.');
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of entries) out[key] = encodeValue(item, seen);
    return out;
  } finally {
    seen.delete(object);
  }
}

/** Decode one value from the guest. */
export function decodeValue(value: unknown, options: DecodeOptions = {}): unknown {
  if (typeof value === "string") return decodeStringPayload(value, options);
  if (Array.isArray(value)) return value.map((item) => decodeValue(item, options));
  if (isRecord(value)) {
    const tag = value[TAG];
    if (typeof tag === "string") return decodeTagged(tag, value, options);
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = decodeValue(item, options);
    return out;
  }
  return value;
}

function decodeStringPayload(text: string, options: DecodeOptions): unknown {
  if (text.startsWith(PICKLE_PREFIX)) {
    if (options.allowPickle !== true) throw new PickleRefusedError();
    return base64ToBytes(text.slice(PICKLE_PREFIX.length));
  }
  if (text.startsWith(SAFE_PREFIX)) {
    const json = new TextDecoder().decode(base64ToBytes(text.slice(SAFE_PREFIX.length)));
    return decodeValue(JSON.parse(json) as unknown, options);
  }
  return text;
}

function decodeList(value: unknown, options: DecodeOptions): unknown[] {
  if (!Array.isArray(value)) throw new SerializationError("A tagged list payload was not an array.");
  return value.map((item) => decodeValue(item, options));
}

function decodeTagged(tag: string, value: Record<string, unknown>, options: DecodeOptions): unknown {
  switch (tag) {
    case "tuple":
      return decodeList(value["v"], options);
    case "set":
    case "frozenset":
      return new Set(decodeList(value["v"], options));
    case "bytes":
      return base64ToBytes(String(value["v"]));
    case "complex":
      return { real: Number(value["re"]), imag: Number(value["im"]) };
    case "datetime":
      return new Date(String(value["v"]));
    case "date":
      return new Date(String(value["v"]) + "T00:00:00.000Z");
    case "time":
      return String(value["v"]);
    case "timedelta":
      return Number(value["v"]);
    case "decimal":
      return String(value["v"]);
    case "bigint":
      return BigInt(String(value["v"]));
    case "path":
      return String(value["v"]);
    case "dict": {
      const pairs = decodeList(value["v"], options);
      const map = new Map<unknown, unknown>();
      for (const pair of pairs) {
        if (!Array.isArray(pair) || pair.length !== 2) {
          throw new SerializationError("A tagged dict payload carried an entry that was not a pair.");
        }
        map.set(pair[0], pair[1]);
      }
      return map;
    }
    case "dataclass": {
      const fields = isRecord(value["fields"]) ? value["fields"] : {};
      const out: Record<string, unknown> = { __dataclass: String(value["name"]) };
      for (const [key, item] of Object.entries(fields)) out[key] = decodeValue(item, options);
      return out;
    }
    default:
      throw new SerializationError('Unknown value tag "' + tag + '" on the host-owned value wire.');
  }
}
