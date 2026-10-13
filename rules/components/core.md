# Component rule: core

**The barrel is the contract.**
Every runtime name `packages/core/src/index.ts` exports is public. Removing or
renaming one is a breaking change: the same change updates
`packages/core/test/public-surface.test.ts` and adds a changeset.

**The core stays isomorphic.**
A Node builtin, the DOM, or a React import anywhere under
`packages/core/src` is a defect in this component, whatever it makes easier
locally. `packages/core/test/architecture-guard.test.ts` proves the guard runs,
and `pnpm depcruise` proves the rule holds.

**A behaviour change lands with a golden transcript.**
The loop is asserted against a replaying `MockModel`, so a change to parsing,
planning cadence or final-answer detection updates the transcript covering it,
or adds one in the same change.
