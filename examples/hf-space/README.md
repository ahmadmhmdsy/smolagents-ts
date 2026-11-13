# hf-space

A `CodeAgent` that runs entirely in a browser tab, packaged as a static Hugging
Face Space. There is no server: the page calls the model and the tool directly,
and the model's JavaScript runs in a QuickJS sandbox compiled to WebAssembly.

Two modes:

- **Scripted** (the default, no sign-in). `MockModel` plays the model's two
  turns. The sandbox is real, and the `wikipedia_summary` tool makes a real
  request to Wikipedia's REST summary API, which allows any origin.
- **Live**, after "Sign in with Hugging Face". The Space's OAuth app (README
  front matter `hf_oauth: true`, scope `inference-api`) hands the page the
  visitor's token, and `HuggingFaceModel` sends it to
  `router.huggingface.co`. Each run spends the visitor's own Inference
  Providers credits. The token lives in `sessionStorage` and dies with the tab.

Outside a Space there is no OAuth client id, so the page offers the scripted run
only and says why.

## Run it locally

    pnpm --filter example-hf-space run dev
    pnpm vitest run --project example-hf-space

## Stage it for a Space

    pnpm --filter example-hf-space run build
    pnpm --filter example-hf-space run space:stage

`space:stage` copies `dist/` and [`space/README.md`](space/README.md) (the Space
card and its front matter) into `space-dist/`, which is what gets uploaded to a
Space with `sdk: static`.
