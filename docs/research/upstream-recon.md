# Upstream recon — huggingface/smolagents → TypeScript/JavaScript/React

**Date:** 2026-10-12
**Status:** research note (pre-design). Not an approved design; not implementation.
**Local clone:** `smolagents/` (git `96f33faaf028479119ec8d34507b47694cf14e34`, 2026-10-06, `__version__ = "1.27.0.dev0"`)
**License:** Apache-2.0 — a translation/derivative must keep the LICENSE, NOTICE-style attribution, and the copyright header. Trademark: "smolagents" and the 🤗 marks belong to Hugging Face; an unofficial port must say so.

---

## 1. Size of the transformation surface

| area | files | lines | note |
|---|---|---|---|
| `src/smolagents` | 18 (.py) + 4 (.yaml) | ~11,000 | the library |
| `tests` | 27 (.py) | ~11,000 | effectively the executable spec |
| `docs/source/en` | 24 pages | — | 5 other languages are translations of the same set |
| `examples` | 33 files | — | incl. open_deep_research, benchmark, server |

Source files by size (lines): models 1880, agents 1625, local_python_executor 1556, tools 1206,
remote_executors 902, default_tools 586, utils 487, serialization 435, gradio_ui 389,
_function_type_hints_utils 363, memory 260, cli 255, monitoring 229, agent_types 221,
vision_web_browser 204, mcp_client 142, tool_validation 228, __init__ 30.

---

## 2. Module-by-module translation map

| Python module | lines | TS/JS target | difficulty | why |
|---|---|---|---|---|
| `agents.py` | 1625 | `@smolagents/core` | **high** | ReAct loop, `RunResult`, streaming, callbacks, prompt templating, managed agents |
| `models.py` | 1880 | `@smolagents/models` | **high** | ~9 provider classes; `transformers`/`mlx`/`vllm` have no browser analogue |
| `local_python_executor.py` | 1556 | `@smolagents/exec-*` | **very high** | a hand-written Python **AST interpreter**. No 1:1 TS counterpart exists |
| `tools.py` | 1206 | `@smolagents/core` | **high** | decorators + runtime type introspection → must become schemas (Zod) |
| `remote_executors.py` | 902 | `@smolagents/exec-remote` | medium | E2B/Docker/Modal/Blaxel all have HTTP/JS SDKs |
| `default_tools.py` | 586 | `@smolagents/tools` | medium | web search, visit webpage, wikipedia, STT |
| `utils.py` | 487 | `@smolagents/core` | medium | `instance_to_source`, image base64, retrying, rate limit |
| `serialization.py` | 435 | `@smolagents/core` | medium | safe serializer for tool/agent round-trips |
| `gradio_ui.py` | 389 | `@smolagents/react` | **high** | this is the file React replaces outright |
| `_function_type_hints_utils.py` | 363 | `@smolagents/core` | **high** | Python type hints → JSON Schema; TS gets Zod instead |
| `memory.py` | 260 | `@smolagents/core` | low-med | step classes + callback registry; mostly mechanical |
| `tool_validation.py` | 228 | build/test tooling | low | Python-AST checks; becomes lint/type-level in TS |
| `monitoring.py` | 229 | `@smolagents/core` | low-med | Monitor, TokenUsage, Timing, AgentLogger |
| `agent_types.py` | 221 | `@smolagents/core` | medium | multimodal input/output typing |
| `cli.py` | 255 | `smolagents-ts` bin | low | arg parsing + REPL |
| `vision_web_browser.py` | 204 | example app | medium | Playwright replaces Selenium |
| `mcp_client.py` | 142 | `@smolagents/mcp` | medium | official TS MCP SDK exists |
| `prompts/*.yaml` | 4 files | `@smolagents/prompts` | low | prompt text; port verbatim, keep template semantics |

### Python-only constructs with no direct TS analogue
- **AST interpreter** (`local_python_executor`) — the single largest risk item.
- **Decorator + signature introspection** for tools (`tool`, `@tool`, `PipelineTool`).
- **Type hints → JSON Schema** (`_function_type_hints_utils`).
- **`PIL.Image` / `PIL.Audio`** — need Sharp / Web Audio / HTMLImageElement.
- **`transformers`, `mlx-lm`, `vLLM` local model backends** — server-side or WebGPU only.
- **`inspect.getsource` / `instance_to_source`** — used to re-emit custom tools as code the agent can read.
- **Gradio** — replaced by React.

---

## 3. Prior art (both incomplete; useful as reference, not as a base)

| project | shape | coverage | gap it leaves |
|---|---|---|---|
| `yusuf-eren/smolagents.js` | TS + Node, npm-published, zod tool validation, OpenAI-first | ToolCallingAgent, streaming, some tools | no CodeAgent/sandbox parity, one provider family, no React |
| `ikangai/smolagents-js` | browser-first ESM, ~340–480 LOC, zero deps, OpenRouter | ToolCallingAgent + CodeAgent writing **JavaScript** in an **iframe sandbox**, sub-agent orchestration, event system | tiny surface, no memory/step model, no model abstraction, not a library-grade package |

Both confirm the central finding: **nobody has ported the CodeAgent execution model faithfully**, and the two ports diverge exactly on the decision below (JS-in-sandbox vs. not-at-all). Neither has a React layer.

---

## 4. Ecosystem primitives available on the JS side
- **Model providers:** Vercel AI SDK (provider-agnostic, streaming, tool calls), or hand-rolled fetch adapters for OpenAI-compatible / Anthropic / Gemini / HF Inference.
- **Tool schemas:** Zod (+`zod-to-json-schema`), or Standard Schema for framework neutrality.
- **Sandboxed code execution:** `quickjs-emscripten` (WASM, deterministic, works in browser+Node), `isolated-vm` (Node, V8 isolates, fastest), SES/endo (hardened JS), Web Workers (browser, not a security boundary alone), iframes (weakest).
- **Real Python in JS:** Pyodide (CPython→WASM; heavy, ~10 MB+, but gives true Python semantics).
- **React:** hooks + headless components, following the `assistant-ui` / AI SDK UI `useChat` conventions.
- **HF Hub:** `@huggingface/hub` exists on npm.

---

## 5. The decisions that will shape everything

| # | decision | axes |
|---|---|---|
| D1 | **What language does a CodeAgent write, and where does it run?** | TS/JS in a sandbox · Python via Pyodide · no code agent (tools only) · pluggable |
| D2 | **Fidelity target** | API-parity (drop-in mental model) · concept-parity (idiomatic TS) · hybrid |
| D3 | **Model layer** | own fetch adapters · Vercel AI SDK provider layer · both (adapters behind a thin interface) |
| D4 | **Tool definition** | Zod-first · Standard Schema · JSON-Schema-first |
| D5 | **Package layout** | single package · npm monorepo with scoped packages |
| D6 | **React surface** | headless hooks only · hooks + styled components · hooks + components + devtools |
| D7 | **Runtime targets** | Node only · Node + browser · + edge/serverless |
| D8 | **Async style** | AsyncGenerator streaming · callbacks/EventEmitter · both |
| D9 | **Testing strategy** | port pytest→vitest · differential Python↔TS parity harness · both |
| D10 | **v1 scope cut** | which of the 18 modules ship first |

---

## 6. Recommended posture (to be confirmed, not assumed)
- **Concept-parity, not syntax-parity**: keep `CodeAgent` / `ToolCallingAgent` / `Tool` / step memory / `RunResult` as recognizable concepts, but rebuild them on TS primitives.
- **Pluggable execution backend** behind one `CodeExecutor` interface, so D1 becomes a swappable adapter rather than a fork in the road.
- Monorepo, because the surface genuinely splits (core / models / tools / exec / mcp / react / cli).
- Port the **test suite as the spec**, and add a differential harness that compares Python and TS agent transcripts on identical prompts.

---

## 7. Open questions for the user
1. Fidelity posture (D2) — the question asked first.
2. Execution model (D1).
3. Audience: Node backend, browser front-end, or both.
4. Whether "native" means publishable npm packages, or a working local library.
