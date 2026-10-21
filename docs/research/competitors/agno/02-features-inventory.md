# agno — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Reading this table**

Every `docs.agno.com/...` cell names a page read as Markdown on 2026-10-21; the
scheme is https and the page text was current at the read commit. `implemented`
means the documentation shows the parts and their connection; `declared` means a
flag, route or type is documented without an end-to-end path; `inferred` means
the structure is named in the repository tree and the purpose follows from it.

**Agent surface**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| Agent | implemented | `docs.agno.com/agents/overview` | Builds context, runs the model, executes requested tools, returns a `RunOutput` | the unit a product serves |
| Team, with `TeamMode` | implemented | `docs.agno.com/teams/overview` | coordinate, route, broadcast or tasks mode; leader and members each make model calls | explicit multi-agent topology without writing a graph |
| Nested teams | implemented | `docs.agno.com/teams/overview` | a team may list a team among its members | composition for larger organisations of agents |
| Workflow and step containers | implemented | `docs.agno.com/workflows/overview` | `Steps`, `Parallel`, `Loop`, `Condition`, `Router`; agents, teams and functions auto-wrap | deterministic control flow around stochastic steps |
| Callable factories | implemented | `docs.agno.com/teams/overview` | tools, members and knowledge may be functions resolved per run with injected context | per-tenant or per-user composition at run time |
| Versioned components | declared | `docs.agno.com/features/api` | draft, publish, roll back a component through the API | serve a pinned version while editing the next |

**Sessions, memory and context**

Agno separates four kinds of state that we currently keep in one conversation
object: messages, user facts, application state and a summary of older turns.

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| Session, run and user identity | implemented | `docs.agno.com/sessions/overview` | `run_id` per execution, `session_id` per thread, `user_id` per person | separate threads and people inside one service |
| Session and run tables | implemented | `docs.agno.com/features/storage` | `agno_sessions` metadata and state, `agno_runs` for normalised run records | one queryable store for history and state |
| Chat history window | implemented | `docs.agno.com/sessions/overview` | `add_history_to_context`, bounded by runs or messages | continuity without unbounded prompts |
| Session summaries | implemented | `docs.agno.com/sessions/session-summaries` | a model-written description of earlier turns, optionally alongside recent history | token control on long threads |
| Memory, automatic or agentic | implemented | `docs.agno.com/memory/overview` | extraction each run, or an `update_user_memory` tool the model calls; rows in `agno_memories` | facts about a person that outlive a thread |
| Memory manager permissions | implemented | `docs.agno.com/memory/overview` | delete and clear flags on the manager, which do not constrain automatic extraction | let an operator choose how much the agent may forget |
| Learnings | declared | `docs.agno.com/features/api` | records captured from runs in `agno_learnings`, with create, list, update and delete routes | turn experience into reusable knowledge |
| Session state | implemented | `docs.agno.com/memory/overview` | `session_state` written by code or tools, scoped to one session | application data a workflow carries forward |
| Per-user data boundary | declared | `docs.agno.com/features/security-and-auth` | opt-in reads, writes and ownership checks scoped to the JWT subject | multi-tenant isolation at the runtime |
| Storage backends | implemented | `docs.agno.com/features/storage` | JSON file, embedded, relational, document, key-value and distributed adapters behind one `db` interface | let the operator keep their own database |

**Durability, resume and human-in-the-loop**

This is the deepest part of the product and the part closest to our HL rows.
Pause, crash and disconnect are treated as three different events with three
different recovery contracts.

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| Tool-batch checkpoint | declared | `docs.agno.com/examples/agents/checkpointing/crash-recovery` | `checkpoint="tool-batch"` writes the run after each batch, marked RUNNING; without it only terminal states persist | a hard crash leaves a resumable row instead of a lost run |
| Continue a run in place | declared | `docs.agno.com/examples/agents/checkpointing/crash-recovery` | `/continue` resumes a RUNNING run under the same `run_id`; Python exposes `continue_run` and `acontinue_run` | recovery without inventing a second run |
| Checkpoint timeline endpoint | declared | `docs.agno.com/examples/agents/checkpointing/checkpoint-endpoints` | boundaries derived from message markers, no checkpoint table; a truncated snapshot is returned per index | a UI can offer resume points without a parallel store |
| Replay boundaries and forks | declared | `docs.agno.com/agent-os/multi-framework/step-replay` | `continue_from` takes `end`, `last_user`, an index or zero; completed runs always fork | branch a conversation without destroying the source |
| Persisted approvals | declared | `docs.agno.com/hitl/approval` | a protected tool pauses the run and writes a pending record to `agno_approvals`; the application authorises who resolves it | human sign-off that survives a restart |
| HITL pause kinds | implemented | `docs.agno.com/hitl/overview` | confirmation, user input or external execution requirements resolved through `active_requirements` | cover approval, missing data and outsourced work with one primitive |
| Background execution modes | implemented | `docs.agno.com/background-execution/overview` | fire-and-forget returns PENDING, resumable streaming buffers events and reconnects through `/resume` | work that outlives an HTTP request |
| Durable job queue | implemented | `docs.agno.com/agent-os/background-execution/durable-queue` | a row in `agno_jobs` before the 202, workers claim under a refreshed lease; `max_attempts` 1 marks a crashed run ERROR, 2 or more reclaims it and discards late writes | accept work without a broker service |
| Cancellation | implemented | `docs.agno.com/run-cancellation/overview` | `cancel_run` records intent; runs stop at the next cooperative checkpoint and external side effects are not rolled back | stop long work without pretending it is transactional |
| Run status vocabulary | declared | `docs.agno.com/agent-os/background-execution/durable-queue` | COMPLETED, ERROR, CANCELLED and PAUSED are the settled states named in the queue contract | one status a UI and a queue can agree on |

**Tools, skills and retrieval**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| Tool from a function | implemented | `docs.agno.com/tools/overview` | a tool definition is built from name, docstring and type hints | lowest-friction tool authoring |
| Toolkits | implemented | `docs.agno.com/tools/toolkits/overview` | related functions shipped as one package with shared state; over a hundred listed | integrations as an install, not a rewrite |
| MCP tools | implemented | `docs.agno.com/tools/overview` | an `MCPTools` source connects to a server's tools | reuse the protocol ecosystem |
| Context providers | declared | `docs.agno.com/context-providers/overview` | a provider exposes one query tool over live data; a workspace provider wraps a directory | keep data access out of the prompt |
| Skills | implemented | `docs.agno.com/skills/overview` | `SKILL.md` packages with metadata in the system prompt and three retrieval tools for instructions, references and scripts | progressive disclosure of procedures |
| Knowledge ingestion | implemented | `docs.agno.com/knowledge/overview` | read files, URLs or text, chunk and embed into a vector database | grounding beyond the model's weights |
| Agentic retrieval | implemented | `docs.agno.com/knowledge/overview` | the agent decides when to search; traditional RAG injects always | context on demand rather than every call |
| Search modes | declared | `docs.agno.com/features/api` | vector, keyword and hybrid search routes over knowledge | retrieval quality is a runtime choice |
| FileSystem note store | implemented | `docs.agno.com/filesystem/overview` | `FileSystem(db)` gives tools and instructions for durable notes read in a later process | a working memory an agent can write |
| Workspace toolkit | implemented | `docs.agno.com/tools/toolkits/local/workspace` | root-scoped read, list and search; write, edit, move, delete and shell require confirmation | local files and a shell under human control |
| Sandbox module | inferred | `libs/agno/agno/sandbox` module tree | `checkpoint.py`, `postgres_checkpoints.py`, docker and agentcore providers, a coordinator and a runtime | remote execution with resumable guests |

**Runtime, control plane and operations**

The runtime is a FastAPI application assembled from the SDK objects; the control
plane is a separate hosted client of it.

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| AgentOS application | implemented | `docs.agno.com/agent-os/overview` | a FastAPI app you own, configured with agents, teams, workflows and a default database | the runtime as a library of routes |
| HTTP surface | implemented | `docs.agno.com/features/api` | REST, SSE and workflow WebSocket routes for runs, sessions, memory, knowledge, traces, evals, schedules, approvals and components | a product API without writing handlers |
| Chat and protocol interfaces | implemented | `docs.agno.com/features/interfaces` | Slack, Telegram, WhatsApp, Discord, A2A and AG-UI adapters register their own routes | meet users where they are |
| MCP server mode | implemented | `docs.agno.com/agent-os/introduction` | `AgentOS(mcp=True)` exposes the registered components as MCP | agents callable from coding tools |
| Authorization | implemented | `docs.agno.com/features/security-and-auth` | JWT verification, per-endpoint scopes, service accounts, optional audience check | multi-user access without a second service |
| Public surface | declared | `docs.agno.com/agent-os/public-surface` | a selected subset of components behind PostgreSQL rate limits, with admin routes returning 404 | expose a safe product API to anonymous clients |
| Tracing | implemented | `docs.agno.com/features/observability` | `tracing=True` writes OpenTelemetry spans to `agno_traces` and `agno_spans` | explain failures across models, tools and steps |
| Metrics and evals | declared | `docs.agno.com/features/api` | daily run, session, user and token aggregates; accuracy, judge, performance and reliability evals | operate and improve with stored evidence |
| Scheduler | implemented | `docs.agno.com/scheduler/overview` | cron schedules stored in `agno_schedules`, with run history and retries | recurring work with no external scheduler |
| Durable worker | declared | `docs.agno.com/agent-os/overview` | `queue=QueueConfig(durable=True)` persists accepted jobs on a Postgres database | survive a process restart between accept and run |
| Control Plane | declared | `docs.agno.com/agent-os/control-plane` | a hosted web app at os.agno.com that connects from the browser to a runtime for chat, traces, approvals, knowledge and Studio | operate many runtimes from one screen |
| CLI | implemented | `docs.agno.com/cli/overview` | `agno` and `agnoctl` scaffold projects, run Docker Compose, connect MCP clients and mint tokens, with `--json` output | humans and coding agents drive the platform |
| Deployment templates | implemented | `docs.agno.com/deploy/introduction` | nine starter repositories, one per deployment target | start from a working platform |

**Output, streaming and evaluation**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| Schema-validated output | implemented | `docs.agno.com/input-output/output-model` | an `output_schema` type is enforced on the final answer | turn a conversation into a record |
| Streaming run events | implemented | `docs.agno.com/features/api` | SSE frames for tokens, tool calls and workflow steps, plus a workflow WebSocket route | render a run while it happens |
| Resumable streaming | declared | `docs.agno.com/background-execution/overview` | buffered events replayed from `/resume` after a disconnect | a client may reconnect without losing output |
| Step-level HITL for workflows | declared | `docs.agno.com/workflows/hitl/overview` | a paused executor resumes and emits a continued event | pause inside a deterministic pipeline |
| Session management routes | declared | `docs.agno.com/features/api` | create, list, rename, update, delete, and read every run in a session | operate conversations as resources |
| Dependencies injection | declared | `docs.agno.com/dependencies/overview` | per-request values reach instruction templates and tools | carry request context without globals |
| Compression | implemented | `docs.agno.com/compression/overview` | summarises eligible tool-result messages before later model requests | bound context growth from large tool output |
| Evaluation suite | implemented | `docs.agno.com/evals/overview` | accuracy, agent-as-judge, performance and reliability runs stored in the database | measure changes instead of guessing |
**Also present, noted but not traced**

- Models: native adapters for many providers plus local runtimes, fallback and
  response caching (`docs.agno.com/models/overview`).
- Reasoning, multimodal input and output models, and compression of verbose
  tool results (`docs.agno.com/compression/overview`).
- Dependency injection into instructions, hooks before and after a run, and a
  typed event stream for streaming runs (`docs.agno.com/hooks/overview`).
- Execution traces rendered as a tree and a waterfall in the Control Plane
  (`docs.agno.com/features/control-plane`).
- Telemetry on by default for run counts, disabled with an environment flag, and
  the claim that prompts and outputs are never sent (README).
- Learning and simulation material in the cookbook, tied to the `learn` module
  and the `agno_learnings` table (`docs.agno.com/features/api`).

**Notable implementation notes**

- The platform ships inside the SDK distribution. `agno/os`, `agno/sandbox`,
  `agno/job_queue`, `agno/scheduler` and `agno/registry` are ordinary modules of
  the same wheel, so `pip install agno` brings the server, the queue and the
  database schema helpers into the application process.
- Every feature reuses one database interface rather than a message bus. The
  queue, the scheduler, the approvals and the traces are tables, which keeps
  operations simple and couples feature capability to adapter capability.
- Approvals are deliberately split between the SDK and the application: the SDK
  records and resolves a requirement, and the docs state plainly that the
  application must authorise who may resolve and continue.
- Checkpoint boundaries are inferred from the persisted transcript instead of
  stored separately; the endpoint derives a truncated snapshot at a message
  index. This is less machinery than a checkpoint table and constrains replay
  to conversation-level boundaries.
- The Control Plane is hosted and connects from the browser to the operator's
  runtime, so there is no server-side data path through Agno for chats or
  traces.

**Declared but thin**

- The sandbox module has no documentation page found in the index; its providers,
  checkpoint store and coordinator are named in the tree only.
- Durable queue acceptance is explicitly not completion: a paused run can wait
  for a compatible worker, and at `max_attempts=1` a crashed run is failed for
  an operator to requeue.
- Replay restores conversation context only; files, MCP operations and tool side
  effects are not rewound, and the docs tell the reader to keep tools idempotent.