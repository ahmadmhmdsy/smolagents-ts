---
"@smolagents-ts/models": minor
---

Local runtime presets over `OpenAICompatibleModel`: `ollamaModel`, `lmStudioModel`,
`llamaCppModel` and `vllmModel`. Each defaults to its runtime's local address, needs no key, and
reports only the capabilities the runtime gives without extra flags. They start no process.
