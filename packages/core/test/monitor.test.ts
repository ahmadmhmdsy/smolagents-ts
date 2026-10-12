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

  it("hands out a fresh total, so callers cannot corrupt the shared empty usage", () => {
    const monitor = new Monitor();
    const total = monitor.total as { inputTokens: number };
    total.inputTokens = 99;
    expect(monitor.total.inputTokens).toBe(0);
  });

  it("sums a recorded total that is not the sum of input and output", () => {
    const monitor = new Monitor();
    monitor.record("a", { inputTokens: 1, outputTokens: 1, totalTokens: 5 }, 0);
    monitor.record("a", { inputTokens: 2, outputTokens: 3, totalTokens: 7 }, 0);
    expect(monitor.total).toEqual({ inputTokens: 3, outputTokens: 4, totalTokens: 12 });
  });

  it("uses the wall clock when no start time is given", () => {
    const before = Date.now();
    const monitor = new Monitor();
    expect(monitor.elapsedMs()).toBeGreaterThanOrEqual(0);
    expect(monitor.elapsedMs(before + 10)).toBeGreaterThanOrEqual(9);
  });

  it("returns copies from get and snapshot", () => {
    const monitor = new Monitor();
    monitor.record("a", { inputTokens: 1, outputTokens: 2, totalTokens: 3 }, 4);
    const got = monitor.get("a") as { callCount: number };
    got.callCount = 99;
    expect(monitor.get("a")?.callCount).toBe(1);
    const snap = monitor.snapshot();
    (snap["a"] as { callCount: number }).callCount = 99;
    expect(monitor.get("a")?.callCount).toBe(1);
    expect(monitor.snapshot()["a"]?.totalDurationMs).toBe(4);
  });
});
