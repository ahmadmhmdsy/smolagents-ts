# Guide — where to put behaviour you add to an agent

**Contract**
- **Role:** which seam a piece of behaviour belongs in, so it works on every
  path a run can take and does not break cost, identity or replay.
- **Mutability:** rewrite in place.
- **Read when:** before adding behaviour to an agent that is not a prompt change.
- **Update when:** a seam named here changes its contract, or a plugin hook is
  added, renamed or removed.

- **Tested by:** `packages/core/test/guide-where-behaviour-belongs.test.ts`,
  which runs every example below and fails if a block here stops matching it.
- **Last checked against the code:** 2026-11-13.

## The short answer

Ask the questions in this order and stop at the first yes.

| # | If the behaviour… | it belongs in | not for |
|---|---|---|---|
| 1 | changes which model answers, or how a request reaches it: fallback, retry, routing, caching, logging the raw exchange | a **Model wrapper** | editing one run's messages (use the `model:request` hook) |
| 2 | is something the model decides to do | a **tool** | anything that must happen on every step whether the model asks or not |
| 3 | changes where or how a `CodeAgent`'s program runs | an **executor** | rules about single tool calls, which the tool hooks already see |
| 4 | changes where a run's record is kept | a **store** | your application's own data |
| 5 | must change the run at one named point: the request, a tool's arguments or output, the answer, a finished step | a **plugin hook** | swapping the model (rule 4 of `0039`) |
| 6 | must wrap a whole action step, with its events | **middleware** | a rewrite a hook already names |
| 7 | only watches the run | an **event listener** | anything that must change the run |

Two facts decide most borderline cases:

- **Tool hooks live in the tool wrapper.** `tool:before` and `tool:after` fire
  for a `ToolCallingAgent` call, a `CodeAgent` guest call and a call from a
  remote executor alike. Hosted tools, which the provider runs itself, never
  reach them.
- **Cost, budgets and the run record key on `model.id` and `model.provider`.**
  That is why a hook may not swap the model, and why a wrapper reports the id
  and provider of the model that actually answers.

## Examples

Each block is the code between one `guide:<name>` marker and `guide:end` in the
test named above.

### 1. Model wrapper

Implement `Model` around another model and forward both calls. `FallbackModel`
in `@smolagents-ts/models` is the shipped example of this seam.

<!-- guide:model-wrapper -->
```ts
class LoggingModel implements Model {
  readonly log: string[] = [];
  constructor(private readonly inner: Model) {}
  // Cost, budgets and the run record key on these two, so they stay the inner model's.
  get id() { return this.inner.id; }
  get provider() { return this.inner.provider; }
  get capabilities() { return this.inner.capabilities; }
  generate(messages: readonly ChatMessage[], options?: GenerateOptions) {
    this.log.push("generate " + String(messages.length));
    return this.inner.generate(messages, options);
  }
  generateStream(messages: readonly ChatMessage[], options?: GenerateOptions) {
    this.log.push("stream " + String(messages.length));
    return this.inner.generateStream(messages, options);
  }
}
```

### 2. Tool

<!-- guide:tool -->
```ts
const add = tool({
  name: "add",
  description: "Add two numbers.",
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  execute: ({ a, b }) => a + b,
});
```

The model's arguments are validated against `inputSchema` before `execute`
runs, and a failure goes back to the model as an error it can correct.

### 3. Executor

Implement `CodeExecutor`. One instance serves one run, so state defined in one
step is visible in the next.

<!-- guide:executor -->
```ts
class AuditedExecutor implements CodeExecutor {
  readonly programs: string[] = [];
  constructor(private readonly inner: CodeExecutor) {}
  get language() { return this.inner.language; }
  get capabilities() { return this.inner.capabilities; }
  execute(code: string, options: ExecuteOptions) {
    this.programs.push(code);
    return this.inner.execute(code, options);
  }
  async dispose() {
    await this.inner.dispose?.();
  }
}
```

### 4. Store

Implement `RunStore`. The agent commits after each boundary and reads the
record back to resume; the store never decides when to commit.

<!-- guide:store -->
```ts
class MirroredStore implements RunStore {
  readonly commits: string[] = [];
  constructor(private readonly inner: RunStore) {}
  commit(runId: string, record: RunRecord, expectedGeneration?: number) {
    this.commits.push(runId);
    return this.inner.commit(runId, record, expectedGeneration);
  }
  load(runId: string) { return this.inner.load(runId); }
  claim(runId: string, expectedGeneration: number, owner: string) {
    return this.inner.claim(runId, expectedGeneration, owner);
  }
  latestForConversation(conversationId: string) {
    return this.inner.latestForConversation(conversationId);
  }
  watch(runId: string, listener: (record: RunRecord) => void) {
    return this.inner.watch(runId, listener);
  }
}
```

### 5. Plugin hook

Install with `agent.use(plugin)`. The hooks are `model:request` (waterfall),
`model:response` (emit), `tool:before` and `tool:after` (waterfall),
`answer:check` (serial: the first rejection becomes a correction step) and
`step:end` (emit). The plugin API is marked `@experimental` in 0.x.

<!-- guide:plugin-hook -->
```ts
const evenOnly = definePlugin({
  name: "even-only",
  version: "1.0.0",
  setup: (api) => {
    api.on("answer:check", (answer) =>
      typeof answer === "number" && answer % 2 === 1
        ? { reject: "the answer must be even" }
        : undefined,
    );
  },
});
```

The run record names every plugin with a digest of its config. Resuming a run
with a different plugin set throws `RunPluginMismatchError` before any model
call, so a plugin that changes behaviour cannot be added or dropped silently
between a run and its resume.

### 6. Middleware

Pass it as `middleware` in the agent's options. It wraps each action step and
sees that step's events as they flow; use `yield* next()`, not `await`.

<!-- guide:middleware -->
```ts
const timeEachAction: AgentMiddleware = async function* (ctx, next) {
  const startedAt = Date.now();
  const outcome = yield* next();
  seen.push(ctx.stepIndex);
  ctx.logger.debug("step " + String(ctx.stepIndex) + " took " + String(Date.now() - startedAt) + " ms");
  return outcome;
};
```

### 7. Event listener

`agent.on` returns its own unsubscribe. `agent.stream(task)` yields the same
events, for a caller that drives the run itself.

<!-- guide:events -->
```ts
const stop = agent.on("run.completed", (event) => {
  finished.push(event.result.output);
});
```

## Limits

- This guide does not cover prompt changes, which are agent options, or
  provider-specific request knobs, which go in `providerOptions` and are typed
  by each adapter.
- Hosted tools run at the provider and are outside every hook.
- The reasons for the hook set and its limits, hosted tools included, are in
  `docs/09-decisions/0039-a-narrow-plugin-contract-on-the-existing-seams.md`.

## Next step

For the provider adapters a Model wrapper sits on, read
`packages/models/README.md`.
