import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { CodeResult } from "@smolagents-ts/core";
import { CodeAgent, MockModel, ScriptedExecutor } from "@smolagents-ts/core";
import { AgentRun } from "../src/agent-run.js";
import { AgentStep } from "../src/agent-step.js";
import { useAgentRunSnapshot } from "../src/context.js";
import { fenced } from "./helpers.js";

/**
 * Two steps: the first reports a tool call and logs, the second answers. The executor is the
 * only place a tool call can come from, so the test drives it through `onToolCall`.
 */
function reportingAgent(planningInterval = 0): CodeAgent {
  const executor = new ScriptedExecutor({
    handler: (code, options): CodeResult => {
      if (code.includes("final_answer")) {
        options.onLog?.("answering");
        options.finalAnswer.submit("42");
        return { logs: "answering", isFinalAnswer: false, durationMs: 2, toolCallCount: 0 };
      }
      // `onLog` is the only source of the step's appended output; the observation is separate.
      options.onLog?.("searching");
      options.onToolCall?.({ type: "requested", callId: "c1", name: "search", args: { q: "x" } });
      options.onToolCall?.({
        type: "result",
        callId: "c1",
        name: "search",
        output: "found",
        durationMs: 3,
      });
      return { logs: "searching", isFinalAnswer: false, durationMs: 3, toolCallCount: 1 };
    },
  });
  // The plan turn only exists when planning is on: with an interval of zero the loop has no
  // planning step to consume it, and an unparseable turn becomes an action step of its own.
  const turns =
    planningInterval > 0
      ? [
          fenced("one", "results = search({ q: 'x' })"),
          "Plan: do the thing",
          fenced("two", "final_answer('42')"),
        ]
      : [fenced("one", "results = search({ q: 'x' })"), fenced("two", "final_answer('42')")];
  const model = new MockModel(turns as never);
  return new CodeAgent({ model, executor, planningInterval });
}

/** The design's composition: a status, the steps, and the answer. */
function RunView({ agent }: { readonly agent: CodeAgent }) {
  return (
    <AgentRun agent={agent} task="Q">
      <AgentRun.Status />
      <AgentRun.Steps>
        {(step) => (
          <AgentStep.Action step={step}>
            <AgentStep.Code />
            <AgentStep.ToolCalls />
            <AgentStep.Logs />
            <AgentStep.Observation />
          </AgentStep.Action>
        )}
      </AgentRun.Steps>
      <AgentRun.FinalAnswer />
    </AgentRun>
  );
}

async function renderRun(agent: CodeAgent) {
  await act(async () => {
    render(<RunView agent={agent} />);
  });
  await waitFor(() => {
    expect(screen.getByRole("status").textContent).toBe("Finished");
  });
}

describe("the composition", () => {
  it("renders the run's steps, calls, logs, observations and answer", async () => {
    await renderRun(reportingAgent());

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("aria-busy")).toBe("false");

    const actions = document.querySelectorAll("section.agent-step-action");
    expect(actions).toHaveLength(2);
    // The tool-call list is a list too, so name the step list by its class.
    expect(document.querySelector("ol.agent-run-steps")?.tagName).toBe("OL");

    expect(screen.getByText("results = search({ q: 'x' })")).toBeTruthy();
    const logs = screen.getAllByLabelText("Run output");
    expect(logs).toHaveLength(2);
    // The store appends a newline per log line.
    expect(logs.map((node) => node.textContent)).toEqual(["searching\n", "answering\n"]);
    expect(logs[0]?.getAttribute("aria-live")).toBe("polite");

    const call = document.querySelector(".agent-tool-call");
    expect(call?.getAttribute("data-tool")).toBe("search");
    expect(call?.getAttribute("data-status")).toBe("ok");
    expect(screen.getByText("done")).toBeTruthy();

    const observations = document.querySelectorAll(".agent-step-observation");
    expect(observations).toHaveLength(2);
    expect(observations[0]?.textContent).toBe("searching");

    expect(document.querySelector(".agent-final-answer")?.textContent).toBe("42");
    expect(document.body.textContent).not.toContain("[object Object]");
  });

  it("lets a caller replace an action step through the override map", async () => {
    const agent = reportingAgent();
    await act(async () => {
      render(
        <AgentRun
          agent={agent}
          task="Q"
          components={{ action: () => <div data-testid="custom-action" /> }}
        >
          <AgentRun.Steps>
            {(step) => (
              <AgentStep.Action step={step}>
                <AgentStep.Code />
              </AgentStep.Action>
            )}
          </AgentRun.Steps>
        </AgentRun>,
      );
    });
    await waitFor(() => {
      expect(screen.getAllByTestId("custom-action")).toHaveLength(2);
    });
    expect(document.querySelectorAll("section.agent-step-action")).toHaveLength(0);
    expect(document.querySelectorAll("pre.agent-code-block")).toHaveLength(0);
  });

  it("renders the planning lane from the snapshot", async () => {
    const agent = reportingAgent(1);
    function PlanningLane() {
      const snapshot = useAgentRunSnapshot();
      return (
        <>
          {snapshot.planning.map((planning) => (
            <AgentStep.Planning key={planning.stepIndex} planning={planning} />
          ))}
        </>
      );
    }
    await act(async () => {
      render(
        <AgentRun agent={agent} task="Q">
          <AgentRun.Status />
          <PlanningLane />
        </AgentRun>,
      );
    });
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Finished");
    });
    const lane = document.querySelector(".agent-step-planning");
    expect(lane?.getAttribute("data-status")).toBe("complete");
    expect(lane?.textContent).toBe("Plan: do the thing");
  });
});
