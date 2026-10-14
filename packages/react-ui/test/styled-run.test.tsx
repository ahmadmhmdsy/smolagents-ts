import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { CodeResult, ToolCallView } from "@smolagents-ts/core";
import { CODE_FENCE, CodeAgent, MockModel, ScriptedExecutor } from "@smolagents-ts/core";
import { StyledCodeBlock, StyledRunInspector, StyledToolCall } from "../src/index.js";

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

async function renderInspector(className?: string): Promise<void> {
  await act(async () => {
    if (className === undefined) {
      render(<StyledRunInspector agent={reportingAgent()} task="Q" />);
    } else {
      render(<StyledRunInspector agent={reportingAgent()} task="Q" className={className} />);
    }
  });
  await waitFor(() => {
    expect(screen.getByRole("status").textContent).toBe("Finished");
  });
}

describe("StyledRunInspector", () => {
  it("adds its own class and forwards the pattern's whole tree", async () => {
    await renderInspector();
    const wrapper = document.querySelector(".smol-run-inspector");
    expect(wrapper).toBeTruthy();
    expect(wrapper?.querySelector(".agent-run")).toBeTruthy();
    expect(wrapper?.querySelector("ol.agent-run-steps")?.tagName).toBe("OL");
    expect(wrapper?.querySelectorAll("section.agent-step-action")).toHaveLength(2);
    expect(wrapper?.querySelector(".agent-tool-call")?.getAttribute("data-tool")).toBe("search");
    expect(wrapper?.querySelector(".agent-final-answer")?.textContent).toBe("42");
  });

  it("composes a caller's className with its own", async () => {
    await renderInspector("consumer-sheet");
    const wrapper = document.querySelector(".smol-run-inspector");
    expect(wrapper?.classList.contains("smol-run-inspector")).toBe(true);
    expect(wrapper?.classList.contains("consumer-sheet")).toBe(true);
  });

  it("forwards children into the run", async () => {
    await act(async () => {
      render(
        <StyledRunInspector agent={reportingAgent()} task="Q">
          <div data-testid="caller-extra">extra</div>
        </StyledRunInspector>,
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("caller-extra").textContent).toBe("extra");
    });
  });
});

describe("the styled leaves", () => {
  const call: ToolCallView = {
    id: "c1",
    name: "search",
    args: { q: "x" },
    status: "ok",
    output: "found",
    durationMs: 3,
  };

  it("StyledToolCall adds its class, forwards the call and its children", () => {
    const { container } = render(
      <StyledToolCall call={call} className="consumer-call">
        <span data-testid="call-extra">extra</span>
      </StyledToolCall>,
    );
    const wrapper = container.querySelector(".smol-tool-call");
    expect(wrapper?.classList.contains("consumer-call")).toBe(true);
    expect(wrapper?.querySelector(".agent-tool-call")?.getAttribute("data-tool")).toBe("search");
    expect(screen.getByTestId("call-extra").textContent).toBe("extra");
  });

  it("StyledCodeBlock adds its class, forwards the code and its children", () => {
    const { container } = render(
      <StyledCodeBlock code="1 + 1" className="consumer-code">
        <span data-testid="code-extra">extra</span>
      </StyledCodeBlock>,
    );
    const wrapper = container.querySelector(".smol-code-block");
    expect(wrapper?.classList.contains("consumer-code")).toBe(true);
    expect(wrapper?.querySelector("pre.agent-code-block")?.textContent).toContain("1 + 1");
    expect(screen.getByTestId("code-extra").textContent).toBe("extra");
  });
});
