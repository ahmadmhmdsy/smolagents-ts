# inngest/agent-kit — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Reading this table**

`clone:/…` is a path relative to the clone root at the pinned commit.
`https://agentkit.inngest.com/…` is this repository's own documentation, read as
Markdown on 2026-10-21. `https://www.inngest.com/docs/…` is Inngest platform
documentation read the same day, needed because the step semantics the library
depends on are defined there and nowhere in this tree. `implemented` means code
at the commit shows the parts and their connection; `declared` means a type, a
flag or a documentation claim without an end-to-end path in the package;
`inferred` means the structure is named in the tree and the purpose follows
from it.

**The shape of the thing**

The library contributes a loop and four seams: the step tools it borrows from
the host, a history adapter, a router function and a streaming context. The
platform contributes replay, retries, event waits, traces and a realtime
transport. Almost every capability below is one side of that split, and reading
a row without knowing which side owns it is how the docs mislead.

**The durable substrate, as used by this library**

The loop never calls a model directly inside a function. It asks for step tools
(`clone:/packages/agent-kit/src/util.ts:34-46`) and, when they exist, sends the
inference through `step.ai.infer` under the agent's name as the step id
(`clone:/packages/agent-kit/src/model.ts:50-56`). That one indirection is the
whole durability story on this side of the dependency.

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| deterministic ids inside steps | implemented | `clone:/packages/agent-kit/src/network.ts:449-461`, `:642-659` | network, agent and message ids come from `step.run`, so a replay regenerates the same values | ids that appear in persisted rows must not change on retry |
| model call as a hosted step | implemented | `clone:/packages/agent-kit/src/model.ts:50-56` | `step.ai.infer(agentName, { model, body })`; the platform caches, retries and bills it | an inference is the expensive side effect inside the loop |
| fallback without a host | implemented | `clone:/packages/agent-kit/src/model.ts:57-96` | no step context means a plain `fetch` to the provider, with no cache and no retry | the same agent can run outside an Inngest function |
| a function used as a tool | implemented | `clone:/packages/agent-kit/src/agent.ts:137-165` | an entry in `tools` that is an Inngest function is invoked with `step.invoke` under a namespaced id | a tool that is itself a durable workflow |
| waiting for an external event | declared | `clone:/docs/src/content/docs/advanced-patterns/human-in-the-loop.mdx:26-49` | a tool handler calls `step.waitForEvent(id, { event, timeout, match })` and receives the answer | human input without a process held open |
| pauses between stages | implemented | `clone:/examples/deep-research/inngest/functions/deep-research.ts:580` | `step.sleep("sleep", "1s")` after the network returns, before aggregation | pacing and rate relief inside one workflow |
| retry policy | declared | `clone:/docs/src/content/docs/advanced-patterns/retries.mdx:10`, `:93-102` | four retries with exponential backoff by default; `retries: 1` on the function that wraps the network | recovery for a whole loop, not for one tool |
| id occurrence counter | declared | `https://www.inngest.com/docs/durable-execution/guides-and-advanced/versioning` | the SDK combines a repeated step id with an occurrence counter, so later passes get their own saved result | routers may call the same agent more than once |

**How a run replays**

1. The function starts from the top on every attempt.
2. Each completed step returns its stored output instead of running again.
3. The loop rebuilds `State` from those returned values, so it takes the same
   branch as the first attempt.
4. Anything between steps runs again, which is why the library generates ids
   inside steps and why its history hooks receive the step tools.

The consequence for a reader is blunt: the library is durable exactly as far as
its host is, and the developer's own code between steps is the part that has to
be pure or idempotent. The docs say the inference step caches its result
(`clone:/docs/src/content/docs/concepts/agents.mdx:119`), and the repository's
own comment on tool invocation says why tools are the exception
(`clone:/packages/agent-kit/src/agent.ts:723-728`).

**The loop**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| network as a stateful while loop | implemented | `clone:/packages/agent-kit/src/network.ts:597-729` | shift an agent from a stack, run it, append its result, ask the router, push what it returns | a system of agents rather than one |
| router after every agent | implemented | `clone:/packages/agent-kit/src/network.ts:721-728` | the router returns one agent, several, or nothing, and nothing ends the run | control of the next step stays in code |
| one inference per agent call | implemented | `clone:/packages/agent-kit/src/agent.ts:194`, `:341-369` | `maxIter` defaults to 0, so a networked agent infers once and runs the tools it asked for | iteration belongs to the router, not the agent |
| tools executed after inference | implemented | `clone:/packages/agent-kit/src/agent.ts:617-626`, `:635-831` | every requested call runs before the result returns; errors are serialised into the result | the model's plan is carried out before the next decision |
| step budget | implemented | `clone:/packages/agent-kit/src/network.ts:101`, `:597-600` | `maxIter` is an integer; zero means no bound at all | the docs recommend a bound only with an LLM router |
| scheduling on a stack | implemented | `clone:/packages/agent-kit/src/network.ts:442-444`, `:593-595` | router results are pushed onto `_stack` and popped one per pass | several agents can be queued from one decision |
| standalone or networked | implemented | `clone:/packages/agent-kit/src/agent.ts:188-215` | `agent.run` builds a one-agent network when none is passed | the same object works alone and in a network |

**State and history**

`State` is per run: typed data, a results array and a deprecated key-value map,
all in memory. The docs are explicit that it is not persisted between runs
(`clone:/docs/src/content/docs/concepts/state.mdx:52-60`). Cross-run continuity
is a separate, caller-owned adapter.

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| typed state shared by agents and router | implemented | `clone:/packages/agent-kit/src/state.ts:36-103`; `clone:/docs/src/content/docs/concepts/state.mdx:23-43` | a generic `data` object behind a proxy, plus `kv` for untyped leftovers | routing decisions read what tools wrote |
| results as conversation memory | implemented | `clone:/packages/agent-kit/src/state.ts:145-163` | `formatHistory` flattens each `AgentResult` into messages for the next call | every agent sees what earlier agents produced |
| result object with a checksum | implemented | `clone:/packages/agent-kit/src/types.ts:189-215` | `AgentResult.export()` returns the storable fields; the checksum covers output, tool calls and timestamp | dedupe rows when saving history |
| history as four optional hooks | implemented | `clone:/packages/agent-kit/src/history.ts:35-97` | `createThread`, `get`, `appendUserMessage`, `appendResults`; each receives state and step tools | keep the database choice with the caller |
| thread identity rules | implemented | `clone:/packages/agent-kit/src/history.ts:198-243`; `clone:/docs/src/content/docs/concepts/history.mdx:358-402` | thread id from the client, from `createThread`, or a generated UUID as fallback | resume a conversation across processes |
| client-authoritative history | implemented | `clone:/docs/src/content/docs/concepts/history.mdx:326-347` | results supplied with the request disable the database read | the UI can own the transcript |
| idempotent writes | declared | `clone:/docs/src/content/docs/concepts/history.mdx:404-449` | message id and checksum unique constraints, because retries can repeat an append | history writes re-run with the function |

**Routers and multi-agent composition**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| code router | implemented | `clone:/packages/agent-kit/src/network.ts:836-868` | a function receives network, stack, result and call count and returns agents or nothing | deterministic handoff |
| routing agent | implemented | `clone:/packages/agent-kit/src/agent.ts:1017-1038`; `clone:/docs/src/content/docs/concepts/routers.mdx:129-163` | an agent with a single `onRoute` hook and no tools of its own | let a model choose the next agent |
| default routing agent | implemented | `clone:/packages/agent-kit/src/network.ts:190-323` | the model must call `select_agent` or `done`; `onRoute` reads the first tool call | a network with no router still works |
| hybrid routing | declared | `clone:/docs/src/content/docs/concepts/routers.mdx:165-190` | code handles the first step, then returns `getDefaultRoutingAgent()` | predictable start, flexible middle |
| routing inference is also a step | inferred | `clone:/packages/agent-kit/src/network.ts:871-889`, `:450-457` | the routing agent's own `run` goes through the same model path, so its call is memoised too | a replay must not re-decide differently |

**Tools, MCP and integrations**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| tool definition with zod | implemented | `clone:/packages/agent-kit/src/tool.ts:19-49` | name, description, parameter schema and a typed handler | schema is also the model's function definition |
| handler context | implemented | `clone:/packages/agent-kit/src/tool.ts:71-83` | `agent`, `network` and the host `step` tools are passed in | a tool can write state or use the platform |
| tools are not steps | implemented | `clone:/packages/agent-kit/src/agent.ts:723-740` | the handler is awaited directly; the comment explains that a tool may need several step calls of its own | one wrapper cannot know a tool's boundaries |
| MCP servers as tool sources | implemented | `clone:/packages/agent-kit/src/tool.ts:111-165`; `clone:/docs/src/content/docs/advanced-patterns/mcp.mdx:16-118` | streamable HTTP, SSE, websocket or stdio servers; tools are namespaced by server name | thousands of tools without writing them |
| integrations as tools | declared | `clone:/docs/src/content/docs/integrations/e2b.mdx:16-36`; `clone:/packages/agent-kit/src/tool.ts:19-49` | E2B, Daytona and Browserbase are npm packages installed beside the library and called from a tool handler | code execution without shipping a sandbox |
| no guardrail or approval primitive | inferred | no module or exported type for either; hooks only (`clone:/packages/agent-kit/src/agent.ts:323-330`, `:468-478`) | lifecycle callbacks can inspect or stop a call, and nothing else exists | moderation stays with the host function |

**Streaming and observability**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| streaming context and typed events | implemented | `clone:/packages/agent-kit/src/streaming.ts:540-575`, `:602-637` | a context per network and per agent emits run, part, delta, tool and error events | a UI can follow a run |
| simulated chunking | implemented | `clone:/packages/agent-kit/src/model.ts:44-46` | the comment states that token streaming is a TODO; completed text is cut into fixed-size deltas | the event shape exists before the provider stream does |
| step wrapper | implemented | `clone:/packages/agent-kit/src/streaming.ts:602-637` | a proxy over step tools that currently delegates `run` unchanged | a hook for step lifecycle events later |
| realtime transport | implemented | `clone:/packages/use-agent/src/core/adapters/inngest-connection.ts`; `clone:/docs/src/content/docs/streaming/transport.mdx:12-52` | the UI subscribes through Inngest realtime, or a session transport in memory | events must leave the server |
| traces and token usage | declared | `clone:/docs/src/content/docs/getting-started/local-development.mdx:101-110` | the dev server and cloud console show each agent step with model, tokens and input | debugging without building a UI |
| no exporter or OTel | inferred | no telemetry module in the package; trace data lives with the platform | the only way out is the platform's own UI or API | the vendor owns the observed record |

**Also present**

- Twenty example applications, including a Next.js chat surface, a
  human-in-the-loop support network and coding agents on E2B and Daytona.
- A docs site built from `clone:/docs/` in the same repository with Astro Starlight
  (`clone:/docs/astro.config.mjs:7`), published at agentkit.inngest.com, plus an
  `llms.txt` index.
- Tests for the loop, state, history, the MCP path and the streaming reducer,
  run with vitest; changesets and a CI workflow sit beside them.
- Model adapters for OpenAI-compatible endpoints, Azure OpenAI, Anthropic,
  Gemini and Grok, built on `@inngest/ai` 0.1.6.

**Notable implementation notes**

- The network function is created with `optimizeParallelism: true`
  (`clone:/packages/agent-kit/src/server.ts:54`, `:68`), a platform hint rather
  than a library behaviour.
- `RoutingConstructor` is declared three times in a row
  (`clone:/packages/agent-kit/src/agent.ts:1054-1067`), a harmless merge that
  signals how much of this package grew by appending.
- The router may return an agent that was never registered, and the loop adds it
  to the internal map on the way
  (`clone:/packages/agent-kit/src/network.ts:860-868`).
- `createState` accepts results and messages; either one disables the history
  read, which is the switch the docs call client-authoritative.
- Errors from a tool handler are serialised into the tool result rather than
  thrown (`clone:/packages/agent-kit/src/agent.ts:741-751`), so the model sees
  the failure.

**Declared but thin**

- Retries over tool calls are claimed by the retries page, but a tool is not a
  step unless its handler makes it one; only the whole function retries.
- Streaming is chunked after the fact, so the event vocabulary promises more
  real-time behaviour than the loop can deliver.
- Memory beyond a run is only an interface: the repository ships no
  implementation, no schema and no migration.
