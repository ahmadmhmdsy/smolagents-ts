# beeai-framework — architecture

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Repository layout**

The checkout has two implementation trees plus one shared documentation site. The TypeScript tree is the one walked here.

| path | non-test modules | role |
|---|---|---|
| `typescript/src/agents` | 29 | `BaseAgent`, ReAct with three runners, `RequirementAgent`, deprecated `ToolCallingAgent`, two experimental agents |
| `typescript/src/tools` | 24 | `Tool` base, `DynamicTool`, handoff/think/llm/arxiv/calculator/similarity, Python interpreter client, MCP and OpenAPI bridges, database and search tools |
| `typescript/src/adapters` | 60 | provider chat/embedding backends, LangChain bridge, MCP/A2A/ACP/agentstack servers and clients, OpenAI-compatible server |
| `typescript/src/internals` | 24 | helpers: retryable, counter, schema, serializable, promise, hash, prototype |
| `typescript/src/memory` | 6 | abstract memory, unconstrained, sliding, token, summarize, Dakera |
| `typescript/src/backend` | 9 | `Backend`, `ChatModel`, `ChatModelOutput`, `EmbeddingModel`, messages, client, model-name parsing |
| `typescript/src/workflows` | 2 | step state machine and the agent pipeline built on it |
| `typescript/src/emitter` | 4 | path-addressed event bus with trace metadata |
| `typescript/src/serializer` | 3 | class registry, ref resolution, wire format |
| `typescript/src/cache` | 6 | cache protocol, null cache, decorator cache, key hashers |
| `typescript/src/parsers` | 3 | line-prefix parser and field types used by the ReAct runner |
| `typescript/src/middleware`, `serve`, `logger` | 4 | trajectory logger, server base class, pino wrapper |

Three more trees complete the picture:

- `typescript/examples/` holds runnable examples for agents, workflows, memory, serialization, serve, cache, emitter and templates.
- `typescript/tests/e2e/` holds provider-backed end-to-end tests; unit tests sit next to the code as `*.test.ts`.
- `docs/` holds a single Astro documentation site whose pages carry both language variants side by side (`clone:/docs/src/content/docs/modules/`).

The Python tree mirrors the same directory vocabulary but is larger in adapters (26 families against 17) and carries modules the TypeScript tree does not: `evaluation`, `agents/lite`, `agents/experimental/rag`, `tools/filesystem`, `tools/code/shell.py`, `tools/search/*`.

**Core abstractions**

*Serializable and Serializer*

- Most framework objects extend `Serializable`, which requires `createSnapshot()` and `loadSnapshot()` and exposes `clone()`, `serialize()`, `fromSnapshot()` and `fromSerialized()` (`typescript/src/internals/serializable.ts:30-104`).
- Registration is a side effect of class definition, usually a static block calling `register()` (`typescript/src/memory/unconstrainedMemory.ts:15-17`); a class that was never imported is not in the registry.
- The `Serializer` keeps a map from class name to a factory of four functions — empty instance, update, toPlain, fromPlain — plus aliases, and resolves a value's class by walking its prototype chain (`typescript/src/serializer/serializer.ts:54-160`).
- The wire format is a tagged tree using `__serializer`, `__class`, `__ref` and `__value` nodes under a versioned root, with a weak map deduplicating shared references and a placeholder object for cycles.
- Function serialization stores source text and function deserialization is gated behind an explicit per-call opt-in because it would execute arbitrary code (`serializer.ts:40-52`, `:477-490`).

*RunContext, Run, Middleware*

- `RunContext.enter` is the single entry point that links the current run to its parent through a static `AsyncLocalStorage` store (`typescript/src/context.ts:147-211`).
- Each context owns an `AbortController` wired to the caller signal and the parent signal (`:113-140`), mints a 5-character `runId`, inherits `groupId`, records `parentId`, and creates a child emitter whose trace repeats those identities.
- `Run` extends a lazy promise and buffers `observe()`, `context()` and `middleware()` calls until the promise is first awaited (`:38-86`), so a fluent chain configures before executing.
- `Middleware` is an abstract `bind(ctx)` class or a plain function; run lifecycle events are `start`, `success`, `error` and `finish` (`:20-31`, `:162-209`).
- An abort is turned into a rejected race rather than a thrown signal check, and `destroy()` aborts the context with a "Context destroyed." error (`:142-145`, `:175-197`).

*Emitter*

- Events are addressed by namespace plus name, forming a dotted path; listeners may match a literal name, a full path, a regular expression, a function predicate, or the wildcards `*` and `*.*` (`typescript/src/emitter/emitter.ts:158-219`).
- A child emitter prefixes its parent's namespace and pipes every event to the parent unless scoped to the same run (`:77-122`, `:186-198`).
- Listeners carry priority, `once`, `persistent`, `isBlocking` and `matchNested`; emission awaits blocking listeners while letting the rest run detached (`:221-248`).
- Each event carries `id`, `groupId`, `path`, `createdAt`, `source`, `creator`, `context` and `trace` (`:250-262`).
- The trajectory middleware subscribes at the run level, renders one indented line per start/success/error/finish, and can filter by class include/exclude lists (`typescript/src/middleware/trajectory.ts:92-139`).

*BaseAgent*

- An abstract `run()` hard-fails on re-entry with a boolean, enters a context, wraps unexpected errors in `AgentError`, and delegates to `_run(input, options, context)` (`typescript/src/agents/base.ts:20-72`).
- The class owns the middleware list and an abstract memory accessor, so every agent shares those seams.
- Agents are serializable; the snapshot stores the emitter, middleware and each subclass's own input (`:85-95`).

*ChatModel and Backend*

- `ChatModel` is one interface over every provider: it validates tool-choice support, can force tool calling through a generated JSON response format, retries empty responses, repairs invalid tool calls by appending temporary error messages, caches whole outputs, and streams chunk objects while emitting `start`/`newToken`/`success`/`error`/`finish` (`typescript/src/backend/chat.ts:134-359`).
- Structured output is a separate entry point: it prepends a JSON-schema system prompt, parses the reply with a tolerant JSON reader, validates with ajv, and retries with the validation errors appended as a user message (`:361-476`).
- `ChatModelOutput` merges chunk arrays, deduplicates messages, exposes text and tool-call accessors, and is itself serializable (`:571-761`).
- `Backend` is only a chat-plus-embedding pair with name-based construction (`typescript/src/backend/backend.ts:19-52`).
- Model selection is string-driven: `provider:model` is parsed and the provider adapter class is loaded dynamically (`typescript/src/backend/chat.ts:380-388`).

*BaseMemory*

- The interface is messages, `add`, `delete`, `reset`, `splice`, iteration and snapshots (`typescript/src/memory/base.ts:21-70`).
- Six strategies exist: unbounded, sliding window with a removal selector, token-budgeted with estimate/tokenize/removal handlers, summarizing, read-only wrapper, and the Dakera remote vector memory.
- `TokenMemory` evicts until the arriving message fits a capacity budget, restores state if eviction fails, and periodically re-tokenizes dirty messages in a sync pass (`typescript/src/memory/tokenMemory.ts:40-211`).
- `DakeraMemory` persists messages to an external service, injects top-K semantic recalls as a system message, and treats remote failures as warnings rather than errors (`typescript/src/memory/dakeraMemory.ts:138-215`).

*Tool*

- Abstract `name`, `description` and `inputSchema()` (Zod or JSON schema), returning a `ToolOutput` subclass (`typescript/src/tools/base.ts:176-193`).
- The public `run()` parses and validates input with ajv, wraps execution in a retry policy, optionally memoises by input hash, optionally races each attempt against a timeout, emits lifecycle events and rethrows typed `ToolInputValidationError`/`ToolError` (`:236-326`, `:328-352`, `:392-432`).
- Retries default to zero; a tool opts in through `retryOptions`, and errors listed in `fatalErrors` bypass retry (`:296-307`, `:372-390`).
- Cache keys hash input plus run options but omit signal, retry options and timeout; an in-flight call stores a pending `Task` so concurrent callers deduplicate (`:328-352`).
- `DynamicTool` builds the same object from a name, description, Zod schema and handler at runtime (`:502-579`).
- `Tool.pipe()` and `Tool.extend()` compose tools (`typescript/src/tools/base.ts:448-501`); `Tool.contextKeys.Memory` is the context key through which a tool can read the agent's memory (`:187-190`).
- Tool input schemas accept either a Zod schema or a raw JSON schema, normalised through one helper so ajv validation works for both (`:392-410`).

*Workflow and AgentWorkflow*

- `Workflow` is a linear state machine: named steps share one Zod-validated state, and a handler returns the next step name or one of the reserved transitions exposed as `Workflow.START`, `SELF`, `PREV`, `NEXT`, `END` with values `__start__` through `__end__` (`typescript/src/workflows/workflow.ts:69-103`).
- Each transition emits `start`, then `success` or `error`, and the loop stops on `END` (`typescript/src/workflows/workflow.ts:214-280`).
- Steps may be nested workflows through `asStep()` and typed through `pipeable` helpers (`:290-343`).
- `AgentWorkflow` maps a list of agents onto steps and feeds them one queued input each, carrying messages in state (`typescript/src/workflows/agent.ts:38-131`).

*Server and adapters*

- `Server` keeps a member registry and a factory map from supported input classes to internal representations, so one server base serves agents, tools and templates (`typescript/src/serve/server.ts:17-79`).
- Concrete servers expose that registry over OpenAI chat-completions or responses, MCP (stdio/sse/streamable-http) and A2A (`typescript/src/adapters/openai/serve/server.ts:44-125`, `typescript/src/adapters/mcp/serve/server.ts:63-167`).
- Client-side adapters let a remote A2A, ACP or AgentStack agent be used as a local `BaseAgent` (`typescript/src/adapters/a2a/agents/agent.ts:30-61`).

**One ReAct run, walked**

1. The caller invokes `agent.run({ prompt })`; `BaseAgent.run` rejects a concurrent call, then enters `RunContext.enter` with the caller's signal (`typescript/src/agents/base.ts:30-45`).
2. `RunContext.enter` reads the ambient parent context from `AsyncLocalStorage`, constructs the child context with linked abort and inherited group id, and returns a lazy `Run` (`typescript/src/context.ts:147-211`).
3. Awaiting the `Run` first drains queued middleware and observers, then invokes the agent's `_run` under the new storage frame (`typescript/src/context.ts:63-74`, `:186-197`).
4. `ReActAgent._run` picks a runner by model id — `granite` and `deepseek-r1` get specialised runners, everything else gets the default — and constructs it with the execution config (`typescript/src/agents/react/agent.ts:70-76`, `:116-128`).
5. `runner.init` builds a fresh `TokenMemory` (thresholds 0.85 and 0.5), renders the system prompt, re-renders user messages through the user template, and seeds memory with system message plus conversation (`typescript/src/agents/react/runners/default/runner.ts:307-357`).
6. Each iteration increments the counter and throws when `maxIterations` is exceeded, then emits `start` with the iteration metadata (`typescript/src/agents/react/runners/base.ts:54-72`).
7. The runner asks the model to continue the instruction-line format and streams tokens through `LinePrefixParser`, whose field graph is `Thought`, `Function Name`, `Function Input`, `Function Output`, `Final Answer` with JSON brace matching and a fallback final answer (`typescript/src/agents/react/runners/default/runner.ts:360-414`).
8. The loop in the agent reads the parsed state: if a tool name and input are present it calls `runner.tool(...)` and appends a rendered assistant message containing thought, call and output (`typescript/src/agents/react/agent.ts:132-164`).
9. `Tool.run` preprocesses, validates, then executes under retry, cache and timeout policy, with the agent's memory injected into the context so tools such as handoff can read it (`typescript/src/tools/base.ts:236-326`).
10. Tool results are emitted as `partialUpdate` and `update` events carrying the iteration state, parsed output and memory (`typescript/src/agents/react/agent.ts:156-163`).
11. A final answer constructs the result message, emits `success` with iterations and memory, and ends the loop (`:165-176`).
12. Only after the loop does the agent write the user prompt and the final message into its persistent memory, then returns result, iterations and the runner memory (`:179-188`).

**A second loop: RequirementAgent**

- `RequirementAgent` keeps the same `BaseAgent` and emitter spine but replaces the text parser with rule evaluation.
- Requirements are objects that receive the run state and return per-step rules — target tool, allowed, forced, hidden, preventStop, reason (`typescript/src/agents/requirement/requirements/requirement.ts:14-66`).
- `ConditionalRequirement` implements the common vocabulary: before/after relationships, forced-after, minimum and maximum invocations, one forced step index, custom checks (`typescript/src/agents/requirement/requirements/conditional.ts:38-245`).
- The runner merges rules into a request with the allowed tool list, a tool choice and a "can stop" flag, renders the system message from that request, and calls the model (`typescript/src/agents/requirement/runner.ts:125-138`).
- A text-only response is converted into a synthetic final-answer tool call; when conversion fails the runner re-asks with the final-answer tool forced (`runner.ts:250-293`).
- Tool calls from one response execute concurrently and their results become tool messages (`runner.ts:172-220`); a cycle checker detects repeated call sequences and re-asks with that tool disallowed (`:295-312`).
- Memory is replaced or appended from the final state according to `saveIntermediateSteps` (`typescript/src/agents/requirement/agent.ts:149-181`).

**State and persistence model**

Everything durable in this framework is a snapshot of an object graph, not a journal of a run.

- Component snapshots cover agents, tools, memories, emitters, workflows, logger and even listener functions; serialization writes a class-tagged tree that can be reconstructed in another process if the classes are registered there.
- There is no run-state object on disk: `RunContext` lives in `AsyncLocalStorage`, carries an `AbortController` and an emitter, and is discarded when the run settles.
- No API accepts a run id to resume, and no agent can be paused between iterations.
- Conversation continuity is preserved only by persisting the memory component.
- Serving adapters add their own identity: A2A keeps `contextId` and `taskId` per session (`typescript/src/adapters/a2a/agents/agent.ts:36-38`).

The persistence story is therefore three-layered: snapshots for configuring and cloning objects, memory strategies for conversational state (with Dakera adding remote semantic recall), and adapter-level session identifiers for protocol continuity. A workflow run returns its step list and state in memory (`typescript/src/workflows/workflow.ts:17-21`), but that return value is not written anywhere by the framework.

**Transport and streaming**

- Model output is a stream of `ChatModelOutput` chunks; the model layer emits a `newToken` event per chunk with an abort callback so a consumer can stop generation early (`typescript/src/backend/chat.ts:202-212`).
- The ReAct runner aborts the model as soon as the parser completes an instruction block, so a prompt-protocol run does not pay for trailing tokens.
- Run-level progress is an event stream on the emitter, not a serialisable transport message; there is no wire protocol for events.
- Network transports exist only in adapters: OpenAI-compatible HTTP servers, MCP transports, A2A task streaming, and the ACP client's streaming `runs` call (`typescript/src/adapters/acp/agents/agent.ts:46-50`).
- Nothing implements reconnect-to-a-running-run or replay of a partial stream.

**Error and retry model**

- Three retry layers stack: per-iteration retries, a global retry budget, and per-tool retries. The ReAct defaults are 3 per step, 20 total and 10 iterations (`typescript/src/agents/react/agent.ts:120-125`); the requirement agent allows 20 iterations (`typescript/src/agents/requirement/agent.ts:127-133`).
- `RetryCounter` throws a fatal, non-retryable error of the class it was constructed with when a budget is exhausted (`typescript/src/internals/helpers/counter.ts:24-38`).
- Model errors are categorised: invalid tool calls and empty responses get a repair attempt by appending temporary messages before the error escapes (`typescript/src/backend/chat.ts:296-341`).
- Tools convert failures through `toError` into typed errors and attach a retryability hint and fatal flag (`typescript/src/tools/base.ts:44-62`, `:296-320`).

**Concurrency and cancellation**

- One agent instance can run one call at a time; the guard is a plain boolean (`typescript/src/agents/base.ts:35-45`).
- Nested runs inherit the parent abort signal; aborting a context rejects the run race and destroys its emitter (`typescript/src/context.ts:126-145`, `:175-197`).
- Within one requirement iteration, tool calls run in parallel with `Promise.all` (`typescript/src/agents/requirement/runner.ts:178-181`); the ReAct loop dispatches at most one tool per iteration.
- Tool-level timeout creates a fresh child controller per attempt and races the attempt promise against a rejecting timer, so a timeout cannot be mistaken for a caller abort (`typescript/src/tools/base.ts:248-288`).

**Prompt surface**

- `PromptTemplate` wraps Mustache with a Zod schema, defaults, custom delimiters, render functions, JSON-schema validation of the render input, and `fork`/`update` for local overrides (`typescript/src/template.ts:62-193`).
- Agent prompts live per agent (`typescript/src/agents/react/prompts.ts:10-184`), so a runner swap also swaps the instruction protocol.

**Build and test stack**

- Yarn 4.9.1 workspace with `mise.toml` task definitions; TypeScript compiled and bundled by tsup; unit tests co-located as `*.test.ts` and run by vitest 4.
- End-to-end tests under `typescript/tests/e2e` need real providers and an interpreter service for the Python tool.
- CI splits TypeScript and Python pipelines and builds the docs site (`.github/workflows/`).
- The published package has no `scripts` or `engines` field, so postinstall behaviour and Node range are unconstrained by the manifest.
