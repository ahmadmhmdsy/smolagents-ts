# The ranked backlog — what to build, in what order, and why

**Contract**
- **Role:** the ordered answer to "what next", derived from the gap matrix and the five lane briefs; the input a task row is cut from.
- **Mutability:** re-ranked when a dive, a brief or a decision changes the evidence; item numbers are stable.
- **Read when:** choosing the next release, or arguing that something should be deferred.
- **Update when:** an item lands, is refused, or its precondition changes.

**Measured:** 2026-10-21, from 565 gap rows across 22 dives and the briefs `15` to `19`.
**Not a plan:** this file ranks and scopes. It sets no dates, assigns no owner and creates no task row; the Lead does that with `docs/04-tasks.md`.

## How the ranking works

Three things decide the order, and nothing else does:

1. **Evidence weight.** `3 × C + A + 0.5 × D`, where C is an unconsidered gap, A a follow-on behind a shipped seam, D a depth gap. C rows move first because they are the part of the field we never described to ourselves.
2. **Seam readiness.** An item that lands behind a seam we already export outranks one that needs a new seam, even when the second is more exciting.
3. **Ordering by dependency.** A typed child report is cheap and worthless until a background child can report; the reverse is expensive and broken. Dependencies are stated per item.

Effort is the dive consensus, not an estimate: **S** a day or less, **M** two to four days, **L** a week or more, **XL** a product that needs a decision first.

Each item states the same five things: what changes, where it lands, the evidence, what makes it done, and what it risks.

## Release 1 — make the promises we already make true

Nine small items. Five of them are corrections rather than features, which is why they come first: a library that says a thing and does another is worse than one that says less.

### 1. Close T-30 and stop describing `code.delta` as missing (S)
**What:** delete the stale task row; keep RT-05 as implemented. **Where:** the task record only. **Evidence:** `packages/core/test/core-loop-fixes.test.ts:338`; three dives flagged the contradiction. **Done when:** no task claims the event is never emitted. **Risk:** none; this is bookkeeping debt.

### 2. Make structured output a mode, not a boolean (S/M)
**What:** replace `ModelCapabilities.structuredOutput` with the modes a family supports (native, synthetic tool, prompt) and resolve the mode from the adapter, never from the model name. **Where:** `packages/core/src/model.ts` and `packages/models`. **Evidence:** `GR-05` (`pydantic-ai` profile facts, `vercel-ai-sdk` undeclared support). **Done when:** a caller can ask which mode will be used and a model that supports none fails early with a typed error. **Risk:** an adapter that overstates support is worse than one that says nothing.

### 3. Repair a schema failure instead of failing the run (S)
**What:** one bounded retry in which the validation error becomes a history message, with a separate budget and no repair after a length finish. **Where:** the final-answer seam in `packages/core`. **Evidence:** `GR-06`, the pydantic `RetryPromptPart` loop. **Done when:** a fixture model returns invalid twice then valid, and the run succeeds with two attempts recorded. **Risk:** the repair loop can mask a genuinely broken schema; cap it at two and surface the error.

### 4. Bind an approval to the call it approves (S/M)
**What:** a request id, a digest over tool name and input, a verdict bound to both, and a fail-closed rule for a malformed verdict; record the decision as an event. **Where:** the approval hook plus the event stream. **Evidence:** `HL-01` (`adk-js` IntentMismatchError, `vercel-ai-sdk` HMAC, `openai-agents-js` fingerprints). **Done when:** a verdict for another call or another input is rejected with a typed reason, and the decision is visible in the trace. **Risk:** the digest is only as strong as the serialization it hashes; pin the serialization.

### 5. State what a guardrail trip does to stored state (S)
**What:** a written rule, enforced in code, for what a tripped input or output does to the checkpoint, the session memory and the trace. **Where:** `packages/core` guardrails plus `RunStore`. **Evidence:** `GR-01`; the openai dive's redact-before-persist behaviour. **Done when:** a test proves a blocked output is not present in any persisted artifact. **Risk:** redaction that silently changes a trace is its own audit problem; record the fact of redaction.

### 6. Make the network policy field honest (S)
**What:** either enforce `network: "direct"` in remote backends or stop declaring a policy field that nothing reads. **Where:** `packages/exec-remote`, `ExecutorCapabilities`. **Evidence:** `EX-06`, the e2b backend reporting `direct` with no plumbing, and the security brief's argument that this is our weakest point. **Done when:** a capability claim can be trusted or has been removed. **Risk:** removing the field is a breaking change; enforce where possible, document where not.

### 7. Version the stored shape, and refuse what you do not know (S)
**What:** one integer on every persisted artifact, read-side branches for old values, a typed refusal for a newer one. **Where:** `RunStore` records and the session snapshot. **Evidence:** `HL-10`; eleven dives filed rows, and the cheapest implementation is one field plus a switch. **Done when:** a record written by a future version fails with a clear remedy, and an old record still loads. **Risk:** a version that is never bumped is decoration; the conformance suite must force the bump.

### 8. Give every tool a deadline (S)
**What:** a per-tool timeout with a typed error, a default that is generous but finite, and an opt-out a caller must state. **Where:** `tool()` in `packages/tools` and the call site in the loop. **Evidence:** `TL-05`; six dives, none of which leaves a tool unbounded by default. **Done when:** a hanging tool fails the step with a typed error instead of hanging the run. **Risk:** a timeout that fires during a legitimate long call; make the error say which limit fired.

### 9. Publish the conformance suite a store must pass (S)
**What:** an executable suite covering the ten failure modes in the durability brief, importable by anyone implementing `RunStore`. **Where:** a new test entry in `packages/core`. **Evidence:** `DS-09`; `langgraphjs`'s five-method saver plus suite, `claude-agent-sdk`'s thirteen checks, `mcp-typescript-sdk`'s requirements manifest. **Done when:** our own file store passes it and the suite is documented as the contract. **Risk:** a suite that tests our implementation rather than the interface; write it against the interface first.

## Release 2 — the durability spine

The lane brief `15-durability-design-brief.md` is the design. This release is the implementation order, and it is deliberately one spine rather than seven features.

### 10. One run record with a commit boundary (M/L)
**What:** `schemaVersion`, `generation`, `completed`, `journal`, `pending`, `agentFingerprint`, `parentRunId`; the loop commits at a boundary and the store never invents one. **Where:** `packages/core/src/session/run-store.ts` and the loop. **Evidence:** `HL-03`, `HL-04`, `HL-09`; `langgraphjs` splits checkpoint from pending writes, `eve` makes a turn one step, `cloudflare-agents` journals effects. **Done when:** the conformance suite passes for the file store and a crash between steps resumes without re-running a completed step. **Risk:** a commit boundary that is too coarse loses work; one that is too fine costs a write per token.

### 11. A pending request as state, not as a stuck call (M)
**What:** one pending record with a kind (approval, input, plan), a request id, a digest and a payload; `resume(requestId, value)` settles it. **Where:** the run record plus `RunOptions.resume`. **Evidence:** `HL-02`, `HL-06`; ten A rows each, the strongest single signal in the matrix. **Done when:** a paused run resumes in a second process and a duplicate verdict is refused. **Risk:** this is the API change that makes everything else possible; get the vocabulary right once.

### 12. One owner at a time (S/M)
**What:** a compare-and-set generation or a claim record so a second process cannot write the same run. **Where:** the store, not a daemon. **Evidence:** `HL-04`; `eve`'s token and lease, `cloudflare-agents`'s claim-by-delete, `mastra`'s duplicate-resume error. **Done when:** a stale writer is refused and the error names the owner. **Risk:** ownership without expiry strands a run; pair it with the recovery story.

### 13. Resume and approve from the terminal (S)
**What:** `--resume <runId>` and `--approve <requestId>`, both against the same store. **Where:** `packages/cli`. **Evidence:** `CL-03`; every neighbour with a CLI has it, and it is the cheapest visible proof that item 11 works. **Done when:** a run paused in a browser can be approved from a terminal. **Risk:** two writers; item 12 is the precondition.

### 14. Journal the effects inside a step (L)
**What:** the model request and each wrapped tool call get a journal entry, replayed rather than re-executed on resume, with an honest in-doubt state for effects outside our control. **Where:** the loop plus the store. **Evidence:** `HL-05`; the pydantic engine, `langgraphjs`'s pending writes, `cloudflare-agents`'s generation fence. **Done when:** a crash after a tool call resumes without repeating that call, and an unsupported effect is surfaced as in-doubt rather than silently repeated. **Risk:** journals grow; compact them at commit boundaries and version the compaction.

### 15. Replay from a step (M)
**What:** fork a run at step N with the recorded state and no side effects replayed. **Where:** the store plus a `fork` option. **Evidence:** `HL-07`; `inngest-agent-kit` and `openhands` both expose named boundaries. **Done when:** a fixture run forks at step 2 and produces a different step 3 without repeating steps 0 and 1. **Risk:** replay that repeats effects is a data-corruption feature; the journal is the precondition.

### 16. A conversation identity across runs (M)
**What:** a thread or session id that outlives a run, with the run record pointing at it. **Where:** `AgentSession` plus the store. **Evidence:** `HL-08`; `langgraphjs` separates thread from run. **Done when:** two runs share history by id and a third with no id does not. **Risk:** making the thread the durable unit splits the model in two; keep the run primary.

### 17. Condense history as an event, not a rewrite (M)
**What:** a condensation record that names what was forgotten, with a projection applied at read time; hard and soft triggers, a protected system prompt and a minimum-progress rule. **Where:** session memory and the store. **Evidence:** `HL-11` (new row); `openhands` is the clearest implementation, `eve` and `openai-agents-js` corroborate. **Done when:** a long session condenses and the trace shows the forgetting event. **Risk:** a summary that silently drops a constraint; keep forgotten ids addressable.

### 18. A stream a later process can follow (M)
**What:** a cursor over the event log so a second process, or a reconnecting UI, resumes the stream without replaying from zero. **Where:** the event stream and `packages/react`. **Evidence:** `RT-09` depth rows; `cloudflare-agents`'s cursor log and handshake, `eve`'s durable log. **Done when:** a client reconnects with a cursor and receives only the missing events. **Risk:** stream replay is not run replay; do not promise byte-exact resumption of a provider stream.

## Release 3 — delegation, after durability

Delegation without a durable child is a toy, which is why it follows the spine. The brief is `17-multi-agent-brief.md`.

### 19. A typed child report (S)
**What:** a child returns a validated value, not prose, and a failure returns a typed error on a separate channel. **Where:** managed agents in `packages/core`. **Evidence:** `MA-03`; `adk-js` declares the schema twice, `voltagent` returns an error string as a result. **Done when:** a child with an `outputSchema` fails loudly when it returns prose. **Risk:** a schema per child is friction; default to text and let a caller opt in.

### 20. Transfer control, and persist that it happened (M)
**What:** a transfer action recorded in the run, with the target validated as a name that exists, and the parent resuming afterwards. **Where:** the loop plus the store. **Evidence:** `MA-02`; `adk-js` persists the action, `autogen` makes it a queue message. **Done when:** a transfer survives a restart and the resumed run executes the target. **Risk:** the vocabulary; a transfer is not a clone, and `beeai-framework` shows how the two get conflated.

### 21. A bounded background child (L)
**What:** a child run with its own row in the store, a parent pointer, a cap on concurrent children, and a status a parent can read later. **Where:** the store plus managed agents. **Evidence:** `MA-04`; `cloudflare-agents`'s detached ledger, `eve`'s durable task receipt. **Done when:** a parent can start a child, end, and re-attach to its result in a later run. **Risk:** the largest item in the list; it needs items 10 to 12 first, and it should ship with a cap rather than waiting for one.

### 22. Attribute every event to its agent path (S)
**What:** each streamed event carries the path of agents that produced it, enriched at emission and never retrofitted. **Where:** the event types plus managed agents. **Evidence:** `RT-09`; `voltagent` enriches a child chunk before re-emission for exactly this reason. **Done when:** a nested child's events are filterable by path. **Risk:** adding a field later breaks consumers; add it with the first child.

### 23. Refuse a default blackboard; let a report carry the state (S)
**What:** no shared mutable state between agents by default; a typed child report plus an explicit shared object a caller passes. **Where:** documentation plus the managed-agent options. **Evidence:** `MA-05`; four dives ship a blackboard, four refuse one, and the cheapest correct position is ours. **Done when:** a caller can share state deliberately and cannot do it by accident. **Risk:** none; this is a decision to write down rather than code.

### 24. One supervisor shape, as code (M)
**What:** a supervisor that plans, delegates to typed children and assembles the result, shipped as an example rather than an engine. **Where:** `packages/core` examples plus docs. **Evidence:** `MA-06`; `langgraphjs` compiles topology to tools, `autogen` owns a control plane we should not. **Done when:** the example runs end to end with items 19 and 21. **Risk:** an example is a promise; keep it small and tested.

### 25. Steer a running turn (M)
**What:** a message injected into a run that is already executing, delivered at a step boundary and visible in the trace. **Where:** the loop's step boundary plus the store. **Evidence:** `RT-11` (new row); `eve` and `claude-agent-sdk` both ship a form of it. **Done when:** a running turn receives a message and the next step sees it. **Risk:** steering plus approvals is a race; define precedence.

## Release 4 — protocol and tool breadth

Cheap, additive, and mostly S. Each item closes a group of rows in the MCP dive or the tools dive.

### 26. Harden the MCP client with five small pieces (S each)
**What:** capability gating, a request timeout, typed local errors, bounded list aggregation, and a session lifecycle that survives a reconnect. **Where:** `packages/mcp`. **Evidence:** `MC-01`; the reference client and four dives. **Done when:** each piece has one test and the client no longer has an unbounded await. **Risk:** five small changes to one package; ship them together with one version bump.

### 27. Read resources and prompts, not only tools (M)
**What:** `listResources`, `readResource`, `listPrompts`, `getPrompt`, plus completion. **Where:** `packages/mcp`. **Evidence:** `MC-03`; seven dives, and the reference client's verbs are thin. **Done when:** a resource can be listed and read through our client with typed results. **Risk:** scope creep into resource caching; do not cache in this item.

### 28. Notifications a caller can subscribe to (S/M)
**What:** progress, cancellation and list-changed notifications surfaced as events rather than ignored. **Where:** `packages/mcp` plus the event stream. **Evidence:** `MC-05`; `mcp-typescript-sdk` ships subscription streams and progress. **Done when:** a long tool call reports progress and a cancel reaches the server. **Risk:** notification ordering; the reference's history rules exist for a reason.

### 29. Tool policy as data (M)
**What:** per-step allowed, forced, hidden tools and a requirement rule a caller returns from a hook; merged by the runner and rendered into the request. **Where:** `packages/core` tool selection. **Evidence:** `TL-06`; `beeai-framework`'s requirement rules are the cleanest form. **Done when:** "call search before answering" is configuration, and a filtered tool is absent from the request. **Risk:** policy that hides a tool the model needs produces silent failure; return the reason in the trace.

### 30. Move tools and variables into a remote guest (M)
**What:** a declared transfer of tool definitions and variables into a remote executor, with a refusal when the guest cannot host them. **Where:** `packages/exec-remote` plus the loop. **Evidence:** `EX-10` (new row); upstream smolagents does it for its remote runtimes. **Done when:** a remote run can call a host tool by name through the guest. **Risk:** the bridge is an egress path; pair it with the security brief's containment rules.

### 31. Finish the E2B backend (M)
**What:** settable lifetime, a per-execution timeout, keepalive, metadata for finding an orphaned guest, metrics as a capacity signal, and named contexts. **Where:** `packages/exec-remote/src/backends/e2b.ts`. **Evidence:** `EX-03`, `EX-06`, `EX-11` (new row); the e2b profile prices each. **Done when:** a guest can be found, capped and reused across sub-tasks. **Risk:** a backend that knows too much about one vendor; keep each behind the capability bag.

### 32. Generator tools and provider-hosted tools (S/M)
**What:** a tool that yields intermediate values into the event stream, and a declared kind for a tool the provider runs. **Where:** `packages/tools`. **Evidence:** `TL-04`, `TL-07`; three dives each. **Done when:** a generator tool streams progress and a hosted tool is not executed locally. **Risk:** two features in one item; split if the second grows.

## Release 5 — observation and cost

### 33. Export spans behind an explicit switch (M)
**What:** an OTel exporter a caller installs; nothing wired at import, nothing on by default. **Where:** `packages/core` monitoring. **Evidence:** `OB-02`; fourteen dives, and the openai dive's import-time exporter is the pattern to avoid. **Done when:** a run emits a span tree to a collector only when the caller asked. **Risk:** egress and key handling; this is the security brief's telemetry rule.

### 34. Split usage and derive cost (S/M)
**What:** cached and uncached input tokens, output tokens, a decimal `costUsd`, the basis it was derived from, a dated price table, and a budget checked between steps with unknown not collapsed to zero. **Where:** `packages/core` usage plus `packages/models`. **Evidence:** `OB-06`; `vercel-ai-sdk` splits by cache, `claude-agent-sdk` caps spend. **Done when:** a run with a budget stops before the next step when the budget is gone. **Risk:** a price table rots; date it and fail open on unknown rather than guessing.

### 35. Span attributes worth filtering on (S)
**What:** model, provider, tool name, step, timing and usage on the spans we already build. **Where:** `packages/core`. **Evidence:** `OB-03`. **Done when:** a trace can answer "which model step was slowest" without parsing names. **Risk:** cardinality; do not put prompts in attributes.

## Release 6 — models and output depth

### 36. Declare the provider spec version (L)
**What:** a numbered interface for a model adapter, an upgrade shim for the previous version, and a conformance test per adapter. **Where:** `packages/models` plus `packages/core`'s model type. **Evidence:** `MD-09` (new row); `vercel-ai-sdk` proxies two older versions at the call boundary. **Done when:** an adapter written against v1 keeps working when core moves to v2. **Risk:** versioning for its own sake; only worth it at the second breaking change, which is exactly when it is too late to add cheaply.

### 37. Multimodal input (M)
**What:** image parts in a message and a capability flag per adapter. **Where:** messages and the five adapters. **Evidence:** `MD-04`. **Done when:** one adapter accepts an image and refuses it early when unsupported. **Risk:** provider-specific encoding; keep the part shape ours, the encoding theirs.

### 38. Prompt caching and provider options (S/M)
**What:** a typed passthrough for cache markers and provider options, with no core knowledge of either. **Where:** adapter options. **Evidence:** `MD-07`; `pydantic-ai` and `vercel-ai-sdk` both expose it. **Done when:** a caller can set a cache hint without a new core release. **Risk:** a passthrough bag invites every provider quirk into the public type; type it per adapter.

### 39. Retrieval, if we decide it belongs (L)
**What:** embeddings, a vector store interface and a retriever, or an explicit refusal. **Where:** undecided. **Evidence:** `MD-10` (new row); `langchainjs` and `agno` carry it, and our baseline has no row at all. **Done when:** the decision is written, either way. **Risk:** this is the item most likely to turn a library into a platform; decide before designing.

## Late additions — the last two dives

These were filed after the ordering above. Both slot into Release 1 and neither changes the order.

### A. A run budget a caller can hand back (S)
**What:** optional turn, output-token and total-token limits owned by the request rather than the loop; a typed stop reason for each; a result handle that continues the same budget in a later call. **Where:** `AgentOptions` plus `RunResult`. **Evidence:** `RT-06`, `RT-08` and `RT-13` from the `strands` dive, which checks limits before each turn so a prior turn's tools still finish, and orders its stop reasons. **Done when:** a second call with the returned handle keeps counting against the same limits and says `limitTotalTokens` instead of a generic step error. **Risk:** two budgets, the caller's and ours, drift apart; one must own it.

### B. Structured output as a hidden validating tool (S)
**What:** implement item 3's repair loop the way `strands` does — the schema becomes a forced tool call whose validation failure returns as a tool result. **Where:** item 3's seam. **Evidence:** `GR-06`; that dive records the forced tool choice in its inventory. **Done when:** one code path covers native and prompted modes for adapters without native support. **Risk:** a forced tool hides the schema from the text channel; keep the repair message explicit.

## Not now — with the trigger that would reopen each

| id | item | why not now | the trigger that reopens it |
|---|---|---|---|
| MC-04 | sampling, elicitation, roots | two of the three are deprecated upstream | a remote server we must support requires it |
| MC-06 | OAuth and authorisation-server work | no remote server with auth on our path | the first authenticated remote MCP |
| MC-07 | MCP server authoring | decision 0018 keeps us a client | a request from a downstream user |
| MC-08 | agent-to-agent interop | no consumer, and the spec is moving | an interoperability request |
| EX-05 | filesystem and shell workspace | decision 0018, and the security brief argues it protects us | a product decision to become a code-agent host |
| EX-08 | snapshot a live guest | only one backend can, and it is not our default | a resumable sandbox story worth the price |
| UI-06 | a chat transport protocol | decision 0018 | a hosted product decision |
| UI-07 | generative UI | decision 0018 | same |
| MD-05 | router, fallback, rate limiting | decision 0019 keeps routing later | the second provider outage that matters |
| MD-08 | local runtimes (Ollama and peers) | minimal today; 0019 reopens it | a user who cannot send data out |

**Refused outright.** A graph engine, a job queue, a hosted control plane, a blackboard default, an exporter on by default, a sandbox we did not write, and the name "handoff" for a clone.

## What this backlog does not claim

- It is not a schedule. S, M and L are effort classes from the dives, not promises made to a date.
- It is not a value judgement. A cheap item here can matter less than an XL one that changes the archetype; `08-landscape-taxonomy.md` names two of those.
- It does not create task rows. That happens when the Lead cuts one, with the write scopes and the acceptance line from the item.
