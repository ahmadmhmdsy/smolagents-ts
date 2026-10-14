# Component rule: react-ui

**The styled layer composes the barrel and never reaches past it.**
Every wrapper imports `@smolagents-ts/react` and renders what that entry
exports. A wrapper that imported a module path, a context, a provider or the
store instead would freeze an internal shape the headless package is free to
change, and the barrel — not the file tree — would stop being the contract
between the two layers. When a layer needs something the barrel does not
publish, that is a headless change rather than a reason to reach around it.

**A wrapper adds a class and forwards the rest, and authors no accessibility.**
Each wrapper renders one element carrying a class this package owns, composes
the caller's `className` with it, and passes every other prop through. Roles,
live regions, `aria-busy`, `aria-describedby` and the tool call's announcement
belong to the primitive; a wrapper that restated them would drift from the
component it wraps the moment that component changed.

**The stylesheet is text a consumer owns after copying it.**
Nothing in the package imports the sheet, so nothing applies itself and no
stylesheet arrives as a side effect of importing a module. Every rule is scoped
to a class this package owns, and the token block is the whole theming contract,
so a consumer edits its own copy and its own sheet wins by source order.
