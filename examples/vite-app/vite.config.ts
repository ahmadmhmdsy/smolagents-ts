import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from "vite";

const at = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

/** Where the live mode's requests are forwarded, with the key attached on this side. */
const GEMINI_UPSTREAM = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Reports whether the live mode can run. It answers with the model id and never with the key,
 * so the page can offer the mode without the browser ever holding a credential.
 */
function liveStatus(available: boolean, model: string): Plugin {
  return {
    name: "smolagents-live-status",
    configureServer(server) {
      server.middlewares.use("/api/live", (_request, response) => {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ available, model }));
      });
    },
  };
}

/**
 * True for a request the page itself could have sent. The proxy adds a key, so a request from
 * any other site open in the same browser must not reach it; a browser marks those, and a
 * caller with no browser headers is a local tool that can read the .env anyway.
 */
export function isSameOriginRequest(headers: {
  origin?: string | undefined;
  host?: string | undefined;
  "sec-fetch-site"?: string | string[] | undefined;
}): boolean {
  const site = headers["sec-fetch-site"];
  if (site !== undefined && site !== "same-origin" && site !== "none") return false;
  if (headers.origin === undefined) return true;
  try {
    return new URL(headers.origin).host === headers.host;
  } catch {
    return false;
  }
}

// The example consumes the published names, so the dev server and the build map them to the
// sources the packages build from: a fresh clone has no dist/ yet, and the whole point of this
// page is that a reader can start it without building the workspace first.
//
// base is relative so the same build works from a project path as well as from a domain root.
export default defineConfig(({ mode }) => {
  // The repository keeps its key in the root .env. Vite copies only VITE_-prefixed variables
  // into the client bundle, and this file reads the rest here, on the server: the proxy adds
  // the key to the request it forwards, so the key reaches no browser.
  const env = loadEnv(mode, at("../../"), "");
  const apiKey = env.GOOGLE_API_KEY ?? env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

  // A missing key is not an error: the scripted run needs none, so the page still starts and
  // the live mode reports itself unavailable instead of failing at the first request.
  const proxy: Record<string, ProxyOptions> =
    apiKey === undefined
      ? {}
      : {
          "/api/gemini": {
            target: GEMINI_UPSTREAM,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/api\/gemini/, ""),
            headers: { "x-goog-api-key": apiKey },
            // False answers 404 before anything is forwarded.
            bypass: (request) => (isSameOriginRequest(request.headers) ? undefined : false),
          },
        };

  return {
    base: "./",
    plugins: [react(), liveStatus(apiKey !== undefined, model)],
    // The QuickJS variant locates its engine with
    // `new URL("emscripten-module.wasm", import.meta.url)`. Pre-bundling moves that module
    // into node_modules/.vite/deps, where the relative URL names a file the dev server does
    // not have: it answers with index.html, and the executor aborts on the first step. Keeping
    // the package out of the pre-bundle leaves the module where its own URL is correct, so the
    // same transform that already rewrites it for the build runs in dev too.
    optimizeDeps: { exclude: ["@jitl/quickjs-wasmfile-release-sync"] },
    server: { proxy },
    preview: { proxy },
    resolve: {
      alias: [
        { find: /^smolagents-ts$/, replacement: at("../../packages/core/src/index.ts") },
        { find: /^smolagents-ts\/models$/, replacement: at("../../packages/models/src/index.ts") },
        { find: /^smolagents-ts\/tools$/, replacement: at("../../packages/tools/src/index.ts") },
        { find: /^smolagents-ts\/exec\/quickjs$/, replacement: at("../../packages/exec-quickjs/src/index.ts") },
        { find: /^smolagents-ts\/react$/, replacement: at("../../packages/react/src/index.ts") },
        // The sources above import each other by package name, so the internal names need the
        // same mapping: without them the executor's first import resolves to a dist/ that a
        // fresh checkout does not have, and this page is supposed to start without one.
        { find: /^@smolagents-ts\/core$/, replacement: at("../../packages/core/src/index.ts") },
        { find: /^@smolagents-ts\/models$/, replacement: at("../../packages/models/src/index.ts") },
        { find: /^@smolagents-ts\/tools$/, replacement: at("../../packages/tools/src/index.ts") },
        { find: /^@smolagents-ts\/exec-quickjs$/, replacement: at("../../packages/exec-quickjs/src/index.ts") },
        // The styled package's name extends the headless one, so its entry is written first:
        // the shorter prefix must not win the match.
        { find: /^@smolagents-ts\/react-ui$/, replacement: at("../../packages/react-ui/src/index.ts") },
        { find: /^@smolagents-ts\/react$/, replacement: at("../../packages/react/src/index.ts") },
      ],
    },
  };
});
