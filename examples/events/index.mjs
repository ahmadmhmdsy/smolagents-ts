#!/usr/bin/env node
/**
 * Observing a run. The agent publishes a typed AgentEvent for everything that happens, and
 * a plain listener prints each one with describeEvent. In parallel, AgentSession keeps the
 * whole run as an immutable snapshot — status, steps, output, token usage — the same store
 * the React layer subscribes to. The model and the executor are the published testing
 * doubles, so the example runs offline.
 *
 * Run: node index.mjs
 */
import { pathToFileURL } from "node:url";
import {
  AgentSession,
  CODE_FENCE,
  CodeAgent,
  MockModel,
  ScriptedExecutor,
  describeEvent,
  finalAnswerResult,
  isTerminal,
} from "smolagents-ts";

const TASK = "Count three nights and answer with the number.";

const countCode = ["const nights = 3;", 'console.log("nights " + nights);'].join("\n");
const answerCode = "final_answer(3);";

function turn(thought, code) {
  return "Thought: " + thought + "\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

export async function main(options = {}) {
  const log = options.log ?? (() => {});

  const model = new MockModel([
    turn("Count the nights first.", countCode),
    turn("Answer with the count.", answerCode),
  ]);
  const executor = new ScriptedExecutor({
    results: {
      [countCode]: { logs: "nights 3", isFinalAnswer: false, durationMs: 1, toolCallCount: 0 },
      [answerCode]: finalAnswerResult(3),
    },
  });

  const agent = new CodeAgent({ model, executor, maxSteps: 4 });
  const events = [];
  agent.on((event) => {
    events.push(event);
    log(describeEvent(event) + "  (" + event.type + ")");
  });

  // send() drives the agent and folds its events into the snapshot.
  const session = new AgentSession(agent);
  const result = await session.send(TASK);
  return { events, result, snapshot: session.getSnapshot() };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { events, result, snapshot } = await main({ log: (line) => console.log("event: " + line) });
  const last = events[events.length - 1];
  console.log("");
  console.log("last event:    " + last.type + " (terminal: " + String(isTerminal(last.type)) + ")");
  console.log("session status " + snapshot.status);
  console.log("output:        " + JSON.stringify(snapshot.output));
  console.log("token usage:   " + JSON.stringify(snapshot.usage));
  for (const step of snapshot.steps) {
    console.log(
      "step " + String(step.stepIndex + 1) + ": code=" + JSON.stringify(step.code) +
        " observation=" + JSON.stringify(step.observation) +
        " final=" + String(step.isFinalAnswer),
    );
  }
  console.log("result output: " + JSON.stringify(result.output));
}
