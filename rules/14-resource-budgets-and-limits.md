# rules/14 — Resource budgets and limits

**Purpose:** use the machine hard, and never at someone else's expense.

## Contract

- **Mutability:** approval-only.
- **Applies to:** CPU, GPU, memory, disk, network, and money.

## Rules

**R-14.1 — Identify the shared resources.** MUST know, before launching
anything heavy, which resources are shared, who else uses them, and what the
current usage is. *Why:* a resource that is shared is a resource you can take
from someone.

**R-14.2 — Measure before claiming.** MUST measure actual current usage rather
than assuming availability. *Why:* availability changes between the plan and
the launch.

**R-14.3 — Leave headroom.** MUST NOT consume a shared resource to its limit.
The project declares the ceiling in `docs/02-environment.md`; absent one, MUST leave
substantial headroom. *Why:* the last few percent are what cause other people's
failures.

**R-14.4 — Serialize exclusive resources.** MUST NOT run a second job that
competes with an exclusive resource already in use by this project. *Why:*
competition produces out-of-memory failures that look like defects in the
victim.

**R-14.5 — Never disturb what you did not start.** MUST NOT cause another
process to fail, be killed, or be starved. *Why:* the harm is invisible and
attributed to someone else.

**R-14.6 — Long jobs are resumable.** SHOULD design any long run to checkpoint
and resume, and SHOULD be able to re-run it with the same command after a
failure. *Why:* it is the difference between losing minutes and losing a day.

**R-14.7 — Cost requires approval.** MUST NOT incur new recurring cost —
paid API usage at scale, cloud resources, licenses, instances — without
explicit approval. *Why:* cost is external and often irreversible.

**R-14.8 — Check headroom before large writes.** MUST check free disk before
generating large artifacts, and MUST follow the project's cleanup policy rather
than deleting by intuition. *Why:* a full disk corrupts unrelated work.

**R-14.9 — Slow is not stuck.** MUST NOT kill a running job for being slow.
MUST distinguish slow from hung by inspecting progress. *Why:* long jobs look
identical to hung ones from outside.

**R-14.10 — Pace sustained load.** SHOULD pace sustained work rather than
spiking to the machine's maximum, where the hardware throttles. *Why:*
sustained throughput is not peak throughput.

**R-14.11 — Clean up what you started.** MUST terminate owned background jobs
and processes when the work is finished or abandoned. *Why:* orphans hold
exclusive resources.

**R-14.12 — Report expensive runs.** MUST report the resource used by any long
or large run, and where its output lives. *Why:* it is the input to the next
resource decision.

**R-14.13 — Declare stop conditions.** Any expensive operation MUST have a
stated budget and a stop condition before it starts. *Why:* an unbounded
expensive operation consumes without authorization.

## Adapting

Record in `docs/02-environment.md` the machine's actual limits, and in
`docs/08-coordination.md` the exclusive resources,
the declared headroom rule, the budget ceilings, and the cleanup policy. This
is the module most likely to need project-specific numbers — fill them in or
delete the module if the project consumes no significant shared resource.
