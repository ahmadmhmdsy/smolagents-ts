import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CodeResult } from "@smolagents-ts/core";
import { CODE_FENCE, CodeAgent, MockModel, ScriptedExecutor } from "@smolagents-ts/core";
import { StyledChatSurface, StyledRunInspector } from "../src/index.js";

function fenced(thought: string, code: string): string {
  return "Thought: " + thought + "\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

/** One step that answers, so the composer settles into its enabled/idle state. */
function answeringAgent(): CodeAgent {
  const executor = new ScriptedExecutor({
    handler: (_code, options): CodeResult => {
      options.finalAnswer.submit(1);
      return { logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
    },
  });
  return new CodeAgent({
    model: new MockModel([fenced("answer", "final_answer(1)")] as never),
    executor,
  });
}

/**
 * ChatSurface reads the run's snapshot from the provider, which only RunInspector creates on
 * the published barrel, so the styled surface is rendered inside the styled tree that gives
 * it that snapshot.
 */
async function renderChat(ui: ReactElement): Promise<void> {
  await act(async () => {
    render(
      <StyledRunInspector agent={answeringAgent()} task="Q">
        {ui}
      </StyledRunInspector>,
    );
  });
  await waitFor(() => {
    expect(screen.getByRole("status").textContent).toBe("Finished");
  });
}

function surface(): HTMLElement {
  const wrapper = document.querySelector(".smol-chat-surface");
  if (wrapper === null) throw new Error("no .smol-chat-surface rendered");
  return wrapper as HTMLElement;
}

describe("StyledChatSurface", () => {
  it("adds its own class and composes a caller's className", async () => {
    await renderChat(
      <StyledChatSurface
        messages={[{ role: "user", content: "hello" }]}
        disabledReason="This transcript is read-only."
        className="consumer-chat"
      />,
    );
    const wrapper = surface();
    expect(wrapper.classList.contains("smol-chat-surface")).toBe(true);
    expect(wrapper.classList.contains("consumer-chat")).toBe(true);
    expect(wrapper.querySelector("form")).toBeTruthy();
  });

  it("forwards the message list in order", async () => {
    await renderChat(
      <StyledChatSurface
        messages={[
          { role: "user", content: "hello" },
          { role: "assistant", content: "hi there" },
        ]}
        disabledReason="This transcript is read-only."
      />,
    );
    const items = within(surface()).getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("data-role"))).toEqual(["user", "assistant"]);
    expect(items[0]?.textContent).toContain("hello");
    expect(items[1]?.textContent).toContain("hi there");
  });

  it("forwards disabledReason to the composer's described-by text", async () => {
    await renderChat(
      <StyledChatSurface messages={[]} disabledReason="This transcript is read-only." />,
    );
    const input = within(surface()).getByLabelText("Message");
    expect(input.hasAttribute("disabled")).toBe(true);
    const reasonId = input.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId ?? "")?.textContent).toBe(
      "This transcript is read-only.",
    );
  });

  it("forwards onSubmit and submits the trimmed text once the run is idle", async () => {
    const seen: string[] = [];
    await renderChat(<StyledChatSurface messages={[]} onSubmit={(text) => seen.push(text)} />);
    const wrapper = surface();
    const form = wrapper.querySelector("form");
    const input = within(wrapper).getByLabelText("Message") as HTMLInputElement;
    expect(input.hasAttribute("disabled")).toBe(false);

    fireEvent.change(input, { target: { value: "  hello world  " } });
    fireEvent.submit(form as HTMLFormElement);
    expect(seen).toEqual(["hello world"]);
    expect(input.value).toBe("");
  });

  it("forwards children into the surface", async () => {
    await renderChat(
      <StyledChatSurface messages={[]} disabledReason="This transcript is read-only.">
        <div data-testid="chat-extra">extra</div>
      </StyledChatSurface>,
    );
    expect(screen.getByTestId("chat-extra").textContent).toBe("extra");
  });
});
