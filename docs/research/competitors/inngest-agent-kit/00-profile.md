# inngest/agent-kit — repository profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Identity**

| field | value |
|---|---|
| Repository | https://github.com/inngest/agent-kit |
| Owner | Inngest Inc. |
| Licence | Apache-2.0, SPDX id returned by the GitHub repository endpoint on 2026-10-21 |
| Licence file | `LICENSE.md`, 10,932 bytes, Apache License Version 2.0; no `NOTICE` at the root |
| Read commit | `6c9802fd79471bd77c0072a2978f45720dc1ca99` |
| Commit date | 2026-04-29 18:36:04Z |
| Commit subject | `Improve support for reasoning models (#287)` |
| Upstream branch | `main`, last pushed 2026-04-29T18:37:00Z |
| Version read | 0.13.2 in `packages/agent-kit/package.json`; the React package is 0.4.0 |
| Language | TypeScript on Node; zod 4 and `inngest` 3.43.1 or newer as peer dependencies |
| Packaging | pnpm monorepo: two published npm packages, an in-repo docs site, 20 example applications |
| Scale | 708 tracked files at the pinned commit |
| Repository description | AgentKit: Build multi-agent networks in TypeScript with deterministic routing and rich tooling via MCP |
| Stars | 950 on 2026-10-21 |
| Read on | 2026-10-21, depth D2 plus source spot-reads at the pinned commit; shallow clone kept at `reference/competitors/inngest-agent-kit` |

**What the project is**

AgentKit is a TypeScript library for composing agents into a network, and the
composition vocabulary is small: an `Agent` wraps one model call plus its tools,
a `Network` is a while loop that calls agents, a `Router` decides which agent
runs next, and a `State` object holds typed data and the results so far. The
documentation states the loop plainly as "while loops with memory" and puts the
router's decision after every agent call
(`clone:/docs/src/content/docs/concepts/networks.mdx:36`,
`clone:/docs/src/content/docs/concepts/routers.mdx:12`).

The distinguishing claim is not the loop. It is that this loop is meant to run
inside an Inngest function, where the model call becomes a hosted step
(`step.ai.infer`) whose result is memoised, and where a tool may wait for an
external event without holding a process. Inngest is a required peer dependency
from 0.9.0 onward, and the library discovers the platform at run time by asking
for the step tools out of an async context
(`clone:/packages/agent-kit/src/util.ts:34-46`). The same code path degrades to
a plain HTTP model call when that context is missing
(`clone:/packages/agent-kit/src/model.ts:57-96`).

`createServer` closes the loop: it registers every agent and network as an
Inngest function triggered by an app-scoped event, then serves them
over Express with the `inngest/node` handler
(`clone:/packages/agent-kit/src/server.ts:49-80`). Deployment is a sync of that
HTTP endpoint with Inngest Cloud, and the docs describe the whole flow
(`clone:/docs/src/content/docs/concepts/deployment.mdx:26-115`).

**Corrections to the brief**

The brief expected Apache-2.0 and that is what the endpoint reports; the
licence file is the standard text and no copyleft question arises. It also
asked how a durable function is composed here, naming steps, sleep,
wait-for-event and retries. Those are Inngest's primitives, not this
repository's: the package contains no scheduler and no replay engine. Its core
uses just three tools from the platform, `step.run` for deterministic ids,
`step.ai.infer` for the model call and `step.invoke` for a function used as a
tool (`clone:/packages/agent-kit/src/agent.ts:157`,
`clone:/packages/agent-kit/src/model.ts:53`). Sleeps and event waits appear only
in the docs and examples, handed to the developer's own code.

Two further corrections. This is a single-language repository, TypeScript only,
so there is no second runtime to compare. And it is dormant relative to the
register: the last commit is six months before this read, the package is still
0.x, and no deprecation notice exists in the tree.

**Why it is in the register**

Every other neighbour in this set either ships durability as a store beside the
loop or does not claim durability at all. This one is the clean opposite of our
arrangement: the loop itself holds nothing durable, and the host replays it.
That makes it the best available evidence for what a step boundary should
guarantee before we add a seam to our own loop.

**Positioning against our baseline**

| concern | AgentKit's answer | ours, per the baseline |
|---|---|---|
| the loop | a while loop inside a host function, replayed by the host | an in-process loop in `packages/core/src/agent/multi-step-agent.ts` (RT-02) |
| durable state | the orchestrator memoises step outputs; `State` itself lasts one run | a checkpoint written after steps (HL-03) |
| cross-run memory | a four-hook history adapter the caller implements | an `AgentSession` checkpoint across turns (RT-14, HL-08) |
| human input | the tool waits on an event, with a timeout and a match field | approval before a tool (HL-01), with nothing that suspends (HL-02) |
| observability | step-level traces in the platform, token usage per inference | a local span tree (OB-01) with no exporter (OB-02) |
| deployment | Inngest Cloud plus a sync, or the dev server locally | deliberately absent (DS-05) |
| code execution | not shipped; E2B, Daytona and Browserbase arrive as tools | three executors (EX-01 to EX-03) |
| stance | a library paired with a platform partner | a library alone, per decision 0018 |

**Limits of this read**

Source spot-reads covered the loop, the model call, the history hooks, the
router and the server; the rest of the package (adapters, streaming internals)
was read only where a claim needed a line. Three examples were sampled rather
than read: deep-research, support-agent-human-in-the-loop, e2b-coding-agent.
Nothing was installed, built or executed, and every claim about step behaviour
comes from Inngest's published
documentation, cited in `04-sources.md`. The live docs site may have moved past
this commit: its current AgentKit snippet passes `step` into the model
constructor, a shape 0.13.2 does not have
(`https://www.inngest.com/docs/features/inngest-functions/steps-workflows/step-ai-orchestration`).
