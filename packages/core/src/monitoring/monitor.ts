import { type TokenUsage, EMPTY_TOKEN_USAGE, addTokenUsage } from "../types.js";

export interface MonitorStat {
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Prompt tokens the provider billed as a cache read; absent until one reports a split. */
  cachedInputTokens?: number;
  /** Prompt tokens the provider billed as a cache write; absent until one reports a split. */
  cacheWriteInputTokens?: number;
  totalDurationMs: number;
}

/**
 * Token and timing accounting modelled on upstream smolagents monitoring.py, with an injected clock so
 * tests are deterministic. Deliberate v1 differences from upstream: no `reset()` (a Monitor is created per
 * run, so there is nothing to reset), no `update_metrics()`/`step_durations`, and `total` is a value copy.
 */
export class Monitor {
  private readonly stats = new Map<string, MonitorStat>();
  private readonly startedAt: number;

  constructor(startedAt: number = Date.now()) {
    this.startedAt = startedAt;
  }

  record(key: string, usage: TokenUsage, durationMs: number): void {
    const previous = this.stats.get(key);
    const cachedInputTokens = (previous?.cachedInputTokens ?? 0) + (usage.cachedInputTokens ?? 0);
    const cacheWriteInputTokens =
      (previous?.cacheWriteInputTokens ?? 0) + (usage.cacheWriteInputTokens ?? 0);
    this.stats.set(key, {
      callCount: (previous?.callCount ?? 0) + 1,
      inputTokens: (previous?.inputTokens ?? 0) + usage.inputTokens,
      outputTokens: (previous?.outputTokens ?? 0) + usage.outputTokens,
      totalTokens: (previous?.totalTokens ?? 0) + usage.totalTokens,
      ...(usage.cachedInputTokens === undefined && previous?.cachedInputTokens === undefined
        ? {}
        : { cachedInputTokens }),
      ...(usage.cacheWriteInputTokens === undefined && previous?.cacheWriteInputTokens === undefined
        ? {}
        : { cacheWriteInputTokens }),
      totalDurationMs: (previous?.totalDurationMs ?? 0) + durationMs,
    });
  }

  get(key: string): MonitorStat | undefined {
    const stat = this.stats.get(key);
    return stat === undefined ? undefined : { ...stat };
  }

  get total(): TokenUsage {
    let total: TokenUsage = { ...EMPTY_TOKEN_USAGE };
    for (const stat of this.stats.values()) {
      total = addTokenUsage(total, {
        inputTokens: stat.inputTokens,
        outputTokens: stat.outputTokens,
        totalTokens: stat.totalTokens,
        ...(stat.cachedInputTokens === undefined ? {} : { cachedInputTokens: stat.cachedInputTokens }),
        ...(stat.cacheWriteInputTokens === undefined
          ? {}
          : { cacheWriteInputTokens: stat.cacheWriteInputTokens }),
      });
    }
    return total;
  }

  elapsedMs(now: number = Date.now()): number {
    return now - this.startedAt;
  }

  snapshot(): Record<string, MonitorStat> {
    const out: Record<string, MonitorStat> = {};
    for (const [key, stat] of this.stats) {
      out[key] = { ...stat };
    }
    return out;
  }
}
