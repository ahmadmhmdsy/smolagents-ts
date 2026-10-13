import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentSession, type StepView } from "@smolagents-ts/core";
import { AgentStep } from "../src/agent-step.js";
import { AgentRunProvider, type AgentRunContextValue } from "../src/context.js";
import { renderValue } from "../src/final-answer.js";
import { agentThatAnswers } from "./helpers.js";

const fullStep: StepView = {
  stepIndex: 0,
  status: "complete",
  thought: "thinking",
  code: "compute()",
  logs: "a log line",
  observation: "the observation",
  toolCalls: [
    { id: "c1", name: "search", args: { q: "x" }, status: "ok", output: "found", durationMs: 3 },
    { id: "c2", name: "fetch", args: {}, status: "pending" },
    { id: "c3", name: "boom", args: {}, status: "error", error: "it broke" },
  ],
  isFinalAnswer: false,
  startedAt: 1,
  endedAt: 2,
};

const emptyStep: StepView = {
  stepIndex: 1,
  status: "complete",
  thought: "",
  code: null,
  logs: "",
  observation: null,
  toolCalls: [],
  isFinalAnswer: false,
  startedAt: 1,
  endedAt: 2,
};

function wrap(children: React.ReactNode) {
  const agent = agentThatAnswers(1);
  const value: AgentRunContextValue = {
    agent,
    snapshot: new AgentSession(agent).getSnapshot(),
    components: {},
    cancel: () => undefined,
  };
  return render(<AgentRunProvider value={value}>{children}</AgentRunProvider>);
}

describe("AgentStep", () => {
  it("renders the code, the logs, the calls and the observation", () => {
    wrap(
      <AgentStep.Action step={fullStep}>
        <AgentStep.Code />
        <AgentStep.Logs />
        <AgentStep.ToolCalls />
        <AgentStep.Observation />
      </AgentStep.Action>,
    );
    expect(screen.getByText("compute()").textContent).toBe("compute()");
    expect(screen.getByLabelText("Run output").getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText("a log line")).toBeTruthy();
    expect(screen.getByText("search")).toBeTruthy();
    expect(screen.getByText("done")).toBeTruthy();
    expect(screen.getByText("running")).toBeTruthy();
    expect(screen.getByText("failed")).toBeTruthy();
    expect(screen.getByText("found")).toBeTruthy();
    expect(screen.getByText("it broke")).toBeTruthy();
    expect(screen.getByText("the observation")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("renders nothing for a step with nothing to show", () => {
    const { container } = wrap(
      <AgentStep.Action step={emptyStep}>
        <AgentStep.Code />
        <AgentStep.Logs />
        <AgentStep.ToolCalls />
        <AgentStep.Observation />
      </AgentStep.Action>,
    );
    expect(container.querySelector("pre")).toBeNull();
    expect(container.querySelector("ul")).toBeNull();
    expect(container.querySelector(".agent-step-observation")).toBeNull();
  });

  it("renders a planning step", () => {
    wrap(
      <AgentStep.Planning
        planning={{ stepIndex: 1, status: "complete", text: "Plan: do it", startedAt: 1, endedAt: 2 }}
      />,
    );
    expect(screen.getByText("Plan: do it")).toBeTruthy();
    expect(document.querySelector(".agent-step-planning")?.getAttribute("data-status")).toBe("complete");
  });

  it("throws the context sentence when a leaf renders outside its wrapper", () => {
    expect(() => render(<AgentStep.Code />)).toThrow(/inside an <AgentStep.Action>/);
  });

  it("renders a value as text", () => {
    expect(renderValue("already text")).toBe("already text");
    expect(renderValue({ a: 1 })).toBe('{"a":1}');
    // `FinalAnswer` and `ToolCall` guard `undefined` before they call this, so the
    // fallback is only reachable for a value that cannot be serialised at all.
    expect(renderValue(null)).toBe("null");
  });
});
