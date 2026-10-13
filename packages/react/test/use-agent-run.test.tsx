import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { RunResult } from "@smolagents-ts/core";
import { useAgentRun } from "../src/use-agent-run.js";
import { agentThatAnswers } from "./helpers.js";

describe("useAgentRun", () => {
  it("exposes a session and the idle snapshot", () => {
    const { result } = renderHook(() => useAgentRun(agentThatAnswers(1)));
    expect(result.current.snapshot.status).toBe("idle");
    expect(result.current.session.getSnapshot().status).toBe("idle");
  });

  it("runs the task and resolves with the run result", async () => {
    const agent = agentThatAnswers(5);
    const { result } = renderHook(() => useAgentRun(agent));
    let outcome: RunResult<unknown> | undefined;
    await act(async () => {
      outcome = await result.current.run("Q");
    });
    expect(outcome?.output).toBe(5);
    expect(result.current.snapshot.status).toBe("success");
    expect(result.current.snapshot.output).toBe(5);
  });

  it("resets the store back to idle", async () => {
    const agent = agentThatAnswers(1);
    const { result } = renderHook(() => useAgentRun(agent));
    await act(async () => {
      await result.current.run("Q");
    });
    expect(result.current.snapshot.status).toBe("success");
    act(() => {
      result.current.reset();
    });
    expect(result.current.snapshot.status).toBe("idle");
  });

  it("keeps one session per agent identity", () => {
    const agent = agentThatAnswers(1);
    const { result, rerender } = renderHook(({ value }) => useAgentRun(value), {
      initialProps: { value: agent },
    });
    const first = result.current.session;
    rerender({ value: agent });
    expect(result.current.session).toBe(first);
    rerender({ value: agentThatAnswers(2) });
    expect(result.current.session).not.toBe(first);
  });
});
