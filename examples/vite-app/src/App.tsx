import { useEffect, useState } from "react";
import { AgentRun, AgentStep } from "smolagents-ts/react";
import { createDemoRun, DEMO_TASK, type DemoRun } from "./agent.js";

/** The run, rendered from the layer's own primitives: a status, the steps, and the answer. */
function RunView({ demo }: { readonly demo: DemoRun }) {
  return (
    <AgentRun agent={demo.agent} task={DEMO_TASK}>
      <AgentRun.Status />
      <AgentRun.Steps>
        {(step) => (
          <AgentStep.Action step={step}>
            <AgentStep.Code />
            <AgentStep.ToolCalls />
            <AgentStep.Logs />
            <AgentStep.Observation />
          </AgentStep.Action>
        )}
      </AgentRun.Steps>
      <AgentRun.FinalAnswer />
      <AgentRun.Cancel />
    </AgentRun>
  );
}

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
          with <code>@smolagents-ts/react</code>. The model is scripted, so this page needs no
          provider, no key and no network: the sandbox is the only live part.
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
        <RunView demo={demo} />
      </section>
    </main>
  );
}
