# 0016 — the Pyodide executor is in-process, and its guard is fidelity, not security

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before describing the Pyodide executor as a sandbox, before
  promising a caller a hard wall-clock timeout, or before adding a worker entry.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-14
- **Decided by:** this session, as the posture Task 4 builds to; the owner may
  reverse the worker path or the isolation claim
- **Supersedes:** none

## Context

Task 4 delivers `@smolagents-ts/exec-pyodide`, a Python executor behind the
core's `CodeExecutor` seam. Pyodide is routinely described as a sandbox, and
the reconnaissance measured how little of that description survives on a main
thread: a 200 ms timer never fired during a 3.9 s guest run, so nothing on the
host can interrupt a synchronous loop, and the same measurement reached a
worker only through a shared interrupt buffer with a 519 ms wake. The guest can
also restore the `builtins.__import__` the guard replaced, and the hook sees
the interpreter's own imports, so the allow-list is not a boundary either.

Three questions therefore had to be settled before the code: whether v1 runs
in-process or in a worker, what the capability set may claim about timeouts, and
whether the import guard may be described as isolation.

## Decision

1. v1 is in-process on Node and in the browser. One runtime serves one
   executor, its globals persist across `execute()` calls, and `dispose()`
   drops it. There is no worker entry and no cross-origin-isolation
   requirement.
2. `timeoutMs` is honoured only where the host regains control: before the run
   and as each tool call resolves. The capability set reports no CPU budget,
   because the runtime exposes none to enforce.
3. A deadline or an abort that wins the race leaves the guest executing, so
   that call poisons the session: the next `execute()` builds a fresh runtime,
   the abandoned promise is observed, and the dead run's handlers are detached.
   The cost is one cold start, paid only after a timeout.
4. The import allow-list is a fidelity guard over the guest's
   `builtins.__import__`, defaulting to upstream's base list with a caller's
   additions. Neither the package's README nor its component rule calls Pyodide
   a security boundary, and the restore path is recorded as a known bypass
   rather than asserted as a defence.
5. The wall-clock interrupt path is a follow-up, not part of v1.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **A — a worker from the start** | It is the only way to honour a hard wall-clock timeout, but it changes the deployment story (a worker entry, and cross-origin isolation headers for the shared buffer) and it makes every step a message round trip. The executor seam is the same either way, so the worker is additive later. |
| **B — in-process, claiming a CPU limit anyway** | A capability the runtime cannot enforce is a claim nothing backs; the QuickJS executor already refuses to report a second number for the same reason. |
| **C — in-process, and describing the guard as a sandbox** | The measured restore path and the interpreter's own imports both cross it. A caller who believes the claim writes code that depends on it. |
| **D — no guard at all** | Upstream ships one, and a guest that imports anything silently diverges from the Python an agent would get upstream. Fidelity, not security, is the reason to keep it. |
| **E — leave the poisoned runtime in place and run the next step on it** | Two steps' globals and log lines would interleave, and the next step's result would contain the previous run's output. |

## Consequences

**Positive**

- No worker bundle, no isolation headers, and the same package on Node and in a
  page.
- The capability set is honest: what it reports is what the host can observe.
- A timeout is recoverable, at one cold start, rather than corrupting the next
  step.

**Negative / accepted costs**

- A synchronous guest loop runs to completion however long it takes; the host
  learns of the timeout when the loop yields, and the timeout error is reported
  then rather than at the deadline.
- The executor is not a security boundary and must not be offered as one.
- A caller who needs a hard interrupt supplies a worker-backed runtime through
  the injectable loader, or waits for the follow-up.

## Reversibility

Moderate. The loader is injectable, so a worker-backed runtime is a new entry
point plus a package subpath with no change to `PyodideExecutor`; withdrawing
the poisoning behaviour would touch `execute()` and its integration test only.

## Follow-up

- [ ] `docs/plans/2026-10-14-t13-exec-pyodide-plan.md` carries the tasks and the
      measured probes.
- [ ] The worker interrupt path is filed as a task in `docs/04-tasks.md` rather
      than built here.
