import { describe, expect, it } from "vitest";
import { Monitor } from "../src/monitoring/monitor.js";

const usage = (inputTokens: number, outputTokens: number) => ({
  inputTokens,
  outputTokens,
  totalTokens: inputTokens + outputTokens,
});

describe("Monitor", () => {
  it("returns undefined for an unrecorded key", () => {
    expect(new Monitor().get("anything")).toBeUndefined();
  });

  it("accumulates counts, tokens and duration per key", () => {
    const monitor = new Monitor();
    monitor.record("generate", usage(10, 5), 100);
    monitor.record("generate", usage(4, 1), 50);
    expect(monitor.get("generate")).toEqual({
      callCount: 2,
      inputTokens: 14,
      outputTokens: 6,
      totalTokens: 20,
      totalDurationMs: 150,
    });
  });

  it("keeps keys separate", () => {
    const monitor = new Monitor();
    monitor.record("generate", usage(10, 5), 100);
    monitor.record("plan", usage(2, 2), 20);
    expect(monitor.get("plan")?.totalTokens).toBe(4);
    expect(monitor.total.totalTokens).toBe(19);
  });

  it("totals across every key", () => {
    const monitor = new Monitor();
    monitor.record("a", usage(1, 2), 3);
    monitor.record("b", usage(4, 5), 6);
    expect(monitor.total).toEqual({ inputTokens: 5, outputTokens: 7, totalTokens: 12 });
  });

  it("reports zero totals when nothing was recorded", () => {
    expect(new Monitor().total).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it("measures elapsed time from the injected start", () => {
    const monitor = new Monitor(1000);
    expect(monitor.elapsedMs(1600)).toBe(600);
  });

  it("snapshots every stat as a plain object", () => {
    const monitor = new Monitor();
    monitor.record("a", usage(1, 1), 10);
    expect(monitor.snapshot()).toEqual({
      a: { callCount: 1, inputTokens: 1, outputTokens: 1, totalTokens: 2, totalDurationMs: 10 },
    });
  });
});
