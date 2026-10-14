# example-vite-app

A browser app that runs a `CodeAgent` and renders the run with
`@smolagents-ts/react`. The model is scripted and the executor is the real
QuickJS-WASM one, so the page needs no provider, no key and no network: the
sandbox is the only live part.

    pnpm install
    pnpm --filter example-vite-app run dev

`pnpm --filter example-vite-app run build` writes `dist/`, and
`pnpm vitest run --project example-vite-app` runs the two tests. Nothing here is
published; the app imports the workspace's packages through their published
names, and `vite.config.ts` maps those names to the packages' sources so a fresh
clone can start without building the workspace first.

## Running a real model

`src/agent.ts` builds the model; swap `MockModel` for an adapter from
`smolagents-ts/models` and keep the executor. The key is the part that matters
here: anything bundled into a browser build is public, so a deployment that uses
a real provider calls it from its own server and points the adapter at that
endpoint rather than shipping a key to the page.
