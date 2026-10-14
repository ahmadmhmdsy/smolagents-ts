import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("the document has no #root element to mount into");
}

// Deliberately no StrictMode. Its development double-invoke mounts, unmounts and mounts again,
// and the effect that releases a one-run QuickJS realm would fire in the middle of that.
createRoot(container).render(<App />);
