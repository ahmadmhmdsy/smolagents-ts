import { describe, expect, it } from "vitest";
import {
  AgentBudgetExceededError,
  AgentCancelledError,
  AgentError,
  AgentExecutionError,
  AgentGenerationError,
  AgentGuardrailError,
  AgentMaxStepsError,
  AgentParsingError,
  AgentTimeoutError,
  AgentToolCallError,
} from "../src/errors.js";

describe("AgentError", () => {
  it("is an Error", () => {
    expect(new AgentError("boom")).toBeInstanceOf(Error);
  });

  it("carries the requested code", () => {
    expect(new AgentError("boom", { code: "AGENT_TIMEOUT" }).code).toBe("AGENT_TIMEOUT");
  });

  it("defaults to AGENT_ERROR", () => {
    expect(new AgentError("boom").code).toBe("AGENT_ERROR");
  });

  it("serialises to info without undefined keys", () => {
    const info = new AgentError("boom").info;
    expect(info).toEqual({ name: "AgentError", message: "boom", code: "AGENT_ERROR" });
    expect(Object.keys(info)).not.toContain("stepIndex");
  });

  it("includes stepIndex and cause when present", () => {
    const info = new AgentError("boom", { stepIndex: 3, cause: new Error("inner") }).info;
    expect(info.stepIndex).toBe(3);
    expect(info.cause).toBe("inner");
  });

  it("keeps the subclass name and code", () => {
    expect(new AgentParsingError("bad").name).toBe("AgentParsingError");
    expect(new AgentParsingError("bad").code).toBe("AGENT_PARSING");
    expect(new AgentParsingError("bad")).toBeInstanceOf(AgentError);
  });

  it("survives instanceof across subclasses", () => {
    const error: AgentError = new AgentMaxStepsError("too many", { stepIndex: 10 });
    expect(error).toBeInstanceOf(AgentMaxStepsError);
    expect(error).toBeInstanceOf(AgentError);
  });
});

describe("AgentError.from", () => {
  it("passes an existing AgentError through unchanged", () => {
    const original = new AgentExecutionError("nope");
    expect(AgentError.from(original)).toBe(original);
  });

  it("wraps a plain Error and keeps it as the cause", () => {
    const wrapped = AgentError.from(new Error("plain"));
    expect(wrapped.message).toBe("plain");
    expect(wrapped.cause).toBeInstanceOf(Error);
  });

  it("wraps a non-Error value", () => {
    expect(AgentError.from("just a string").message).toBe("just a string");
  });

  it("rebuilds the subclass that matches the code from its info", () => {
    const raised = [
      new AgentParsingError("p", { stepIndex: 1 }),
      new AgentExecutionError("e"),
      new AgentGenerationError("g"),
      new AgentMaxStepsError("m"),
      new AgentBudgetExceededError("b", { reason: "limitTurns" }),
      new AgentToolCallError("t"),
      new AgentTimeoutError("o"),
      new AgentCancelledError("c"),
      new AgentGuardrailError("r", { cause: new Error("why") }),
    ];
    for (const error of raised) {
      const rebuilt = AgentError.fromInfo(error.info);
      expect(rebuilt).toBeInstanceOf(error.constructor);
      expect(rebuilt.info).toEqual(error.info);
    }
  });

  it("carries the budget stop reason in info and survives a rebuild with it", () => {
    const error = new AgentBudgetExceededError("The run reached its budget (limitTurns)", {
      reason: "limitTurns",
      stepIndex: 4,
    });
    expect(error.code).toBe("AGENT_BUDGET_EXCEEDED");
    expect(error.reason).toBe("limitTurns");
    expect(error.info.reason).toBe("limitTurns");
    const rebuilt = AgentError.fromInfo(error.info);
    expect(rebuilt).toBeInstanceOf(AgentBudgetExceededError);
    expect((rebuilt as AgentBudgetExceededError).reason).toBe("limitTurns");
    expect(rebuilt.stepIndex).toBe(4);
  });

  it("omits the reason key when the error was rebuilt from bare info", () => {
    const rebuilt = AgentError.fromInfo({
      name: "AgentBudgetExceededError",
      message: "b",
      code: "AGENT_BUDGET_EXCEEDED",
    });
    expect(rebuilt).toBeInstanceOf(AgentBudgetExceededError);
    expect(Object.keys(rebuilt.info)).not.toContain("reason");
  });

  it("rebuilds an unknown code as a plain AgentError", () => {
    const rebuilt = AgentError.fromInfo({ name: "CustomError", message: "x", code: "CUSTOM" });
    expect(rebuilt.constructor).toBe(AgentError);
    expect(rebuilt.name).toBe("CustomError");
  });
});
