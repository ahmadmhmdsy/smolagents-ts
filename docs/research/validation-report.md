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
`not-to-dev-dep` were all confirmed against the tools' current documentation and behaviour — **but A-37 later
measured that this one goes blind once per-package manifests exist, and Task 4R replaces it**.

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
### A-13 — a verbatim copy would have imported CRLF, and the stated check could not have caught it — FAIL (corrected)

This is A-11's shape again: a verification step that cannot fail. Task 2 Step 1 copied the upstream LICENSE and
verified that it "begins with Apache License" and "Version 2.0, January 2004".

The upstream clone has `core.autocrlf=true`, so its working-tree LICENSE is CRLF — 201 CR characters,
11558 bytes — while the blob committed upstream is LF: 0 CR characters, 11357 bytes. The copy would have
imported 201 CRLF lines into a repository whose `.editorconfig` mandates LF, and the stated check would
have passed, because the first line reads the same either way.

Measured, not assumed: `git hash-object` gives `29f81d812f3e768fa89638d1f72920dbfd1413a8` for the
working-tree copy and `261eeb9e9f8b2b4b0d119366dda99c6fd7d35c64` for the blob. `git archive` was tried as a
shortcut and is not a fix either — it applies the same conversion, yielding the CRLF hash again. The plan now
normalises after copying and verifies `git hash-object LICENSE` against
`git -C smolagents rev-parse HEAD:LICENSE`, which is a check that can actually fail.

The same pass adds `.gitattributes` (`* text=auto eol=lf`) to Task 2. `.editorconfig` is advisory: it
constrains editors, not commits. Without a git-level policy the repository has no defence against the exact
condition the upstream clone exhibits. Recorded here because neither plan mentioned line endings or
`.gitattributes` at all, and the omission stayed invisible until a copy step was actually attempted.
### Consequence for both plans

Neither plan stated where pnpm configuration lives, and the design's stack section does not mention it.
Settings now sit in the file pnpm actually reads, and S0 Task 1 verifies the effective values instead of
trusting a file's presence.

### A-14 — Task 3 created a file it did not commit, and verified a config that had no inputs — FAIL (corrected)

Both defects were found by running Task 3's commands against the installed TypeScript 6.0.3 rather than by
reading them.

1. Step 2b creates `packages/core/tsconfig.test.json`, but the Files list omits it and Step 4's `git add` omits
   it too. The file would never be committed, while Task 6's `typecheck` script is
   `tsc --noEmit -p tsconfig.test.json` — so the repository gate would fail in a fresh clone of a tree that was
   green locally. The file is now listed and staged.
2. Step 3 ran `tsc --showConfig -p packages/core/tsconfig.json` and expected exit code 0. Measured: **exit 1,
   `error TS18003: No inputs were found in config file ... Specified 'include' paths were '["src"]'`** —
   `packages/core/src` is not created until Task 6, so the check could not pass at the point it was written.

The obvious repair, seeding `packages/core/src/index.ts` in Task 3, would break Task 4: its architecture test
deliberately asserts that dependency-cruiser fails while `packages/core/src` is absent. The plan therefore
verifies the shared base against a throwaway `.tmp-tscheck` probe that is deleted again, plus a JSON-parse
check of both package configs, and defers the input-dependent check to Task 6's gate.

Measured in the same pass, so that it is not assumed: `declaration: true` together with `noEmit: true` is
accepted by TypeScript 6.0.3 (no diagnostic was reported), and `tsconfig.test.json` requires `@types/node` or
it fails with `TS2688: Cannot find type definition file for 'node'`.

### A-15 — Task 4's red test would have failed for the wrong reason — FAIL (corrected)

Task 4 Step 5 ran `pnpm vitest run --project core architecture` and expected a FAIL caused by
dependency-cruiser rejecting a `packages/core/src` that does not exist yet. But the root `vitest.config.ts` and
the per-package project configs are created in Task 5, and Task 4 comes first. Measured without them:

```
Error: No projects matched the filter "core".   (exit code 1, test never executed)
```

The step would have been marked satisfied by an exit code produced before any test ran, so the red state it
was meant to establish would not have existed. This is A-11's and A-13's shape inverted: not a check that
cannot fail, but a failure that proves nothing. The step now invokes the test file by path, which was measured
to work with no vitest config present, and it states explicitly why `--project core` must not be used there.

### A-16 — Task 6 under-counted and under-specified its own files — FAIL (corrected)

Task 6's Files block lists six files per package, but Step 6 called them "the same five files", and no step gave
the contents of `vitest.config.ts` and `tsup.config.ts` for the four non-core packages: Task 5 writes those two
files for core only. An implementer would have had to infer both the count and the contents.

The table now carries an explicit vitest project name for each package and states that each config is core's
with only that name, or the external array, changed. Measured while checking this: a project is resolvable by
`--project <name>` only when its config sets that `name`, and Task 6 Step 5's `--project core` therefore depends
on Task 5 having created the root config first.

### A-17 — the controller validated a recipe it had retyped, not the one it wrote — FAIL (process, corrected)

Task 3 Step 3's probe writes `.superpowers/tmp-tscheck/tsconfig.json`, and its `extends` was `../tsconfig.base.json`.
Relative to that file, `../` is `.superpowers/`, so the base config is `../../tsconfig.base.json`. As written the
probe failed `TS5083: Cannot read file '...\.superpowers\tsconfig.base.json'`: the implementer measured exit 2 where the
brief promised exit 0, refused to edit the recipe, and reported it instead.

The instructive part is how it survived review. The controller had "validated" the recipe minutes earlier by
running a hand-retyped copy of the command with `../../` already in it, so the run that returned exit 0 never
executed the text in the plan. The validation and the artifact differed by one path segment, and only the
artifact was wrong. This is A-11 and A-13 seen from the other side: not a check that cannot fail, but a check
applied to something other than the thing under test. The recipe is now the exact text that was executed when
verifying this correction, and it prints `TSC_NOEMIT_EXIT` and `TSC_SHOWCONFIG_EXIT` explicitly — without those the
block's exit code is `Remove-Item`'s, and a failing typecheck inside it would look like a passing one.

### A-18 — Task 4's ESLint configuration could not pass the gate it exists to protect — FAIL (corrected)

`eslint.config.js` applies `js.configs.recommended` to every file ESLint lints, and ESLint lints `.js`, `.mjs` and
`.cjs` by default, with no Node globals configured. Measured against that config as written:

```
.dependency-cruiser.cjs
  2:1  error  'module' is not defined  no-undef

zz-probe.mjs
  1:1   error  'console' is not defined  no-undef
  1:19  error  'process' is not defined  no-undef
  1:37  error  'URL' is not defined      no-undef
```

`.dependency-cruiser.cjs` exists from Task 4 and `scripts/*.mjs` from Task 8, so `pnpm lint` — first run at Task 6 Step 8,
then in every CI job — fails on files Task 4 itself created. Task 4 also never ran `pnpm lint` at all, so its own
defect would have surfaced two tasks later and looked like a Task 6 defect. The config now grants
`globals.node` to `**/*.js`, `**/*.mjs` and `**/*.cjs` (with the `require` rule off for `.cjs`), and Task 4 runs
`pnpm lint` as part of its verification.

Two smaller defects in the same task, the A-14 shape: `architecture-guard.test.ts` is created by Step 4 but
missing from the Files list, and the commit's `git add` line did not stage the `package.json` / `pnpm-lock.yaml` change
produced by the new devDependency.

### A-19 — CI would have installed a different package manager than the repository declares — FAIL (corrected)

Both jobs in `.github/workflows/ci.yml` pinned `pnpm/action-setup@v4` with `version: 10`, while `packageManager` in
the root package.json is `pnpm@12.3.4` — the version that wrote a pnpm-12 lockfile, and the only version under
which this repository's settings (`allowBuilds`, the camelCase keys in `pnpm-workspace.yaml`) have been exercised.
The action's `version` input overrides `packageManager`, so CI would have installed pnpm 10 and run
`--frozen-lockfile` against a lockfile produced by a later major. The input is now omitted — supported for
pnpm 11+ — making `packageManager` the single source of truth.

The step meant to catch this said "verify the workflow file is present and well-formed" and then checked only
that the file contains `name: CI`, the A-11/A-13 shape once more. It is replaced by `scripts/check-ci.mjs`, which
parses the YAML and asserts the job set, both matrices, and that every `pnpm/action-setup` step agrees with
`packageManager`; it is wired into the `gate` script so it runs locally and in CI.

### A-20 — Task 2's licence check depended on a git filter, and two of its steps had no verification — recorded

The review of Task 2 (APPROVED, no Critical) found that Step 1's `git hash-object LICENSE` is not the "raw on-disk
byte hash" the report called it: `git hash-object` applies the filters configured for the path, so once
`.gitattributes` exists a CRLF file at path `LICENSE` normalises on the way in and hashes to the same
`261eeb9e...` blob. The check was valid when it ran — Step 6 creates `.gitattributes` — but the post-commit
re-check the report cited as proof cannot fail. Step 1 now measures the bytes directly (`bytes=11357 cr=0`) as
the primary evidence. The reviewer also found that Step 4 (the attribution table) has no verification step at
all, and that Step 5's disclaimer check tests for one phrase rather than the required wording, the NOTICE
modification list and the revision string; both were checked by hand instead — 18 of 18 rows resolve against
the clone. No permanent substitute exists, because the upstream clone is absent from CI, so this is recorded
rather than gated.

### A-21 — Task 5 created three configuration files and verified none of them — FAIL (corrected)

Task 5's Files list is `vitest.config.ts`, `packages/core/vitest.config.ts` and `packages/core/tsup.config.ts`, and its only
verification was `pnpm exec tsup --version` and `pnpm exec vitest --version`. Version strings prove the tools are installed;
they do not load one line of what the task writes. The first load was Task 6's `vitest run --project core`, two
tasks later, where a broken config would have been read as a Task 6 defect — the same misattribution the brief
itself warns about for the lint config.

Measured, with the root config and one project named `core`:

- `vitest run --project core` with no test files → exit 1, `No test files found, exiting with code 1`, printing
  `projects: core`. This is a real check: a malformed root config instead reports `failed to load config`
  (esbuild `Expected identifier but found end of file`), and an unmatched name reports
  `The filter matched no projects: nope`.
- `vitest run --project nope` → exit 1, `The filter matched no projects: nope` — the negative control proving the
  filter is matched against the config rather than ignored.
- `tsc --noEmit --module esnext --moduleResolution bundler --target es2022 --skipLibCheck --types node` over the
  three config files → exit 0. A config importing a name its module does not export gives `error TS2305`,
  exit 1.

`packages/core/tsup.config.ts` cannot be loaded before Task 6 creates `src/index.ts` — its `entry` points there — so the
type-check is the only verification available in Task 5. The brief now says that instead of implying the file is
covered.

### A-22 — Task 7's `changeset init` cannot run without a TTY — FAIL (corrected)

Measured against @changesets/cli 3.0.3:

```
🦋 changeset v3.0.3
A new Changeset configuration is being initialized...
*  Should the GitHub integration be used for changelogs?
  Yes / > No
Warning: Detected unsettled top-level await at file:///.../@changesets/cli/bin.js:9
await import("@changesets/cli");
[ELIFECYCLE] Command failed with exit code 13.
```

Exit 1 (13 internally). `changeset init --help` lists only `-h, --help`, and the command builds its config
from four prompts — GitHub changelog, auto-commit, publish access, base branch — so there is no flag path. Step 1
was unrunnable as written, and the implementer would have been blocked at the first step of the task.

The step now writes the two files directly. The config is what `init` writes for "no GitHub changelog, public
access, base branch main" — read out of the installed `init.mjs`, which builds `{...defaultWrittenConfig}` with those
overrides — and `README.md` is copied from `@changesets/cli/default-files/README.md` (measured 334 bytes) rather
than retyped. `@changesets/config@4.0.1` is the installed config, so the `$schema` URL was already correct.

Step 3 was one-sided as well: `pnpm changeset status` exiting 0 on branch `main` only proves the file parsed.
Measured negative controls: invalid JSON → exit 1 with a `SyntaxError` from `readConfig`; a well-formed but
wrong value (`"access": "nonsense"`) → exit 1 with `Found issues in your config: - access: Invalid type:`
`Expected ("public" | "restricted")`. The brief now requires the invalid-JSON control and the restore.

### A-23 — the probe's second exit code measured tsc, not the assertion — FAIL (corrected)

The Task 3 reviewer found this in the recipe A-17 had just corrected, and it is the same class a third time.
`Select-String` is a PowerShell cmdlet and does not set `$LASTEXITCODE`, so:

```powershell
'TSC_SHOWCONFIG_EXIT=' + $LASTEXITCODE
```

echoed tsc's exit code. The reviewer's negative control — the correct base with `"strict": false` — printed
`TSC_SHOWCONFIG_EXIT=0` with three matches, and a config with no `strict` key at all printed `TSC_SHOWCONFIG_EXIT=0` with
zero matches. The pattern `"strict"|noUncheckedIndexedAccess` matched `"strict": false` identically, so the check
tested presence where identity was required: A-11 and A-13 reproduced inside the check written to close A-17.

The recipe now counts matches against `'"strict": true|"noUncheckedIndexedAccess": true'` and requires
`TSC_SHOWCONFIG_MATCHES=2`. Measured: correct base → `0` and `2`; `"strict": false` → `TSC_NOEMIT_EXIT=2` (plus
`TS5052`, since `exactOptionalPropertyTypes` requires `strictNullChecks`) with `TSC_SHOWCONFIG_MATCHES=1`; a bad
`extends` path → `TSC_NOEMIT_EXIT=2`, `TSC_SHOWCONFIG_MATCHES=0`.

### A-24 — Task 4's code snippets failed the lint config the same task created — FAIL (corrected)

Task 4's Step 5 required `pnpm lint` to exit 0, and the implementer measured exit 1 against the brief's own
Steps 3 and 4:

```
packages\core\test\architecture-guard.test.ts
  2:10  error  'mkdtempSync' is defined but never used  @typescript-eslint/no-unused-vars
  3:10  error  'tmpdir' is defined but never used       @typescript-eslint/no-unused-vars
packages\core\test\architecture.test.ts
  18:7  error  There is no `cause` attached to the symptom error being thrown  preserve-caught-error
```

Two unused imports were vestigial — the probe writes into `packages/core/src/__probe.ts`, not a temp directory —
and the `catch` rethrew without `{ cause: error }`. Both rules are enabled by the brief's own config:
`@typescript-eslint/no-unused-vars` by `tseslint.configs.recommended`, `preserve-caught-error` by ESLint 10's
`js.configs.recommended`. The implementer reported the contradiction and refused to work around it, which is why
it is attributed here instead of surfacing as a Task 6 gate failure.

The same measurement exposed a second gap in that config: `eslint .` does lint `.superpowers/**/*.ts`. Measured on a
probe file:

```
files linted: 5
.dependency-cruiser.cjs
.superpowers\tmp-lintprobe\bad.ts
eslint.config.js
packages\core\test\architecture-guard.test.ts
packages\core\test\architecture.test.ts
```

This plan tells every later task to build throwaway probe trees under `.superpowers/`, so `**/.superpowers/**` is
now in the config's `ignores`. Without it Task 8's gate could fail on scratch files that merely happened to
exist — a red that says nothing about the code.

### A-25 — the controller committed another agent's staged work under its own message — FAIL (controller, accepted)

While the Task 4 implementer was applying the A-24 fix, the controller patched the plan and committed the
documentation with `git add docs/... && git commit`. By then the implementer had already run
`git add eslint.config.js packages/core/test/architecture.test.ts packages/core/test/architecture-guard.test.ts` and was about
to commit. `git commit` commits the whole index, so the three code files rode into the controller's commit:

```
a0c0ee3 docs: record A-21 to A-24, the weak and impossible verification steps
 docs/research/validation-report.md            | 122 ++++++++++++++-
 eslint.config.js                              |   5 +-
 packages/core/test/architecture-guard.test.ts |   3 +-
 packages/core/test/architecture.test.ts       |   2 +-
 4 files changed, 124 insertions(+), 8 deletions(-)
```

The implementer detected the collision, refused to create an empty or placeholder commit to satisfy the
instruction, and asked for a decision instead of rewriting history. Both refusals were correct; the defect is the
controller's, and the shape was already visible in A-17 — two writers in one working tree, each assuming it owned
the commit.

Nothing is lost in content. Re-measured independently at `a0c0ee3`: `pnpm lint` exits 0 with no output, the
architecture test still fails for the genuine reason (`Caused by: ... Can't open 'packages/core/src' for reading`),
and `packages/core/src` is still absent. The blemish is that a documentation message covers three code files and
Task 4's fix therefore has no commit of its own.

Decision: accepted as written. The alternative, `--amend`, is a history rewrite, which this project forbids;
a revert-and-recommit or an empty placeholder would add a misleading commit to fix a label. The blemish is carried
into the final whole-branch review. The rule for the rest of S0 and S1: the controller does not commit while an
implementer or reviewer is working in the same tree, and when it does commit it names paths explicitly
(`git commit -- <paths>`) so a concurrent `git add` cannot ride along.

### A-26 — Task 8's negative control could not run where the plan put it — FAIL (corrected)

Task 8 Step 2 said to run `node scripts/pack-smoke.mjs` "once before `pnpm build`" to confirm the gate fails
honestly. That state no longer exists by Task 8: Task 6 Step 8 runs `pnpm build`, so all five `dist/` trees are
present and the script would simply pass. The control could not be executed where it was written.

It now moves one package's build output aside — `Move-Item packages/core/dist .superpowers/hidden-core-dist` —
requires the literal failure message (either `no tarball for core`, if `pnpm pack` refuses an empty
`files` list, or a module-resolution error from the consumer if it packs anyway), then restores it and rebuilds.
The hidden copy is under `.superpowers/`, which is gitignored, so a forgotten restore cannot be committed.

The rest of Task 8's mechanism was pre-validated against a real private scoped package instead of assumed:

- `npm ping` → `PONG 456ms`, so the consumer install has registry access here.
- `pnpm pack --pack-destination <dir>` on `@smolagents-ts/core` with `private: true` → exit 0, tarball
  `smolagents-ts-core-0.0.0.tgz`, contents `dist/index.d.ts`, `dist/index.js`, `package.json`. The brief's
  `f.includes("smolagents-ts-" + name + "-")` matcher is correct.
- `npm install <tgz>` → `added 2 packages in 4s` (the tarball plus `zod` from the registry), and the
  consumer's `import { VERSION } from '@smolagents-ts/core'` resolved.
- `pnpm exec publint --strict` on that shape → `All good!`, exit 0.
- `pnpm exec attw --pack --profile esm-only` → exit 0, `node16 (from ESM) 🟢 (ESM)` and `bundler 🟢`, with
  `node10` and `node16-cjs` ignored by the profile as intended.

So the two gate stages that had never faced this package shape are known to pass before Task 6 creates it.
### A-27 — Task 4's guard test could never pass, and it raced the test it guards — FAIL (measured, corrected)

`packages/core/test/architecture-guard.test.ts` plants `packages/core/src/__probe.ts` and then cruises that directory. Two
defects, both measured against the delivered artifact.

1. `writeFileSync` does not create parent directories, and `packages/core/src` does not exist until Task 6. At Task 4's
and Task 5's state the file is red for the wrong reason — 2 of 2 tests failed:

```
 ❯ packages/core/test/architecture-guard.test.ts (2 tests | 2 failed) 819ms
   × flags a node: import inside core/src 6ms
   × passes again once the probe is removed 811ms
Error: ENOENT: no such file or directory, open '...\\packages\\core\\src\\__probe.ts'
```

So the rule the guard exists to prove — that `core-no-node-builtins` really fires on `packages/core/src` — had
never been exercised even once.

2. `architecture.test.ts` asserts that the same directory has zero violations, and Vitest runs test files in
parallel by default. In a clone simulating Task 6's state (`packages/core/src` holding real files),
`pnpm exec vitest run --project core` failed 3 of 3 runs with the guard's own probe as the violation:

```
 ❯ |core| test/architecture.test.ts (1 test | 1 failed) 1457ms
AssertionError: expected [ { type: 'dependency', …(5) } ] to deeply equal []
+ [ { "from": "packages/core/src/__probe.ts", "rule": { "name": "core-no-node-builtins" }, ... } ]
```

That is not flakiness; it is a deterministic cross-file race, and it would have made Task 6's `pnpm test` fail
outright, for a reason unrelated to Task 6.

The fix is Task 5 Steps 2 and 3: `fileParallelism: false` on the `core` project, and a fixture that creates the
directory when missing and removes it only if the fixture created it. Measured after the fix: Task 6's state 3 of 3
green (`Tests 3 passed (3)`, exit 0); Task 5's state a deterministic 1 passed / 2 failed, both failures
`Can't open 'packages/core/src' for reading. Does it exist?`, 3 of 3 runs, no directory left behind.

Alternative considered and rejected: merging the two files so the pair runs sequentially inside one file. It would
also work and would not serialise the rest of the package's tests, but it restructures a deliverable that is already
written and under review. A one-line config plus a self-contained fixture is the smaller change, and it is measured.

### A-28 — Task 5's verification was written for a tree that no longer exists — FAIL (corrected)

Task 5's verification step asserted that `pnpm exec vitest run --project core` prints
`No test files found, exiting with code 1` "because no test files exist yet". Task 4 had already added two test files
under that project, and the same step quoted `The filter matched no projects` for the negative control. Measured
before the config files existed:

```
$ pnpm exec vitest run --project core
Error: No projects matched the filter "core".
```

and measured after them (`pnpm exec vitest run --project nope`):

```
Error: No projects were found. Make sure your configuration is correct. The filter matched no projects: nope.
```

The step now states the red it will actually see — `Test Files 2 failed (2)`, `Tests 2 failed | 1 passed (3)`,
the one pass being the guard's probe test — explains why that red is correct at this task's position, and adds the
two measurements it was missing: `pnpm lint` (exit 0 with three new config files present) and the same
`--project core` run against a clone simulating Task 6's state (exit 0, 3 of 3 runs).

A-27 and A-28 are the same shape as A-21: a verification whose stated expectation was never measured at the position
where it will run. A-27 is worse, because the expectation was also the only thing that would have revealed the race.
### A-29 — tsup's dts build cannot run under TypeScript 6 without a silence flag — FAIL (critical, corrected)

tsup 8.5.1's dts step always passes `baseUrl: compilerOptions.baseUrl || ".",` (its own dist/index.js line 6837).
TypeScript 6.0.3 turned `baseUrl` into a hard deprecation error, so every `pnpm build` failed after the ESM half had
already written `dist/index.js`:

```
DTS Build error
error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption
'"ignoreDeprecations": "6.0"' to silence this error.
Error: error occurred in dts build
```

The failure is quiet in the worst way: tsup exits 1, but `dist/index.js` and `dist/index.js.map` are already on
disk, so the build looks like it produced something while no `dist/index.d.ts` exists. Everything downstream then
fails for a reason that does not name the cause — `publint reports pkg.exports["."].types is ./dist/index.d.ts but` the
file does not exist — and Task 8's attw and pack smoke test would follow it down.

Fix, now Task 6 Step 1: add the flag the compiler itself names to `tsconfig.base.json`:

```json
    "moduleDetection": "force",
    "ignoreDeprecations": "6.0",
```

**MEASURED** in a clone with the real base config, TypeScript 6.0.3 and tsup 8.5.1: without the flag tsup exits 1 for
all five packages and emits only `dist/index.js` plus `dist/index.js.map`; with it, five `ESM Build success` and
five `DTS Build success`, each `dist/index.d.ts` 117 bytes declaring `VERSION`, `publint --strict` → `All good!`,
`attw --pack --profile esm-only` → exit 0, and `tsc --noEmit -p tsconfig.test.json` still exit 0. The alternative, pinning
TypeScript 5.x, would reverse a decision the design made deliberately.

### A-30 — Task 6's file list omitted the tsconfigs its own typecheck script needs — FAIL (corrected)

Each package's `package.json` declares `"typecheck": "tsc --noEmit -p tsconfig.test.json"`, but the Files list created
six files per package and Task 3 wrote tsconfigs for core alone. **MEASURED**: `packages/*/tsconfig*.json` on disk held
exactly `packages/core/tsconfig.json` and `packages/core/tsconfig.test.json`, and a package without its own fails:

```
error TS5058: The specified path does not exist: 'packages/models/tsconfig.test.json'.
```

`pnpm typecheck` would have failed for four of the five packages. Task 6 now creates `packages/NAME/tsconfig.json` and
`packages/NAME/tsconfig.test.json` for the four packages other than core, byte-identical to core's because both `extends`
paths are relative to the package directory. **MEASURED** in the clone: with all five in place,
`tsc --noEmit -p packages/NAME/tsconfig.test.json` exits 0 for each of them.

### A-31 — Task 6 named runtime dependencies without versions — FAIL (corrected)

The dependency table listed `quickjs-emscripten-core` and `@jitl/quickjs-wasmfile-release-sync` by name only, leaving the
implementer to invent ranges for two packages this project had never installed. Task 6 now pins both to `^0.32.0`
— the version the validation report measured (`quickjs-emscripten-core@0.32.0 is 2025-09-13+f1139494`) and still the
published latest — and repeats that `release-sync` is the design's default while asyncify is only the fallback
ladder at design §9.3. The Files list also omitted `pnpm-lock.yaml`, which Step 8's `pnpm install` rewrites and
Step 10 stages, and `tsconfig.base.json` for Step 1; both are listed now.

### A-32 — the Task 6 dry run also settled what was already right

So the record is not only defects. In a clone at Task 5's state with all five packages scaffolded:

- `pnpm exec tsc --noEmit -p packages/NAME/tsconfig.test.json` → exit 0 for all five, once A-30's files exist.
- `pnpm exec vitest run --project core` → `Test Files 3 passed (3)`, `Tests 4 passed (4)`, exit 0.
- `pnpm test` → `Test Files 7 passed (7)`, `Tests 8 passed (8)`, exit 0 — Step 7's "5 smoke tests + 3
  architecture tests" is exactly right.
- `pnpm lint` → exit 0 with five packages and three new config files in the tree.
- `pnpm depcruise` → `✔ no dependency violations found (31 modules, 20 dependencies cruised)`, the wording Step 9 expects.
- the smoke test's `import { VERSION } from "../src/index.js"` resolves under `moduleResolution: "bundler"` for both tsc
  and Vitest, so the `.js`-extension convention carries no hidden cost.
- `node -e "require('fs').accessSync(...)"` works from a `"type": "module"` root, so Step 9's artifact check is valid as
  written.
- `pnpm -r` could not be exercised in the clone: with `node_modules` reached through a junction, pnpm 12 refuses with
  `Refusing to use task run state directory at <root>\node_modules because it is a symbolic link or not a directory`.
  That is a property of the clone, not of the project; the real tree has a real `node_modules`, and Task 6 Step 8
  exercises those two recursive scripts for real.
### A-33 — Task 7's step list skipped a number and repeated its config block — FAIL (corrected)

Task 7 numbered its steps 1, 2, 4 — there was no Step 3 — and the whole `.changeset/config.json` block appeared
twice, separated by a sentence that referred to a "Step 2" that no longer existed. Both were residue from an
earlier rewrite. The commit is now Step 3 and the duplicate block is gone.

### A-34 — Task 7's claims measured true, but its empty output proves less than it looks — PASS (with note)

Measured against @changesets/cli 3.0.3: the shipped `default-files/README.md` is exactly 334 bytes;
`pnpm changeset status` exits 0 printing `Packages to be bumped:` with nothing under it; `{ not valid json`
gives exit 1 with `SyntaxError: Expected property name or '}' in JSON at position 2 (line 1 column 3)` thrown from
`@changesets/config@4.0.1`'s `readConfig`; `"access": "nonsense"` gives exit 1 with `Found issues in your`
`config: - access: Invalid type: Expected ("public" | "restricted") but received "nonsense"`; restoring the valid config returns
exit 0. The empty list is not evidence about the config: all five packages are `private: true` by design D12, and a
probe changeset naming `@smolagents-ts/core` still printed an empty list. Task 7's brief now says so, so the two
negative controls are understood as the real verification.

### A-35 — the Task 4 review found the architecture guard partly blind — FAIL (review verdict; Task 4R)

Verdict CHANGES_REQUIRED: 1 Critical, 3 Important, 4 Minor (418-line report at `.superpowers/sdd/task-4-review.md`).
The Critical (F1) is that `core-no-extra-runtime-deps` flags zod, the one dependency the rule exists to permit.
Re-measured here: dependency-cruiser resolves through the pnpm store, so a core import of zod appears as
`node_modules/.pnpm/zod@.../node_modules/zod/index.d.ts`, which the anchored exception `^node_modules/zod` cannot
match. F2, the unanchored `exclude` deleting npm edges before any rule runs, also re-measured: 32 modules and 21
dependencies with the shipped pattern, 34 and 34 with the anchored one, while our own `dist` and `coverage` modules
stay at 0 in both. Task 4R carries F1, F2, F2b, F5, F6 and F7; F3 and F4 stay with Task 5, which already plans them.

### A-36 — F5 is real, but its mechanism is narrower than "not linted" — FAIL (corrected)

The review reported that non-test `.tsx`/`.mts`/`.cts` files are "not linted at all". Measured:
`pnpm exec eslint . -f json` lists 30 files and a `packages/core/src/__probe_scope.mts` probe **is** among them; what fails
is that the core restriction block claims only `**/*.ts`, so the probe's `eval(...)` and `process.exit(...)`
produce zero messages. With `files: ["packages/core/src/**/*.{ts,tsx,mts,cts}"]` the same probe reports two
`no-restricted-globals` errors. Task 4R fixes the scope with that widening.

### A-37 — Task 6 would silently kill `not-to-dev-dep`; the rule is replaced — FAIL (Important)

Found by pre-flighting the review's F2 fix. dependency-cruiser classifies a dependency against the **nearest
package.json of the importing module** (`determine-dependency-types.mjs`: the from-module's manifest). Measured with a
`vitest` import inside `packages/core/src`:

```
no packages/core/package.json (nearest = root, vitest is a root devDep) -> [npm-dev,import]     -> not-to-dev-dep: 1
core/package.json declares only zod (the post-Task-6 state)              -> [npm-no-pkg,import] -> not-to-dev-dep: 0
core/package.json also declares vitest as a devDep                       -> [npm-dev,import]    -> not-to-dev-dep: 1
```

The rule fires today only because no per-package manifest exists yet. The moment Task 6 adds
`packages/NAME/package.json` declaring zod alone, every import from `packages/*/src` that the manifest does not
name becomes `npm-no-pkg` and the rule goes blind — while it still looks alive in Task 4's review. Task 4R
replaces it with `no-undeclared-deps-from-src` over `["npm-dev", "npm-no-pkg", "npm-unknown"]`; **MEASURED**, in the
post-Task-6 manifest shape that same import reports the new rule and exits 1, while declared dependencies
(`npm`), peers and optionals stay allowed. Task 4R also adds the lexical regression asserting that a rule whose
`from` is `^packages/[^/]+/src` covers `npm-no-pkg`, so a later simplification cannot quietly reintroduce it.
This is A-27/A-28's sibling: a guard that reads green because it cannot fire.
### A-38 — a brief asserted a false reason for keeping subpath entries — FAIL (corrected by the implementer)

Task 4R's Step 5 claimed that `no-restricted-imports` group entries match whole module names, so `timers` would
not cover `timers/promises` and the subpath needed its own entry. The implementer measured the opposite —
dropping `timers/promises` left both messages unchanged — and this report confirms the mechanism: ESLint 10's
`no-restricted-imports.js` builds its matcher with the `ignore` package (`matcher: ignore({`, line 334 of
`eslint@10.12.0`), whose parent-directory semantics make a bare name cover its subpaths. The entries are kept for
explicitness with a neutralised comment; the plan's rationale is corrected. Held as a FAIL because a brief may not
state a false cause even when the resulting artifact is right.

### A-39 — a vitest positional argument is a filter, not an include — FAIL (verification trap, corrected)

`pnpm exec vitest run packages/core/test` was expected to collect two files. It collects three: the gitignored
scratch clone `.superpowers/tmp-dry` mirrors `packages/core`, and the positional argument filters paths rather
than restricting the include set, so the clone's copy ran too — and passed, because that tree has a
`packages/core/src`. **MEASURED** without an exclude: `Test Files 3 failed | 2 passed (5)`, `Tests 4 failed |
6 passed (10)`; with `--exclude "**/tmp-dry/**"`: `Test Files 2 failed (2)`, `Tests 3 failed | 3 passed (6)`.
The same trap inflates `pnpm test`'s no-config baseline to 1219 files. Task 5's `projects: ["packages/*"]` is
immune because it resolves against the config's own directory, which is one more reason that line is load-bearing.

### A-40 — S1's gate invoked a script no task creates — FAIL (plan defect, fixed before S1)

S1 Task 19's Step 7 and its definition-of-done item 4 both run `pnpm test:architecture`, but the root scripts were
exactly `build, typecheck, test, test:watch, lint, depcruise, changeset, publint, attw, pack:smoke, gate` and S0
Task 8 adds only `ci:check`. **MEASURED**: `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL` + `Command "test:architecture" not
found`, exit 1 — so the S1 gate could not go green however good the code was. Fixed by giving S0 Task 8 (which
already edits `package.json` and had not run) the script plus a step verifying `Test Files 2 passed (2)` /
`Tests 6 passed (6)`. Found by cross-checking every `pnpm <word>` in both plans against the script list; the first
pass under-counted because its regex dropped `pnpm vitest ...` lines, so the corrected pass is a superset.
Task 8's Files line also still named only `ci:check`; it now names both scripts, so the file list can no longer send an
implementer looking for a script the step does not mention.

### A-41 — the final export-list test fails as written — FAIL (plan defect, fixed before S1)

`public-surface.test.ts` asserts `Object.keys(core)` has nothing outside its 49-name `RUNTIME_EXPORTS` array. But
`AgentStep` is `export abstract class AgentStep` in `memory/steps.ts`, and Task 19's barrel star-exports that module
(`export * from "./memory/steps.js"`), so the test fails with `unexpected = ["AgentStep"]`. Every one of the 49
listed names does have a runtime declaration, so only the array was wrong. Fixed by listing `AgentStep` and raising
the count to 52, consistent with design spec line 475, which shows `AgentStep` as the public base of the hierarchy.
Not leaks, checked rather than assumed: the three `*_TEMPLATE*` constants live in `prompts/templates.ts`, which the
barrel re-exports by name (`export { CODE_FENCE } from ...`) rather than by star; there is no `export default`.

### A-42 — a controller audit measured a correct brief and nearly 'fixed' it — FAIL (process)

Task 5's brief expects `2 failed | 4 passed (6)` for its red runs. Measuring the tree before running the task gave
`Test Files 2 failed (2)` / `Tests 3 failed | 3 passed (6)`, which looked like staleness worth correcting. It is
not: `3 failed | 3 passed` is the state **before** Step 3, and after Step 3 the guard's first test passes while only
the two 'directory is clean' assertions fail, which is exactly the brief's `2 failed | 4 passed`. The brief even
shows that derivation. Two apparent truncations in the same brief were my own 140-column display slice. Lesson: a
measurement only refutes an expectation if it is taken at the position the expectation describes — which is the
same rule the plan imposes on its own verifications. The brief is unchanged.

### A-43 — accepted minors from the Task 4R review (informational, non-blocking)

M1: the anchored dependency-cruiser exclude no longer matches `dist`/`coverage` at any depth; the only real path
affected is the gitignored scratch clone, which `depcruise packages` never cruises. M2: the explicit builtin
subpath entries are redundant under ESLint 10 (A-38 measured the same thing). M3: the F2b assertion checks config
content rather than dependency-cruiser's classification, and F7's stderr assertion is only exercised while
`packages/core/src` is missing, so after Task 6 both become dormant rather than wrong. Recorded, not fixed: none of
the three can make a wrong result pass.

### A-44 — S1 Task 8's stated test count is one too low — FAIL (plan defect, fixed before S1)

Task 8's final step runs `pnpm vitest run packages/core/test/system-prompt.test.ts` and expects `PASS, 12 tests.`, but
the test file the same task writes verbatim contains **13** `it` calls — 6 under `describe("CODE_AGENT_SYSTEM_TEMPLATE")`
and 7 under `describe("buildCodeAgentSystemPrompt")` — with no `.each`, no `.skip`/`.todo`, and no second appended block
anywhere in the section. Measured by counting `it(` across the whole Task 8 section (13 hits, all inside the one fenced
block) and by reading that block in full. The number is load-bearing twice over: S1's definition of done item 1 requires
every task's stated count to match the actual count, so the full gate cannot pass while it is wrong; and the cheapest way
for an implementer to make 13 tests report as 12 is to delete one — and the two fidelity tests that carry upstream's six
examples and eleven numbered rules are exactly the ones that would be sacrificed. Fixed to `13 tests.` in the plan and in
`s1-task-8-brief.md` before Task 8 runs.

### A-45 — S1 Task 5's stated test count is one too high — FAIL (plan defect, fixed before S1)

The same audit found the mirror image one task later in the sequence: Task 5 expects `PASS, 13 tests.` for
`packages/core/test/memory.test.ts`, whose block contains exactly **12** `it` calls — 6 under `describe("AgentMemory")`,
3 under `toMessages` and 3 under `toChatMessages` — again with no `.each` and no append step. (`for` loops do appear at
lines 1068 and 1105, but those are in `src/memory/memory.ts`, not in the test file.) Fixed to `12 tests.` in the plan and
in `s1-task-5-brief.md`.

Both came from the same sweep, and three of its other hits were false positives that direct reading overturned: the `13`
for `types.test.ts` is a combined run of that file's 3 tests plus `errors.test.ts`'s 10; Task 7's `12` is its 10 plus the
2 tests Step 5 explicitly appends; and Task 19's `52` is the `for (const name of RUNTIME_EXPORTS)` loop over 50 exports
plus 2 explicit tests. The sweep's first version compared with `>=`, which by construction cannot see an over-claim like
A-45 — a loose comparison inside the checker is itself an unfalsifiable verification (A-17, A-42).

### A-46 — the plan's vitest auto-naming claim and its `--project core` control are not reproducible — LOW (plan and brief corrected)

Task 5's `packages/core/vitest.config.ts` step justified `name: "core"` with the claim that without a `name` a project is
"auto-named after the package, i.e. `@smolagents-ts/core`", and Task 5's Step 5 listed `--project core` before Step 2 as
a negative control expecting `No projects matched the filter "core".` The plan tagged both as measured. Task 5's review
measured otherwise: with `packages/core/vitest.config.ts` moved out of the tree, the `projects: ["packages/*"]` glob
still yields a project auto-named after the **directory basename** — `core` — so `--project core` resolves and runs the
suite, while `--project "@smolagents-ts/core"` is the filter that errors. Impact on the shipped config: none; the
file's load-bearing content is `fileParallelism: false` (review control 2, which reproduced the probe race 3 of 3 when
the line was removed), and the explicit `name` still pins the name once Task 6 adds each package's manifest. The false
claim and its "both measured" tag were corrected in the plan and `task-5-brief.md`. The note about `--project core` in
the earlier task that precedes the root config was left alone: it describes the no-config state, which the review did
not measure.

### A-47 — `tsc` reports TS2305 with exit 2, not exit 1 — INFORMATIONAL (plan and brief corrected)

The same step's negative control for the three-config `tsc --noEmit` check said an unexported import "fails with
`error TS2305` and exit 1". The review measured `error TS2305: Module '"vitest/config"' has no exported member
'thisNameDoesNotExist'` with **exit 2**. The positive assertion (exit 0, no output) is unaffected; the claim and the same
sentence in `task-5-brief.md` were corrected.

### A-48 — S1 Task 14's design-spec check could pass while the spec stayed wrong — FAIL (plan defect, fixed before S1)

Step 6 told the implementer that section 5.5(a) "should already carry" the generator middleware signature and the
sentence "Middleware wraps action execution; wrapping the model phase is an S1.5 extension.", and to replace the "old
`next: () => Promise<void>` form" if it was still present. Measured against the document itself: 5.5(a) does carry the
generator type (`next: () => AsyncGenerator<void, void, void>`) and a `yield* next()` comment, but **no occurrence of
`next: () => Promise<void>` exists anywhere in the file**, while the prose still reads "Onion semantics (`await next()`)
around the step), like Koa" (line 322) and the required S1.5 sentence appears nowhere. An implementer following the step
literally would search for a string that is not there, conclude the section was already amended, and leave both the
contradiction and the missing sentence — so S1's definition-of-done item 9 would be reported satisfied by a check that
never examined what it names. This is the A-11/A-17 family again: a verification that cannot fail for the reason it
states. Step 6 now names the two concrete defects, gives the three `Select-String` commands whose output must come back
empty/`yield* next`/matching, and the Files line no longer hedges with "if it has not already been amended". Corrected in
the plan and `s1-task-14-brief.md`.

### A-49 — the plan's store paths embed a package version that the install does not keep — INFORMATIONAL (annotated)

The plan states as MEASURED that dependency-cruiser reports the zod store path as
`node_modules/.pnpm/zod@4.6.7/node_modules/zod/index.d.ts`. **MEASURED now**: the registry's `latest` is still 4.6.7, but
the lockfile S0 Task 6 committed resolves **`zod@4.6.6`** from the same `"zod": "^4.0.0"` range, because 4.6.7 was
published 2026-10-12 16:29 (about eight hours before the install) and pnpm resolved from its local metadata cache.
No test is broken: the only load-bearing occurrences are string literals that the lexical architecture test feeds to a
regex, so they never touch the real store; and `preferFrozenLockfile: true` plus the committed lockfile is what makes
the build reproducible. The plan now says the version segment is a snapshot to read from `pnpm-lock.yaml` rather than a
fact to assert, so a future reader cannot “correct” the test literal to match whatever is current.

### A-50 — Task 7's brief described a config as “what `init` writes” when only its contents match — INFORMATIONAL (corrected)

Implemented and verified: `.changeset/config.json` parses and `pnpm changeset status` exits 0, so the config is fine.
The brief's gloss was not. It said the block is what `changeset init` writes, but `init` emits the keys in a different
order (`$schema, baseBranch, access, format, changelog, commit, ignore, fixed, linked, updateInternalDependencies`) —
semantically equivalent, so nothing failed, but a reader who diffed the two would have concluded the file was wrong and
“fixed” it into a different byte sequence for no reason. The same step's quoted `access: "nonsense"` output was also
abridged (the real message puts the detail on its own line and ends `but received "nonsense"`), which invites the same
doubt. Both are now stated accurately in the brief and the plan. Also verified from the implementer's report and by the
controller: the brief's unverified aside is true — a changeset naming the private `@smolagents-ts/core` still leaves
`Packages to be bumped:` empty, confirming that the empty list is not by itself evidence about the config (which is why
the step's negative control matters).

### A-51 — Task 6's Files list counted core's two pre-existing config files as created — REAL (corrected in brief + plan)

The list opened "Create, for each of core, models, tools, exec-quickjs and react: packages/NAME/package.json,
packages/NAME/vitest.config.ts, packages/NAME/tsup.config.ts, ...". **MEASURED**: `git ls-tree -r 1cdcb05 -- packages/core`
already lists `vitest.config.ts` and `tsup.config.ts` (Task 5 created them), and `git show --name-status ca7019b`
creates **36** files under `packages/`, where that list implies 38. Nothing failed, because the implementer instead read
Step 7, which says the two files are Task 5's. But an agent following the Files list literally would have rewritten core's
`vitest.config.ts` from the "for each package" template and silently dropped `fileParallelism: false`, re-arming the A-11
race between the two architecture test files. The list now separates the 24 package-wide files from the 8 non-core configs
and the 4 non-core tsconfigs, names 36 as the expected count, and says explicitly to leave core's two config files alone.
This is the A-40 family (a Files list that misstates the change set) with a delayed blast radius, which is why it is classed
real rather than cosmetic.

### A-52 — the four non-core `vitest.config.ts` omit core's rationale comment — INFORMATIONAL (recorded)

The brief said each package's config is "core's with the project name changed". **MEASURED**: the four non-core files keep
`fileParallelism: false` but drop core's three-line comment explaining it, and the four non-core `tsup.config.ts` files drop
core's comment about the zod external. The outcome is correct — both comments describe core-specific facts, and the
architecture-guard race cannot exist in a package with one test file — but the brief's sentence invited a reader to call it
an oversight and "restore" a comment that would then describe something the file does not do. The plan and brief now record
the deviation and its justification.

### A-53 — A-43's dormancy claim confirmed, with two refinements — INFORMATIONAL (annotated)

The Task 6 reviewer reproduced the pre-Task 6 state exactly (`2 failed | 4 passed (6)`, A-42's recorded figure) by moving
`packages/core/src` aside, and confirmed that F7's stderr line is **dormant**, not newly vacuous. Two refinements:
(a) A-43's phrase "F7's stderr assertion" is imprecise — the line holds no `expect`, it is error construction inside
`architecture.test.ts`'s catch; and (b) the mechanism is stronger than "src is missing": `dependency-cruiser
--output-type json` **exits 0 even when it reports a violation** (measured: one `core-no-node-builtins` violation, exit 0
with `--output-type json`, exit 1 without), so rule violations never reach that catch at all. Only hard errors do, and
Task 6 removed the only hard error that used to occur there. A-43 also omitted that Task 6 leaves the guard's
`createdDir` cleanup branch permanently untaken; that branch is the only newly dead code and is benign. To re-exercise the
line, delete `packages/core/src` again.

### Consequence for the S0 sequence



Three of the first eight S0 tasks contained a verification step that could not fail, or that failed for a reason
it did not name: A-11, A-13, A-15. A-18 and A-19 are the same defect in a different position — a configuration
that breaks a gate two tasks later, and a check that tests a file for a substring when the fact that mattered
was which package manager it installs. A-17 is the sharpest: the controller's own validation, run against a
retyped copy rather than the plan's text, produced a green result for a recipe that could not pass. A-21 is the
same omission at task scale — three files created, none loaded. A-22 is not a weak check but an impossible step:
`changeset init` cannot run in an agent's shell at all, and only running it revealed that. A-23 and A-24 are the
pattern turning inward, onto the two safeguards built in response to it: the probe written to close A-17
asserted presence where it needed identity, and the task that built the lint gate shipped snippets that violated
it.

Six of the eight S0 tasks carry a defect of this family, and every one was found by executing the plan's own
text rather than reading it. The rule for the remaining tasks is therefore not "is this verified" but "run the
verification exactly as written, and state what would make it fail" — and for any check that reports a boolean,
arrange a negative control in the same run. A green tick, a coincidental exit 0, and a validation of the wrong
artifact are indistinguishable from a correct run when nobody reads the output.
