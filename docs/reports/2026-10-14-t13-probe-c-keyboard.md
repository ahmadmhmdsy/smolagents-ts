# smolagents-ts — L4/L5 probe C: the styled tree driven by keyboard

**Date:** 2026-10-14 · **Repository:** `E:\python_projects\smolagents_ts` (branch `main`)

**Contract**
- **Role:** report — a measurement of the styled layer in a real browser, and the
  evidence behind one claim the L4/L5 plan makes.
- **Mutability:** history pinned to the revision it was measured at. Append a
  correction as a new section; never rewrite a measured number.
- **Read when:** questioning what the styled layer does to a real accessibility
  tree, or how the keyboard reaches the example's controls.
- **Update when:** the layer's structure changes enough that the measurement
  stops describing it, which is a new report rather than an edit to this one.

This is a record pinned to the revision it was measured at. It is not the live
answer to any status question.

## What this probe asks

The styled layer claims that a wrapper adds one element carrying a class this
package owns and nothing else: it authors no role, no ARIA attribute and no
event handler, and the accessibility of a run comes from the primitives inside.
The claim was checked in jsdom by `packages/react-ui/test/a11y.test.tsx`. This
probe asks the same question of a real browser, and adds the one thing jsdom
cannot answer: whether a keyboard alone can still reach the controls, and
whether the wrapper appears in the accessibility tree at all.

## How it was run

The page is the example's own production build, so nothing here is a fixture.

    pnpm --filter example-vite-app run build
    node .dsh/probe-c/serve.mjs examples/vite-app/dist 4317
    & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new \
        --disable-gpu --no-sandbox --remote-debugging-port=9222 \
        --user-data-dir=.dsh/probe-c/edge-profile --window-size=1200,900 about:blank
    node .dsh/probe-c/drive.mjs 9222 http://127.0.0.1:4317/

The drive script speaks the DevTools Protocol directly: it navigates, waits nine
seconds for the QuickJS module and the scripted run to settle, walks the tab
order with `Input.dispatchKeyEvent`, reads `document.activeElement` after each
press, and reads `Accessibility.getPartialAXTree` for each node of interest.
Every key press is synthetic but every element is real; no pointer event is sent.

Browser, as reported by `Browser.getVersion`: `Edg/155.0.4283.45`.

## Measured — the tab order

After the run finishes, Tab walks three stops and then leaves the document:

| # | element | text | in the styled wrapper? |
|---|---|---|---|
| 1 | `button` | "Run it again" | no, the page's own control |
| 2 | `li` | the first step's program | yes, `div.smol-run-inspector > div.agent-run > ol.agent-run-steps > li` |
| 3 | `li` | the second step's program | yes, the same list |
| 4 | `body` | — | the order wraps to the browser chrome |

While a run is **live**, a zero-delay walk reaches the cancel control third:

    body → button "Run it again" → button "Cancel run"  (status "Running, step 1", disabled false, tabIndex 0)

The first walk had missed it, and the reason is worth recording rather than
hiding: with a 150 ms pause between presses the scripted run finished before the
walk arrived, and a finished run renders `Cancel run` **disabled**, which is
correctly absent from the tab order. The zero-delay walk reaches it while the
status still reads "Running, step 1".

The composer is never reached, which is the intended shape of this page rather
than a defect: the page passes no `onSubmit`, so the input and the button are
both `disabled: true`, and the reason renders as ordinary text.

    composer: { inputFound: true, inputDisabled: true, inputTabIndex: 0,
                submitFound: true, submitDisabled: true, submitTabIndex: 0,
                reasonText: true }

`tabIndex: 0` is a button's and an input's default; it is the `disabled` state,
not the index, that removes them from the order.

## Measured — the accessibility tree

`Accessibility.getPartialAXTree`, one query per node:

| node | role | ignored | notable properties |
|---|---|---|---|
| `.smol-run-inspector` | `none` | **true** | — |
| `.smol-chat-surface` | `none` | **true** | — |
| `.agent-run` | `none` | **true** | — |
| `.agent-run p[role="status"]` | `status` | false | `live: polite` |
| `.smol-run-inspector [aria-live]` | `status` | false | `live: polite` — exactly one such node |
| `.agent-run > button` | `button` | false | name "Cancel run", `disabled: true` once finished |
| `.agent-run-steps` | `list` | false | — |
| `.agent-run-steps > li` | `listitem` | false | name is the whole step text |
| `form` | `form` | false | — |
| `input[name="message"]` | `textbox` | false | name "Message", `disabled: true` |
| `button[type="submit"]` | `button` | false | name "Send", `disabled: true` |

## What this proves

The two wrappers this package renders are **`role: none` and `ignored: true`**.
A wrapper contributes nothing to the accessibility tree at all — not a group, not
a region, not a landmark. Every role the page exposes is owned by an inner
primitive: `status` with `live: polite` for the run's state, `list` and
`listitem` for the step lane, `button` with the accessible name "Cancel run" for
the cancel control, and `form`, `textbox` and `button` for the composer.

The keyboard reaches the run's controls and stops where it should: the live
cancel button is a tab stop, and the disabled composer is skipped because it is
disabled rather than because the styled layer hid it.

Two things this probe does **not** show. It does not measure how the sheet looks:
that is probe A, which read resolved token values from a scratch consumer page
and confirmed both that the `var()` fallback resolves and that a consumer sheet
loaded afterwards wins by source order. And it does not run a screen reader: the
accessibility tree is the browser's own computation, which is the strongest
evidence available without one, but it is not a screen-reader transcript.
