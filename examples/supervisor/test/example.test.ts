import { expect, test } from "vitest";

import { main } from "../src/index.js";

/**
 * The supervisor routes on the typed report, not on the rendered text: the researcher's schema
 * passes and its value is used, the auditor's fails and the run holds.
 */
test("the supervisor publishes a value and holds on a schema failure", async () => {
  const outcome = await main();

  expect(outcome.route).toBe("hold");
  expect(outcome.reports.researcher.failure).toBeUndefined();
  expect(outcome.reports.researcher.value?.summary).toBe("Two new flags and one deprecation");
  expect(outcome.reports.researcher.value?.sources).toEqual(["CHANGELOG.md"]);

  expect(outcome.reports.auditor.value).toBeUndefined();
  expect(outcome.reports.auditor.failure?.kind).toBe("schema");
  expect(outcome.reports.auditor.failure?.name).toBe("ChildSchemaError");
  expect(outcome.reports.auditor.failure?.issues?.join(" ")).toContain("confidence");

  // The answer states both outcomes, and the failure it states is the typed one.
  expect(outcome.answer).toContain("Hold");
  expect(outcome.answer).toContain("Two new flags and one deprecation");
  expect(outcome.answer).toContain("ChildSchemaError");
});
