# general — memory shard

Lessons that do not belong to a narrower topic.

## 2026-10-13 — a vendored tree breaks a naive pack walk

- **Status:** validated
- **Lesson:** the pack validator walks every Markdown file under the repository root, so a gitignored third-party clone with its own AGENTS.md files produces scoped-entry errors, its prose trips the secret heuristic, and one directory named agents.md makes the walker raise instead of read; exclude those trees at the walker, because editing the clones is not an option.
- **Evidence:** measured before the patch: 40 errors and 30 warnings in 173 s, with all 40 errors inside the two ignored trees; after excluding them the run is seconds. See `scripts/_packmodel.py` and `docs/09-decisions/0001-pack-walk-excludes-vendored-trees.md`.

## 2026-10-13 — a green smoke test on an empty package

- **Status:** observed
- **Lesson:** four of the five packages are placeholders whose only test asserts that the package exports something, so a green suite of 277 tests says almost nothing about them; read the per-package count before treating a green run as evidence of progress.
- **Evidence:** `pnpm vitest run --project core` reports 27 files and 273 tests, while the models, tools, react and exec-quickjs projects report one test each.

## 2026-10-13 — an unmeasured runtime claim

- **Status:** validated
- **Lesson:** the first lesson above credits the walk exclusion with a fast validation run, and that comparison was never timed; the excluded trees left the findings, not the walk, so the run stayed at 179,240 ms until the walkers learned to prune. A sentence of the form "this is faster now" is a measurement, and writing it without a stopwatch puts a number in the record that no later session has reason to doubt.
- **Evidence:** timed per check before the prune: c12_secrets 54.0 s, c10_rule_ids 52.9 s, c11_duplicate_facts 52.2 s, and the three were slow for one reason. After `iter_surface()` the same input reports identical JSON (`new: [], baselined: 14`) in 433 ms. See `docs/09-decisions/0003-pruning-surface-walker.md`.
## 2026-10-13 — a plan that quotes source code twice

- **Status:** validated
- **Lesson:** the duplicate-facts check reads sentences wherever they sit, so copying an existing comment or a control line into a new document to show a code change makes that sentence a fresh finding in the new document; reword it inside the snippet, because the check protects the fact's single home and a plan that repeats prose pays for the repetition it was written to avoid.
- **Evidence:** the S2a plan quoted three comments already present in `docs/plans/2026-10-12-s1-core-runtime-plan.md`; `python scripts/validate_context.py --root . --baseline docs/.baseline.json --json` reported `new: 4`, and returned to `new: 0` once those comments and one ordering line were reworded. See `docs/plans/2026-10-13-s2a-model-seam-and-openai-compatible-plan.md`.

## 2026-10-13 — a class name is not a function type

- **Status:** validated
- **Lesson:** `Parameters<typeof SomeClass>` does not describe a constructor's arguments; TypeScript refuses it with "does not satisfy the constraint '(...args: any) => any'", and a test containing that line still passes under vitest because the runner strips types before it runs. Reach for the exported input type, or `ConstructorParameters`, and treat `tsc --noEmit` as the only gate that sees the mistake.
- **Evidence:** `packages/core/test/agent-session-toolcalls.test.ts` — vitest reported 3 passed while `pnpm --filter @smolagents-ts/core run typecheck` reported TS2344 and three TS2345 errors.

## 2026-10-13 — a path mapping drags the other package into this project's rootDir

- **Status:** validated
- **Lesson:** mapping `@smolagents-ts/core` to its source makes every file that import touches part of the importing project's program, so a package whose tsconfig pins `rootDir` to itself fails TS6059 on files it never meant to compile; widen `rootDir` in the test-only config instead of loosening the build config that tsup reads.
- **Evidence:** `packages/models/tsconfig.test.json` — `pnpm --filter @smolagents-ts/models run typecheck` reported nine TS6059 errors before `"rootDir": "../.."` and exit 0 after.

## 2026-10-13 — usage and the finish reason ride different chunks

- **Status:** validated
- **Lesson:** an OpenAI-compatible stream reports the finish reason on its last content chunk and the token counts on a later chunk whose `choices` array is empty, so a consumer reading usage from the chunk that carried the finish reason records nothing; a test that expects both on the final chunk is asserting a shape no provider sends.
- **Evidence:** `packages/models/test/fixtures/openai-chat-completion.sse.txt` — the first draft of `openai-compatible-stream.test.ts` failed on an undefined `finishReason`; `collectCompletion` already handles the split.

## 2026-10-13 — a tool-calling agent has no text-answer path

- **Status:** validated
- **Lesson:** a plan for the S2b work expected a provider reply that ends with `end_turn` and carries only prose to become the agent's final answer, and no such reply can: `ToolCallingAgent.interpret` reports an empty action whenever the completion has no tool calls, the loop records a parsing error and asks again, so a transcript that never emits a call reaches the step cap instead of finishing. When a scripted turn has to end a run, it calls `final_answer`.
- **Evidence:** `packages/core/src/agent/tool-calling-agent.ts` line 50 and `packages/core/src/agent/multi-step-agent.ts` lines 274-288; the first draft of `packages/models/test/anthropic-e2e.test.ts` followed the plan's `end_turn` reply and never terminated, and the committed test scripts a `final_answer` call instead.

## 2026-10-13 — a provider's stop reason is not the seam's finish reason

- **Status:** validated
- **Lesson:** each wire names its own vocabulary — `end_turn`, `tool_use`, `max_tokens`, `STOP`, `MAX_TOKENS`, `SAFETY` — and none of those strings is one of the four `FinishReason` values the core consumes, so every adapter owns a translation table, and one whose provider reports no call-specific reason infers `tool_calls` from the shape of the reply rather than from the field.
- **Evidence:** `packages/models/src/anthropic.ts` and `packages/models/src/gemini.ts` (`toFinishReason`); Gemini answers `STOP` for a turn that calls a function, so `packages/models/test/gemini.test.ts` pins the inferred reason.

## 2026-10-13 — a wire may make a call id optional

- **Status:** validated
- **Lesson:** Gemini's `functionCall` carries no id, while the core's `ToolCallRequest.id` is a string and the loop pairs a result with the call that announced it; an adapter for such a provider synthesizes a stable id per turn (`call-0`, `call-1`) rather than leaving the field blank, because two anonymous calls in one turn are indistinguishable once the transcript is replayed.
- **Evidence:** `packages/models/src/gemini.ts` (`fromWireParts`), pinned by `packages/models/test/gemini.test.ts`.

## 2026-10-13 — two adapters can share a wire format and still deserve two names

- **Status:** validated
- **Lesson:** the Inference Providers router answers in OpenAI's chat-completions shape, so its adapter subclasses the shipped one and changes the host, the provider name and a single streamed field instead of repeating the mapping; the shared shape is a fact about the router, and a separate class keeps the reported provider and the capability set honest for a caller.
- **Evidence:** `packages/models/src/huggingface.ts` overrides `payload` alone, and `packages/models/test/huggingface.test.ts` pins the router's URL together with the `stream_options.include_usage` field.

## 2026-10-13 — a system prompt outside the message list needs a mapping

- **Status:** validated
- **Lesson:** Anthropic takes the system turn as a top-level `system` field and Gemini as a `systemInstruction`, and neither accepts a message whose role is `system`, so an adapter for them collects those turns while it walks the transcript instead of forwarding a role the wire does not define; the constructor's default prompt and a per-request override then travel the same path.
- **Evidence:** `packages/models/src/anthropic.ts` and `packages/models/src/gemini.ts` (`toWireMessages`), pinned by `packages/models/test/anthropic.test.ts` and `packages/models/test/gemini.test.ts`.

## 2026-10-13 — typecheck is not lint

- **Status:** validated
- **Lesson:** an unused type-only import survives `tsc --noEmit` and vitest, because the compiler's unused checks cover values and the runner erases the import before it runs, so a per-package typecheck reports success on a file the repository linter rejects; run the lint step before calling a task finished, or the gate finds it at the end of the milestone instead of at the commit that introduced it.
- **Evidence:** `packages/models/src/huggingface.ts` line 1 kept `ChatCompletionChunk` after the adapter stopped naming it; `pnpm --filter @smolagents-ts/models run typecheck` exited 0 and `pnpm lint` reported `@typescript-eslint/no-unused-vars`, failing the first S2b gate run.

## 2026-10-14 — a group that only converts still earns its place

- **Status:** validated
- **Lesson:** `ToolCollection` adds no traversal path: the loop keeps reading the core's `ToolRegistry`, and the collection converts at that boundary, so naming and grouping arrive without a second place that can disagree about what a tool is. The duplicate check lives in the collection because a map keyed by name is where a collision actually happens.
- **Evidence:** `packages/tools/src/collection.ts`; `packages/tools/test/collection.test.ts` pins `toRegistry()` to the same `Tool` objects and a repeated name to `ToolDefinitionError`.

## 2026-10-14 — a package with no host takes the host as a parameter

- **Status:** validated
- **Lesson:** the tools package runs in a browser as well as in Node, so a default tool that needs something from its environment — a way to ask the user, a fetch it may override — receives that function as an argument instead of importing a host module; the context's `fetch` is the default and an injected one wins, which is also what lets the suite run without a network.
- **Evidence:** `packages/tools/src/defaults/user-input.ts` takes `ask`; `packages/tools/src/defaults/visit-webpage.ts` and `duckduckgo-search.ts` prefer `options.fetch` over `ctx.fetch`, pinned by `packages/tools/test/visit-webpage.test.ts`.

## 2026-10-14 — a documented JSON shape is not the page's shape

- **Status:** validated
- **Lesson:** upstream's search tool reads the rendered results page, and the endpoint's documented JSON answers a different question — a summary and related topics rather than ranked links — so a port that reads the JSON is a different tool wearing the same name, and saying so in the description is cheaper than a caller discovering it from an empty result.
- **Evidence:** `packages/tools/src/defaults/duckduckgo-search.ts` reads the Instant Answer endpoint; the divergence is recorded in `docs/plans/2026-10-14-s3-tool-system-plan.md`.

## 2026-10-14 — a workspace dependency needs an install before the declaration builds

- **Status:** validated
- **Lesson:** adding `"@smolagents-ts/core": "workspace:*"` to a package's manifest does not create the link under its `node_modules`, and the tests and the typecheck can still pass through the path mapping and the vitest alias while the declaration build fails to resolve the bare specifier; run the install in the same commit as the manifest change, or the failure surfaces at the build step of a later task.
- **Evidence:** `pnpm --filter @smolagents-ts/tools run build` failed with `TS2307: Cannot find module '@smolagents-ts/core'` in the DTS step until `pnpm install` created the link; fixed in commit `a48bb40`.

## 2026-10-14 — a wrapper that unlocks top-level await also destroys the bindings it wraps

- **Status:** validated
- **Lesson:** generated code is wrapped in an async IIFE so that top-level `await` works, and that wrapper takes the code's own top-level declarations out of scope the moment it returns, so the guest program reads the names it can see out of the source and copies each one onto the global object before the wrapper ends; without that step the model's next turn cannot read a variable the previous turn defined, which is the persistence the prompt promises it.
- **Evidence:** `packages/exec-quickjs/src/guest-source.ts` (`collectDeclaredNames`, the capture epilogue), pinned by `packages/exec-quickjs/test/guest-source.test.ts` and the cross-step test in `packages/exec-quickjs/test/code-agent.test.ts`; the choice is recorded in `docs/09-decisions/0004-quickjs-declaration-capture.md`.

## 2026-10-14 — one realm per run turns a second top-level const into a redeclaration

- **Status:** validated
- **Lesson:** a realm reused across steps keeps a script's top-level lexical bindings, so the second step's prelude that declares the same `const` name is a syntax error before any of the model's code runs; the prelude declares with `var` and installs tool names as properties instead, which is the difference between a run that reaches its fifth step and one that dies on its second.
- **Evidence:** measured with a probe during S4 Task 3 (`SyntaxError: redeclaration of 'render'`); the shipped prelude in `packages/exec-quickjs/src/guest-source.ts` is written that way.

## 2026-10-14 — a release build that asserts on a leaked handle makes every handle a resource

- **Status:** validated
- **Lesson:** QuickJS's release build aborts the whole WASM module when a handle outlives its runtime, so a missing `dispose()` is not a leak that grows quietly but a process-wide failure; every handle is disposed on every path, the context goes before the runtime, and the executor catches the abort at disposal and reports it through its last logger, because no caller can act on it.
- **Evidence:** the spike aborted with `Assertion failed: list_empty(&rt->gc_obj_list)`; `packages/exec-quickjs/src/executor.ts` (`dispose`, `installShims`) and `packages/exec-quickjs/test/executor.test.ts`.

## 2026-10-14 — a declared optional hook nobody calls is a leak with a written apology

- **Status:** validated
- **Lesson:** the executor seam declares `dispose?()` and its own doc says the executor releases its guest at the end of a run, but the loop never called it, so every run left a realm behind while every test passed; an optional method is only a contract when a caller invokes it, so the loop now runs a release hook from the generator's `finally` and the agent that owns a sandbox overrides it.
- **Evidence:** `packages/core/src/agent/multi-step-agent.ts` (`stream`, `releaseResources`) and `packages/core/src/agent/code-agent.ts`; pinned by the disposal test in `packages/core/test/code-agent.test.ts`.

## 2026-10-14 — an empty observation is a failure the model cannot see

- **Status:** validated
- **Lesson:** the executor reports a failed step as an error beside the guest's output, and the loop's observation carried only that output, so a step that threw produced an empty observation and the model had nothing to react to while the reason reached only the event stream; a failed step's reason belongs in the observation the next turn reads.
- **Evidence:** `packages/core/src/agent/code-agent.ts` (`describeExecution`); pinned by the observation test in `packages/core/test/code-agent.test.ts` and the recovery test in `packages/exec-quickjs/test/code-agent.test.ts`.

## 2026-10-14 — a generator's finally runs on return(), not on abandonment

- **Status:** validated
- **Lesson:** a release hook placed in an async generator's `finally` runs when the run ends and when a consumer breaks out of the loop, because `break` calls `return()`; a consumer that drops the iterator without one leaves the generator suspended and the hook never runs, so an executor-backed agent keeps its own `dispose()` as the documented backstop rather than treating the hook as covering every exit.
- **Evidence:** measured with a probe during S4 Task 7 — `break` released once, a dropped iterator released zero times; the break case is pinned by `packages/exec-quickjs/test/code-agent.test.ts`.

## 2026-10-14 — a component rule the code contradicts is found by reading the rule

- **Status:** validated
- **Lesson:** `rules/components/exec-quickjs.md` requires a typed error when the platform has no usable WASM binary, and the executor passed the loader's own error through instead, which no test could see because the branch never runs where the binary loads; checking a component rule against the shipped code is part of a task, and a branch a suite cannot reach is still testable by replacing the engine's entry point for one file.
- **Evidence:** `packages/exec-quickjs/src/executor.ts` (`ensureGuest`) and `packages/exec-quickjs/test/engine-load.test.ts`, which mocks `quickjs-emscripten-core`.

## 2026-10-14 — a scoped entry's expected test count is a live fact

- **Status:** validated
- **Lesson:** a scoped entry names the smallest validation command and the numbers it should print, so a task that adds tests makes that sentence false the moment it lands; S4 added two core tests and left `packages/core/AGENTS.md` claiming 286, which nothing but reading the entry after the gate would catch, so the entry moves in the same task as the tests it counts.
- **Evidence:** `packages/core/AGENTS.md` said 286 while `pnpm vitest run --project core` printed "Tests 288 passed (288)" on 2026-10-14; the S5 plan's Task 9 closes the same gap for the react entry.


