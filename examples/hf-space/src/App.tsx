import { useEffect, useState } from "react";
import { StyledChatSurface, StyledRunInspector } from "@smolagents-ts/react-ui";
import "../../../packages/react-ui/src/styles.css";
import {
  createLiveRun,
  createScriptedRun,
  DEFAULT_LIVE_TASK,
  LIVE_MODELS,
  SCRIPTED_TASK,
  type DemoRun,
} from "./agent.js";
import { clearSession, restoreSession, signIn, spaceOAuthAvailable, type HfSession } from "./auth.js";

const NO_COMPOSER = "This page shows the run's conversation; type a new task above instead.";

type Mode = "scripted" | "live";

export interface AppProps {
  /** Injected by tests; the page itself reads the Space's globals and session storage. */
  readonly initialSession?: HfSession | null;
  readonly oauthAvailable?: boolean;
  readonly createScripted?: () => DemoRun;
  readonly createLive?: typeof createLiveRun;
}

export function App(props: AppProps) {
  const createScripted = props.createScripted ?? createScriptedRun;
  const createLive = props.createLive ?? createLiveRun;
  const oauthAvailable = props.oauthAvailable ?? spaceOAuthAvailable();

  const [demo, setDemo] = useState<DemoRun>(() => createScripted());
  const [mode, setMode] = useState<Mode>("scripted");
  const [task, setTask] = useState(SCRIPTED_TASK);
  const [draft, setDraft] = useState(DEFAULT_LIVE_TASK);
  const [model, setModel] = useState<string>(LIVE_MODELS[0]);
  const [session, setSession] = useState<HfSession | null>(props.initialSession ?? null);
  const [authError, setAuthError] = useState<string | null>(null);

  // One executor serves one run, so replacing the run releases the realm the last one held.
  useEffect(() => () => void demo.executor.dispose(), [demo]);

  useEffect(() => {
    if (props.initialSession !== undefined) return;
    let cancelled = false;
    restoreSession()
      .then((restored) => {
        if (!cancelled && restored !== null) {
          setSession(restored);
          setMode("live");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setAuthError("Sign-in did not complete: " + String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [props.initialSession]);

  const runScripted = (): void => {
    setMode("scripted");
    setTask(SCRIPTED_TASK);
    setDemo(createScripted());
  };

  const runLive = (): void => {
    if (session === null) return;
    setMode("live");
    setTask(draft);
    setDemo(createLive({ accessToken: session.accessToken, model }));
  };

  const signOut = (): void => {
    clearSession();
    setSession(null);
    runScripted();
  };

  return (
    <main className="page">
      <header>
        <h1>smolagents-ts: a code agent in your browser tab</h1>
        <p>
          A <code>CodeAgent</code> from{" "}
          <a href="https://www.npmjs.com/package/smolagents-ts">smolagents-ts</a>, a TypeScript port of
          the <a href="https://github.com/huggingface/smolagents">smolagents</a> approach. The model
          writes JavaScript, which runs in a QuickJS sandbox compiled to WebAssembly, right here in
          the page. There is no server: the browser calls the model and the tools directly.
        </p>
        <p className="fineprint">
          Unofficial and independently developed; not affiliated with or endorsed by Hugging Face.{" "}
          <a href="https://github.com/ahmadmhmdsy/smolagents-ts">Source on GitHub</a>.
        </p>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2>Model</h2>
          {session !== null ? (
            <span className="who">
              Signed in as <strong>{session.username}</strong>{" "}
              <button type="button" onClick={signOut}>
                Sign out
              </button>
            </span>
          ) : null}
        </div>

        <div className="modes">
          <label>
            <input type="radio" name="mode" checked={mode === "scripted"} onChange={runScripted} />
            Scripted model: no sign-in, a real sandbox and a real Wikipedia call
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              checked={mode === "live"}
              disabled={session === null}
              onChange={() => setMode("live")}
            />
            A real model through Hugging Face Inference Providers
          </label>
        </div>

        {session === null ? (
          oauthAvailable ? (
            <p>
              <button type="button" className="run" onClick={() => void signIn()}>
                Sign in with Hugging Face
              </button>{" "}
              to give the agent a real model. Runs use <em>your</em> account's Inference Providers
              credits; the token stays in this tab.
            </p>
          ) : (
            <p className="note">
              Signing in works when this page runs as a Hugging Face Space. Here, only the scripted
              model is available.
            </p>
          )
        ) : null}
        {authError !== null ? <p className="note" role="alert">{authError}</p> : null}

        {mode === "live" && session !== null ? (
          <div className="live-task">
            <label htmlFor="live-model">Model</label>
            <select id="live-model" value={model} onChange={(event) => setModel(event.target.value)}>
              {LIVE_MODELS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <label htmlFor="live-task">Task</label>
            <textarea id="live-task" rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} />
            <button type="button" className="run" onClick={runLive} disabled={draft.trim() === ""}>
              Run
            </button>
          </div>
        ) : (
          <>
            <p className="task">{SCRIPTED_TASK}</p>
            <button type="button" className="run" onClick={runScripted}>
              Run it again
            </button>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>The run, step by step</h2>
        </div>
        <StyledRunInspector agent={demo.agent} task={task}>
          <StyledChatSurface disabledReason={NO_COMPOSER} />
        </StyledRunInspector>
      </section>
    </main>
  );
}
