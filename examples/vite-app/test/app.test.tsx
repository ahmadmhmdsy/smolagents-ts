import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";

/** Render the page and wait for the scripted run to finish. */
async function renderApp(): Promise<void> {
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => {
    expect(screen.getByRole("status").textContent).toBe("Finished");
  });
}

describe("the browser example", () => {
  it("runs the scripted agent in the real executor and renders the run", async () => {
    await renderApp();

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("aria-busy")).toBe("false");

    // Two steps: the tool call, then the answer.
    expect(document.querySelectorAll("section.agent-step-action")).toHaveLength(2);

    // Both programs are rendered, and the second one reads what the first declared.
    const text = document.body.textContent ?? "";
    expect(text).toContain('greet({ name: "world" })');
    expect(text).toContain("final_answer(greeting)");

    // The call the sandbox reported, with the result it reported for it.
    const call = document.querySelector(".agent-tool-call");
    expect(call?.getAttribute("data-tool")).toBe("greet");
    expect(call?.getAttribute("data-status")).toBe("ok");

    // The greeting the guest logged, and the observation the next step reads.
    const logs = document.querySelector("pre.agent-step-logs");
    expect(logs?.getAttribute("aria-live")).toBe("polite");
    expect(logs?.textContent).toContain("Hello, world!");
    expect(document.querySelector(".agent-step-observation")?.textContent).toContain(
      "Hello, world!",
    );

    // The answer, and no stringified object anywhere in the tree.
    expect(document.querySelector(".agent-final-answer")?.textContent).toContain("Hello, world!");
    expect(text).not.toContain("[object Object]");
  });

  it("starts one run per press and does not accumulate steps", async () => {
    await renderApp();

    await act(async () => {
      screen.getByRole("button", { name: "Run it again" }).click();
    });
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Finished");
    });

    expect(document.querySelectorAll("section.agent-step-action")).toHaveLength(2);
    expect(document.querySelectorAll(".agent-tool-call")).toHaveLength(1);
  });

  it("renders the styled layers over the run and disables the composer with a reason", async () => {
    await renderApp();

    // The styled inspector wraps the run, and inside it the primitives' own markup is
    // unchanged: the wrapper adds a class and forwards the props, nothing else.
    const inspector = document.querySelector(".smol-run-inspector");
    expect(inspector).not.toBeNull();
    expect(inspector?.querySelector(".agent-run")).not.toBeNull();
    expect(inspector?.querySelector(".agent-final-answer")?.textContent).toContain("Hello, world!");

    // The chat surface renders the run's own conversation: the task turn, then the run's turns.
    const surface = document.querySelector(".smol-chat-surface");
    expect(surface).not.toBeNull();
    const items = [...(surface?.querySelectorAll("li") ?? [])];
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]?.getAttribute("data-role")).toBe("user");
    expect(items[0]?.textContent).toContain("Greet the world");
    expect(items.at(-1)?.textContent).toContain("Hello, world!");

    // No handler is supplied, so the composer is disabled and its reason is reachable from the
    // input through aria-describedby: visible text, not a second live region.
    const input = screen.getByLabelText("Message");
    expect(input.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
    const reasonId = input.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    const reason = document.getElementById(reasonId ?? "");
    expect(reason?.textContent).toBe("This page shows the run's conversation, so there is nothing to send.");
    expect(reason?.getAttribute("aria-live")).toBeNull();
  });
});
