---
"@smolagents-ts/exec-quickjs": minor
"@smolagents-ts/core": patch
---

Add the QuickJS code executor: `QuickJSExecutor` runs agent-authored JavaScript in a
QuickJS-WASM realm, bridges awaited host tool calls through the engine's job queue, and
reports an explicit capability set. The core gains a `releaseResources` hook that runs when
a run ends — on success, on failure and when a consumer stops reading — and `CodeAgent`
uses it to release its executor. A failed code step's observation now carries the error
text, so the model reads why a step failed instead of an empty observation.
