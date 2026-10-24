/**
 * A supervisor that routes on typed reports. Two managed agents are declared with an output
 * schema each: the researcher answers a valid shape, the auditor answers without the field its
 * schema requires. The supervisor calls both through `runManagedAgent`, which is the same path
 * the model-facing tool uses, and reads the typed report instead of the rendered text: a value
 * for the researcher, a schema failure for the auditor. Its answer and its route come from those
 * two reports, not from a model.
 *
 * The model is scripted, so the sample needs no provider and no network.
 *
 * Run: node --experimental-strip-types src/index.ts
 */
import { pathToFileURL } from "node:url";
import {
  MockModel,
  ToolCallingAgent,
  runManagedAgent,
  type ChildReport,
  type ManagedAgent,
} from "smolagents-ts";
import { z } from "zod";

export const TASK = "Summarize the release notes and audit them for missing migration steps.";

/** What the researcher must answer. */
export const RESEARCH_SCHEMA = z.object({
  summary: z.string(),
  sources: z.array(z.string()).min(1),
});

/** What the auditor must answer: the scripted answer omits `confidence`, so its check fails. */
export const AUDIT_SCHEMA = z.object({
  verdict: z.enum(["pass", "fail"]),
  findings: z.array(z.string()),
  confidence: z.number(),
});

export type Research = z.infer<typeof RESEARCH_SCHEMA>;
export type Audit = z.infer<typeof AUDIT_SCHEMA>;

/** What the supervisor decided and why. */
export interface SupervisorOutcome {
  readonly answer: string;
  readonly route: "publish" | "hold";
  readonly reports: {
    readonly researcher: ChildReport<Research>;
    readonly auditor: ChildReport<Audit>;
  };
}

function finalAnswer(value: unknown): { content: string; finishReason: "tool_calls"; toolCalls: { id: string; name: string; arguments: string }[] } {
  return {
    content: "",
    finishReason: "tool_calls",
    toolCalls: [
      { id: "answer", name: "final_answer", arguments: JSON.stringify({ answer: value }) },
    ],
  };
}

function child<T>(
  name: string,
  description: string,
  schema: z.ZodType<T>,
  answer: unknown,
): ManagedAgent<T> {
  return {
    name,
    description,
    // The child itself has no output schema: the entry's schema is the supervisor's contract,
    // so a mismatch is the report's schema channel rather than the child's own guardrail.
    agent: new ToolCallingAgent({ model: new MockModel([finalAnswer(answer)]) }),
    outputSchema: schema,
  };
}

/** Run both children, then let the typed reports decide what to say. */
export async function main(): Promise<SupervisorOutcome> {
  const researcher = child(
    "researcher",
    "Reads the release notes and reports what changed, with sources.",
    RESEARCH_SCHEMA,
    { summary: "Two new flags and one deprecation", sources: ["CHANGELOG.md"] },
  );
  const auditor = child(
    "auditor",
    "Audits the release notes for missing migration steps.",
    AUDIT_SCHEMA,
    { verdict: "pass", findings: [] },
  );

  const reports = {
    researcher: await runManagedAgent(researcher, TASK),
    auditor: await runManagedAgent(auditor, TASK),
  };

  const route = reports.auditor.failure === undefined ? "publish" : "hold";
  const research =
    reports.researcher.failure === undefined
      ? reports.researcher.value?.summary ?? "(no summary)"
      : "unavailable (" + reports.researcher.failure.name + ")";
  const audit =
    reports.auditor.failure === undefined
      ? reports.auditor.value?.verdict ?? "(no verdict)"
      : "refused (" + reports.auditor.failure.name + ")";
  const answer =
    route === "publish"
      ? "Publish. Research: " + research + ". Audit: " + audit + "."
      : "Hold. Research: " + research + ". Audit: " + audit + "; the report is not a valid audit.";

  return { answer, route, reports };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const outcome = await main();
  console.log("route: " + outcome.route);
  console.log("answer: " + outcome.answer);
  console.log("researcher report: " + JSON.stringify(outcome.reports.researcher));
  console.log("auditor report: " + JSON.stringify(outcome.reports.auditor));
}
