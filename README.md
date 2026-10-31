> **smolagents-ts is an unofficial TypeScript implementation of the smolagents approach,
> independently developed. It is not affiliated with, sponsored by, or endorsed by Hugging Face.
> "smolagents" and the Hugging Face marks belong to Hugging Face.**

# smolagents-ts

Agents that think in code, natively in TypeScript.

An agent whose action **is** a program: the model composes tools, control flow and
intermediate values in JavaScript, executed in a sandbox, and returns a final
answer. The same loop runs on Node, Bun, Deno and in a browser tab, because the
core is isomorphic by contract.

**Try it in a browser, no install and no key:**
[the live demo](https://ahmadmhmdsy.github.io/smolagents-ts/example/index.html)
runs an agent in the real sandbox and renders the run as typed steps.

## Install

Until 0.1.0 is on the registry, run it from this repository:

    pnpm install
    pnpm build
    pnpm example:node

That last command runs a complete agent — a real sandbox, a real tool, and a
scripted model, so it needs no provider and no key.

The published name is `smolagents-ts`. Its five entries re-export the internal
packages below, so one install carries them and every declaration resolves. The
Pyodide and remote executors, MCP, the CLI and `react-ui` are separate installs:

| entry | what it carries |
|---|---|
| `smolagents-ts` | the runtime: the agents, the loop, memory and steps, the event stream, the errors, the tool and executor interfaces |
| `smolagents-ts/models` | the provider adapters |
| `smolagents-ts/tools` | the built-in tools |
| `smolagents-ts/exec/quickjs` | the sandbox the agent's programs run in |
| `smolagents-ts/react` | the React layer over a run |

## Quick start

```ts
import { CODE_FENCE, CodeAgent, MockModel, tool } from "smolagents-ts";
import { QuickJSExecutor } from "smolagents-ts/exec/quickjs";
import { z } from "zod";

const greet = tool({
  name: "greet",
  description: "Greet one person by name.",
  inputSchema: z.object({ name: z.string() }),
  execute: ({ name }) => "Hello, " + name + "!",
});

const program = 'const message = await greet({ name: "world" });\nfinal_answer(message);';
const model = new MockModel([
  "Thought: greet the caller, then answer with the greeting.\nCode:\n" +
    CODE_FENCE + "\n" + program + "\n" + CODE_FENCE,
]);

const executor = new QuickJSExecutor();
try {
  const agent = new CodeAgent({ model, executor, tools: [greet] });
  const result = await agent.run("Greet the world.");
  console.log(result.output);
} finally {
  await executor.dispose();
}
```

This is the body of [examples/node-script/index.mjs](examples/node-script), so the
snippet is code that runs. `MockModel` scripts the model, which is why it needs
no key; swap it for an adapter from `smolagents-ts/models` to talk to a provider.

## What an agent does here

A run is not a chat. The model answers with a **thought** and a **program**; the
program runs in a sandbox and calls the tools you declared; whatever it prints
comes back as an observation; the loop repeats until the program calls
`final_answer(...)` or the step budget ends.

Every turn is a typed step — `TaskStep`, `SystemPromptStep`, `PlanningStep`,
`ActionStep`, `FinalAnswerStep` — and every transition is an event. That is what
makes the process renderable rather than reconstructable: a UI shows the steps a
run actually took, in order, with the code and the result beside them.

## What you can build

| you want | use | runnable |
|---|---|---|
| an agent that writes code | `CodeAgent` | [examples/node-script](examples/node-script) |
| an agent that calls tools as JSON | `ToolCallingAgent` | [examples/tool-calling](examples/tool-calling) |
| a run you can read back afterwards | the typed step list | [examples/multi-step](examples/multi-step) |
| to watch a run while it happens | `Monitor`, `AgentEvent`, `AgentSession` | [examples/events](examples/events) |
| to talk to a real provider | `GeminiModel`, `OpenAICompatibleModel`, `AnthropicModel`, `HuggingFaceModel`, `CustomModel` | [examples/live-provider](examples/live-provider) |
| to declare your own tools | `tool()` with a zod schema | [examples/multi-step](examples/multi-step) |
| the built-in web tools | `duckDuckGoSearchTool`, `visitWebpageTool`, `userInputTool` | [examples/tool-calling](examples/tool-calling) |
| a run inspector in React | `AgentRun`, `RunInspector`, `useAgentSession` | [examples/vite-app](examples/vite-app) |
| a styled inspector with no design work | the layer over those primitives | [examples/vite-app](examples/vite-app) |
| a command line | `smolagent` | see below |

The other executors, the MCP client and the remote backends are described in
[docs/design/2026-10-12-smolagents-ts-v1-design.md](docs/design/2026-10-12-smolagents-ts-v1-design.md)
and their plans under [docs/plans/](docs/plans).

## The command line

    pnpm build
    node packages/cli/dist/main.js --help

With a prompt it runs an agent; with none it asks for the configuration and then
for the task:

    node packages/cli/dist/main.js "How many people live in Iceland?"

`--action-type` picks `code` (the default) or `tool_calling`, `--model-type` picks
`InferenceClientModel` (the default) or `OpenAIModel`, and the key comes from
`--api-key`, or from `HF_TOKEN` for the first and `OPENAI_API_KEY` for the second.
The port never prompts for a key. The command ships as its own package, so the
invocation above is the repository one.

## Gateways and proxies

`OpenAICompatibleModel` speaks the chat-completions wire, so a gateway or a proxy
is a base URL and a model id, not a new adapter:

```ts
import { OpenAICompatibleModel } from "smolagents-ts/models";
const model = new OpenAICompatibleModel({ model: "auto", baseUrl: "http://localhost:20128/v1" });
```

The CLI reaches the same gateway: `--model-type OpenAIModel` with
`--api-base http://localhost:20128/v1`, `--model-id auto` and, only when the
gateway requires one, `--api-key`. A gateway that runs with `REQUIRE_API_KEY=false`
accepts no key at all and **must stay bound to localhost**. In a browser tab the
gateway must allow the page's origin: cross-origin requests are denied by default,
and a hosted page should go through a same-origin dev-server proxy rather than a
widened gateway. A gateway can also route `auto` per request, so pin one model id
when a run must be reproducible. The full procedure, with verification and failure
modes, is [the gateway runbook](docs/10-runbooks/gateway-through-openai-compatible.md).

## In the browser

    pnpm --filter example-vite-app run dev

[examples/vite-app](examples/vite-app) renders a `CodeAgent` run with the React
layer while the model's program executes in the same QuickJS sandbox the Node
example uses. Its model is scripted by default, so the page needs no key, and
its dev server adds a **live Gemini** mode: type a task and a real model solves
it, with the key held by the dev server and never sent to the browser. The same
build is published as
[the live demo](https://ahmadmhmdsy.github.io/smolagents-ts/example/index.html).

## Documentation

This repository keeps its own context pack, and the site publishes it:

- [docs/01-project.md](docs/01-project.md) — what the project is, and what it is not.
- [docs/design/2026-10-12-smolagents-ts-v1-design.md](docs/design/2026-10-12-smolagents-ts-v1-design.md) — the design record.
- [docs/03-handoff.md](docs/03-handoff.md) — where the work stands right now.
- [docs/04-tasks.md](docs/04-tasks.md) — what is next.
- [docs/06-glossary.md](docs/06-glossary.md) — the vocabulary, including the upstream terms this port keeps.

For building on or contributing to the repository itself, read
[AGENTS.md](AGENTS.md) first: it is the entry point to the rules, the plans and
the one command that proves a change.

## Status

Pre-release, and not yet on the registry — see
[docs/04-tasks.md](docs/04-tasks.md) for the publish task and its gate. Scope is
specified in
[docs/design/2026-10-12-smolagents-ts-v1-design.md](docs/design/2026-10-12-smolagents-ts-v1-design.md).

What the test suite proves and does not prove is recorded rather than implied:
the unit tests drive injected transports against recorded fixtures, so a green
suite says nothing about a live provider, a real Docker or E2B daemon, or a
browser. The checks that do reach those are the runbooks under
[docs/10-runbooks/](docs/10-runbooks).

## Working on this repository

    pnpm install
    pnpm gate

`pnpm gate` is the one command that proves a change: it typechecks, lints,
enforces the dependency boundaries, runs the test suite, builds every package,
checks the packed tarballs, and builds the site. Each step is also available on
its own — `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm site:build` — and one
project's tests run with `pnpm vitest run --project core`.

The repository also keeps a context pack, and its consistency is checked with
Python:

    python scripts/validate_context.py --root .

Where things live:

| directory | holds |
|---|---|
| `packages/` | the library, one package per component |
| `examples/` | the runnable examples this README links |
| `apps/docs-site/` | the site that publishes `docs/` and the browser example |
| `docs/` | the project's records: design, plans, reports, decisions, runbooks |
| `rules/`, `SOUL.md`, `AGENTS.md` | the pack that governs how the work is done |

[AGENTS.md](AGENTS.md) is the entry point to that pack, and
[docs/10-runbooks/gate.md](docs/10-runbooks/gate.md) explains the gate step by
step.

## Licence

Apache-2.0. Derived from [smolagents](https://github.com/huggingface/smolagents); see [NOTICE](NOTICE).