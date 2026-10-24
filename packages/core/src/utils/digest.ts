/**
 * A stable digest of a value, for drift checks inside this process.
 *
 * Not a security primitive: it detects a verdict that was produced for a different tool call or a
 * different set of arguments, which is a programming error, not an attack. It stays isomorphic by
 * using only the language and no platform hash, and it is deterministic across runs because
 * object keys are sorted before encoding.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalise(value));
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) sorted[key] = canonicalise(source[key]);
    return sorted;
  }
  return value;
}

/** FNV-1a over the canonical JSON, two rounds, rendered as a prefixed 16-hex-digit digest. */
export function digestOf(value: unknown): string {
  const text = canonicalJson(value);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x811c9dc5) >>> 0;
  }
  const hex = (n: number): string => n.toString(16).padStart(8, "0");
  return "v1:" + hex(a) + hex(b);
}
