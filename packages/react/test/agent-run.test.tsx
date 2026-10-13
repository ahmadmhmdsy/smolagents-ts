import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  CodeAgent,
  MockModel,
  ScriptedExecutor,
  type CodeResult,
} from "@smolagents-ts/core";
import { AgentRun } from "../src/agent-run.js";
import { fenced } from "./helpers.js";

/**
 * An executor that holds its step open until the test releases the gate, so the running
 * state is deterministic. An abort rejects the pending step.
 */
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

describe("AgentRun", () => {
  it("announces the running state and then the finished one", async () => {
    const { agent, release } = gatedAgent();
    render(
      <AgentRun agent={agent} task="Q">
        <AgentRun.Status />
      </AgentRun>,
    );
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      release();
    });
    await waitFor(() => {
      expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("false");
    });
    expect(screen.getByRole("status").textContent).toBe("Finished");
  });

  it("renders the step list as an ordered list of steps", async () => {
    const { agent, release } = gatedAgent();
    render(
      <AgentRun agent={agent} task="Q">
        <AgentRun.Steps>{(step) => <span>step {step.stepIndex}</span>}</AgentRun.Steps>
      </AgentRun>,
    );
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);

    await act(async () => {
      release();
    });
    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });
    const item = screen.getAllByRole("listitem")[0];
    expect(screen.getByRole("list").tagName).toBe("OL");
    expect(item?.getAttribute("data-step-index")).toBe("0");
    expect(item?.textContent).toBe("step 0");
  });

  it("cancels a running run from a button", async () => {
    const { agent } = gatedAgent();
    render(
      <AgentRun agent={agent} task="Q">
        <AgentRun.Status />
        <AgentRun.Cancel />
      </AgentRun>,
    );
    const button = screen.getByRole("button", { name: "Cancel run" });
    expect(button.hasAttribute("disabled")).toBe(false);

    await act(async () => {
      fireEvent.click(button);
    });
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Cancelled");
    });
    expect(screen.getByRole("button", { name: "Cancel run" }).hasAttribute("disabled")).toBe(true);
  });
});
