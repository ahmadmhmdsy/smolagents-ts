import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("the document has no #root element to mount into");
}

// StrictMode is on: its development double-invoke is the cheapest test of the run-lifecycle
// effect. AgentRun cancels on a deferred timer and ignores the simulated unmount, and a second
// effect pass with the same session and task does not start a second run.
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
