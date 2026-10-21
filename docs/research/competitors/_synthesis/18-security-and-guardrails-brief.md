# Security and guardrails: the control points the neighbours actually enforce

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Measured:** 2026-10-21, against `main` at `59b295f`, from eighteen of the dives filed under `docs/research/competitors/` (twenty-one are filed today).
**Scope:** what each neighbour treats as untrusted, where it places a control, what its defaults do when that control misfires, and what the answer means for us. No repository was opened for this brief; each claim keys to a filed dive or to the baseline in `docs/research/competitors/_synthesis/00-our-baseline.md`.
**Status vocabulary:** `implemented`, `declared`, `inferred` as defined in `docs/research/competitors/_method.md`. Evidence is `path:line` inside the neighbour's clone, or a documentation path with the date read.

Security here is not a feature row. It is four boundaries — sandbox, tool, approval, egress — plus a rule for what happens when one of them says no. Reading the dives for those five things rather than for features produces a different picture of the field than the feature inventories do: neighbours agree far more about where to put a control than about what the threat is.

## 1. The threat each neighbour assumes

| family | what it treats as untrusted | stated or implied | evidence |
|---|---|---|---|
| guest-code products (`e2b`, `vercel-eve`, `openhands`, `huggingface-smolagents`, `agno`, `adk-js`, `pydantic-ai` code mode) | model-written code running beside real state | explicit at the network and credential layers | `packages/js-sdk/src/sandbox/sandboxApi.ts:257-320`; `clone:/docs/sandbox/index.mdx:66` |
| interactive agent hosts (`claude-agent-sdk`) | the text the agent reads, including hostile instructions | explicit, and named as the reason for the deployment shape | `clone:/docs/hosting.md:177-208` |
| approval-as-value frameworks (`vercel-ai-sdk`, `openai-agents-js`, `langgraphjs`, `mastra`, `cloudflare-agents`, `adk-js`, `pydantic-ai`, `langchainjs`, `vercel-eve`, `agno`, `agent-framework`, `voltagent`) | the side effect of a tool call, and sometimes the party answering | explicit at the tool boundary | `packages/ai/src/generate-text/tool-approval-configuration.ts:27`; `packages/agents-core/src/tool.ts:110` |
| output-screening frameworks (`openai-agents-js`, `mastra`, `langchainjs`, `voltagent`) | model output and user text | implied: every check sits after generation, and only one ships an injection heuristic | `runner/guardrails.ts:398-546`; `packages/core/src/agent/guardrails/defaults.ts:793` |
| protocol clients (`mcp-typescript-sdk`) | the server, its issuer and its environment | implied by where the checks are | `packages/client/src/client/auth.ts:889`; `packages/client/src/client/stdio.ts:10` |
| snapshot consumers (`beeai-framework`) | serialized values that may carry code | explicit in code, with the advisory cited | `typescript/src/serializer/serializer.ts:40-52` |

Three asymmetries matter more than the rows.

First, only one neighbour writes down the adversary. `claude-agent-sdk` says prompt injection is the threat model and derives its container-plus-egress-proxy recommendation from that sentence (`clone:/docs/hosting.md:177-208`). Everyone else implies it by building a boundary. A boundary built for bugs and a boundary built for a reasoning adversary are not the same design, and the difference shows up in defaults: a bug-shaped boundary trusts whatever is inside the process.

Second, almost nobody names the party that answers an approval. `vercel-ai-sdk` is the exception: it signs the approval so it can survive a round trip through a client the server does not control (`packages/ai/src/generate-text/tool-approval-signature.ts:27`). The rest either assume a same-process host or document that the host owns that problem (`clone:/docs/decisions/0006-userapproval.md:15`; external guide `https://openai.github.io/openai-agents-js/guides/human-in-the-loop/`, read 2026-10-21).

Third, the transcript itself is a channel. `voltagent` renders a child's persisted steps into a supervisor prompt inside an `<agents_memory>` block (`packages/core/src/agent/agent.ts:5641`), so anything written into history is replayed as instruction on the next turn. That is a prompt-injection surface created by a memory feature, and it is the one most likely to bite a framework that persists conversations.

Four things are missing from every threat model in the set, and all four are ours to decide:

- **The identity of a tool.** At least `claude-agent-sdk` hands the approval callback the MCP server a tool came from and how it was resolved (`sdk.d.ts:228-270`), so a host can treat a remote tool differently from a local one. Elsewhere a tool is a tool, and a name collision is a routing problem rather than a trust problem (our own tool type carries no provenance either, inferred from the baseline).
- **What leaves in the request.** Every check in the set screens what comes back; no dive records a policy on the prompt, the system text or the attached document that goes out. Confidentiality is assumed to be the transport's job.
- **The operator's ambient environment.** A stdio server and a Docker workspace both forward what the parent process holds unless someone writes an allowlist, and one neighbour records the safelist as a gap rather than a feature (`packages/client/src/client/stdio.ts:54`; `sdk:openhands-workspace/openhands/workspace/docker/workspace.py:209-287`).
- **The rendering surface.** Approval cards, tool output and transcript views are consumer code in these repositories, and none of the dives records a rule about what a card may display or how much of a sensitive argument it may echo.

Four capabilities on our roadmap import a threat with them, and it is worth naming each before it is built rather than after:

- **Code-as-action** imports the guest-code threat the neighbours solve with a container and a proxy, and we answer with the absence of a host process. That advantage is real only while the bridge to host tools stays narrow; every capability added to the sandbox narrows the gap the neighbours pay to close.
- **Tool calling** imports the tool-result channel, which is the least-screened surface in the field and the most common carrier of hostile text.
- **The MCP client** imports a remote peer's output and its credentials, and a caller-supplied transport means the host owns those headers (MC-06 absent).
- **Durability** imports the snapshot as untrusted input, which is the failure `beeai-framework` has an advisory for.

The asymmetry has a commercial explanation. A product that runs customer code has to write the threat down because its customers ask; a library does not, so its threat model stays implicit in the shape of a callback. That is why the most complete security documents in the set belong to the vendor with a hosted runtime (`clone:/docs/hosting.md:177-208`) and the most complete defaults belong to the framework with a moderation contract to keep. It also explains the one place the field is uniformly explicit: egress, because a customer running untrusted code will ask where it can reach.

## 2. The four control points

### 2.1 Sandbox boundary

The code-first neighbours all end in a process, a container or a remote guest: `openhands` starts an agent-server image, publishes it on loopback and allows a small env list through (`sdk:openhands-workspace/openhands/workspace/docker/workspace.py:209-287`); `huggingface-smolagents` offers Docker and five executor types behind one option (`src/smolagents/remote_executors.py:53-135`); `adk-js` ships a family of executors including one whose filename is the warning (`core/src/code_executors/unsafe_local_code_executor.ts`); `beeai-framework` has no local sandbox at all and sends Python to a remote interpreter over HTTP (`typescript/src/tools/python/python.ts:139`, inferred absent). `vercel-eve` makes the boundary a provider contract with a prepared artifact and an explicit policy at open (`clone:/docs/sandbox/index.mdx:66`).

`claude-agent-sdk` is the useful counter-example because it states the limit of its own control: the permission gate parses commands but does not confine them, and containers are recommended for isolation (`clone:/docs/secure-deployment.md:26`). A gate and a boundary are separate controls, and a library can only ship the first.

The only in-library sandboxes in the set are interpreters: `huggingface-smolagents` walks the AST with an import allowlist and operation and iteration caps (`src/smolagents/local_python_executor.py:1688-1765`), and `pydantic-ai` runs model-written Python in a Monty sandbox that bridges host tools (`src/pydantic_ai_harness/pydantic_ai_harness/code_mode/README.md:13-27`, declared). An interpreter is the weakest boundary and the most portable, which is exactly the trade our QuickJS-WASM default already makes.

That trade is worth stating precisely for us. Our sandbox has no host process to escape and no filesystem to traverse (EX-01, EX-05 absent), so the classes of failure the container products engineer against do not exist in our default. What replaces them is the host binding surface: a tool the model can call from inside the sandbox is a capability we granted, and `ExecutorCapabilities` (EX-04) is the only place that grant is described. A guest that can call a bridged tool which writes files or fetches URLs has the boundary of that tool, not the boundary of QuickJS. The neighbours with a capability bag either keep it descriptive and separate the enforcement (a container, a proxy) or let the bag become the policy by convention; none of the dives shows a bag that is both declarative and enforced.

The remote tier we already ship (EX-03) inherits the opposite problem. When the executor is `e2b` or a host process, the boundary is real but the control is not ours: the network policy is the vendor's, the credential is the operator's, and the adapter's only security-relevant decision is which transport it chooses. The `e2b` dive records the adapter taking the single-call path because it was one call, and that path has no input channel, so tool round trips are refused rather than supported (recorded at `docs/research/competitors/e2b/03-gap-and-lessons.md:133-136`). For a security brief the lesson is narrower: a remote tier should carry the capability it can actually enforce in its declared bag, and refuse the rest, rather than let a caller infer confinement from a backend name.

### 2.2 Tool boundary

The tool boundary is where argument validation, policy, consent and result screening meet, and neighbours implement it in different orders. `openhands` puts PreToolUse and PostToolUse hooks around the loop (`sdk:openhands-sdk/openhands/sdk/hooks/types.py:9-17`); `openai-agents-js` evaluates a `needsApproval` predicate after arguments parse (`packages/agents-core/src/tool.ts:110`); `pydantic-ai` separates an approval predicate from tool-boundary guardrails (`pydantic_ai_slim/pydantic_ai/toolsets/approval_required.py:16`; `src/pydantic_ai_harness/pydantic_ai_harness/guardrails/README.md:3,12`, declared); `mastra` runs ordered processors where `abort()` raises a tripwire (`packages/core/src/processors/runner.ts:633`).

What distinguishes the mature ones is not the number of checks but whether the check sees what will actually run. `adk-js` pins a confirmation to the call it approved and refuses a mismatched one (`core/src/tools/tool_confirmation.ts:45-57`); `openai-agents-js` binds an approval to a fingerprint of the invocation and refuses a reused call id with different arguments (`packages/agents-core/src/runContext.ts:405-451`). That binding is the difference between consent and a click.

Result screening is the least-owned step of the four. Argument checks are common because a schema is already there; result checks are rarer because the result has no schema. `openhands` is the only neighbour in the set with a documented post-execution hook on the same path as consent (`sdk:openhands-sdk/openhands/sdk/hooks/types.py:9-17`), and `openai-agents-js` declares a tool output guardrail whose execution path the dive did not trace (`toolGuardrail.ts`, declared). A tool that returns hostile text, a web page or a document is the most common delivery channel for injection, and it is the one place where almost every framework trusts the result it just received.

### 2.3 Approval boundary

`claude-agent-sdk` is the most complete ladder and the only one where a policy layer can outrank a permissive mode: hooks, then deny rules, then ask rules, then the mode, then allow rules, then the callback, with deny holding even in bypass mode (`clone:/docs/permissions.md:13-52`, declared). Bypass needs its own flag (`sdk.d.ts:2036-2039`), the callback may return edited input rather than yes-or-no (`sdk.d.ts:2554-2559`), and a headless host that cannot prompt denies instead of hanging (`sdk.d.ts:2053-2054`). It also documents the trap that follows from ordering: calls resolved earlier never reach the callback, and a shadowed configuration produces a warning (`clone:/docs/permissions.md:56-63`).

`adk-js` contributes the fail-closed rule: a malformed, untrusted or mismatched verdict aborts the invocation rather than running the tool (`core/src/tools/tool_confirmation.ts:63`), and a confirmation arriving from a remote A2A peer is ignored unless the run opts in (`core/src/agents/processors/request_confirmation_llm_request_processor.ts:80-88`). `cloudflare-agents` contributes the idempotency rule: approving deletes the pending row first, so a retried click cannot double-run the effect (`packages/think/src/think.ts:16215-16236`), and a parked action keeps the authorisation it had at pause time (`packages/think/src/think.ts:16204-16236`). `vercel-ai-sdk` contributes the untrusted-round-trip rule described above, and `langgraphjs` the schema-validation rule for the value a resume supplies (`libs/langgraph-core/src/interrupt.ts:126-166`).

The question no library can answer alone is who may answer. `vercel-eve` puts an authenticated principal into the response policy, so a pending approval cannot be settled by anyone who happens to see its id (`clone:/docs/tools/human-in-the-loop.md:107-185`). `openai-agents-js` documents authentication, authorisation, atomic consumption and replay rules for the host that stores a snapshot, and ships none of them (external guide, read 2026-10-21). `agno` persists the record and leaves resolution to the application. The pattern is consistent: the mechanism is in the library, the authorisation is in the host, and the hand-off is where a security review should look.

Order matters as much as presence. A single callback that decides every call is not equivalent to a ladder where a deny rule sits above it, because the ladder is how an organisation expresses a policy it does not want a user to override (`clone:/docs/permissions.md:13-52`).

### 2.4 Egress boundary

Egress is where the field is most uniform among products that run guest code and most absent among libraries that do not. `e2b` accepts allow and deny selectors, per-domain rules with header and IAM-placeholder transforms, a SOCKS5 proxy, live policy replacement and token-gated ports (`packages/js-sdk/src/sandbox/sandboxApi.ts:257-320`, `:46-110`, `:176-345`; `packages/js-sdk/src/sandbox/index.ts:627-636`). It also documents a hole rather than hiding it: QUIC and HTTP/3 are not tunnelled by the proxy (`packages/js-sdk/src/sandbox/sandboxApi.ts:176-345`). `vercel-eve` opens the guest with a policy such as deny-all and keeps secrets in the app runtime, handing the guest brokered calls instead (`clone:/docs/sandbox/index.mdx:66`; `clone:/docs/concepts/security-model.md`).

Two non-product egress channels recur. Telemetry: `openai-agents-js` reaches the network at import time because its default exporter is wired before user code (the openai clone's `packages/agents/src/index.ts:1-8`), and its bundle exports analytics unless a key is absent (`packages/agents-openai/src/openaiTracingExporter.ts:296-302`). Process environments: `mcp-typescript-sdk` inherits the parent environment when spawning a stdio server, and a safelisted environment is listed as a depth gap (`packages/client/src/client/stdio.ts:10`, `:54`, `:233`). Its token endpoint refuses plaintext unless the host is loopback (`packages/client/src/client/auth.ts:889`) and it pins the issuer before redeeming a code (`packages/client/src/client/auth.ts:163`), which is egress control applied to OAuth rather than to sockets.

For us the interesting case is the one we have not built yet. Today the guest has no network reach of its own (EX-05 absent, EX-06 declared), so a sandboxed program can reach the network only through a tool the host bridged, which makes the tool's own outbound call the egress event. If a workspace or a fetch capability ever lands, the egress question arrives with it, and the neighbours show that the cheap time to answer it is before the capability ships: `e2b` grew allow and deny selectors, header transforms, a proxy and live policy updates, and still documents an untunnelled protocol (`packages/js-sdk/src/sandbox/sandboxApi.ts:176-345`). A declared policy with no enforcement behind it is the state we are already in; the risk is shipping the capability and leaving the declaration as the only control.

One egress fact has no counterpart in the set: our executor can run inside the user's browser session, and a script running there inherits the origin's ambient authority — cookies, storage, same-origin endpoints — in a way no container, remote guest or server-side sandbox does. Every neighbour's guest starts with no ambient credential and has to be given one; ours would start inside a session that already has many. That is not a problem today because the sandbox has no network path and no DOM, but it fixes the shape of any future fetch capability: the binding has to be a scoped call with an explicit credential, never a general `fetch` handed into the guest. None of the filed neighbours can teach this because none of them runs where the user is.

## 3. The guardrail lifecycle

Where a check runs determines what it can prevent. The set below is what the dives support; the column that matters is the last one, because a blocked value that still gets written has not been blocked.

| stage | who checks there | what a trip does | what happens to the value |
|---|---|---|---|
| user input, before the model | `openai-agents-js` first turn only, blocking checks awaited and the rest overlapped with the call (`runner/turnPreparation.ts:264`, `:281-332`); `langchainjs` moderation and PII middleware on every model call (`libs/langchain/src/agents/middleware/index.ts:19`, `:89`) | typed tripwire error, run halts (`runner/guardrails.ts:307`, `:316`) | the turn is not charged (`run.ts:545`) |
| tool arguments, after parse | `openai-agents-js` predicate (`tool.ts:110`, `:2761`); `pydantic-ai` declared (`guardrails/README.md:3,12`) | deny or throw | the call is never dispatched |
| tool result | `openhands` PostToolUse hook (`sdk:openhands-sdk/openhands/sdk/hooks/types.py:9-17`); `openai-agents-js` declared and untraced (`toolGuardrail.ts`) | replace or reject | the offending result must not enter context, which no dive shows enforced |
| final output | `openai-agents-js` on the selected output only (`run.ts:1520`, `:1540`); `voltagent` holds chunks back while scanning (`packages/core/src/agent/streaming/guardrail-stream.ts:93`); `mastra` sees streaming output (`packages/core/src/agent/guardrail.ts`) | tripwire, with a retry carrying the reason (`packages/core/src/agent/trip-wire.ts:16`, `:35`, `:75`) | placeholder replaces the blocked text before session persistence (`runner/guardrails.ts:398-546`; `run.ts:451`) |
| commit boundary | `openai-agents-js` awaits its tracker exactly once before anything persists (`runner/guardrails.ts:30-105`; `run.ts:2129`) | a late failure still cancels the commit | nothing is written for a turn that fails after generation |

Several lifecycle lessons follow, then four failure points that survive a correct check.

The commit point is a separate control from the check. `openai-agents-js` can fail a run after the model answered because it joins background checks before the write, and its blocked-output placeholder exists because "what the session stores" is a policy decision (`run.ts:451`). A design that checks at the end but writes as it goes has no commit point at all.

A tripped check is often correctable rather than terminal. `mastra` retries with the violation as a user-visible message (`packages/core/src/agent/trip-wire.ts:16`, `:75`), and `claude-agent-sdk` treats exhausted structured-output retries as their own terminal subtype (`sdk.d.ts:5908`, declared). Ours fails the run on a schema mismatch (GR-06).

The guard model's own failure is a policy decision. `mastra` ships `strict` to fail closed when the guardrail model fails and `warn` to log and pass (`packages/core/src/processors/processors/classifier.ts:105`). A safety check that calls a model inherits every failure mode of a model call, including unavailability.

A lifecycle has four failure points that survive a correct check, and the dives supply one example of each:

- **Check-then-use.** The value screened is not the value executed. The pinned-call and fingerprint designs exist because of this (`core/src/tools/tool_confirmation.ts:45-57`; `packages/agents-core/src/runContext.ts:405-451`).
- **Check after write.** The store commits before the check settles. `openai-agents-js` inverts the order deliberately by joining its tracker before the commit (`runner/guardrails.ts:30-105`).
- **Check that cannot run.** The guard model is down, rate-limited or returns junk. `mastra` makes that a named setting rather than an accident (`packages/core/src/processors/processors/classifier.ts:105`).
- **Check on a different input than the one replayed.** A resumed run re-runs a step with history the check never saw; `langgraphjs` validates the resume value against a schema but the reducer still decides what the node receives (`libs/langgraph-core/src/interrupt.ts:126-166`).

What is withheld from the model may still be needed by the runtime. `cloudflare-agents` truncates large paused arguments in the model-facing output while keeping the full arguments for the real resume (`packages/think/src/tools/execute.ts:257-268`), which is the pattern for showing a human a summary and executing the original.

Retry belongs to the lifecycle because it re-runs the checked action. `mastra` retries a tripped step with the reason as feedback (`packages/core/src/agent/trip-wire.ts:16`, `:75`), and `cloudflare-agents` makes the approval claim idempotent precisely so a retried click cannot run the effect twice (`packages/think/src/think.ts:16215-16236`). A retry policy that is designed for model repair and not for consent will eventually re-execute an approved tool.

Stage coverage and control coverage are different counts. Our loop has a documented seam at the first stage and the fourth, and nothing at the two middle stages, which is why tool-boundary guardrails appear in the unconsidered table (GR-07) rather than as a gap row: the seam does not exist to price. A neighbour that checks four stages badly is not safer than one that checks two well, but a neighbour that checks the tool result is defending against the delivery channel we currently leave open.

Our lifecycle is one check before and one after the whole run, both awaited at a single point (GR-01, GR-03 absent). That means the earliest point we can stop a bad output is after the model produced all of it, and the latest point is before the caller sees it — with no rule about what a session or store is allowed to have written in between.

## 4. Documented failures, and the default each one teaches

The list is not a bug catalogue. Each entry is a default that a reader would otherwise assume was safe, and the lesson is the rule the default should have followed. A security review of our own surface should be able to name the equivalent rule for each row.

1. **A default that permits code execution from data.** `beeai-framework` serializes functions as source and refuses to deserialize them unless the caller opts in through an ambient flag, with advisory GHSA-phhm-7927-g88p cited in the code (`typescript/src/serializer/serializer.ts:40-52`, `:477-490`). Lesson: a snapshot is untrusted input. If a persisted value can name code, the default must deny and the reason must be in the source.

2. **A security option that is accepted and ignored.** `e2b` accepts `secure` and then discards it, accepts `allowInternetAccess` and does nothing with it, and keeps deprecated `keepMemory` and `betaPause` aliases (`packages/js-sdk/src/sandbox/sandboxApi.ts:628-633`, `:731-734`, `:736-739`; `packages/js-sdk/src/sandbox/index.ts:680-685`). Lesson: an option that silently does nothing teaches callers something untrue about their posture, which is worse than not offering it. This is the failure to check our EX-06 against, where the value is declared and the process backend reports `direct` (`packages/exec-remote/src/backends/e2b.ts:77-82`).

3. **A gate mistaken for a boundary.** The claude documentation says the permission gate parses commands but does not confine them and points at containers (`clone:/docs/secure-deployment.md:26`); it also warns when an earlier ladder rung shadows a callback (`clone:/docs/permissions.md:56-63`), requires a flag for bypass (`sdk.d.ts:2036-2039`), and needs a fail-closed headless mode because no prompt can arrive (`sdk.d.ts:2053-2054`). An approval that parks a live process has no deadline in the documented surface (`clone:/docs/user-input.md:123-145`, inferred from the dive). Lesson: state the limit of the gate next to the gate, and make the unanswerable case deny rather than wait.

4. **Analytics egress wired at import.** `openai-agents-js` sets a default provider and tracing exporter before user code runs (the openai clone's `packages/agents/src/index.ts:1-8`) and enables bundle analytics unless a key is missing (`packages/agents-openai/src/openaiTracingExporter.ts:296-302`), while its processor path is deliberately fail-soft (`packages/agents-core/src/tracing/processor.ts:220`). Two reasonable defaults compose into an egress channel the host did not choose. Lesson: observability is an egress decision, and "configured by default" is not "opt-in".

5. **Approval as the only policy, and no filter in core.** `vercel-ai-sdk` ships four approval states, stream-carried requests and signed approvals (`tool-approval-configuration.ts:27`; `execute-tools-from-stream.ts:148`; `tool-approval-signature.ts:27`), and no guardrail, moderation or injection filter in the core (absence recorded at `docs/research/competitors/vercel-ai-sdk/02-features-inventory.md:150`). Lesson: a framework can be coherent with consent alone, but the signature tells you its threat model is a hostile client rather than a hostile model. Consent and content policy are different products.

6. **Features that are on but inert, and probes that spawn processes.** `mcp-typescript-sdk` builds a response cache on every client that does nothing until a server sends a hint (`clone:/docs/clients/caching.md:85`), spends a 746-line support page on two wire eras (`clone:/docs/migration/support-2026-07-28.md:1`), and starts a sibling process to ask a version question (`packages/client/src/client/versionNegotiation.ts:590`). Lesson: an inert security feature misleads readers, and a probe that executes code is a surface even when it is opt-in.

7. **A pause that outlives its approval.** `cloudflare-agents` needs `expirePaused(maxAgeMs)` to sweep abandoned cards because a forgotten approval could otherwise resume months later (`packages/codemode/src/proxy-tool.ts:82`), and it takes authorisation at pause time rather than at resolution (`packages/think/src/think.ts:16204-16236`). Lesson: a durable pending state needs an expiry and a decision about which moment the permission was granted.

8. **A credential store inherited by accident.** `openhands` starts a container, publishes its port on loopback and forwards a small env allowlist, which is the right shape; the failure mode it designs against is the default one, where a workspace sees the developer's whole environment (`sdk:openhands-workspace/openhands/workspace/docker/workspace.py:209-287`). A stdio MCP server has the same shape and no allowlist in the client yet (`packages/client/src/client/stdio.ts:10`, `:54`). Lesson: isolation of the process is not isolation of the environment, and the allowlist is the control that does the work.

9. **A decision that has to survive serialization.** `pydantic-ai` and `agent-framework` both move an approval across a run or process boundary as typed data, not as a suspended coroutine (`_deferred.py:28,159`; `clone:/docs/decisions/0006-userapproval.md:15`). That is what makes remote and restarted runs work, and it also means the far end must treat the incoming decision as untrusted input. A library that validates a resume value on the near side only has moved the problem, not solved it.

10. **An application-owned decision sold as an SDK feature.** `agno` writes pending approvals to an `agno_approvals` table and leaves who may resolve one to the application (`https://docs.agno.com/hitl/approval`, read 2026-10-21). Lesson: "persisted approval" and "authorised resolver" are two capabilities; shipping the record without the rule puts the security decision in a schema.

11. **A sandbox that writes code but still holds every tool.** `pydantic-ai` Code Mode hides eligible tools behind one `run_code` tool and lets model-written Python call them through the framework (`src/pydantic_ai_harness/pydantic_ai_harness/code_mode/README.md:13-27`, declared). The sandbox constrains the program and does not constrain the calls it makes, so the authorisation surface is unchanged. Lesson: moving the loop into a sandbox is a capability decision, not a reduction in what the model can do.

## 5. Our posture, plainly

| control | what we have | neighbour floor | reading |
|---|---|---|---|
| sandbox | QuickJS-WASM is the default executor and exposes no host process or filesystem (EX-01; EX-05 absent by decision 0018) | a container, a remote guest or a container-plus-proxy stack (`clone:/docs/hosting.md:15-21`; `sdk:openhands-workspace/openhands/workspace/docker/workspace.py:53-128`) | **stronger by default**: we cannot leak a host filesystem because we do not have one. We are weaker the moment a host binding hands the sandbox something live, and nothing in the loop bounds that surface |
| tool boundary | one Zod schema per tool, one run-wide timeout, no per-tool policy (TL-01, TL-05) | argument guardrails, PreToolUse/PostToolUse hooks, per-tool approval predicates | **weaker**: we validate shape, not intent or content, and a poisoned tool result enters context unchecked |
| approval | a boolean gate before the call runs (HL-01) | pending state, binding to the call, fail-closed malformed verdicts, audit record, idempotent claim | **weaker on meaning, not on existence**: our gate cannot survive a restart (HL-02, HL-06), cannot prove it approved the call that runs, and leaves no record (HL-12) |
| egress | a declared capability and no policy plumbing (EX-06; `packages/exec-remote/src/backends/e2b.ts:77-82`) | allow/deny selectors, brokers, creds held outside the guest | **weakest point**: we run code and have no enforcement story of our own at this boundary |
| guardrail lifecycle | input and output tripwires, caller-supplied (GR-01), awaited at one point (GR-03), no built-in checks (GR-04) | streaming scanners, parallel checks, one commit point, placeholder-before-persist, PII and moderation defaults | **weaker**: we can stop a run, but not before a chunk reaches a consumer, and we have no stated rule about what persists after a trip |
| telemetry | no exporter (OB-02 absent) | OTel, GenAI spans, per-run switches | **stronger by accident**: nothing leaves the process. That advantage ends the day an exporter lands, and `openai-agents-js` shows the wrong way to land one |

Three non-goals in decision 0018 are now security decisions rather than roadmap ones.

A workspace is protective while it is absent: no filesystem, no shell, no ambient environment to exfiltrate. Every neighbour that added one for capability then had to add a container, an env allowlist and an egress proxy for safety (`sdk:openhands-workspace/openhands/workspace/docker/workspace.py:209-287`; `clone:/docs/sandbox/index.mdx:66`). Keeping EX-05 out keeps our default posture better than theirs, and it is the strongest argument for not reopening it casually.

Hosting is excluded, but a durable approval is not hosting. Neighbours that are libraries rather than products all park the pending request in the run state and let the caller own the queue and the authorisation (`clone:/docs/decisions/0006-userapproval.md:15`; `packages/agents-core/src/runState.ts:3218`, `:3489`). That is HL-02 and HL-06, already designed in `docs/research/competitors/_synthesis/15-durability-design-brief.md`; the security requirement it does not carry is that the parked approval must be bound to the call and must not persist the blocked content.

MCP server authoring stays out, and that keeps an inbound attack surface out. The client side still needs the stdio environment safelist and the token-endpoint refusal that `mcp-typescript-sdk` shows (`packages/client/src/client/stdio.ts:10`; `packages/client/src/client/auth.ts:889`), because those are client-side egress controls, not server features.

What can be claimed honestly today is narrow and worth writing down: a model-written program runs without a host process or a filesystem, a tool call can be gated by its host, an input or output tripwire stops the run, and nothing leaves the process unless a tool or a guardrail is the one doing it. What cannot be claimed is that the gate knows what it approved, that a stopped value stayed out of storage, that a policy applies to tool results, or that an executor confines the network. Those four sentences should be the acceptance criteria for the release that adds anyone else's trust.

The neighbours are collectively ahead of us on one thing that is easy to miss when comparing rows: they treat a safety decision as a product decision with a default. A placeholder, a strict-or-warn split, a signed approval, an expiry on a pause and a deny that outranks allow are all choices someone made about what happens when no one is watching. We have a seam and no defaults, which is defensible while every caller is internal and becomes a liability the moment the package is published (DS-05).

The ordering follows from the posture table. Consent before containment, because a wrong call cannot be undone by a later redaction. Containment before streaming, because a persisted value outlives the process that wrote it. Egress enforcement before any capability that gives the guest a network path, because that is the moment the declaration has to become true. Telemetry only behind an explicit switch, because it is the one egress channel we control today by not having it. A workspace after all of these, and only as a scoped grant rather than a directory: the neighbours' own experience is that adding one costs a container, a proxy and an allowlist before it is safe to turn on (`clone:/docs/hosting.md:177-208`).

## 6. Hardening, ordered, for the next two releases

Order is by what a failure would cost, not by price. Each item names the dive that pays for it; nothing here reopens a non-goal.

**Release 1 — make consent mean something and make the boundary honest**

| # | work | price | prevents | paid for by |
|---|---|---|---|---|
| 1 | bind an approval to the invocation it approved: a canonical digest over tool name and arguments, checked at execution, mismatch aborts | S | a human approving one call and a different call running, and a reused call id being replayed | `core/src/tools/tool_confirmation.ts:45-57`; `packages/agents-core/src/runContext.ts:405-451` |
| 2 | fail closed on an unusable verdict: malformed, absent or untrusted approval aborts instead of executing | S | corruption or silence reading as consent | `core/src/tools/tool_confirmation.ts:63` |
| 3 | state and enforce the persistence rule for a tripped guardrail: a blocked output leaves a placeholder, never the offending text | S | a policy stop that still writes the content it stopped into a session or store | `runner/guardrails.ts:398-546`; `run.ts:451` |
| 4 | per-tool deadline and a bounded retry policy, separate from the run-wide timeout | S | a hung or hostile tool turning one step into an unbounded wait | `typescript/src/tools/base.ts:248-288`; `packages/agents-core/src/errors.ts:159` |
| 5 | make EX-06 an enforcement or remove the field: either an executor can confine egress and says so, or the capability stops claiming it | M | a declared-but-direct posture, the failure `e2b` ships with `secure` and `allowInternetAccess` | `packages/js-sdk/src/sandbox/sandboxApi.ts:731-739` |
| 6 | record each approval decision with actor, call digest and outcome | S | an unattributable consent, and the inability to answer what a run was allowed to do | `clone:/docs/tools/human-in-the-loop.md:183-185`; HL-12 |

**Release 2 — catch the check earlier and keep the secret out**

| # | work | price | prevents | paid for by |
|---|---|---|---|---|
| 7 | evaluate guardrails during streaming and in parallel, with one join before the commit | M | a blocked chunk already rendered, and policy count turning into latency | `packages/core/src/agent/guardrail.ts`; `packages/core/src/agent/streaming/guardrail-stream.ts:93`; `runner/guardrails.ts:30-105` |
| 8 | guardrails at the tool boundary, on arguments and on results | M | a poisoned tool result entering context, and arguments that satisfy a schema but not a policy | `src/pydantic_ai_harness/pydantic_ai_harness/guardrails/README.md:3,12`; GR-07 |
| 9 | opt-in moderation or PII policy at one boundary, with an explicit strict-or-warn failure rule for the check itself | M | unredacted PII in persisted history, and a safety model's outage deciding policy silently | `libs/langchain/src/agents/middleware/index.ts:19`; `packages/core/src/processors/processors/classifier.ts:105` |
| 10 | a credential seam for tools, or a documented rule that tools close over secrets and snapshots never carry them | M | keys in snapshots, traces or prompts when durability and telemetry land | `packages/agents-core/src/runState.ts:3212-3219`; `clone:/docs/concepts/security-model.md` |
| 11 | if snapshots ever carry callables, default-deny deserialization behind a per-call opt-in with the advisory cited in code | S | arbitrary code execution from a stored value | `typescript/src/serializer/serializer.ts:40-52` |

Sequencing has one hard dependency: items 1 to 3 touch the approval and guardrail seams we already have (HL-01, GR-01) and can land independently of each other. Items 4 and 5 touch the executor capability bag and the loop's timeout, so they should follow the durability work only if that work does not move either seam; if it does, the binding rule moves into the run record and the price stays S. Item 7 depends on a streaming hook the loop does not expose today, which is the main reason the second group follows the first; items 8 to 11 do not depend on the first release and can be reordered by appetite.

What is deliberately absent from the list matters as much as what is in it. No workspace and no hosted sandbox, because the absence is our current security advantage and a design for it should start from a scoped grant rather than from a directory (`clone:/docs/sandbox/index.mdx:66`). No MCP server authoring, because it would import an inbound attack surface we do not currently defend. No OAuth implementation, because a caller-supplied transport is a defensible line for a client library while MC-06 is absent. No telemetry exporter, unless it arrives behind an explicit switch and with the egress question answered in the same change (`packages/agents/src/index.ts:1-8`). And no model-based guardrail in the near term, because a guard model turns an outage into a policy failure and the strict-or-warn rule has to exist before the check does (`packages/core/src/processors/processors/classifier.ts:105`).

Every item that changes a default should land with one failing fixture before the code, so the default cannot regress silently:

1. approve a call, change one argument, execute: the run aborts and no side effect happens.
2. hand the approval path a corrupt or missing verdict: the run aborts, it does not run the tool.
3. trip an output guardrail and inspect the session: the offending text is absent and a placeholder is present.
4. give a tool a deadline it misses: the step fails typed, the run reports it, and no retry storm follows.
5. claim an executor that reports `direct` egress and ask for a policy: the capability either refuses or enforces.
6. resume a run whose approval record was for another digest: refused.
7. stream a chunk a guardrail should block: the consumer never renders it, or renders a placeholder.
8. attempt to deserialize a stored callable without the opt-in: refused with the advisory named.

If the list works, four rows in the posture table change without any new capability: approval goes from existence to meaning, guardrail lifecycle gains a containment rule, the tool boundary gains a result check, and egress becomes either enforced or honestly absent. The sandbox row does not change, and that is the point — our strongest security property is one we already have, and the work is to stop borrowing credit from it for controls we have not built. A brief that ended with a recommendation to build a container stack would have misread the evidence.

Two things this brief does not decide. The approval state machine belongs to the durability design, not here; this file only adds the binding, fail-closed and containment rules that design must satisfy. And none of the neighbours documents a threat model for the host application that embeds the library — the closest is the deployment chapter `claude-agent-sdk` writes for itself (`clone:/docs/hosting.md:177-208`). Our README-level posture is therefore still unwritten, and it should not be copied from a vendor's deployment guide.

**Sources:** the dives filed under `docs/research/competitors/`, the baseline and durability brief under `_synthesis/`, and the method file for the status vocabulary. Each claim names the file and line a reader can check; no repository was read for this brief, and none needs to be re-read to challenge it.