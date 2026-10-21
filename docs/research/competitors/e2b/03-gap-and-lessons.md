# e2b — gap analysis and lessons

**Contract**

- **Role:** competitor evidence for this repository only.

- **Mutability:** frozen once filed at the read commit.

- **Read when:** designing the capability this file records.

- **Update when:** a newer read supersedes it; never edit.

## How a row reads

Buckets follow the baseline (`docs/research/competitors/_synthesis/00-our-baseline.md`):
A extends a seam we ship, B is decision 0018 or 0019, C is outside our vocabulary, D is
thinner than the neighbour, E is reserved for an upstream port and does not apply to a
vendor service. `Matching` states what a parity implementation would have to reproduce
at the named seam; it is not a request to imitate their API. `Fit` names the seam the
change would land behind. Prices are S (a day or less), M (two to three days), L (a week
or more) and XL (a product that needs a decision first). A D2 read prices at the seam
level; design happens when a row is taken.

## A — roadmap follow-ons

| id | gap | matching means | fit | price |

|---|---|---|---|---|

| EX-08 | Snapshot and restore of a live guest | A backend can capture a paused guest's memory and filesystem as an addressable artefact and start a second guest from it, so a later run resumes state instead of re-deriving it | `packages/exec-remote/src/sandbox.ts` plus the E2B backend | M |

| HL-04 | Resume a named run in another process by reconnecting to its guest | A run store keeps the sandbox id and the last completed step; a second process connects to the paused sandbox, installs nothing and continues from the recorded step | `packages/core/src/session/run-store.ts` and the sandbox factory | M |

| EX-09 | Browser and desktop automation inside the guest | A backend starts a guest with a desktop, exposes screenshot, click, type and a window stream, and the capability bag declares them before a run so a caller can refuse | a new backend beside `packages/exec-remote/src/backends/e2b.ts` | XL |

EX-08 is the only row here whose blocker is a product decision rather than code: a
snapshot with no consumer (branching, replay, resume) buys nothing. HL-04 is the
consumer whose seam already exists, which is why it is priced separately.

## B — non-goals

| id | what they ship | why it stays out | decision |

|---|---|---|---|

| EX-05 | The workspace surface: read, write, list, watch, stat, commands with stdin, PTYs and a git helper (the FS and CM rows) | This is the filesystem and shell workspace the port deliberately does not become; adopting it would change what a caller can rely on between backends | 0018 |

| — | Template authoring and build (the TM rows) | A build service is deployment and hosting, which the port keeps out; our backend accepts a template name a caller already owns | 0018 |

## C — unconsidered

| id | pattern | why it matters | fit | price |

|---|---|---|---|---|

| C-01 | Metadata as durable attribution | Our seam has nowhere to name the run, the agent or the step when it provisions a guest; E2B carries a string map at create and filters lists by it (`packages/js-sdk/src/sandbox/sandboxApi.ts:709-713`, `:849-853`), and that is what makes an orphaned sandbox findable after a crash | the E2B backend options | S |

| C-02 | Guest metrics as a capacity signal | `getMetrics` samples CPU, memory and disk over a time range (`packages/js-sdk/src/sandbox/index.ts:894`, `packages/js-sdk/src/sandbox/sandboxApi.ts:1052`); our Monitor records durations and spans but nothing about the guest, so a budget cannot see the machine it pays for | `packages/core/src/monitoring/monitor.ts` plus a backend capability | M |

| C-03 | Named execution contexts as namespaces | One E2B guest can hold several kernels (`packages/code-interpreter-js/src/sandbox.ts:290`, `:367`); our executor assumes one namespace per run, so two independent sub-tasks cannot share a guest without sharing state | the sandbox seam, as a context handle in `SandboxStartOptions` | M |

## D — depth gaps

| id | we ship | they ship | fit | price |

|---|---|---|---|---|

| EX-03, EX-04 | A one-shot execution over `runCode` with `toolRoundTrip: false`, refusing a guest tool call by name (`packages/exec-remote/src/backends/e2b.ts:77-82`, `:152-160`) | A command channel with interactive stdin, ordered input streaming, a background handle and keepalive (CM-03, CM-06) | the E2B backend; the seam already carries the answer (`packages/exec-remote/src/sandbox.ts:44-52`, `packages/exec-remote/src/executor.ts:212`) | M |

| EX-03 | Every create, prelude and execution failure becomes one `SandboxError` (`packages/exec-remote/src/backends/e2b.ts:109-123`, `:170-172`) | A taxonomy that separates nonexistent, unreachable and unknown and puts the remedy in the message (SL-07, EX-09) | `packages/exec-remote/src/errors.ts` | S |

| EX-03 | One timeout at create, never refreshed, with no stream keepalive (`packages/exec-remote/src/backends/e2b.ts:62`, `:106-110`, `:165-169`) | A settable lifetime, a body timeout per execution and keepalive pings (SL-05, EX-08, CM-06) | the E2B backend options | S |

| EX-06 | The declared value `direct`, with no policy plumbing (`packages/exec-remote/src/backends/e2b.ts:77-82`) | Allow and deny lists, per-domain rules, a live update and a proxy (NW-01 to NW-04) | the E2B backend options plus the capability bag | S |

The first row changes what a guest can do; the other three change how a failure reads
and how long a guest may live. Prices assume the doubled client in
`packages/exec-remote/test/e2b.test.ts`, so no credential or live sandbox enters the
loop.

## What we have that they lack

- A capability bag a caller reads before a run (`SandboxCapabilities`) instead of
  discovering a limit from a version-gate error at call time.

- One seam over three backends, two of which need neither an account nor a hosted
  service, so the same guest program runs locally or hosted. E2B's SDK has no local
  mode.

- A vendor-neutral frame protocol with typed refusals: a tool call the backend cannot
  answer is rejected by name, not silently dropped, and a pickle payload is refused by
  default.

- A narrow result (`CodeResult` with bounded logs) instead of a per-cell format tree.

- No control plane in the trust boundary: the port needs no key, and the E2B key is one
  optional peer dependency among several backends.

## Patterns worth copying

1. Classify the death at the boundary and put the remedy in the message. Evidence:
   `packages/js-sdk/src/errors.ts:23-37` and
   `packages/code-interpreter-js/src/sandbox.ts:443-454`. Why it matters: our adapter
   turns every terminal cause into "the E2B code execution failed", so a caller cannot
   decide to reconnect, extend a lifetime or give up with context. The pattern costs a
   few branches at the adapter and leaks no vendor type. Price S, fit
   `packages/exec-remote/src/errors.ts`.

2. Gate a capability on the guest's version, not on the backend. Evidence:
   `packages/js-sdk/src/envd/versions.ts:1-9` and
   `packages/js-sdk/src/sandbox/commands/index.ts:428-434`. Why it matters: templates
   outlive SDK releases, and we accept a caller's template name, so a new transport must
   be gated on what the guest's envd can do, with the rebuild remedy in the error. Price
   S, paid with the command transport.

3. Retry only what is safe to replay, and write the reason beside the retry. Evidence:
   `packages/js-sdk/src/retry.ts:32-50`. Why it matters: an E2B create is a POST that
   mints a billable resource, so a generic retry helper would duplicate sandboxes. Price
   S if retries are ever added.

## Patterns to avoid

1. Deprecated aliases and options that are accepted and ignored. Examples: `betaPause`
   (`packages/js-sdk/src/sandbox/index.ts:680-685`), `keepMemory`
   (`packages/js-sdk/src/sandbox/sandboxApi.ts:628-633`), `secure` accepted then ignored
   (`:731-734`), `allowInternetAccess` (`:736-739`), the deprecated git module
   (`packages/js-sdk/src/sandbox/index.ts:92-97`) and `NotFoundError`
   (`packages/js-sdk/src/errors.ts:100`). This port is 0.x and owns its surface; an
   alias is a second shape to document and test, and an ignored option teaches callers
   something untrue. The cost of avoiding it is zero today, and the first step is to
   rename rather than preserve.

2. Choosing the convenient transport over the capable one. The adapter took `runCode`
   because it is one call, and that path has no input channel, which is why tool round
   trips are refused. The lesson is not "use the command API"; it is "choose the
   transport by the capability the seam declares", or the refusal becomes permanent.

3. Letting a vendor's result tree shape ours. `Result` and `Execution` are a notebook
   protocol with ten formats (`packages/code-interpreter-js/src/messaging.ts:152-265`);
   adopting it would push formats our isomorphic core cannot render into `CodeResult`.
   Translate at the edge.

## What it should change for us

1. Tool round trip on E2B (D, M). Add `SandboxOptions.transport: "code-interpreter" |
   "commands"` defaulting to today's path. Under `commands`, write the shim and start it
   with `stdin: true` and `background: true`, parse stdout frames as now, and write a
   `tool_result` line to the process stdin when the host's `callTool` settles. The host
   half already exists: `RemoteSandbox.run` accepts `callTool`
   (`packages/exec-remote/src/sandbox.ts:44-52`), and
   `packages/exec-remote/src/executor.ts:212` enables it when the capability says true.
   Tests stay on the doubled client. Precondition: envd before 0.5.2 cannot close stdin
   (`packages/js-sdk/src/envd/versions.ts:5`,
   `packages/js-sdk/src/sandbox/commands/index.ts:282-287`), so the adapter should treat
   a missing close as an unsupported transport rather than hang.

2. Classify terminal failures (D, S). Map create, prelude and execution failures to
   distinct errors, keep the vendor error as the cause, and include the lifetime remedy
   in the message.

3. Network policy option (D, S). Accept allow and deny lists on the E2B backend, pass
   them at create, and make the declared `network` value reflect the policy actually
   applied rather than always `direct`. A policy that is not passed must not be
   advertised.

4. Timeout management (D, S). Refresh the sandbox lifetime before a long step and let
   the seam's `timeoutMs` bound the execution body; today it bounds only construction
   and the one stream.

5. Metadata (C, S). Add `metadata?: Record<string, string>` to the E2B options and
   forward it at create; this is the cheapest of the five and the only one that helps
   after a crash.

6. Pause and snapshot (A, M). Do this only after an EX-08 decision: the seam needs a
   durable handle and the run store a column, so it is not a backend-only change.

7. Desktop automation (A, XL). Do not start it; it is a different backend, not an
   option.

8. Non-goals (B). Do not grow filesystem, shell or template-build surface inside
   `exec-remote`; when a caller asks, record the refusal in the package documentation
   rather than adding a half-surface.

## Baseline corrections

- EX-06's evidence cell names the process backend as the one reporting `direct` because
  it cannot confine. The E2B adapter declares the same value
  (`packages/exec-remote/src/backends/e2b.ts:79`) although the vendor can enforce
  policy, so the cell should say that the remote backends report `direct` because the
  seam carries no policy.

- EX-03 is right as a status, but the capability truth is per backend: the E2B adapter
  declares `toolRoundTrip: false` while the vendor exposes an input channel, and the
  Docker adapter declares `true` (`packages/exec-remote/src/backends/docker.ts:102`)
  while `packages/exec-remote/README.md:22-26` still shows false for Docker and E2B
  alike. The baseline should point at the capability bag, not the README table.

- No other row contradicted the source: EX-05 and EX-08 are correctly absent, and EX-07
  holds for the hosted kernel as it does for the local ones.

## Closing note

These are priced hypotheses for a D2 read. The evidence behind every row is in
`02-features-inventory.md`; the profile records what was not read, and the sources file
records how to refresh the read without rewriting it from memory.
