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

    npm install smolagents-ts zod

`zod` is listed because your own code imports it to declare tool schemas, as the
quick start below does. To run the examples from this repository instead:

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
| to show a model an image or audio | `agent.run(parts)`, `withAttachments` | [examples/vision](examples/vision) |
| to declare your own tools | `tool()` with a zod schema | [examples/multi-step](examples/multi-step) |
| the built-in web tools | `duckDuckGoSearchTool`, `visitWebpageTool`, `userInputTool` | [examples/tool-calling](examples/tool-calling) |
| a run inspector in React | `AgentRun`, `RunInspector`, `useAgentSession` | [examples/vite-app](examples/vite-app) |
| a styled inspector with no design work | the layer over those primitives | [examples/vite-app](examples/vite-app) |
| a command line | `smolagent` | see below |

The other executors, the MCP client and the remote backends are described in
[docs/design/2026-10-12-smolagents-ts-v1-design.md](docs/design/2026-10-12-smolagents-ts-v1-design.md)
and their plans under [docs/plans/](docs/plans).

## Limits on a run

`limits` caps a run's turns, output tokens, total tokens and cost
(`maxCostUsd`, priced from `priceTable`; a model the table does not price is
never stopped by cost). A stopped run reports which limit it hit.

One gap to know before you rely on the cost cap across a restart: a run
resumed from its record re-counts turns and tokens from the steps it already
holds, but **its cost counter starts at zero**, because a step records tokens,
not a price. To keep one cost ceiling over a whole conversation, pass the same
`budget` handle (`createBudgetHandle`) to every run, including the resumed one.

## The command line

    npx @smolagents-ts/cli --help

With a prompt it runs an agent; with none it asks for the configuration and then
for the task:

    npx @smolagents-ts/cli "How many people live in Iceland?"

`--action-type` picks `code` (the default) or `tool_calling`, `--model-type` picks
`InferenceClientModel` (the default) or `OpenAIModel`, and the key comes from
`--api-key`, or from `HF_TOKEN` for the first and `OPENAI_API_KEY` for the second.
The port never prompts for a key. The command ships as its own package,
`@smolagents-ts/cli`; `npm install -g @smolagents-ts/cli` puts the `smolagent` bin on
your path, and from a checkout `node packages/cli/dist/main.js` is the same command.

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

## Images and audio

Check the model first. A part it cannot take is refused before any request:

```ts
if (!model.capabilities.images) throw new Error("pick a model that can see");

await agent.run([
  { type: "text", text: "What does this chart show?" },
  { type: "image", mediaType: "image/png", bytes, alt: "Monthly sales, 2026" },
]);
```

`agent.run` takes a string or a parts array, and a string behaves exactly as it
did. `alt` is for a person reading the transcript and never reaches the model;
`ChatSurface` shows a visible fallback when it is missing. A tool hands media
back with `withAttachments(text, parts)`: a `CodeAgent`'s program sees the text,
and the model sees the image on its next call.

| adapter | images | audio | what to know |
|---|---|---|---|
| `OpenAICompatibleModel` | yes | yes | a claim about the wire, not the route: a gateway or a local model can still refuse |
| `AnthropicModel` | yes | no | audio is refused even if you claim it; `detail` is not sent |
| `GeminiModel` | yes | yes | `image/gif` is refused, because the provider does not list it |
| `HuggingFaceModel` | yes | yes | inherited from the OpenAI wire, and the route decides |
| `CustomModel` | no | no | yours to claim through `capabilities` |

`capabilities` on any adapter overrides the defaults for a route you know better.
A part is limited to 5 MiB and a run to 20 MiB, both measured as encoded base64
and both changed through `mediaLimits`. Anthropic on Bedrock caps an image at
5 MB, just under the default, so set `maxPartBytes` lower there.

Memory holds references, so bytes stay out of events, checkpoints, traces and
`RunResult.messages`. A run that must resume in a new process needs a durable
`mediaStore`: the default lives in memory, and a run whose bytes are gone fails
with `AGENT_MEDIA_MISSING`. The framework never deletes from a store you pass.

Costs follow the transcript. Every image is resent on every step, and image
tokens are invisible to `estimatedTokens`, so read provider usage for the budget.

**Security.** An image is untrusted input: text inside it can carry instructions
the model may follow, and no guardrail here reads pixels, so a guardrail that
checks text sees none of it. Keep risky tools behind `withApproval` when a run
looks at images you do not control. The bytes are yours to own too: nothing here
scans, redacts or strips metadata, and a request sends them to the provider
whole. `ChatSurface` renders media as data URIs, so a page with a content
security policy needs `data:` in `img-src` and `media-src`.

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