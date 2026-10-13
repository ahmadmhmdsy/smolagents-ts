# Component rule: react

**State comes from the session, not from the hook.**
Every hook reads the `AgentSession` snapshot and subscribes to it. A hook that
keeps its own copy of a run's state diverges from the store the moment two
components mount.

**React stays a peer.**
`packages/react` peer-depends on React and is never imported by the core. A
primitive that needs a framework assumption keeps it inside this package.

**Accessibility is part of the primitive.**
A primitive that renders a live region sets the ARIA attributes its behaviour
implies, and the component test asserts those attributes rather than the markup
around them.
