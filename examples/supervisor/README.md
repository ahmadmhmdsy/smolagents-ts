# supervisor

A supervisor that routes on a typed report. Two managed agents are declared with an output
schema each: the researcher answers a valid shape, the auditor answers without the field its
schema requires. The sample calls both through `runManagedAgent` — the same path the
model-facing managed-agent tool uses — and reads the report rather than the rendered text: a
value for the researcher, a `ChildSchemaError` failure for the auditor. The route (`publish` or
`hold`) and the answer both come from those reports, not from a model. The model is scripted
with `MockModel`, so the sample needs no provider, no key and no network.

## Run it

    node --experimental-strip-types src/index.ts

It prints the route, the answer, and both reports as JSON. The failing report is the point: it
carries `kind: "schema"`, the schema paths that failed, and a bounded diagnostic, never the
child's inputs.

## Test it

    pnpm vitest run --project example-supervisor

The test asserts the researcher's value, the auditor's schema failure (including the missing
`confidence` path), and that the answer states both outcomes.

## Where the pieces live

| piece | path |
|---|---|
| the two schemas and the supervisor | `src/index.ts` |
| the acceptance test | `test/example.test.ts` |
