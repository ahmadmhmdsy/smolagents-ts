# Component rule: tools

**A tool declares its contract in Zod.**
The schema is the runtime truth: name, description, arguments and return type
all come from it, and the JSON schema handed to a model is derived from the
schema rather than written beside it.

**Default tools are opt-in.**
Importing this package adds no capability to any agent. A default tool becomes
reachable only when the caller puts it in an agent's tool list.

**A default tool is sandbox-safe.**
A tool that reaches the network, the filesystem or the clock says so in its
schema and its description, because generated code decides when it runs.
