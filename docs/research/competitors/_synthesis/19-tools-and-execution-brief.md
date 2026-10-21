# Tools and execution across the register — a design brief for the tool lane

**Contract**
- **Role:** cross-repo synthesis for the tools and execution lane only.
- **Mutability:** frozen once filed at the read date.
- **Read when:** designing tool policy, limits, the guest boundary or the MCP adapter.
- **Update when:** a newer dive supersedes it; never edit.

This brief cites the twenty-one filed dives, not their clones. Every pointer names a dive
file and the lines in it. Row ids and status words come from
`docs/research/competitors/_synthesis/00-our-baseline.md:97-134`, and the non-goals from
`:174`. Read date 2026-10-21. No repository was read for this brief, so each claim is a
synthesis of what the dives already established.

Three questions separate the neighbours, and none of them is about feature count. What is a
tool, a function or a resource with a lifetime? Who computes the set of tools a step may see,
the model or the configuration? And when the call leaves the host process, what exactly
crosses the boundary? Our answers sit at `TL-01`, `TL-06` and `EX-04` respectively, and each
of those rows is thinner than it looks.

## 1 The tool contract, field by field

| field | what the filed dives show | our row |
|---|---|---|
| input schema | Zod, Standard Schema or raw JSON in one factory, with the provider-facing JSON Schema derived once (`docs/research/competitors/openai-agents-js/02-features-inventory.md:114`; `docs/research/competitors/langchainjs/02-features-inventory.md:49`; `docs/research/competitors/beeai-framework/02-features-inventory.md:41`) | `TL-01` is the same shape |
| name and description | obligations, not decoration: names are normalised to legal function names (`docs/research/competitors/openai-agents-js/02-features-inventory.md:116`), attribute and signature checks reject a bad declaration before a model sees it (`docs/research/competitors/huggingface-smolagents/02-features-inventory.md:74`), and some make the schema an explicit typed object rather than an inferred decoration (`docs/research/competitors/autogen/02-features-inventory.md:83`) | unchecked strings |
| output typing | a declared output schema is validated at the boundary and a mismatch is a typed error rather than a poisoned loop (`docs/research/competitors/openai-agents-js/02-features-inventory.md:117`); a return schema is itself a wrapper concern in pydantic's composition list (`docs/research/competitors/pydantic-ai/01-architecture.md:72-73`); the protocol client validates structured results against the advertised schema (`docs/research/competitors/mcp-typescript-sdk/02-features-inventory.md:34`) | execute returns `unknown` |
| streaming or generator result | preliminary parts are emitted as tool output before the final part (`docs/research/competitors/vercel-ai-sdk/02-features-inventory.md:50`); a stream tool yields intermediate values (`docs/research/competitors/autogen/02-features-inventory.md:85`); generator-style partial output is documented as a tool contract (`docs/research/competitors/voltagent/02-features-inventory.md:114`) | absent by `TL-04` |
| error channel | a thrown call becomes a `tool-error` value (`docs/research/competitors/vercel-ai-sdk/02-features-inventory.md:51`), a model-visible message (`docs/research/competitors/openai-agents-js/02-features-inventory.md:119`) or an ordinary protocol result flagged as an error (`docs/research/competitors/mcp-typescript-sdk/02-features-inventory.md:39`); only some make it typed with a retryability hint (`docs/research/competitors/beeai-framework/01-architecture.md:156`) | thrown exception |
| credentials | an explicit transport or environment path for a remote server (`docs/research/competitors/claude-agent-sdk/02-features-inventory.md:100`), a secrets resource beside the sandbox (`docs/research/competitors/e2b/02-features-inventory.md:94`) and egress transforms that inject identity outside the guest (`docs/research/competitors/e2b/02-features-inventory.md:84`) | `TL-08` absent |
| sandbox requirement | the filed inventories put confinement outside the tool contract: it is a harness setting (`docs/research/competitors/claude-agent-sdk/02-features-inventory.md:108`), a separate executor family (`docs/research/competitors/adk-js/02-features-inventory.md:132`), or nothing at all, and one dive says outright that a permission gate is not a boundary (`docs/research/competitors/claude-agent-sdk/02-features-inventory.md:110`) | `EX-04` declares capabilities, no per-tool need |
| lifecycle | a toolset owns enter and exit hooks around every run and step (`docs/research/competitors/pydantic-ai/02-features-inventory.md:65`); a workbench has start, stop, reset, save and load (`docs/research/competitors/autogen/02-features-inventory.md:86`); one framework gives a tool start, end and error hooks plus a client-side mode with no executor (`docs/research/competitors/voltagent/02-features-inventory.md:111`, `:108`) | nothing beyond the call |

The function-versus-resource split is the useful cut through that table. A function contract
answers one question: given arguments, what value comes back? Vercel's specification states
its bias plainly, a tool travelling as data rather than code
(`docs/research/competitors/vercel-ai-sdk/02-features-inventory.md:39`), and the factory in
openai-agents-js and the helper and classes in langchainjs sit on the same side
(`docs/research/competitors/openai-agents-js/02-features-inventory.md:113`;
`docs/research/competitors/langchainjs/02-features-inventory.md:49-50`). A resource contract
answers a second question as well: what must exist before the call, and what state outlives
it? Pydantic's toolset is the clearest case, because it carries lifecycle, instructions,
definitions and policy in one composable object
(`docs/research/competitors/pydantic-ai/02-features-inventory.md:65-71`, `:81-85`).
Autogen's workbench and voltagent's hooks are lesser versions of the same admission, and
OpenHands goes furthest by making a tool bind an action model, an observation model, an
executor and the resources it locks (`docs/research/competitors/openhands/01-architecture.md:80-82`).

The two contracts fail differently, and the difference matters for us. A function-shaped tool
is cheap to register and hard to cancel, because cancelling means reaching an in-flight
promise. A resource-shaped tool can be entered and exited, which is where timeouts, caches and
credentials get a natural home. Our `Tool` is function-shaped (`TL-01`) while our executor is
resource-shaped, one instance per run with state that survives steps (`EX-07`). The mismatch
is invisible until the guest is remote, where a tool must be installed into something that has
to be alive, and it reappears at every MCP session.

## 2 Policy as data

The neighbours agree that tool availability is configured, and disagree about where. Five
mechanisms recur.

| mechanism | who decides | filed example |
|---|---|---|
| per-step allow, force, hide lists | a configuration object evaluated before the request | BEEAI's requirements return per-step rules for the target tool, allowed, forced and hidden sets, plus a reason and a stop veto (`docs/research/competitors/beeai-framework/01-architecture.md:124`), merged into the request with a tool choice and a `can stop` flag (`:126`); Vercel's `activeTools` narrows one step (`docs/research/competitors/vercel-ai-sdk/02-features-inventory.md:55`); mastra pages, searches and filters per iteration (`docs/research/competitors/mastra/03-gap-and-lessons.md:59`) |
| compositional wrappers | a configuration object composed before the loop | pydantic's filtered, prefixed, prepared and renamed toolsets (`docs/research/competitors/pydantic-ai/02-features-inventory.md:68`), with deferred loading that withholds tools until discovered (`:78`) |
| approval rules | configuration first, then a human or a classifier | claude-agent-sdk orders hooks, deny rules, ask rules, the mode, allow rules and finally the callback, so a deny outranks a permissive mode (`docs/research/competitors/claude-agent-sdk/02-features-inventory.md:38`), across six modes (`:39`); Vercel's four-state policy is a value at the tool boundary (`docs/research/competitors/vercel-ai-sdk/02-features-inventory.md:47`); mastra resolves a global boolean, a per-call predicate or a per-tool function and fails closed when the policy throws (`docs/research/competitors/mastra/02-features-inventory.md:27`); OpenHands scores each action with a security analyzer and lets a confirmation policy suspend it (`docs/research/competitors/openhands/02-features-inventory.md:22`) |
| selection hooks | code in the loop, sometimes calling a model | langchain ships tool selection as middleware, including an LLM that picks tools (`docs/research/competitors/langchainjs/02-features-inventory.md:42`); mastra's approval path runs a validation hook before the verdict (`docs/research/competitors/mastra/02-features-inventory.md:27`); OpenHands wraps the call in pre- and post-tool hooks (`docs/research/competitors/openhands/02-features-inventory.md:73`) and filters unusable tools at the registry (`:187-188`) |
| name-collision policy | the registry, before the model is called | openai-agents-js gives grouped tools a prefixed model-facing name (`docs/research/competitors/openai-agents-js/02-features-inventory.md:120`) and makes the collision outcome a run option, warn and keep the winner or refuse (`:170`); pydantic raises with the remedy named (`docs/research/competitors/pydantic-ai/02-features-inventory.md:72`); cloudflare prefixes tools from many servers under one namespace (`docs/research/competitors/cloudflare-agents/02-features-inventory.md:118`); adk refuses a duplicate plugin name (`docs/research/competitors/adk-js/02-features-inventory.md:76`) |

Selection sits at two poles. At one pole the model sees every available tool and picks by
writing a call; crewai's ReAct grammar matches a requested name against the catalogue and
returns the valid list when it misses (`docs/research/competitors/crewai/02-features-inventory.md:124`),
and cloudflare's code mode goes further, hiding every tool behind one program-writing tool
(`docs/research/competitors/cloudflare-agents/02-features-inventory.md:125`). At the other
pole the configuration computes the exact set and the model chooses inside it, which is
BEEAI's requirement runner and Vercel's `activeTools`.

They meet in four places worth designing for. First, a policy that only lives on the host is
invisible to the model, so the request must carry the advertised subset; every framework that
forces a tool also merges it into the request. Second, enforcement has to survive a model
that ignores the request, which is why Vercel checks after the finish event and raises a typed
tool-choice violation (`docs/research/competitors/vercel-ai-sdk/02-features-inventory.md:53`).
Third, a refusal must be readable, not silent: Vercel emits a denied-output part so the model
sees it next turn (`:48`), and openai-agents-js turns a missing tool into a model-visible
error under a per-run policy (`docs/research/competitors/openai-agents-js/02-features-inventory.md:169`).
Fourth, a forced choice has to be released after it is honoured, or the model repeats it
(`docs/research/competitors/openai-agents-js/02-features-inventory.md:21`).

Our position is the weakest of the three: `HL-01` is a gate before a call, `TL-06` says the
registry is fixed per agent, and no row expresses a per-step set. The policy vocabulary we
need is small and already has a reference implementation: allowed, forced, hidden, a stop
veto, a reason, and a digest that binds an approval to the exact arguments
(`docs/research/competitors/vercel-ai-sdk/02-features-inventory.md:49`).

## 3 Limits

Limits divide by what they bound and by who learns that a bound tripped. The table records
each neighbour's stated default, and the last column is the design decision that matters.

| neighbour | timeout | retry | cache | budget or concurrency | what the trip does |
|---|---|---|---|---|---|
| vercel-ai-sdk | per tool, merged into the abort signal (`docs/research/competitors/vercel-ai-sdk/02-features-inventory.md:52`) | none stated | none stated | a concurrency-limited map over buffered calls (`:46`) | a throwing call becomes a `tool-error` part (`:51`) |
| openai-agents-js | per tool, with a policy of returning an error or raising (`docs/research/competitors/openai-agents-js/02-features-inventory.md:118`) | none stated | none stated | `maxTurns` may be null, which hands budgeting to the host (`:168`) | a tool error or a raise, chosen by the timeout policy |
| beeai-framework | per attempt, a fresh child controller raced against a timer (`docs/research/competitors/beeai-framework/01-architecture.md:163`) | per-tool `maxRetries` and `factor`, zero retries by default (`docs/research/competitors/beeai-framework/02-features-inventory.md:42`) | input-hash key per instance, with in-flight dedupe (`:44`) | 3 per step, 20 total, 10 iterations (`docs/research/competitors/beeai-framework/01-architecture.md:153`) | a fatal, non-retryable typed error when the counter empties (`:154`) |
| crewai | none stated | none stated | per tool, and failures are excluded (`docs/research/competitors/crewai/02-features-inventory.md:127`) | per-tool attempt counts (`:126`) | an exceeded count becomes a failed result the model can read |
| mastra | none stated | a processor retry budget of three per generation (`docs/research/competitors/mastra/02-features-inventory.md:26`) | none stated | ten concurrent calls, but any approval-bearing tool forces sequential (`:22`) | a warning once, then the loop continues |
| pydantic-ai | per tool, declared (`docs/research/competitors/pydantic-ai/02-features-inventory.md:79`) | tool, then toolset, then run default (`:73`) | none stated | none stated | the retry chain resolves upward and then raises |
| mcp-typescript-sdk | 60 seconds per request, overridable (`docs/research/competitors/mcp-typescript-sdk/02-features-inventory.md:42`) | transport reconnection, not call retry | server hints with a 24-hour cap and a partitioned store (`:96-103`) | 64 pages per list, ten rounds per input-required call (`:32`, `:77`) | a typed error carrying the cap, never a partial list |
| e2b | request and body timeouts, the body 60 seconds by default (`docs/research/competitors/e2b/02-features-inventory.md:44`) | 429, 502 and 503, with POSTs retried only on an idempotent allowlist (`:30`) | none | a sandbox lifetime ceiling, one hour on the cheap tier (`:27`) | a typed error naming the layer that expired (`:29`) |
| openhands | the workspace call carries a timeout (`docs/research/competitors/openhands/02-features-inventory.md:65`) | none at the tool boundary | none | iteration cap, budget check and stuck detector, each a typed error (`:26`); resource locks serialise same-resource calls (`:21`) | a typed conversation error event |
| inngest-agent-kit | the hosting runtime's, not the tool's (inferred) | four retries with exponential backoff by default (`docs/research/competitors/inngest-agent-kit/02-features-inventory.md:45`) | none | one inference per call by default (`:71`) | the host runtime retries the step |

Three observations follow. The common default is no retry at the tool boundary and one
timeout per call, with the timeout expressed in the same place as the call; only BEEAI stacks
retry, cache and timeout into a single tool base
(`docs/research/competitors/beeai-framework/02-features-inventory.md:40-45`). The second is
that a limit can trip into three different audiences: a caller-visible typed error (e2b, mcp),
a model-visible tool result (vercel, crewai), or an end to the run (openhands, mastra). A
library should default to model-visible refusal and let a caller escalate, because a refusal
the model can read keeps the loop honest. The third is that cache and approval interact, and no
dive says how a cached result should be treated with respect to the approval that justified
it; crewai excludes failures from its cache and BEEAI scopes its cache to a tool instance,
which at least keeps the question inside one object.

We have exactly one limit today, a run-wide `executionTimeoutMs` (`TL-05`). The smallest useful
addition is a per-tool timeout with the pydantic resolution chain, zero retries as the
default, an opt-in cache keyed by an argument digest, and a concurrency cap that an approval
or suspension lowers to one.

## 4 The execution boundary

Four neighbours cover the boundary, and each answers a different question about it.

| boundary | what crosses | what the guest is | what the host keeps | evidence |
|---|---|---|---|---|
| e2b | code, commands, files, environment, network rules | a sandbox with a lifecycle, snapshots and forks | credentials, through egress transforms and a secrets resource | `docs/research/competitors/e2b/02-features-inventory.md:23-31`, `:37-45`, `:73-75`, `:83-87` |
| openhands | an HTTP contract for commands, files and git | a workspace service, local directory, container or pod | the agent loop, the secret registry and the event log | `docs/research/competitors/openhands/02-features-inventory.md:65-68`, `:127-139` |
| upstream smolagents | tool source, variables and a generated deserializer | a kernel or hosted sandbox reached through one executor interface | the model loop and the step memory | `docs/research/competitors/huggingface-smolagents/01-architecture.md:62-65`, `docs/research/competitors/huggingface-smolagents/01-architecture.md:133-136`, `docs/research/competitors/huggingface-smolagents/02-features-inventory.md:87-89` |
| beeai-framework | source or files to an interpreter HTTP endpoint | nothing local; the interpreter is external | everything else | `docs/research/competitors/beeai-framework/02-features-inventory.md:50-51`, `:59` |
| ours | tagged variables into an executor instance | QuickJS, Pyodide, a host process, Docker or an E2B sandbox | the loop and the tool registry | `docs/research/competitors/_synthesis/00-our-baseline.md:114-121` |

The upstream dive is the most instructive because it moves a tool, not only a program. Its
executor interface has three methods, accept tools, accept variables and run code
(`docs/research/competitors/huggingface-smolagents/01-architecture.md:62-65`), tool source is
extracted with its imports turned into requirements and re-executed in the guest
(`docs/research/competitors/huggingface-smolagents/02-features-inventory.md:77`), and the
serializer refuses pickle unless a caller opts in
(`docs/research/competitors/huggingface-smolagents/01-architecture.md:133-136`). That is a
real tool-shipping contract: schema and dispatch stay on the host, code travels, results come
back as text and images. E2B separates the same concerns into hosted primitives and even
starts an MCP gateway inside the guest, which is the tool source living on the far side of
the boundary (`docs/research/competitors/e2b/02-features-inventory.md:110`).

Three lessons are worth carrying into our E2B backend. First, moving a tool is not moving its
schema: the model-facing definition must stay where the loop can validate arguments, and only
the executable body should cross. Second, the network is the place to put identity; E2B
enforces allow and deny selectors at its proxy, with per-domain header transforms
(`docs/research/competitors/e2b/02-features-inventory.md:83-84`), while OpenHands forwards a
small allowlist of environment variables and scrubs persisted credentials
(`docs/research/competitors/openhands/02-features-inventory.md:66`;
`docs/research/competitors/openhands/01-architecture.md:96`). Third, the boundary needs a
lifecycle verb, not only a run verb. E2B offers pause with a memory or filesystem mode,
snapshots and forks (`docs/research/competitors/e2b/02-features-inventory.md:73-75`), and
OpenHands maps pause and resume onto container or pod lifecycle
(`docs/research/competitors/openhands/02-features-inventory.md:138`). We have neither; `EX-08`
is absent and `EX-05` is kept out by decision 0018
(`docs/research/competitors/_synthesis/00-our-baseline.md:118`, `:121`, `:174`).

Our declared capability bag is the right seam for this (`EX-04`), but a bag of executor
features is not a guest contract. No baseline row says who owns network policy, file transfer,
snapshots or tool installation, so a caller cannot tell whether an E2B backend and a process
backend are interchangeable. `EX-06` records exactly that failure: the value is declared, and
the process backend reports a direct network because it cannot confine
(`docs/research/competitors/_synthesis/00-our-baseline.md:119`).

## 5 MCP as one more tool source

The reference client shows what a registry cannot do on its own. A registry stores
definitions; an MCP connection negotiates a session, then spends the session.

| what the client adds | why a plain registry cannot | position for us |
|---|---|---|
| handshake, revision selection, capability gating per method | the advertised verb set is a property of the peer, not of a stored tool (`docs/research/competitors/mcp-typescript-sdk/02-features-inventory.md:14-26`) | adopt the gating and pin one revision; decline probe-and-adopt era negotiation |
| list pagination with a hard cap and a typed exhaustion | an aggregate that silently truncates looks complete (`:31-32`) | adopt; it is small |
| definition reuse at call time | the cached listing feeds validation and header metadata without another round trip (`:44`, `:33-35`) | adopt; our adapter already holds a definition |
| structured result validation, headers, annotations | an output schema and header parameters change the result shape, not only the arguments (`:34-38`) | validate; pass annotations through as approval hints |
| a per-call timeout, progress and cancellation | a hung call is indistinguishable from a slow one without a bound (`:42-43`) | adopt the timeout |
| server-initiated requests and multi-round input | a handler can return the input it needs instead of pushing a question (`:68-79`) | watch list, not now |
| subscriptions and list-changed invalidation | a cache is wrong without change events (`:81-92`) | adopt only if we cache |
| auth as a transport provider | credentials belong below the tool, so a tool never sees them (`:108-118`) | keep the caller-supplied header path |
| transports with resumption and a hardened stdio | stream loss and environment leakage are transport failures (`:123-131`) | resumption later; stdio hardening is cheap |

Two seams should be kept apart. The connection seam owns the session, the transports and the
credentials; the adapter seam owns the transformation of a remote definition into our `Tool`.
Today both live in one package (`MC-01`, `MC-02`) and the adapter is the only part a caller
sees, which is why the client's own gap file treats resource caching and multi-round input as
client work rather than adapter work
(`docs/research/competitors/mcp-typescript-sdk/03-gap-and-lessons.md:58-65`). Resources,
prompts and completions are the part of the protocol we cannot reach at all (`MC-03`).

The same file ranks three items: those verbs as the only unreachable part, bounded aggregation
and capability gating as small failures worth preventing, and era negotiation, cache and OAuth
as a watch list with a trigger (`docs/research/competitors/mcp-typescript-sdk/03-gap-and-lessons.md:85-89`).
For this lane the middle item is the one to take: a source that can paginate forever or call a
verb the server never advertised is a source we cannot describe in a policy object.

## 6 A recommended shape for us

| step | change | price |
|---|---|---|
| S1 | extend `Tool` with an optional output schema, a generator execute, a typed tool error and a per-tool limit block | M |
| S2 | add a policy object with allowed, forced and hidden sets, a stop veto, a reason and an approval predicate, evaluated once per step | M |
| S3 | make the registry resolve a collision at add time: refuse by default, prefix on request | S |
| S4 | adopt limit defaults: 60-second timeout, zero retries, cache off, ten concurrent calls, one when an approval is pending | S |
| S5 | teach `ExecutorCapabilities` the guest contract fields and make the E2B backend satisfy them | L |
| S6 | push MCP calls through a bounded path with definition reuse and structured output validation | M |
| S7 | pin the whole lane with the tests listed below | M |

No step prices XL, because none of these changes reopens a decision; S5 is the only one that
changes an interface other packages already implement.

### Type changes

- `Tool` gains `outputSchema?`, an `execute` that may return an async generator, and a
  `ToolPolicyHints` field carrying tags and a read-only or destructive hint.
- A `ToolPolicy` object with `allowed`, `forced`, `hidden`, `canStop`, `reason` and
  `requiresApproval`, computed per step from the run state by a caller-supplied function.
- `ToolLimits` with `timeoutMs`, `retries`, `cache` and `maxConcurrency`, resolved per tool
  and overriding a run default, the pydantic chain in miniature.
- `ToolFailure` with a kind, a retryability flag, a message and the offending arguments.

### The policy object

The object is evaluated once per step, before the request is built. It produces the advertised
subset and the forces, and the loop checks the response against the forced set afterwards.
A denial is a result the model reads, not a thrown error. The approval predicate receives the
argument digest, which is what makes an approval id bindable to one call.

### Limit defaults

Sixty seconds is the MCP client's per-request default, and e2b's body timeout lands on the
same number. Zero retries matches BEEAI's tool default and keeps retry a decision the
caller makes per tool. A concurrency cap of ten matches mastra, lowered to one whenever an
approval or a suspension is pending, because ordered approval is worth more than latency.
Cache stays off until a caller asks, then keys on the argument digest and is scoped to the
tool instance.

### The remote-guest contract

The E2B backend must answer four questions the baseline seam leaves open: what can be
installed (tool bodies and their requirements), what can be transferred (files in and out),
what the guest may reach (allow and deny rules), and what can be saved (a snapshot handle, or
an explicit refusal). In method terms that is create or attach, an install step for tool
bodies, put and get for files, an update for the network policy, and a snapshot verb that may
return a typed unsupported. The host keeps the schema, the dispatch and the credentials. A
guest that cannot enforce a network policy reports a typed direct degradation instead of a
silent default, which is the fix for `EX-06`.

### Tests that pin it

- A contract matrix over the tool type: schema, output schema, generator, typed failure and
  limit block, each asserted through a fake executor.
- A policy table: allowed, forced, hidden, stop veto and a denial, each asserted on the
  request the model receives and on what the loop does with a response that ignores it.
- A limit table: default values, per-tool override, timeout trip, retry trip and cache hit.
- A collision suite: duplicate add refused, prefix resolved, and the model-facing name stable.
- A guest suite over the E2B backend's fake: install, transfer, network refusal and snapshot
  refusal.
- An MCP adapter suite: pagination cap, structured output validation, timeout and a tool error
  as a result.

### What to refuse

Do not build a workspace sandbox with a filesystem and a shell (`EX-05`), snapshot and restore
of a live guest (`EX-08`), MCP server authoring (`MC-07`) or a provider-hosted tool family
(`TL-07`). Decision 0018 keeps the sandbox and the server out, snapshot has neither a store nor
a consumer, provider-hosted tools have no consumer yet, and decision 0019 reopens provider
routing only, not this lane (`docs/research/competitors/_synthesis/00-our-baseline.md:107`,
`:118`, `:121`, `:134`, `:174`). Do not adopt an OAuth client, DPoP or machine flows (`MC-06`), era negotiation,
response caching or multi-round-trip fulfilment; the dive prices them separately and then
files them on a watch list with a trigger (`docs/research/competitors/mcp-typescript-sdk/03-gap-and-lessons.md:58-65`, `:89`). Do not
trust a tool loaded from a hub: the upstream dive needed an explicit trust flag before it
executed remote code (`docs/research/competitors/huggingface-smolagents/02-features-inventory.md:79`).

## Provenance

Sources are the twenty-one filed dives under `docs/research/competitors/`, at the dates in
their `04-sources.md`; this brief adds no read of its own. The recommendation that a limit trip
should be model-visible is a cross-dive inference: e2b and the protocol client raise typed
errors, vercel and crewai return readable results, and openhands and mastra end the run. No
dive states which of those should be the library default. If a dive is revised, this file is
superseded, never edited.
