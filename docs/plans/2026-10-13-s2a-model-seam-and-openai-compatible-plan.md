# S2a — Model Seam and OpenAI-Compatible Adapter Implementation Plan

**Contract**
- **Role:** plan — the task-by-task route to one milestone slice, written before the work.
- **Mutability:** append-only in practice. Tasks are checked off as they land; a step is
  never rewritten after it has been executed.
- **Read when:** before executing any part of S2a, or before judging whether it is done.
- **Update when:** a step's outcome differs from its expectation. Record the difference in
  that task's report; do not edit the step.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@smolagents-ts/models` a real package — an isomorphic HTTP transport, an `OpenAICompatibleModel` that speaks `/v1/chat/completions`, and a `CustomModel` escape hatch — and make the `ToolCallingAgent` path that drives it actually work, so a run can reach a real provider for the first time.

**Architecture:** Core keeps owning the `Model` interface; `models` implements it and depends on core for types only. The adapter never calls `fetch` directly — the transport is injected, defaulting to `globalThis.fetch`, so every test runs against a recorded fixture with no network and no globals to stub. Four core defects block the path and are fixed first: the loop never passes `tools`, the streaming branch drops tool calls and usage, `toMessages()` drops assistant tool calls and tool results, and `AgentSession` discards a call whose `action.failed` arrives before `action.requested`.

**Tech Stack:** TypeScript 6 strict · Vitest 5 · zod 4 (still the only runtime dependency of core) · `globalThis.fetch`, `ReadableStream`, `TextDecoder` from the ECMA-429 subset — no `node:` import, no DOM, no bundler-specific API.

**Spec:** [../design/2026-10-12-smolagents-ts-v1-design.md](../design/2026-10-12-smolagents-ts-v1-design.md) §7
**Depends on:** [2026-10-12-s1-core-runtime-plan.md](./2026-10-12-s1-core-runtime-plan.md)

**Dependency order:** a task may use only what earlier tasks created, so the list runs top to bottom.

---

## Why this slice

Design spec §7.1 lists four tier-1 adapters. That is four independent subsystems, so it is
two plans, not one — the first must produce working software on its own. It does:
`OpenAICompatibleModel` alone covers OpenAI, Azure OpenAI, Together, Groq, Fireworks,
DeepSeek, OpenRouter, Ollama, LM Studio, vLLM and llama.cpp, and `CustomModel` covers every
provider that is not on that list. `AnthropicModel`, `GeminiModel` and `HuggingFaceModel`
are S2b, planned separately once this one lands.

Three facts this plan was written against, all measured on the tree at commit `ba48d0b`:

- `packages/core/src/agent/multi-step-agent.ts:364` and `:380` pass `{ signal }` and nothing
  else, so `ToolRegistry.toSpecs()` has no caller outside its own unit test.
- `multi-step-agent.ts:376` returns `{ content: text, toolCalls: [], usage: EMPTY_TOKEN_USAGE }`
  from the streaming branch: a streamed run loses its tool calls and its token accounting.
- `packages/core/src/memory/memory.ts:74-81` renders every action step as an assistant turn
  plus `Observation:` user turn, which is the CodeAgent form. A tool-calling provider needs
  `tool_calls` on the assistant turn and one `role: "tool"` message per result.

One assumption is pre-registered for verification rather than assumed to hold: `pnpm pack`
rewrites `workspace:*` to `0.0.0`, and `scripts/pack-smoke.mjs` installs all five tarballs in
one `npm install`. Task 5 Step 6 runs it and records the result. If npm tries the registry for
`@smolagents-ts/core@0.0.0`, the fallback decided here is to declare `@smolagents-ts/core` as a
`peerDependencies` entry in `packages/models/package.json` and keep it in `devDependencies`.

## File structure

```text
packages/core/
├─ src/
│  ├─ types.ts                          + ToolCallRequest, ChatMessage.toolCalls      (Task 1)
│  ├─ model.ts                          - ToolCallRequest, + chunk usage,
│  │                                      + ToolCallAccumulator                       (Task 1, 3)
│  ├─ memory/memory.ts                  tool-message transcript                       (Task 2)
│  ├─ agent/multi-step-agent.ts         advertisesTools, transcript(), streamed
│  │                                      tool calls and usage                        (Task 2, 3)
│  ├─ agent/tool-calling-agent.ts       advertisesTools = true, transcript = tool     (Task 2, 3)
│  └─ session/agent-session.ts          idempotent call recording by callId           (Task 4)
└─ test/
   ├─ types.test.ts                     (extend)                                       (Task 1)
   ├─ model.test.ts                     (extend)                                       (Task 3)
   ├─ memory.test.ts                    (extend)                                       (Task 2)
   ├─ tool-calling-agent.test.ts        (extend)                                       (Task 2, 3)
   └─ agent-session-toolcalls.test.ts   new                                            (Task 4)

packages/models/
├─ src/
│  ├─ index.ts                          the public surface                             (Task 9)
│  ├─ transport.ts                      FetchLike + resolveFetch + HttpError           (Task 5)
│  ├─ sse.ts                            parseSse                                         (Task 6)
│  ├─ openai-compatible.ts              OpenAICompatibleModel                          (Task 7, 8)
│  └─ custom.ts                         CustomModel                                    (Task 8)
└─ test/
   ├─ transport.test.ts                                                                 (Task 5)
   ├─ sse.test.ts                                                                       (Task 6)
   ├─ openai-compatible.test.ts                                                         (Task 7, 8)
   ├─ custom.test.ts                                                                    (Task 8)
   ├─ e2e.test.ts                       ToolCallingAgent over a fixture provider        (Task 9)
   └─ fixtures/openai/                                                                  (Task 7, 8)
      ├─ completion.json  completion-tools.json  completion-usage.json
      ├─ stream.sse       stream-tools.sse        error-401.json
```

## Spec coverage

| design spec section | implemented by |
|---|---|
| 7 Model layer — the interface | already in core (S1 Task 9); Task 1 extends `ChatMessage` for assistant tool calls |
| 7 Coverage strategy — tier 1 OpenAI-compatible | Task 7, Task 8 |
| 7 Coverage strategy — tier 2 CustomModel | Task 8 |
| 7.1 tier 1 Anthropic, Gemini, HuggingFace | deliberately S2b, a separate plan |
| 7.1 tier 3 models-gateway | deliberately later; the OpenAI-compatible adapter is the wire format it needs |
| 6.2 The agent loop — tools advertised | Task 3 |
| 6.4 Memory and steps — the transcript | Task 2 |
| 6.7 AgentSession | Task 4 |
| 5.4 Runtime constraints — isomorphic | Task 5 (transport is injected; no `node:` import), guarded by the existing architecture test |
| 11 Testing and validation | Task 7/8 (recorded fixtures, no network), Task 9 (end-to-end over a fixture) |

---

## Task 1: An assistant message can carry the tool calls it asked for

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/model.ts` (delete lines 11-16, import the type)
- Modify: `packages/core/src/agent/action.ts:2`
- Modify: `packages/core/src/testing/mock-model.ts:2`
- Modify: `packages/core/test/tool-calling-agent.test.ts:7`
- Test: `packages/core/test/types.test.ts`

The definition moves down to `types.ts` because `ChatMessage` lives there and `model.ts`
already imports `types.ts`; the reverse edge would be a type-level import cycle that
`depcruise` flags. `ToolCallRequest` stays exported from the package root, because
`index.ts` star-exports `types.ts` too. Do **not** re-export it from `model.ts`: two star
exports of one name make the barrel export ambiguous, and TypeScript drops the name instead
of reporting it.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/test/types.test.ts`:

```ts
import type { ChatMessage, ToolCallRequest } from "../src/types.js";

describe("ChatMessage", () => {
  it("carries the tool calls an assistant turn asked for", () => {
    const call: ToolCallRequest = { id: "call_1", name: "search", arguments: '{"q":"x"}' };
    const message: ChatMessage = { role: "assistant", content: "", toolCalls: [call] };
    expect(message.toolCalls?.[0]?.name).toBe("search");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run --project core packages/core/test/types.test.ts`
Expected: FAIL — `Module '"../src/types.js"' has no exported member 'ToolCallRequest'`.

- [ ] **Step 3: Move the type and add the field**

Delete this interface from `packages/core/src/model.ts` (lines 11-16, comment included) and
put it in `packages/core/src/types.ts`, immediately after `ToolCall`:

```ts
/** A tool call the model asked for. arguments is the raw JSON string the provider returned. */
export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: string;
}
```

Add the field to `ChatMessage` in the same file:

```ts
export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** On a role "tool" message, the id of the call being answered. */
  toolCallId?: string;
  /** On a role "tool" message, the tool name, where the provider wants one. */
  name?: string;
  /** Set on an assistant message that asked for tool calls. */
  toolCalls?: readonly ToolCallRequest[];
}
```

In `model.ts`, import what it still needs:

```ts
import { type ChatMessage, type TokenUsage, EMPTY_TOKEN_USAGE } from "./types.js";
import type { ToolCallRequest } from "./types.js";
```

In `agent/action.ts`, `testing/mock-model.ts` and `test/tool-calling-agent.test.ts`, change
`from "../model.js"` / `from "../src/model.js"` to `from "../types.js"` / `"../src/types.js"`
for that one imported name.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run --project core packages/core/test/types.test.ts`
Expected: PASS, 1 test.

- [ ] **Step 5: Prove the whole package still compiles and the public surface is unchanged**

Run: `pnpm typecheck`
Expected: exit 0.
Run: `pnpm vitest run --project core packages/core/test/public-surface.test.ts`
Expected: PASS — this task adds no runtime name, so the pinned 50-value list does not move.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/model.ts packages/core/src/agent/action.ts packages/core/src/testing/mock-model.ts packages/core/test/types.test.ts packages/core/test/tool-calling-agent.test.ts
git commit -m "feat(core): let an assistant ChatMessage carry its tool calls"
```

---

## Task 2: `toMessages()` renders a tool-calling transcript

**Files:**
- Modify: `packages/core/src/memory/memory.ts:10-13, 74-81`
- Modify: `packages/core/src/agent/multi-step-agent.ts:217, 338, 399`
- Modify: `packages/core/src/agent/code-agent.ts`, `packages/core/src/agent/tool-calling-agent.ts`
- Test: `packages/core/test/memory.test.ts`, `packages/core/test/tool-calling-agent.test.ts`

The transcript form is a property of the agent, not of the step: the CodeAgent keeps the
`Observation:` turns upstream gives it, the ToolCallingAgent needs `tool_calls` plus one
`role: "tool"` message per call. Switching on `step.toolCalls.length` instead would silently
change the CodeAgent transcript the golden fixture asserts, so the choice is explicit.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/test/memory.test.ts`:

```ts
it("renders tool calls and their results when asked for the tool-message form", () => {
  const memory = new AgentMemory();
  memory.addStep(new SystemPromptStep("be brief"));
  memory.addStep(new TaskStep("add 2 and 3"));
  const step = new ActionStep(0);
  step.modelOutput = "";
  step.observations = "Tool add returned: 5";
  step.toolCalls = [{ id: "call_1", name: "add", arguments: { a: 2, b: 3 }, result: 5 }];
  memory.addStep(step);

  const messages = memory.toMessages({ toolResults: "tool-messages" });

  expect(messages[2]).toEqual({
    role: "assistant",
    content: "",
    toolCalls: [{ id: "call_1", name: "add", arguments: '{"a":2,"b":3}' }],
  });
  expect(messages[3]).toEqual({
    role: "tool",
    toolCallId: "call_1",
    name: "add",
    content: "5",
  });
});

it("keeps the Observation form by default", () => {
  const memory = new AgentMemory();
  memory.addStep(new TaskStep("add 2 and 3"));
  const step = new ActionStep(0);
  step.modelOutput = "code";
  step.observations = "tool said 5";
  step.toolCalls = [{ id: "call_1", name: "add", arguments: {}, result: 5 }];
  memory.addStep(step);

  expect(memory.toMessages().map((m) => m.role)).toEqual(["user", "assistant", "user"]);
});
```

Import `ActionStep`, `SystemPromptStep` and `TaskStep` from `../src/memory/steps.js` if the
file does not already.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run --project core packages/core/test/memory.test.ts`
Expected: FAIL — `options.toolResults` is not a known property and the tool form is not
produced.

- [ ] **Step 3: Implement the two forms**

In `memory.ts`, extend the options type:

```ts
export interface ToMessagesOptions {
  /** When given, replaces the stored system prompt for this render. */
  systemPrompt?: string;
  /**
   * How an executed action is rendered. "observation" is upstream's CodeAgent form: one
   * assistant turn and one Observation turn. "tool-messages" is the tool-calling form:
   * tool_calls on the assistant turn, then one role "tool" message per result.
   */
  toolResults?: "observation" | "tool-messages";
}
```

Replace the `case "action":` block in `toMessages()`:

```ts
case "action": {
  const calls = step.toolCalls ?? [];
  if (options.toolResults === "tool-messages" && calls.length > 0) {
    messages.push({
      role: "assistant",
      content: step.modelOutput ?? "",
      toolCalls: calls.map((call) => ({
        id: call.id,
        name: call.name,
        arguments: JSON.stringify(call.arguments ?? {}),
      })),
    });
    for (const call of calls) {
      messages.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: call.error === undefined ? stringifyOutput(call.result) : "Error: " + call.error,
      });
    }
    break;
  }
  if (step.modelOutput !== null) {
    messages.push({ role: "assistant", content: step.modelOutput });
  }
  if (step.observations !== null) {
    messages.push({ role: "user", content: "Observation:\n" + step.observations });
  }
  break;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run --project core packages/core/test/memory.test.ts`
Expected: PASS.

- [ ] **Step 5: Give the agents their transcript forms**

In `multi-step-agent.ts`, add next to the other protected getters:

```ts
/** Which transcript form this agent's memory renders into. */
protected get transcriptStyle(): "observation" | "tool-messages" {
  return "observation";
}

/** Whether the advertised tools travel on the request. See Task 3. */
protected get advertisesTools(): boolean {
  return false;
}

/** The one place the transcript options are assembled. */
protected transcript(): ChatMessage[] {
  return this.memory.toMessages({
    systemPrompt: this.systemPrompt,
    toolResults: this.transcriptStyle,
  });
}
```

Replace all three `this.memory.toMessages({ systemPrompt: this.systemPrompt })` call sites
(`:217`, `:338`, `:399`) with `this.transcript()`.

In `tool-calling-agent.ts`, add:

```ts
protected override get transcriptStyle(): "observation" | "tool-messages" {
  return "tool-messages";
}
```

- [ ] **Step 6: Prove the CodeAgent transcript did not move**

Run: `pnpm vitest run --project core`
Expected: PASS — 27 files, and the count is now higher than 273 only by the tests this plan
adds. In particular `code-agent.test.ts` and the golden transcript must pass untouched.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/memory/memory.ts packages/core/src/agent/
git commit -m "feat(core): render a tool-calling transcript for the tool-calling agent"
```

---

## Task 3: advertise the tools, and keep tool calls and usage on the streaming path

**Files:**
- Modify: `packages/core/src/model.ts` (`ChatCompletionChunk`, `collectCompletion`, new accumulator)
- Modify: `packages/core/src/agent/multi-step-agent.ts:356-392`
- Modify: `packages/core/src/agent/tool-calling-agent.ts`
- Test: `packages/core/test/model.test.ts`, `packages/core/test/tool-calling-agent.test.ts`

Only the ToolCallingAgent advertises tools: upstream's CodeAgent renders them into the prompt
and sends none on the request, and changing that would move the golden fixture.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/test/model.test.ts`:

```ts
import { ToolCallAccumulator } from "../src/model.js";

it("accumulates streamed tool-call deltas by index", () => {
  const acc = new ToolCallAccumulator();
  acc.accept({ index: 0, id: "call_a", name: "add", argumentsDelta: '{"a":' });
  acc.accept({ index: 0, argumentsDelta: "2}" });
  acc.accept({ index: 1, id: "call_b", name: "mul", argumentsDelta: "{}" });

  expect(acc.finish()).toEqual([
    { id: "call_a", name: "add", arguments: '{"a":2}' },
    { id: "call_b", name: "mul", arguments: "{}" },
  ]);
});

it("keeps the usage a stream reports on its final chunk", async () => {
  async function* chunks(): AsyncIterable<ChatCompletionChunk> {
    yield { delta: "hi", usage: { inputTokens: 7, outputTokens: 2, totalTokens: 9 } };
  }
  const completion = await collectCompletion(chunks());
  expect(completion.content).toBe("hi");
});
```

Append to `packages/core/test/tool-calling-agent.test.ts` — a model that records the options
it was handed:

```ts
it("advertises the tool schemas on the request", async () => {
  const seen: GenerateOptions[] = [];
  const model = new MockModel({
    completions: [{ content: "", toolCalls: [call("final_answer", { answer: 1 })] }],
    onGenerate: (options) => seen.push(options),
  });
  const agent = new ToolCallingAgent({
    model,
    tools: [tool({ name: "add", description: "add", inputSchema: z.object({ a: z.number() }), execute: () => 3 })],
  });
  await agent.run("sum");

  expect(seen[0]?.tools?.map((spec) => spec.name)).toEqual(["add", "final_answer"]);
});
```

If `MockModel` has no `onGenerate` hook, add one in this task (an optional callback invoked at
the top of `generate`), and assert with it rather than reaching into the model's state. If
`final_answer` is not registered as a tool, expect `["add"]` instead.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run --project core packages/core/test/model.test.ts packages/core/test/tool-calling-agent.test.ts`
Expected: FAIL — `ToolCallAccumulator` is not exported, and `seen[0].tools` is `undefined`.

- [ ] **Step 3: Add chunk usage and the accumulator**

In `model.ts`:

```ts
export interface ChatCompletionChunk {
  delta: string;
  toolCallDelta?: ToolCallDelta;
  finishReason?: FinishReason;
  /**
   * Present on a stream's final chunk when the provider reports usage. Without it a
   * streamed run cannot account for tokens at all.
   */
  usage?: TokenUsage;
}

/** Accumulates streamed tool-call deltas into whole calls, in index order. */
export class ToolCallAccumulator {
  private readonly open = new Map<number, ToolCallRequest>();

  accept(delta: ToolCallDelta): void {
    const existing = this.open.get(delta.index) ?? { id: "", name: "", arguments: "" };
    if (delta.id !== undefined) existing.id = delta.id;
    if (delta.name !== undefined) existing.name = delta.name;
    if (delta.argumentsDelta !== undefined) existing.arguments += delta.argumentsDelta;
    this.open.set(delta.index, existing);
  }

  finish(): ToolCallRequest[] {
    return [...this.open.entries()].sort(([a], [b]) => a - b).map(([, call]) => call);
  }
}
```

Rewrite `collectCompletion` to use it:

```ts
export async function collectCompletion(
  chunks: AsyncIterable<ChatCompletionChunk>,
  usage: TokenUsage = EMPTY_TOKEN_USAGE,
): Promise<ChatCompletion> {
  let content = "";
  let finishReason: FinishReason = "stop";
  const accumulator = new ToolCallAccumulator();

  for await (const chunk of chunks) {
    content += chunk.delta;
    if (chunk.toolCallDelta !== undefined) accumulator.accept(chunk.toolCallDelta);
    if (chunk.finishReason !== undefined) finishReason = chunk.finishReason;
  }

  return { content, toolCalls: accumulator.finish(), usage: { ...usage }, finishReason };
}
```

- [ ] **Step 4: Pass the tools, and keep the stream's calls and usage**

In `multi-step-agent.ts`, replace the two `{ signal: context.signal }` arguments:

```ts
/** The request options for one model turn, assembled in one place. */
private modelOptions(context: RunContext): GenerateOptions {
  const options: GenerateOptions = { signal: context.signal };
  if (this.advertisesTools) {
    const tools = this.tools.toSpecs();
    if (tools.length > 0) options.tools = tools;
  }
  return options;
}
```

Replace the whole streaming branch of `streamCompletion` with a form that keeps tools and
usage:

```ts
if (this.prefersStreaming && this.model.capabilities.streaming) {
  const startedAt = Date.now();
  const options = this.modelOptions(context);
  const accumulator = new ToolCallAccumulator();
  let text = "";
  let finishReason: FinishReason = "stop";
  let streamUsage: TokenUsage | undefined;

  for await (const chunk of this.model.generateStream(messages, options)) {
    if (chunk.delta !== "") {
      text += chunk.delta;
      yield this.emit(
        kind === "planning"
          ? { type: "planning.delta", stepIndex, text: chunk.delta }
          : { type: "message.delta", text: chunk.delta },
      );
    }
    if (chunk.toolCallDelta !== undefined) accumulator.accept(chunk.toolCallDelta);
    if (chunk.finishReason !== undefined) finishReason = chunk.finishReason;
    if (chunk.usage !== undefined) streamUsage = chunk.usage;
  }

  if (streamUsage !== undefined) {
    this.monitor.record(this.model.id, streamUsage, Date.now() - startedAt);
    context.usage = addTokenUsage(context.usage, streamUsage);
  }
  yield this.emit({ type: "usage.updated", usage: context.usage });
  return { content: text, toolCalls: accumulator.finish(), usage: streamUsage ?? EMPTY_TOKEN_USAGE, finishReason };
}
```

Delete the comment at `:373` that says a chunk carries no usage; it is no longer true.
Replace `:380` with `await this.model.generate(messages, this.modelOptions(context))`.

- [ ] **Step 5: Turn the advertisement on for the tool-calling agent**

In `tool-calling-agent.ts`:

```ts
protected override get advertisesTools(): boolean {
  return true;
}
```

- [ ] **Step 6: Run it and watch it pass**

Run: `pnpm vitest run --project core`
Expected: PASS, all files.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/model.ts packages/core/src/agent packages/core/src/testing packages/core/test
git commit -m "feat(core): advertise tools and keep streamed tool calls and usage"
```

---

## Task 4: the session records a tool call whichever event arrives first

**Files:**
- Modify: `packages/core/src/session/agent-session.ts:240-262`
- Test: `packages/core/test/agent-session-toolcalls.test.ts`

The tool-calling agent emits `action.failed` **before** `action.requested` on all three of its
failure paths (`tool-calling-agent.ts:77, 96, 108`), and it emits `toolcalls.requested` first of
all (`:56`). Today the session drops any event whose `callId` it has not seen, so a real run
records nothing while the agent's own memory records everything. The fix is to make recording
idempotent by `callId` instead of order-dependent.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/agent-session-toolcalls.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AgentSession } from "../src/session/agent-session.js";

describe("AgentSession tool calls", () => {
  it("records a failed call that arrives before action.requested", () => {
    const session = new AgentSession();
    session.apply({ type: "run.started", runId: "r1", task: "t" });
    session.apply({ type: "step.started", stepIndex: 0 });
    session.apply({
      type: "toolcalls.requested",
      stepIndex: 0,
      calls: [{ id: "call_1", name: "add", arguments: { a: 1 } }],
    });
    session.apply({
      type: "action.failed",
      callId: "call_1",
      name: "add",
      error: { name: "AgentToolCallError", message: "boom", code: "AGENT_TOOL_CALL" },
    });

    const step = session.snapshot.steps[0];
    expect(step?.toolCalls).toEqual([
      { id: "call_1", name: "add", args: { a: 1 }, status: "error", error: "boom" },
    ]);
  });
});
```

Adjust the `apply`/snapshot accessor names to the real ones in `agent-session.ts` rather than
inventing them; the event payloads above are the contract and must match `src/events.ts`.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run --project core packages/core/test/agent-session-toolcalls.test.ts`
Expected: FAIL — `toolCalls` is empty, because `action.failed` finds no call to mark.

- [ ] **Step 3: Record by callId, creating on miss**

In the `switch` in `agent-session.ts`, replace the three cases at `:240-262` with:

```ts
case "toolcalls.requested": {
  const step = this.openStep();
  if (step === undefined) return;
  for (const call of event.calls) this.recordCall(step, call.id, call.name, call.arguments);
  return;
}

case "action.requested": {
  const step = this.openStep();
  if (step === undefined) return;
  this.recordCall(step, event.callId, event.name, event.args);
  return;
}

case "action.result": {
  const step = this.openStep();
  if (step === undefined) return;
  const call = this.recordCall(step, event.callId, event.name, undefined);
  call.status = "ok";
  call.output = event.output;
  call.durationMs = event.durationMs;
  return;
}

case "action.failed": {
  const step = this.openStep();
  if (step === undefined) return;
  const call = this.recordCall(step, event.callId, event.name, undefined);
  call.status = "error";
  call.error = event.error.message;
  return;
}
```

Replace the `findCall` helper with `recordCall`, keeping the existing snapshot call type:

```ts
/**
 * The call for callId, created if this is the first event to mention it. Events arrive in
 * whatever order the agent emitted them, and a failure can be reported before a request,
 * so the store converges on the call rather than requiring the happy order.
 */
private recordCall(step: DraftStep, id: string, name: string, args: unknown): SnapshotToolCall {
  const existing = step.toolCalls.find((call) => call.id === id);
  if (existing !== undefined) {
    if (args !== undefined) existing.args = args;
    return existing;
  }
  const created: SnapshotToolCall = { id, name, args, status: "pending" };
  step.toolCalls.push(created);
  return created;
}
```

Substitute the real names for `DraftStep` and `SnapshotToolCall` from the file.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run --project core packages/core/test/agent-session-toolcalls.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the existing session suite for regressions**

Run: `pnpm vitest run --project core packages/core/test/agent-session.test.ts`
Expected: PASS, unchanged.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/session/agent-session.ts packages/core/test/agent-session-toolcalls.test.ts
git commit -m "fix(core): record tool calls in any arrival order"
```

---

## Task 5: the `models` package gets a transport it cannot bypass

**Files:**
- Modify: `packages/models/package.json`
- Modify: `packages/models/tsup.config.ts`, `packages/models/vitest.config.ts`
- Modify: `tsconfig.base.json`
- Create: `packages/models/src/transport.ts`
- Test: `packages/models/test/transport.test.ts`

- [ ] **Step 1: Declare the dependency and the resolution for it**

`packages/models/package.json`:

```json
  "dependencies": { "@smolagents-ts/core": "workspace:*", "zod": "^4.0.0" }
```

`tsconfig.base.json`, under `compilerOptions`:

```json
    "paths": { "@smolagents-ts/core": ["./packages/core/src/index.ts"] },
```

The path mapping exists so `pnpm typecheck` works on a fresh clone: the gate runs
`typecheck` before `build`, and core's `dist` does not exist yet at that point.

`packages/models/tsup.config.ts`: `"external": ["zod", "@smolagents-ts/core"]`.

`packages/models/vitest.config.ts` — resolve to source so tests need no prior build:

```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "models" },
  resolve: {
    alias: { "@smolagents-ts/core": new URL("../core/src/index.ts", import.meta.url).pathname },
  },
});
```

- [ ] **Step 2: Link the workspace**

Run: `pnpm install`
Expected: exit 0, and `packages/models/node_modules/@smolagents-ts/core` now exists.

- [ ] **Step 3: Write the failing test**

Create `packages/models/test/transport.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { HttpError, resolveFetch, withQuery } from "../src/transport.ts";

describe("resolveFetch", () => {
  it("prefers the injected transport", () => {
    const injected = (() => Promise.reject(new Error("unused"))) as unknown as typeof fetch;
    expect(resolveFetch(injected)).toBe(injected);
  });

  it("falls back to the global fetch", () => {
    expect(resolveFetch()).toBe(globalThis.fetch);
  });
});

describe("HttpError", () => {
  it("carries status, body and url", () => {
    const error = new HttpError(429, "slow down", "https://example.test/v1/chat/completions");
    expect(error.status).toBe(429);
    expect(error.message).toContain("429");
    expect(error.message).toContain("slow down");
    expect(error.url).toBe("https://example.test/v1/chat/completions");
  });
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `pnpm vitest run --project models packages/models/test/transport.test.ts`
Expected: FAIL — `../src/transport.ts` does not exist.

- [ ] **Step 5: Write `src/transport.ts`**

```ts
/**
 * The one place an adapter is allowed to reach the network. fetch is injected rather than
 * imported so a test drives a recorded fixture, a browser tab uses its own fetch, and this
 * package never imports a node builtin.
 */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export function resolveFetch(fetchImpl?: FetchLike): FetchLike {
  if (fetchImpl !== undefined) return fetchImpl;
  const global = globalThis.fetch;
  if (typeof global !== "function") {
    throw new Error("No fetch available: pass options.fetch in an environment without one");
  }
  return global as unknown as FetchLike;
}

/** An HTTP response the provider rejected, carrying enough to explain it. */
export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: string;

  constructor(status: number, body: string, url: string) {
    super("HTTP " + String(status) + " from " + url + ": " + body.slice(0, 300));
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

export function joinUrl(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/+$/, "") + path;
}
```

Drop `withQuery` from the test's import if nothing needs it yet — an unused export is a
placeholder. Keep the test to `resolveFetch` and `HttpError`.

- [ ] **Step 6: Verify the new dependency resolves in a packed consumer**

Run: `pnpm pack:smoke`
Expected: `pack-smoke OK: 5 packages installed and imported from tarballs`.

This is the pre-registered assumption: npm installs all five tarballs in one command, and
`models` requires `@smolagents-ts/core@0.0.0` after pnpm rewrites `workspace:*`. If npm
instead tries the registry and fails, change the dependency to
`"peerDependencies": { "@smolagents-ts/core": "0.0.0" }` plus the same entry in
`devDependencies`, re-run, and record which form was needed in the task report.

- [ ] **Step 7: Commit**

```bash
git add packages/models/package.json packages/models/tsup.config.ts packages/models/vitest.config.ts packages/models/src/transport.ts packages/models/test/transport.test.ts tsconfig.base.json pnpm-lock.yaml
git commit -m "feat(models): add the injected HTTP transport"
```

---

## Task 6: an SSE reader that does not buffer the whole answer

**Files:**
- Create: `packages/models/src/sse.ts`
- Test: `packages/models/test/sse.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/models/test/sse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseSse } from "../src/sse.ts";

function body(...parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const event of parseSse(stream)) out.push(event.data);
  return out;
}

describe("parseSse", () => {
  it("yields one event per data line", async () => {
    const events = await collect(body('data: {"a":1}\n\n', 'data: {"a":2}\n\n', "data: [DONE]\n\n"));
    expect(events).toEqual(['{"a":1}', '{"a":2}', "[DONE]"]);
  });

  it("reassembles an event split across chunks", async () => {
    const events = await collect(body('data: {"a', '":1}\n', "\ndata: [DONE]\n\n"));
    expect(events).toEqual(['{"a":1}', "[DONE]"]);
  });

  it("ignores comments and blank keep-alives", async () => {
    const events = await collect(body(": keep-alive\n\n", 'data: {"a":1}\n\n'));
    expect(events).toEqual(['{"a":1}']);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run --project models packages/models/test/sse.test.ts`
Expected: FAIL — `../src/sse.ts` does not exist.

- [ ] **Step 3: Write `src/sse.ts`**

```ts
export interface SseEvent {
  event?: string;
  data: string;
}

/**
 * Server-sent events over a byte stream, per the WHATWG event-stream rules this project's
 * providers actually emit: lines are separated by LF, an event ends at a blank line, a line
 * beginning with ":" is a comment, and a "data:" line contributes its value plus LF.
 * Decoding is incremental so a multi-byte character split across chunks survives.
 */
export async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  let eventName: string | undefined;

  function flush(): SseEvent | undefined {
    if (data.length === 0) {
      eventName = undefined;
      return undefined;
    }
    const value = data.join("\n");
    data = [];
    const name = eventName;
    eventName = undefined;
    return name === undefined ? { data: value } : { event: name, data: value };
  }

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index = buffer.indexOf("\n");
      while (index !== -1) {
        const line = buffer.slice(0, index).replace(/\r$/, "");
        buffer = buffer.slice(index + 1);
        if (line === "") {
          const event = flush();
          if (event !== undefined) yield event;
        } else if (!line.startsWith(":")) {
          const colon = line.indexOf(":");
          const field = colon === -1 ? line : line.slice(0, colon);
          let rest = colon === -1 ? "" : line.slice(colon + 1);
          if (rest.startsWith(" ")) rest = rest.slice(1);
          if (field === "data") data.push(rest);
          else if (field === "event") eventName = rest;
        }
        index = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    if (buffer !== "" && !buffer.startsWith(":")) {
      const colon = buffer.indexOf(":");
      if (colon === -1 || buffer.slice(0, colon) === "data") {
        data.push(colon === -1 ? buffer : buffer.slice(colon + 1).replace(/^ /, ""));
      }
    }
    const last = flush();
    if (last !== undefined) yield last;
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run --project models packages/models/test/sse.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/models/src/sse.ts packages/models/test/sse.test.ts
git commit -m "feat(models): add an incremental SSE reader"
```

---

## Task 7: `OpenAICompatibleModel.generate()`

**Files:**
- Create: `packages/models/src/openai-compatible.ts`
- Create: `packages/models/test/fixtures/openai/completion.json`, `completion-tools.json`, `completion-usage.json`, `error-401.json`
- Test: `packages/models/test/openai-compatible.test.ts`

- [ ] **Step 1: Write the fixtures**

`completion.json`:

```json
{
  "id": "chatcmpl-1",
  "object": "chat.completion",
  "model": "test-model",
  "choices": [{ "index": 0, "message": { "role": "assistant", "content": "hello" }, "finish_reason": "stop" }],
  "usage": { "prompt_tokens": 11, "completion_tokens": 2, "total_tokens": 13 }
}
```

`completion-tools.json`: the same shape, with
`"message": { "role": "assistant", "content": null, "tool_calls": [ { "id": "call_a", "type": "function", "function": { "name": "add", "arguments": "{\"a\":2,\"b\":3}" } } ] }`
and `"finish_reason": "tool_calls"`.

`completion-usage.json`: a response whose `usage` is absent, to prove the fallback.

`error-401.json`: `{ "error": { "message": "Incorrect API key provided", "type": "invalid_request_error" } }`.

- [ ] **Step 2: Write the failing test**

Create `packages/models/test/openai-compatible.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OpenAICompatibleModel } from "../src/openai-compatible.ts";

const fixture = (name: string): string =>
  readFileSync(new URL("./fixtures/openai/" + name, import.meta.url), "utf8");

function respondWith(body: string, status = 200): { calls: Array<{ url: string; init: RequestInit }>; fetch: typeof fetch } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(body, { status, headers: { "content-type": "application/json" } }));
  }) as unknown as typeof fetch;
  return { calls, fetch: fetchImpl };
}

describe("OpenAICompatibleModel.generate", () => {
  it("maps messages, content and usage", async () => {
    const { calls, fetch } = respondWith(fixture("completion.json"));
    const model = new OpenAICompatibleModel({ model: "test-model", apiKey: "sk-test", fetch });

    const completion = await model.generate([
      { role: "system", content: "be brief" },
      { role: "user", content: "hi" },
    ]);

    expect(calls[0]?.url).toBe("https://api.openai.com/v1/chat/completions");
    const sent = JSON.parse(String(calls[0]?.init.body));
    expect(sent.model).toBe("test-model");
    expect(sent.messages).toEqual([
      { role: "system", content: "be brief" },
      { role: "user", content: "hi" },
    ]);
    expect(sent.stream).toBe(false);
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
    expect(completion.content).toBe("hello");
    expect(completion.finishReason).toBe("stop");
    expect(completion.usage).toEqual({ inputTokens: 11, outputTokens: 2, totalTokens: 13 });
  });

  it("advertises tools and maps the tool calls back", async () => {
    const { calls, fetch } = respondWith(fixture("completion-tools.json"));
    const model = new OpenAICompatibleModel({ model: "test-model", fetch });

    const completion = await model.generate([{ role: "user", content: "add" }], {
      tools: [{ name: "add", description: "add two numbers", inputSchema: { type: "object", properties: { a: { type: "number" } } } }],
    });

    const sent = JSON.parse(String(calls[0]?.init.body));
    expect(sent.tools).toEqual([
      {
        type: "function",
        function: {
          name: "add",
          description: "add two numbers",
          parameters: { type: "object", properties: { a: { type: "number" } } },
        },
      },
    ]);
    expect(sent.tool_choice).toBe("auto");
    expect(completion.finishReason).toBe("tool_calls");
    expect(completion.toolCalls).toEqual([{ id: "call_a", name: "add", arguments: '{"a":2,"b":3}' }]);
  });

  it("falls back to an empty usage", async () => {
    const { fetch } = respondWith(fixture("completion-usage.json"));
    const model = new OpenAICompatibleModel({ model: "test-model", fetch });
    const completion = await model.generate([{ role: "user", content: "hi" }]);
    expect(completion.usage).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it("throws HttpError with the provider's message", async () => {
    const { fetch } = respondWith(fixture("error-401.json"), 401);
    const model = new OpenAICompatibleModel({ model: "test-model", fetch });
    await expect(model.generate([{ role: "user", content: "hi" }])).rejects.toThrow(/401/);
  });
});
```

- [ ] **Step 2b: Run it and watch it fail**

Run: `pnpm vitest run --project models packages/models/test/openai-compatible.test.ts`
Expected: FAIL — `../src/openai-compatible.ts` does not exist.

- [ ] **Step 3: Write `src/openai-compatible.ts` through `generate()`**

```ts
import {
  type ChatCompletion,
  type ChatCompletionChunk,
  type ChatMessage,
  type FinishReason,
  type GenerateOptions,
  type Model,
  type ModelCapabilities,
  type TokenUsage,
  type ToolCallRequest,
  type ToolSpec,
  EMPTY_TOKEN_USAGE,
  modelCapabilities,
} from "@smolagents-ts/core";
import { HttpError, joinUrl, resolveFetch, type FetchLike } from "./transport.ts";

export interface OpenAICompatibleOptions {
  /** The provider's model name, e.g. "gpt-4o-mini" or "llama3.1:8b". */
  model: string;
  /** Defaults to https://api.openai.com/v1. */
  baseUrl?: string;
  apiKey?: string;
  /** Extra headers, for gateways and routers that need their own. */
  headers?: Readonly<Record<string, string>>;
  /** Defaults to the global fetch. Injected in every test. */
  fetch?: FetchLike;
  /** Overrides for this model's capabilities. */
  capabilities?: Partial<ModelCapabilities>;
  /** Stable id. Defaults to the model name. */
  id?: string;
  provider?: string;
}

interface WireMessage {
  role: string;
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
}

interface WireCompletion {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export class OpenAICompatibleModel implements Model {
  readonly id: string;
  readonly provider: string;
  readonly capabilities: ModelCapabilities;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly headers: Readonly<Record<string, string>>;
  private readonly fetchImpl: FetchLike;

  constructor(options: OpenAICompatibleOptions) {
    this.model = options.model;
    this.id = options.id ?? options.model;
    this.provider = options.provider ?? "openai-compatible";
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    this.apiKey = options.apiKey;
    this.headers = options.headers ?? {};
    this.fetchImpl = resolveFetch(options.fetch);
    this.capabilities = modelCapabilities({ toolCalls: true, ...options.capabilities });
  }

  async generate(messages: readonly ChatMessage[], options: GenerateOptions = {}): Promise<ChatCompletion> {
    const body = this.buildBody(messages, options, false);
    const response = await this.fetchImpl(joinUrl(this.baseUrl, "/chat/completions"), {
      method: "POST",
      headers: this.requestHeaders(),
      body: JSON.stringify(body),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    const text = await response.text();
    if (!response.ok) throw new HttpError(response.status, text, joinUrl(this.baseUrl, "/chat/completions"));
    return toCompletion(JSON.parse(text) as WireCompletion);
  }

  async *generateStream(
    _messages: readonly ChatMessage[],
    _options: GenerateOptions = {},
  ): AsyncIterable<ChatCompletionChunk> {
    throw new Error("generateStream lands in Task 8");
  }
  // ... private buildBody, requestHeaders helpers in this task
}
```

Also write, in the same file:

```ts
function requestHeaders(key: string | undefined, extra: Readonly<Record<string, string>>): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json", ...extra };
  if (key !== undefined) headers.authorization = "Bearer " + key;
  return headers;
}

function toWireMessages(messages: readonly ChatMessage[], systemPrompt: string | undefined): WireMessage[] {
  const out: WireMessage[] = [];
  if (systemPrompt !== undefined) out.push({ role: "system", content: systemPrompt });
  for (const message of messages) {
    if (message.role === "tool") {
      out.push({
        role: "tool",
        content: message.content,
        tool_call_id: message.toolCallId ?? "",
        ...(message.name === undefined ? {} : { name: message.name }),
      });
      continue;
    }
    if (message.role === "assistant" && (message.toolCalls?.length ?? 0) > 0) {
      out.push({
        role: "assistant",
        content: message.content === "" ? null : message.content,
        tool_calls: (message.toolCalls ?? []).map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: call.arguments },
        })),
      });
      continue;
    }
    out.push({ role: message.role, content: message.content });
  }
  return out;
}

function toFinishReason(raw: string | undefined): FinishReason {
  if (raw === "stop" || raw === "tool_calls" || raw === "length") return raw;
  return "other";
}

export function toCompletion(wire: WireCompletion): ChatCompletion {
  const choice = wire.choices?.[0];
  const calls: ToolCallRequest[] = (choice?.message?.tool_calls ?? []).map((call, index) => ({
    id: call.id ?? "call_" + String(index),
    name: call.function?.name ?? "",
    arguments: call.function?.arguments ?? "",
  }));
  const usage: TokenUsage =
    wire.usage === undefined
      ? EMPTY_TOKEN_USAGE
      : {
          inputTokens: wire.usage.prompt_tokens ?? 0,
          outputTokens: wire.usage.completion_tokens ?? 0,
          totalTokens: wire.usage.total_tokens ?? 0,
        };
  return {
    content: choice?.message?.content ?? "",
    toolCalls: calls,
    usage,
    finishReason: toFinishReason(choice?.finish_reason),
  };
}
```

`buildBody` and `requestHeaders` become private methods reading the instance fields:
`buildBody` returns `{ model, messages, stream, ...temperature/max_tokens/stop as given, ...tools as functions, tool_choice: "auto" }`.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run --project models packages/models/test/openai-compatible.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/models/src/openai-compatible.ts packages/models/test/openai-compatible.test.ts packages/models/test/fixtures
git commit -m "feat(models): map the OpenAI-compatible chat completion wire format"
```

---

## Task 8: streaming, and the `CustomModel` escape hatch

**Files:**
- Modify: `packages/models/src/openai-compatible.ts`
- Create: `packages/models/src/custom.ts`
- Create: `packages/models/test/fixtures/openai/stream.sse`, `stream-tools.sse`
- Test: `packages/models/test/openai-compatible.test.ts`, `packages/models/test/custom.test.ts`

- [ ] **Step 1: Write the streaming and custom fixtures/tests**

`stream.sse` — three chunks then `[DONE]`, the last carrying usage:

```text
data: {"choices":[{"index":0,"delta":{"content":"Hel"}}]}

data: {"choices":[{"index":0,"delta":{"content":"lo"},"finish_reason":"stop"}]}

data: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}

data: [DONE]

```

`stream-tools.sse` — a tool call split across two chunks:

```text
data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"add","arguments":"{\"a\":"}}]}}]}

data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"2}"}}]},"finish_reason":"tool_calls"}]}

data: [DONE]

```

Test, appended to `openai-compatible.test.ts`:

```ts
it("streams deltas, the streamed tool call and the final usage", async () => {
  const body = fixture("stream-tools.sse");
  const fetchImpl = (() => Promise.resolve(new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }))) as unknown as typeof fetch;
  const model = new OpenAICompatibleModel({ model: "test-model", fetch: fetchImpl });

  const chunks: ChatCompletionChunk[] = [];
  for await (const chunk of model.generateStream([{ role: "user", content: "add" }])) chunks.push(chunk);

  expect(chunks.filter((c) => c.delta !== "").length).toBe(0);
  expect(chunks.at(-1)?.finishReason).toBe("tool_calls");
  expect(chunks.at(-1)?.usage).toBeUndefined();
});
```

and a second test over `stream.sse` asserting the deltas reassemble to `"Hello"` and that the
last chunk carries `{ inputTokens: 5, outputTokens: 2, totalTokens: 7 }`.

Create `custom.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CustomModel } from "../src/custom.ts";

describe("CustomModel", () => {
  it("delegates generate and reports what it was told", async () => {
    const seen: string[] = [];
    const model = new CustomModel({
      id: "mine",
      generate: (messages) => {
        seen.push(messages.at(-1)?.content ?? "");
        return Promise.resolve({ content: "ok", toolCalls: [], usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, finishReason: "stop" as const });
      },
    });

    const completion = await model.generate([{ role: "user", content: "ping" }]);
    expect(completion.content).toBe("ok");
    expect(seen).toEqual(["ping"]);
    expect(model.capabilities.streaming).toBe(false);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm vitest run --project models packages/models/test/custom.test.ts packages/models/test/openai-compatible.test.ts`
Expected: FAIL — `generateStream` throws the Task 7 placeholder, and `custom.ts` does not exist.

- [ ] **Step 3: Implement `generateStream`**

Replace the placeholder body:

```ts
async *generateStream(messages: readonly ChatMessage[], options: GenerateOptions = {}): AsyncIterable<ChatCompletionChunk> {
  const url = joinUrl(this.baseUrl, "/chat/completions");
  const response = await this.fetchImpl(url, {
    method: "POST",
    headers: this.requestHeaders(),
    body: JSON.stringify(this.buildBody(messages, options, true)),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  if (!response.ok) throw new HttpError(response.status, await response.text(), url);
  if (response.body === null) throw new Error("The provider returned a stream with no body");
  for await (const event of parseSse(response.body)) {
    if (event.data === "[DONE]") return;
    let parsed: WireStreamChunk;
    try {
      parsed = JSON.parse(event.data) as WireStreamChunk;
    } catch {
      throw new Error("The provider sent a data event that is not JSON: " + event.data.slice(0, 120));
    }
    yield toChunk(parsed);
  }
}
```

with, in the same file:

```ts
interface WireStreamChunk {
  choices?: Array<{
    delta?: { content?: string | null; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export function toChunk(wire: WireStreamChunk): ChatCompletionChunk {
  const choice = wire.choices?.[0];
  const call = choice?.delta?.tool_calls?.[0];
  const chunk: ChatCompletionChunk = { delta: choice?.delta?.content ?? "" };
  if (call !== undefined) {
    const delta: ToolCallDelta = { index: call.index ?? 0 };
    if (call.id !== undefined) delta.id = call.id;
    if (call.function?.name !== undefined) delta.name = call.function.name;
    if (call.function?.arguments !== undefined) delta.argumentsDelta = call.function.arguments;
    chunk.toolCallDelta = delta;
  }
  if (choice?.finish_reason != null) chunk.finishReason = toFinishReason(choice.finish_reason);
  if (wire.usage !== undefined) {
    chunk.usage = {
      inputTokens: wire.usage.prompt_tokens ?? 0,
      outputTokens: wire.usage.completion_tokens ?? 0,
      totalTokens: wire.usage.total_tokens ?? 0,
    };
  }
  return chunk;
}
```

Also send `stream_options: { include_usage: true }` in the streaming body, so the usage chunk
arrives at all, and import `parseSse` and the `ToolCallDelta` type.

- [ ] **Step 4: Implement `CustomModel`**

```ts
import {
  type ChatCompletion,
  type ChatMessage,
  type GenerateOptions,
  type Model,
  type ModelCapabilities,
  modelCapabilities,
} from "@smolagents-ts/core";

export interface CustomModelOptions {
  id: string;
  generate: (messages: readonly ChatMessage[], options: GenerateOptions) => Promise<ChatCompletion>;
  /** Defaults to none: no stream, no tool calls. */
  capabilities?: Partial<ModelCapabilities>;
  provider?: string;
}

/**
 * The escape hatch the design record promises: a provider this project has no adapter for is
 * never unsupported, because a caller can hand in the two fields the Model interface needs.
 */
export class CustomModel implements Model {
  readonly id: string;
  readonly provider: string;
  readonly capabilities: ModelCapabilities;
  private readonly generateImpl: CustomModelOptions["generate"];

  constructor(options: CustomModelOptions) {
    this.id = options.id;
    this.provider = options.provider ?? "custom";
    this.capabilities = modelCapabilities({ ...options.capabilities, streaming: false });
    this.generateImpl = options.generate;
  }

  generate(messages: readonly ChatMessage[], options: GenerateOptions = {}): Promise<ChatCompletion> {
    return this.generateImpl(messages, options);
  }

  async *generateStream(): AsyncIterable<never> {
    throw new Error("This custom model declares no streaming support");
  }
}
```

- [ ] **Step 5: Run and watch them pass**

Run: `pnpm vitest run --project models`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/models/src packages/models/test
git commit -m "feat(models): stream OpenAI-compatible responses and add the custom escape hatch"
```

---

## Task 9: end to end over a recorded provider, then the surface and the docs

**Files:**
- Create: `packages/models/test/e2e.test.ts`, `packages/models/test/public-surface.test.ts`
- Modify: `packages/models/src/index.ts`, `packages/models/AGENTS.md`, `README.md`
- Modify: `docs/01-project.md` (milestone S2 note), `docs/03-handoff.md`, `docs/04-tasks.md`, `docs/05-memory.md` + shard

- [ ] **Step 1: Write the end-to-end test**

Create `packages/models/test/e2e.test.ts`. It drives a real `ToolCallingAgent` against an
`OpenAICompatibleModel` whose transport replays two recorded responses: one that calls the
`add` tool, one that calls `final_answer`. Assert the final output is `5`, the run state is
`success`, and the session snapshot now records the `add` call — the defect Task 4 fixed.

```ts
const responses = [fixture("turn-1-tool-call.json"), fixture("turn-2-final.json")];
const fetchImpl = (() => {
  const next = responses.shift();
  if (next === undefined) throw new Error("the agent asked for more turns than the fixture has");
  return Promise.resolve(new Response(next, { status: 200, headers: { "content-type": "application/json" } }));
}) as unknown as typeof fetch;

const model = new OpenAICompatibleModel({ model: "test-model", fetch: fetchImpl });
const agent = new ToolCallingAgent({
  model,
  tools: [tool({ name: "add", description: "add", inputSchema: z.object({ a: z.number(), b: z.number() }), execute: ({ a, b }) => a + b })],
});
const result = await agent.run("add 2 and 3");

expect(result.output).toBe(5);
expect(result.state).toBe("success");
```

Add the two fixture files under `test/fixtures/openai/` in the OpenAI wire shape.

- [ ] **Step 2: Run it and watch it pass**

Run: `pnpm vitest run --project models packages/models/test/e2e.test.ts`
Expected: PASS. If it fails because the loop never yields the second turn, the transcript is
wrong — check Task 2 Step 6 before changing this test.

- [ ] **Step 3: Pin the public surface**

`packages/models/src/index.ts`:

```ts
export { VERSION } from "./version.js";
export * from "./transport.js";
export * from "./sse.js";
export * from "./openai-compatible.js";
export * from "./custom.js";
```

Create `packages/models/test/public-surface.test.ts` in the style of the core one: import
`* as models`, and assert the exact sorted runtime name list. Then run it and paste the real
list the run reports — do not invent it:

```ts
it("exposes exactly the intended runtime names", () => {
  expect(Object.keys(models).sort()).toEqual([
    "CustomModel",
    "HttpError",
    "OpenAICompatibleModel",
    "VERSION",
    "joinUrl",
    "modelCapabilities",
    "parseSse",
    "resolveFetch",
    "toChunk",
    "toCompletion",
  ]);
});
```

Whatever the run actually reports is the list; an export added later must update this test.

- [ ] **Step 4: Run the whole gate**

Run: `pnpm gate`
Expected: exit 0 on all nine stages, with the new files included:
`pnpm vitest run --project models` reports more than the single smoke test, `depcruise`
reports a new `models → core` edge and no violation, and `pack:smoke` still reports
`5 packages installed and imported from tarballs`.

- [ ] **Step 5: Update the documents that now state something false**

- `packages/models/AGENTS.md` — replace the placeholder prose ("The package is a placeholder
  today", "no adapter exists", the 1-test expected result) with what is now true, and update
  the smallest validation command's expected count from the real run. Keep it under 6 KB.
- `README.md` — the Status section gains one sentence naming the supported adapter, and no
  more than that.
- `docs/01-project.md` — the S2 row's status stays `in progress`; its definition of reached
  is not met until S2b lands. Append a revision-log row.
- `docs/04-tasks.md` — move T-2 to done with evidence, and archive it per the task rules.
- `docs/05-memory.md` and `docs/memory/general.md` — one lesson if the wire mapping taught
  something the next adapter will need; none if it did not.
- `docs/03-handoff.md` — a new entry, newest first, inside the rotation markers.

- [ ] **Step 6: Commit**

```bash
git add packages/models README.md docs
git commit -m "feat(models): OpenAI-compatible adapter end to end, with the surface pinned"
```

---

## Definition of done

- `pnpm gate` exits 0, and `packages/models` is no longer a placeholder: it exports a working
  adapter, and `packages/models/test/e2e.test.ts` runs a `ToolCallingAgent` to a typed result
  over a recorded provider with no network access.
- `ToolRegistry.toSpecs()` has a caller in `src` (`multi-step-agent.ts`), and
  `packages/core/test/tool-calling-agent.test.ts` asserts the schemas reach the request.
- A streamed run reports usage and keeps tool calls; the two `ChatCompletionChunk` changes are
  covered by `model.test.ts`.
- `packages/core/test/agent-session-toolcalls.test.ts` passes, so a failed call is recorded.
- `packages/models/AGENTS.md` describes the package that exists, and its expected test count
  matches a real run.
- Decisions that this plan forces are recorded in `docs/09-decisions/`, not in code comments.

## What this plan deliberately does not do

- **Anthropic, Gemini and HuggingFace adapters** — S2b, a separate plan. Each is an
  independent wire format, and shipping the OpenAI-compatible one first does not depend on
  them.
- **Retries, rate-limit backoff, budgets or a gateway package** — design spec §7.1 tier 3.
- **Images and structured output** — the capability flags stay false until an adapter
  implements them; nothing here sends an image part or a response format.
- **The tool-calling system prompt's fidelity gap** — the 14-line template against upstream's
  243 lines is still open. It is a prompt problem, not a wire problem, and it needs the
  upstream clone at the pinned commit to be done honestly.
