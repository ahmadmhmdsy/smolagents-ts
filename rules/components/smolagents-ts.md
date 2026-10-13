# Component rule: smolagents-ts

**The facade owns no implementation.**
Every name it exports comes from a package that owns it, and its entries carry
no logic. A behaviour that needs code here belongs in the package that owns the
name, and the facade re-exports it afterwards.

**One published name per package.**
The facade is the documented entry point; the internal packages ship because
its declarations name them, and a caller reaching for one of those names has
gone around the facade.
A new subpath is added to the exports map and to the surface test in the same
change.

**A version is cut for all six together.**
The facade depends on the internal packages, so their versions move as one
group through the changeset fixed group; a release that moves one and not the
others publishes a manifest whose ranges no longer match what shipped.
