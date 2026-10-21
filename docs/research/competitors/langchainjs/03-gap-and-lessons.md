# langchainjs — gap analysis and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## How a row reads

Buckets follow the baseline (`docs/research/competitors/_synthesis/00-our-baseline.md`):
A extends a seam we ship, B is decision 0018 or 0019, C is outside our vocabulary, D is
thinner than the neighbour, E is reserved for an upstream port and does not apply to a
framework. `Matching` states what a parity implementation would have to reproduce at the
seam we own, not a request to imitate the LangChain API. `Fit` names the file the change
would land in. Prices are S (a day or less), M (two to three days), L (a week or more)
and XL (needs a product decision first).

## A — roadmap follow-ons

| id | gap | matching means | fit | price |
|---|---|---|---|---|
| RT-08 | Middleware that contributes state and tools, with hooks around one model or tool call | Our middleware array stays a fixed chain around a step; theirs has `beforeAgent`, `beforeModel`, `afterModel`, `afterAgent`, `wrapModelCall` and `wrapToolCall`, each middleware may add a state schema and tools, and the agent merges them (`libs/langchain/src/agents/middleware.ts:76-114`, `types.ts:534-604`, `ReactAgent.ts:225-254`) | `packages/core/src/middleware.ts` | L |
| GR-05 | Provider-side structured output behind a capability | Their chat models implement `withStructuredOutput` and the agent resolves tool or native strategy per model (`language_models/chat_models.ts:1211-1310`, `agents/nodes/AgentNode.ts:206-236`); our `ModelCapabilities.structuredOutput` is declared and unused | `packages/models` adapters plus the loop | M |
| GR-06 | Schema-failure repair loop | Their tool node converts invalid arguments into an error observation the model can retry (`agents/nodes/ToolNode.ts:61-81`, `:113-125`); our mismatch fails the run | `packages/core/src/agent/multi-step-agent.ts` and the tool executor | S |
| TL-05 | Per-tool retry, timeout and error policy | Their `toolRetryMiddleware`, `toolErrorMiddleware` and `handleToolErrors` enum separate throw, observe and custom handling (`middleware/index.ts:68`, `:72`, `ToolNode.ts:61-81`); we have one run-wide execution timeout | a tool middleware in `packages/core/src/middleware.ts` | S |
| RT-06 | Call budgets with explicit exit behaviour | Their call-limit middleware counts model and tool calls per run and per thread and exits with `continue`, `end` or `error` (`middleware/toolCallLimit.ts:153-193`, `middleware/index.ts:59`); our step budget is one run-wide number | the loop bound plus middleware | S |
| OB-02 | Exporter-shaped tracing with a run tree | Their callback manager hands every component a run manager and `getChild` builds the tree (`callbacks/manager.ts:215-302`); tracers for LangSmith, console, event stream and log stream plug into it (`tracers/`). Ours is a local span shape with no exporter | `packages/core/src/monitoring/trace.ts` and a new exporter seam | M |
| MD-06 | Embeddings and retrieval | Interfaces for embeddings, vector stores and retrievers, with implementations elsewhere (`embeddings.ts:32-60`, `vectorstores.ts:553`, `retrievers/index.ts:65`); we have no embedding or retrieval row at all | a new package or a seam in `packages/core` | L |
| GR-04 | PII and moderation as policy middleware | Their PII detection and redaction and the OpenAI moderation middleware run on every model call (`middleware/index.ts:19`, `:89`); our guardrails are caller-supplied tripwires only | `packages/core/src/agent/guardrail.ts` and middleware | M |
| HL-02, HL-06 | A pending approval as serialized state, and resume with a human value | Their HITL middleware interrupts the graph and accepts `approve`, `edit`, `reject` or `respond` on resume (`middleware/hitl.ts:11`, `:85`); a denial fails one call for us | `packages/core/src/agent/approval.ts` plus the run store | L (needs a durable suspended state) |
| TL-06 | Dynamic tool selection | Their `llmToolSelector` and per-middleware tools let a step choose a subset (`middleware/index.ts:15`); our registry is fixed per agent | the tool registry | S |

## B — non-goals

| id | what they ship | why it stays out | decision |
|---|---|---|---|
| OB-02 (hosted half) | LangSmith as a tracing and evaluation service | The tracer is a client; the service is a hosted control plane, which the port keeps out | 0018 |
| UI-06 | Chat and deployment transports (LangGraph Platform SDKs) | A server transport between a chat UI and an agent is deployment, not a library seam | 0018 |
| — | The classic chain and indexing surface | The v0.x chains, memory classes and indexing API are the generation the v1 agent replaced; porting them would import a second architecture | 0018 and the v1 boundary |

## C — unconsidered

| id | pattern | why it matters | fit | price |
|---|---|---|---|---|
| C-01 | Middleware-declared state fields | A middleware can own durable state without the caller editing the agent's schema (`ReactAgent.ts:248-254`); our `RunContext.state` is per run and closed | the state type in `packages/core` | M |
| C-02 | Validated control-flow jumps | A hook may redirect the graph to a named node and the constraint is checked at build time (`nodes/middleware.ts:132-159`); our loop has no named positions to jump to | the loop | L |
| C-03 | Strategy resolution per model | The agent picks native or tool-based structured output from the model it received (`AgentNode.ts:206-236`); our loop asks for a schema and validates afterwards | the loop | M |
| C-04 | Subagent stream projection | Nested named agents surface on `run.subagents` through a native transformer (`transformers/subagent.ts:58-73`); our child-agent runs are inline and invisible to a renderer | the event stream | M |
| C-05 | Provider-hosted tools | `ServerTool` is a record passed to the provider that executes it (`tools/index.ts:1085-1086`); our tool registry assumes a local implementation | the tool registry | M |

## D — depth gaps

| id | we ship | they ship | fit | price |
|---|---|---|---|---|
| TL-01 | One Zod schema per tool, JSON Schema for the model, one validation path | Thirteen `tool()` overloads over Zod v3, Zod v4, JSON Schema and serializable schemas, plus response formats and toolkits (`tools/index.ts:652-898`, `tools/types.ts:30`, `:81`) | `packages/core/src/tool/tool.ts` | M |
| RT-04, RT-05 | Streamed model output and a `code.delta` event | Token callbacks plus graph stream modes and transformers (`callbacks/base.ts:78`, `:97`; `ReactAgent.ts:1267`, `:1334`) | the event stream | M |
| RT-10 | One typed error taxonomy with `AgentErrorInfo` | Middleware and tool errors as distinct classes with policy middleware (`nodes/ToolNode.ts:23`, `middleware/index.ts:72`) | `packages/core/src/errors.ts` | S |
| MC-01, MC-02 | An MCP client with two transports and tool adaptation | A dedicated MCP adapter package with multi-server tool conversion (`libs/langchain-mcp-adapters`) | `packages/mcp` | M |
| RT-03 | A planning interval every N steps | A todo-list tool with its own prompt (`middleware/index.ts:53-57`) | the loop's planning step | S |

## What we have that they lack

- A loop we can read end to end: our code-action and tool-calling loops are a few files,
  while their loop is a compiled graph in another repository, which is why a reader of
  this profile cannot price a graph change.
- A capability bag read before the run (`ExecutorCapabilities`) and three
  interchangeable backends; they ship a runtime dependency instead.
- A narrow result type and an isomorphic core: no provider SDK in the core, whereas
  their compatibility layer accepts four schema kinds and two Zod majors in one
  signature.
- Refusal as a designed outcome: an unsupported capability is a typed refusal, not a
  runtime option flag such as `version: "v1" | "v2"`.

## Patterns worth copying

1. Middleware that owns its own state and tools. Evidence:
   `libs/langchain/src/agents/middleware.ts:76-114` and
   `libs/langchain/src/agents/ReactAgent.ts:225-254`. Why it matters: our middleware can
   wrap a step but cannot persist anything or add a tool, so context management and
   planning have to live inside the loop. Price L, fit
   `packages/core/src/middleware.ts`.
2. An invalid tool call becomes an observation, not a failed run. Evidence:
   `libs/langchain/src/agents/nodes/ToolNode.ts:113-125`. Why it matters: a small model
   gets one repair attempt instead of the caller losing the run. Price S, fit the tool
   executor.
3. Run managers passed down through every component (`callbacks/manager.ts:215-302`).
   Why it matters: our events are a flat stream and `buildTrace` has to reconstruct
   parentage; a run manager makes the tree structural. Price M, fit the event emitter.
4. Resolve a strategy from the model, not from the call site (`AgentNode.ts:206-236`).
   Price M, fit the loop.

## Patterns to avoid

1. Overload walls and schema unions. `createAgent` has thirteen overloads in a 730-line
   module, `tool()` thirteen, `withStructuredOutput` seven, and the same signatures
   accept Zod v3, Zod v4, JSON Schema and `SerializableSchema`
   (`agents/index.ts:176-702`, `core/tools/index.ts:652-898`,
   `core/language_models/chat_models.ts:1211-1289`). This port is 0.x and can choose one
   schema library and one signature per function; compatibility promises bought with
   overloads are paid on every change.
2. A legacy package without deprecation pressure. `@langchain/classic` is at 1.0.54,
   still exports `AgentExecutor` and `initializeAgentExecutor`, and keeps chains, memory
   and indexing alive (`classic/package.json:2-4`, `agents/executor.ts:352`). It doubles
   the surface a reader must classify, and their own README has to tell newcomers which
   half to use.
3. Behaviour flags inside one API. `version: "v1" | "v2"` on the agent changes how tool
   calls are grouped, and one middleware rejects v1 at runtime (`ReactAgent.ts:183`,
   `:206`, `:397`). A flag for old behaviour is a permanent branch and a configuration
   error waiting to happen; a new constructor or a new option object is cheaper to
   explain.
4. Public types held together by `any`. The agent's export module opens with an
   `oxlint-disable` for `no-explicit-any` (`libs/langchain/src/agents/index.ts:1`), and a
   provider-hosted tool is typed `Record<string, unknown>` (`core/tools/index.ts:1085`). A
   broad record is a compatibility shortcut; our 0.x types can stay narrow.

## What it should change for us

1. Middleware state and tools (A, L). Extend `packages/core/src/middleware.ts` so a
   middleware can declare a state slice, extra tools and a model-call wrapper; merge at
   construction as `ReactAgent` does.
2. Tool-error observation (A, S). Add an explicit tool error policy to the tool
   executor: observe (default), throw or custom, and pin the repair attempt with a test.
3. Provider structured output (A, M). Set `ModelCapabilities.structuredOutput` in the
   adapters, then have the loop choose native JSON schema output when the model declares
   it and fall back to prompt-and-validate otherwise.
4. Run tree for tracing (A, M). Give the event stream parent run ids and build spans
   from them, so an exporter is possible without reconstructing the tree.
5. Call limits and per-tool retry (A, S). Count model and tool calls per run with an
   explicit exit behaviour, and let a middleware retry one tool.
6. Do not adopt the graph runtime (C). Checkpointing, interrupts and jump targets come
   from LangGraph; buying them means buying the runtime, which is a different decision
   than a middleware seam.
7. Do not add retrieval to the core (C). Embeddings, vector stores and retrievers are a
   product area with its own dependency weight; record the refusal in the package docs
   when asked.

## Baseline corrections

- No baseline row contradicted the source. RT-08, GR-05, GR-06, TL-05, TL-06 and OB-02
  are accurate as written; the surprise is that GR-06's cheap repair loop is one branch
  in their tool node, so its price should be read as S rather than "not planned".
- The baseline has no row for embeddings or retrieval at all, while MD-06 records
  embeddings as absent. A missing row should not be read as a decision against
  retrieval; it was never considered, which is why it is bucketed C above and not B.

## Closing note

These are priced hypotheses for a D2 read. The evidence behind every row is in
`02-features-inventory.md`; the profile records what was not read, and the sources file
records how to refresh the read without rewriting it from memory.
