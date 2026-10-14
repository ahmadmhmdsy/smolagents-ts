import { describeEvent, isTerminal } from "smolagents-ts";
import { expect, test } from "vitest";

import { main } from "../index.mjs";

test("the listener sees the whole stream and the session holds the finished run", async () => {
  const { events, result, snapshot } = await main();

  expect(events.length).toBeGreaterThan(0);
  const last = events[events.length - 1];
  expect(last.type).toBe("run.completed");
  expect(isTerminal(last.type)).toBe(true);

  const labels = events.map((event) => describeEvent(event));
  expect(labels).toContain("code");
  expect(labels).toContain("final answer");

  // The snapshot is the authoritative view the UI reads, converged from the events.
  expect(snapshot.status).toBe("success");
  expect(snapshot.isRunning).toBe(false);
  expect(snapshot.output).toBe(3);
  expect(snapshot.steps).toHaveLength(2);
  expect(snapshot.steps[0].code).toContain("nights");
  expect(snapshot.steps[0].observation).toBe("nights 3");
  expect(snapshot.steps[0].isFinalAnswer).toBe(false);
  expect(snapshot.steps[1].code).toBe("final_answer(3);");
  expect(snapshot.steps[1].isFinalAnswer).toBe(true);

  expect(result.output).toBe(3);
});
