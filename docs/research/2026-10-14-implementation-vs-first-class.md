# Analysis — are the five internal packages implementation or first-class?

- **Task:** the open follow-up of decision 0006; filed for the owner
- **Owner:** owner
- **Started:** 2026-10-14T11:20:00+03:00

## Contract

- **Role:** the evidence behind decision 0006's open follow-up, which asks
  whether the five internal packages are documented as first-class or stay
  implementation.
- **Mutability:** append-only once filed; the reading is pinned to the revision
  it was made at.
- **Read when:** before writing the docs site or a per-package README, because
  both encode the answer.
- **Update when:** the owner decides, or the distribution shape changes again.

## Question

Does this project support installing a subset of the stack, or exactly one
package — and which of those two answers should its documentation state?

## The two postures, surface by surface

| surface | implementation (today) | first-class |
|---|---|---|
| README / docs site | one install line, the facade | six install lines, each with its own quickstart |
| an npm package page | description, keywords, repository; no README | a per-package README with install, usage and a stability statement |
| the facade's rule file | states that reaching for an internal name is going around the facade | rewritten to two supported entry points |
| why the five are public | a mechanical consequence: the facade's declarations name them | a supported choice, documented as one |
| support and semver promise | the facade's surface | six surfaces, each with its own promise |
| the version discipline | one fixed group | unchanged — already one fixed group |
| each package's export surface | pinned by its own surface test | unchanged — already pinned |
| conformance to the design record | matches section 5.2, one installable package | moves away from it |

Only the first five rows differ. Versioning and API stability are already
identical under both postures, so they are not arguments for either.

## Measured facts that bear on the choice

- The facade depends on all five internal packages, and one of them,
  `@smolagents-ts/exec-quickjs`, depends on the two QuickJS packages that carry
  the WASM engine. A caller who wants the loop and an adapter but not the sandbox
  still installs the engine.
- React and react-dom are optional peers, so the facade does not pull a UI
  framework; the engine is the only heavy dependency it forces.
- The five carry a description, keywords, repository, homepage and bugs, and no
  README, so their npm pages are self-describing but empty below the fold.
- The five are already public and already version-locked to the facade by the
  changeset fixed group, so a caller who installs one directly cannot receive a
  version skew against the facade.
- Every package's export surface is pinned by its own surface test, so an
  API-stability promise would be formalising what the suite already enforces.

## Options

**A — stay implementation.** No change. *Pros:* matches the design's one
installable package; keeps one documented install path and one support surface;
the five remain public for the mechanical reason they are public now. *Cons:*
their npm pages have no README, so a visitor who lands on one from a search has
nowhere to go; the posture is stated only inside the repository, not where a
consumer looks. *Gaps:* nothing measures whether anyone wants a subset.

**B — first-class documentation.** Six documented install paths, a README per
package, and the facade's rule rewritten. *Pros:* serves the caller who wants the
loop and adapters without the QuickJS engine; makes the npm pages useful; the
five's surfaces are already stable enough to promise. *Cons:* six support
surfaces and six documents to keep in sync; it contradicts the design's one
package, so it needs a spec revision, not only a rule edit; and it documents a
subset-install path nobody has asked for. *Gaps:* no evidence of demand; the
maintenance cost is unmeasured.

**C — implementation with a signpost (recommended).** Keep the posture, and give
each of the five a short README that says what it is, that it is published
because the facade's declarations name it, and where the documentation lives.
*Pros:* fixes the real defect (an empty npm page) without promising a second
supported install path; cheap; reversible. *Cons:* two places now describe each
package, so a rename has one more file to touch. *Gaps:* it still does not serve
the subset caller.

**D — trim the facade instead.** Make `@smolagents-ts/exec-quickjs` an optional
peer of the facade, so installing the facade no longer forces the engine.
*Pros:* removes the strongest argument for first-class — the forced dependency —
without multiplying documented install paths. *Cons:* it reverses part of
decision 0006 and the facade's own promise that one install carries the whole
stack; the README's quickstart imports the executor, so it would need a second
install step or a different example; it touches the pack smoke's peer handling.
*Gaps:* an optional peer that is absent makes the facade's `./exec/quickjs`
subpath fail at import, which is a worse first-run experience than the extra
bytes.

## Recommendation

**C.** The deciding question is whether this project supports installing a subset
of the stack, and nothing in the design record, the plans or the repository says
it does: section 5.2 specifies one installable package, and the five are public
because tsup cannot inline their declarations, not because a consumer asked for
them. Documenting them first-class would convert a mechanical consequence into a
promise, and it would contradict the spec rather than extend it. The one real
cost — the facade pulls the QuickJS engine — is an argument for D, not for B,
and D should wait until someone reports it, because the alternative failure (a
missing optional peer behind a documented subpath) is worse than the bytes.

If the owner chooses B, the work is: a README per package, the docs site's
install section, and a revision of `rules/components/smolagents-ts.md` plus the
design record's section 5.2 — the spec change is the part that makes B expensive,
and it should be accepted as such before the docs site is written.

## Close-out

- [x] filed under `docs/research/`
- [ ] the owner's answer recorded as a decision
- [ ] the docs site written to match the answer
