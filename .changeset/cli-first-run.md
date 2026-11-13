---
"@smolagents-ts/cli": patch
---

`npx @smolagents-ts/cli "task"` now works on a clean machine. `@smolagents-ts/exec-quickjs`
moves from an optional peer to a dependency, because npx installs no optional peer and the
default `code` action failed with `MissingExecutorError`. The engine is still imported on
demand, so a `tool_calling` run does not load it. Adds `--version`, which prints
`smolagent <version>` and exits 0; upstream's `cli.py` has no such flag. The README now shows
the npm install instead of the pre-release checkout steps.
