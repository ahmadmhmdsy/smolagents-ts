# Component rule: cli

**The command line speaks for upstream, not around it.**
A flag, a default and a question keep the name and the meaning upstream's
`cli.py` gives them, or the divergence is named in the help text and in the
plan that owns the work. An unsupported model name is refused rather than
folded onto one this port implements.

**A refusal names the alternative.**
An unknown model type, tool name or action type produces a typed error whose
message carries the supported names. The run does not continue as if the name
had been understood.

**A key stays out of the output.**
The key arrives through `--api-key` or through the provider's environment
variable, and no renderer, error, log line or prompt carries its value. The
setup collects configuration, never a credential.

**The renderer is the only writer.**
Text reaches a stream through `src/renderer.ts` and the run function's `out`
and `err` sinks. A module that writes to the process directly is out of
bounds, so a test can collect a whole run.
