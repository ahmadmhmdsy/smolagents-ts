import { useEffect, useState } from "react";
import type { ChatMessage } from "smolagents-ts";
import { StyledChatSurface, StyledRunInspector } from "@smolagents-ts/react-ui";
import "../../../packages/react-ui/src/styles.css";
import { createDemoRun, DEMO_TASK } from "./agent.js";

/**
 * The transcript the styled chat surface renders, fixed on purpose. The page hands the surface
 * no `onSubmit`, so its composer stays disabled and says why: the session exposes no live
 * message list (the run's steps are not a chat history), so the transcript is authored here.
 */
const TRANSCRIPT: readonly ChatMessage[] = [
  { role: "user", content: DEMO_TASK },
  { role: "assistant", content: "Hello, world!" },
];

const NO_COMPOSER = "This page fixes the transcript, so there is nothing to send.";

export function App() {
  const [demo, setDemo] = useState(createDemoRun);

  // One executor serves one run, so replacing the run releases the realm the previous one
  // held. The cleanup runs when the demo changes and on unmount, never before a first run —
  // which is why this page is not wrapped in StrictMode: its development double-invoke would
  // dispose a realm a live run is still using.
  useEffect(() => () => void demo.executor.dispose(), [demo]);

  return (
    <main className="page">
      <header>
        <h1>smolagents-ts in a browser tab</h1>
        <p>
          A <code>CodeAgent</code> whose programs run in the real QuickJS executor, rendered
          with <code>@smolagents-ts/react</code> and <code>@smolagents-ts/react-ui</code>. The
          model is scripted, so this page needs no provider, no key and no network: the sandbox
          is the only live part.
        </p>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2>Run</h2>
          <button type="button" onClick={() => setDemo(createDemoRun())}>
            Run it again
          </button>
        </div>
        <p className="task">{DEMO_TASK}</p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Styled layers</h2>
        </div>
        {/*
          One run, rendered once. A second <AgentRun> over the same scripted agent would create
          a second session and exhaust the two scripted turns, so the styled inspector is the
          run's only host; the chat surface reads the same run's snapshot through it.
        */}
        <StyledRunInspector agent={demo.agent} task={DEMO_TASK}>
          <StyledChatSurface messages={TRANSCRIPT} disabledReason={NO_COMPOSER} />
        </StyledRunInspector>
      </section>
    </main>
  );
}
