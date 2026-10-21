# pydantic-ai — gaps and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Gap rows cite the baseline by row id. Buckets are the method's: **A** roadmap follow-on behind a
shipped seam, **B** non-goal under decision 0018 or 0019, **C** absent from our vocabulary, **D**
depth gap in something we ship. Effort is **S**, **M**, **L** or **XL**. Fit names the seam a change
would land behind. Prices are engineering judgement from the source shapes, not measurements.

## Gap table

| gap | our row | bucket | fit | effort | evidence |
|---|---|---|---|---|---|
| background tool execution while the run continues | none | C | tool execution and the run loop | M | `src/pydantic_ai_harness/pydantic_ai_harness/background_tools/README.md:3` |
| a supervisor topology shipped as code, scripted over child agents | MA-06 | A | managed-agent layer | M | `src/pydantic_ai_harness/pydantic_ai_harness/dynamic_workflow/README.md:3` |
| guards at the tool boundary, on arguments and on results | none; GR-01 covers prompt and final output | C | guardrail seam | M | `src/pydantic_ai_harness/pydantic_ai_harness/guardrails/README.md:3,12` |
| a spend budget that outlives one run and is shared across workers | OB-06 | A | monitor plus run store | S | `src/pydantic_ai_harness/pydantic_ai_harness/spend/README.md:12` |
| parallel child agents | MA-04 | A | managed-agent layer | L | `src/pydantic_ai_harness/pydantic_ai_harness/subagents/README.md:13`; children run in their own runs, parallel is not claimed |
| output mode chosen per model from declared capability facts, not guessed per adapter | GR-05 | A | `ModelCapabilities` / `GenerateOptions` | M | `models/__init__.py:257-262`, `_agent_graph.py:996-1112`, `profiles/__init__.py:63-120` |
| schema-failure repair loop that re-prompts instead of failing the run | GR-06 | A | the loop's output validation at `multi-step-agent.ts:713` | S | `_output.py:385-394`, `_agent_graph.py:450-467` |
| pending approval carried as serialized state across runs | HL-02 | A | run store plus the approval seam | M | `_deferred.py:28,159`, `_run_context.py:177` |
| journal every model request and wrapped tool call, replay completed ones | HL-05 | A | run loop, beside the step checkpoint | L | `durable_exec/_base.py:1780-1790`, `durable_execution/overview.md:7` |
| durable engine as an interface rather than shipped store implementations | HL-09 | A | a backend seam under the run loop | L | `_base.py:304-306`, `durable_execution/overview.md:9-10`, `_operation_backend.py` |
| interrupt a run, hand a value in later, resume from history | HL-06 | A | message history plus run store | M | `_deferred.py:159`, `messages.py:5600-5643` |
| per-tool timeout and retry limit, resolved through a fallback chain | TL-05 | D | tool definition and registry | S | `toolsets/function.py:75-157`, `tool_manager.py:272` |
| per-step tool selection and filtering | TL-06 | D | registry, replaced by a per-run builder | S | `toolsets/_dynamic.py:75-118` |
| toolset lifecycle: per-run and per-step construction, enter and exit | TL-02 | D | registry and collection | M | `toolsets/abstract.py:85-160` |
| provider-hosted tools as a first-class tool kind | TL-07 | A | tool definition needs a provider-native variant | L | `profiles/__init__.py:14`, `capabilities/native_tool.py` |
| dataset, case, evaluator and report objects | OB-05 | A | `monitoring/eval.ts` | M | `pydantic_evals/pydantic_evals/dataset.py:105,172,276` |
| OTel export of a run's span tree | OB-02 | A | `TraceSpan` plus listener seam | M | `capabilities/instrumentation.py:98,407` |
| cost accounting from a pricing table, with unknown distinct from zero | OB-06 | A | monitor usage | S | `usage.py:156-160`, `_genai_prices.py:1-29` |
| report rendering with baseline comparison and experiment analyses | OB-04 | D | eval result shape | S | `reporting/__init__.py:334,413-438` |
| provider prompt caching and per-provider request options | MD-07 | D | `GenerateOptions` | M | `profiles/__init__.py:55-120`, `models/__init__.py:283-295` |
| MCP authentication, including an OAuth flow | MC-06 | A | transport headers, `client.ts` | S | `pydantic_ai/mcp.py:924-981` |
| MCP resources, sampling and elicitation | MC-03, MC-04 | A | client adapter beyond tools | M | `pydantic_ai/mcp.py:742-747`, `mcp/client.md:7` |
| typed dependency injection as a declared first-class system | none | C | `AgentOptions` plus `RunContext` | L | `_run_context.py:177-1,061`, `dependencies.md:7-13` |
| capability as the composition unit, with hooks around every phase | none | C | `middleware.ts` could grow into it | XL | `capabilities/abstract.py:179,721-1383` |
| checkpoint payload versioning, or operation-name pinning | HL-10 | D | `StepJSON` | S | `durable_exec/_operation_names.py`, `_codec.py` |
| fallback model: ordered candidates on provider errors | MD-05 | B | `Model` interface | S if reopened | `models/fallback.py:99-346`, `models/overview.md:389-401` |
| multimodal input | MD-04 | B | none, decision 0018 | — | `models/__init__.py` image parts |
| filesystem and shell workspace | EX-05 | B | none, decision 0018 | — | `capabilities/local_workspace.py` |
| chat transport and generative UI | UI-06, UI-07 | B | none, decision 0018 | — | `pydantic_ai/ui/ag_ui/`, `ui/vercel_ai/` |

The B rows are recorded for completeness and deliberately not priced. Decision 0019 removes
provider routing and local runtimes from the roadmap phases, which is why the fallback row carries
an if-reopened price instead of a budget.

## Where our baseline is imprecise

**MD-05 flattens seven retry layers into one row.** Our row says "provider router, fallback, retry,
rate limiting" absent. Pydantic AI counts seven layers, states that they never share budgets, and
gives the multiplication rule between them (`retries.md:7-25`). A unified row hides the fact that
the cheap, most valuable piece is the agent-level repair loop (GR-06), not a router. This is a
precision bug in the baseline, not a missing feature.

**GR-05 describes the wrong shape.** We record a boolean capability, "provider-side structured
output". Their seam is a mode enumeration plus per-model support flags plus schema delivery rules,
because providers differ in whether they accept a schema, a JSON mode, or only a prompted schema
(`models/__init__.py:257`, `profiles/__init__.py:63-120`). A boolean cannot express that, so
whichever adapter sets ours first will encode a policy the interface cannot carry.

**HL-09 frames durability as stores.** Their position is that durability is an engine and storage
is a separate concern (`durable_execution/overview.md:9-10`). Adding file, SQLite and Redis stores
to `RunStore` would improve resume-after-stop without ever recovering a crash mid-step, which is
the failure our users would actually hit. The framing in the baseline invites the weaker fix.

## What we have that they lack

The core-loop difference is real but narrower than the obvious reading. Their core is tool-calling,
and code-as-action arrives as the optional Code Mode capability recorded in the inventory. What
stays ours alone:

- Our loop owns the observation cycle for a generated program: RT-01's step loop, RT-03's planning
  interval and RT-05's incremental code view are loop-level, not a tool wrapper over the model.
- EX-01 to EX-04: three executor backends, a declared capability bag and a browser-hostable guest.
  Code Mode runs one Python runtime (Monty), so their executor seam is one deep, not four wide.
- EX-07's guest state held across a run's steps has no counterpart; their sandbox serves the wrapped
  call rather than the whole run.
- DS-01 to DS-04: an eleven-package gate, pack smoke and version sync. A Python workspace proves
  importability, not a browser-safe bundling contract.

The comfort is limited, and the honest version is more useful: Code Mode demonstrates that a
code-execution loop can be added to a tool-calling framework as a single capability. That is an
argument for our capability layer, not a reason to keep the loop simple.

## Patterns worth copying

**Retry as data, not as control flow.** A user-raised `ModelRetry` becomes a typed retry prompt
placed in history, and the loop's budget decides whether another attempt is allowed
(`_output.py:385-394`, `_agent_graph.py:450-467`). Porting this shape is S and it removes the need
for a repair loop to own provider-specific error handling.

**One validated request object.** `ModelRequestParameters` (`models/__init__.py:206-312`) carries
everything the adapter needs for a call, including the output plan and instruction parts. It makes
the request observable and replayable, and it is the natural place for a durable engine to hash a
cache identity.

**Toolsets as lifecycles, not lists.** `AbstractToolset` (`toolsets/abstract.py:85-160`) gives a
group of tools a per-run and per-step construction point plus resource enter/exit. That single
choice is what makes filtering, prefixing, approval and deferral into wrappers instead of options.

**Cost and usage as typed data.** A decimal cost that is `None` when unknown, and a lower-bound
flag when extraction is partial (`usage.py:125-160`), is a better contract than a number that
silently reads zero. Our monitor can adopt the shape without adopting the pricing table.

**Per-model capability facts.** `ModelProfile` (`profiles/__init__.py:55-120`) is how the framework
avoids provider branching. Our `ModelCapabilities` is the same idea with fewer fields; populating it
is cheap and unblocks GR-05.

**Bridge a sandbox to tools instead of duplicating them.** Code Mode wraps eligible tools behind one
`run_code` tool and dispatches each call from inside the sandbox back through the framework
(`src/pydantic_ai_harness/pydantic_ai_harness/code_mode/README.md:15-18`). One wrapper, one schema,
and every existing tool becomes callable from generated code.

## Patterns to avoid

**Do not port the hub files.** `agent/__init__.py` is 5,271 lines and `messages.py` is 6,379, and
both are edited by nearly every feature. Their own contributor guide works around this with
directory-scoped rule files. A TypeScript port that mirrors the file layout inherits the merge
pressure without the review capacity that keeps it coherent.

**Do not ship every output mode at once.** Tool, native, prompted, text and image modes each have
their own schema builder and processor in a 1,703-line module (`_output.py`). The tool path is the
portable one; native and prompted are per-adapter work. GR-05 should land as tool output plus a
declared mode field, with other modes as later increments.

**Do not build a provider matrix before the capability is used.** Forty-two provider modules and a
profile per family exist because the project serves the whole Python ecosystem. Our five adapters
should declare facts in one small interface, not grow a module per vendor.

**Do not make every feature a hook.** Roughly sixty capability hooks
(`capabilities/abstract.py:721-1383`) make anything interceptable, at the cost that ordering,
composition and durable-safety become things an author must reason about. Our middleware chain is
weaker; it is also far cheaper to keep correct.

**Do not ship an unstable layer beside a stable core without saying so.** Several harness pages
carry a standing warning that the 0.x API may change between minor releases, and the core is
versioned for backward compatibility instead. The split is honest, but it means anything built on
their capability library needs a pinned range. We should decide the stability promise of a
capability layer before we ship one.

**Do not copy the file-size culture of inline rationale.** Long inline comments that explain
provider quirks are load-bearing documentation for them. They are also why a one-line behaviour
change touches three files. Cite decisions in our docs instead.

## What it should change for us

1. **Reshape GR-05 before implementing it.** Add an output-mode field to `ModelCapabilities`, let an
   adapter declare which modes it supports, and pass the resolved mode with the request. Then
   GR-06 becomes the retry loop that consumes it. This is the highest value per day in the dive.
2. **Add a row for typed dependency injection.** It is the one capability that touches every
   extension point we already have, it has no baseline id, and their version shows the payoff:
   test substitution, uniform context, and no closure-captured configuration.
3. **Treat HL-02 and HL-06 as one design.** A deferred call with results is the serializable form of
   both approval and human input. Designing them separately would duplicate the hard part, which is
   message-history resumption.
4. **Keep durability as an interface.** If HL-05 is ever scheduled, specify a journal boundary
   around model requests and tool calls, with a backend interface. Do not add store implementations
   to `RunStore` and call it recovery.
5. **Adopt OB-05's data model, not its reporting depth.** Case, dataset, evaluator and report are
   four small types; the rich renderer is where the weeks go and where our existing eval result is
   already adequate.
6. **Keep code-as-action in the core loop and let capabilities extend it.** Code Mode is proof that
   the opposite arrangement works for a tool-calling framework; it is also a reminder that our
   loop-level planning, streaming view and executor choice are the parts a wrapper cannot recover.

## Limits

- Prices assume one engineer familiar with our core; they exclude review and documentation time.
- The C rows are priced by analogy, because our seams do not exist yet and no spike was run.
- Multi-agent rows rest on declared harness evidence, not a traced path, so their prices are coarse.
- No benchmark was run, and no provider traffic was observed; comparisons to our runtime are
  architectural, not measured.
