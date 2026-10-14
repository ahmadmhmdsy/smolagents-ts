import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "exec-remote",
    // One file per backend. The process suite spawns a real interpreter, the Docker suite a
    // loopback HTTP/WebSocket server and an injected Engine API double, and the E2B suite a
    // doubled vendor client: no daemon and no credential is reached, so fileParallelism is
    // safe to leave at its default.
  },
  resolve: {
    // Resolve core to its source, because the gate runs this project before any build exists:
    // the workspace link in node_modules points at a dist/ that is not there yet.
    alias: {
      "@smolagents-ts/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
    },
  },
});
