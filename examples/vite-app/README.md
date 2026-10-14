# example-vite-app

A browser app that runs a `CodeAgent` and renders the run with
`@smolagents-ts/react`. The executor is always the real QuickJS-WASM one, so the
code in the middle is really sandboxed JavaScript.

    pnpm install
    pnpm --filter example-vite-app run dev

`pnpm --filter example-vite-app run build` writes `dist/`, and
`pnpm vitest run --project example-vite-app` runs the tests. Nothing here is
published; the app imports the workspace's packages through their published
names, and `vite.config.ts` maps those names to the packages' sources so a fresh
clone can start without building the workspace first.

## Two modes

**Scripted** is the default and needs nothing: a `MockModel` plays two turns, so
the page works offline, in a static build, and in the test suite.

**Live Gemini** lets you type a task and watch a real model solve it. The dev
server reads `GOOGLE_API_KEY` (or `GEMINI_API_KEY`) from the repository's root
`.env` and forwards each request to Gemini with the key attached; the page calls
its own origin at `/api/gemini`, so **the key never enters the browser bundle**.
`GEMINI_MODEL` overrides the model id, which defaults to `gemini-3.5-flash-lite`.

The live mode offers itself only where the dev server can answer `/api/live`, so
a static build shows it disabled instead of failing at the first request.

The live tool set is deliberately local — `greet` and `add` — because a browser
request to a search or scrape endpoint would have to clear CORS first. Live mode
exercises the loop, the sandbox and the tool bridge; it does not test the network.

## Pointing the page at another provider

Change the adapter in `src/agent.ts` and keep the executor. The key is the part
that matters: anything bundled into a browser build is public, so a deployment
that uses a real provider calls it from its own server and points the adapter at
that endpoint rather than shipping a key to the page — which is exactly what the
dev-server proxy here does.
