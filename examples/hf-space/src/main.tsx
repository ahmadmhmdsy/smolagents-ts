import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("the document has no #root element to mount into");
}

// No StrictMode: its development double-invoke would dispose a realm a live run still uses.
createRoot(container).render(<App />);
