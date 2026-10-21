# Brief verification — 15, 16 and 18

**Contract**
- **Role:** independent check of the citations and counts in the three synthesis briefs, for the Lead only. It judges the filed briefs; it does not replace them.
- **Mutability:** snapshot at the pins below. If a brief changes, this check is stale.
- **Read when:** before a decision cites 15, 16 or 18.
- **Update when:** a brief is corrected; never edit a brief to clear a finding.

**Errata applied:** the nine corrections in the last section were applied in place to the three briefs by the Lead after this check, so the pins above describe the pre-correction text while the tables below preserve the wrong values as evidence.

**Method.** Read-only: nothing installed, built, run or committed. Every citation was extracted from the brief text, then resolved against `reference/competitors/` (22 clones or artifact dirs, 111,298 files indexed) or against the dive file it names; the cited line was read and checked against the surrounding claim. Citations under twenty were resolved exhaustively; at or over twenty, all were checked for existence and range and twenty were read for sense. Numeric claims were re-counted in the dives and, where the dive supported it, in the clone.

**Pins:**
- `15-durability-design-brief.md` — 320 lines, sha256 starts `519778523860a0a0`, mtime 16:23:51Z.
- `16-models-and-output-brief.md` — 226 lines, sha256 starts `35e5c4d527f093bb`, mtime 16:23:59Z.
- `18-security-and-guardrails-brief.md` — 222 lines, sha256 starts `d5d490a2bebe4f82`, mtime 16:28:14Z. It changed repeatedly during this check (174 → 222 lines); the rows below are against this pin.

## 1. `15-durability-design-brief.md`

33 citations, all dive-relative; 33/33 resolve to an existing dive file, 0 out of range, 0 landing on a blank line. All 33 were checked at snippet level against the claim; all matched.

| citation | verdict | note |
|---|---|---|
| `claude-agent-sdk/02-features-inventory.md:78-82` | verified | band 0 = resume by transcript, forks by id rewrite; line 78 starts the SESS table |
| `openai-agents-js/01-architecture.md:58-70`, `:78-84` | verified | run created or rebuilt from snapshot; `:78` is the versioned JSON document |
| `mastra/01-architecture.md:81-92`, `:165-177` | verified | run materialised from a snapshot doc; persistence opt-in, suspended runs only |
| `openhands/01-architecture.md:129-143` | verified | conversation directory with `meta.json`, `base_state.json` |
| `adk-js/01-architecture.md:109-138` | verified | the three records, session/event state started at `:109` |
| `langgraphjs/01-architecture.md:102-111` | verified | one immutable record per superstep, v4 shape |
| `cloudflare-agents/02-features-inventory.md:75-76` | verified | generation fencing row |
| `openhands/01-architecture.md:145-148` | verified | per-conversation lease |
| `_synthesis/00-our-baseline.md:50-59` | verified | HL rows 01–10 |
| "cites the ten filed dives" (line 9) | count stale | ten are cited, but 21 dives are filed (19 at this brief's mtime); "ten of the filed dives" |
| "Six choices recur in at least four dives" (line 170) | partly unsupported | choice 1 cites only three dives (`langgraphjs`, `openhands`, `cloudflare-agents`); the other five name four or more |
| "Five neighbours fence ownership" (line 119) | verified | mastra, vercel-eve, openhands, cloudflare-agents, agno = 5 |
| "Stated by nine" (line 186) | verified | ten dives minus claude-agent-sdk |
| "diverge on four things" (line 190) | verified | commit granularity, pause generality, version policy, ownership |

No execution claim: the brief states "No repository was read for this brief beyond those dives", and no clone path appears in it.

## 2. `16-models-and-output-brief.md`

59 citations; 59/59 resolve (dive files and clone paths), 0 out of range, 0 blank. All were snippet-checked; fourteen were read in context, and all matched apart from the wording notes below.

| citation | verdict | note |
|---|---|---|
| `generate-text/output.ts:32`, `:37`, `:49`, `:56` | verified | `responseFormat`, `parseCompleteOutput`, `parsePartialOutput`, `createElementStreamTransform` |
| `output.ts:163` | verified | partial parser returns `DeepPartial`; the "no validation of partial results" comment is at `:175` |
| `pydantic_ai_slim/pydantic_ai/output.py:103`, `:180`, `:237` | verified | `ToolOutput`, `NativeOutput`, `PromptedOutput`; the fourth mode `TextOutput` is at `:351` |
| `pydantic_ai_slim/pydantic_ai/_output.py:130`, `:385` | verified | validate hooks; `except ModelRetry` around the retry path |
| `_output.py:973` | line right, wording loose | the mode is `allow_partial='trailing-strings'` — partial JSON validation, not "satisfied by a stringified form" |
| `mastra/.../router.ts:111`, `provider-registry.ts:750` | verified | router over `LanguageModelV2/V3/V4` (imports at `:4-6`) |
| `adk-js/core/src/models/registry.ts:19` | verified | `BaseLlmType` with `supportedModels` patterns |
| `openai-agents-js/packages/agents-core/src/model.ts:688`, `:712` | verified | `Model` interface; retry advice |
| `huggingface-smolagents/src/smolagents/models.py:1205`, `:282` | verified | `LiteLLMModel`; tool-role conversions |
| `beeai-framework/typescript/src/agents/react/agent.ts:70` | verified | runner chosen from model-id substrings (`granite`, `deepseek-r1`) |
| "about ten optional booleans" (line 33) | loose | `ModelProfile` (`profiles/__init__.py:55`) has 12 boolean fields among 18 optional keys |
| "about 45 vendor packages" (line 45) | verified | 83 package dirs, 44 provider-named (43 vendor + `openai-compatible`); "about" is fair |
| "Our five" adapters (line 45, `:88`) | verified | anthropic, gemini, huggingface, openai-compatible, custom |
| "no two dives cited here share a top-level prefix" (line 14) | false | `packages/` (vercel, mastra, openai), `src/` (pydantic, hf), `typescript/` (beeai), `libs/` are shared; the real property is unique file basenames |
| mastra additions from the clone | disclosed | "Confidence and gaps" names the router and structuring processor as clone additions |

No execution claim. The only "measure" sentence refers to Mastra's own tests, not to work done here.

## 3. `18-security-and-guardrails-brief.md`

151 citations: 121 clone-relative paths, 20 `clone:/` doc paths, 8 `sdk:` paths and 2 dive-line citations. 150/151 resolve to an existing file; 0 out of range, 0 blank; 20 read against the claim. All 151 file basenames appear in the filed dives, and every differing line number co-occurs with its basename in a dive — so the "no repository was opened" statement is corroborated.

| citation | verdict | note |
|---|---|---|
| `clone:/docs/hosting.md:177-208` | verified | "Container-based sandboxing" |
| `clone:/docs/permissions.md:13-52`, `:56-63` | verified | permission ladder and `canUseTool` note |
| `sdk.d.ts:228-270`, `:2036-2039`, `:2554-2559` | verified | `CanUseTool`, `allowDangerouslySkipPermissions`, `PermissionResult` |
| `packages/js-sdk/src/sandbox/sandboxApi.ts:257-320`, `:176-345` | verified | `SandboxNetworkOpts`, `SandboxEgressProxyOpts` |
| `runner/guardrails.ts:30-105`, `:307`, `:316` | verified | `GuardrailTracker`; tripwire errors (file has 821 lines) |
| `packages/agents-core/src/tool.ts:110`, `:2761` | verified | `ToolApprovalFunction`; `buildRequireApproval` |
| `core/src/tools/tool_confirmation.ts:45-57`, `:63` | verified | pinned-call failure reasons; fail-closed comment |
| `packages/core/src/agent/trip-wire.ts:16`, `:35` | verified | retry-as-feedback; `TripWire` class |
| `packages/core/src/processors/processors/classifier.ts:105` | verified | `errorStrategy ?? 'strict'` |
| `packages/think/src/think.ts:16215-16236` | verified | `_approveActionPause` claim/row path |
| `clone:/docs/clients/caching.md:85` | verified | `defaultCacheTtlMs`, default 0 (opt-in) |
| `clone:/docs/behavior-surface-pins.md:1` for "746-line support page" (line 141) | wrong target | the pins page is 52 lines; the 746-line page is `clone:/docs/migration/support-2026-07-28.md` (746 newlines) |
| `src/pydantic_ai_harness/pydantic_ai_harness/toolsets/approval_required.py:16` (line 66) | wrong path | the harness has no `toolsets` dir; the file is `pydantic_ai_slim/pydantic_ai/toolsets/approval_required.py:16` (`ApprovalRequiredToolset`) |
| `packages/agents/src/index.ts:1-8` (lines 86, 137, 205) | ambiguous, resolvable | only the openai clone matches the claim (provider plus tracing exporter wired at import); cloudflare's file opens with ALS + MCP imports |
| `packages/core/src/agent/agent.ts:5641` (line 32) | ambiguous, resolvable | voltagent (`prepareAgentsMemory`); the mastra file ends at 5601 |
| "eighteen neighbours/dives" (title, lines 9, 220, 222) | count stale | the table names 18 distinct dives and is internally consistent, but 21 are filed and three are not covered: `autogen`, `crewai`, `inngest-agent-kit` |
| release 1 = 6 items, release 2 = 5 items (lines 182–201) | verified | 6 and 5 rows; "four control points", "four failure points" and the 8 fixtures also check out |

No execution claim; none of the briefs offers a run, test or measurement of ours. Brief 18's 29 citations that are not verbatim in a dive are all derivable from a dive line, and none implies a fresh read.

## Corrections for the Lead

1. **18, line 141:** bind "746-line support page" to `clone:/docs/migration/support-2026-07-28.md`, not `clone:/docs/behavior-surface-pins.md:1` (52 lines).
2. **18, line 66:** pydantic's approval toolset is `pydantic_ai_slim/pydantic_ai/toolsets/approval_required.py:16`; the `src/pydantic_ai_harness/...` prefix is wrong for this file.
3. **18, lines 86, 137, 205:** label `packages/agents/src/index.ts` as the openai clone; leave `packages/core/src/agent/agent.ts` as voltagent. Both are correct in meaning, ambiguous as written.
4. **18, title and lines 9, 220, 222:** "eighteen" is now wrong — 21 dives are filed; say "eighteen of the filed dives" or add the three missing (`autogen`, `crewai`, `inngest-agent-kit`).
5. **16, line 14:** drop "no two dives cited here share a top-level prefix" — several do; "each clone path is unique by file" is true.
6. **16, line 33:** "about ten optional booleans" → twelve boolean fields (18 optional keys) in `ModelProfile`; or say "a dozen".
7. **16, line 89:** describe pydantic's tolerance as `allow_partial='trailing-strings'` (partial JSON), not "a stringified form".
8. **15, line 9:** "the ten filed dives" → "ten of the filed dives".
9. **15, line 170:** either add a fourth dive to convergence 1 or soften "at least four dives".

**Verdict:** 243 citations checked (33 + 59 + 151); two wrong targets, both in 18; four path forms ambiguous (the `run.ts`/`tool.ts` family, `sdk.d.ts`, `packages/agents/src/index.ts`, `packages/core/src/agent/agent.ts`), all resolved by the claim; no out-of-range or blank lines; no execution claims; brief 18 is a moving target and the rows here hold only for sha `d5d490a2bebe4f82`.
