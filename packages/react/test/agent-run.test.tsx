import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  CodeAgent,
  MockModel,
  ScriptedExecutor,
  type CodeResult,
} from "@smolagents-ts/core";
import { AgentRun } from "../src/agent-run.js";
import { answering, fenced } from "./helpers.js";

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

  it("runs a new task given mid-run instead of dropping it", async () => {
    // The executor holds every step open until it is aborted, so the first task can only
    // end by being cancelled. Before the fix the second send rejected "already running",
    // the rejection was swallowed, and the first task's state stayed under the new prop.
    const tasks: string[] = [];
    const executor = new ScriptedExecutor({
      handler: (_code, options): Promise<CodeResult> =>
        new Promise<CodeResult>((resolve, reject) => {
          if (tasks.length > 1) {
            options.finalAnswer.submit("second");
            resolve({ logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 });
            return;
          }
          options.signal.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        }),
    });
    const model = new MockModel([fenced("a", "final_answer(1)"), fenced("b", "final_answer(2)")] as never);
    const agent = new CodeAgent({ model, executor });
    agent.on((event) => {
      if (event.type === "run.started") tasks.push(event.task);
    });
    const view = render(
      <AgentRun agent={agent} task="first">
        <AgentRun.Status />
        <AgentRun.FinalAnswer />
      </AgentRun>,
    );
    await waitFor(() => {
      expect(tasks).toEqual(["first"]);
    });
    view.rerender(
      <AgentRun agent={agent} task="second">
        <AgentRun.Status />
        <AgentRun.FinalAnswer />
      </AgentRun>,
    );
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Finished");
    });
    expect(tasks).toEqual(["first", "second"]);
  });

  it("cancels its run when it unmounts", async () => {
    // The step stays open until it is aborted, so only a cancel can end it.
    let aborted = false;
    const executor = new ScriptedExecutor({
      handler: (_code, options): Promise<CodeResult> =>
        new Promise<CodeResult>((_resolve, reject) => {
          options.signal.addEventListener(
            "abort",
            () => {
              aborted = true;
              reject(new Error("aborted"));
            },
            { once: true },
          );
        }),
    });
    const model = new MockModel([fenced("one", "final_answer(1)")] as never);
    const agent = new CodeAgent({ model, executor });
    let started = false;
    agent.on((event) => {
      if (event.type === "code.completed") started = true;
    });
    const view = render(<AgentRun agent={agent} task="Q" />);
    await waitFor(() => {
      expect(started).toBe(true);
    });
    view.unmount();
    await waitFor(() => {
      expect(aborted).toBe(true);
    });
  });

  it("starts once and is not cancelled under StrictMode", async () => {
    const agent = new CodeAgent({
      model: new MockModel([fenced("one", "final_answer(1)")] as never),
      executor: answering(1),
    });
    let starts = 0;
    agent.on((event) => {
      if (event.type === "run.started") starts += 1;
    });
    render(
      <StrictMode>
        <AgentRun agent={agent} task="Q">
          <AgentRun.Status />
        </AgentRun>
      </StrictMode>,
    );
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Finished");
    });
    expect(starts).toBe(1);
  });
});
