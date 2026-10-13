# rules/13 — Tool and context economy

**Purpose:** context is the scarcest resource in an agent session. Spend it on
answers, not on traffic.

## Contract

- **Mutability:** approval-only.
- **Applies to:** how the agent gathers information and issues calls.

## Rules

**R-13.1 — Batch independent calls.** MUST issue independent reads, searches,
and inspections together in one step. *Why:* the cost of a step is dominated by
the context it carries, not by the number of calls in it.

**R-13.2 — Front-load discovery.** The first reconnaissance step SHOULD carry
every independent inspection you can foresee. *Why:* discovery dribbled one call
at a time multiplies cost for the same knowledge.

**R-13.3 — Read once, act many.** SHOULD gather everything needed, then apply
all changes, then verify once. *Why:* interleaving reads and writes both for no
benefit.

**R-13.4 — Read narrowly.** MUST use offsets, limits, and targeted search
rather than dumping large files. *Why:* everything read stays in context for
the rest of the session and is paid for repeatedly.

**R-13.5 — Do not re-read unchanged content.** MUST NOT re-read a file that has
not been modified since it was read unless a write rejected it. *Why:* no new
information, full price.

**R-13.6 — Do not re-derive recorded facts.** MUST read the environment,
memory, and state documents rather than probing to rediscover what they already
state. *Why:* re-derivation costs time and creates a second, weaker copy.

**R-13.7 — Summarize, never echo.** MUST extract conclusions and cite the
source; MUST NOT paste large tool output back into the conversation. *Why:*
echoing doubles the cost of the output.

**R-13.8 — Run long work in the background.** MUST start anything expected to
take minutes as a background job and continue with other work. *Why:* blocking
on it wastes the interval.

**R-13.9 — Never busy-poll.** MUST NOT loop, sleep-wait, or repeatedly check a
background job. MUST collect it when notified or when genuinely blocked. *Why:*
polling burns steps and produces no information.

**R-13.10 — Sequence only real dependencies.** MUST NOT serialize calls whose
results do not affect each other. *Why:* it is pure latency.

**R-13.11 — Search narrowly first.** SHOULD use a targeted pattern before a
broad enumeration, and MUST use path-anchored patterns where possible. *Why:*
broad patterns return the world.

**R-13.12 — Delegate to protect context.** SHOULD hand a self-contained
multi-step subtree to a subagent when its intermediate steps would otherwise
accumulate in the main context. *Why:* the parent pays one result instead of
every step.

**R-13.13 — Keep the loaded surface small.** MUST keep the always-loaded entry
files small and push detail behind pointers. *Why:* the entry files are paid
for in every single session.

**R-13.14 — Prefer the cheapest sufficient tool.** SHOULD use the simplest tool
that answers the question — a search before a full read, a read before a run, a
run before a build. *Why:* cost and blast radius both grow down that list.

## Adapting

Record any project-specific tooling that changes these economics — a cache, an
index, a fast health command, a service that must be started once per session.
