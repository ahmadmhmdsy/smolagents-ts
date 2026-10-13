import {
  ToolDefinitionError,
  ToolRegistry,
  type Tool,
  type ToolSpec,
} from "@smolagents-ts/core";

export interface ToolCollectionOptions {
  /** The group's label, for a caller that keeps several. Defaults to "tools". */
  name?: string;
  tools?: readonly Tool[];
}

/**
 * A named group of tools. The agent still runs on the core's ToolRegistry; this is the
 * grouping a caller assembles once and hands to several agents, and it converts at that
 * boundary rather than replacing the registry.
 */
export class ToolCollection {
  readonly name: string;
  private readonly byName = new Map<string, Tool>();

  constructor(options: ToolCollectionOptions = {}) {
    this.name = options.name ?? "tools";
    for (const entry of options.tools ?? []) this.add(entry);
  }

  /** Insertion order is the order the model sees, so a prompt is stable across runs. */
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

  toRegistry(): ToolRegistry {
    return new ToolRegistry(this.list());
  }

  [Symbol.iterator](): IterableIterator<Tool> {
    return this.byName.values();
  }

  static fromTools(tools: readonly Tool[], name?: string): ToolCollection {
    return new ToolCollection(name === undefined ? { tools } : { name, tools });
  }
}
