# Component rule: mcp

**The transport is the only place that knows the peer.**
Every layer above the seam sees messages and never a subprocess or a socket. The
root entry reaches no Node builtin, and the transport that opens a subprocess
lives behind its own subpath, so a browser bundle that imports the barrel stays
loadable.

**The wire mirrors the specification.**
The JSON-RPC 2.0 shapes are declared exactly as the specification and the
official SDK declare them, member for member. A shape this port invents is a
shape a caller cannot reuse, and the promise that an SDK transport can be
injected with no adapter between them holds only while the two declarations stay
assignable.

**A refusal names the name.**
A refused transport string, a tool spec whose schema cannot be represented, a
pair of tools that would register under one identifier: each names what was
refused and what is supported. None is folded onto a nearby behaviour, because a
caller cannot debug what was silently accepted.

**A tool carries two names.**
The identifier a model writes is sanitised for the language the agent generates,
and the name the server knows is what travels on the wire. Both travel with the
adapted tool, so a failure can name the tool the server would recognize.
