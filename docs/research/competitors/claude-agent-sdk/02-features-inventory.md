# claude-agent-sdk — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Strength words are exact: `implemented` is unavailable for this repository because
no source is readable, so every row is `declared` (a type, JSDoc or documentation
page states it) or `inferred` (reasoned from the published shape, said so). Citation
legend: `sdk.d.ts:N` is the declaration file fetched from unpkg at 0.3.306;
`<page>.md:N` is a page fetched from https://code.claude.com/docs/en/agent-sdk/ on
2026-10-21; a bare path is a wrapper-repository file read at the same date.

## Invocation and the loop

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| INV-01 | one-shot query | declared | `sdk.d.ts:3303-3306` | `query({prompt, options})` returns a `Query`, an async generator of `SDKMessage`; with a string prompt the process exits after the turn | The smallest useful call is one prompt in, one message stream out |
| INV-02 | streaming input | declared | `sdk.d.ts:3304`, `:3271`, `:6504` | The prompt may be an `AsyncIterable<SDKUserMessage>`; `streamInput()` pushes further turns into the same live session | Multi-turn chat and mid-run redirection need an open input channel |
| INV-03 | incremental output | declared | `sdk.d.ts:1895`, `:5553`; `streaming-output.md:9-17` | With `includePartialMessages` the stream adds `stream_event` messages carrying raw API events instead of complete blocks | A UI can render tokens before a block finishes |
| INV-04 | control requests | declared | `sdk.d.ts:2912`, `:2919`, `:2948`, `:3271` | `interrupt`, `setPermissionMode`, `setModel` and `streamInput` are only available in streaming-input mode | Changing course requires a channel that stays open |
| INV-05 | turn and budget caps | declared | `sdk.d.ts:1960`, `:1965`; `agent-loop.md:194-197` | `maxTurns` bounds round trips; `maxBudgetUsd` stops on estimated spend and returns an error result | A caller needs a hard stop for unattended runs |
| INV-06 | thinking and effort controls | declared | `sdk.d.ts:1939`, `:1946`, `:2975` | `thinking` selects adaptive or budgeted reasoning; `effort` sets a named depth level; an older token cap remains deprecated | Reasoning depth trades latency and cost against quality |
| INV-07 | schema-constrained answer | declared | `sdk.d.ts:2008`, `:2503-2505` | `outputFormat` accepts a JSON schema; the validated value arrives as `structured_output` on the success result | Hosts want typed output without parsing prose |
| INV-08 | typed turn outcome | declared | `sdk.d.ts:5906-5962`, `:6033`, `:6049` | Exactly one `result` message ends a turn; subtypes name success, execution error, max turns, max budget, or exhausted structured-output retries | The turn boundary is the only reliable settlement point |
| INV-09 | fallback model | declared | `sdk.d.ts:1717` | A comma-separated fallback list retries at each new user turn, so an outage does not demote the session permanently | Provider overload is transient and should not poison context |
| INV-10 | automatic compaction | declared | `agent-loop.md:264-274`, `sdk.d.ts:3817` | Older history is summarized near the window limit and a `compact_boundary` message is emitted; `/compact` forces it | Long sessions must free context without losing the thread |
| INV-11 | prompt passthrough mode | declared | `sdk.d.ts:1926` | `verbatimPrompts` suppresses file-mention and slash-command expansion for host-composed text | Text the end user did not type must not trigger local dispatch |
| INV-12 | file checkpointing | declared | `sdk.d.ts:1726`, `:3186` | With the option on, files are backed up before edits and `rewindFiles(userMessageId)` restores them | Undoing an agent's edits is a file operation, not a conversation one |
| INV-13 | prewarmed process pool | declared | `sdk.d.ts:2843-2863`, `:9849` | `startup()` boots a spare CLI and `claim()` binds it to a session, trading memory for first-token latency | Cold subprocess start dominates short interactive turns |

## Permissions and approvals

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| PERM-01 | ordered evaluation ladder | declared | `permissions.md:13-52` | Hooks run first, then deny rules, then ask rules, then the mode, then allow rules, and only then the callback; deny rules hold even in bypass mode | An organisation must be able to outrank a user's permissive setting |
| PERM-02 | six permission modes | declared | `sdk.d.ts:2529-2531`; `permissions.md:120-137` | `default`, `acceptEdits`, `plan`, `dontAsk`, `auto` and `bypassPermissions`; auto routes undecided calls through a model classifier | The same harness serves interactive, audit and CI use |
| PERM-03 | approval callback | declared | `sdk.d.ts:228-270`, `:1621` | `canUseTool` receives tool name, input and a context with an abort signal, suggestions, blocked path and MCP provenance | The host owns the approval UI |
| PERM-04 | approve with edited input | declared | `sdk.d.ts:2554-2559` | An allow result may carry `updatedInput` and `updatedPermissions`, so a human can redact or widen without another round trip | Approval is often "yes, but not with that path" |
| PERM-05 | decision provenance | declared | `sdk.d.ts:2512`, `:5741` | Classification distinguishes temporary, permanent and rejected decisions; denied calls are listed on the result | Audit needs to know who allowed what |
| PERM-06 | no approval surface | declared | `sdk.d.ts:2053-2054` | `permissionPrompts: 'none'` denies anything that would prompt and never calls the callback | A headless run must fail closed instead of hanging |
| PERM-07 | declarative allow and deny rules | declared | `permissions.md:70-113` | Rules are glob-like tool patterns with specifiers such as `Bash(rm *)`, layered from settings files | Repeating a prompt for a routine command is friction |
| PERM-08 | approval over an MCP tool | declared | `sdk.d.ts:2044`, `:1784` | `permissionPromptToolName` routes prompts to an MCP tool; elicitation has its own callback | Some hosts already own an approval service |
| PERM-09 | callback never sees pre-approved calls | declared | `user-input.md:52-56`, `permissions.md:56-63` | Anything resolved earlier in the ladder bypasses `canUseTool`, and a process warning names the shadowing configuration | Silent bypass is the failure mode a host must be told about |

## Hooks

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| HOOK-01 | typed lifecycle events | declared | `sdk.d.ts:995-1001` | Thirty-three event names, each with its own input payload type and a discriminated output union | Interception must be typed to be safe |
| HOOK-02 | matchers and timeouts | declared | `sdk.d.ts:988-993` | A matcher filters by tool name or pattern; a per-matcher timeout bounds the callback | One handler should not fire for every tool |
| HOOK-03 | four-way permission decision | declared | `sdk.d.ts:1001`; `hooks.md:35-39` | A hook returns allow, deny, ask or defer, plus optional input rewriting | The hook layer can decide before the ladder's defaults |
| HOOK-04 | context injection | declared | `hooks.md:37` | Outputs can add context to the conversation as well as block or modify a call | Convention reinforcement belongs at the event, not in the prompt |
| HOOK-05 | hook traffic on the stream | declared | `sdk.d.ts:1890` | `includeHookEvents` emits started, progress and response messages for every hook type | A host rendering progress needs to see hook work |
| HOOK-06 | filesystem hooks | declared | `hooks.md:23-29` | Shell-command hooks from settings files load when the matching setting source is enabled | Teams configure policy outside code |

## Subagents and delegation

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| SUB-01 | programmatic agent definitions | declared | `sdk.d.ts:1608`, `:38-108` | An `agents` map keys names to definitions the Agent tool can call; a settings-defined set also loads from disk | A host can ship specialists without editing files |
| SUB-02 | per-agent configuration | declared | `sdk.d.ts:38-108` | Tool allow and deny lists, prompt, model, MCP servers, preloaded skills, memory scope, effort, permission mode, turn cap and compaction window | Delegation should narrow capability rather than inherit everything |
| SUB-03 | automatic or explicit invocation | declared | `subagents.md:210-226` | The model chooses by description, or a prompt names the agent and bypasses matching | Matching is cheaper than routing code |
| SUB-04 | forked subagent | declared | `subagents.md:228-246` | A fork copies the parent conversation instead of starting clean, and a deny rule can block the type | Some subtasks need the context the parent already built |
| SUB-05 | background subagent | declared | `sdk.d.ts:83`, `:1902` | A definition can run fire-and-forget; text forwarding is opt-in so the parent renders a nested transcript if wanted | Parallel work should not block the main turn |
| SUB-06 | subagent resume | declared | `subagents.md:418-450` | A subagent transcript can be resumed by id, and subagent transcripts mirror into the store under a subpath | Long delegated work outlives the parent's turn |
| SUB-07 | result provenance | declared | `sdk.d.ts:1902` | Every forwarded message carries `parent_tool_use_id`, which attributes a block to its subagent | A UI needs to nest output correctly |
| SUB-08 | delegation caps | declared | `subagents.md:628-710` | Depth, concurrency and spend caps bound the tree, and budget exhaustion stops background children | Unbounded delegation is an unbounded bill |
| SUB-09 | observer agent | declared | `sdk.d.ts:101-107` | A definition can name an observer that receives read-only activity digests and reports separately | Supervision is a role, not an interruption |
| SUB-10 | supported agents query | declared | `sdk.d.ts:3071`, `:113` | `supportedAgents()` returns names, descriptions and configuration for the session | A host renders what it can delegate to |

## Sessions, resume and echo

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| SESS-01 | resume by id | declared | `sdk.d.ts:2120`, `:2126` | `resume` loads a transcript before the subprocess starts; `sessionId` may pin a UUID for a new session | Callers that keep a conversation id need to re-enter it |
| SESS-02 | continue the newest | declared | `sdk.d.ts:1626`; `sessions.md:103-107` | `continue: true` resolves the most recent session in the working directory | Scripts rarely want to track ids |
| SESS-03 | fork | declared | `sdk.d.ts:855`, `:1742`; `sessions.md:41`, `session-storage.md:305-307` | `forkSession` rewrites session ids and message UUIDs into a new transcript; the original is untouched | Trying an alternative should not destroy the first attempt |
| SESS-04 | truncating resume | declared | `sdk.d.ts:2134-2184` | `resumeSessionAt` resumes at a chain UUID; `resumeDropsTurn` makes the CLI validate that only the intended turn is discarded | Rewinding one turn is common; discarding a queued message is a bug |
| SESS-05 | external transcript store | declared | `sdk.d.ts:6817-6895` | `SessionStore` requires `append` and `load`, with optional listing, summaries, delete and subkey enumeration | A container filesystem does not survive a move |
| SESS-06 | idempotent batch append | declared | `sdk.d.ts:6828-6832`, `session-storage.md:295-299` | Entries arrive after the local write, most carry a UUID the adapter should dedupe on, and failed batches are retried then dropped with a `mirror_error` | Retries must not duplicate rows |
| SESS-07 | summary folds | declared | `sdk.d.ts:837`, `:6880` | `foldSessionSummary` updates a sidecar per append so listing is one round trip, and concurrency is the store's problem | A session picker should not load every transcript |
| SESS-08 | subagent transcripts | declared | `sdk.d.ts:6891-6894`; `session-storage.md:309-311` | Subagent entries use a `subpath` such as `subagents/agent-ID`; resume needs `listSubkeys` to restore them | A resumed session should include its children |
| SESS-09 | dual-write and mirror | declared | `session-storage.md:259-299` | The subprocess writes locally first and the SDK forwards each batch best-effort; a run resumed from the store deletes its temporary local copy at the end | Local durability should not depend on a remote store |
| SESS-10 | resume from the store | declared | `session-storage.md:275-293` | A store transcript is materialized into a temporary config directory, the subprocess resumes from it, and the directory is removed afterwards | Any host must be able to adopt a session |
| SESS-11 | session administration | declared | `sdk.d.ts:689-1050`, `:3314` | List, read, rename, tag, delete, import and summarize sessions are exported functions over the same key space | Sessions become user-visible objects |
| SESS-12 | in-memory store | declared | `sdk.d.ts:1054`, `:1017` | `InMemorySessionStore` is shipped for tests, and an import helper migrates local JSONL into any store | Adapter authors need a reference implementation |
| SESS-13 | retention is the adapter's | declared | `session-storage.md:313-317` | The SDK never deletes from a store; local files are swept on the CLI's own schedule | Compliance cannot be delegated to a library default |
| SESS-14 | session key encodes cwd | declared | `session-storage.md:87-89` | The store key contains a project key derived from the working directory, so a resume must use a matching `cwd` | The CLI's own layout assumed one project per directory |

## MCP

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| MCP-01 | four server transports | declared | `sdk.d.ts:1246-1248`, `:1990` | stdio, SSE, HTTP and in-process SDK servers are all accepted in the `mcpServers` map | Every MCP deployment shape should be reachable |
| MCP-02 | in-process tool server | declared | `sdk.d.ts:632`; `mcp.md:369-373` | `createSdkMcpServer` defines tools in host code and registers them through the initialize handshake | A custom tool should not need a separate process |
| MCP-03 | tool search | declared | `mcp.md:375-379` | Tool definitions are withheld and loaded per turn by default when many are configured | Tool schemas are context the model may never use |
| MCP-04 | auth paths | declared | `mcp.md:381-535` | Credentials travel through the server's environment block, HTTP headers, or an OAuth callback | Remote servers need credentials the harness does not store |
| MCP-05 | connection observability | declared | `sdk.d.ts:3077`, `:1264-1288` | `mcpServerStatus()` reports connected, failed, needs-auth and pending, with the resolved configuration | A dead server must be visible before a tool call fails |
| MCP-06 | elicitation | declared | `sdk.d.ts:1784`, `:995` | A callback and two hooks handle a server's mid-task request for user input | MCP servers ask questions the harness must route |

## Sandboxing and isolation

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| SBOX-01 | sandbox setting | declared | `sdk.d.ts:2241`, `:3521` | A `sandbox` object configures filesystem and network restrictions for Bash | Local shells need confinement below permissions |
| SBOX-02 | bypass requires an explicit flag | declared | `sdk.d.ts:2036-2039` | `bypassPermissions` is rejected unless `allowDangerouslySkipPermissions` is also set | The dangerous mode should never be a typo |
| SBOX-03 | permission is not a sandbox | declared | `secure-deployment.md:26` | The docs state the gate parses commands but does not confine them, and recommend containers for isolation | A gate and a boundary are different controls |
| SBOX-04 | isolation guidance | declared | `hosting.md:177-208` | The vendor recommends a container, an egress proxy with allowlists, and credentials injected outside the agent | Prompt injection is the stated threat model |
| SBOX-05 | settings isolation | declared | `sdk.d.ts:2296-2299` | Passing an empty `settingSources` array disables filesystem settings for the session | An embedded SDK should not inherit a developer's dotfiles |

## Cost and usage

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| COST-01 | cumulative cost per call | declared | `sdk.d.ts:6031-6033` | Every result carries the running estimated total for the call, including resumed spend; streaming callers read the latest | Summing results double-counts |
| COST-02 | per-model accounting | declared | `sdk.d.ts:1464-1489`, `:6041` | `modelUsage` maps each model to tokens, cache reads and writes, web search count, cost and window size, including subagent calls | The whole tree must be priced, not just the main loop |
| COST-03 | pricing basis | declared | `sdk.d.ts:1486-1488` | Each entry records whether the cost used list prices, managed rates or an unknown guess | A cost figure without a basis is not auditable |
| COST-04 | crash recovery advice | declared | `cost-tracking.md:319-327` | A crashed run may emit a zeroed result, so the docs tell callers to read the prior result or sum assistant usage | Totals must survive the process that computed them |
| COST-05 | budget headroom | declared | `agent-loop.md:203-205` | The cap is checked after each response, so spend can exceed it by one response plus running children | A hard cap cannot be enforced mid-response |

## Closed-product properties

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| CLSD-01 | bundled runtime | declared | `streaming-output.md:123`; package metadata | The npm package bundles a Claude Code CLI build; the docs pin a minimum CLI version per SDK release | One install must give a matching harness |
| CLSD-02 | one subprocess per session | declared | `hosting.md:17-21` | Each query owns a process tree and a working directory; concurrency is bounded by host memory | Process isolation is the sandbox unit |
| CLSD-03 | local-first session state | declared | `hosting.md:53-63` | Transcripts, memory files and artifacts default to the container filesystem and do not survive a restart | The CLI grew as a local tool |
| CLSD-04 | no durable output replay | inferred | `sdk.d.ts:1895`, `sessions.md:392-402` | Streamed events exist only while the subprocess is alive; a reconnect resumes a conversation, not a byte position, and the docs suggest saving output as application state | Durability was added around the transcript, not the stream |
| CLSD-05 | commercial terms | declared | wrapper `LICENSE.md`; README licence section | Use, including in a product offered to end users, is governed by Anthropic's commercial terms | The runtime is a service product, not a library |
| CLSD-06 | Anthropic models only | inferred | `sdk.d.ts:1995`, `:1482-1484` | Model ids and providers resolve to Anthropic-hosted, Bedrock, Vertex or gateway endpoints; there is no adapter interface | The harness sells one family's loop |
| CLSD-07 | release churn | declared | registry metadata; wrapper `CHANGELOG.md` | 328 published versions and a 95 KB changelog; documentation pages and types were both current on the read date | A fast-moving proprietary binary makes docs a moving target |
| CLSD-08 | approval parks a process | inferred | `user-input.md:123-145`; `sdk.d.ts:222-226` | A callback keeps the subprocess blocked until the host answers; the docs supply a dummy hook to keep the input stream open, and no park deadline exists | Approval was designed for an interactive host, not a restarted server |
| CLSD-09 | host owns the transport | inferred | `sdk.d.ts:2012`, `:1700` | The executable path, runtime and environment can be overridden, but the wire format and control protocol are fixed | The vendor supports embedding, not substitution |
