> **smolagents-ts is an unofficial TypeScript implementation of the smolagents approach,
> independently developed. It is not affiliated with, sponsored by, or endorsed by Hugging Face.
> "smolagents" and the Hugging Face marks belong to Hugging Face.**

# smolagents-ts

Agents that think in code, natively in TypeScript.

An agent whose action **is** a program: the model composes tools, control flow and
intermediate values in JavaScript, executed in a sandbox, and returns a final
answer. The same loop runs on Node, Bun, Deno and in a browser tab, because the
core is isomorphic by contract.

    npm install smolagents-ts

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

`MockModel` scripts the model, so this needs no provider and no key. Swap it for
an adapter from `smolagents-ts/models` — `GeminiModel`, `OpenAICompatibleModel`,
`AnthropicModel`, `HuggingFaceModel` or your own `CustomModel` — to talk to a
provider.

## What one install carries

This is the package a caller installs. Each of its entries re-exports the package
that implements it, so a single install carries the whole stack and every
declaration resolves:

| entry | carries |
|---|---|
| `smolagents-ts` | the runtime: the agents, the loop, memory and typed steps, the event stream, the errors, the tool and executor interfaces |
| `smolagents-ts/models` | the provider adapters |
| `smolagents-ts/tools` | the built-in tools |
| `smolagents-ts/exec/quickjs` | the sandbox the agent's programs run in |
| `smolagents-ts/react` | the React layer over a run |

A run is not a chat. The model answers with a thought and a program; the program
runs in the sandbox and calls the tools you declared; what it prints comes back
as an observation; the loop repeats until the program calls `final_answer(...)`
or the step budget ends. Every turn is a typed step — `TaskStep`,
`SystemPromptStep`, `PlanningStep`, `ActionStep`, `FinalAnswerStep` — so a UI
renders the process instead of reconstructing it.

## Documentation

The repository is the manual, and it carries runnable examples for the code
agent, the tool-calling agent, multi-step runs, the event stream and a live
provider:

<https://github.com/ahmadmhmdsy/smolagents-ts>

The design record, the plans and the current status are in the same repository
under `docs/`.

## Licence

Apache-2.0. Derived from [smolagents](https://github.com/huggingface/smolagents);
see the NOTICE file in this package.
