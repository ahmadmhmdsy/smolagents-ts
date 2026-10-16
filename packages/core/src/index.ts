/**
 * @smolagents-ts/core — the agent runtime.
 *
 * Everything here is isomorphic: no node: imports, no Buffer, no process, no DOM, no React.
 * The architecture tests enforce that, and the CI matrix runs this package on Node, Bun,
 * Deno and a browser.
 */

// The version string the S0 smoke test asserts on. Kept as a named export so replacing
// this file cannot silently break it.
export { VERSION } from "./version.js";

// Foundations.
export * from "./types.js";
export * from "./errors.js";
export * from "./logger.js";
export * from "./events.js";

// The two seams a host can replace: which model answers, and where code runs.
export * from "./model.js";
export * from "./executor.js";

// Tools.
export * from "./tool/tool.js";
export * from "./tool/registry.js";

// Prompts. The templates themselves stay internal; only the fence and the builders are public.
export * from "./prompts/populate-template.js";
export { CODE_FENCE } from "./prompts/templates.js";
export {
  buildCodeAgentSystemPrompt,
  buildToolCallingAgentSystemPrompt,
} from "./prompts/system-prompt.js";

// Memory and accounting.
export * from "./memory/steps.js";
export * from "./memory/memory.js";
export * from "./monitoring/monitor.js";
export * from "./monitoring/trace.js";
export * from "./monitoring/eval.js";

// The runtime.
export * from "./agent/action.js";
export * from "./agent/run-result.js";
export * from "./agent/multi-step-agent.js";
export * from "./agent/code-agent.js";
export * from "./agent/tool-calling-agent.js";
export * from "./agent/managed-agent.js";
export * from "./agent/approval.js";
export * from "./agent/guardrail.js";
export * from "./middleware.js";
export * from "./session/agent-session.js";
export * from "./session/run-store.js";

// Utilities.
export * from "./utils/parse-code-blocks.js";
export * from "./utils/async-queue.js";

// Test doubles, published on purpose: they are the documented way to test an agent
// without a provider or a sandbox (design spec section 11).
export * from "./testing/mock-model.js";
export * from "./testing/scripted-executor.js";
