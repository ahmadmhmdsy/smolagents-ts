# autogen — competitor profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Identity

| field | value |
|---|---|
| repository | https://github.com/microsoft/autogen |
| register row | `docs/research/competitors/README.md:69` puts `autogen` in the register with the focus "group chat, code executors, agent runtime" and a licence guess of "MIT (verify)"; this dive is the assigned D2 profile, four files, no architecture file |
| licence | two licences, one per kind of content. `LICENSE:1` is Attribution 4.0 International (CC-BY-4.0, 305 lines) covering documentation; `LICENSE-CODE:1-3` is MIT covering code, with a Microsoft copyright line. GitHub reports the root file, so the API answers `CC-BY-4.0` although packages ship under the MIT file (`python/packages/pyautogen/pyproject.toml:8`). Both are recorded; the register's "MIT (verify)" is half right |
| read commit | `004749e6b7102c8fd317b9b1499ce5807223c278`, 2026-10-16 17:14:36 +0100, subject `docs: clarify AutoGen is archived and no longer maintained- #1 (#8366)` |
| clone | `reference/competitors/autogen`, shallow (`--depth 1`), clean worktree at the read |
| status | archived. `README.md:14` carries the archived badge, `:19-31` says Microsoft provides no fixes, features or support and names Microsoft Agent Framework as successor, and `:183` repeats that the architecture is kept for reference |
| packages | Python: `autogen-core`, `autogen-agentchat`, `autogen-ext` all at 0.7.5; `autogen-magentic-one` holds a README and a licence only; `magentic-one-cli` 0.2.4; `autogenstudio`; `agbench`; test utilities; and `pyautogen` 0.10.0, an empty proxy package. Beside them: `dotnet/`, `protos/`, `docs/design/` |
| language and stack | Python 3.10 or newer (`README.md:35`), asyncio, Pydantic, protobuf and gRPC at the worker boundary, OpenTelemetry for spans; C# for the .NET packages |
| size signal | `autogen-core` 67 files and about 7,250 lines; `autogen-agentchat` 44 files and about 9,000 lines; `autogen-ext` 144 files and about 24,700 lines; `autogen-studio` a FastAPI backend and a React frontend |

## Two generations in one tree

The tree is the 0.4-and-later event-driven generation. The 0.2 group-chat framework is not in it:
`python/packages/pyautogen/README.md:3-5` calls the package a proxy for `autogen-agentchat` and tells
0.2 users to pin `pyautogen~=0.2.0`, and `python/packages/pyautogen/src/pyautogen/__init__.py` is an
empty file. The older framework therefore lives in the project's history and in the 0.2
documentation the README still links (its logo path names the `/0.2/` docs, `README.md:3`), not in
the worktree. Everything below describes the event-driven generation: `autogen-core` for the
runtime and messaging, `autogen-agentchat` for agents, teams and termination, `autogen-ext` for
models, executors, tools and specialised agents.

## What it is

**An actor runtime for agents.** An agent is addressed by an `AgentId` of type and key
(`autogen_core/_agent_id.py`), and the runtime routes two verbs: `send_message` is RPC and returns a
future (`_agent_runtime.py:22`), while `publish_message` fans out to a topic with no reply
(`:50`). Subscriptions map a topic to agent instances, and the default type subscription maps a
topic back to one agent per topic source (`_type_subscription.py:56-60`). A `RoutedAgent` declares
handlers with `@message_handler`, `@event` or `@rpc`, and dispatch is by exact message class plus
router predicates, first match wins (`_routed_agent.py:474-486`, decorators at `:176-236`,
`:296-356`). The envelope carries the sender, a cancellation token, metadata and a message id
(`_single_threaded_agent_runtime.py:58-92`), which is what makes tracing and intervention possible
without agents knowing about either.

**A high-level layer that hides the runtime.** AgentChat's `ChatAgent` is a model loop with tools,
memory, handoffs and state (`base/_chat_agent.py:24-92`). A team is an adapter: `BaseGroupChat`
registers each participant as a `ChatAgentContainer` agent and a manager as another agent, in an
embedded `SingleThreadedAgentRuntime` (`teams/_group_chat/_base_group_chat.py:191-245`), and the
docstring calls the class the mapping between the two APIs (`:59-61`). Participants never call each
other; the manager owns the transcript, asks `select_speaker` who goes next and publishes
`GroupChatRequestPublish` to that participant's topic (`_base_group_chat_manager.py:172-193`).

**Two control questions answered separately.** Termination is an object, not a loop check: a
`TerminationCondition` is called with the latest message delta and returns a `StopMessage` or
nothing (`base/_termination.py:15`, `:59`), and conditions compose with `&` and `|` (`:79-85`).
Speaker selection is the other axis, and each team ships its own answer: a cyclic index
(`_round_robin_group_chat.py:72-82`), a model choice
(`_selector_group_chat.py:152-217`), a scan for the latest handoff target
(`_swarm_group_chat.py:82-98`), or a progress ledger with a stall counter
(`_magentic_one/_magentic_one_orchestrator.py:300-450`). A fifth, experimental graph control plane
sits beside them (`_graph/_digraph_group_chat.py:551`).

**An extension ring and a cross-language story.** Core holds protocols only: `ChatCompletionClient`
(`models/_model_client.py:209`), `CodeExecutor` (`code_executor/_base.py:34`), `Workbench`
(`tools/_workbench.py:78`), `Tool` (`tools/_base.py:56`). The implementations live in
`autogen-ext`: OpenAI, Azure, Anthropic, Ollama, llama.cpp and Semantic Kernel clients; Docker,
Jupyter and local command-line executors; an MCP workbench
(`autogen_ext/tools/mcp/_workbench.py:47`); web, file and video surfers. A gRPC worker runtime
(`autogen_ext/runtimes/grpc/_worker_runtime.py:215`) with protobuf contracts
(`protos/agent_worker.proto`) lets .NET hosts run Python agents, and `autogen-studio` is a
prototype GUI over the same declarative component configs (`python/packages/autogen-studio/README.md`).

## Why it is in the register

The register's focus line was written before the read; the assignment narrowed it to termination
and speaker selection, which is exactly the pair of decisions our loop never has to make. Mapped to
live baseline rows:

- Multi-agent: `MA-01` is implemented here, while `MA-02` (control transfer), `MA-04` (parallel or
  background children), `MA-05` (shared state) and `MA-06` (a shipped topology) are absent. AutoGen
  answers all four somewhere, and handoff is a model-facing tool plus a message type plus a
  termination condition rather than a persisted action.
- Reasoning loop: `RT-09` ships here as one typed stream; AutoGen's stream also carries the
  control-plane decisions (who speaks next, which thought preceded a call), which is the half we
  never modeled.
- Durability: `HL-04` and `HL-06` are thin here. AutoGen pauses a team without ending the run
  (experimental) and resumes a human handoff by starting another run, so it is a useful negative
  result about how little state a suspend needs.
- Tools and models: `TL-04` (streaming tools) and `TL-06` (tool selection) are absent or minimal
  here, and the `Workbench` protocol plus `StreamTool` shows what a stateful tool surface looks
  like when tools outlive one call.
- Observability: `OB-02` is absent here; AutoGen emits OpenTelemetry spans for runtime, agent and
  tool operations with GenAI attribute names, and disables runtime spans through one environment
  variable (`_telemetry/_tracing.py:28`).

## How it is positioned against us

| family | autogen | this port at the baseline |
|---|---|---|
| action space | function calls through a model client, tools behind a workbench | model-authored program in a WASM sandbox (`RT-01`, `EX-01`) |
| control plane | an actor runtime; a manager agent selects speakers and broadcasts | no separate control plane; one loop per run |
| termination | a composable predicate over the delta, optional, with a manager turn cap | a step budget and a typed error (`RT-06`) |
| multi-agent | teams as code, handoff as a tool, nested teams allowed | managed agents exposed as tools (`MA-01`) |
| state | per-agent snapshot mappings, keyed by participant name, no subscription state | checkpoint between steps into a run store (`HL-03`) |
| events | runtime envelopes, typed chat messages and agent events, structured log lines | one typed step and event stream (`RT-09`) |
| tracing | OpenTelemetry spans from the runtime outward | a local span fold with no exporter (`OB-01`, `OB-02`) |
| distribution | many independently versioned packages, plus a .NET port and a GUI | eleven packages behind one facade (`DS-01`) |

The distance is not in features but in the shape of a run. Our run is a function that returns a
result; theirs is a message loop in which the return value of the public API is a queue consumer.
That is why streaming, state save, pause and remote execution all come out of the same plumbing
there, and why none of it can be copied one function at a time.

## Limits of this read

- Shallow clone: no history, no tags. The 0.2 framework is inferred absent from the tree, the proxy
  package and the README links above; it was not read.
- Archived: the repository is frozen and the successor is named upstream. This is historical
  evidence for design ideas, not a competitor whose moves need watching.
- Reading concentrated on `autogen-core`, `autogen-agentchat` and the parts of `autogen-ext` named
  in `04-sources`; `autogen-studio` was read at its README and layout, `dotnet/` at its README and
  package list, `agbench` not at all.
- Nothing was installed, built, tested or executed, and no clone script was run. Behaviour beyond
  the traced call path is inferred from source and marked as inferred.
- The published documentation site was not fetched; the docs tree and the design notes were used
  for rationale, and only the first design note was read in full.
- Line counts came from PowerShell over the worktree and are approximate.
