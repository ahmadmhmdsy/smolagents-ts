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

