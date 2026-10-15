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

## 2026-10-14 — an extra status role makes the run's own status ambiguous

- **Status:** validated
- **Lesson:** the tool-call primitive carried `role="status"` on every call, so a run with one call rendered two status regions and the run's own status could no longer be found by role; each primitive's own test renders exactly one, so only a composition test sees it. A live region that reports a completion is `aria-live="polite"` on its own, and the component that owns the run keeps the status role.
- **Evidence:** `packages/react/src/tool-call.tsx`; found by `packages/react/test/composition.test.tsx` on 2026-10-14 (`Found multiple elements with the role "status"`).

## 2026-10-14 — a declaration build reads a workspace dependency's published types

- **Status:** validated
- **Lesson:** the react package's tests passed while its `build` failed with `Module '@smolagents-ts/core' has no exported member 'PlanningView'`, because the vitest project aliases core to its source while tsup's declaration worker resolves core through the package's `types` field; a type added to a dependency in the same session needs that dependency's build first, so a package's build run by hand on a green tree can fail where the gate's dependency-ordered `build` stage succeeds.
- **Evidence:** `pnpm --filter @smolagents-ts/react build` failed, then passed after `pnpm --filter @smolagents-ts/core build`, on 2026-10-14; recorded as a hazard in `packages/react/AGENTS.md`.

## 2026-10-14 — a test double only fills the lanes its handler drives

- **Status:** validated
- **Lesson:** a composition test built on `ScriptedExecutor` rendered no appended output at all while every assertion about the snapshot's steps passed, because a step's logs come only from the executor's `onLog` callback and the double never called it; a fixture that wants a lane to be non-empty drives it the way a real executor does, which is what makes the test evidence about the executor's contract rather than about the empty default.
- **Evidence:** `packages/react/test/composition.test.tsx` (its handler calls `options.onLog`); the wiring is `packages/core/src/agent/code-agent.ts` (`onLog` to `logs.appended`).

## 2026-10-14 — a task that renders a leaf depends on the leaf's task

- **Status:** validated
- **Lesson:** the S5 plan put the run primitives in Task 5 and the leaf primitives in Task 7, but `AgentRun.FinalAnswer` renders the final-answer leaf, so Task 5's commit could not typecheck without Task 7's file; ordering a plan by dependency means ordering by what each task renders, not by what each task is named, and the leaves moved into Task 5's commit.
- **Evidence:** commits `f3fb857` and `86aac39`; the deviation is recorded in `docs/plans/2026-10-14-s5-react-layer-plan.md` under `## Measured results`.

## 2026-10-14 — a peer dependency is not a declared import to the boundary rule

- **Status:** validated
- **Lesson:** dependency-cruiser reports a package that is only a runtime peer as `npm-dev` and `npm-no-pkg` beside `npm-peer`, so the rule that forbade `npm-dev` from `packages/*/src` rejected every React import in the new package although the manifest declares the peer; an import is undeclared only when it is neither a dependency nor a peer, and the rule now says so with `dependencyTypesNot`.
- **Evidence:** `pnpm gate` failed at depcruise with 10 `no-undeclared-deps-from-src` errors on 2026-10-14, and `pnpm depcruise --output-type json` shows `["npm-peer","npm-no-pkg","npm-dev"]` for `react`; after the rule in `.dependency-cruiser.cjs` changed, `pnpm depcruise` reported `no dependency violations found (149 modules, 379 dependencies cruised)`.

## 2026-10-14 — a differential harness must refuse what it cannot wire

- **Status:** validated
- **Lesson:** the parity corpus declares a `tools` list that neither leg builds, so a scenario with tools would have run two tool-less agents that compared equal and went green while measuring the wrong thing; an input the harness cannot exercise is refused with a named error, because an equal trace and a skipped feature look identical in the report.
- **Evidence:** `scripts/parity/record.py` and `packages/core/test/parity.test.ts` both exit on a non-empty `tools`, added after the recorder and the suite were already green on five scenarios.

## 2026-10-14 — a test double that throws ends the run instead of failing the step

- **Status:** validated
- **Lesson:** a `ScriptedExecutor` handler that throws produces `AgentError` with no result, while returning a `CodeResult` carrying an `error` is a recoverable step that reaches the next model call; an error-recovery fixture scripts the returned error, and only a test that wants the fatal path expects the throw.
- **Evidence:** measured while building the corpus: the thrown variant gave `AgentError: boom` with no `RunResult`, and the returned variant gave two action steps and then the final answer, recorded in `scripts/parity/recordings/error-recovery.json`.

## 2026-10-14 — a divergence that covers every field pins nothing

- **Status:** validated
- **Lesson:** the max-steps scenario differs on all five compared fields at once, so an expectation that only listed them would have asserted nothing about either side; a divergence earns its place by also stating what the side we control must still do, which is why that scenario carries the values our run has to end with.
- **Evidence:** `scripts/parity/scenarios/step-budget.json` — `differsOn` names five fields and the expectation requires `max-steps` after two actions, while the recorded upstream run ends with a final answer after three steps.

## 2026-10-14 — Python's text mode writes CRLF on Windows

- **Status:** validated
- **Lesson:** `Path.write_text` follows the platform's newline, so a generator wrote CRLF into a checkout whose `.gitattributes` promises LF and git announced the conversion as it staged the files; a writer that produces files meant for version control passes the newline explicitly rather than trusting the platform.
- **Evidence:** `git add scripts/parity/recordings` warned "CRLF will be replaced by LF" for all five recordings on 2026-10-14, and the warning is gone since `record.py` writes with `newline="\n"`.

## 2026-10-14 — a record that calls a branch a port can be that branch's origin

- **Status:** validated
- **Lesson:** both of the S1.5 plan's behavioural findings trace to one place: the design record's loop pseudocode, which adds a guard upstream's planning condition does not have and replaces upstream's budget-exhausted ending with a throw, under a heading that calls the whole loop a port. A record that names its source is making a checkable claim, so the branch a finding turns on gets read in both trees before the record's word is taken for it.
- **Evidence:** `docs/design/2026-10-12-smolagents-ts-v1-design.md` against upstream `agents.py` in the vendored clone and in the tag the recordings pin; the investigations are `docs/research/2026-10-14-t16-planning-cadence.md` and `docs/research/2026-10-14-t18-max-steps-ending.md`.

## 2026-10-14 — two pinned upstreams are two different comparisons

- **Status:** validated
- **Lesson:** the design record pins one upstream revision and every parity recording pins another, and the two disagree on the very things both investigations turn on, so a finding read against the wrong one is wrong in a way no test catches. The version a comparison actually runs belongs beside the comparison, and the design's pin belongs beside the design.
- **Evidence:** the vendored clone's own version marker and the tag `v1.14.0`, against the recordings' metadata and the design's pin; the mismatch is tracked as T-21.

## 2026-10-14 — a plan's carried review point goes stale

- **Status:** validated
- **Lesson:** the S1 plan carried two review points into the whole-branch review and neither became a task or a decision, so four milestones later a session read the note, reported that the streamed chunk carries no usage as a live gap, and was wrong: the field, all four adapters' population of it and the per-adapter tests had shipped in S2a and S2b. A plan is history, so a carried point is a claim about the revision that wrote it; before repeating one as current, read the code it names, and when it is still live give it a task or a decision.
- **Evidence:** `docs/plans/2026-10-12-s1-core-runtime-plan.md` (the two carried points) against `packages/core/src/model.ts` (usage on the streamed chunk), `packages/models/src/anthropic.ts`, `packages/models/src/gemini.ts` and `packages/models/src/openai-compatible.ts`; the name half is decision 0011 and the still-live request gap is fixed in `packages/models/src/openai-compatible.ts`.

## 2026-10-14 — a second target is proven by a build, not by a test in the first

- **Status:** validated
- **Lesson:** the executor package's whole suite runs under Node, so nothing in the gate had ever bundled it for a browser, and the plan for the browser example named that gap as its highest risk; the first `vite build` retired it in under two seconds, emitting the engine as a 503 kB `.wasm` asset with the browser build of its loader beside it. A claim about a second target needs an artifact built for that target, and an example is what builds it.
- **Evidence:** `pnpm --filter example-vite-app run build` exits 0 on 2026-10-14 with `dist/assets/emscripten-module-uFzwHH0Y.wasm` (503.13 kB) and `dist/assets/emscripten-module.browser-DeQ2xOmI.js`, while `pnpm vitest run --project exec-quickjs` exercises the same engine only under Node.

## 2026-10-14 — the lockfile ties a new package and a new app to one commit

- **Status:** observed
- **Lesson:** one session added a workspace package while another added a workspace app, and both importers landed in the single `pnpm-lock.yaml`, so committing either deliverable alone leaves a revision whose lockfile names a directory that revision does not contain. A new workspace member and the lockfile that records it are one commit, however unrelated the two members are.
- **Evidence:** `pnpm-lock.yaml` carries both the `packages/cli` and the `examples/vite-app` importers on 2026-10-14, so the two deliverables share a commit.

## 2026-10-14 — a green gate on a dirty tree

- **Status:** validated
- **Lesson:** the gate runs its test stage before its build stage, and every package's tests reach a sibling through the workspace link, which points at a `dist/` a fresh checkout does not have; a local run passed because earlier builds had left those directories in place, while the same revision failed in CI with "Failed to resolve entry for package @smolagents-ts/core". A green gate is evidence about the tree it ran in, so a resolution fix is verified with every `dist/` removed first.
- **Evidence:** CI run 38525353943 on commit 211b94f: `gate (node 26)` failed inside `pnpm test` on `examples/node-script/test/example.test.ts` and `packages/smolagents-ts/test/surface.test.ts`, and `runtime (node)` failed inside `pnpm build`; the same gate was green locally on the same revision.

## 2026-10-14 — a filter glob the shell expands first

- **Status:** validated
- **Lesson:** `pnpm -r --filter ./packages/* run build` works in PowerShell, which hands the glob through, and fails in bash, which expands it into seven positional arguments before pnpm sees it — so the build, publint and attw stages ran locally and died on the CI runner with `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`. A script that passes a glob to a tool quotes it.
- **Evidence:** reproduced locally under Git bash on 2026-10-14: the unquoted form reports `None of the selected packages has a "./packages/core" script`, and the quoted form selects seven packages and exits 0; CI run 38525353943 shows the unquoted failure in `runtime (node)`.

## 2026-10-14 — a green deploy proves the upload, not the address

- **Status:** validated
- **Lesson:** the publishing job succeeded and the built tree held its pages, and neither fact says a reader can open the result; only fetching the deployed address does. The address is the builder's, not the source tree's, so guessing the path a directory has in the repository answers 404 for a page that is served elsewhere.
- **Evidence:** on 2026-10-14 the Pages run 38534571343 succeeded; the site root answers 200 with the numbered documents in its sidebar, the decision 0014 page answers 200, and the example answers 200 at `example/index.html` with its relative `assets/` entries, while the same example's repository path answers 404.

## 2026-10-14 — a transport failure that only logged

- **Status:** validated
- **Lesson:** the MCP client's transport-error handler wrote a warning and nothing else, so a handshake against a process that never started waited for a reply that could not come; because the request timer is deliberately unref'd, a Node process with no other handle exited 13 with "Detected unsettled top-level await" instead of reporting the failure. A transport that reports an error or a close settles everything in flight on that connection, and the connection remembers why so the next request refuses at once rather than waiting again.
- **Evidence:** the live check on 2026-10-14 against `command: "npx"` exited 13 before the fix and `failed after 8 ms: Error: spawn npx ENOENT` after it; two cases in `packages/mcp/test/client.test.ts` pin the error and the close path.

## 2026-10-14 — a package-manager shim is not a spawnable command

- **Status:** validated
- **Lesson:** on Windows Node resolves no extensionless `npx` for a spawn (`ENOENT`) and refuses to spawn `npx.cmd` without a shell (`EINVAL`), so a runbook whose check spawns a package manager's shim fails before it exercises the client at all. A procedure that needs a child process installs the package first and spawns `process.execPath` with the resolved entry, which is also what makes the run reproducible instead of network-dependent.
- **Evidence:** both errors measured on 2026-10-14 from the MCP live check; after switching to `process.execPath` with the installed `dist/index.js` the same check connected in 410 ms, listed 13 tools and answered the echo call, and `docs/10-runbooks/mcp-live-check.md` carries the corrected steps.

## 2026-10-14 — a hook over a builtin sees the interpreter's own traffic

- **Status:** validated
- **Lesson:** replacing `builtins.__import__` to enforce an allow-list looks like a check on the guest, but CPython routes every module's own import statements through the same hook, so a global replacement refuses the internals of the very modules the list authorises. The check has to name its caller: capture the guest's globals at install time and refuse only when the import came from there, which is what upstream's AST check achieves by inspecting the code instead of the runtime.
- **Evidence:** measured on 2026-10-14 against `pyodide@314.0.7`: the global replacement failed `import datetime`, `import queue` and `import statistics` with `ImportError: Import of _io is not allowed`, and the caller-scoped form passes all eleven authorised modules while still refusing `os`, `os.path` and a relative import; `packages/exec-pyodide/test/imports.test.ts` pins both halves.

## 2026-10-14 — an answer that arrives as a rejection

- **Status:** validated
- **Lesson:** a guest-side signal that subclasses `BaseException` escapes a guest's `except Exception`, and it also ends the call that raised it, so the host receives a successful `final_answer` as the run's failure. The host therefore records the answer where it can read it afterwards — a module global the prelude resets at the start of every run — and consults that flag before it maps the rejection to an error.
- **Evidence:** measured on 2026-10-14: with the flag read after the error branch every `final_answer` call reported `AGENT_EXECUTION`; with the flag read first, `packages/exec-pyodide/test/executor.test.ts` and the package's integration file both pass, including a guest that wraps the call in `except Exception`.

## 2026-10-14 — a rejected JavaScript promise is not a Python exception

- **Status:** validated
- **Lesson:** when a host callable returns a promise that rejects, the guest does not see the host's error type: Pyodide hands Python a `JsException`, so a bridge that promises a `RuntimeError` naming the tool has to catch the rejection on the JavaScript side and answer with a payload the emitted wrapper turns into that error.
- **Evidence:** measured on 2026-10-14 against `pyodide@314.0.7`; the bridge now returns a JSON envelope, and `packages/exec-pyodide/test/bridge.test.ts` asserts the `RuntimeError` a guest catches.

## 2026-10-14 — one seam, two capability layers

- **Status:** validated
- **Lesson:** a remote-executor seam can honestly claim it carries a mid-run tool round trip and report the core's `asyncToolCalls` as false at the same time, because the two fields answer different questions: one asks whether the guest can pause and wait for the host, the other whether the host holds an awaited promise that something could still settle. Reading a plan's shorthand for the second as a statement about the first produced a component rule that contradicted the code, and the two need separate sentences or a reader takes one for the other.
- **Evidence:** measured on 2026-10-14 — `packages/exec-remote/src/backends/process.ts:55` and `src/backends/docker.ts:69` set `supportsToolRoundTrip = true`, while the seam's own capability type (`src/sandbox.ts:32-33`) has no `asyncToolCalls` field at all; that field belongs to `packages/core/src/executor.ts:17`, a different type in a different package, which is where the conflation happened.

## 2026-10-14 — a capability value describes the mediator, not the world

- **Status:** validated
- **Lesson:** a backend can report `network: "none"` while the code it runs inherits the host's own network, because the field records what the package mediates rather than what the guest can reach; only a backend whose traffic this package actually routes reports `"direct"`. A reader who takes the value as a denial forms a false picture of the least isolated backend in the package, so the field's meaning has to be stated where it is surfaced and the prose around it must not lean on the value.
- **Evidence:** `packages/exec-remote/src/backends/process.ts:50,56` carries both the comment and the value, `src/backends/docker.ts:70` reports `"direct"`, and the plan states the same split at `docs/plans/2026-10-14-t13-remote-executors-plan.md:63-64`; `rules/components/exec-remote.md` now forbids reading the value as a denial.

## 2026-10-14 — a package manager's default can be a behaviour, not a config value

- **Status:** validated
- **Lesson:** pnpm held three vendor versions back on a fresh install and wrote their exact versions into the workspace file itself, while `pnpm config get minimumReleaseAge` answered `undefined` on the same machine, because the threshold is a default behaviour rather than a surfaced setting. Reading the config and concluding the quarantine was off was wrong in the direction that matters: it would have shipped a policy nobody had reviewed. The artifact that proved it was the exclusion list pnpm wrote, so when a tool's own output contradicts a config read, the output is the evidence.
- **Evidence:** measured on 2026-10-14 with pnpm 12.3.4 — `pnpm --version` answered 12.3.4, `pnpm config get minimumReleaseAge` answered `undefined`, and `pnpm-workspace.yaml` carried the three exclusions pnpm appended for `@e2b/code-interpreter@2.9.0`, `@e2b/dockerfile-utils@0.1.1` and `e2b@2.56.0`; the posture and its costs are recorded in `docs/09-decisions/0017-release-age-quarantine.md`.

## 2026-10-14 — a green gate can rest on a host tool the package never declares

- **Status:** validated
- **Lesson:** the remote-executor package's process suite spawns a real interpreter, so the gate acquired a dependency on Python that no manifest in the repository states, and the environment document still claimed the build and the gate did not use it. Nothing failed, because the machine had one — which is exactly why an undeclared host dependency survives: the only contributor who learns about it is the one who lacks it. A test that leaves the process should say so in the document that describes the machine.
- **Evidence:** `packages/exec-remote/test/process.test.ts:9,26,44,57` each spawn an interpreter with no skip guard, the suite passes as 11 files and 57 tests, and `docs/02-environment.md` carried the contradicting claim until it was corrected in the same session.

## 2026-10-14 — a second resolver config repeats the first one's omission

- **Status:** validated
- **Lesson:** a workspace package whose dependency is itself built resolves that dependency through the dependency's `dist/`, so every config that resolves it needs the same mapping to source that the build config already carries; the identical omission landed twice in one session, once in a package's test tsconfig and once in the example's vitest config, and each time the suite passed locally because a `dist/` happened to be there. CI runs the test stage before the build stage, so the defect is invisible on a warm machine and fatal on a fresh checkout, and the check that catches it is to move the dependency's `dist/` away and re-run rather than to read the config again.
- **Evidence:** measured on 2026-10-14: with `packages/react/dist` moved away, `pnpm --filter @smolagents-ts/react-ui run typecheck` exits 0 only once `packages/react-ui/tsconfig.test.json` declares the `paths` block; with `packages/react-ui/dist` moved away, `pnpm vitest run --project example-vite-app` passes its 3 tests only once `examples/vite-app/vitest.config.ts` carries the alias its sibling `vite.config.ts` already had.

## 2026-10-14 — the same omission reached CI a third time, so the repair is a test

- **Status:** validated
- **Lesson:** the resolver omission above landed a third time, in the example's compiler `paths`, and this instance was not caught locally at all: it passed the gate on a machine that had built the packages and failed the CI workflow on both commits that carried it, on every Node version, at the typecheck stage that runs before the build. Two things follow. A green local gate is not evidence about a fresh checkout when the defect is a missing `dist/`, because the gate's first stage reads the `dist/` the previous build left behind. And a class of defect repaired by hand three times is repaired by a test instead: `examples/vite-app/test/resolution.test.ts` pins the three resolver configs to each other, so a name one config covers every config covers, and every compiler path must resolve to a source file. The second case is not decoration — mapping `@smolagents-ts/react-ui` to its source pulls in a file that imports `@smolagents-ts/react` by package name, so the compiler needs that name too, and the `paths` block had been listing only the bare `smolagents-ts/*` spellings the app writes itself.
- **Evidence:** measured on 2026-10-14: CI run 38561860896 on `ae52941` failed at `pnpm typecheck` with `examples/vite-app typecheck: src/App.tsx(3,55): error TS2307: Cannot find module '@smolagents-ts/react-ui' or its corresponding type declarations`, on both node 22 and node 26. After the entry was added, moving all twelve `packages/*/dist` and `apps/*/dist` directories away and running `pnpm typecheck` exits 0; before the scoped siblings were added to the same block, that simulation failed with `../../packages/react-ui/src/styled-chat.tsx(1,52): error TS2307: Cannot find module '@smolagents-ts/react'`. The example's suite reads 2 files and 6 tests, and `git status` shows no `dist.bak` left behind.

## 2026-10-14 — a peer the design calls optional fails every install if it is declared required

- **Status:** validated
- **Lesson:** the facade package declared the QuickJS engine as a real peer, so `pnpm install` failed for two new examples that never import the execution entry — `missing peer quickjs-emscripten-core / Wanted: ^0.32.0: smolagents-ts@0.1.0`. pnpm's default `strictPeerDependencies` turns a peer no consumer declares into an install failure, so a peer that is needed on only one path must also appear in `peerDependenciesMeta` with `optional: true`. The engine still reaches a consumer that does use that path, because the implementation package carries it as a real dependency.
- **Evidence:** measured on 2026-10-14: `examples/multi-step` and `examples/tool-calling` failed `pnpm install` with the message above while importing only `smolagents-ts` and `smolagents-ts/exec/quickjs`; after `peerDependenciesMeta` gained `quickjs-emscripten-core` and `@jitl/quickjs-wasmfile-release-sync`, `pnpm install` exited 0 and `pnpm install --frozen-lockfile` reported `Lockfile is up to date`. The plan already specified those peers as optional (`docs/plans/2026-10-14-s6-distribution-plan.md:21-22`), so the manifest had drifted from its own design.

## 2026-10-14 — hand-made node_modules junctions leave the lockfile blind, and CI's frozen install is what notices

- **Status:** validated
- **Lesson:** a workspace project added without a real install can still pass its own tests, because Node resolves the packages directly, while `pnpm-lock.yaml` never learns the project exists. The local signal is therefore green and the first honest signal is CI's `--frozen-lockfile`, which fails on an outdated lockfile. Any change to the workspace's project set must be followed by a real `pnpm install` and a `--frozen-lockfile` check.
- **Evidence:** measured on 2026-10-14: after four example projects were added with hand-made `node_modules` junctions, `pnpm-lock.yaml` held no importer for them; a real `pnpm install` rewrote it to list all four, after which `pnpm install --frozen-lockfile` exited 0 with `Lockfile is up to date`.

## 2026-10-14 — rotation can be blocked while the validator and its own check both pass

- **Status:** validated
- **Lesson:** `docs/03-handoff.md` had lost its closing `<!-- rotate:end -->` marker, which made `python scripts/rotate.py` abort with `rotation markers missing or region empty`. Neither `python scripts/rotate.py --check` (exit 0) nor `python scripts/validate_context.py` (0 errors, 0 warnings) noticed, because the file's over-cap size is a baselined finding and the marker is examined only when a rotation actually applies. A handoff that has grown for several sessions can therefore be quietly unrotatable; the marker pair and the per-entry size limit are exercised only by the applying command.
- **Evidence:** measured on 2026-10-14: `python scripts/rotate.py` printed `ABORT: docs/03-handoff.md: rotation markers missing or region empty` while `rotate.py --check` exited 0 and the validator reported `errors: 0, warnings: 0`; after the marker was restored the same command printed `ABORT: docs/03-handoff.md: entry over 2048 bytes (2273)`, showing the per-entry cap is checked only on the applying path too.

## 2026-10-14 — a delimiter that must start its line rejects a well-formed answer

- **Status:** validated
- **Lesson:** `extractCodeBlock` scanned for a fence with `trimmed.startsWith(fence)`, so a model that opened its block after a sentence — `Thought: ready. ```javascript` — had no block as far as the parser was concerned, and the run died with "No action found in the response" while the code sat in the message. Upstream's pattern carries no line anchor, so the check was a deviation, and one no fixture here could reveal: every fixture in this repository writes the fence on a line of its own. When a parser reads model output, match the delimiter anywhere on its line, and keep a fallback for an answer that arrives without one at all.
- **Evidence:** measured on 2026-10-14: `extractCodeBlock` returned null for `"Thought: ready. \`\`\`javascript\nfinal_answer(7)\n\`\`\`"` and for the same body with no fence, before the fix; seven sampled live responses placed the fence at a line start, which is why the fixtures and the suite were green. After the fix `packages/core` reports 30 files and 304 tests, the five added cases cover the inline and unfenced forms, and `CodeAgent.interpret` falls back to the whole message when it calls `final_answer`.

## 2026-10-14 — a bundler that relocates a dependency breaks that dependency's own asset URL, and only a browser sees it

- **Status:** validated
- **Lesson:** the QuickJS variant finds its engine with `new URL("emscripten-module.wasm", import.meta.url)`, which is true only while the module sits where its package put it. The dev server's dependency pre-bundle copies that module into `node_modules/.vite/deps`, so the same expression named a path that does not exist, the server answered with the SPA fallback `index.html`, and the browser reported `Incorrect response MIME type. Expected 'application/wasm'` followed by `expected magic word 00 61 73 6d, found 3c 21 64 6f` — `\0asm` against `<!do`. Four things generalise. A relative asset URL inside a dependency is a claim about that dependency's location, so any bundler that relocates the module invalidates it, and the exclusion that keeps the module in place is the repair rather than a workaround. The build was never affected, because Rollup rewrites the same expression into an emitted asset, so `vite build`, `vite preview` and a static deploy all worked while `vite dev` did not — which is why "it works when built" is no evidence about the dev server. No test in this repository could see it, because every suite runs in Node, where the engine loads from disk: the example's own suite stayed green through a total browser failure, so a defect confined to a browser needs a browser to find it. And the page reported the failure as the run's own `Failed` status, which is what a host wiring fault looks like from inside the agent's event stream.
- **Evidence:** measured on 2026-10-14 by driving the running app with `agent-browser`. Before the exclusion: scripted mode read `status: Failed, steps: 1` with the four console errors above, `HEAD /node_modules/.vite/deps/emscripten-module.wasm` answered `200 text/html`, and `HEAD /@fs/<repo>/node_modules/.pnpm/@jitl+quickjs-wasmfile-release-sync@0.32.0/node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm` answered `200 application/wasm, 503134 bytes`. After it: scripted mode reads `status: Finished, steps: 2, tools: greet:ok`; a live Gemini task in the same page reads `status: Finished, steps: 2` with the programs `const product = 15 * 4; console.log("Product:", product);` and `const finalResult = 60 * 2; final_answer(finalResult);`; the console carries no error; `vite preview` over the built app reads `status: Finished, steps: 2`; and `examples/vite-app/dist/assets/emscripten-module-uFzwHH0Y.wasm` is still emitted. The guard is the pre-bundle case in `examples/vite-app/test/resolution.test.ts`.

## 2026-10-16 - a seam that defaults its injected environment to empty hides a bin that passes none

- **Status:** validated
- **Lesson:** `runSmolagent` takes its environment as an injected map that defaults to `{}` so its tests stay hermetic, so a caller that passes nothing runs with no provider key at all - and every unit test stays green, because each test supplies the map it needs. The defect lives in the join, not in either side: the library is right to default to empty and the tests are right to inject, and only the bin was wrong. A package that takes its configuration by injection needs one test at the real entry point, not only at the injected seam.
- **Evidence:** measured on 2026-10-16 - `packages/cli/src/main.ts` called `runSmolagent` with no `env`; `packages/cli/test/main.test.ts` (3 cases) now asserts the bin forwards `process.env`, and the live Gemini run in `examples/vite-app` only worked once the same environment reached the adapter.

## 2026-10-16 - a demo whose transcript is hardcoded shows the wrong conversation after any live run

- **Status:** validated
- **Lesson:** the example's chat surface renders a literal `TRANSCRIPT` constant rather than the run's own events, so a live run updates the status line while the message list keeps showing the canned demo - the page looks broken precisely when it is working. A surface that displays agent output must be fed the run's event stream; a fixture is for the screenshot, not for the live path.
- **Evidence:** `examples/vite-app/src/App.tsx:19` holds the fixed `TRANSCRIPT`; driven live with `agent-browser`, the composed status read `Finished` while the transcript still showed the fixture. Open task T-28 covers the fix.

## 2026-10-16 - an agent with no search tool answers a search prompt instead of refusing

- **Status:** validated
- **Lesson:** asked to search the web, the example agent produced a fluent, invented summary rather than saying it had no such tool, because nothing in the loop treats a missing capability as a reason to stop. A confined tool set is not on its own a guard: the prompt, or a capability check before the model call, has to make the absence explicit, or the run answers anyway.
- **Evidence:** measured on 2026-10-16 with `agent-browser` against `examples/vite-app` (tools `greet` and `add` only): the run returned a confident Mars summary with no tool call and no error.

