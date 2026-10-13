---
"@smolagents-ts/tools": minor
---

Add the tool ecosystem: `ToolCollection` for grouping tools and converting them to the
core's registry, `htmlToText`, and the `userInputTool`, `duckDuckGoSearchTool` and
`visitWebpageTool` defaults. The package now depends on `@smolagents-ts/core` for the
`Tool` interface and `ToolContext`.
