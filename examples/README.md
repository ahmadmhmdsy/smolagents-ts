# Examples

Every example here runs offline. The model is scripted with `MockModel`, so
nothing needs a provider, a key or a network — except `live-provider` and
`gateway`, which print `SKIPPED` and exit 0 when their environment variable is
absent. The executors and the tools
are real in every one of them.

| example | what it shows | run it |
|---|---|---|
| [node-script](node-script) | the smallest complete run: one scripted step, one tool, a real QuickJS sandbox | `node index.mjs` |
| [multi-step](multi-step) | a `CodeAgent` that needs two steps, and the typed step list it leaves behind | `node index.mjs` |
| [tool-calling](tool-calling) | the same task driven the other way, by a `ToolCallingAgent` calling tools as JSON | `node index.mjs` |
| [events](events) | watching a run: every `AgentEvent` through `describeEvent`, and the `AgentSession` snapshot beside it | `node index.mjs` |
| [live-provider](live-provider) | a real provider: one plain completion, one streamed, then a `CodeAgent` in QuickJS | `node index.mjs` |
| [gateway](gateway) | the same three calls through a gateway's base URL, with a pinned model id and a redacted key | `node index.mjs` |
| [vite-app](vite-app) | the React layer in a browser tab, rendering a run as typed steps | `pnpm --filter example-vite-app run dev` |
| [supervisor](supervisor) | a supervisor that routes on typed child reports, one of them a schema failure | `node --experimental-strip-types src/index.ts` |

Each script exports a `main()` and calls it only when run directly, so its test
drives the same code the script does:

    pnpm vitest run --project example-multi-step

## Reading them in order

`multi-step` and `tool-calling` are the same task through the two action
languages, and they are worth reading side by side: in the first the model writes
a program that calls the tools, and in the second it answers with structured tool
calls that the host invokes. `events` then shows the run from outside — the same
information the React layer renders — and `live-provider` is the one that leaves
the scripted world.

## The scripted model

`MockModel` takes the replies the model would have given, in order, and returns
them one per step. That is what makes these examples runnable with no key: the
loop, the sandbox, the tools and the step vocabulary are all real, and only the
model is scripted.

To talk to a provider, replace it with an adapter from `smolagents-ts/models`:

```ts
import { GeminiModel } from "smolagents-ts/models";

const model = new GeminiModel({ apiKey: process.env.GOOGLE_API_KEY });
```

`live-provider` does exactly that. It reads the key from the environment rather
than from a file, and it never prints the key: a provider error is scrubbed
before it reaches the output.
