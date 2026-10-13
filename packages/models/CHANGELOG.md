# @smolagents-ts/models

## 0.1.0

### Minor Changes

- 5defdce: Add the Anthropic, Gemini and Hugging Face adapters: the Messages API with its
  `tool_use` and `tool_result` blocks and named stream events, `generateContent`
  with its `alt=sse` stream, and the Inference Providers router built as a
  subclass of the OpenAI-compatible adapter. All five adapters are exported from
  the package barrel.
- The first release of the adapters: an OpenAI-compatible client, Anthropic's Messages API
  with its tool blocks, Gemini's streaming `generateContent`, the Hugging Face Inference
  Providers router, and a model a caller defines with functions. Each sits behind the
  core's `Model` interface and none of them is imported by it.

### Patch Changes

- Updated dependencies [5b0499b]
- Updated dependencies [4e058d8]
- Updated dependencies [d684e3e]
- Updated dependencies
  - @smolagents-ts/core@0.1.0
