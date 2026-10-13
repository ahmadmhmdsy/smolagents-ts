import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { AgentSession } from "@smolagents-ts/core";
import { useAgentEvent } from "../src/use-agent-event.js";
import { agentThatAnswers } from "./helpers.js";

describe("useAgentEvent", () => {
  it("delivers only the subscribed type", async () => {
    const agent = agentThatAnswers(1);
    const session = new AgentSession(agent);
    const seen: string[] = [];
    renderHook(() => {
      useAgentEvent(agent, "step.started", () => seen.push("step"));
      useAgentEvent(agent, "run.completed", () => seen.push("done"));
    });
    await act(async () => {
      await session.send("Q");
    });
    expect(seen).toEqual(["step", "done"]);
  });

  it("uses the newest handler after a re-render", async () => {
    const agent = agentThatAnswers(1);
    const session = new AgentSession(agent);
    const seen: number[] = [];
    const { rerender } = renderHook(
      ({ tag }: { tag: number }) => useAgentEvent(agent, "run.completed", () => seen.push(tag)),
      { initialProps: { tag: 1 } },
    );
    rerender({ tag: 2 });
    await act(async () => {
      await session.send("Q");
    });
    expect(seen).toEqual([2]);
  });

  it("stops delivering after unmount", async () => {
    const agent = agentThatAnswers(1);
    const session = new AgentSession(agent);
    const seen: string[] = [];
    const { unmount } = renderHook(() =>
      useAgentEvent(agent, "run.completed", () => seen.push("done")),
    );
    unmount();
    await act(async () => {
      await session.send("Q");
    });
    expect(seen).toEqual([]);
  });
});
