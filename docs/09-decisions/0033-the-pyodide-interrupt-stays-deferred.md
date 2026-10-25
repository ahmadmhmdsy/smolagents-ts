# 0033 — the Pyodide interrupt stays deferred, and the worker path is pre-registered

**Contract**
- **Role:** the correction of decision 0016's two cost premises, plus the pre-registered shape of the worker path it left as a follow-up.
- **Mutability:** frozen once accepted. A reversal is a new record that supersedes this one; this file is never edited after acceptance.
- **Read when:** before building or pricing a Pyodide worker, or before promising a caller a hard wall-clock timeout from the Python executor.
- **Update when:** never.

- **Status:** accepted
- **Date:** 2026-10-25
- **Decided by:** the owner, on the D-09 row of [the open-decisions plan](../plans/2026-10-25-open-decisions-plan.md); the lead's recommendation was the opposite shape until the portfolio and the gate were weighed.
- **Supersedes:** none. It corrects two premises of [0016](0016-pyodide-in-process-and-fidelity.md) without reversing its posture.

## Context

0016 chose the in-process executor for v1 and deferred a worker. Its reasoning stands on three points: nothing on the host can interrupt a synchronous guest loop, a capability the runtime cannot enforce must not be reported, and a poisoned runtime is better than interleaved state. Two of the premises it priced the worker with did not survive the 2026-10-25 audit:

- It attributes cross-origin isolation headers to "a worker". They belong to the shared-interrupt-buffer variant only: `SharedArrayBuffer` needs COOP/COEP, while a worker the host simply terminates needs no header at all, at the price of the interpreter state — which the current poisoning already throws away and rebuilds.
- It offers the injectable loader as the escape hatch for a caller who needs a hard interrupt. That works on Node only. `PyodideRuntime` includes synchronous `runPython` and `globals.get/set` (`packages/exec-pyodide/src/loader.ts:19-26`), and a browser main thread cannot block on a worker, so the real browser escape hatch is a second `CodeExecutor`, not a loader.

The measurements are unchanged: a 200 ms timer never fired during a 3.9 s guest run; a worker woken through a shared buffer took 519 ms; the runtime is 13.40 MiB and a cold start is 1.94–2.35 s on Node and 2,912 ms in the measured browser. What is missing is not only the worker but the sentence a caller needs: `timeoutMs` is reported late, never prevented.

## Decision

1. **The in-process executor stays the Python path for the 1.x line.** No worker entry ships in 0.1.0, the capability bag keeps no `cpuTimeLimitMs`, and no deployment story changes.
2. **The two premises above are corrected here**, so the next price of a worker starts from terminate-based and from a browser-only gap, not from headers and a loader escape hatch.
3. **The worker shape is pre-registered for the day the trigger lands.** A separate `PyodideWorkerExecutor` exported beside `PyodideExecutor` from the same `smolagents-ts/exec/pyodide` entry; host termination, not a shared interrupt buffer; no COOP/COEP; `cpuTimeLimitMs` reported as the wall-clock bound it enforces; the guest's globals lost on an interrupt, which costs one cold start exactly as poisoning does today; `dispose()` terminates the worker and reclaims the 13.40 MiB; every tool call becomes a message round trip; the in-process executor stays the default.
4. **The trigger is evidence this repository can see:** a browser test runner in the tree, or a user who needs hard Python timeouts in a page and cannot use the remote executors, or a recorded hang report. A caller's report alone is not the trigger, because the first caller to hit it is the test.
5. **The package README carries the limitation in plain language** — a CPU-bound guest runs to completion, the deadline is reported after the fact, the runtime is never unloaded, and `dispose()` drops the reference rather than reclaiming it. It is not a caveat for a rule file.
6. **The browser half of any future worker is a runbook claim, not a gate claim**, until a browser runner exists; the Node half is gate-testable.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Ship the terminate-based worker now | L, a second executor to keep in conformance, and its headline behaviour cannot be proven by the gate the project measures itself by; the portfolio already isolates untrusted or unbounded Python in `exec-remote` and bounds browser code in QuickJS |
| Worker plus a shared interrupt buffer | needs COOP/COEP on every host, and the published demo is on GitHub Pages, which cannot set headers; it also interrupts at an arbitrary line in guest code |
| A cooperative in-process watchdog (`sys.settrace`) | fires per Python line, slows the guest by an order of magnitude, is blind to C-level loops, and a guest can disable it |
| A fresh worker per `execute()` | breaks the seam's "globals persist across steps" contract, which the system prompt's rule 10 promises the model |
| A worker as an example and runbook only | every user copies it, and the capability gap stays unnamed |

## Consequences

**Positive**

- 0.1.0 ships no executor path the gate cannot prove, and the Python executor's limits are stated where a caller reads them.
- The eventual worker stays additive and is now priced correctly: no header requirement, so no hosting change.
- The two corrected premises cannot mislead the next pricing, which is how the plan's own D-09 option row came to price "a worker" as "a hosting requirement".

**Negative / accepted costs**

- A synchronous guest loop still runs to completion; the deadline is reported late, not prevented.
- Cancellation semantics differ between `PyodideExecutor` and `QuickJSExecutor`, which does interrupt.
- The runtime is still never reclaimed: one executor per run leaves 13.40 MiB plus the Python heap in place until the page reloads.

## Reversibility

High. The worker is an additive entry point plus a class; withdrawing it changes nothing the in-process executor owns. A later record that builds it supersedes this one.

## Follow-up

- [ ] `T-24` is the parked worker row, gated on the trigger above.
- [ ] The package README gains the limitation paragraph in the same commit as this record.
- [ ] The plan's D-09 row is marked decided and its premise correction lands in `## Changes`.
