# beeai-framework — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**How to read this inventory**

- **Status** is one of `implemented` (the behaviour was traced in source), `declared` (a type, option, flag or documentation statement exists but no code path was traced implementing it) or `inferred` (reasoned from structure, said so in the note).
- **Evidence** is a clone-relative `path:line` at the read commit. Absence rows cite the place that would have contained the capability, and say "absence" in the note.
- The unit is a capability, not a file. Where a capability spans two languages, the table says which half has it.
- Nothing here was executed; all TypeScript rows are read from `typescript/src` unless a row names another tree.

**Agent loop and prompting**

| capability | status | evidence | how it works | note |
|---|---|---|---|---|
| One-shot agent run with lifecycle events | implemented | `typescript/src/agents/base.ts:20-72` | `run()` guards re-entry, enters a context, emits start/success/error/finish, returns `{ result, iterations, memory }` | lifecycle lives on `RunContext`, not on a run store |
| ReAct with prompt-encoded tool calls | implemented | `typescript/src/agents/react/agent.ts:116-188` | loop drives a runner; runner streams model output through the line-prefix parser and dispatches one tool per iteration | default execution mode of the framework |
| Model-specific runner selection | implemented | `typescript/src/agents/react/agent.ts:70-76` | model id containing `granite` or `deepseek-r1` selects a specialised prompt/parser pair; everything else gets the default | selection is substring matching, not a registry |
| Prompt template with schema validation | implemented | `typescript/src/template.ts:62-193` | Mustache render plus Zod schema and JSON-schema validation of inputs, custom delimiters, fork/update | also used by docs examples |
| Per-agent prompt sets | implemented | `typescript/src/agents/react/prompts.ts:10-184` | system/assistant/user/error templates for the ReAct instruction protocol | prompt and parser must stay in step; a runner swap swaps both |
| Structured output through the chat model | implemented | `typescript/src/backend/chat.ts:361-476` | JSON-schema instruction, tolerant JSON parse, ajv validation, retry with the validator errors appended as a user message | independent of agents, usable by any caller |
| Native tool calling | implemented | `typescript/src/backend/chat.ts:157-359` | `ChatModel.create` forwards tool definitions and tool choice, normalises provider tool-call shapes, repairs malformed calls | the agent that exploited it (`ToolCallingAgent`) is deprecated |
| Deprecated native-tool-call agent | declared | `typescript/src/agents/toolCalling/agent.ts:62-65` | marked deprecated in favour of the requirement agent; still exported and tested | removal breaks importers, so it lingers |
| Requirement-driven tool policy | implemented | `typescript/src/agents/requirement/requirements/requirement.ts:14-101` | each requirement yields per-step rules for allowed, forced, hidden, prevent-stop and reason | newest loop; see `03-gap-and-lessons.md` gap G-1 |
| Conditional requirement vocabulary | implemented | `typescript/src/agents/requirement/requirements/conditional.ts:38-245` | before/after relations, forced-after, min/max invocations, one forced step index, custom predicates | enough to express "ask once, then never again" |
| Final answer as a forced tool | implemented | `typescript/src/agents/requirement/runner.ts:250-293` | text-only response is converted to a synthetic final-answer call; on failure the runner re-asks with that tool forced | removes text parsing from the loop |
| Tool-call cycle detection | implemented | `typescript/src/agents/requirement/runner.ts:295-312` | a checker over recent call signatures re-asks with the repeating tool disallowed | guards the common repeat loop |
| Iteration cap and stop condition | implemented | `typescript/src/agents/requirement/agent.ts:127-138` | defaults are 20 iterations and "can stop" derived from rules | a run that hits the cap throws, it does not return partial state |
| Parallel tool calls in one iteration | implemented | `typescript/src/agents/requirement/runner.ts:172-220` | `Promise.all` over the tool calls of one model response | ReAct path does not do this |
| Agent middleware chain | implemented | `typescript/src/context.ts:63-74` | `Middleware` classes and functions bind to the run context and wrap success, error and finish | the trajectory logger is one of these |

**Tools**

| capability | status | evidence | how it works | note |
|---|---|---|---|---|
| Abstract tool contract | implemented | `typescript/src/tools/base.ts:176-193` | subclass declares `name`, `description`, `inputSchema()`; output is a `ToolOutput` subclass | the only extension seam |
| Zod or raw JSON input schema | implemented | `typescript/src/tools/base.ts:392-432` | one normaliser converts either form and ajv validates, throwing `ToolInputValidationError` with the ajv error list | errors are structured, not stringly |
| Retry policy | implemented | `typescript/src/tools/base.ts:296-320`, `:372-390` | per-tool `maxRetries` and `factor`, with `fatalErrors` bypassing retry and `Retryable` carrying the retry budget | default is zero retries |
| Per-call timeout | implemented | `typescript/src/tools/base.ts:248-288` | each attempt gets a fresh child `AbortController` and a rejecting timer raced against the attempt | a timed-out attempt does not abort the caller |
| Result cache with in-flight dedupe | implemented | `typescript/src/tools/base.ts:328-352` | input-hash key excluding signal/retry/timeout; concurrent identical calls share a `Task`; a failed call deletes the entry | cache is per tool instance, not global by default |
| Tool lifecycle events | implemented | `typescript/src/tools/base.ts:246-322` | start, retry, success, error and finish are emitted on the run emitter under the tool namespace | feeds the trajectory view |
| Dynamic tool | implemented | `typescript/src/tools/base.ts:502-579` | builds a tool from name, description, Zod schema and handler | used internally for the final-answer tool |
| Tool composition | implemented | `typescript/src/tools/base.ts:448-501` | `pipe()` chains tool input/output; `extend()` adds schema fields | no equivalent in workflows |
| Handoff as sub-invocation | implemented | `typescript/src/tools/handoff.ts:29-93` | clones target agent, resets its memory, seeds filtered messages, runs it with a null prompt, returns text | caller keeps control; not a transfer |
| Think tool | implemented | `typescript/src/tools/think.ts:23-59` | a no-op tool that echoes reasoning back as an input, keeping the thought inside scratchpad memory | the "think" trick from the ReAct paper |
| Code interpreter tool | implemented | `typescript/src/tools/python/python.ts:42-218` | uploads declared files, POSTs source and files to `/v1/execute`, downloads produced files | requires an external service |
| Custom tool from source | implemented | `typescript/src/tools/custom.ts:105-136` | posts source to the interpreter's `/v1/parse-custom-tool` and reflects a schema from it | remote code, not local execution |
| Message model with typed parts | implemented | `typescript/src/backend/message.ts:16-17` | one `Message` base with role subclasses and content parts for text, tool call, image, file and tool result | the canonical internal representation for memory and providers |
| Cache decorator for arbitrary async calls | implemented | `typescript/src/cache/decoratorCache.ts:90-160` | method decorator over the cache protocol with key hashing and optional TTL | framework-internal convenience, exported |
| MCP tool bridge | implemented | `typescript/src/tools/mcp.ts` | lists remote MCP tools and adapts each to a local `Tool` | client side only |
| OpenAPI tool bridge | implemented | `typescript/src/tools/openapi.ts` | loads an OpenAPI document and exposes one tool per selected operation | schema comes from the spec |
| Database and search tools | implemented | `typescript/src/tools/database/`, `typescript/src/tools/search/` | elasticsearch, sql, milvus, qdrant; duckduckgo, searxng, wikipedia; arxiv, similarity, llm, weather, web crawler | each carries its own dependency and env requirements |
| Approval or permission gate | inferred absent | `typescript/src/tools/base.ts:236-326` | the run path validates, executes and emits; no hook asks a human or policy before execution | the Python half has `AskPermissionRequirement`; TypeScript has no equivalent |
| Filesystem or shell tools | inferred absent | `typescript/src/tools/` | listing contains no filesystem or shell module | Python has both behind ambient backends |
| Local sandbox | inferred absent | `typescript/src/tools/python/python.ts:139` | execution is a remote HTTP call to a configurable URL | no process, container or workspace is created |

**Memory**

| capability | status | evidence | how it works | note |
|---|---|---|---|---|
| Memory interface | implemented | `typescript/src/memory/base.ts:21-70` | messages plus add/delete/reset/splice/snapshot; `asReadOnly()` wraps an instance | snapshot is part of the contract |
| Unbounded memory | implemented | `typescript/src/memory/unconstrainedMemory.ts:12-41` | appends; the window grows forever | baseline for ReAct |
| Sliding window memory | implemented | `typescript/src/memory/slidingMemory.ts:23-90` | keeps the last N messages, with a handler to choose which message to drop | drop policy is editable |
| Token-budgeted memory | implemented | `typescript/src/memory/tokenMemory.ts:40-211` | estimates tokens, evicts until the arriving message fits 85 percent of the limit, re-tokenizes in a 50 percent sync pass | estimator falls back to characters over four |
| Summarising memory | implemented | `typescript/src/memory/summarizeMemory.ts:28-91` | an LLM call folds evicted messages into one summary message | spends model calls on compression |
| Read-only memory wrapper | implemented | `typescript/src/memory/base.ts:72-102` | wraps another memory and silently drops writes (`add` and `reset` are no-ops, `delete` returns false) | used to pass history without allowing writes |
| Remote semantic memory | implemented | `typescript/src/memory/dakeraMemory.ts:138-215` | persists messages to a Dakera service, injects the top-K recalls as a system message, warns on remote failure | TypeScript only; snapshots omit the API key |
| Memory as a serialisable component | implemented | `typescript/src/memory/tokenMemory.ts:19-21` | each strategy implements snapshot/load and registers itself | enables agent cloning |

**Composition and multi-agent**

| capability | status | evidence | how it works | note |
|---|---|---|---|---|
| Typed workflow state machine | implemented | `typescript/src/workflows/workflow.ts:94-280` | named steps over one Zod state; handler returns next step or reserved transition | sequential only |
| Nested workflow as a step | implemented | `typescript/src/workflows/workflow.ts:290-343` | `asStep()` adapts a workflow into a step, carrying schemas | the only structural composition |
| Agent pipeline | implemented | `typescript/src/workflows/agent.ts:38-131` | agents become steps; each consumes one queued input and appends messages to state | used by the TypeScript README example |
| Message handoff between agents | implemented | `typescript/src/tools/handoff.ts:56-91` | target agent is cloned and run as a sub-call; the caller continues | control returns to the caller by construction |
| Remote agent as local agent | implemented | `typescript/src/adapters/a2a/agents/agent.ts:30-61` | protocol client adapted to `BaseAgent` | A2A, ACP and AgentStack variants |
| Agent-to-agent protocol identity | implemented | `typescript/src/adapters/a2a/agents/agent.ts:36-38` | `contextId` and `taskId` are sent and updated per exchange | continuity is a protocol field, not framework state |
| Supervisor or router topology | inferred absent | `typescript/src/workflows/` | two modules: the state machine and the agent pipeline | routing exists only as a step handler's return value |
| Fan-out / fan-in of agents | inferred absent | `typescript/src/workflows/workflow.ts:214-267` | the loop advances one step at a time and awaits each handler | no parallel branch primitive |
| Shared state between agents | implemented | `typescript/src/workflows/agent.ts:50-66` | the workflow state carries inputs, messages and final answer across steps | state is pipeline-scoped |

**Serialization and state**

| capability | status | evidence | how it works | note |
|---|---|---|---|---|
| Custom-class registration example | implemented | `typescript/examples/serialization/customInternal.ts:3-26` | a user class extends `Serializable`, registers in a static block, then round-trips through `serialize()`/`fromSerialized()` | the pattern users are told to copy |
| Snapshot contract | implemented | `typescript/src/internals/serializable.ts:30-104` | `createSnapshot`/`loadSnapshot` plus clone/serialize/fromSnapshot/fromSerialized helpers | the framework's persistence primitive |
| Class registry | implemented | `typescript/src/serializer/serializer.ts:54-160` | name to factory map with aliases; prototype-chain class resolution; built-ins registered for Map, Set, Date, Task, Logger, functions and more | unimported classes are not registered |
| Global retry budget primitive | implemented | `typescript/src/internals/helpers/counter.ts:9-54` | `RetryCounter` decrements on use and throws a fatal, non-retryable error when exhausted | shared by the ReAct runner and tool retries |
| Versioned wire format | implemented | `typescript/src/serializer/serializer.ts:150-190` | tagged nodes under `__version` and `__root`, with `__serializer`, `__class`, `__ref`, `__value` | refs deduplicate and break cycles |
| Function serialization guard | implemented | `typescript/src/serializer/serializer.ts:40-52` | function deserialization is disabled unless the caller opts in through an ambient flag; advisory GHSA-phhm-7927-g88p is cited | the security decision is documented in code |
| Whole-agent snapshot | implemented | `typescript/src/agents/base.ts:85-95` | emitter, middleware and subclass input are snapshotted | used for cloning, not for resume |
| Run journal, checkpoint, resume | inferred absent | `typescript/src/context.ts:93-233` | run identity exists only in `AsyncLocalStorage`; the context is discarded on settle | no store, no resume API, no pause |
| Snapshot schema migration | inferred absent | `typescript/src/serializer/serializer.ts:150-190` | one `__version` integer is written, no migration hook is read | a stored snapshot outliving the package version is unmanaged |
| Python serializer parity | inferred absent | `python/beeai_framework/` | no snapshot/serializer module among the memory, agent, workflow or utils trees | the docs page admits "Example coming soon" |

**Observability and evaluation**

| capability | status | evidence | how it works | note |
|---|---|---|---|---|
| Path-addressed event emitter | implemented | `typescript/src/emitter/emitter.ts:49-280` | namespace plus name paths, wildcard and predicate matchers, child piping, priority and once options, trace metadata | the framework-wide observation seam |
| Trace identity | implemented | `typescript/src/emitter/emitter.ts:250-262` | `groupId`, `runId` and parent ids travel on every event | hierarchy is reconstructable from events alone |
| Trajectory logger middleware | implemented | `typescript/src/middleware/trajectory.ts:92-139` | one indented line per start/success/error/finish with class include/exclude filters and a prefix map | human-readable, not machine export |
| Pino logger | implemented | `typescript/src/logger/logger.ts:51-206` | child loggers, level from `BEE_FRAMEWORK_LOG_LEVEL`, pretty transport in development | independent of the emitter |
| OpenTelemetry export | inferred absent | `clone:/docs/src/content/docs/modules/observability.mdx:10-12` | documentation states OTEL support is Python-only through an external package | the richest observability evidence we have for OB-02 |
| Built-in evaluation | inferred absent | `clone:/docs/src/content/docs/modules/evaluation.mdx:15` | documentation lists evaluation as Python only, adapting DeepEval and Ragas | TypeScript users score outside the framework |
| Token usage accounting | declared | `typescript/src/backend/chat.ts:571-700` | chunk usage fields exist and merge into output | no aggregation or budget enforcement was traced |

**Backends, serving and infrastructure**

| capability | status | evidence | how it works | note |
|---|---|---|---|---|
| Provider abstraction | implemented | `typescript/src/backend/chat.ts:134-359` | one `ChatModel` interface over 10 direct provider adapters, a dummy backend for tests, and LangChain and Vercel bridges | four protocol adapters sit alongside |
| Embedding abstraction | implemented | `typescript/src/backend/embedding.ts:40-84` | abstract `EmbeddingModel` with the same serialisable base as chat models, implemented by most provider adapters | the similarity tool takes an injected provider instead of an embedding model |
| Provider inventory | implemented | `typescript/src/adapters/` | `openai`, `anthropic`, `amazon-bedrock`, `azure-openai`, `google-vertex`, `groq`, `minimax`, `ollama`, `watsonx`, `xai`, `dummy`, `langchain`, `vercel`, `mcp`, `a2a`, `acp`, `agentstack` | Python adds LiteLLM, LlamaIndex, Gemini, DeepSeek, Qwen, Mistral, Transformers and two BeeAI platform adapters |
| Model-name construction | implemented | `typescript/src/backend/chat.ts:380-388` | parses `provider:model` and loads the adapter module dynamically | stringly typed, no compile-time check |
| Server member registry | implemented | `typescript/src/serve/server.ts:31-78` | factory registration per input class, register/deregister/many, abstract `serve()` | registration is per instance, not global |
| Server base class | implemented | `typescript/src/serve/server.ts:17-79` | member registry plus factory map from input classes to representations | one base for agents, tools, templates |
| OpenAI-compatible server | implemented | `typescript/src/adapters/openai/serve/server.ts:44-125` | chat-completions and responses endpoints, loopback bind by default, API-key warning | exposes any registered agent |
| MCP server | implemented | `typescript/src/adapters/mcp/serve/server.ts:63-167` | stdio, SSE and streamable HTTP transports; tools, prompts and resources | authoring an MCP server is a decision-0018 non-goal for us |
| A2A client and server | implemented | `typescript/src/adapters/a2a/agents/agent.ts:30-61` | remote agent as local agent; task and context ids carried per exchange | protocol also a non-goal for us |
| ACP and AgentStack adapters | implemented | `typescript/src/adapters/acp/agents/agent.ts:17-60` | REST streaming client; AgentStack wraps ACP | niche editor integrations |
| Remote code interpreter | implemented | `typescript/src/tools/python/python.ts:139` | `CODE_INTERPRETER_URL` with `/v1/execute`, default port 50081, upload/download of files | the only execution surface in TypeScript |
| Sandboxed local executors | inferred absent | `typescript/src/tools/custom.ts:105-136` | custom tools are parsed remotely and executed by the remote interpreter | nothing runs code in the host process |
| Workspace or file abstraction | inferred absent | `typescript/src/` | no filesystem module and no ambient storage backend | Python has a `FileBackend` context variable |
| Durable run store | inferred absent | `typescript/src/agents/base.ts:20-72` | an agent instance holds configuration and memory; no store is consulted before or after a run | nothing survives a process restart except serialised components |

**Packaging and documentation**

| capability | status | evidence | how it works | note |
|---|---|---|---|---|
| Wildcard subpath exports | implemented | `typescript/package.json:99-121` | everything under `src` is addressable as `beeai-framework/<module>` | internal names become public API |
| Runtime dependency declaration | implemented | `typescript/package.json:141-166` | dependencies include the AI SDK, ajv, mustache, pino, object-hash, remeda, serialize-error | `zod` is used at runtime but listed only in devDependencies |
| Peer dependency matrix | declared | `typescript/package.json:167-241` | every peer is optional, with a metadata block | one peer is named in metadata but absent from the peer list |
| Node range and install hooks | inferred absent | `typescript/package.json` | no `engines`, no `scripts` | consumer Node version is unconstrained |
| Dual-language docs with language tabs | implemented | `clone:/docs/src/content/docs/modules/` | one page per module with Python and TypeScript examples | pages drift from code: `rag.mdx` links a Python RAG path that does not exist at this commit |

**Rows that would need execution to confirm**

These are labelled `implemented` because the code path exists, but their real-world behaviour was not observed and should not be assumed:

- the prompt-protocol parser recovering when a model emits fields out of order or wraps them in markdown;
- the runner aborting a stream mid-generation without orphaning the provider connection;
- cache correctness when two callers race on the same input and the first one fails;
- token-memory eviction actually fitting the budget when the estimator over-shoots;
- Dakera recall relevance and the cost of injecting a system message on every add;
- requirement cycle detection catching the loops a real model actually repeats;
- the OpenAI-compatible server satisfying a real client's expectation of streaming and tool calls;
- the whole-agent snapshot round-tripping when a provider adapter holds a non-serialisable client.

**What is absent, in one list**

- Human approval as a first-class pause, in either half (Python has an event-mutating requirement, not a pause).
- Any run-level durability: journal, checkpoint, resume, interrupt, reattach.
- Local, sandboxed tool execution and any filesystem or shell surface in TypeScript.
- Supervisor, router, fan-out or shared-state multi-agent topology.
- OTEL export, built-in evaluation and RAG in TypeScript.
- Schema migration for stored snapshots.
