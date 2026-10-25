import { AgentError, ChildLimitError, RunNotFoundError } from "../errors.js";
import type { MultiStepAgent } from "./multi-step-agent.js";
import type { RunResult } from "./run-result.js";
import type { ChildReport } from "./child-report.js";
import { translateRecord, type RunRecord } from "../session/run-record.js";
import type { RunStore } from "../session/run-store.js";

/** Where a background child is in its life, as the parent's row records it. */
export type ChildPhase = "provisioning" | "active" | "completed" | "failed";

/**
 * One background child, held on its parent's record. The row is the parent's memory of the
 * delegation: the run id it can send to or resume, the phase it last saw, and the typed report a
 * finished child left behind. It carries no live handle, so a row read from a store is useful in
 * a process that never started the child.
 */
export interface ChildRow {
  /** The child's durable run id. */
  readonly runId: string;
  /** The run that started it. */
  readonly parentRunId: string;
  /** The name the child runs under; defaults to its agent's id. */
  readonly agentName: string;
  /** The task text the parent gave it. */
  readonly task: string;
  readonly phase: ChildPhase;
  /** The child's typed report, once it finished and the parent observed it. */
  readonly report?: ChildReport;
  readonly startedAt: string;
  readonly updatedAt: string;
}

/** The default cap on children in `provisioning` or `active` at once. */
const DEFAULT_MAX_BACKGROUND_CHILDREN = 4;

/** What a start hands back: the child's id and the promise of its run. */
export interface BackgroundChildHandle {
  readonly runId: string;
  /** Resolves with the child's result, or rejects with the error that ended its run. */
  readonly done: Promise<RunResult>;
}

export interface StartBackgroundChildInput {
  readonly store: RunStore;
  readonly parentRunId: string;
  /** The child's agent. It must be built with the same store, or its record never lands. */
  readonly agent: MultiStepAgent;
  /** The name recorded on the row and the child's event path; defaults to `agent.model.id`. */
  readonly agentName?: string;
  readonly task: string;
  /** The cap on children in `provisioning` or `active`; defaults to 4. */
  readonly maxConcurrent?: number;
}

/**
 * Start a child that outlives the call: the parent record gains a row first, then the child runs
 * under its own run id with `parentRunId` on its record. The start is refused typed when the
 * parent already has `maxConcurrent` children in flight, and a refusal writes nothing.
 *
 * The row is written `provisioning` and then `active` before the child starts, so a process
 * that dies in between leaves exactly the state `resumeBackgroundChild` reconciles. Nothing here
 * awaits the child; that is what `done` is for.
 */
export async function startBackgroundChild(
  input: StartBackgroundChildInput,
): Promise<BackgroundChildHandle> {
  const parent = await loadParent(input.store, input.parentRunId);
  const rows = parent.children ?? [];
  const cap = input.maxConcurrent ?? DEFAULT_MAX_BACKGROUND_CHILDREN;
  const live = rows.filter((row) => row.phase === "provisioning" || row.phase === "active").length;
  if (live >= cap) {
    throw new ChildLimitError(
      "Run " +
        input.parentRunId +
        " already has " +
        String(live) +
        " background children; its cap is " +
        String(cap) +
        ".",
    );
  }

  const runId = crypto.randomUUID();
  const agentName = input.agentName ?? input.agent.model.id;
  const startedAt = new Date().toISOString();
  const row: ChildRow = {
    runId,
    parentRunId: input.parentRunId,
    agentName,
    task: input.task,
    phase: "provisioning",
    startedAt,
    updatedAt: startedAt,
  };

  const admitted = await writeRows(input.store, parent, [...rows, row]);
  await setPhase(input.store, admitted, runId, (held) => ({
    ...held,
    phase: "active",
    updatedAt: new Date().toISOString(),
  }));

  const done = input.agent.run(input.task, {
    runId,
    parentRunId: input.parentRunId,
    agentPath: [agentName],
  });
  // The row is the parent's memory, not the child's: settle it from the run's outcome without
  // making the caller await a second promise.
  void done.then(
    async (result) => {
      const report = reportOfResult(result);
      const latest = await loadParent(input.store, input.parentRunId);
      await setPhase(input.store, latest, runId, (held) => ({
        ...held,
        phase: report.stopReason === "success" ? "completed" : "failed",
        report,
        updatedAt: new Date().toISOString(),
      }));
    },
    async (error: unknown) => {
      const report = reportOfError(error);
      const latest = await loadParent(input.store, input.parentRunId);
      await setPhase(input.store, latest, runId, (held) => ({
        ...held,
        phase: "failed",
        report,
        updatedAt: new Date().toISOString(),
      }));
    },
  );

  return { runId, done };
}

/** Read the parent's rows. Reading resumes nothing: no child is loaded, claimed or run. */
export async function listChildren(
  store: RunStore,
  parentRunId: string,
): Promise<readonly ChildRow[]> {
  const parent = await loadParent(store, parentRunId);
  return [...(parent.children ?? [])];
}

/**
 * Re-attach to a child without starting a second copy. A row that already holds a report returns
 * it. A `provisioning` row is reconciled against the child's record: a record means the child was
 * admitted, so its phase is adopted from its status; no record means admission failed, so the row
 * becomes failed and reports that. An `active` child whose record is unfinished is resumed.
 */
export async function resumeBackgroundChild(
  store: RunStore,
  parentRunId: string,
  runId: string,
  agent: MultiStepAgent,
): Promise<{ report: ChildReport }> {
  const parent = await loadParent(store, parentRunId);
  const row = (parent.children ?? []).find((entry) => entry.runId === runId);
  if (row === undefined) {
    throw new RunNotFoundError(
      "Run " + parentRunId + " holds no background child " + JSON.stringify(runId) + ".",
    );
  }
  if (row.report !== undefined) return { report: row.report };

  const stored = await store.load(runId);
  if (stored === undefined) {
    const report = reportOfError(
      new AgentError("The child was admitted into a row but left no record behind."),
    );
    await setPhase(store, parent, runId, (held) => ({
      ...held,
      phase: "failed",
      report,
      updatedAt: new Date().toISOString(),
    }));
    return { report };
  }

  const child = translateRecord(stored, runId);
  if (child.status === "completed" || child.status === "failed") {
    const report = reportOfRecord(child);
    await setPhase(store, parent, runId, (held) => ({
      ...held,
      phase: child.status === "completed" ? "completed" : "failed",
      report,
      updatedAt: new Date().toISOString(),
    }));
    return { report };
  }

  const result = await agent.run(row.task, {
    runId,
    parentRunId,
    agentPath: [row.agentName],
    resume: {},
  });
  const report = reportOfResult(result);
  await setPhase(store, parent, runId, (held) => ({
    ...held,
    phase: report.stopReason === "success" ? "completed" : "failed",
    report,
    updatedAt: new Date().toISOString(),
  }));
  return { report };
}

async function loadParent(store: RunStore, parentRunId: string): Promise<RunRecord> {
  const stored = await store.load(parentRunId);
  if (stored === undefined) {
    throw new RunNotFoundError(
      "The store holds no record for parent run " + JSON.stringify(parentRunId) + ".",
    );
  }
  return translateRecord(stored, parentRunId);
}

async function writeRows(
  store: RunStore,
  parent: RunRecord,
  rows: readonly ChildRow[],
): Promise<RunRecord> {
  // A row write is its own commit at the parent's next fence, so a concurrent writer's commit is
  // refused rather than silently overwritten.
  const next: RunRecord = {
    ...parent,
    generation: parent.generation + 1,
    children: [...rows],
    updatedAt: new Date().toISOString(),
  };
  await store.commit(parent.runId, next, parent.generation);
  return next;
}

async function setPhase(
  store: RunStore,
  parent: RunRecord,
  runId: string,
  update: (row: ChildRow) => ChildRow,
): Promise<RunRecord> {
  const rows = (parent.children ?? []).map((row) => (row.runId === runId ? update(row) : row));
  return writeRows(store, parent, rows);
}

/** The report a finished run leaves; a non-success state carries the typed failure instead. */
function reportOfResult(result: RunResult): ChildReport {
  if (result.state === "success") return { stopReason: "success", value: result.output };
  return {
    stopReason: "waiting",
    failure: {
      kind: "agent",
      name: "RunWaiting",
      message: "The child parked on a request and has not produced a final answer.",
    },
  };
}

/** The report an error leaves: the typed name and a bounded diagnostic, never the task text. */
function reportOfError(error: unknown): ChildReport {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : String(error);
  return {
    stopReason: "failure",
    failure: { kind: "agent", name, message: bounded(message) },
  };
}

/** The report a record implies, for a re-attach that only has the stored run. */
function reportOfRecord(record: RunRecord): ChildReport {
  if (record.status === "failed") {
    return {
      stopReason: "failure",
      failure: {
        kind: "agent",
        name: "AgentError",
        message: "The child's record ended failed and no report was stored for it.",
      },
    };
  }
  const steps = record.memory.steps;
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step !== undefined && "kind" in step && step.kind === "final_answer") {
      return { stopReason: "success", value: (step as { output: unknown }).output };
    }
  }
  return { stopReason: "success", value: undefined };
}

function bounded(message: string): string {
  return message.length <= 300 ? message : message.slice(0, 297) + "...";
}
