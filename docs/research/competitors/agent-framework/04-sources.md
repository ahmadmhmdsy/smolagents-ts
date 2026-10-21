# microsoft/agent-framework — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository and revision

| field | value |
|---|---|
| repository | https://github.com/microsoft/agent-framework |
| clone path | `reference/competitors/agent-framework/` |
| commit | `02005995380d5a09167e5c43b5d0f88328979145` |
| commit subject | `Python: Improve settled approval matching (#9535)` |
| commit date | 2026-10-21 11:31 +0000 |
| date read | 2026-10-21 |
| clone depth | one commit; no history available |
| licence | MIT (`LICENSE:1`); API returned `MIT` |
| licence caveat | none: the file is the full MIT text and the API agrees |

## Documentation URLs

| url | date read | note |
|---|---|---|
| https://learn.microsoft.com/en-us/agent-framework/ | not read | the official documentation; this dive read source instead |
| https://devblogs.microsoft.com/agent-framework/ | not read | release announcements linked from the readme |
| https://github.com/microsoft/agent-framework-go | not read | the separate Go implementation, referenced by `README.md:45` |
| https://pypi.org/project/agent-framework/ | not published check | package page for the Python meta package |

## Files read

Repository level: `README.md` (structure and feature claims), `dotnet/agent-framework-dotnet.slnx`, `python/packages/core/pyproject.toml`, `dotnet/src/Microsoft.Agents.AI.AGUI/README.md` (the migration note), and `python/AGENTS.md` and `dotnet/AGENTS.md` whose guidance documents the package layout.

.NET abstractions: `dotnet/src/Microsoft.Agents.AI.Abstractions/AIAgent.cs`, `dotnet/src/Microsoft.Agents.AI.Abstractions/AgentSession.cs`, `dotnet/src/Microsoft.Agents.AI.Abstractions/AgentResponse.cs`, `dotnet/src/Microsoft.Agents.AI.Abstractions/AgentResponseUpdate.cs`, `dotnet/src/Microsoft.Agents.AI.Abstractions/AgentRunOptions.cs`, `dotnet/src/Microsoft.Agents.AI.Abstractions/AgentRunContext.cs`, `dotnet/src/Microsoft.Agents.AI.Abstractions/AgentSessionStore.cs`, `dotnet/src/Microsoft.Agents.AI.Abstractions/ChatHistoryProvider.cs`, `dotnet/src/Microsoft.Agents.AI.Abstractions/AIContextProvider.cs`, `dotnet/src/Microsoft.Agents.AI.Abstractions/DelegatingAIAgent.cs`, `dotnet/src/Microsoft.Agents.AI.Abstractions/AIAgentStructuredOutput.cs`, `dotnet/src/Microsoft.Agents.AI.Abstractions/InMemoryChatHistoryProvider.cs`.

.NET workflows: `dotnet/src/Microsoft.Agents.AI.Workflows/Workflow.cs`, `dotnet/src/Microsoft.Agents.AI.Workflows/WorkflowBuilder.cs`, `dotnet/src/Microsoft.Agents.AI.Workflows/Executor.cs`, `dotnet/src/Microsoft.Agents.AI.Workflows/IWorkflowContext.cs`, `dotnet/src/Microsoft.Agents.AI.Workflows/RequestInfoEvent.cs`, `dotnet/src/Microsoft.Agents.AI.Workflows/CheckpointManager.cs`, `dotnet/src/Microsoft.Agents.AI.Workflows/AgentWorkflowBuilder.cs`, `dotnet/src/Microsoft.Agents.AI.Workflows/SequentialWorkflowBuilder.cs`, `dotnet/src/Microsoft.Agents.AI.Workflows/GroupChatWorkflowBuilder.cs`, `dotnet/src/Microsoft.Agents.AI.Workflows/HandoffWorkflowBuilder.cs`, `dotnet/src/Microsoft.Agents.AI.Workflows/MagenticWorkflowBuilder.cs`, the `Observability/` and `Evaluation/` type listings, and the `Microsoft.Agents.AI.Workflows.Declarative` builder.

.NET elsewhere: `dotnet/src/Microsoft.Agents.AI/OpenTelemetryAgent.cs`, `dotnet/src/Microsoft.Agents.AI.AgentHooks/Core/AgentHooksAgent.cs`, `AgentHooks/Core/*Gating*`, `dotnet/src/Microsoft.Agents.AI.A2A/A2AAgent.cs`, `dotnet/src/Microsoft.Agents.AI.A2A/A2AAgentSession.cs`, `dotnet/src/Microsoft.Agents.AI.A2A/Extensions/A2AClientExtensions.cs`, the `Microsoft.Agents.AI.Hosting.OpenAI` route extensions, and the `Evaluation` helpers.

Python: `python/packages/core/agent_framework/_agents.py` (protocols, `BaseAgent`, `Agent.run`), `python/packages/core/agent_framework/_clients.py`, `python/packages/core/agent_framework/_sessions.py`, `python/packages/core/agent_framework/_middleware.py`, `python/packages/core/agent_framework/_feature_stage.py`, `python/packages/core/agent_framework/_telemetry.py`, the `_workflows/` package (`python/packages/core/agent_framework/_workflows/_workflow.py`, `python/packages/core/agent_framework/_workflows/_workflow_builder.py`, `python/packages/core/agent_framework/_workflows/_workflow_context.py`), the orchestrations package (`python/packages/orchestrations/agent_framework_orchestrations/_handoff.py`, `python/packages/orchestrations/agent_framework_orchestrations/_magentic.py`), `python/packages/a2a/agent_framework_a2a/_agent.py`, `python/packages/ag-ui/agent_framework_ag_ui/_approval_lifecycle.py`, and `python/packages/declarative/agent_framework_declarative/_loader.py`.

Decision records, read in full: `0001`, `0003`, `0005`, `0006`, `0010`, `0018`, `0021`, `0036`. Others were cited by title only and are marked `declared` in `docs/research/competitors/agent-framework/02-features-inventory.md`.

## Commands run

- `gh api repos/microsoft/agent-framework --jq '.license.spdx_id'` returned `MIT`.
- `git clone --depth 1 https://github.com/microsoft/agent-framework reference/competitors/agent-framework`, then `git rev-parse HEAD`, `git log -1`, `git rev-parse --is-shallow-repository`.
- `Get-ChildItem` counts: 43 Python projects, 34 .NET source projects, 337 `.csproj`, 53 decision records, 2,187 C# files, 1,310 Python files, 86 TypeScript files.
- `Select-String` and directory listings for line anchors; no file was executed.

## What was not verified

- Nothing was built, installed, tested or run from the clone.
- The workflow execution loop, concurrency and superstep semantics were not read line by line.
- Provider adapters and their capability declarations were not read.
- Hosting middleware was read as route registration only; its protocol behaviour was not traced.
- The documentation site, the DevUI front end and the sample projects were not read.
- Readme claims such as time travel and Foundry hosting are recorded as declared, never as implemented.

## How to refresh

1. Fetch and compare: `git -C reference/competitors/agent-framework fetch --depth 1 origin main`, then `git rev-parse HEAD`.
2. Re-check the licence first: `gh api repos/microsoft/agent-framework --jq '.license.spdx_id'`.
3. Follow the same evidence paths as `docs/research/competitors/agent-framework/02-features-inventory.md`; a moved or deleted file is itself a finding worth recording.
4. File a new set frozen at the new commit; these four files are not edited after filing.

