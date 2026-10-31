# 0036 — the version-1 shim flattens text parts and refuses media

**Contract**
- **Role:** the record that corrects the direction of [0034](0034-multimodal-input-is-in-and-scheduled.md)'s item 6, and fixes which size the media caps count.
- **Mutability:** frozen once accepted. A reversal is a separate record; this one stays as written.
- **Read when:** changing `upgradeModelAdapter`, writing an adapter against an earlier contract, or setting a media limit.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-31T23:50:00+03:00
- **Decided by:** the lead, while building Phase 1 of [the multimodal plan](../plans/2026-10-31-multimodal-input-plan.md), which the owner approved on 2026-10-31
- **Supersedes:** none. 0034 stays as written; this record governs how its item 6 is carried out.

## Context

0034 item 6 says `upgradeModelAdapter` "normalises version-1 string content into a text part". That reads backward. The loop speaks the new contract and the old adapter sits behind the shim, so messages cross the shim from parts toward strings. A version-1 adapter reads `message.content` as a string, and handing it an array breaks that adapter. The item's intent, that an adapter written for 0.1.0 keeps working without a rewrite, is unchanged.

Before this record, `capabilities.images` was a forward declaration: no caller could act on it, so a 0.1.0 adapter that set it to true promised nothing.

The plan's risk table also says caps are set against encoded size, while 0034 item 4 says only "byte caps".

## Decision

1. Text parts flatten to the string a version-1 adapter expects, joined with a newline.
2. Media is refused with `UnsupportedContentError` before the adapter is called, on `generate` and on `generateStream`.
3. The shim reports `images` and `audio` as false whatever the wrapped model declared.
4. The shim wraps every model that does not declare version 2, whether it declares version 1 or nothing.
5. `maxPartBytes` and `maxRunBytes` count base64-encoded bytes, because that is what a request carries.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Follow 0034 item 6 as worded | It hands an array to code written for a string, the break the item exists to prevent. |
| Pass media through and let the adapter fail | The failure would be a provider 4xx or a stringified array, after spending a call. |
| Trust a version-1 adapter's `images: true` | The flag had no meaning under that contract, and the adapter has no code to map a part. |
| Drop media silently and send the text | The model would answer as if it had seen the image. |
| Count raw bytes | A part under the cap could still be refused by the provider for its encoded size. |

## Consequences

**Positive**

- A 0.1.0 adapter sees exactly what it saw before, and string messages cross the shim as the same objects.
- A caller learns about the missing capability before any tokens are spent.

**Negative**

- An author of a 0.1.0 adapter gets no media until the adapter declares version 2 and maps parts.
- A nominal cap of 5 MiB admits about 3.75 MiB of raw bytes, which the documentation has to say.

## Reversibility

The shim is one function, and no snapshot or wire format depends on it. Changing what the caps count changes which inputs are admitted, so it needs a changeset.

## Follow-up

Phase 2 confirms the default caps against provider limits. Phase 3 calls the shim for a bare model reaching the loop.
