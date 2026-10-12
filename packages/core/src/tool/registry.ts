import type { ToolSpec } from "../model.js";
import { ToolDefinitionError, type Tool } from "./tool.js";

/**
 * The agent's tool set. Order is insertion order, which is the order the model sees,
 * so the prompt is stable across runs.
 */
export class ToolRegistry {
  private readonly byName = new Map<string, Tool>();

  constructor(tools: readonly Tool[] = []) {
    for (const entry of tools) this.add(entry);
  }

  add(entry: Tool): void {
    if (this.byName.has(entry.name)) {
      throw new ToolDefinitionError("Duplicate tool name: " + entry.name);
    }
    this.byName.set(entry.name, entry);
  }

  get(name: string): Tool | undefined {
    return this.byName.get(name);
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  get size(): number {
    return this.byName.size;
  }

  list(): Tool[] {
    return [...this.byName.values()];
  }

  toSpecs(): ToolSpec[] {
    return this.list().map((entry) => entry.toSpec());
  }

  /**
   * Human-readable tool documentation for the system prompt. This is our analogue of upstream's
   * Tool.to_code_prompt() — same purpose, different shape. Upstream renders a callable
   * "def name(arg: type) -> ret:" signature; we render a bullet list with typed arguments derived from the
   * same JSON Schema the model receives, so the prompt and the wire format cannot drift.
   */
  renderDescriptions(): string {
    const lines: string[] = [];
    for (const entry of this.list()) {
      const spec = entry.toSpec();
      lines.push("- " + spec.name + ": " + spec.description);
      const properties = (spec.inputSchema.properties ?? {}) as Record<string, Record<string, unknown>>;
      const required = new Set((spec.inputSchema.required ?? []) as string[]);
      const names = Object.keys(properties);
      if (names.length === 0) {
        lines.push("  Arguments: none");
        continue;
      }
      const rendered = names.map((name) => {
        const property = properties[name] ?? {};
        const type = describeType(property);
        const suffix = required.has(name) ? "required" : "optional";
        const parts: string[] = [];
        if (typeof property.description === "string") parts.push(property.description);
        if (Array.isArray(property.enum)) {
          parts.push("one of " + property.enum.map((value) => JSON.stringify(value)).join(" | "));
        }
        const description = parts.length > 0 ? ": " + parts.join("; ") : "";
        return name + " (" + type + ", " + suffix + ")" + description;
      });
      lines.push("  Arguments: " + rendered.join(", "));
    }
    return lines.join("\n");
  }
}

/**
 * The JSON Schema type of an argument, as printed inside the parentheses. An enum-bearing property
 * still reports its underlying type here; the allowed values are appended to the argument's
 * description by renderDescriptions(), so a required type is never replaced by its value list.
 */
function describeType(property: Record<string, unknown>): string {
  const type = property.type;
  if (typeof type === "string") return type;
  return Array.isArray(type) ? type.join(" | ") : "unknown";
}
