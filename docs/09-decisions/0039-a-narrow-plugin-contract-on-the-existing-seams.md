# 0039 — a narrow plugin contract on the existing seams, proved before it is frozen

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before adding a plugin host, a named hook, `agent.use()`, or a field to the run record that names plugins.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-11-11T18:00:00+03:00
- **Decided by:** owner, 2026-11-11: "Narrowed Path A"
- **Supersedes:** none

## Context

The owner asked for every feature to be addable and removable cleanly, after studying DeepSeek Harness. That project builds on Cordis: services live on a context under names (`ctx.tools`), plugins declare what they need with `inject`, every registration is a reversible effect, and events declare a dispatch mode (emit, waterfall, parallel, serial, bail).

Two paths were compared. Path A keeps this library's typed seams (`AgentOptions`, `Model` wrappers, tools, executors, `AgentMiddleware`, the event stream) and adds a small plugin contract on top. Path B adopts the context-and-services model, either as our own container or as a dependency on `@cordisjs/core`.

A review room and an independent read-only audit (15 findings, 4 high) tested the first draft of Path A against the tree at `1ae599c`. They found five problems:

- Replay returns a journaled result without comparing its digest (`multi-step-agent.ts`, the `done` branch of the model journal; `tool-calling-agent.ts`, the tool replay branch). The run record does not name the plugins that were active. If plugins can change, a resume with a different set diverges silently.
- Approval binds a digest of exactly the arguments `execute` receives (`approval.ts`), and resume honours a settlement only when the digest matches. A hook that rewrites arguments after approval would run a call nobody approved.
- `Guardrails` checks only input and output, and `toolPolicy` controls which tools a step offers. Neither runs per tool call, so neither can move onto a tool hook. A final-answer check has no hook at all.
- CodeAgent guest code calls tools inside the executor, including remote executors, so hooks placed in the loop never see those calls. Hosted tools bypass the tool wrapper.
- A hook that swaps the model breaks cost and identity, which key on `model.id`. A `Model` wrapper (as `FallbackModel` in [0038](0038-provider-fallback-and-local-runtimes-before-retrieval.md)) already covers a pre-request hook.

## Decision

Take Path A, narrowed. First make replay tell when the plugin set has changed. Then add a plugin host whose tool hooks live in the tool wrapper. Then prove the contract by re-expressing one existing feature as a built-in plugin, with no existing test edited, by 2026-12-15. No hook name is frozen before that proof passes.

The contract has six rules:

1. **The record names the plugins.** The run record gains `plugins: { name, version, configDigest }[]`. Resume and fork compare it and throw `RunPluginMismatchError` unless the caller opts into drift. Replay compares the recorded digest before it returns a journaled result.
2. **Approval is last.** `tool:before` listeners run before the approval gate, and nothing changes a tool's arguments after it. The host enforces this; it is not a convention.
3. **Tool hooks live in the tool wrapper**, so they fire for ToolCallingAgent, CodeAgent guest calls and remote executors alike. Hosted tools are outside the hook surface, and the docs say so.
4. **No model swap in a hook.** `model:request` may edit messages and options. Changing the model stays a `Model` wrapper.
5. **Between runs only.** `agent.use(plugin)` returns a handle with `dispose()`; both throw during an active run. Every registration returns an undo function.
6. **Options stay.** Today's `AgentOptions` fields stay as written. Where one is re-expressed as a built-in plugin, the option remains as the way to configure it.

The first hook set, each with its dispatch mode stated: `model:request` (waterfall), `model:response` (emit), `tool:before` and `tool:after` (waterfall, in the tool wrapper), `answer:check` (serial; a rejection becomes a memory step), `step:end` (emit).

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Path B on `@cordisjs/core` | Types become global declaration merges, lookups are runtime, the bundle grows in browser, Deno and Bun builds, and the library follows upstream drift. Replay, child agents and executor-side tool calls all get harder under dynamic lookup. |
| Path B as our own container | It avoids the dependency but keeps every runtime-lookup cost above, and adds a framework to maintain. |
| Path A as first drafted | It put guardrails and tool policy on hooks that cannot host them, let `tool:before` rewrite arguments after approval, and left replay blind to plugin changes. |
| Scoped plugin hosts for child agents | Children are built by the caller, one instance can serve several parents, and a background child resumes in another process with whatever agent is passed. Inheritance would mutate shared state. |
| Adding and removing plugins mid-run | It needs a durable-run design that logs removal at step boundaries. Nothing asks for it yet. |
| No plugin API in 0.x | It remains the outcome if the proof fails by 2026-12-15. |

## Consequences

**Positive**

- A feature can be added and removed with one `use()` and one `dispose()`, and a resumed run fails loudly instead of diverging when the set changed.
- Replay becomes safer for every run, plugin or not, because it checks digests.
- Core keeps zod as its only runtime dependency.

**Negative / accepted costs**

- The run record changes shape, and the event or terminal unions may need to follow. Both are public contracts consumed by `react` and `react-ui`.
- A stop-the-run hook is left out of the first set, because it needs a new member in the closed terminal union.
- The output type is not inferred from `outputSchema` today. This decision does not claim it, and a plugin can still make the static type disagree with the value.
- `model:response` is recorded here as a fourth option for T-54's metadata channel (D-08); it does not settle that choice.

## Reversibility

Easy until the first publish that exports the host: it is additive. After that, removal is a deprecation. The digest check on replay is a behaviour fix and stays either way.

## Follow-up

- [ ] T-74: the plugin field on the run record, `RunPluginMismatchError`, and digest-checked replay. Owner: lead.
- [ ] T-75: `PluginHost`, `definePlugin`, `agent.use()`, and the hook set in the tool wrapper. Owner: lead.
- [ ] T-76: the proof, re-expressing the monitor and cost wiring as a built-in plugin, by 2026-12-15. Owner: lead.
- [ ] T-77: the table of where each kind of behaviour belongs, with the T-52 guide decision. Owner: lead.
- [ ] If T-76 misses 2026-12-15 with the suite unchanged, write a record that ships no public plugin API in 0.x. Owner: lead.
