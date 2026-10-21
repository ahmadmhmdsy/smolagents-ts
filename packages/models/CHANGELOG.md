# @smolagents-ts/models

## 0.1.0

### Minor Changes

- The first release of the adapters: an OpenAI-compatible client, Anthropic's Messages API
  with its `tool_use` and `tool_result` blocks and named stream events, Gemini's
  `generateContent` with its `alt=sse` stream, the Hugging Face Inference Providers router,
  and a model a caller defines with functions. All five are exported from the package
  barrel, each sits behind the core's `Model` interface, and the core imports none of them.

### Patch Changes

- Updated dependencies [5b0499b]
- Updated dependencies [4e058d8]
- Updated dependencies [d684e3e]
- Updated dependencies
  - @smolagents-ts/core@0.1.0
