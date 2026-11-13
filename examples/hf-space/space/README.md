---
title: smolagents-ts code agent
emoji: 🧩
colorFrom: yellow
colorTo: indigo
sdk: static
app_file: index.html
pinned: false
license: apache-2.0
short_description: A code agent in TypeScript, sandboxed in your browser tab
hf_oauth: true
hf_oauth_scopes:
  - inference-api
---

# smolagents-ts: a code agent in your browser tab

A `CodeAgent` from [smolagents-ts](https://www.npmjs.com/package/smolagents-ts), a TypeScript
port of the [smolagents](https://github.com/huggingface/smolagents) approach. The model writes
JavaScript, which runs in a QuickJS sandbox compiled to WebAssembly, inside the page. There is
no backend: the browser calls the model and the tools directly.

- **Without signing in**, a scripted model drives a real run: real sandbox, real Wikipedia call.
- **Signed in with Hugging Face**, the agent uses a real model through Inference Providers,
  billed to your own account's credits. The token stays in your browser tab.

```bash
npm install smolagents-ts zod
```

Source: [examples/hf-space](https://github.com/ahmadmhmdsy/smolagents-ts/tree/main/examples/hf-space).
Unofficial and independently developed; not affiliated with or endorsed by Hugging Face.
