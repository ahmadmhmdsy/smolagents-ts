# 0041 — the Pyodide worker is built ahead of its trigger, in the shape 0033 pre-registered

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before building, changing or pricing `PyodideWorkerExecutor`, or before promising a caller a hard wall-clock bound on Python.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-11-13T12:30:00+03:00
- **Decided by:** owner, 2026-11-13: T-24 "Build it now"
- **Supersedes:** items 1 and 4 of [0033](0033-the-pyodide-interrupt-stays-deferred.md), the deferral and its trigger only. 0033's corrected premises (item 2), its pre-registered shape (item 3), its README limitation (item 5) and its gate rule for the browser half (item 6) stand.

## Context

[0033](0033-the-pyodide-interrupt-stays-deferred.md) kept the in-process executor as the only Python path and parked the worker behind a trigger this repository could see: a browser test runner, a caller who needs hard Python timeouts in a page and cannot use the remote executors, or a recorded hang report. None of the three has landed. On 2026-11-13 the owner chose to build the worker anyway.

What 0033 measured still holds. A synchronous guest loop cannot be interrupted in process: a 200 ms timer never fired during a 3.9 s guest run. A worker the host terminates needs no COOP/COEP header. Its price is the guest's globals on an interrupt, which costs one cold start (1.94–2.35 s on Node), exactly as poisoning costs today.

0.1.0 is published from `release/0.1.0` ([0037](0037-0-1-0-ships-from-a-frozen-release-line.md)), and `@smolagents-ts/exec-pyodide` is outside the fixed release group, so the worker lands on `main` for that package's next minor and does not touch the 0.1.0 line.

## Decision

Build `PyodideWorkerExecutor` now, in 0033's pre-registered shape:

1. It is exported beside `PyodideExecutor` from the package's one entry. The in-process executor stays the default and is unchanged.
2. The worker runs the existing in-process executor. The host sends each step's code and the tool names; every tool call is a message round trip back to the host, where the real tool runs.
3. A deadline or an abort terminates the worker. The step ends with the same timeout or cancellation error the in-process executor returns, the guest's globals are lost, and the next `execute()` starts a fresh worker.
4. `capabilities.cpuTimeLimitMs` is reported, as the wall-clock bound the termination enforces, because this executor can enforce it.
5. `dispose()` terminates the worker and so reclaims the runtime.
6. How the worker is created is an option. The default creates a Node `worker_threads` worker, or a module `Worker` in the browser, from a script shipped beside the entry. A page whose bundler cannot resolve that script passes its own factory.
7. The gate proves the Node half. The browser half stays a runbook claim, as 0033 item 6 says, until a browser runner exists.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Keep waiting for 0033's trigger | the owner chose to build it ahead of the trigger |
| A shared interrupt buffer | needs COOP/COEP on every host, and the published demo cannot set headers (0033) |
| A fresh worker per `execute()` | breaks "globals persist across steps", which the system prompt promises the model |
| A second Python interpreter inside the worker | duplicates the guard, the bridge and the log streams that the in-process executor already tests |
| Make the worker the default | every user would pay a message round trip per tool call to protect against a loop most runs never write |

## Consequences

**Positive**

- A caller can bound a Python step by wall clock, in Node and in the browser, with no header requirement.
- `dispose()` reclaims the runtime, which the in-process executor cannot do.
- The worker reuses the tested in-process executor, so the import guard and the final-answer path are the same code.

**Negative / accepted costs**

- A second executor to keep in conformance with the seam.
- A tool call costs a message round trip, and a tool's arguments and results must survive structured clone.
- A timeout loses the guest's globals and costs a cold start before the next step.
- The default worker script must be resolvable from the package entry; a bundler that cannot resolve it needs the factory option.

## Reversibility

High. The class and its worker script are additive; removing them leaves the in-process executor as it is.

## Follow-up

- [ ] `T-24` builds the class, its worker script, the Node test that a busy loop is cut at its deadline, the README section and a changeset for `@smolagents-ts/exec-pyodide`. Owner: lead.
