import { RunNotFoundError, TaskBlockedError, TaskDeletedError, TaskStaleRevisionError } from "../errors.js";
import { translateRecord, type RunRecord } from "./run-record.js";
import type { RunStore } from "./run-store.js";

/** What a board row is doing. A tombstone stays readable and refuses every mutation. */
export type BoardStatus = "open" | "claimed" | "blocked" | "done" | "deleted";

/**
 * One row on a run's claim board. A row is coordination state, not a data payload: it carries a
 * title, an owner, blockers and advisory write scopes, and nothing else. The revision is the
 * compare-and-set token every mutation must name, so two writers cannot both win.
 */
export interface BoardTask {
  readonly id: string;
  readonly title: string;
  /** Who claimed it, when someone did. */
  readonly owner?: string;
  readonly status: BoardStatus;
  /** Task ids that must be `done` before this row may be claimed. */
  readonly blockers: readonly string[];
  /** Advisory workspace paths; recorded and never enforced. */
  readonly writeScopes: readonly string[];
  /** The compare-and-set token; every mutation bumps it by one. */
  readonly revision: number;
  readonly updatedAt: string;
}

export interface CreateBoardTaskInput {
  readonly id?: string;
  readonly title: string;
  readonly blockers?: readonly string[];
  readonly writeScopes?: readonly string[];
}

/** The fields an update may change; a status change is a mutation like any other. */
export interface UpdateBoardTaskInput {
  readonly title?: string;
  readonly status?: Exclude<BoardStatus, "deleted">;
  readonly blockers?: readonly string[];
  readonly writeScopes?: readonly string[];
}

/** Create a row in `open` at revision 0. A duplicate id is refused rather than merged. */
export async function createTask(
  store: RunStore,
  parentRunId: string,
  input: CreateBoardTaskInput,
): Promise<BoardTask> {
  const parent = await loadParent(store, parentRunId);
  const rows = parent.board ?? [];
  const id = input.id ?? crypto.randomUUID();
  if (rows.some((row) => row.id === id)) {
    throw new TaskStaleRevisionError(
      "Run " + parentRunId + " already holds a board row " + JSON.stringify(id) + ".",
    );
  }
  const row: BoardTask = {
    id,
    title: input.title,
    status: "open",
    blockers: [...(input.blockers ?? [])],
    writeScopes: [...(input.writeScopes ?? [])],
    revision: 0,
    updatedAt: new Date().toISOString(),
  };
  await writeRows(store, parent, [...rows, row]);
  return row;
}

/**
 * Claim a row for an owner. The claim is refused with `TaskBlockedError` while any blocker is not
 * `done`, and with `TaskStaleRevisionError` when the caller's revision is not the row's.
 */
export async function claimTask(
  store: RunStore,
  parentRunId: string,
  taskId: string,
  owner: string,
  expectedRevision: number,
): Promise<BoardTask> {
  const parent = await loadParent(store, parentRunId);
  const rows = parent.board ?? [];
  const row = findRow(rows, parentRunId, taskId);
  refuseTombstone(row, taskId);
  checkRevision(row, expectedRevision, taskId);
  const blockers = row.blockers.filter(
    (blocker) => rows.find((entry) => entry.id === blocker)?.status !== "done",
  );
  if (blockers.length > 0) {
    throw new TaskBlockedError(
      "Task " + JSON.stringify(taskId) + " is blocked by " + blockers.join(", ") + ".",
    );
  }
  const claimed: BoardTask = {
    ...row,
    owner,
    status: "claimed",
    revision: row.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  await writeRows(store, parent, replaceRow(rows, taskId, claimed));
  return claimed;
}

/** Change a row's title, blockers, write scopes or status; the revision must match. */
export async function updateTask(
  store: RunStore,
  parentRunId: string,
  taskId: string,
  patch: UpdateBoardTaskInput,
  expectedRevision: number,
): Promise<BoardTask> {
  const parent = await loadParent(store, parentRunId);
  const rows = parent.board ?? [];
  const row = findRow(rows, parentRunId, taskId);
  refuseTombstone(row, taskId);
  checkRevision(row, expectedRevision, taskId);
  const next: BoardTask = {
    ...row,
    ...(patch.title === undefined ? {} : { title: patch.title }),
    ...(patch.status === undefined ? {} : { status: patch.status }),
    ...(patch.blockers === undefined ? {} : { blockers: [...patch.blockers] }),
    ...(patch.writeScopes === undefined ? {} : { writeScopes: [...patch.writeScopes] }),
    revision: row.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  await writeRows(store, parent, replaceRow(rows, taskId, next));
  return next;
}

/** Mark a row `done`; this is the state a later claim's blockers read. */
export async function completeTask(
  store: RunStore,
  parentRunId: string,
  taskId: string,
  expectedRevision: number,
): Promise<BoardTask> {
  const parent = await loadParent(store, parentRunId);
  const rows = parent.board ?? [];
  const row = findRow(rows, parentRunId, taskId);
  refuseTombstone(row, taskId);
  checkRevision(row, expectedRevision, taskId);
  const done: BoardTask = {
    ...row,
    status: "done",
    revision: row.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  await writeRows(store, parent, replaceRow(rows, taskId, done));
  return done;
}

/** Tombstone a row: it stays in the list with status `deleted` and refuses every mutation. */
export async function deleteTask(
  store: RunStore,
  parentRunId: string,
  taskId: string,
  expectedRevision: number,
): Promise<BoardTask> {
  const parent = await loadParent(store, parentRunId);
  const rows = parent.board ?? [];
  const row = findRow(rows, parentRunId, taskId);
  refuseTombstone(row, taskId);
  checkRevision(row, expectedRevision, taskId);
  const deleted: BoardTask = {
    ...row,
    status: "deleted",
    revision: row.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  await writeRows(store, parent, replaceRow(rows, taskId, deleted));
  return deleted;
}

/** The rows in creation order. Reading writes nothing and enforces nothing. */
export async function listBoard(
  store: RunStore,
  parentRunId: string,
): Promise<readonly BoardTask[]> {
  const parent = await loadParent(store, parentRunId);
  return [...(parent.board ?? [])];
}

async function loadParent(store: RunStore, parentRunId: string): Promise<RunRecord> {
  const stored = await store.load(parentRunId);
  if (stored === undefined) {
    throw new RunNotFoundError(
      "The store holds no record for run " + JSON.stringify(parentRunId) + ".",
    );
  }
  return translateRecord(stored, parentRunId);
}

function findRow(rows: readonly BoardTask[], parentRunId: string, taskId: string): BoardTask {
  const row = rows.find((entry) => entry.id === taskId);
  if (row === undefined) {
    throw new RunNotFoundError(
      "Run " + parentRunId + " holds no board row " + JSON.stringify(taskId) + ".",
    );
  }
  return row;
}

function refuseTombstone(row: BoardTask, taskId: string): void {
  if (row.status === "deleted") {
    throw new TaskDeletedError(
      "Board row " + JSON.stringify(taskId) + " is deleted; a tombstone refuses every mutation.",
    );
  }
}

function checkRevision(row: BoardTask, expectedRevision: number, taskId: string): void {
  if (row.revision !== expectedRevision) {
    throw new TaskStaleRevisionError(
      "Board row " +
        JSON.stringify(taskId) +
        " is at revision " +
        String(row.revision) +
        ", not " +
        String(expectedRevision) +
        "; the mutation was refused.",
    );
  }
}

function replaceRow(rows: readonly BoardTask[], taskId: string, next: BoardTask): readonly BoardTask[] {
  return rows.map((row) => (row.id === taskId ? next : row));
}

async function writeRows(
  store: RunStore,
  parent: RunRecord,
  rows: readonly BoardTask[],
): Promise<void> {
  // One row write is its own commit at the parent's next fence, so a competing writer's commit
  // is refused rather than silently overwritten.
  const next: RunRecord = {
    ...parent,
    generation: parent.generation + 1,
    board: [...rows],
    updatedAt: new Date().toISOString(),
  };
  await store.commit(parent.runId, next, parent.generation);
}
