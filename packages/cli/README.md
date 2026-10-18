# @smolagents-ts/cli

The command line over the agent loop: upstream `cli.py`'s argument surface and
interactive setup, mapped onto this port's model and tool adapters, with the run's
event stream rendered at three verbosity levels. The bin is named `smolagent`.

## Status

Pre-release. This package is at `0.0.0` and is not on the registry yet: the first
release is the project owner's gate, and the documented install name is
`smolagents-ts`. Until then, build it from a checkout and run the bin from the
tree:

    pnpm install
    pnpm --filter @smolagents-ts/cli run build
    node packages/cli/dist/main.js "Summarise what a code agent is."

The examples below use the installed bin name; from a checkout today, replace
`smolagent` with `node packages/cli/dist/main.js`.

## Usage

    smolagent [options] [prompt]

With no prompt, an interactive setup asks for the configuration and then for the
task.

| flag | default | meaning |
|---|---|---|
| `-h`, `--help` | — | print the help and exit 0 |
| `--model-type TYPE` | `InferenceClientModel` | `InferenceClientModel` or `OpenAIModel` |
| `--action-type TYPE` | `code` | `code` or `tool_calling` |
| `--model-id ID` | `Qwen/Qwen3-Next-80B-A3B-Thinking` | the model identifier |
| `--imports NAME ...` | empty | accepted for compatibility; the JavaScript executor has no import allow-list, so the names are echoed only |
| `--tools NAME ...` | `web_search` | the tools to load; `web_search` and `visit_webpage` are recognized |
| `--verbosity-level N` | `1` | `0` quiet, `1` default, `2` verbose |
| `--provider NAME` | — | the `InferenceClientModel` provider label |
| `--api-base URL` | — | the endpoint for `OpenAIModel` |
| `--api-key KEY` | — | the key; without it `HF_TOKEN` or `OPENAI_API_KEY` is read |

The interactive setup's default model id is `Qwen/Qwen2.5-Coder-32B-Instruct`,
which differs from the flag's default exactly as it does upstream.

## Examples

    # the default model type, through the Hugging Face Inference Providers router
    smolagent "What changed in the last two releases?"

    # any endpoint that copies OpenAI's chat-completions wire
    smolagent --model-type OpenAIModel --model-id gpt-4o-mini \
      --api-base https://api.openai.com/v1 "Explain a ReAct loop."

    # every event, including the model's code as it arrives
    smolagent --verbosity-level 2 "Write a function that reverses a string."

    # no prompt: the setup asks for the configuration and then the task
    smolagent

## Keys

A key reaches an adapter through `--api-key`, or, when that flag is absent,
through the variable the chosen provider documents: `HF_TOKEN` for
`InferenceClientModel`, `OPENAI_API_KEY` for `OpenAIModel`. Nothing in this
package prints a key, and the interactive setup never asks for one, because a
terminal echoes what is typed.

## What is refused

A name this port has no counterpart for is refused with a typed error that names
the alternatives, rather than folded onto an adapter that does exist:

- `LiteLLMModel` and `TransformersModel`, the two model types upstream's loader
  handles and this port does not;
- an action type other than `code` and `tool_calling`;
- a tool name outside the catalog, including upstream's Space-hosted tools, whose
  names carry a slash, and its Python interpreter tool.

Exit codes are `0` when the run completed or the help was asked for, `1` for a
refusal or a failed run, `2` for a command line the parser cannot read, and `130`
when the interactive setup ends before it is answered (stdin closed, or Ctrl+C).

## The programmatic surface

The bin is this package's main consumer, but everything it builds is exported, so
a host or a test can drive the same run without a terminal:

```ts
import {
  loadModel,
  loadTools,
  parseArguments,
  renderEvent,
  runSmolagent,
} from "@smolagents-ts/cli";
```

`parseArguments` reads argv into a `CliArguments`; `loadModel` builds an adapter
from a `ModelConfig` and resolves the key; `loadTools` builds the requested
defaults; `renderEvent` turns one `AgentEvent` into lines at a verbosity;
`runSmolagent` builds the agent, drains its stream and answers with the exit code.
Each error class carries the exit code its caller should use.

`@smolagents-ts/exec-quickjs` is an optional peer. The `code` action loads its
`QuickJSExecutor` when the caller supplied none, and an absent peer becomes a
`MissingExecutorError` rather than a silent fallback.

## Documentation

The repository's `docs/` tree is the documentation, and the published site is
https://ahmadmhmdsy.github.io/smolagents-ts/. This package's boundary is
`rules/components/cli.md`; its scoped entry is `packages/cli/AGENTS.md`.

## Licence

Apache-2.0; see `NOTICE`. Unofficial, and not affiliated with Hugging Face.
