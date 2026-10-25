import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { AgentSession, type AgentSessionSnapshot } from "@smolagents-ts/core";
import { AgentRun } from "../src/agent-run.js";
import { ChatSurface } from "../src/chat-surface.js";
import { AgentRunProvider, type AgentRunContextValue } from "../src/context.js";
import { agentThatAnswers } from "./helpers.js";

/** The snapshot a bare provider carries: no run is started, so the assertion needs no agent. */
function snapshot(overrides: Partial<AgentSessionSnapshot> = {}): AgentSessionSnapshot {
  return { ...new AgentSession(agentThatAnswers(1)).getSnapshot(), ...overrides };
}

function wrap(children: ReactNode, overrides: Partial<AgentSessionSnapshot> = {}) {
  const value: AgentRunContextValue = {
    agent: agentThatAnswers(1),
    snapshot: snapshot(overrides),
    components: {},
    cancel: () => undefined,
  };
  return render(<AgentRunProvider value={value}>{children}</AgentRunProvider>);
}

describe("ChatSurface", () => {
  it("renders the transcript as an ordered list in message order", () => {
    const { container } = wrap(
      <ChatSurface
        messages={[
          { role: "user", content: "hello" },
          { role: "assistant", content: "hi there" },
        ]}
        onSubmit={() => undefined}
      />,
    );
    const list = container.querySelector("ol");
    expect(list?.tagName).toBe("OL");
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("data-role"))).toEqual(["user", "assistant"]);
    expect(items[0]?.textContent).toContain("hello");
    expect(items[1]?.textContent).toContain("hi there");
    expect(items[0]?.textContent).not.toContain("hi there");
  });

  it("defaults to the snapshot's conversation", () => {
    const { container } = wrap(<ChatSurface onSubmit={() => undefined} />, {
      messages: [
        { role: "user", content: "from the snapshot" },
        { role: "assistant", content: "answered" },
      ],
    });
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain("from the snapshot");
    expect(items[1]?.textContent).toContain("answered");
  });

  it("renders an explicit transcript instead of the snapshot's when one is passed", () => {
    wrap(<ChatSurface messages={[{ role: "user", content: "explicit" }]} onSubmit={() => undefined} />, {
      messages: [{ role: "user", content: "from the snapshot" }],
    });
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain("explicit");
  });

  it("renders children inside the surface", () => {
    wrap(
      <ChatSurface messages={[]} onSubmit={() => undefined}>
        <div data-testid="step-summary">three steps</div>
      </ChatSurface>,
    );
    expect(screen.getByTestId("step-summary").textContent).toBe("three steps");
  });

  it("disables the composer and associates the reason when no handler is supplied", () => {
    wrap(<ChatSurface messages={[]} disabledReason="This transcript is read-only." />);
    const input = screen.getByLabelText("Message");
    expect(input.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
    const reasonId = input.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    const reason = document.getElementById(reasonId ?? "");
    expect(reason?.textContent).toBe("This transcript is read-only.");
    // Visible explanatory text, not a second live region: the run's status is the only one.
    expect(reason?.getAttribute("aria-live")).toBeNull();
  });

  it("submits the trimmed text through a real form and ignores blank input", () => {
    const seen: string[] = [];
    const { container } = wrap(
      <ChatSurface messages={[]} onSubmit={(text) => seen.push(text)} />,
    );
    const form = container.querySelector("form");
    expect(form?.tagName).toBe("FORM");
    const input = screen.getByLabelText("Message") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(form as HTMLFormElement);
    expect(seen).toEqual([]);

    fireEvent.change(input, { target: { value: "  hello world  " } });
    fireEvent.submit(form as HTMLFormElement);
    expect(seen).toEqual(["hello world"]);
    expect(input.value).toBe("");
  });

  it("disables the composer while a run is in flight without duplicating a live region", () => {
    wrap(
      <>
        <AgentRun.Status />
        <ChatSurface messages={[]} onSubmit={() => undefined} />
      </>,
      { status: "running", isRunning: true },
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
    const input = screen.getByLabelText("Message");
    expect(input.hasAttribute("disabled")).toBe(true);
    const reasonId = input.getAttribute("aria-describedby");
    expect(document.getElementById(reasonId ?? "")?.textContent).toBe("A run is already in flight.");
  });
});
