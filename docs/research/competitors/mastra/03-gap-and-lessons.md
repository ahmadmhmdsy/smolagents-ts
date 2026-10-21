# mastra — gap analysis and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## How a row reads

Buckets follow the baseline: A is a roadmap follow-on behind a seam we already ship, B is a
deliberate non-goal, C is something absent from our vocabulary, D is a depth gap in something
we ship. `Matching` states the behaviour a parity implementation would have to reproduce at
the named seam; it is not a request to reproduce their code or their API. `Fit` names the
seam the change would land behind. Prices are S (a day or less), M (two to three days), L (a
week or more) and XL (a product, needs a decision first).

## A — roadmap follow-ons

| id | gap | matching means | fit | price |
|---|---|---|---|---|
| HL-02 | A pending approval as serialized state rather than an immediate failure | A suspended call returns a resumable handle carrying the tool name, arguments, a resume schema and an approval record; a resume verdict is validated against that schema | `packages/core/src/agent/approval.ts`, `run-store.ts` | M |
| HL-04 | Resume a named run from a different process | The run store holds enough per-step state that a second process can re-enter the suspended step with a supplied value, and refuses a duplicate resume | `packages/core/src/session/run-store.ts` | L |
| HL-05 | Crash recovery inside a step | A process that dies mid-step leaves a claim that another process can take over after a lease expires, without re-running committed work | `RunStore` plus a lease column | L |
| HL-06 | Interrupt and resume with a human-supplied value | A step can stop and ask; the answer arrives later as data bound to that step, validated by schema | `approval.ts`, `multi-step-agent.ts:154` | M |
| HL-07 | Replay from step N | Saved step results are reusable so a run can re-enter at an earlier step and diverge from there | per-step records behind `RunStore` | L |
| HL-09 | Durable stores for the run seam | At least one on-disk store with the same semantics as the in-memory one, plus a conformance suite that both pass | `run-store.ts` | M |
| OB-05 | Datasets, scorer pipelines, gates and LLM judges | A scorer has ordered phases, a judge model and typed intermediate results; a batch run yields pass or fail per item; a dataset versions the items | `packages/core/src/monitoring/eval.ts` | L |
| OB-06 | Cost accounting from usage | Token usage is priced from a table and accumulated per run, with a limit that can abort a run | `monitoring/monitor.ts` plus usage records | M |
| GR-03 | Guardrails during streaming and in parallel | Output guardrails see chunks as they flow, and independent checks run concurrently with a defined merge rule | `packages/core/src/agent/guardrail.ts` | M |
| GR-04 | Built-in safety checks | At least moderation and PII detection ship as configuration, with a documented failure policy for the guard model | `guardrail.ts` | M |
| GR-05 | Provider structured output | The adapter advertises JSON mode and the loop asks for it, instead of validating only after the fact | `ModelCapabilities.structuredOutput` | S |
| GR-06 | Schema-failure repair round | A validation failure is fed back as a message and the model is asked once more, within the step budget | `multi-step-agent.ts:713` | M |
| MA-01 | Delegation hooks for managed agents | A host can rewrite the child prompt, reject a delegation with a reason, and stop sibling work when one delegation finishes | `packages/core/src/agent/managed-agent.ts` | S |
| MC-03 | MCP resources, prompts and completions in the client | The client can list and read resources and prompts and receive completions, not only tools and a raw request | `packages/mcp/src/client.ts` | M |
| MC-06 | OAuth for MCP clients | The client runs the authorization-code flow, stores and refreshes tokens, and sends the bearer header | `packages/mcp/src/client.ts` | L |

## C — unconsidered

| id | pattern | why it matters | fit | price |
|---|---|---|---|---|
| C-01 | A processor pipeline as the product surface | Their safety, memory, caching, retry and output shaping all land on one ordered hook set with a shared failure and span contract; ours is a guardrail hook plus middleware, so each new concern becomes a new branch in the loop | middleware plus guardrail | L |
| C-02 | Failure-recovery as configuration | ECONNRESET, prefill errors, unsupported files and provider history repair ship as default error processors with retry budgets; our adapters surface these as run failures | model adapter layer | M |
| C-03 | Capabilities that register their own processors | Memory contributes its processors automatically, deduplicates against user configuration and throws typed errors for missing adapters; a host gets the feature by configuring it, not by wiring it | `AgentSession` construction | M |
| C-04 | Run ownership lease and fencing | A durable run names its driver, renews a lease and lets a recovery sweep distinguish an orphan from a live run; without it, recovery means guessing | `RunStore` | M |
| C-05 | Signed continuation envelopes | A suspension hands the client a signed statement of what was asked, for which arguments, at which round, to which principal; resumption is validated and re-authorized rather than trusted | `approval.ts` | M |
| C-06 | A scorer as loop control | The same scorer contract gates a loop iteration and a CI batch, and a failed score becomes feedback the model sees; our scorer only grades a finished run | `eval.ts` plus loop | S |
| C-07 | A typed reader over persisted state | Operators and UIs read suspended paths and resume labels through a small API instead of knowing the snapshot shape | `RunStore` | S |
| C-08 | Observational memory | An observer compresses turns into dated observations, a reflector rewrites them, and recall tools query the record; this is a different answer to long conversations than trim-and-recall | `AgentSession` memory | XL |

## D — depth gaps

| id | we ship | they ship | fit | price |
|---|---|---|---|---|
| HL-01 | A boolean-style approval gate before a tool call | Per-tool approval functions, a pre-approval hook with validation, an exemption path and a typed decline reason | `approval.ts` | S |
| HL-08 | A session checkpoint carried across turns | Threads scoped to a resource, with working memory that persists independently of any run | `AgentSession` | M |
| OB-04 | One expectation-shaped scorer for a completed run | A scorer builder with judge prompts, sampling, filters, per-step attachment and batch runs | `eval.ts` | L |
| MC-01 | A client with tools and a raw request | Tools, resources, prompts, completions, notifications, elicitation and an events extension | `packages/mcp/src/client.ts` | M |
| TL-06 | A fixed tool registry per agent | Tools can be paged, searched, filtered per step and prepared per iteration | tool registry plus `prepareStep` | M |
| RT-14 | A snapshot for a UI, refreshed between turns | A full run document that a server or UI can read, prune and resume from | `AgentSession` | M |
| GR-02 | A Zod-validated final answer that fails the run on mismatch | Validation failure can be repaired, and a separate structuring model can produce the typed answer on the side | `multi-step-agent.ts:713` | M |

## B — non-goals

| id | capability | decision | note for the backlog |
|---|---|---|---|
| MC-07 | MCP server authoring | decision 0018 | The server itself stays out, but the continuation pattern (C-05) is separable and useful to the client side |
| MD-06 | Embeddings, vector stores and RAG | decision 0018 | Their semantic recall depends on a vector store, so a memory follow-on must choose a store-free design or reopen the decision |
| UI-06 | A chat transport and a dev Studio | decision 0018 | Their Studio and stream transports were located in the docs tree, not read |
| EX-05 | A workspace sandbox with filesystem and shell | decision 0018 | Their sandbox area exists; it was not read, and the action-space difference is recorded in the profile |
| MD-04 | Multimodal input | decision 0018 | Their image handling appears in processors and messages; no path was traced |

## What we have that they lack

- A sandboxed program as the default action space: our loop's action is a model-authored
  program executed by an injected executor, while their loop's action is a tool call and code
  mode is a separate documented mode. The comparison is about defaults, not possibility.
- An isomorphic core: our packages target Node, Bun, Deno and the browser with a WASM
  executor as the default, while their core imports Node HTTP types and expects a Node
  process and a build step. This is inferred from imports and the workspace shape.
- A single published facade over a dozen small packages, against a monorepo of many packages
  that consumers must assemble. The difference is distribution ergonomics, not capability.
- A parity-recording gate for the upstream loop. Their closest analogue is a protocol
  conformance suite inside the MCP package, which covers one protocol rather than loop
  behaviour.

## Patterns worth copying

1. **Make a feature a processor before making it core.** The clone's contribution rule says
   a feature that can be a processor avoids core changes and can be registered for everyone;
   memory's provider is the proof, contributing five processors and deduplicating by id.
   Copy the rule, not the file sizes: one ordered hook set, a shared abort, a shared span.
2. **Pair a suspend schema with a resume schema, then make resumption idempotent.** A step
   that stops declares what it needs to come back; a persisted claim makes a duplicate resume
   harmless; a lease makes recovery explicit. This is the cheapest route from our
   between-step checkpoint to a durable run.
3. **Treat evaluation as a first-class pipeline.** An immutable scorer builder, sampling and
   filter predicates, gates with a must-pass threshold, and a dataset to run against turn
   evaluation from a script into a release gate. They reuse one scorer contract for CI and
   for loop control, which is the part worth copying.

## Patterns to avoid

- A single growing run document. Their snapshot holds every step result, paths and labels in
  one object, needs merge logic for concurrent writes, a pruning hook and a write-amplification
  test; the merge helper is even duplicated in a store package by a source comment at
  `packages/core/src/storage/workflow-snapshot.ts:3`. Prefer per-step records plus an event log.
- Mega-classes as the integration point. `agent.ts` is roughly 11.9k lines and `workflow.ts`
  roughly 6k, mixing streaming, approval, delegation and memory concerns, which makes a change's
  blast radius hard to see.
- Feature-specific suspension plumbing at the step level. Approval, tool suspension and a
  delegated child run all write into the same step, with metadata keys selected by a type
  discriminator (`packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts:202`,
  `:295`), and the step file carries several suspend sites.
- Two multi-agent stories at once. The network is deprecated in the docs while its
  implementation remains, so a reader has to determine which coordination model is current.
- An implicit ordering contract. Their default error processors only behave correctly in one
  order, documented in a comment, because the first retry verdict wins; an ordering that
  matters should be data, or enforced by the type system.
- A security-sensitive default that only warns. The continuation codec defaults to a
  per-process signing key and warns, which works on one instance and silently breaks a scaled
  deployment.

## What this should change for us

1. Build the processor seam before adding more safety features (L). One ordered hook set with
   input, output, stream, tool-result and error phases, a shared abort with retry-as-feedback,
   and a span per phase. It unlocks GR-03, GR-04, GR-06 and C-02 at once, and gives memory a
   place to inject without touching the loop.
2. Add per-step run records and a resume claim behind `RunStore` (L). Snapshot the suspended
   step only, name the resume schema, and reject a duplicate resume. This is the shortest path
   to HL-02, HL-04, HL-06 and a credible T-28 answer, and it avoids the single-document trap.
3. Give evaluation a threshold and a dataset (L). A scorer with phases and a judge, a batch
   runner and a pass or fail verdict take OB-05 from absent to useful; C-06 then costs little.
4. Add resource-scoped working memory to the session (M). A typed record with an update tool
   and an atomic merge covers most of HL-08 without a vector store, so the RAG decision stays
   closed.
5. Sharpen approval semantics (S) and add a signed continuation (M). Per-tool policy, a
   pre-approval hook and a signed record of what was asked would extend HL-01 and C-05 at
   modest cost.
6. Price usage against a table (M). Cost accounting rides on the usage we already record and
   closes OB-06 without a new subsystem.
7. Extend the MCP client to resources and prompts (M), and treat OAuth as its own decision (L).
   This is client parity, not server authoring, so decision 0018 does not block it.

## Baseline corrections

No baseline status was contradicted by the source read. Two rows deserve a note for the
backlog: `HL-04` is marked minimal because a seam exists, but their evidence shows the seam
also needs a state granularity change before a resume can cross processes, so the row
understates the work; and `MC-07` is correctly a non-goal, yet the continuation mechanics
behind it (C-05) are independent of server authoring and should not be filed under the
non-goal by association.
