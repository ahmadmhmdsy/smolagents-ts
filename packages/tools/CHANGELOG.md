# @smolagents-ts/tools

## 0.1.0

### Minor Changes

- 6542b8b: Add the tool ecosystem: `ToolCollection` for grouping tools and converting them to the
  core's registry, `htmlToText`, and the `userInputTool`, `duckDuckGoSearchTool` and
  `visitWebpageTool` defaults. The package now depends on `@smolagents-ts/core` for the
  `Tool` interface and `ToolContext`.
- The first release: an agent whose action is a program, in TypeScript.

  `smolagents-ts` is the package to install. It re-exports the runtime, the
  provider adapters, the default tools, the QuickJS executor and the React layer
  under one name, with React and the QuickJS engine as optional peers. The
  internal packages are published beside it because its declarations name them;
  they are not the documented entry point.

  This release is pre-1.0 and its API can move. It is an unofficial TypeScript
  implementation of the smolagents approach and is not affiliated with Hugging
  Face.

### Patch Changes

- Updated dependencies [5b0499b]
- Updated dependencies [4e058d8]
- Updated dependencies [d684e3e]
- Updated dependencies
  - @smolagents-ts/core@0.1.0
