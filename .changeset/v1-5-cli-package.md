---
"@smolagents-ts/cli": minor
---

Add the first v1.5 module: the command-line package.

`@smolagents-ts/cli` ports upstream `cli.py`'s argument surface and interactive
setup, maps its model and tool names onto this port's adapters, and renders the
core's event stream at three verbosity levels behind the `smolagent` bin.
