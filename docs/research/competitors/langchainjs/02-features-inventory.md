# langchainjs — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Every row cites the clone at the read commit; `implemented` means the path was traced,
`declared` means a type, README or doc link says it exists but the path was not
followed. The word "agent" here means the v1 `createAgent` path; the classic
`AgentExecutor` is inventoried separately under legacy, because a reader who mixes them
will design against the wrong loop.

## The agent loop and its state

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| AG-01 | `createAgent` builds a ReAct agent | implemented | `libs/langchain/src/agents/index.ts:176`, `:701`; `libs/langchain/src/agents/ReactAgent.ts:164` | Thirteen overloads resolve to one constructor; `createAgent` returns a `ReactAgent` that owns a compiled LangGraph state graph | The framework's flagship product, and the migration target from `AgentExecutor` |
| AG-02 | Model call with bound tools | implemented | `libs/langchain/src/agents/nodes/AgentNode.ts:213-236`; `libs/langchain/src/agents/ReactAgent.ts:218-220` | The node resolves the response format, binds client tools and invokes the model; a model instance with tools already bound is rejected at construction | Tool binding must be explicit and single-sourced |
| AG-03 | Termination and `returnDirect` | implemented | `libs/langchain/src/agents/nodes/AgentNode.ts:245-256`, `:292` | A successful `returnDirect` tool ends the run; no further tool calls ends it after the "need more steps" reply | A tool should be able to end a run without a second model call |
| AG-04 | Custom state merged with middleware state | implemented | `libs/langchain/src/agents/ReactAgent.ts:248-254`; `libs/langchain/src/agents/types.ts:741` | A caller's state schema is combined with every middleware's state schema at construction | Extensions need their own durable fields |
| AG-05 | Durable checkpoints | implemented, delegated | `libs/langchain/src/agents/types.ts:780`; `libs/langchain/src/agents/ReactAgent.ts:701`, `:728` | `checkpointer` accepts a LangGraph checkpointer or `true`; the graph persists thread state between invocations | Long runs and human-in-the-loop need resumable state |
| AG-06 | Stream modes | implemented, delegated | `libs/langchain/src/agents/ReactAgent.ts:1267`, `:1334` | `stream` forwards to the graph's modes (values, messages, updates, custom); a v3 projection-oriented mode is documented in the same JSDoc | A UI needs partial state, not a final object |
| AG-07 | Tool behaviour version flag | implemented | `libs/langchain/src/agents/ReactAgent.ts:183`, `:206`, `:397` | `version: "v1" or "v2"` switches how tool calls are grouped into tasks; the HITL middleware requires v2 for per-call interrupts | Behaviour had to change without breaking callers |
| AG-08 | Context schema | implemented | `libs/langchain/src/agents/middleware/types.ts:458`; `libs/langchain/src/agents/types.ts:775` | A read-only context object, declared by the caller or by middleware, reaches every hook | Per-run dependencies without polluting durable state |

## Middleware

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| MW-01 | Typed middleware factory | implemented | `libs/langchain/src/agents/middleware.ts:76-114` | `createMiddleware` takes a name, optional state and context schemas, tools and stream transformers, and returns a branded object | One extension shape for every cross-cutting concern |
| MW-02 | Six hook points | implemented | `libs/langchain/src/agents/middleware/types.ts:534`, `:564`, `:574-604` | `wrapToolCall`, `wrapModelCall`, `beforeAgent`, `beforeModel`, `afterModel` and `afterAgent` each receive state and context and may return an update or a command | Hooks at two levels let a middleware intercept one call or a whole phase |
| MW-03 | Middleware contributes tools | implemented | `libs/langchain/src/agents/ReactAgent.ts:225-228` | Tools declared by middleware are concatenated with the caller's tools before the graph is built | A middleware that needs a tool should not require the caller to pass it |
| MW-04 | Validated jump targets | implemented | `libs/langchain/src/agents/nodes/middleware.ts:132-159` | A hook's `jumpTo` is checked against its declared constraint and rejected with a suggestion | Control flow that the graph cannot draw is a bug, caught early |
| MW-05 | Human-in-the-loop approvals | implemented | `libs/langchain/src/agents/middleware/hitl.ts:11`, `:85` | The middleware interrupts the graph per tool call; decisions are `approve`, `edit`, `reject` or `respond` | A person, not a prompt, authorises a side effect |
| MW-06 | Summarisation of history | implemented | `libs/langchain/src/agents/middleware/summarization.ts:81-93`, `:114-127` | A trigger (fraction, tokens or messages) and a keep size decide when and how much history is summarised by a model | Context windows are finite and long runs overflow them |
| MW-07 | Context editing | implemented | `libs/langchain/src/agents/middleware/index.ts:41-46` | `ClearToolUsesEdit` removes tool results once they are no longer needed | Old tool output is the largest disposable part of history |
| MW-08 | Planning tools | implemented | `libs/langchain/src/agents/middleware/index.ts:53-57` | A todo-list tool with its own system prompt lets the agent keep a plan | Long tasks drift without an external record |
| MW-09 | Call limits | implemented | `libs/langchain/src/agents/middleware/toolCallLimit.ts:153-193`; `libs/langchain/src/agents/middleware/index.ts:59` | Thread- and run-level counters with configurable exit behaviour (`continue`, `end`, `error`) | Unbounded loops are a cost incident |
| MW-10 | Retry, fallback and error policy | implemented | `libs/langchain/src/agents/middleware/index.ts:62`, `:64`, `:68`, `:72`, `:77` | Separate middleware retries a model or tool, falls back to another model, applies an error policy or replaces a tool with a stub | Provider outages and flaky tools are ordinary operations |
| MW-11 | Prompt, tool-selection and provider-specific middleware | implemented | `libs/langchain/src/agents/middleware/index.ts:11`, `:15`, `:81`, `:89`, `:93` | Dynamic system prompts, an LLM that selects tools, provider tool search, moderation and prompt caching are shipped as middleware, not as agent options | Provider-specific behaviour should not grow the agent surface |
| MW-12 | PII detection and redaction | implemented | `libs/langchain/src/agents/middleware/index.ts:19` | Detectors for email, card, IP, MAC and URL, strategies for redaction, with a detection error | Compliance belongs at one boundary, not in every tool |

## Tools

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| TO-01 | `tool()` helper | implemented | `libs/langchain-core/src/tools/index.ts:652-898` | Thirteen overloads accept a function plus a schema and infer the input type; the schema may be Zod v3, Zod v4 or JSON Schema (`libs/langchain-core/src/tools/types.ts:81`) | Tool authoring should be one call with types |
| TO-02 | Tool classes | implemented | `libs/langchain-core/src/tools/index.ts:95`, `:366`, `:422`, `:488` | `StructuredTool`, `Tool`, `DynamicTool` and `DynamicStructuredTool` cover schema-first and string-first tools | Integrations need a class to extend |
| TO-03 | Response formats | implemented | `libs/langchain-core/src/tools/types.ts:30`, `:56` | A tool declares `content` or `content_and_artifact`; the artifact travels beside the message content | Large or binary output should not enter the model's context |
| TO-04 | Client and provider-hosted tools | declared | `libs/langchain-core/src/tools/index.ts:1085-1086` | `ClientTool` is a local tool; `ServerTool` is a record handed to a provider that executes it | Some tools execute inside the provider |
| TO-05 | Run-scoped tool config | implemented | `libs/langchain-core/src/tools/types.ts:120` | A tool receives the runnable config, so callbacks, signals and metadata reach its body | A tool is part of the run tree, not outside it |
| TO-06 | Tool event streaming | declared | `libs/langchain-core/src/tools/types.ts:35-38`; `callbacks/base.ts:229`; `callbacks/manager.ts:709` | A tool may emit events that callbacks forward through the tool run manager | Long tools need progress, not just a result |
| TO-07 | `returnDirect` | implemented | `libs/langchain/src/agents/ReactAgent.ts:234-239` | Tools flagged `returnDirect` end the run when they succeed | Search and fetch tools should be terminal |
| TO-08 | Toolkits | implemented | `libs/langchain-core/src/tools/index.ts:581` | `BaseToolkit` groups related tools behind one object | Integrations ship sets, not single tools |

## Structured output

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| SO-01 | `withStructuredOutput` on chat models | implemented | `libs/langchain-core/src/language_models/chat_models.ts:1211-1310` | Seven overloads wrap a schema into a `Runnable`; the base implementation requires `.bindTools()` and refuses `jsonMode` and `strict` | Every model should expose one structured-output entry point |
| SO-02 | Agent tool strategy | implemented | `libs/langchain/src/agents/responses.ts:54`, `:310-410` | A schema becomes a synthetic tool whose call is the structured answer | Not every model has native structured output |
| SO-03 | Agent provider strategy | implemented | `libs/langchain/src/agents/responses.ts:164`; `libs/langchain/src/agents/nodes/AgentNode.ts:206-236` | A provider-native strategy is resolved per model and the node picks native or tool form | Use native output where it exists, fall back where it does not |
| SO-04 | Schema-failure tolerance | implemented | `libs/langchain/src/agents/nodes/ToolNode.ts:61-81`, `:113-125` | An invalid-arguments error becomes a `ToolMessage` with `status: "error"` so the model can retry, unless the caller asks for throwing | Failures should be observations before they are exceptions |
| SO-05 | Schema interop | implemented | `libs/langchain-core/src/language_models/chat_models.ts:1271-1289` | Zod v3, Zod v4, JSON Schema and serializable schemas are accepted in one signature | Integrations and users bring different schema libraries |

## Retrieval, embeddings and documents

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| RV-01 | Embeddings interface | implemented | `libs/langchain-core/src/embeddings.ts:32-60` | Two abstract methods, `embedDocuments` and `embedQuery`, separate batch indexing from query embedding | Every vector store needs the same pair |
| RV-02 | Vector store interface | implemented | `libs/langchain-core/src/vectorstores.ts:553`, `:619`, `:661`, `:687`, `:715` | An abstract class with `addDocuments`, `similaritySearch`, `similaritySearchWithScore`, optional MMR and `delete` | Stores differ; search does not |
| RV-03 | Store-as-retriever bridge | implemented | `libs/langchain-core/src/vectorstores.ts:192`, `:331-336` | `VectorStoreRetriever` adapts any store to the retriever interface and forwards MMR when supported | A store should be usable without a wrapper |
| RV-04 | Retriever interface | implemented | `libs/langchain-core/src/retrievers/index.ts:65`, `:126`, `:166` | `BaseRetriever` implements runnable plumbing and calls `_getRelevantDocuments` | Retrieval is broader than vector search |
| RV-05 | Document compressors | declared | `libs/langchain-core/src/retrievers/document_compressors/index.ts`; `libs/langchain-core/src/documents` | Compressors and document transforms sit beside retrievers | Retrieved documents are usually too many or too long |
| RV-06 | Loaders and splitters | implemented | `libs/langchain-core/src/document_loaders`; `libs/langchain-textsplitters` | Loaders produce documents; splitters cut them into chunks | Ingestion is half of retrieval |
| RV-07 | Key-value store interface | implemented | `libs/langchain-core/src/stores.ts`; `libs/langchain/src/index.ts:64` | `BaseStore` with an `InMemoryStore` re-exported by the main package | Long-term memory needs a store, not a vector index |
| RV-08 | Implementations live elsewhere | implemented | `libs/langchain-classic/src/vectorstores/memory.ts:142`; `libs/providers/langchain-aws/src/retrievers/kendra.ts:52` | `MemoryVectorStore` is classic; the AWS retriever is a provider package; most stores are in the separate community packages | The interfaces are the product; integrations are the breadth |

## Callbacks and tracing

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| CB-01 | Callback handler surface | implemented | `libs/langchain-core/src/callbacks/base.ts:352`, `:63-285` | Optional methods for model, chat model, chain, tool, retriever, agent and text events, plus errors and stream events | One observer interface for every component |
| CB-02 | Run managers and child runs | implemented | `libs/langchain-core/src/callbacks/manager.ts:215`, `:298`, `:373`, `:517`, `:664`, `:779`, `:302` | A manager per run kind; `getChild` returns the manager for a nested run | A trace is a tree, so the callback API must be one |
| CB-03 | Tracers | implemented | `libs/langchain-core/src/tracers/tracer_langchain.ts:90`; `console.ts`; `event_stream.ts`; `log_stream.ts`; `run_collector.ts`; `root_listener.ts` | LangSmith, console, event-stream, log-stream, run-collector and root-listener tracers all subscribe through the callback manager | Observability should not be baked into the loop |
| CB-04 | Config propagation | implemented | `libs/langchain-core/src/runnables/types.ts:80` | `callbacks`, `tags`, `metadata`, `configurable` and run names travel with a call and reach every child | Attribution is set once at the call site |
| CB-05 | Streaming callbacks | implemented | `libs/langchain-core/src/callbacks/base.ts:78`, `:97`; `libs/langchain-core/src/callbacks/manager.ts:377`, `:415` | `handleLLMNewToken` and `handleChatModelStreamEvent` carry tokens and structured events | A UI renders tokens before the message ends |
| CB-06 | Browser dispatch | declared | `libs/langchain-core/src/callbacks/dispatch/web.ts`; `dispatch/index.ts` | Callback dispatch is adapted for web and worker runtimes | The library runs in the browser |

## Composition and models

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| CM-01 | Runnable composition | implemented | `libs/langchain-core/src/runnables/base.ts:145`, `:243`, `:1353`, `:1367` | `invoke`, `batch`, `stream`, `pipe`, `withConfig` and `withRetry` define composition and configuration | Components must compose without adapters |
| CM-02 | Message and tool-call shapes | implemented | `libs/langchain-core/src/messages`; `libs/langchain-core/src/messages/tool` | Human, system, AI and tool messages, content blocks and tool-call types are shared by all adapters | Every provider speaks a different wire format |
| CM-03 | Universal model initialisation | implemented | `libs/langchain/src/chat_models/universal.ts:52`, `:185-205`; `libs/langchain/src/index.ts:23` | `initChatModel("provider:model")` resolves a provider package by name and constructs the adapter | One string should be enough to start |
| CM-04 | Provider breadth | implemented | `libs/providers` (32 packages); `libs/langchain-standard-tests` | Each provider is a package with a standard test suite | Breadth is the selling point |
| CM-05 | Prompts, parsers and caches | implemented | `libs/langchain-core/src/prompts`; `libs/langchain-core/src/output_parsers`; `libs/langchain-core/src/caches` | Prompt templates, output parsers and caches are interfaces with built-in implementations | The pre-agent generation of the framework |
| CM-06 | MCP tool adapters | declared | `libs/langchain-mcp-adapters` | A separate package converts MCP servers' tools for the agent | MCP is the current integration standard |

## Legacy surface (do not confuse with the current path)

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| LG-01 | `AgentExecutor` and v0.x chains | implemented, legacy | `libs/langchain-classic/src/agents/executor.ts:352`; `libs/langchain-classic/src/agents/index.ts:44-47`; `libs/langchain-classic/README.md:3` | A separate package keeps the old agent loop, chains, memory, indexing and community re-exports at 1.0.54 | Existing applications should not break on v1 |
| LG-02 | Legacy agent types in core | implemented, legacy | `libs/langchain-core/src/agents.ts:1-18` | `AgentAction`, `AgentFinish` and `AgentStep` remain as types for callbacks and classic | Callback signatures predate tool calls |
| LG-03 | Migration guidance | declared | `libs/langchain-classic/README.md:16-23` | The classic README tells new projects to use `langchain` v1 and `createAgent` | A reader arriving from a 2023 tutorial needs the boundary |

## Notable implementation notes

- The agent loop and its persistence are not implemented here: `ReactAgent` holds a
  compiled graph (`libs/langchain/src/agents/ReactAgent.ts:181`) from
  `@langchain/langgraph`, and streams and checkpoints cross that boundary. A D2 read
  records the seam, not the engine.
- The interfaces are the standard; most implementations are elsewhere. Of the concrete
  stores and retrievers, the repository contains a classic `MemoryVectorStore`
  (`libs/langchain-classic/src/vectorstores/memory.ts:142`) and one provider retriever
  (`libs/providers/langchain-aws/src/retrievers/kendra.ts:52`); the rest live in the
  community and partner packages.
- Type-level weight is real: `createAgent` has thirteen overloads in a 730-line module
  (`libs/langchain/src/agents/index.ts:176-702`), `tool()` has fourteen
  (`libs/langchain-core/src/tools/index.ts:652-898`), and `withStructuredOutput` has
  seven. The runtime is small; the type system carries the compatibility promises.
- Schema interop is a compatibility strategy, not a single choice: Zod v3, Zod v4, JSON
  Schema and `SerializableSchema` are accepted in the same signatures, and the source
  carries `oxlint-disable` comments for the `any` that results.
- LangSmith is a hosted product and the tracer is a client for it; the repository
  contains the tracer and the run collector, not the service. Nothing here deploys or
  hosts an agent.
- Two agent behaviour versions exist inside one API (`version: "v1" | "v2"`), and one
  middleware requires the newer one (`libs/langchain/src/agents/ReactAgent.ts:397`).
