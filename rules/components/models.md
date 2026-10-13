# Component rule: models

**A provider adapter is data, not policy.**
An adapter translates between the core `Model` interface and one wire protocol.
Retry policy, cost limits and credential lookup stay outside it.

**No credential is read at import time.**
A key is resolved when a request is made, from the caller's configuration, so
importing the package inside a browser bundle cannot reach a secret store.

**The wire format is pinned by a recorded fixture.**
Each adapter keeps one recorded request and response pair in its tests, so a
provider format change appears as a failing diff instead of a silent behaviour
change.
