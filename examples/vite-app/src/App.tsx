import { useEffect, useState } from "react";
import type { ChatMessage } from "smolagents-ts";
import { StyledChatSurface, StyledRunInspector } from "@smolagents-ts/react-ui";
import "../../../packages/react-ui/src/styles.css";
import {
  createDemoRun,
  createLiveRun,
  DEFAULT_LIVE_MODEL,
  DEMO_TASK,
  LIVE_BASE_PATH,
  type DemoRun,
} from "./agent.js";

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

/** What the dev server reports about the live mode. It never reports the key. */
interface LiveInfo {
  readonly available: boolean;
  readonly model: string;
}

type Mode = "scripted" | "live";

export function App() {
  const [demo, setDemo] = useState<DemoRun>(createDemoRun);
  const [mode, setMode] = useState<Mode>("scripted");
  const [task, setTask] = useState(DEMO_TASK);
  const [draft, setDraft] = useState(DEMO_TASK);
  const [live, setLive] = useState<LiveInfo | null>(null);

  // One executor serves one run, so replacing the run releases the realm the previous one
  // held. The cleanup runs when the demo changes and on unmount, never before a first run —
  // which is why this page is not wrapped in StrictMode: its development double-invoke would
  // dispose a realm a live run is still using.
  useEffect(() => () => void demo.executor.dispose(), [demo]);

  // The dev server answers this and a static build does not, so the live mode offers itself
  // only where it can work. A refused or unparsable probe is the expected answer on a static
  // host, not an error, so it lands in the same state as an explicit "unavailable".
  useEffect(() => {
    let cancelled = false;
    const settle = (info: LiveInfo): void => {
      if (!cancelled) setLive(info);
    };
    fetch("/api/live")
      .then((response) => (response.ok ? (response.json() as Promise<LiveInfo>) : null))
      .then((info) => settle(info ?? { available: false, model: DEFAULT_LIVE_MODEL }))
      .catch(() => settle({ available: false, model: DEFAULT_LIVE_MODEL }));
    return () => {
      cancelled = true;
    };
  }, []);

  const startScripted = (): void => {
    setMode("scripted");
    setTask(DEMO_TASK);
    setDemo(createDemoRun());
  };

  const startLive = (): void => {
    setMode("live");
    setTask(draft);
    setDemo(
      createLiveRun({
        baseUrl: new URL(LIVE_BASE_PATH, window.location.href).href,
        model: live?.model,
      }),
    );
  };

  const liveReady = live?.available === true;

  return (
    <main className="page">
      <header>
        <h1>smolagents-ts in a browser tab</h1>
        <p>
          {mode === "live" ? (
            <>
              A <code>CodeAgent</code> on a live Gemini model. Its programs still run in the real
              QuickJS executor and render with <code>@smolagents-ts/react</code> and{" "}
              <code>@smolagents-ts/react-ui</code>; the dev server holds the key and forwards each
              request, so the browser never sees it.
            </>
          ) : (
            <>
              A <code>CodeAgent</code> whose programs run in the real QuickJS executor, rendered
              with <code>@smolagents-ts/react</code> and <code>@smolagents-ts/react-ui</code>. The
              model is scripted, so this page needs no provider, no key and no network: the sandbox
              is the only live part.
            </>
          )}
        </p>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2>Model</h2>
        </div>
        <div className="modes">
          <label>
            <input
              type="radio"
              name="mode"
              checked={mode === "scripted"}
              onChange={startScripted}
            />
            Scripted — no key, no network
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              checked={mode === "live"}
              disabled={!liveReady}
              onChange={startLive}
            />
            Live Gemini
            {liveReady ? " (" + live.model + ")" : " — needs GOOGLE_API_KEY in the root .env"}
          </label>
        </div>

        {mode === "live" ? (
          <div className="live-task">
            <label htmlFor="live-task">Task</label>
            <textarea
              id="live-task"
              rows={3}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="button" className="run" onClick={startLive} disabled={draft.trim() === ""}>
              Run
            </button>
          </div>
        ) : (
          <>
            <p className="task">{DEMO_TASK}</p>
            <button type="button" className="run" onClick={startScripted}>
              Run it again
            </button>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Styled layers</h2>
        </div>
        {/*
          One run, rendered once. A second <AgentRun> over the same agent would create a second
          session — and a scripted one would exhaust its two turns — so the styled inspector is
          the run's only host; the chat surface reads the same run's snapshot through it.
        */}
        <StyledRunInspector agent={demo.agent} task={task}>
          <StyledChatSurface messages={TRANSCRIPT} disabledReason={NO_COMPOSER} />
        </StyledRunInspector>
      </section>
    </main>
  );
}
