---
"@smolagents-ts/core": patch
---

A `ToolCallingAgent` without an `outputSchema` now offers `final_answer` on the request.
Before this a real provider had no way to finish such a run, and it ended at `maxSteps`.
