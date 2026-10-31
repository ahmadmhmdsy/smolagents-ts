# @smolagents-ts/cli

## 0.1.0

### Minor Changes

- Warn on stderr about `--api-key` on the command line and about `--api-base` on the default model type, which sends `HF_TOKEN` to that endpoint.

- cecec7a: Add the first v1.5 module: the command-line package.

  `@smolagents-ts/cli` ports upstream `cli.py`'s argument surface and interactive
  setup, maps its model and tool names onto this port's adapters, and renders the
  core's event stream at three verbosity levels behind the `smolagent` bin.
