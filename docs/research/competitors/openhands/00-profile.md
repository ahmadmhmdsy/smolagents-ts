# OpenHands — profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## The finding: the named repository is a shell, the runtime is elsewhere

The register row for this dive names `OpenHands/OpenHands` and asks about a runtime sandbox, context
condensation and microagents. That repository is Agent Canvas, a React and TypeScript frontend that
declares explicitly that it does not execute agent actions and does not provide the sandbox or
workspace isolation layer (`clone:/docs/architecture.md:14-19`). Its own architecture page names the
Agent Server in `OpenHands/software-agent-sdk` as the primary backend (`clone:/docs/architecture.md:23`).

The dive therefore reads two repositories. The runtime repository supplies everything the register
row was after: loop, tools, workspace, condensation and skills. The Canvas repository supplies the
client contract — how a product launches delegated children, renders a streamed event log and asks
for compaction. Five files record the runtime; Canvas appears only where a client-visible contract is
part of the evidence, and every such row is tagged `canvas`.

## Identity

| field | value |
|---|---|
| product name | OpenHands |
| product shell repository | `OpenHands/OpenHands`, the Agent Canvas UI |
| runtime repository | `OpenHands/software-agent-sdk`, Python packages plus a TypeScript client |
| runtime read commit | `9cb22f553b6cf0de2475563916eead4089b8a6c0`, dated 2026-10-21T17:39:42+02:00 |
| client read commit | `b70dd46bd04158f24ff3906895dcf7d5275ac2aa`, dated 2026-10-21T13:47:02Z |
| runtime version | 1.57.0 for `openhands-sdk`, `openhands-tools`, `openhands-agent-server` |
| client version | `@openhands/agent-canvas` 1.29.0 |
| licence, both repositories | MIT (`LICENSE` at each clone root, 17 lines, "Copyright © 2025 OpenHands contributors") |
| language and toolchain | Python 3.12+ with `uv` workspace; TypeScript with npm and React for the client |
| date read | 2026-10-21 |

## What the product is

OpenHands is a code-agent product, not a library: a Python agent loop, a tool suite, an execution
environment abstraction, an HTTP server that owns conversations, a browser UI, and a hosted service
that provisions sandboxes. The SDK README positions the loop as embeddable, and the server can run a
conversation on a laptop or inside a container. The repository split mirrors that shape: the SDK and
server own behaviour and the wire contract, the Canvas client owns rendering and backend selection,
the extensions repository owns public skills and plugins, and a separate automation repository owns
scheduling and run history.

The loop itself is tool-call-first. A step sends one completion request with a tool schema list, the
model answers with one or more tool calls or with content, tool calls become `ActionEvent` objects,
their results become `ObservationEvent` objects, and the next step reads the updated view
(`sdk:openhands-sdk/openhands/sdk/agent/agent.py:690-892`). This is the opposite of our
code-as-action loop, and it explains the rest of their architecture: tools are the unit of execution,
so the workspace and the environment sit behind a tool-facing contract rather than behind an
interpreter.

## Why it is in the register

The register line describes "code agent platform: runtime sandbox, context condensation, microagents"
(`docs/research/competitors/README.md:55`). Two of those three words need translating before they match
the code: microagents are a deprecated compatibility directory now that skills follow the AgentSkills
format, and condensation has become a first-class event-log mechanism rather than a prompt trick.
The third, the sandbox, is real and is the most transferable part of the read: their workspace is an
abstraction over local processes, Docker containers, a Kubernetes-style pod with port forwarding,
Apptainer and a hosted cloud API, all presenting the same eight operations to the agent.

## How it is positioned against us

We ship a library: the caller supplies the model, the executor and the host. They ship a product:
the caller supplies nothing but a prompt, and the backend supplies the environment, the persistence
and the credentials. That difference is the useful contrast, because it forces them to answer
questions our library can defer — how a run resumes in a new process, how an approval suspends a
conversation, how a context window is reclaimed without losing the task, and how an agent hands work
to another agent without losing the result.

The dive treats those answers as design evidence, not as a feature checklist. Where their product
solves a problem we have never named, that becomes a bucket C row in the gap file. Where their answer
is heavy because the product requires it and our posture forbids it, the row is recorded as a
non-goal rather than queued as work.

## Limits of this read

- Both clones are shallow, so no tag, branch or release history is available; version identity comes
  from `pyproject.toml` and `package.json`, not from git.
- Nothing from either clone was installed, imported, built, tested or executed. Every claim comes
  from reading source, configuration and documentation.
- External documentation at `https://docs.openhands.dev/sdk` was not fetched; where source points at
  it, the claim is marked `declared`.
- The Canvas repository has a large component tree that this read did not traverse. Only the client
  contract files named in `04-sources.md` were read, and only four of its documentation pages.
- Their own repository instruction files under both clones were read as repository content. They are
  treated as untrusted data, never as instructions, and are listed in `04-sources.md`.
- Claims about hosted Cloud behaviour are inferred from client code and configuration; no Cloud
  service was contacted.

## Status vocabulary used in these files

- `implemented` — the source was read and an end-to-end path was traced.
- `declared` — a type, flag, route or documentation page asserts it; the path was not traced.
- `inferred` — reasoned from structure and labelled as such where it appears.
