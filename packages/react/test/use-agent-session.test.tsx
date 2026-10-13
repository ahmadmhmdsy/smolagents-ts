import { describe, expect, it } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { AgentSession, type AgentSessionSnapshot } from "@smolagents-ts/core";
import { useAgentSession } from "../src/session.js";
import { agentThatAnswers } from "./helpers.js";

describe("useAgentSession", () => {
  it("reads the idle snapshot before the run", () => {
    const session = new AgentSession(agentThatAnswers(1));
    const { result } = renderHook(() => useAgentSession(session));
    expect(result.current.status).toBe("idle");
    expect(result.current.steps).toEqual([]);
    expect(result.current.isRunning).toBe(false);
  });

  it("re-renders with the finished snapshot after send", async () => {
    const session = new AgentSession(agentThatAnswers(42));
    const { result } = renderHook(() => useAgentSession(session));
    await act(async () => {
      await session.send("Q");
    });
    expect(result.current.status).toBe("success");
    expect(result.current.output).toBe(42);
    expect(result.current.steps).toHaveLength(1);
  });

  it("hands back one snapshot object while nothing changes", () => {
    const session = new AgentSession(agentThatAnswers(1));
    const seen: AgentSessionSnapshot[] = [];
    const { rerender } = renderHook(() => {
      const snapshot = useAgentSession(session);
      seen.push(snapshot);
      return snapshot;
    });
    rerender();
    expect(seen.length).toBeGreaterThan(1);
    expect(seen[1]).toBe(seen[0]);
  });

  it("shares one run across two components reading the same session", async () => {
    const session = new AgentSession(agentThatAnswers(7));
    function Reader() {
      const snapshot = useAgentSession(session);
      return <span data-testid="status">{snapshot.status}</span>;
    }
    render(
      <>
        <Reader />
        <Reader />
      </>,
    );
    expect(screen.getAllByTestId("status").map((node) => node.textContent)).toEqual(["idle", "idle"]);
    await act(async () => {
      await session.send("Q");
    });
    expect(screen.getAllByTestId("status").map((node) => node.textContent)).toEqual(["success", "success"]);
  });
});
