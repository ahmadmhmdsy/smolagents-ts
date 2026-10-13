> **smolagents-ts is an unofficial TypeScript implementation of the smolagents approach,
> independently developed. It is not affiliated with, sponsored by, or endorsed by Hugging Face.
> "smolagents" and the Hugging Face marks belong to Hugging Face.**

# smolagents-ts

Agents that think in code, natively in TypeScript.

An agent whose action **is** a program: the model composes tools, control flow and intermediate
values in JavaScript, executed in a sandbox, and returns a final answer.

## Status

Pre-release. Scope is specified in [docs/design/2026-10-12-smolagents-ts-v1-design.md](docs/design/2026-10-12-smolagents-ts-v1-design.md).

## Install

Until the first release is on the registry, run the example in this repository:

    pnpm install
    pnpm example:node

The published name is `smolagents-ts`. The internal packages are published
beside it because its declarations name them; they are not the entry point, and
the README does not document them.

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

This is the body of [examples/node-script/index.mjs](examples/node-script/index.mjs), so
the snippet is code that runs. `MockModel` scripts the model, which is why the
snippet needs no provider and no key; swap it for an adapter from
`smolagents-ts/models` to talk to a provider.
## Licence

Apache-2.0. Derived from [smolagents](https://github.com/huggingface/smolagents); see [NOTICE](NOTICE).
