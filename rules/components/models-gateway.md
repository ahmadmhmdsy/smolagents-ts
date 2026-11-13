# Component rule: models-gateway

**A gateway's metadata is an event, never state.**
What a gateway reports about a request reaches the caller through `onResponse`,
once per completed request. The model keeps no last response, because two runs
that share one model would read each other's value.

**The wire belongs to the models package.**
`GatewayModel` composes `OpenAICompatibleModel` and sees responses only through
the `fetch` it hands that adapter. A change to how requests or bodies look is a
change in `packages/models`, not here.

**The gateway's figures never enter the core's.**
A cost, a cache result or a provider name from a header stays in
`GatewayResponse`. It is not added to `TokenUsage`, the price table or the run
record, which key on the model's own `id` and `provider`.

**A field is present only when the gateway stated it.**
An absent, empty or malformed header leaves its field out. The reader does not
guess a number or a cache result.

**The root entry is isomorphic.**
The package depends on the core and the models package alone and reaches no Node
builtin. The API key is sent only when a caller passes one and is never written
into an error.
