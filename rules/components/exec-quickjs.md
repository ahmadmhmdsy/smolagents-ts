# Component rule: exec-quickjs

**The guest boundary is the product.**
Code crossing into the QuickJS realm is untrusted, and the capability set the
guest receives is decided in this package and nowhere else. It is not widened to
make an example work.

**The executor seam stays the only coupling.**
`packages/exec-quickjs/src` depends on the `CodeExecutor` interface from the
core and on the engine it implements. It never imports the agent loop, and no
other package imports it except an example or a test.

**A missing engine fails loudly.**
A platform with no usable WASM binary produces a typed executor error. It does
not silently fall back to evaluating guest code in the host realm.
