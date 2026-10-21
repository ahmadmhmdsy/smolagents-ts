# claude-agent-sdk — gaps and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Every row names the baseline row it extends. Buckets and effort follow the method:
A roadmap follow-on, B non-goal, C unconsidered, D depth gap; S, M, L, XL effort.
Evidence citations use the same legend as the features file: `sdk.d.ts:N` is the
published declaration fetched at 0.3.306, `<page>.md:N` is a page fetched from
https://code.claude.com/docs/en/agent-sdk/ on 2026-10-21.

## Bucket C — unconsidered

| id | gap | baseline row | fit | effort | evidence | note |
|---|---|---|---|---|---|---|
| C-01 | an ordered approval policy ladder, not one boolean gate | HL-01 | existing gate | M | `permissions.md:13-52` | Their order is hooks, deny, ask, mode, allow, callback; deny rules outrank bypass, and ask rules force the callback even there. Our gate has no policy order or rule source, so a caller cannot express "deny this tool type regardless of what the user allowed". |
| C-02 | an approval request as an addressable, redeliverable object | HL-02 | new seam | M | `sdk.d.ts:3028-3053`, `:222-226` | A reconnected host re-sends the initialize request and the CLI replays any control request still blocked, with request ids deduped SDK-side. The durable analogue is a pending-approval row keyed by request id, resolvable twice without re-running the tool. |
| C-03 | caller-visible typed interception with decisions | RT-08, RT-09 | event layer | M | `sdk.d.ts:981-1001`, `hooks.md:35-39` | Our middleware wraps the step and our events describe it; neither can veto or rewrite a single tool call before execution, and neither is a typed contract with a decision result. |
| C-04 | a transcript-mirror store contract distinct from run state | HL-04, HL-09 | RunStore | L | `sdk.d.ts:6817-6895` | Append, load, list, summaries, delete and subkeys, with UUID dedupe and per-session summary folds. Our RunStore stores step snapshots; there is no shape for "stream a log somewhere and reload it elsewhere". |
| C-05 | validated fork at an arbitrary chain position | HL-07 | new seam | L | `sdk.d.ts:2128-2184` | A fork point is any transcript UUID, and the truncating form refuses when the discarded range contains an entry the caller's view had not seen. We have no replay or branch point at all. |
| C-06 | a prompt-level capability filter with namespaced assets | TL-06 | tool registry | S | `sdk.d.ts:2300-2322` | The `skills` option enables all skills or a named subset, and unlisted ones are hidden from the listing while remaining readable on disk. We have no notion of an optional, named prompt asset. |
| C-07 | a per-turn outcome with delivery sequence | RT-09 | events | M | `sdk.d.ts:5954-5956`, `:5964-5967` | Exactly one result ends a turn and carries `result_index`, so a consumer can detect a lost result from a gap. Our stream has no settlement record a client can count. |

## Bucket A — roadmap follow-on

| id | gap | baseline row | fit | effort | evidence | note |
|---|---|---|---|---|---|---|
| A-01 | cost accounting and a budget stop | OB-06 | monitor | M | `sdk.d.ts:6033-6041`, `:1965` | Cumulative per call, per model, with a pricing basis and a documented one-response overshoot. Our monitor records tokens; a run has no priced total and no spend cap. |
| A-02 | schema-repair loop for structured output | GR-05, GR-06 | guardrails | M | `sdk.d.ts:5908` | Exhausted structured-output retries are their own terminal subtype, so the loop retries validation before failing. Our mismatch fails the run immediately. |
| A-03 | context compaction with a boundary event | HL-08 | session | L | `agent-loop.md:264-274` | Summarize old history, emit a boundary message, and let a hook archive the pre-compaction transcript. We have a step cap, not a context strategy. |
| A-04 | background and parallel subagents with caps | MA-04 | managed agents | L | `sdk.d.ts:83`, `:1902`; `subagents.md:628-710` | A child can run detached, forward a nested transcript, and be bounded by depth, concurrency and spend. Our child runs inline inside the tool call. |
| A-05 | session administration surface | HL-04, HL-08 | RunStore | S | `sdk.d.ts:689-1050` | List, inspect, rename, tag, delete and import. A store seam without these is a lookup, not a product surface. |
| A-06 | fail-closed headless default | HL-01 | approval gate | S | `sdk.d.ts:2053` | One setting denies every would-be prompt and tells the model there is no approval surface. Our headless path has no declared default. |
| A-07 | budget headroom disclosure | OB-06 | monitor | S | `agent-loop.md:203-205` | The cap is checked after a response, so a caller must be told the overshoot bound. Any cap we add should document the same. |

## Bucket D — depth gap

| id | gap | baseline row | fit | effort | evidence | note |
|---|---|---|---|---|---|---|
| D-01 | a pending approval that survives a restart | HL-02 | approval gate | M | `user-input.md:123-145` | Theirs blocks inside a live process and has no park deadline; ours cannot represent a pending approval at all. Neither is durable, but ours cannot even be observed by a second process. |
| D-02 | recovery inside a step | HL-05 | RunStore | M | `sessions.md:392-402` | They resume at a turn boundary and replay whatever the turn had not finished; we lose the whole step. Their answer is coarser than the row we want, so copy the boundary discipline rather than the mechanism. |
| D-03 | shipped durable stores | HL-09 | RunStore | L | `session-storage.md:186-233`; `examples/session-stores/` | Postgres, Redis and S3 adapters plus a conformance suite ship as examples. We ship memory only. |
| D-04 | nested-agent output attribution | RT-09 | events | S | `sdk.d.ts:1902`, `:5558` | Subagent blocks carry the parent tool-use id, and text forwarding is opt-in. Our events do not identify which managed agent produced a block. |

## Bucket B — non-goal

| id | gap | baseline row | fit | effort | evidence | note |
|---|---|---|---|---|---|---|
| B-01 | a workspace with shell and filesystem | EX-05 | none | XL | `hosting.md:53-63` | Decision 0018 keeps the workspace out. Their whole permission apparatus exists because a shell and a filesystem are the product. |
| B-02 | a bundled agent runtime and its hosting | EX-05 | none | XL | `hosting.md:15-21` | A subprocess per session, containers, egress proxies and credential injection are deployment concerns we refuse. |
| B-03 | an MCP server marketplace and connectors | MC-07 | MCP client | XL | `mcp.md:381-535` | Connector tools with organisation-level approval are a hosted product, not a library feature. |
| B-04 | a skill and plugin ecosystem loaded from disk | TL-06 | tools | L | `sdk.d.ts:2068`, `:2299` | Plugins, commands, agents and hooks discovered from `.claude` trees assume the filesystem workspace also kept out. |
| B-05 | a subscription or key-based commercial auth lane | MD-05 | models | M | wrapper `README.md` licence section | API-key and commercial-terms auth belong to the vendor, not to an adapter interface. |
| B-06 | a hosted managed-agent service | DS-05 | none | XL | `overview.md:13-20` | Managed Agents is a separate product with a REST API; we ship a library, not a service. |

## What we have that they lack

- Executors with a declared capability bag and three implementations (RT-01, EX-01
  to EX-04). Their only execution surface is the shell inside the bundled binary.
- An open model layer with several adapters and a function-defined model (MD-01), so
  the loop is not tied to one vendor.
- A per-step run snapshot behind a store seam (HL-03). Their state unit is the
  conversation transcript, which is a weaker boundary for a crash.
- A local event stream and middleware chain a caller can consume directly (RT-08,
  RT-09) rather than a fixed set of hook event names.
- React rendering layers over the run (UI-01 to UI-08), which have no counterpart in
  a headless SDK.
- A small evaluation harness (OB-04). The SDK exports no evaluation or scoring type.
- Guardrail tripwires independent of tool approval (GR-01), which their ladder does
  not express.

## Patterns worth copying

1. **Ordered deny-first ladder.** Put deny rules before the mode, and let an ask rule
   force the gate even in a permissive mode. A policy object with explicit precedence
   is more honest than a boolean.
2. **Approval as an idempotent request.** Key a pending approval by request id, allow
   the same resolution to be delivered twice, and re-announce outstanding requests
   when a client reconnects. Their `reinitialize` path proves the need.
3. **Fail-closed headless mode.** A declared "no approval surface" setting that denies
   immediately and tells the model why beats a run that waits for a UI nobody built.
4. **Store conformance suite.** The wrapper vendors a 13-check behavioural suite for
   its store adapters (`examples/session-stores/shared/conformance.ts:1-18`, `:68`).
   A `RunStore` contract without such a suite will have adapters that disagree.
5. **Cumulative cost with a basis.** Report running totals per turn, per model, with
   the pricing basis attached, and document the cap's overshoot rather than pretending
   it is exact.
6. **Validate a truncating resume.** Refuse the fork when the discarded range holds
   entries the caller did not observe. Silent data loss at a branch point is the
   expensive bug.

## Patterns worth avoiding

1. **Transcript as the run state.** Their resume reloads a conversation, not a step.
   Side effects already performed are re-derived from prose, and the transcript entry
   union is deliberately undocumented and opaque (`sdk.d.ts:6897-6915`).
2. **Best-effort durability.** A failed mirror batch is dropped with a `mirror_error`
   message and the run continues (`session-storage.md:295-299`). For a run
   checkpoint, a lost write must fail the run.
3. **Approval that parks a process.** No deadline, an open stdin requirement, and a
   documented dummy-hook workaround for keeping the stream alive is a design that only
   works when one host owns one process.
4. **Surface sprawl.** Thirty-three hook events, six permission modes and a 95 KB
   changelog are a maintenance tax paid for breadth; we should add the ordered ladder
   and a handful of typed points, not a taxonomy.
5. **Path-derived session identity.** The store key includes a project key derived from
   the working directory (`session-storage.md:87-89`), so a resume from another
   directory misses. Use explicit ids in our store keys.
6. **Local-first state with hidden sweeps.** Transcripts land on local disk first and
   are cleaned by a CLI setting; retention becomes an undocumented interaction.

## What this should change for us

1. Add the pending-approval row behind HL-02 now that two neighbours (this one and
   Cloudflare) both make approval an object, not a callback: id, run, step, tool, an
   arguments digest, status, expiry, and an idempotent resolve.
2. Put an ordered policy in front of HL-01: deny, ask, mode, allow, then the human
   gate, with deny outranking every mode. Price M and keep the gate's existing shape.
3. Upgrade HL-05 from "checkpoint between steps" to a journaled step result with a
   generation fence, using their turn boundary as the fallback discipline.
4. Define the RunStore adapter contract as append and load plus list, delete and a
   conformance suite, so HL-09 has somewhere to land.
5. Add a priced per-turn total and a run budget cap to OB-06, with the basis and the
   one-response headroom stated.
6. Make the headless default explicit and deny-by-default, and stop treating a missing
   approval surface as an implicit wait.

## Baseline and register corrections

No baseline row is wrong. HL-03's wording ("checkpoint a run's memory after each
step") is narrower than this neighbour's transcript resume, and the comparison
supports keeping it: a step snapshot is a better crash boundary than a transcript, so
the row should not be rewritten to match. The register row for this repository needs
one correction: the licence column should read "no licence (commercial terms)" and the
depth should read D2, not D3, because the method's unlicensed path forbids the deep
read the register assumed.

## Confidence

The type declarations are exact and quotable; the documentation pages are current to
the same day. Runtime behaviour, wire frames and error paths were not exercised, and
the CLI internals behind the documented behaviour were not read. Rows marked
`inferred` in the features file are the ones most likely to be wrong in detail and
right in shape.
