# 0020 — a capability is a claim the runtime consults or enforces

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before adding a field to a capability bag, or after finding a
  declaration that nothing reads or enforces.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-22
- **Decided by:** owner, answering the two blocking questions of the 2026-10-22 study plan
- **Supersedes:** none (decision 0011's name choice stands; this one fixes the shape of a field it names)

## Context

The competitor study left 565 gap rows against 97 capabilities, and two of them
were the only items that blocked the plan's first phase. Both were the same
defect seen twice: a declaration the runtime never consults, in a bag a caller
is meant to plan around.

The executor seam declares `network: "none" | "host-mediated" | "direct"`
(`packages/core/src/executor.ts:7`), and the three remote backends all report
`direct` from a hard-coded capability object
(`packages/exec-remote/src/backends/e2b.ts:79`,
`docker.ts:100`, `process.ts:108`). No policy input exists anywhere on
`SandboxStartOptions`; the E2B seam's `create()` accepts only an API key, a
timeout and a template (`e2b.ts:48`), so the vendor's own allow and deny
controls are unreachable even though the vendor supports them. A caller reads
`direct` as a statement about confinement, and nothing backs it.

The model seam declares `structuredOutput: boolean`
(`packages/core/src/model.ts:64`), defaults it to false, and every adapter
leaves it false through `modelCapabilities()` overrides. Nothing in the loop
reads it: the only capability consumed is `streaming`
(`packages/core/src/agent/multi-step-agent.ts:617`). The seam has no channel
that could carry a schema either — `GenerateOptions` is a system prompt, tools,
stop sequences, temperature and a token cap (`model.ts:67-74`) — and the only
JSON Schema that reaches a wire is a tool's input schema
(`packages/core/src/tool/tool.ts:77`). Meanwhile the agent layer does have
structured output, in its worst form: `AgentOptions.outputSchema` is validated
once at the end and a mismatch fails the run
(`multi-step-agent.ts:713-725`), the model never receives the schema, and both
flavours end through `final_answer`
(`code-agent.ts:87`, `tool-calling-agent.ts:94`).

## Decision

A field in a capability bag is a claim the runtime consults or enforces, and
nothing else belongs in the bag. Every claim names the site that consumes or
enforces it and the test that proves it; description and policy are separate
axes, and a description never implies control; a backend or adapter refuses an
option it cannot honour rather than ignoring it.

Applied to the two blocking questions:

- **Egress (`EX-06`).** `network` stays a description of reach. A new
  `egress: "unmanaged" | "deny-all"` policy axis is added beside it. The E2B
  backend enforces deny-all by passing the vendor's network option through its
  seam; the Docker and process backends refuse a deny-all request with a typed
  error before the guest starts. Allow and deny lists, per-domain rules and live
  updates are not built until a fetch or workspace capability exists to need
  them and a user asks.
- **Output (`GR-05`).** The `structuredOutput` boolean is removed rather than
  replaced by a mode enum. Structured output is an agent contract: `outputSchema`
  is bound to `final_answer` in both flavours, a mismatch returns as an
  observation the bounded repair may act on, and a mode enum lands only in the
  same change as a model-seam schema channel (`GenerateOptions`) and its
  consumer.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **Full egress policy now: allow and deny lists, per-domain rules, live updates** | It is a platform feature priced at XL: Docker needs a sidecar to keep the host's kernel path while the container has no route, the vendor's proxy has recorded protocol holes, and the resulting guarantee cannot be tested in CI. With no fetch tool shipped, an allow-list has nothing to allow. |
| **Drop or rename `network`, document the boundary, enforce nothing** | Cheapest and honest, but it gives up the only confinement we could actually deliver on one backend, and it leaves a remote guest with ambient egress and no way to ask for less. |
| **Defer both questions until a user asks** | Phase 0 exists to stop shipping declarations that lie; deferring keeps both in the first release. |
| **Replace the boolean with a mode enum now** | The enum would have no consumer: neither flavour asks a model for a schema-shaped reply, and the seam cannot carry one. It would add a third unread field while closing the second. |
| **Keep the boolean as a deprecated alias for one minor** | Deprecation protects installed callers; there are none, because 0.1.0 is unpublished. It would ship the wrong surface in release one and buy a migration with no beneficiary. |
| **Add a parallel `outputModes` field beside the boolean** | Two sources of truth for one fact, and the boolean keeps lying. |

## Consequences

**Positive**

- The two blocking questions close without a new package, a daemon or a
  hosted service, so the plan's first phase keeps its size.
- A caller asking for confinement gets enforcement or a typed refusal before any
  guest runs, which makes the capability bag a contract instead of a comment.
- Structured output starts working on prompt-only models through the repair
  loop, which is the case a native-JSON flag never covered anyway.
- The rule generalizes: the next capability added to either bag arrives with its
  read site and its test.

**Negative / accepted costs**

- Docker and process users who ask for deny-all get an error rather than a
  policy. Docker could confine with a sidecar or an exec-based transport, and
  that is knowingly deferred.
- Removing a public field is a breaking change. It is free today because nothing
  is published, and it will not be free after `T-14`.
- Models that do support `response_format` are not exploited: we knowingly
  leave a real capability unclaimed until the seam can carry a schema and a
  consumer exists.
- E2B deny-all is proven against a backend double, not a live sandbox, because
  the suite reaches no network.

## Reversibility

Easy. The policy axis is additive: a later allow-list is a new value and a new
backend branch. The removed field can return as a union in any minor, with the
enum and its consumer in one change. E2B enforcement is a single option passed
through an internal seam, so disabling it is a one-line revert.

## Follow-up

- [ ] **Phase 0.2** — bind `outputSchema` to `final_answer` in both flavours, return a
  schema mismatch as an observation, and remove `structuredOutput` from
  `ModelCapabilities`.
- [ ] **Phase 0.3** — bound the repair attempt, with its own budget, that the
  mismatch observation enables.
- [ ] **Phase 0.4** — add the `egress` axis; E2B enforces deny-all, Docker and process
  refuse typed, and `network` is documented as reach only.
- [ ] **Phase 0.10** — prove the path on a model that cannot call tools: the repair
  loop, not a forced tool, is what makes structured output universal.
- [ ] **Code comments** — point `model.ts` and `executor.ts` at this record, so the
  shape of each bag has one explanation.
- [ ] **Docker deny-all** — decide between a sidecar and an exec-based transport when the
  guest contract lands, not before.
