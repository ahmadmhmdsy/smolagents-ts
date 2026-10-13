---
"@smolagents-ts/models": minor
---

Add the Anthropic, Gemini and Hugging Face adapters: the Messages API with its
`tool_use` and `tool_result` blocks and named stream events, `generateContent`
with its `alt=sse` stream, and the Inference Providers router built as a
subclass of the OpenAI-compatible adapter. All five adapters are exported from
the package barrel.
