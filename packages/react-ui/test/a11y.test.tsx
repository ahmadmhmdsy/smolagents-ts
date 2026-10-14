import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CodeResult, ToolCallView } from "@smolagents-ts/core";
import { CODE_FENCE, CodeAgent, MockModel, ScriptedExecutor } from "@smolagents-ts/core";
import { StyledRunInspector, StyledToolCall } from "../src/index.js";

function fenced(thought: string, code: string): string {
  return "Thought: " + thought + "\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

/** Two steps: the first reports a tool call and logs, the second answers. */
function reportingAgent(): CodeAgent {
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
  const turns = [fenced("one", "results = search({ q: 'x' })"), fenced("two", "final_answer('42')")];
  return new CodeAgent({ model: new MockModel(turns as never), executor });
}

/** An executor that holds its step open until the test releases the gate. */
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

async function renderFinished(): Promise<void> {
  await act(async () => {
    render(<StyledRunInspector agent={reportingAgent()} task="Q" />);
  });
  await waitFor(() => {
    expect(screen.getByRole("status").textContent).toBe("Finished");
  });
}

describe("the styled tree's accessibility", () => {
  it("keeps aria-live and aria-busy while a run is in flight, and adds none of its own", async () => {
    const { agent } = gatedAgent();
    await act(async () => {
      render(<StyledRunInspector agent={agent} task="Q" />);
    });

    await waitFor(() => {
      expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    });
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect(document.querySelectorAll("[role='status']")).toHaveLength(1);

    const wrapper = document.querySelector(".smol-run-inspector");
    expect(wrapper?.getAttribute("role")).toBeNull();
    expect(wrapper?.getAttribute("aria-live")).toBeNull();
    expect(wrapper?.getAttribute("aria-busy")).toBeNull();
    expect(wrapper?.getAttribute("aria-label")).toBeNull();
  });

  it("keeps the status region and the appended-output region through the wrapper", async () => {
    await renderFinished();

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("aria-busy")).toBe("false");

    const logs = screen.getAllByLabelText("Run output");
    expect(logs).toHaveLength(2);
    expect(logs[0]?.getAttribute("aria-live")).toBe("polite");
    // The run's status stays the only status role in the styled tree.
    expect(document.querySelectorAll("[role='status']")).toHaveLength(1);
  });

  it("keeps the tool call's one-shot announcement, without duplicating it", async () => {
    await renderFinished();
    const call = document.querySelector<HTMLElement>(".agent-tool-call");
    expect(call).toBeTruthy();
    const live = call?.querySelectorAll("[aria-live]") ?? [];
    expect(live).toHaveLength(1);
    expect(live[0]?.textContent).toBe("done");
    // Exactly one node announces the completion; the wrapper introduced no second one.
    expect(screen.getAllByText("done")).toHaveLength(1);
  });

  it("keeps the tool call's live region when the leaf itself is styled", () => {
    const call: ToolCallView = {
      id: "c1",
      name: "search",
      args: {},
      status: "ok",
      output: "found",
      durationMs: 3,
    };
    const { container } = render(<StyledToolCall call={call} />);
    const wrapper = container.querySelector(".smol-tool-call");
    expect(wrapper?.getAttribute("aria-live")).toBeNull();
    const live = wrapper?.querySelectorAll("[aria-live]") ?? [];
    expect(live).toHaveLength(1);
    expect(live[0]?.textContent).toBe("done");
  });

  it("keeps cancellation reachable and effective by keyboard through the wrapper", async () => {
    const { agent } = gatedAgent();
    render(<StyledRunInspector agent={agent} task="Q" />);

    const button = screen.getByRole("button", { name: "Cancel run" });
    expect(button.hasAttribute("disabled")).toBe(false);
    // Reach it the way a keyboard user does: it is in the tab order and takes focus.
    button.focus();
    expect(document.activeElement).toBe(button);

    // jsdom 30.1.2 does not implement a button's Enter-to-click activation behavior, and
    // @testing-library/user-event is not installed (adding a dependency is out of scope).
    // The two events a keyboard activation produces are dispatched here: the Enter keydown
    // the user presses, and the click the browser turns it into.
    fireEvent.keyDown(button, { key: "Enter" });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Cancelled");
    });
    expect(screen.getByRole("button", { name: "Cancel run" }).hasAttribute("disabled")).toBe(true);
  });
});
