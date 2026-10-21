# microsoft/agent-framework — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Courses through the code first, then the decision log. Strength marks: `implemented` means the behaviour is visible in source read at the cited line; `declared` means an accepted record, spec or readme states it; `inferred` means only file presence supports it.

## 1. Packaging and language surfaces

| capability | evidence | strength |
|---|---|---|
| one .NET solution over per-component projects | `dotnet/agent-framework-dotnet.slnx:1` | implemented |
| Python workspace of 43 projects, core plus provider and hosting packages | `python/packages/core/pyproject.toml:2` | implemented |
| meta package re-exporting the Python surface | `python/packages/core/pyproject.toml:151` | implemented |
| core kept light by moving providers out (provider-leading names) | `clone:/docs/decisions/0021-provider-leading-clients.md:34` | declared |
| agent primitives on .NET come from `Microsoft.Extensions.AI` | `dotnet/src/Microsoft.Agents.AI.Abstractions/ChatHistoryProvider.cs:51` | implemented |
| experimental work isolated in a lab package | `README.md:60` | declared |
| YAML/JSON agent definitions in their own packages, both languages | `dotnet/src/Microsoft.Agents.AI.Workflows.Declarative/DeclarativeWorkflowBuilder.cs:17` | implemented |

The packaging answer to portability is duplication with a shared vocabulary: no code is shared, the type names and behaviour are kept correlatable by review discipline and the decision log.

## 2. Agent abstraction

| capability | evidence | strength |
|---|---|---|
| abstract agent with id, name, description and service lookup | `dotnet/src/Microsoft.Agents.AI.Abstractions/AIAgent.cs:38`, `:82`, `:118` | implemented |
| per-run ambient context carried on an async-local slot | `dotnet/src/Microsoft.Agents.AI.Abstractions/AIAgent.cs:40`, `:102` | implemented |
| session creation and JSON serialization delegated to the agent | `dotnet/src/Microsoft.Agents.AI.Abstractions/AIAgent.cs:155`, `:187` | implemented |
| session is an abstract state holder with a serializable bag | `dotnet/src/Microsoft.Agents.AI.Abstractions/AgentSession.cs:59`, `:85` | implemented |
| response object carries messages, usage, finish reason and continuation token | `dotnet/src/Microsoft.Agents.AI.Abstractions/AgentResponse.cs:28`, `:58` | implemented |
| incremental response type for streaming | `dotnet/src/Microsoft.Agents.AI.Abstractions/AgentResponseUpdate.cs:35` | implemented |
| run options and per-run context are separate types | `dotnet/src/Microsoft.Agents.AI.Abstractions/AgentRunOptions.cs:19`, `dotnet/src/Microsoft.Agents.AI.Abstractions/AgentRunContext.cs:10` | implemented |
| a stock agent that wraps a chat client | `dotnet/src/Microsoft.Agents.AI/ChatClient/ChatClientAgentOptions.cs:18` | implemented |
| decorator base so cross-cutting behaviour wraps any agent | `dotnet/src/Microsoft.Agents.AI.Abstractions/DelegatingAIAgent.cs:28`, `:88` | implemented |
| Python agent protocols plus a thin base and a full-featured agent | `python/packages/core/agent_framework/_agents.py:288`, `:428`, `:1999` | implemented |
| Python run is one overloaded call taking stream, session, tools and middleware | `python/packages/core/agent_framework/_agents.py:2065` | implemented |
| Python chat client protocol and base with middleware hooks | `python/packages/core/agent_framework/_clients.py:85`, `:221` | implemented |
| three middleware layers: agent, function, chat | `python/packages/core/agent_framework/_middleware.py:848`, `:920`, `:1011` | implemented |
| middleware pipelines are explicit classes, not implicit chains | `python/packages/core/agent_framework/_middleware.py:1302` | implemented |
| .NET hooks package instruments a run through a delegating agent | `dotnet/src/Microsoft.Agents.AI.AgentHooks/Core/AgentHooksAgent.cs:27` | implemented |
| behaviour is contributed by context and history providers | `dotnet/src/Microsoft.Agents.AI.Abstractions/AIContextProvider.cs:42`, `dotnet/src/Microsoft.Agents.AI.Abstractions/ChatHistoryProvider.cs:51` | implemented |
| provider state keys are declared so several providers can share a session | `dotnet/src/Microsoft.Agents.AI.Abstractions/ChatHistoryProvider.cs:88` | implemented |
| session persistence is a pluggable store, memory or file backed | `dotnet/src/Microsoft.Agents.AI.Abstractions/AgentSessionStore.cs:20`; `python/packages/core/agent_framework/_sessions.py:1927`, `:2004` | implemented |
| structured output split between response-format plus deserialize, and a generic run | `dotnet/src/Microsoft.Agents.AI.Abstractions/AIAgentStructuredOutput.cs:16`; `clone:/docs/decisions/0036-structured-output.md:16` | implemented |
| Python context and history providers, same split as .NET | `python/packages/core/agent_framework/_sessions.py:752`, `:988` | implemented |

Two design choices recur: a session is state only, and everything that behaves is a provider that can be attached to it; and a run is always described by options plus ambient context, never by mutating the agent.

## 3. Workflow graph

| capability | evidence | strength |
|---|---|---|
| a workflow is executor bindings, edges and external request ports | `dotnet/src/Microsoft.Agents.AI.Workflows/Workflow.cs:19`, `:24`, `:26`, `:44` | implemented |
| builder adds direct, typed, fan-out and fan-in edges before building | `dotnet/src/Microsoft.Agents.AI.Workflows/WorkflowBuilder.cs:254`, `:336`, `:406`, `:499`, `:672` | implemented |
| an executor declares the message types it sends and yields via a protocol | `dotnet/src/Microsoft.Agents.AI.Workflows/Executor.cs:165`, `:222` | implemented |
| execution context offers send, yield, halt and scoped state | `dotnet/src/Microsoft.Agents.AI.Workflows/IWorkflowContext.cs:35`, `:49`, `:55`, `:139` | implemented |
| Python mirror: builder and context with the same verbs | `python/packages/core/agent_framework/_workflows/_workflow_builder.py:230`, `:566`; `python/packages/core/agent_framework/_workflows/_workflow_context.py:319`, `:351` | implemented |
| external requests are the pause primitive, raised from inside an executor | `dotnet/src/Microsoft.Agents.AI.Workflows/RequestInfoEvent.cs:8`; `python/packages/core/agent_framework/_workflows/_workflow_context.py:404` | implemented |
| checkpoints are committed through a manager with an in-memory and a JSON store | `dotnet/src/Microsoft.Agents.AI.Workflows/CheckpointManager.cs:14`, `:34`, `:48`, `:54` | implemented |
| Python run result exposes outputs, intermediate outputs, request events and final state | `python/packages/core/agent_framework/_workflows/_workflow.py:131`, `:155`, `:171`, `:179` | implemented |
| a workflow can be wrapped again as an agent | `dotnet/src/Microsoft.Agents.AI.Workflows/WorkflowHostAgent.cs:1` | inferred |

Because requests are graph-level instead of callback-level, human input and checkpointing are the same mechanism: the run stops at a port and resumes from a checkpoint.

## 4. The five patterns are builders

| capability | evidence | strength |
|---|---|---|
| sequential chain of agents, optionally chaining only their responses | `dotnet/src/Microsoft.Agents.AI.Workflows/AgentWorkflowBuilder.cs:27`; `dotnet/src/Microsoft.Agents.AI.Workflows/SequentialWorkflowBuilder.cs:32` | implemented |
| concurrent fan-out over agents | `dotnet/src/Microsoft.Agents.AI.Workflows/AgentWorkflowBuilder.cs:87` | implemented |
| handoff builder seeded from an initial agent | `dotnet/src/Microsoft.Agents.AI.Workflows/AgentWorkflowBuilder.cs:138`; `dotnet/src/Microsoft.Agents.AI.Workflows/HandoffWorkflowBuilder.cs:561` | implemented |
| group chat builder over a manager factory | `dotnet/src/Microsoft.Agents.AI.Workflows/AgentWorkflowBuilder.cs:156`; `dotnet/src/Microsoft.Agents.AI.Workflows/GroupChatWorkflowBuilder.cs:50` | implemented |
| magentic builder over a manager agent that plans and reviews | `dotnet/src/Microsoft.Agents.AI.Workflows/AgentWorkflowBuilder.cs:183`; `dotnet/src/Microsoft.Agents.AI.Workflows/MagenticWorkflowBuilder.cs:190` | implemented |
| Python ships the same five as an orchestrations package | `python/packages/orchestrations/agent_framework_orchestrations/_handoff.py:93`, `:243` | implemented |
| magentic keeps a task ledger and a progress ledger as serializable state | `python/packages/orchestrations/agent_framework_orchestrations/_magentic.py:274`, `:310`, `:486` | implemented |

The pattern catalogue is a thin layer: each builder wires executors and edges, and none of them introduces a second execution model.

## 5. Human-in-the-loop and approvals

| capability | evidence | strength |
|---|---|---|
| approvals modelled as content types so a remote agent can suspend and return | `clone:/docs/decisions/0006-userapproval.md:15` | declared |
| function approval request and response as first-class contents | `clone:/docs/decisions/0006-userapproval.md:1` | declared |
| unanswered tool approvals have a documented outcome | `clone:/docs/decisions/0045-dotnet-unanswered-tool-approvals.md:1` | declared |
| magentic review requests are workflow messages, not callbacks | `dotnet/src/Microsoft.Agents.AI.Workflows/MagenticPlanReviewRequest.cs:1` | inferred |
| agent hooks gate history and context write-back per run | `dotnet/src/Microsoft.Agents.AI.AgentHooks/Core/AgentHooksGatingChatHistoryProvider.cs:18` | implemented |

The approval model is a good example of their portability rule: the decision is a value that travels in the conversation, so it survives serialization, transport and checkpointing.

## 6. Telemetry, evaluation and gating

| capability | evidence | strength |
|---|---|---|
| telemetry as a delegating agent wrapper instead of instrumentation inside the base class | `dotnet/src/Microsoft.Agents.AI/OpenTelemetryAgent.cs:33`; `clone:/docs/decisions/0003-agent-opentelemetry-instrumentation.md:58` | implemented |
| workflow telemetry options and a per-workflow telemetry context | `dotnet/src/Microsoft.Agents.AI.Workflows/Observability/WorkflowTelemetryOptions.cs:8`, `dotnet/src/Microsoft.Agents.AI.Workflows/Observability/WorkflowTelemetryContext.cs:13` | implemented |
| activity, event and tag names live in one place for tracing | `dotnet/src/Microsoft.Agents.AI.Workflows/Observability/ActivityNames.cs:5`, `dotnet/src/Microsoft.Agents.AI.Workflows/Observability/EventNames.cs:5`, `dotnet/src/Microsoft.Agents.AI.Workflows/Observability/Tags.cs:5` | implemented |
| feature usage recorded as a bit mask and reported in the user agent | `python/packages/core/agent_framework/_telemetry.py:36`; `clone:/docs/decisions/0033-feature-usage-bitmask-user-agent.md:1` | implemented |
| agent and workflow evaluation helpers | `dotnet/src/Microsoft.Agents.AI/Evaluation/AgentEvaluationResults.cs:14`; `dotnet/src/Microsoft.Agents.AI.Workflows/Evaluation/WorkflowEvaluationExtensions.cs:16` | implemented |
| experimental and release-candidate stages warn at first use | `python/packages/core/agent_framework/_feature_stage.py:43`, `:70`, `:85` | implemented |

The gating machinery is the part most worth stealing: a feature id, a stage, a one-time warning that names the feature, and an anonymous usage bit in the client identity.

## 7. Interop and hosting

| capability | evidence | strength |
|---|---|---|
| A2A client agent and session with continuation tokens | `dotnet/src/Microsoft.Agents.AI.A2A/A2AAgent.cs:29`, `dotnet/src/Microsoft.Agents.AI.A2A/A2AAgentSession.cs:16`, `dotnet/src/Microsoft.Agents.AI.A2A/A2AContinuationToken.cs:11` | implemented |
| A2A card resolution and conversion helpers | `dotnet/src/Microsoft.Agents.AI.A2A/Extensions/A2AClientExtensions.cs:23` | implemented |
| Python A2A agent built on the same base agent and session | `python/packages/a2a/agent_framework_a2a/_agent.py:290`, `:107` | implemented |
| AG-UI protocol removed from .NET in favour of an external SDK, hosting glue kept | `dotnet/src/Microsoft.Agents.AI.AGUI/README.md:1` | implemented |
| AG-UI decisions recorded before the move | `clone:/docs/decisions/0010-ag-ui-support.md:35` | declared |
| Python AG-UI approval lifecycle with explicit conflict errors | `python/packages/ag-ui/agent_framework_ag_ui/_approval_lifecycle.py:93` | implemented |
| MCP client tools and hosting conversion helpers | `clone:/docs/decisions/0029-mcp-skill-templates-and-direct-references.md:1` | declared |
| an OpenAI-compatible server: responses, chat completions and conversations routes | `dotnet/src/Microsoft.Agents.AI.Hosting.OpenAI/EndpointRouteBuilderExtensions.Responses.cs:19`, `dotnet/src/Microsoft.Agents.AI.Hosting.OpenAI/EndpointRouteBuilderExtensions.ChatCompletions.cs:17`, `dotnet/src/Microsoft.Agents.AI.Hosting.OpenAI/EndpointRouteBuilderExtensions.Conversations.cs:16` | implemented |
| hosting registered through a builder extension | `dotnet/src/Microsoft.Agents.AI.Hosting.OpenAI/HostApplicationBuilderExtensions.cs:13` | implemented |
| declarative YAML compiled into a workflow | `dotnet/src/Microsoft.Agents.AI.Workflows.Declarative/DeclarativeWorkflowBuilder.cs:41`; `python/packages/declarative/agent_framework_declarative/_loader.py:144` | implemented |
| declarative agents and workflows are first-class readme features | `README.md:56` | declared |

Interop is treated as a boundary concern: protocol packages convert at the edge, and the public API on each side stays in framework types.


## 8. The decision log as a capability map

Most design answers in this repository are written down before they are coded. The records that a reader of this inventory should open next:

| record | question it settles |
|---|---|
| `clone:/docs/decisions/0001-agent-run-response.md:1` | what an agent run returns: primary response versus secondary progress |
| `clone:/docs/decisions/0003-agent-opentelemetry-instrumentation.md:1` | telemetry as a wrapper, not as inherited instrumentation |
| `clone:/docs/decisions/0005-python-naming-conventions.md:1` | how Python names map onto .NET names, one rename at a time |
| `clone:/docs/decisions/0006-userapproval.md:1` | approvals as conversation content, able to suspend a remote run |
| `clone:/docs/decisions/0007-agent-filtering-middleware.md:1` | filtering agent output through middleware |
| `clone:/docs/decisions/0009-support-long-running-operations.md:1` | long-running work as a continuation, not a stalled call |
| `clone:/docs/decisions/0010-ag-ui-support.md:1` | protocol events kept internal, framework types public |
| `clone:/docs/decisions/0014-feature-collections.md:1` | grouping experimental features under shared ids |
| `clone:/docs/decisions/0015-agent-run-context.md:1` | ambient per-run context |
| `clone:/docs/decisions/0018-agentthread-serialization.md:1` | splitting session state from session behaviour for serialization |
| `clone:/docs/decisions/0019-python-context-compaction-strategy.md:1` | compaction as a named strategy |
| `clone:/docs/decisions/0022-chat-history-persistence-consistency.md:1` | when history is written relative to a response |
| `clone:/docs/decisions/0026-hosted-session-identity-context.md:1` | session identity when the agent is hosted |
| `clone:/docs/decisions/0032-durable-azure-functions-extraction.md:1` | moving durable orchestration out of tree |
| `clone:/docs/decisions/0036-structured-output.md:1` | two structured-output call shapes and why one is not on the base class |
| `clone:/docs/decisions/0045-dotnet-unanswered-tool-approvals.md:1` | what happens when an approval never arrives |

A spec complements the log for the area with the most behavioural risk: the Python function-calling loop has a stable written contract (`clone:/docs/specs/004-python-function-calling-loop.md:1`), which is more than most frameworks publish.

## 9. Additional capability rows

| capability | evidence | strength |
|---|---|---|
| filtering and rewriting of agent output in the agent layer | `clone:/docs/decisions/0007-agent-filtering-middleware.md:1` | declared |,| long-running operations surfaced as continuation tokens | `clone:/docs/decisions/0009-support-long-running-operations.md:1`; `dotnet/src/Microsoft.Agents.AI.A2A/A2AContinuationToken.cs:11` | implemented |,| compaction strategy selectable per run | `clone:/docs/decisions/0019-python-context-compaction-strategy.md:1` | declared |,| session identity distinct from service conversation id | `clone:/docs/decisions/0026-hosted-session-identity-context.md:1` | declared |,| per-user isolation of hosted conversation storage | `dotnet/src/Microsoft.Agents.AI.Hosting.OpenAI/Conversations/IsolationKeyScopedConversationStorage.cs:21` | implemented |,| append-only file history provider with framed records | `python/packages/core/agent_framework/_sessions.py:988` | implemented |,| agent-mode and background-agent providers in the harness | `dotnet/src/Microsoft.Agents.AI/Harness/AgentMode/AgentModeProvider.cs:49` | implemented |,| file access and memory providers with approval-gated tools | `python/packages/core/agent_framework/_harness/_file_access.py:1` | declared |,| computer-use content with a safety check gate | `clone:/docs/specs/005-python-content-identity-and-protocol-metadata.md:1` | declared |,| observable run status timeline in the Python result | `python/packages/core/agent_framework/_workflows/_workflow.py:192` | implemented |
## 10. Declared but not verified in source

- The readme claims checkpointing, streaming and time travel as part of the orchestration feature (`README.md:50`); checkpointing is implemented, time travel is a UI claim.
- Foundry-hosted deployment and the DevUI are readme features (`README.md:52`, `README.md:62`); neither was read.
- Skills, CodeAct and declarative agents have accepted decisions (`clone:/docs/decisions/0037-agent-skills-design.md:1`, `clone:/docs/decisions/0038-codeact-integration.md:1`) and packages, but no implementation was read.
- The durable Azure Functions integration has been extracted out of tree (`clone:/docs/decisions/0032-durable-azure-functions-extraction.md:1`), so durability here means checkpoint and resume, not an external orchestrator.
