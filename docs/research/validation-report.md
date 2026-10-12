# Validation report — smolagents-ts v1 design and S0/S1 plans

**Date:** 2026-10-12
**Scope:** every external factual claim and every internal cross-reference in
`docs/design/2026-10-12-smolagents-ts-v1-design.md` (919 lines),
`docs/plans/2026-10-12-s0-foundations-plan.md` (991 lines) and
`docs/plans/2026-10-12-s1-core-runtime-plan.md` (6050 lines), validated **part by part**
against the network and against the pinned upstream checkout.
**Verdict vocabulary:** PASS · FAIL · IMPRECISE · MISSING · NEEDS_USER_DECISION.

## 1. Method

Seven independent validation passes were run, each with its own evidence trail; findings were then
re-checked by hand against the pinned upstream source before being accepted. One subagent finding
(that the design's LOC table was "wrong/outdated") was **rejected** on re-check: all 17 values match the
non-blank line counts at the pinned commit exactly — only the column *label* was imprecise.

| pass | what it validated |
|---|---|
| Zod 4 | `z.toJSONSchema`, `{io:"input"}`, Standard Schema, version/peer claims |
| Vitest | workspace/projects config, browser mode, provider packages, current major |
| QuickJS-WASM | package names, runtime API surface, asyncify limits, size, memory-limit behaviour |
| Runtime + web standards | ECMA-429 existence/ownership, Node release schedule, ECMA-402 vs 429 boundary |
| Upstream repository | file inventory, commit pin, prompt/YAML/exception facts, parity-suite names, licence notices |
| Toolchain + packaging | current majors of tsup/publint/attw/changesets/eslint/dependency-cruiser, rule semantics, exports-map rules |
| TypeScript config + language | every compiler option in `tsconfig.base.json`, lib coverage, decorators, stray-import behaviour |

Environment: Node v24.18.0, git 2.47.1.windows.1, Windows. Upstream clone pinned at
`96f33faaf028479119ec8d34507b47694cf14e34` (2026-10-06, `v1.27.0.dev0`, Apache-2.0), verified equal to
current `main` HEAD (≈29,799 stars).

## 2. Summary

| id | claim / area | verdict |
|---|---|---|
| D-1 | "ECMA-429" used as the name of the *language* target | FAIL (corrected) |
| D-2 | `Intl` listed inside the ECMA-429 allowed set | FAIL (corrected) |
| D-3 | Node 22/24 as the supported floor | IMPRECISE (corrected) |
| D-4 | "four YAML prompt files" incl. `final_answer.yaml` | FAIL (corrected) |
| D-5 | prompts "ported verbatim in meaning and structure" | FAIL (corrected) |
| D-6 | `populateTemplate` "ports upstream's `populate_template`" | FAIL (corrected) |
| D-7 | guest language "ES2020 subset" | IMPRECISE (corrected) |
| D-8 | `runtime.executePendingJob()` | FAIL (corrected) |
| D-9 | §9.3 host-bridge API names | IMPRECISE (corrected) |
| D-10 | §9.3 missing a Workers loader branch | MISSING (added) |
| D-11 | `pnpm build:all` | FAIL (corrected) |
| D-12 | coverage floor + bundle-size gate | MISSING (deferred explicitly) |
| D-13 | pack-smoke target described as `examples/node-script` | FAIL (corrected) |
| D-14 | LOC column unlabelled; "4 files" | IMPRECISE (corrected) |
| D-15 | §14 overlap between S3/S4 and S1 | IMPRECISE (clarified) |
| D-16 | parity suite names / CI matrix contents | PASS, with additions |
| D-17 | `z.ZodTypeAny` | FAIL (deprecated, corrected) |
| D-18 | Zod→JSON-Schema edge cases not documented | MISSING (added) |
| D-19 | vocabulary divergences vs upstream not documented | MISSING (added) |
| D-20 | upstream prompt renders *callable signatures*; ours renders a schema list | MISSING (documented as divergence) |
| S0-1 | `vitest.workspace.ts` + `defineWorkspace` | FAIL (removed in Vitest 4) |
| S0-2 | `engines.node ">=22"` | IMPRECISE |
| S0-3 | `typescript ^5.7.0` | FAIL (2 majors behind) |
| S0-4 | `eslint ^9` + `tseslint.config()` | IMPRECISE (deprecated) |
| S0-5 | `@changesets/cli ^2.28.0` + schema URL | FAIL (major is 3; config is 4) |
| S0-6 | `dependency-cruiser ^16.0.0` | IMPRECISE (major is 18) |
| S0-7 | `attw --pack .` with no profile | FAIL (needs `--profile esm-only`) |
| S0-8 | `quickjs-emscripten` all-in-one dependency | IMPRECISE (size) |
| S0-9 | `lib: ["ES2023","DOM","DOM.Iterable"]` in the shared base | PASS, with a documented cost |
| S0-10 | `no-restricted-syntax` Function selector | IMPRECISE (misses the bare call) |
| S0-11 | `no-restricted-imports` bare-name coverage | PASS |
| S0-12 | Apache-2.0 notice duties / `NOTICE` | PASS |
| S1-1 | `--project core` selectors | IMPRECISE (needs explicit names) |
| S1-2 | `zod@^3` hedge | FAIL (contradicts S0) |
| S1-3 | `toSpec()` output vs strict provider schemas | IMPRECISE (needs `additionalProperties: false`) |
| S1-4 | Task 8 prompt fidelity vs the design's promise | FAIL (aligned) |
| S1-5 | Task 14 edits a file missing from its Files block | FAIL (added) |
| S1-6 | `crypto.randomUUID` secure-context comment | IMPRECISE (corrected) |
| S1-7 | Task 12 = contract only; design §14 lists it under S4 | IMPRECISE (clarified) |

---

## 3. Design document, part by part

### D-1 — "ECMA-429 subset" conflates a language standard with an API standard — FAIL

**Where:** lines 29, 124, 253, 707.
**Claim as written:** "The core is isomorphic (ECMA-429 subset)"; "**isomorphic core** — ECMA-429 + Node 22/24
+ browsers"; "**The core's allowed API surface** (ECMA-429 / WinterTC Minimum Common API)".
**Reality:** these are two different standards with two different owners.
- **ECMA-262** is the *language* (17th edition / ES2026, approved June 2026).
- **ECMA-429** "Minimum common web API" is the *API* standard, 1st edition December 2025, published by
  **Ecma International TC55** — not by "WinterTC". TC55 grew out of the WinterTC community group, but the
  standard is an Ecma standard and must be cited as such.
**Authority:** Ecma International TC55 / ECMA-429.
**Correction applied:** the target is now stated as the ECMA-262 language subset plus the ECMA-429
minimum-common-web-API subset, with the correct standard body and edition.

### D-2 — `Intl` is not part of ECMA-429 — FAIL

**Where:** line 257.
**Claim as written:** the allowed API list includes `Intl` alongside `JSON`, `Math`, `Promise`.
**Reality:** `Intl` appears **zero** times in ECMA-429; it is ECMA-402, an *optional* add-on. `JSON`,
`Math`, `Promise` and async iteration are ECMA-262 builtins reachable through the conformance
clause, not ECMA-429 members. `Intl` behaviour genuinely diverges across Node, Bun, Deno and Workers
(ICU data, locale sets), so it cannot be a guaranteed surface.
**Correction applied:** `Intl` is removed from the guaranteed set and documented as best-effort
(ECMA-402, feature-detect, never assert exact formatting output in tests).

### D-3 — Node support window — IMPRECISE

**Where:** line 246.
**Reality:** Node 24 is Active LTS and moves to Maintenance on **2026-10-20** (EOL 2028-04-30); Node 22 is
Maintenance LTS with EOL **2027-04-30**; **Node 26 is Current** since 2026-05-05.
**Correction applied:** the floor is time-boxed to ≈April 2027, Node 26 is named, and the CI matrix gains it.

### D-4 — upstream ships three prompt files, not four — FAIL

**Where:** lines 564, 856.
**Reality:** `smolagents/src/smolagents/prompts/` contains exactly three YAML files —
`code_agent.yaml`, `structured_code_agent.yaml`, `toolcalling_agent.yaml` — each with the same four
top-level sections (`system_prompt`, `planning`, `managed_agent`, `final_answer`). There is no
`final_answer.yaml`: `final_answer` is a *section inside each file*. `structured_code_agent.yaml` is
selected when `use_structured_outputs_internally` is on.
**Correction applied:** "four files" → "three files", with the section/file distinction and the
`structured_code_agent.yaml` selection rule stated.

### D-5 — "ported verbatim in meaning and structure" overstates the S1 deliverable — FAIL

**Where:** line 565.
**Reality:** upstream's `code_agent.yaml` system prompt is **173 lines**: six fully worked examples
(task, thought, code, observation) and **eleven** numbered rules. The S1 plan's
`CODE_AGENT_SYSTEM_TEMPLATE` is a ≈45-line re-authoring with a shorter example set and a shorter rule
list, while Task 8's own instruction is "keep the wording as close to upstream as the dialect allows".
Calling that "verbatim in meaning and structure" is not true of the artifact the plan specifies.
**Correction applied:** the design now promises a *faithful re-authoring in the JavaScript dialect that
preserves the contract*, and S1 Task 8 gains an explicit fidelity checklist (every upstream rule must have
a JS counterpart; the 11 rules' *intent* must all survive; rule 9's import guidance is replaced because the
QuickJS guest has no `import`). Any claim of *verbatim* porting was removed.

### D-6 — `populateTemplate` does not "port" upstream's `populate_template` — FAIL

**Where:** lines 570-571.
**Claim as written:** "A `populateTemplate(template, variables)` function ports upstream's
`populate_template` including its Jinja-ish `{{ var }}` substitution and its error on unknown variables."
**Reality:** upstream's `populate_template` (`agents.py:102`) is a thin wrapper over real **Jinja2**
(`jinja2.Template(..., undefined=StrictUndefined).render(**variables)`). The upstream prompt files therefore
use the full Jinja2 language — verified 20 tags in `code_agent.yaml` alone:
`{%- for tool in tools.values() %}`, `{%- if managed_agents ... %}`, `{% endif %}`, `{% endfor %}`,
and **method-call / dotted placeholders** such as `{{ tool.to_code_prompt() }}`, `{{ agent.name }}`,
`{{ agent.description }}`. Our `populateTemplate` does flat identifier substitution only: no loops, no
conditionals, no filters, no dotted paths.
It is a **replacement for a Jinja2 subset**, not a port. Two further upstream facts were confirmed:
there is **no `strict` parameter** (strictness is unconditional `StrictUndefined`), and malformed or
unterminated placeholders raise `TemplateSyntaxError` at `Template(...)` construction, i.e. *outside* the
try block, so they propagate unwrapped.
**Correction applied:** the design and S1 Task 7 now describe `populateTemplate` as a replacement for a
Jinja2 subset, with the unsupported features and the deliberate pass-through of non-identifier placeholders
named explicitly as divergences.

### D-7 — guest language is not "ES2020" — IMPRECISE

**Where:** line 707.
**Reality:** Bellard's QuickJS documents support for the **ES2025** specification; the vendored engine in
`quickjs-emscripten-core@0.32.0` is `2025-09-13+f1139494` and the wrapper advertises "most of ES2023".
**Correction applied:** the guest is described as modern-ES with the concrete omissions named — no
`Intl`/ECMA-402, no tail calls, no `Atomics.waitAsync`.

### D-8 — `executePendingJob` does not exist — FAIL

**Where:** line 728.
**Reality:** the API is `runtime.executePendingJobs(maxJobsToExecute?: number | void)` (plural), verified
from the shipped `quickjs-emscripten-core@0.32.0` type declarations.
**Correction applied.**

### D-9 — §9.3 host-bridge API names — IMPRECISE

**Where:** §9.3.
**Reality:** the real surface is `context.newFunction`, `context.newPromise(nativePromise)`,
`context.evalCodeAsync`, and `context.newAsyncifiedFunction` (asyncify builds only).
**`newAsyncFunction` does not exist.** Asyncify costs: roughly 2× engine size
(1,205,388 B vs 649,548 B), ≈40 % speed, exactly **one** suspension in flight, and no nested asyncified
functions or `import`; each instance needs its own WASM module.
**Correction applied.**

### D-10 — no Cloudflare Workers loader branch — MISSING

**Where:** §9.3.
**Reality:** Workers forbid `eval`, `new Function`, `WebAssembly.compile`, `compileStreaming`,
`instantiate(buffer)` and `instantiateStreaming`. The only working path is to import the `.wasm` as a
module and construct the variant with `newVariant({ wasmModule, wasmSourceMapData })`. Budgets: 64 MiB
bundle, 128 MB per isolate including WASM, 10 ms CPU free / 5 min paid. `setMemoryLimit` has an open
regression (issue #255) and CPU interruption stays cooperative while guest JS runs.
**Correction applied:** a Workers loader branch plus the budget numbers were added.

### D-11 — `pnpm build:all` does not exist — FAIL

**Where:** line 836.
**Reality:** S0 defines the script as `"build"` (S0 line 131); there is no `build:all` anywhere.
**Correction applied.**

### D-12 — two gate items in §12 are not implemented anywhere — MISSING

**Where:** §12 items 8 and 9.
**Reality:** "coverage floor on `core` (80 % lines), enforced" and the "`<10 kB` min+gzip" bundle-size
report have no implementation: S0 installs no `@vitest/coverage-v8`, sets no thresholds, and there is no size
tooling — zero size-related hits across both plans. S0's "what S0 deliberately does not do" section confirms
the coverage floor was consciously deferred.
**Correction applied:** §12 now marks both items as deliberately deferred (S0), consistent with S0's own
scope statement, instead of listing them as present gates.

### D-13 — pack-smoke target — FAIL

**Where:** §12 item 6.
**Reality:** S0's `pack:smoke` does not use `examples/node-script`; it packs to a temp directory, installs
the tarballs into a throwaway consumer and runs `check.mjs`.
**Correction applied.**

### D-14 — LOC table label and file count — IMPRECISE

**Where:** lines 856, 852-870 region.
**Reality:** every one of the table's 17 values was re-derived from the pinned checkout and **all are
correct** — they are the **non-blank** line counts (e.g. `local_python_executor.py` 1556 non-blank vs 1768
total; `agents.py` 1625 non-blank). Only the column heading was unlabelled, and the prompt row said
"4 files".
**Correction applied:** the column is labelled "non-blank lines (pinned commit)" and the prompt row reads
"3 files".

### D-15 — S3/S4 scope overlaps S1 — IMPRECISE

**Where:** §14 lines 879-880.
**Reality:** S1 Task 11 already defines the `tool()` declaration surface and S1 Task 12 already defines the
`CodeExecutor` contract, while §14 lists "`tool()`" under S3 and "CodeExecutor contract" under S4.
Both are true under a "interface in S1, implementations and ecosystem in S3/S4" reading, which the table did
not state.
**Correction applied:** S3/S4 rows now say interface in S1; implementations/ecosystem in S3/S4.

### D-16 — parity suites and CI matrix — PASS, with additions

**Where:** lines 815, 818.
**Verified:** all seven parity suite names exist upstream (`test_agents`, `test_memory`,
`test_monitoring`, `test_utils`, `test_tools`, `test_final_answer`, `test_types`), and the
event union in the design's §6.3 matches S1 Task 4 exactly (19 variants, zero field diffs).
**Correction applied:** the matrix now names Node 22/24/26, and names the browser provider package
`@vitest/browser-playwright` rather than the deprecated `@vitest/browser`-only setup.

### D-17 — `z.ZodTypeAny` is deprecated — FAIL

**Where:** lines 625, 629, 643.
**Reality:** Zod marks it "`@deprecated Use z.ZodType (without generics) instead`".
**Correction applied** in the design and in S1 (lines 2309, 2321, 2330, 2340).

### D-18 — Zod→JSON-Schema edge cases — MISSING

**Where:** §6.7 / §9.3.
**Reality:** `z.toJSONSchema` emits `$schema` by default; `additionalProperties: false` is emitted in output
mode but **not** in `{io:"input"}` mode (strict OpenAI-style provider schemas require it to be added
explicitly); it **throws** on unrepresentable types such as `z.bigint()`. Separately, guest→host marshalling is
explicit: `context.dump()` is best-effort and falls back to `toString()`, with `encodeBinaryJSON` /
`decodeBinaryJSON` available for faithful values.
**Correction applied** to the design (§6.7 and §9.3) and to S1's `toSpec()`.

### D-19 — vocabulary divergences vs upstream — MISSING

**Where:** §14.
**Reality:** several names deliberately differ from upstream and were undocumented, which will bite anyone
diffing the two codebases or porting tests:
| ours | upstream |
|---|---|
| base class `AgentStep` | base class `MemoryStep` |
| `AgentTimeoutError` (no counterpart) | sibling omitted: `AgentToolExecutionError` |
| `RunResult.state = "max_steps_reached"` | `"max_steps_error"` |
**Correction applied:** a divergence table was added to §14.

### D-20 — upstream renders callable signatures; we render a schema list — MISSING

**Where:** §6.8 / S1 Task 8 / S1 Task 11.
**Reality:** upstream injects each tool into the prompt through `Tool.to_code_prompt()`, which renders a
**callable function signature plus docstring** (`def name(arg: type) -> ret:`). Our
`ToolRegistry.renderDescriptions()` emits a schema-derived bullet list
(`- name: description` / `  Arguments: city (string, required): ...`). Both are defensible, but the
difference is a real dialect divergence: a signature teaches the model the *call shape*, a schema list teaches
it the *fields*. This is also why the upstream prompt can use a Jinja loop where we pass a pre-rendered
string.
**Correction applied:** the divergence was documented in §6.8, and S1 Task 11 now notes that
`renderDescriptions()` is the analogue of `to_code_prompt()` rather than a port of it.

---

## 4. S0 foundations plan, part by part

### S0-1 — `vitest.workspace.ts` + `defineWorkspace` no longer exist — FAIL

**Where:** Task 5 Step 1 (lines 569, 572-578), and the tree at line 44.
**Claim as written:** `import { defineWorkspace } from "vitest/config"; export default defineWorkspace(["packages/*"]);`
**Reality:** `defineWorkspace` was deprecated in Vitest 3.2 and **removed in 4.0.0**; in current Vitest the
`vitest/config` entry exports only `defineConfig` and `defineProject`. Current stable is **5.0.4**.
The replacement is a single root config using the `projects` array; per-package configs use
`defineProject`.
**Correction applied:** Task 5 Step 1 creates `vitest.config.ts` with
`defineConfig({ test: { projects: ["packages/*"] } })`, pins `vitest ^5`, and adds a per-package
`vitest.config.ts` with an explicit `name` (see S1-1). Vitest 5 requires Node ≥22.12 and Vite ≥6.4
as a required peer, so `vite` is added to the root devDependencies explicitly.

### S0-2 — `engines.node` — IMPRECISE

**Where:** line 129.
**Reality:** `">=22"` understates the dev floor that the toolchain imposes (Vitest 5 needs ≥22.12). For
*published* packages a loose floor is defensible; for the repo it is not.
**Correction applied:** the root `engines` reads `">=22.12"` and the published packages keep `">=22"`
with the dev floor documented.

### S0-3 — `typescript ^5.7.0` is two majors behind — FAIL

**Where:** line 152.
**Reality:** npm `typescript` latest is **7.0.2** (the native Go port, announced 2026-07-08, language
unchanged); **6.0.0** shipped 2026-03-23. TS 6 changed the default of `types` to `[]` — which this config
already sets explicitly, so it is forward-compatible. TS 6 also deprecates `moduleResolution: "node10"`
(TS5107), which we do not use.
**Correction applied:** the pin moves to `^6.0.0` with a note that 7.x is the Go port and is safe to adopt
once the toolchain is verified against it.

### S0-4 — ESLint 9 + deprecated `tseslint.config()` — IMPRECISE

**Where:** lines 148, 400, 403.
**Reality:** ESLint's current major is **10.12.0**; `typescript-eslint 8.71.2` declares
`peerDependencies: eslint ^8.57.0 || ^9.0.0 || ^10.0.0`, so 10 is supported. `tseslint.config()` still
exists but is annotated `@deprecated` in favour of core `defineConfig()` from `eslint/config`.
`tseslint.configs.recommended` **is** an array, so the existing spread is correct.
**Correction applied:** the pin moves to `eslint ^10` (keeping typescript-eslint ^8), and the config uses
`defineConfig` with `extends: [js.configs.recommended, tseslint.configs.recommended]`.

### S0-5 — Changesets majors — FAIL

**Where:** lines 145, 756.
**Reality:** `@changesets/cli` is now major **3** (3.0.3, 2026-09-14) and depends on
`@changesets/config@^4.0.1` — the two are no longer the same major. The pinned schema URL
`https://unpkg.com/@changesets/config@3.0.0/schema.json` still resolves and is a valid JSON Schema, but it is
stale: `changeset init` writes the schema of the installed config version.
`"changelog": "@changesets/cli/changelog"` is **valid** — it is the documented and schema default.
**Correction applied:** `@changesets/cli ^3.0.0` and the schema URL
`https://unpkg.com/@changesets/config@4.0.1/schema.json`.

### S0-6 — `dependency-cruiser ^16.0.0` — IMPRECISE

**Where:** line 147.
**Reality:** current is **18.6.0** (2026-10-11), actively released. All S0 sub-claims about the tool hold:
`.dependency-cruiser.cjs` is auto-discovered (correct extension under `"type":"module"`), the
`forbidden/allowed/required` shape is unchanged, and `dependencyTypes` still includes
`core`/`npm`/`npm-dev` (plus `type-only`).
**Correction applied:** pin → `^18.0.0`.

### S0-7 — the `attw` gate fails as written — FAIL

**Where:** lines 139, 912.
**Claim as written:** `attw --pack .` per package.
**Reality:** with an `exports`-only, `"type":"module"` package that has no top-level `main`, the
`node10` resolution mode cannot resolve the package and `attw` reports it as a resolution failure.
That is *expected* for an ESM-only package and is exactly what the `esm-only` profile exists to ignore —
without the profile the gate fails on the first run.
**Correction applied:** the script becomes
`attw --pack . --profile esm-only`, and the plan notes that bare `npx attw` must never be used because the
unscoped npm package named `attw` is an unrelated placeholder intended to prevent dependency confusion.
Verified PASS alongside it: the exports-map shape and ordering (`types` first, `default` last), the absence
of a redundant `module` field, and the `publint` rule set.

### S0-8 — all-in-one `quickjs-emscripten` — IMPRECISE

**Where:** line 687.
**Reality:** the umbrella `quickjs-emscripten` package ships every variant (≈7.5-9 MB installed). The core
package plus a single variant is ≈1.1-1.3 MB.
**Correction applied:** `quickjs-emscripten-core` plus one variant
(`@jitl/quickjs-wasmfile-release-sync` by default) is named as the dependency, with the umbrella left out.
Both package names were verified on the registry.

### S0-9 — `lib` includes DOM in the shared base — PASS, with a documented cost

**Where:** line 299.
**Verified:** `target: ES2022` + `lib: ["ES2023"]` alone leaves `AbortSignal`, `fetch`, `Response`,
`Headers`, `ReadableStream` and `structuredClone` unresolved; adding `DOM` + `DOM.Iterable` fixes all
six. `AsyncIterable`/`AsyncIterableIterator` come from ES2023 itself.
The S0 note that DOM is present *for types only*, enforced by ESLint rather than by the type system, is
accurate and deliberate. Two residual costs are now documented rather than left implicit: DOM's
`fetch`/`Request`/`Response` types are structurally incompatible with undici's, and `setTimeout`
resolves to the DOM `number` signature rather than `NodeJS.Timeout`. Every other compiler option in the
file was confirmed real and current: `verbatimModuleSyntax`, `isolatedModules`,
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `moduleDetection`, `resolveJsonModule`,
`allowJs` — none conflict with `module: "ESNext"`, and `module: ESNext` + `moduleResolution: bundler` is a
documented valid pair.
**Correction applied:** the note is extended with the two costs, and the canonical lowercase
`"bundler"` spelling replaces `"Bundler"`.

### S0-10 — the Function selector misses the bare call — IMPRECISE

**Where:** line 416.
**Reality:** `NewExpression[callee.name='Function']` is a valid esquery selector and does catch
`new Function(...)`, but not a bare `Function("...")` call, which is an equally good escape hatch.
**Correction applied:** a second selector `CallExpression[callee.name='Function']` was added.

### S0-11 — the import ban covers bare names and `node:*` — PASS

**Where:** lines 366-424, 431-467.
**Verified:** `no-restricted-imports` with `patterns[].group` is gitignore-style, so a pattern such as
`crypto/*` matches subpaths only and would **not** ban the bare specifier `"crypto"`. S0 already lists
the bare builtin names in `FORBIDDEN_CORE_MODULES` *and* the `node:*` glob, so both spellings are caught.
`no-restricted-globals` accepting `{ name, message }` objects, the `dependencyTypes: ["core"]` rule, and
`not-to-dev-dep` were all confirmed against the tools' current documentation and behaviour.

### S0-12 — licence and notice duties — PASS

**Where:** Task 2.
**Verified:** upstream ships **no `NOTICE` file**, so Apache-2.0 §4(d) propagation is not triggered and our
`NOTICE` is our own attribution artefact. §4(a) requires the licence text (kept), §4(b) requires prominent
notices on modified files (the ported TypeScript files should carry an origin header —
`docs/attribution.md` covers §4(c)). Upstream also has **no** JavaScript or TypeScript signal at all, so the
port duplicates no official work; it does overlap the third-party `smolagents.js` on npm and
`@samrahimi/smol-js`.

### S0 — additional findings introduced by the corrections

- **Runtime-matrix honesty.** Running the *test runner* under Bun and Deno (`pnpm test` with Bun,
  `deno run -A npm:vitest run`) proves that Vitest can execute there, not that the *library* is
  isomorphic. It is also the fragile path, since Vite leans on Node APIs. The plan now runs a small
  built-artefact smoke script (`scripts/runtime-smoke.mjs`) under Bun and Deno instead, which is a direct
  test of the tier-1 claim.
- **`types: ["node"]` in `packages/core/tsconfig.json` applies to `src`, not only to `test`.** The
  surrounding note claims it is "needed only so the *test* directory can use `node:child_process`", but the
  option is directory-wide, so Node globals typecheck inside `core/src` as well. The ESLint rules still
  catch runtime use, so this is a defence-in-depth gap, not a hole. The plan now splits
  `tsconfig.test.json` so `src` stays free of Node types.
- **`execFileSync` with `shell: true` and an argument array** in `scripts/pack-smoke.mjs` triggers Node's
  DEP0190 deprecation. The script works, but the plan now resolves the `.cmd` shim explicitly instead of
  relying on `shell`.
- **The `react` package has no React dependency yet.** S0's placeholder source imports nothing, so the
  build passes; the moment real JSX lands the `dts` step will need `react` + `@types/react`. The plan now
  says so at the point where it will bite rather than leaving it to be rediscovered.

---

## 5. S1 core-runtime plan, part by part

### S1-1 — `--project core` needs an explicit project name — IMPRECISE

**Where:** four occurrences.
**Reality:** with `projects: ["packages/*"]` the auto-generated project name is the package name, i.e.
`@smolagents-ts/core`, not `core`. `--project core` would resolve to nothing.
**Correction applied:** each package's `vitest.config.ts` sets `defineProject({ test: { name: "core" } })` and
friends.

### S1-2 — the `zod@^3` hedge contradicts S0 — FAIL

**Where:** lines 2128, 2373.
**Reality:** S0 already pins `"zod": "^4.0.0"`. Carrying a v3 fallback in S1 invites the implementer to
write against an API surface the repo does not have.
**Correction applied:** the hedge is removed.

### S1-3 — `toSpec()` output and strict provider schemas — IMPRECISE

**Where:** line 2361.
**Reality:** `z.toJSONSchema(schema, { io: "input" })` does not emit `additionalProperties: false`, which strict
OpenAI-style function-calling schemas require, and it emits `$schema` which most providers ignore or reject.
Verified: `z.toJSONSchema`, the `{io:"input"}` option and Standard Schema compatibility all exist in Zod 4;
TS ≥5.5 is required; the S0 pin `^4.0.0` resolves to a current 4.x.
**Correction applied:** `toSpec()` adds `additionalProperties: false` and strips `$schema`.

### S1-4 — Task 8's prompt fidelity vs the design's promise — FAIL

**Where:** Task 8, lines 1555-1600 region.
**Reality:** see D-5. The template is a good start but the design *promised* verbatim fidelity, and upstream's
prompt carries six worked examples and eleven rules. Two upstream rules have no direct JS analogue
(rule 9's "you can use imports ... from this list" — the QuickJS guest has no `import`) and one is
JS-specific (never try to smuggle state through a closure that does not survive the block).
**Correction applied:** the design's promise is now a faithful re-authoring, and Task 8 gains a fidelity
checklist plus a golden snapshot test of the rendered system prompt, so drift is visible in review rather
than discovered in a bad run.

### S1-5 — Task 14 edits a file its Files block does not list — FAIL

**Where:** Task 14 Step 6.
**Reality:** the step amends the design document's middleware signature, but the design document is absent
from the task's Files block, so the task cannot be executed as written.
**Correction applied:** the path is added to the Files block. The underlying correction is still pending as
an edit: design §5.5(a) currently types the middleware continuation as `next: () => Promise<void>` while
the decided shape is a generator middleware (`yield* next()`). S1's own DoD item 9 and Task 14 Step 6 both
instruct the implementer to fix it — the edit is now applied directly instead of deferred.

### S1-6 — `crypto.randomUUID` secure-context comment — IMPRECISE

**Where:** line 473.
**Reality:** `crypto.randomUUID` is exposed only in secure contexts in browsers (HTTPS or localhost); the
comment overstates availability. Node, Bun and Deno expose it unconditionally.
**Correction applied:** the comment now says secure-context-only in browsers, with a fallback noted.

### S1-7 — Task 12 is the contract only — IMPRECISE

**Where:** Task 12 vs design §14.
**Reality:** the design's §14 lists "CodeExecutor contract" under S4 while S1 Task 12 defines it. Both are
supportable under the interface/implementation split, which §14 did not say. See D-15.
**Correction applied:** consistent wording in both documents.

### S1 — verified PASS without change

- **Event union.** The design's §6.3 event union and S1 Task 4's union agree exactly: 19 variants, zero field
  differences. Deltas are per-chunk and advisory; `*.completed` carries the authoritative value; exactly one
  `usage.updated` per model turn.
- **Test-count arithmetic.** Every claimed count reconciles: T1 3+13, T7 10→12, T8 9, T10 9+9, T11 3+6+8,
  T16 7+10, T19 51+2.
- **Prompt-template behaviour.** `populateTemplate` correctly has no `strict` parameter (upstream has
  none) and passes non-identifier or unterminated placeholders through untouched, which is the right choice
  for JavaScript source in template strings.
- **Task ordering.** Every file a task imports exists by the time the task runs; S0 has 8 tasks and S1 has 19,
  numbered sequentially. No reordering is needed.
- **Marshalling.** `context.dump()` is correctly treated as best-effort with `encodeBinaryJSON`/`decodeBinaryJSON`
  as the faithful path.

---

## 6. Things no document mentioned (the "did we miss anything" list)

### N-1 — `getServerSnapshot` is missing from the `AgentSession` contract — MISSING

Next.js server components are tier 1 and the design explicitly targets them. React's
`useSyncExternalStore` requires a third argument, `getServerSnapshot`, for server rendering; without it,
any hook rendered on the server throws, and hydration mismatches appear if the server snapshot differs from
the client's first snapshot. The design specifies only `getSnapshot` and `subscribe`. The snapshot used
during SSR must be the *initial* snapshot, not live state.
**Recommended fix:** mandate `getServerSnapshot` in the L1 contract and document that it must return the
initial snapshot.

### N-2 — async iteration over `ReadableStream` is not in ECMA-429 — MISSING

The design lists `ReadableStream` and async iteration as allowed API. Async iteration *of a stream*
(`for await (const chunk of response.body)`) reached browsers only recently (Chrome 124, Firefox 119,
Safari 17.4) and is not part of the minimum common API. A stream that typechecks under `DOM` may still
throw `TypeError: body is not async iterable` on a browser from 2023.
**Recommended fix:** core reads streams through `getReader()`, and the design states the browser floor for
anything that does not.

### N-3 — the "ECMA-429" guarantee has no runtime test — MISSING

The plans assert ECMA-429 conformance but never test it. A cheap, honest check is a tiny axiom probe that
touches only the allowed API surface and runs in the CI matrix; without it D7 remains an assertion.
**Recommended fix:** add the probe to the S1 boundary task.

### N-4 — the runtime matrix proves the runner, not the library — MISSING

See S0 additional findings: Bun/Deno CI currently exercises Vitest rather than the built artefact.

### N-5 — no middleware story for the model phase — known, worth restating

Middleware wraps action execution only; wrapping the model phase is S1.5. This is recorded in the plans and
is not a defect, but it is the most likely early feature request, so it should be visible in the README
roadmap rather than only in the decision log.

---

## 7. Decisions the user must make

1. **Prompt fidelity (D-5 / S1-4).** Either accept a faithful-but-shorter re-authoring (cheaper to review,
   more risk of model-quality regression) or commit to porting all six upstream examples and all eleven
   rules into the JavaScript dialect. The recommendation is the latter: the prompt is the single largest
   determinant of agent reliability, and the examples are the part that teaches the format.
2. **Bundler (S0).** `tsup 8.5.1` is current and un-deprecated but low-activity (last release 2025-11-12,
   last commit 2026-05-05). `tsdown 0.23.1` is the actively maintained Rolldown-based successor, still pre-1.0,
   requiring Node `^22.18 || ^24.11 || >=26`. Recommendation: keep tsup 8 for S0 and revisit at S6.
3. **TypeScript major (S0-3).** `^6` is the conservative current major; `7.0.2` is the native Go port with an
   unchanged language. Recommendation: `^6.0.0`, verified against 7 before S6.
4. **ESLint major (S0-4).** `^10` is current and supported by typescript-eslint 8. Recommendation: adopt 10.
5. **Node 22 floor lifetime (D-3).** Recommendation: keep, time-boxed to April 2027, with Node 26 in CI.

---

## 8. Sources used

- Ecma International TC55 — ECMA-429 "Minimum common web API", 1st ed., December 2025.
- Node.js release schedule (Node 22/24/26 LTS and EOL dates).
- `https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html`,
  `https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html`,
  `https://www.typescriptlang.org/tsconfig/lib.html`,
  `https://www.typescriptlang.org/tsconfig/module.html`,
  `https://www.typescriptlang.org/tsconfig/target.html`,
  `https://www.typescriptlang.org/tsconfig/types.html`,
  `https://www.typescriptlang.org/tsconfig/extends.html`,
  `https://www.typescriptlang.org/tsconfig/jsx.html`,
  `https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html`,
  `https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html`,
  `https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html`,
  `https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html`,
  `https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/`.
- `https://github.com/microsoft/TypeScript/issues/2249` (no decorators on function declarations),
  `https://github.com/microsoft/TypeScript/issues/36049`.
- `https://publint.dev/docs/cli`, `https://publint.dev/rules`.
- `https://www.npmjs.com/package/@arethetypeswrong/cli` and the attw CLI README;
  `https://www.npmjs.com/package/attw` (the placeholder package to avoid).
- `https://www.npmjs.com/package/tsup`, `https://github.com/egoist/tsup/issues/1391`,
  `https://tsdown.dev/guide/migrate-from-tsup`.
- `https://github.com/changesets/changesets/blob/main/docs/config-file-options.md`,
  `https://unpkg.com/@changesets/config@4.0.1/schema.json`.
- `https://typescript-eslint.io/getting-started/`,
  `https://typescript-eslint.io/packages/typescript-eslint/#config-deprecated`.
- `https://eslint.org/docs/latest/rules/no-restricted-imports`,
  `https://eslint.org/docs/latest/rules/no-restricted-globals`,
  `https://eslint.org/docs/latest/rules/no-restricted-syntax`.
- `https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md`.
- `https://nodejs.org/api/packages.html` (conditional-exports ordering).
- `https://github.com/nodejs/undici/issues/1943`, `https://github.com/microsoft/TypeScript/issues/60464`
  (DOM vs undici type conflicts).
- GHSA-99p7-6v5w-7xg8 / CVE-2026-22709 (the vm2 sandbox escape cited as prior art).
- The pinned upstream checkout `smolagents@96f33fa`: `prompts/code_agent.yaml` (174-line system prompt,
  20 Jinja tags), `agents.py:102` (`populate_template`), the three-file prompt directory, the
  `FinalAnswerException extends BaseException` mechanism, and the seven parity suites.

## 9. Bottom line

Nothing in the three documents was found to be **directionally** wrong: the architecture, the layering, the
decision set and the task ordering all survive validation. What validation did find is a consistent
pattern of **version drift** (TypeScript, ESLint, Changesets, dependency-cruiser, Vitest, QuickJS package
choice), **three hard errors that would have stopped a first run** (`defineWorkspace` removed,
`executePendingJob` misnamed, the `attw` gate failing by default), **one standards conflation**
(ECMA-262 language vs ECMA-429 API), and **one substantive quality gap**: the port of upstream's prompt and
template machinery is described as a verbatim port when it is a well-chosen subset, and the prompt itself
carries materially less guidance than the original. All of the mechanical items have been corrected in
place; the prompt-fidelity item is the one that needs the user's call before S1 Task 8 is executed.

---

## 10. Addendum — findings discovered while applying the corrections

These surfaced during the correction pass rather than during the original validation sweep.

### A-1 — `resolveName` contradicted its own comment — FAIL (corrected)

In S1 Task 11 the doc comment said the tool name "defaults to the input schema's **title**", but the code read
`schema.description`, and the design's ToolDefinition comment repeated the "title" claim. Zod exposes
`.description` as a getter; there is no `.title` property to read. With a prose description such as "Get the
current weather", the identifier guard rejects it, so the default effectively never fires and the name is in
practice **required**. Corrected: the comment now describes the description default, and both the design and the
plan say plainly that the name should be treated as required because a prose description is almost never a valid
JavaScript identifier. This is a documentation fix; the behaviour was already correct.

### A-2 — `parseCodeBlocoks` typo — IMPRECISE (corrected)

The design's §6.2 pseudo-code called the parser `parseCodeBlocoks` (and labelled it "ported verbatim"). Fixed to
`parseCodeBlocks` and re-labelled, since the parser is re-expressed from upstream's regex rather than copied.

### A-3 — the ESLint Function rule needed the call form — IMPRECISE (corrected)

`no-restricted-syntax` with only `NewExpression[callee.name='Function']` leaves the bare
`Function("...")` call legal, which is the same escape hatch. A second selector was added. The remaining known
gap is that neither selector catches aliasing (`const F = Function; F("...")`), and `no-restricted-globals`
catches that name regardless, so the pair is adequate.

### A-4 — the gate list and the plan now agree

The design's section 12 listed two gates (coverage floor, bundle-size report) that no task implemented, and
pack-smoke did not match its description. All three are now reconciled in one direction or the other: the two
deferred gates say so explicitly, and the pack-smoke description matches `scripts/pack-smoke.mjs`.

### A-5 — what was *not* changed, and why

- **The event union, the layer model, the `CodeExecutor` seam, the schema-first tool contract and the task
  ordering** were all re-checked and left alone: they are internally consistent and externally defensible.
- **The upstream LOC table** was left numerically untouched. Every value is correct; only the heading was wrong,
  and the heading is now labelled.
- **The prompts-as-TypeScript-constants decision** was left alone. It is a deliberate divergence from upstream's
  YAML and it is the right call for a bundler-first library, provided the fidelity checklist in S1 Task 8 is
  honoured.
- **`vitest.workspace.ts` was not replaced with a hand-rolled runner.** The root `projects` config is the
  supported replacement, and the per-package `name` is what makes `--project core` work.

## 11. Change summary

| document | before | after |
|---|---|---|
| `docs/design/2026-10-12-smolagents-ts-v1-design.md` | 919 lines | 1002 lines |
| `docs/plans/2026-10-12-s0-foundations-plan.md` | 991 lines | 1115 lines |
| `docs/plans/2026-10-12-s1-core-runtime-plan.md` | 6050 lines | 6096 lines |
| `docs/research/validation-report.md` | — | this file |

All three documents remain fence-balanced with no unresolved placeholders or section marks. Nothing in this pass
touched implementation code; the pinned upstream checkout, `reference/vercel-eve/` and every workspace router
file are unchanged.

---

## 12. Findings that surfaced only when the corrections were written out

Fixing the documents is itself a review. Three more defects appeared while drafting the faithful prompt port,
and none of them were visible in the original pass. All three are now fixed.

### A-6 — managed agents were missing from the whole plan — MISSING (documented as deferred)

Upstream's `MultiStepAgent` accepts `managed_agents`: each managed agent is exposed to the model as a
callable tool, and the system prompt carries a dedicated section describing them. S1's nineteen tasks never
mention the feature, and the design had no deferral entry either — it was silently absent rather than
deliberately out of scope, which is exactly the failure mode R3 claims to prevent ("deferred modules are named
in section 13, not silently dropped"). The design now names it in section 5.1 as deferred to S2, and records the
one pre-rendered `{{managedAgents}}` variable the prompt will gain at that point. Decision: deferred, not dropped.

### A-7 — guest state across steps was never specified — FAIL (decided)

The prompt's rule 10 says "the state persists between code executions", and upstream can say that because its
Python interpreter is created once per run. The plan never stated whether our guest behaves the same way, and
S1's `CodeExecutor` interface carried no lifetime semantics at all — `execute(code, options)` plus an optional
`dispose()`, with nothing about what a second call may assume. That is a hole a prompt cannot paper over: the
same interface would have supported either a persistent guest or a fresh context per step, and the two demand
opposite instructions to the model. Resolved as **D14**: one executor instance serves one agent run, state
persists across `execute()` calls, `dispose()` releases the guest at run end. Task 8's rule 10 and Task 12's
contract comment now both state it.

### A-8 — the ported rule 3 contradicted the plan's own tool-call form — FAIL (corrected)

The first draft of the fidelity checklist translated upstream's rule 3 literally: "DO NOT pass the arguments as a
dict … use the arguments directly". Translated into "never pass a single object literal", that contradicts every
other line in the plan, where the model writes `await get_weather({ city: "Paris" })` and the registry calls
`definition.execute(args, toolContext)` with one object. The rule was written for Python, where tools take keyword
arguments; JavaScript has none, so the object literal *is* the argument list. The JS rule now demands exactly one
object literal whose keys are the declared parameter names, and forbids positional arguments and an extra
wrapping object — the real failure mode the upstream rule was guarding against.

### Decision status after this pass

| item | status |
|---|---|
| prompt fidelity | **decided by the user** — full port of all six examples and all eleven rules, written into S1 Task 8 with a fidelity test |
| guest state across steps | **recommended default applied** (D14, persist within a run); reversible with a two-file edit if the user prefers a fresh context per step |
| managed agents | **recommended default applied** (deferred to S2, now named in the design); reversible by adding a 20th S1 task |
| upstream example count | corrected from "eight" to **six** in all three documents — the original pass overstated it, which is noted here rather than quietly fixed |

S1 is now 6257 lines across 19 tasks plus the definition of done; the design is 1013 lines; S0 is 1139.

---

## 13. Findings from executing S0 Task 1

Task 1 was the first task to touch a real toolchain, and it produced problems that document review had not
surfaced. Both are corrected in the plan. Neither is a defect in the library design itself.

### A-9 — pnpm 12 ignores every `.npmrc` setting except auth and registry — FAIL (corrected)

The plan had Task 1 create an `.npmrc` holding `strict-peer-dependencies=true`,
`auto-install-peers=false` and `prefer-frozen-lockfile=true`. Under pnpm 12 that file is inert: pnpm's
settings page states that only auth and registry settings are read from `.npmrc` files, and that all
other settings live in `pnpm-workspace.yaml` or the global `config.yaml`.

The evidence was in the tree before anyone read the documentation. `pnpm-lock.yaml` recorded
`settings.autoInstallPeers: true` — the opposite of what the file asked for — and
`pnpm config get auto-install-peers` returned `undefined`. The plan now has no `.npmrc` at all: the
three settings live in `pnpm-workspace.yaml` in pnpm's camelCase form (`strictPeerDependencies`,
`autoInstallPeers`, `preferFrozenLockfile`), and a new verification step asserts the effective values,
because the failure is otherwise silent.

This is the sharper kind of documentation defect: the plan's text was plausible — written from npm-era
practice — and wrong only in combination with the exact package manager version that the same plan pins.

### A-10 — a non-interactive `pnpm install` mutates the checked-in workspace file and exits 1 — FAIL (corrected)

pnpm 11+ defaults `strictDepBuilds` to true and refuses to run a dependency's build script unless the
package is named in `allowBuilds`. For a non-interactive install pnpm does not prompt: it appends a literal
placeholder, `allowBuilds:` / `esbuild: "set this to true or false"`, to the checked-in
`pnpm-workspace.yaml`, and exits 1 with `ERR_PNPM_IGNORED_BUILDS`. Task 1's install step had expected
exit code 0 and no error output, so the plan's own verification step would have failed on a correct
implementation.

The consequence is worse than a dirty worktree: a checked-in file changes on every install, so a CI run that
treats a non-zero install as fatal breaks on a machine nobody had touched. The plan now names esbuild in
`allowBuilds` explicitly. The esbuild install script only validates the install — the prebuilt
`@esbuild/win32-x64/esbuild.exe` arrives as an optional dependency and runs without it, confirmed by
executing it (`esbuild.exe --version` → `0.27.7`) — so recording `esbuild: true` keeps the tree
clean honestly, rather than suppressing the signal with `dangerouslyAllowAllBuilds`.

### A-11 — the install step expected TypeScript 5 — FAIL (corrected)

Task 1's verification said `pnpm exec tsc --version` should print `Version 5.x.x`, while the same task
pinned the dependency range to `^6.0.0`. The install resolves 6.0.3. The stale expectation was corrected,
and it is the reason the plan now states resolved versions rather than major-version guesses.

### A-12 — a correction recorded as applied had reached only one of its two targets — FAIL (corrected)

Section 5 records S1-2, the `zod@^3` hedge, as removed — and it was removed from S1. It was left in place
in the design, whose canonical `package.json` for the published umbrella still read
`"dependencies": { "zod": "^3.25.0" }`. That contradicts S0 Task 6's `"zod": "^4.0.0"` and the
Zod 4-only API S1 depends on: `z.toJSONSchema` does not exist in Zod 3.

A correction recorded as applied is more dangerous than one not yet made, because the report asserted the work
was done and nobody would look again. Both documents now read `^4.0.0`.

What the same scan did not find, recorded so the negative result is not mistaken for an omission: the umbrella's
`"engines": { "node": ">=22" }` is a deliberate loose floor for *published* packages — S0-2 keeps `>=22.12` as
the repository floor — and the React peer floors (`>=18`) are intentionally permissive.
### Consequence for both plans

Neither plan stated where pnpm configuration lives, and the design's stack section does not mention it.
Settings now sit in the file pnpm actually reads, and S0 Task 1 verifies the effective values instead of
trusting a file's presence.
