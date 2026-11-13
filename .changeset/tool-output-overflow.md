---
"@smolagents-ts/react-ui": patch
---

Keep a long tool-output line inside its card. The styled inspector's tool-call list sized its one
grid column `auto`, so an unbroken line in a tool's output widened the step card, and the page with
it, past the viewport. The column is now `minmax(0, 1fr)`, and the output scrolls inside its `pre`.
