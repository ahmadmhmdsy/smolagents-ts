import { RunMessageRefusedError } from "../errors.js";
import type { RunRecord } from "./run-record.js";
import { translateRecord } from "./run-record.js";
import type { RunStore } from "./run-store.js";

/**
 * One message sent to a run. An ordinary user-role entry in the run's memory: the sender and the
 * text, when it was sent, and when and where it was delivered. Delivery is the run's business; a
 * send only appends the entry and reports that it was accepted.
 */
export interface RunMessage {
  readonly id: string;
  /** Who sent it: an agent name, a user handle, or any label the caller chooses. */
  readonly from: string;
  readonly text: string;
  readonly sentAt: string;
  /** Set by the run when it delivered the message; absent until then. */
  readonly deliveredAt?: string;
  /** The step index whose boundary delivered it. */
  readonly deliveredStep?: number;
}

export interface SendRunMessageInput {
  readonly from: string;
  readonly text: string;
}

/** Acceptance, not processing: the message is on the record, and the run will see it. */
export interface SendRunMessageReceipt {
  readonly accepted: true;
  readonly runId: string;
  readonly messageId: string;
}

/**
 * Append a message to a run's record. The record is loaded, refused when it does not exist or has
 * already ended, and committed back at the generation it was read at; no claim is taken, so a send
 * neither moves the fence nor disturbs the run that owns it. That commit is the whole mechanism:
 * a running target sees the entry at its next step boundary, and a parked or interrupted one sees
 * it on the step that resumes or repairs it.
 */
export async function sendRunMessage(
  store: RunStore,
  runId: string,
  input: SendRunMessageInput,
): Promise<SendRunMessageReceipt> {
  if (input.from.trim() === "") {
    throw new RunMessageRefusedError("A message needs a sender; the from field was empty.");
  }
  if (input.text.trim() === "") {
    throw new RunMessageRefusedError("A message needs text; the text field was empty.");
  }
  const stored = await store.load(runId);
  if (stored === undefined) {
    throw new RunMessageRefusedError("The store holds no record for run " + runId + " to message.");
  }
  const record = translateRecord(stored, runId);
  if (record.status === "completed" || record.status === "failed") {
    throw new RunMessageRefusedError(
      "Run " + runId + " already ended (" + record.status + "); it cannot take a message.",
    );
  }
  const message: RunMessage = {
    id: crypto.randomUUID(),
    from: input.from,
    text: input.text,
    sentAt: new Date().toISOString(),
  };
  const next: RunRecord = {
    ...record,
    messages: [...(record.messages ?? []), message],
    updatedAt: new Date().toISOString(),
  };
  await store.commit(runId, next, record.generation);
  return { accepted: true, runId, messageId: message.id };
}

/** The messages that no step has delivered yet, in the order they were sent. */
export function undeliveredMessages(
  messages: readonly RunMessage[] | undefined,
): readonly RunMessage[] {
  return (messages ?? []).filter((message) => message.deliveredAt === undefined);
}
