---
"@smolagents-ts/models-gateway": minor
---

New package: a model reached through an OpenAI-compatible AI gateway such as OmniRoute (decision
0040). `GatewayModel` composes `OpenAICompatibleModel` and reads the gateway's response headers
through its injected `fetch`, reporting the serving provider, cost, cache result, fallback count
and routing decision through `onResponse`, once per completed request, with no state kept on the
model. `listGatewayModels` reads the gateway's `GET /models`. Tool calls are off until the caller
pins a tool-capable id. Isomorphic: it depends on the core and the models package alone.
