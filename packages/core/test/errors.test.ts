import { describe, expect, it } from "vitest";
import {
  AgentError,
  AgentExecutionError,
  AgentMaxStepsError,
  AgentParsingError,
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
});
