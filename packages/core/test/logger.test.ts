import { describe, expect, it } from "vitest";
import { consoleLogger, noopLogger } from "../src/logger.js";

type Sink = Pick<Console, "debug" | "info" | "warn" | "error">;

const recordingSink = (calls: unknown[][]): Sink => ({
  debug: (...args: unknown[]) => void calls.push(["debug", ...args]),
  info: (...args: unknown[]) => void calls.push(["info", ...args]),
  warn: (...args: unknown[]) => void calls.push(["warn", ...args]),
  error: (...args: unknown[]) => void calls.push(["error", ...args]),
});

describe("logger", () => {
  it("noopLogger swallows every level", () => {
    expect(() => {
      noopLogger.debug("d");
      noopLogger.info("i");
      noopLogger.warn("w");
      noopLogger.error("e");
    }).not.toThrow();
  });

  it("consoleLogger forwards each level to its sink method", () => {
    const calls: unknown[][] = [];
    const logger = consoleLogger(recordingSink(calls));
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(calls).toEqual([["debug", "d"], ["info", "i"], ["warn", "w"], ["error", "e"]]);
  });

  it("forwards extra arguments unchanged", () => {
    const calls: unknown[][] = [];
    const logger = consoleLogger(recordingSink(calls));
    logger.warn("retrying", 3, { id: "a" });
    expect(calls).toEqual([["warn", "retrying", 3, { id: "a" }]]);
  });
});
