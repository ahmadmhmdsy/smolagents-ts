import { ToolPolicyDeniedError } from "../errors.js";
import type { AgentMemory } from "../memory/memory.js";
import type { TokenUsage } from "../types.js";
import { ToolRegistry } from "./registry.js";
import { ToolDefinitionError, type Tool } from "./tool.js";

/**
 * What the model may see and call during a step, as data. The agent holds one policy for the
 * run; a provider can narrow it per step, and the loop resolves the two once per step so every
 * reader — the prompt, the request's specs, the executor's registry and the lookup that runs a
 * call — sees the same view.
 */
export interface ToolPolicy {
  /**
   * The names admitted this step. Omitted means every registered tool; two sets intersect, so a
   * per-step policy can narrow the run's set but never widen it.
   */
  readonly allowed?: readonly string[];
  /** Tools the model does not see and cannot run; a scripted call fails with the reason. */
  readonly hidden?: readonly ToolPolicyHiddenEntry[];
  /** Tools this step must call before it answers. */
  readonly forced?: readonly string[];
  /** Tools the run must call before it answers; checked against the whole run, not the step. */
  readonly require?: readonly ToolPolicyRequirement[];
}

export interface ToolPolicyHiddenEntry {
  readonly name: string;
  /** Why the tool is hidden; carried into the refusal so the observation explains itself. */
  readonly reason?: string;
}

export interface ToolPolicyRequirement {
  readonly tool: string;
  readonly reason: string;
}

/** What a provider is handed when the loop asks for one step's policy. */
export interface ToolPolicyContext {
  readonly runId: string;
  readonly stepIndex: number;
  readonly task: string;
  /** The run's memory as it stands before the step: a provider may read the steps it holds. */
  readonly memory: AgentMemory;
  /** The run's mutable scratch space, shared with middleware. */
  readonly state: ReadonlyMap<string, unknown>;
  /** What the run has spent so far, so a provider can tighten a policy near the budget. */
  readonly usage: TokenUsage;
}

export type ToolPolicyProvider = (context: ToolPolicyContext) => ToolPolicy | Promise<ToolPolicy>;

export interface MergedToolPolicy {
  readonly allowed: readonly string[] | undefined;
  readonly hidden: readonly ToolPolicyHiddenEntry[];
  readonly forced: readonly string[];
  readonly required: readonly ToolPolicyRequirement[];
  /** Forced names the allowed set does not admit, each with the reason it was dropped. */
  readonly droppedForced: readonly { readonly name: string; readonly reason: string }[];
}

/** Combine the run's policy with the step's. Neither input is mutated. */
export function mergeToolPolicy(base?: ToolPolicy, step?: ToolPolicy): MergedToolPolicy {
  const allowed = intersectAllowed(base?.allowed, step?.allowed);

  const hidden: ToolPolicyHiddenEntry[] = [];
  for (const entry of [...(base?.hidden ?? []), ...(step?.hidden ?? [])]) {
    if (hidden.some((existing) => existing.name === entry.name)) continue;
    hidden.push(entry);
  }

  const forced: string[] = [];
  const droppedForced: { name: string; reason: string }[] = [];
  for (const name of [...(base?.forced ?? []), ...(step?.forced ?? [])]) {
    if (forced.includes(name)) continue;
    if (allowed !== undefined && !allowed.includes(name)) {
      droppedForced.push({
        name,
        reason: "the allowed set for this step does not admit " + name,
      });
      continue;
    }
    forced.push(name);
  }

  const required: ToolPolicyRequirement[] = [];
  for (const entry of [...(base?.require ?? []), ...(step?.require ?? [])]) {
    if (required.some((existing) => existing.tool === entry.tool)) continue;
    required.push(entry);
  }

  return { allowed, hidden, forced, required, droppedForced };
}

function intersectAllowed(
  base: readonly string[] | undefined,
  step: readonly string[] | undefined,
): readonly string[] | undefined {
  if (base === undefined) return step;
  if (step === undefined) return base;
  const admitted = new Set(step);
  return base.filter((name) => admitted.has(name));
}

/** True when the policy names anything at all; an empty policy changes no view. */
export function isEmptyToolPolicy(policy: MergedToolPolicy): boolean {
  return (
    policy.allowed === undefined &&
    policy.hidden.length === 0 &&
    policy.forced.length === 0 &&
    policy.required.length === 0
  );
}

/** A stable description of what the policy does, so the loop can announce it once per change. */
export function toolPolicySignature(policy: MergedToolPolicy): string {
  return JSON.stringify({
    allowed: policy.allowed === undefined ? null : [...policy.allowed].sort(),
    hidden: policy.hidden.map((entry) => [entry.name, entry.reason ?? ""]).sort(),
    forced: [...policy.forced].sort(),
    required: policy.required.map((entry) => entry.tool).sort(),
  });
}

/**
 * Check a policy against the registry it will govern. A forced or required name nobody registers
 * is a definition mistake, not something a step should discover by refusing an answer, so it
 * fails where the policy is declared.
 */
export function validateToolPolicy(
  registry: ToolRegistry,
  policy: ToolPolicy,
  source = "AgentOptions.toolPolicy",
): void {
  for (const name of policy.forced ?? []) {
    if (!registry.has(name)) {
      throw new ToolDefinitionError(source + " forces " + JSON.stringify(name) + ", which no tool registers.");
    }
  }
  for (const entry of policy.require ?? []) {
    if (!registry.has(entry.tool)) {
      throw new ToolDefinitionError(
        source + " requires " + JSON.stringify(entry.tool) + ", which no tool registers.",
      );
    }
  }
}

/**
 * The step's registry: insertion order preserved, with each hidden tool replaced by a stub that
 * refuses with the policy's reason. The stub is what makes a scripted call fail with an
 * explanation instead of "unknown tool", and the advertised view leaves it out entirely.
 */
export function applyToolPolicy(registry: ToolRegistry, policy: MergedToolPolicy): ToolRegistry {
  const hidden = new Map(policy.hidden.map((entry) => [entry.name, entry.reason]));
  const step = new ToolRegistry();
  for (const entry of registry.list()) {
    step.add(hidden.has(entry.name) ? deniedStub(entry, hidden.get(entry.name)) : entry);
  }
  return step;
}

/** The tools the prompt and the request may name: the step's registry without the hidden ones. */
export function advertisedToolRegistry(registry: ToolRegistry, policy: MergedToolPolicy): ToolRegistry {
  const hidden = new Set(policy.hidden.map((entry) => entry.name));
  return new ToolRegistry(registry.list().filter((entry) => !hidden.has(entry.name)));
}

function deniedStub(entry: Tool, reason: string | undefined): Tool {
  const message =
    'Tool "' + entry.name + '" is hidden for this step' + (reason === undefined ? "." : ": " + reason);
  return {
    ...entry,
    execute: () => {
      throw new ToolPolicyDeniedError(message, { tool: entry.name });
    },
  } as Tool;
}
