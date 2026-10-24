import type { TokenUsage } from "../types.js";
import type { AnyAgentStep } from "../memory/steps.js";

/**
 * What a run may spend. Every field is optional; a deployment clamps each one with
 * `RUN_LIMITS_CEILING`, so a caller can ask for a tighter budget but never a looser one.
 */
export interface RunLimits {
  /** Model turns, planning turns included. */
  readonly maxTurns?: number;
  /** Completion tokens, summed over the run. */
  readonly maxOutputTokens?: number;
  /** All tokens, prompt and completion, summed over the run. */
  readonly maxTotalTokens?: number;
  /**
   * The cost a run may spend, in USD against the price table it is configured with. A model the
   * table does not price is never stopped by this limit, because an unknown price is not zero.
   */
  readonly maxCostUsd?: number;
}

/** The ceiling a deployment enforces, whatever a caller asks for. */
export const RUN_LIMITS_CEILING = {
  maxTurns: 100,
  maxOutputTokens: 200_000,
  maxTotalTokens: 1_000_000,
  maxCostUsd: 100,
} as const;

/** Why a run stopped on its budget. The reason is the event's payload, not a prose message. */
export type LimitStopReason =
  | "limitTurns"
  | "limitOutputTokens"
  | "limitTotalTokens"
  | "limitCostUsd";

/**
 * The visible budget record: the clamped limits and how much of each has been spent.
 * A run carries one, and a caller's handle carries the same object between runs.
 */
export interface RunBudget {
  readonly maxTurns: number;
  readonly maxOutputTokens: number;
  readonly maxTotalTokens: number;
  /** The cost ceiling in integer micro-dollars; the ceiling times a million unless asked for less. */
  readonly maxCostMicroUsd: number;
  turns: number;
  outputTokens: number;
  totalTokens: number;
  /** Cost spent so far, in integer micro-dollars, summed over the runs sharing this budget. */
  costMicroUsd: number;
}

/**
 * Spent counters a resumed run starts from, read from the steps it already has. Cost is not
 * among them: a step records tokens, not a price, so a resumed run without a caller's handle
 * starts its cost counter at zero rather than guessing what the earlier turns cost.
 */
export interface RunBudgetSeed {
  readonly turns?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

/**
 * A caller-held handle that continues one budget. Pass it to a later run — a new task on the
 * same agent, or a resumed checkpoint — and its counters keep counting instead of resetting.
 */
export interface RunBudgetHandle {
  readonly budget: RunBudget;
}

function clamp(requested: number | undefined, ceiling: number, field: keyof RunLimits): number {
  if (requested === undefined) return ceiling;
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new RangeError("A run limit must be a positive finite number: " + field);
  }
  return Math.min(Math.floor(requested), ceiling);
}

/**
 * A requested cost in USD as integer micro-dollars, rounded to the nearest micro-dollar and
 * clamped by the ceiling. A positive request can never resolve to zero, which would cost nothing
 * and stop the run before its first turn for a reason the caller did not ask for.
 */
function clampCost(requested: number | undefined): number {
  if (requested === undefined) return RUN_LIMITS_CEILING.maxCostUsd * 1_000_000;
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new RangeError("A run limit must be a positive finite number: maxCostUsd");
  }
  return Math.max(1, Math.min(Math.round(requested * 1_000_000), RUN_LIMITS_CEILING.maxCostUsd * 1_000_000));
}

/** Resolve requested limits into a budget record, clamped by the deployment ceiling. */
export function resolveBudget(limits: RunLimits = {}, seed: RunBudgetSeed = {}): RunBudget {
  return {
    maxTurns: clamp(limits.maxTurns, RUN_LIMITS_CEILING.maxTurns, "maxTurns"),
    maxOutputTokens: clamp(limits.maxOutputTokens, RUN_LIMITS_CEILING.maxOutputTokens, "maxOutputTokens"),
    maxTotalTokens: clamp(limits.maxTotalTokens, RUN_LIMITS_CEILING.maxTotalTokens, "maxTotalTokens"),
    maxCostMicroUsd: clampCost(limits.maxCostUsd),
    turns: seed.turns ?? 0,
    outputTokens: seed.outputTokens ?? 0,
    totalTokens: seed.totalTokens ?? 0,
    costMicroUsd: 0,
  };
}

/** Create the handle a caller keeps to continue one budget across runs. */
export function createBudgetHandle(limits: RunLimits = {}, seed: RunBudgetSeed = {}): RunBudgetHandle {
  return { budget: resolveBudget(limits, seed) };
}

/**
 * Count one model turn against the budget and say whether it is now exhausted. The reason names
 * the limit that was crossed; a run that ends on it reports that value, not a message.
 */
export function spendBudget(budget: RunBudget, usage: TokenUsage): LimitStopReason | undefined {
  budget.turns += 1;
  budget.outputTokens += usage.outputTokens;
  budget.totalTokens += usage.totalTokens;
  if (budget.turns >= budget.maxTurns) return "limitTurns";
  if (budget.outputTokens >= budget.maxOutputTokens) return "limitOutputTokens";
  if (budget.totalTokens >= budget.maxTotalTokens) return "limitTotalTokens";
  return undefined;
}

/**
 * Count one turn's cost against the budget and say whether the cost ceiling is now crossed. The
 * loop prices a turn as soon as its usage arrives, so the next model call is the one the cap
 * prevents; the turn that crossed it is already paid for and stays in the run's record.
 */
export function spendCostBudget(budget: RunBudget, microUsd: number): LimitStopReason | undefined {
  budget.costMicroUsd += microUsd;
  if (budget.costMicroUsd >= budget.maxCostMicroUsd) return "limitCostUsd";
  return undefined;
}

/**
 * What a resumed run has already spent, read from the steps its checkpoint holds. A turn is a
 * step the model answered, which is exactly a step carrying token usage; tokens are summed the
 * same way the live budget counts them.
 */
export function budgetSeedFromSteps(steps: readonly AnyAgentStep[]): RunBudgetSeed {
  let turns = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  for (const step of steps) {
    const usage = step.tokenUsage;
    if (usage === undefined) continue;
    turns += 1;
    outputTokens += usage.outputTokens;
    totalTokens += usage.totalTokens;
  }
  return { turns, outputTokens, totalTokens };
}
