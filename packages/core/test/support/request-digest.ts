/**
 * The digest a real run journals for its next model request. Replay compares the recorded digest
 * before it returns a journaled reply (decision 0039), so a hand-built journal must carry the
 * value a run would have written, not a placeholder.
 */
import { withoutBytes } from "../../src/agent/loop-helpers.js";
import { MemoryRunStore, type RunRecord } from "../../src/session/run-store.js";
import { MockModel } from "../../src/testing/mock-model.js";
import { digestOf } from "../../src/utils/digest.js";

export async function nextRequestDigest(
  record: RunRecord,
  run: (model: MockModel, store: MemoryRunStore) => Promise<unknown>,
): Promise<string> {
  const bare: { -readonly [K in keyof RunRecord]: RunRecord[K] } = {
    ...record,
  };
  delete bare.journal;
  const store = new MemoryRunStore();
  store.commit(record.runId, bare);
  // An empty script throws on the first request, after the request is captured.
  const model = new MockModel([]);
  await run(model, store).catch(() => undefined);
  const request = model.calls[0];
  if (request === undefined) throw new Error("the probe run made no model request");
  return digestOf(withoutBytes(request));
}
