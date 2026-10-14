import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CodeResult } from "@smolagents-ts/core";
import { CodeAgent, MockModel, ScriptedExecutor } from "@smolagents-ts/core";
import { RunInspector } from "../src/run-inspector.js";
import { fenced } from "./helpers.js";

/**
 * Two steps: the first reports a tool call and logs, the second answers. The executor is the
 * only place a tool call can come from, so the inspector's four leaves are driven through it.
 */
function reportingAgent(planningInterval = 0): CodeAgent {
  const executor = new ScriptedExecutor({
    handler: (code, options): CodeResult => {
      if (code.includes("final_answer")) {
        options.onLog?.("answering");
        options.finalAnswer.submit("42");
        return { logs: "answering", isFinalAnswer: false, durationMs: 2, toolCallCount: 0 };
      }
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
  const turns =
    planningInterval > 0
      ? [
          fenced("one", "results = search({ q: 'x' })"),
          "Plan: do the thing",
          fenced("two", "final_answer('42')"),
        ]
      : [fenced("one", "results = search({ q: 'x' })"), fenced("two", "final_answer('42')")];
  return new CodeAgent({ model: new MockModel(turns as never), executor, planningInterval });
}

/** An executor that holds its step open until the test releases the gate, like AgentRun's. */
function gatedAgent(): { agent: CodeAgent; release: () => void } {
  let release = (): void => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const executor = new ScriptedExecutor({
    handler: (_code, options): Promise<CodeResult> =>
      new Promise<CodeResult>((resolve, reject) => {
        if (options.signal.aborted) {
          reject(new Error("aborted before the step started"));
          return;
        }
        options.signal.addEventListener(
          "abort",
          () => {
            reject(new Error("aborted"));
          },
          { once: true },
        );
        void gate.then(() => {
          options.finalAnswer.submit(1);
          resolve({ logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 });
        });
      }),
  });
  const model = new MockModel([fenced("one", "final_answer(1)")] as never);
  return { agent: new CodeAgent({ model, executor }), release };
}

async function renderInspector(agent: CodeAgent) {
  await act(async () => {
    render(<RunInspector agent={agent} task="Q" />);
  });
  await waitFor(() => {
    expect(screen.getByRole("status").textContent).toBe("Finished");
  });
}

describe("RunInspector", () => {
  it("renders the status, the four action leaves and the final answer", async () => {
    await renderInspector(reportingAgent());

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("aria-busy")).toBe("false");

    expect(document.querySelector("ol.agent-run-steps")?.tagName).toBe("OL");
    expect(document.querySelectorAll("section.agent-step-action")).toHaveLength(2);
    expect(screen.getByText("results = search({ q: 'x' })")).toBeTruthy();

    const logs = screen.getAllByLabelText("Run output");
    expect(logs).toHaveLength(2);
    expect(logs[0]?.getAttribute("aria-live")).toBe("polite");

    expect(document.querySelector(".agent-tool-call")?.getAttribute("data-tool")).toBe("search");
    expect(screen.getByText("done")).toBeTruthy();
    expect(document.querySelectorAll(".agent-step-observation")).toHaveLength(2);
    expect(document.querySelector(".agent-final-answer")?.textContent).toBe("42");
  });

  it("renders the planning lane from the snapshot", async () => {
    await renderInspector(reportingAgent(1));
    const lane = document.querySelector(".agent-step-planning");
    expect(lane?.getAttribute("data-status")).toBe("complete");
    expect(lane?.textContent).toBe("Plan: do the thing");
  });

  it("passes the components override map through unchanged", async () => {
    await act(async () => {
      render(
        <RunInspector
          agent={reportingAgent()}
          task="Q"
          components={{ action: () => <div data-testid="custom-action" /> }}
        />,
      );
    });
    await waitFor(() => {
      expect(screen.getAllByTestId("custom-action")).toHaveLength(2);
    });
    expect(document.querySelectorAll("section.agent-step-action")).toHaveLength(0);
  });

  it("keeps cancellation keyboard-reachable while the run is in flight", async () => {
    const { agent } = gatedAgent();
    render(<RunInspector agent={agent} task="Q" />);
    const button = screen.getByRole("button", { name: "Cancel run" });
    expect(button.hasAttribute("disabled")).toBe(false);
    button.focus();
    expect(document.activeElement).toBe(button);

    await act(async () => {
      fireEvent.click(button);
    });
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Cancelled");
    });
    expect(screen.getByRole("button", { name: "Cancel run" }).hasAttribute("disabled")).toBe(true);
  });
});
