# @smolagents-ts/cli

## 0.1.1

### Patch Changes

- c6851db: `npx @smolagents-ts/cli "task"` now works on a clean machine. `@smolagents-ts/exec-quickjs`
  moves from an optional peer to a dependency, because npx installs no optional peer and the
  default `code` action failed with `MissingExecutorError`. The engine is still imported on
  demand, so a `tool_calling` run does not load it. Adds `--version`, which prints
  `smolagent <version>` and exits 0; upstream's `cli.py` has no such flag. The README now shows
  the npm install instead of the pre-release checkout steps.

## 0.1.0

### Minor Changes

- Warn on stderr about `--api-key` on the command line and about `--api-base` on the default model type, which sends `HF_TOKEN` to that endpoint.

- cecec7a: Add the first v1.5 module: the command-line package.

  `@smolagents-ts/cli` ports upstream `cli.py`'s argument surface and interactive
  setup, maps its model and tool names onto this port's adapters, and renders the
  core's event stream at three verbosity levels behind the `smolagent` bin.
