import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { AgentSession } from "@smolagents-ts/core";
import { useAgentSession } from "../src/session.js";
import { agentThatAnswers } from "./helpers.js";

/**
 * React calls useSyncExternalStore's third argument, getServerSnapshot, whenever it renders on
 * the server. It has to be present (or the hook throws) and it has to return the initial
 * snapshot (or a session mid-run renders live state and hydrates against different HTML).
 */
describe("useAgentSession during server rendering", () => {
  it("renders the initial snapshot before any run", () => {
    const session = new AgentSession(agentThatAnswers(1));

    function Reader() {
      const snapshot = useAgentSession(session);
      return <span data-testid="status">{snapshot.status}</span>;
    }

    let html = "";
    expect(() => {
      html = renderToString(<Reader />);
    }).not.toThrow();
    expect(html).toContain("idle");
  });

  it("renders the initial snapshot for a session that is already running", async () => {
    const session = new AgentSession(agentThatAnswers(42));

    function Reader() {
      const snapshot = useAgentSession(session);
      return <span data-testid="status">{snapshot.status}</span>;
    }

    const running = session.send("Q");
    expect(session.getSnapshot().status).toBe("running");

    let html = "";
    expect(() => {
      html = renderToString(<Reader />);
    }).not.toThrow();
    expect(html).toContain("idle");
    expect(html).not.toContain("running");

    await running;
    expect(session.getSnapshot().status).toBe("success");
    expect(session.getServerSnapshot().status).toBe("idle");
  });
});
