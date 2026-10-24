/**
 * The conformance suite for the `RunStore` seam. A new store implementation is certified by
 * running this file against it: one describe block per implementation, the same ten checks.
 *
 * The suite is written against the interface alone — no store internals — and each check ships
 * with a rejecting counterexample, so the file proves it can fail as well as pass. It speaks the
 * record vocabulary: a store commits a `RunRecord` under a run id and loads it back.
 */
import { describe, expect, it } from "vitest";
import type { StepJSON } from "../../src/memory/steps.js";
import {
  RUN_RECORD_VERSION,
  translateRecord,
  type RunRecord,
  type StoredRun,
} from "../../src/session/run-record.js";
import type { RunStore } from "../../src/session/run-store.js";

const MODE = {
  unknown: "loads an unknown run as undefined",
  roundTrip: "round-trips a non-empty record exactly",
  empty: "round-trips a record with no steps",
  overwrite: "replaces a run on a second commit",
  isolation: "keeps runs apart",
  keys: "treats a run id as opaque text",
  repeatable: "lets the same run be loaded twice",
  copy: "returns data a caller cannot mutate behind its back",
  visible: "makes a resolved commit visible to the next load",
  concurrent: "keeps concurrent commits to different runs apart",
} as const;

type Mode = keyof typeof MODE;

/** A contract violation, distinguishable from a bug in the check itself. */
function refuse(mode: Mode, detail: string): never {
  throw new Error("contract: " + MODE[mode] + " — " + detail);
}

function steps(...tasks: string[]): StepJSON[] {
  return tasks.map((task, index) => ({
    id: "step-" + String(index),
    createdAt: 1_700_000_000_000 + index,
    kind: "task",
    task,
  }));
}

const STEPS_A = steps("first", "second");
const STEPS_B = steps("replacement");

function record(runId: string, list: readonly StepJSON[]): RunRecord {
  return {
    schemaVersion: RUN_RECORD_VERSION,
    runId,
    status: "running",
    generation: 0,
    memory: { steps: list },
  };
}

async function write(store: RunStore, runId: string, list: readonly StepJSON[]): Promise<void> {
  await store.commit(runId, record(runId, list));
}

/** Read through the same translation the agent applies, so the check tests what callers see. */
async function read(store: RunStore, runId: string): Promise<RunRecord | undefined> {
  const stored = await store.load(runId);
  return stored === undefined ? undefined : translateRecord(stored);
}

function same(actual: readonly StepJSON[], expected: readonly StepJSON[], mode: Mode): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    refuse(mode, "expected " + JSON.stringify(expected) + " but got " + JSON.stringify(actual));
  }
}

export interface RunStoreCheck {
  readonly mode: Mode;
  readonly check: (store: RunStore) => Promise<void>;
}

export const RUN_STORE_CHECKS: readonly RunStoreCheck[] = [
  {
    mode: "unknown",
    check: async (store) => {
      if ((await store.load("never-written")) !== undefined) {
        refuse("unknown", "expected undefined");
      }
    },
  },
  {
    mode: "roundTrip",
    check: async (store) => {
      await write(store, "run-a", STEPS_A);
      const loaded = await read(store, "run-a");
      if (loaded === undefined) refuse("roundTrip", "load returned undefined after commit");
      if (loaded.schemaVersion !== RUN_RECORD_VERSION) {
        refuse("roundTrip", "schemaVersion " + String(loaded.schemaVersion) + " was not translated");
      }
      if (loaded.runId !== "run-a") refuse("roundTrip", "runId became " + JSON.stringify(loaded.runId));
      same(loaded.memory.steps, STEPS_A, "roundTrip");
    },
  },
  {
    mode: "empty",
    check: async (store) => {
      await write(store, "run-empty", []);
      const loaded = await read(store, "run-empty");
      if (loaded === undefined) refuse("empty", "a record with no steps came back undefined");
      same(loaded.memory.steps, [], "empty");
    },
  },
  {
    mode: "overwrite",
    check: async (store) => {
      await write(store, "run-b", STEPS_A);
      await write(store, "run-b", STEPS_B);
      const loaded = await read(store, "run-b");
      if (loaded === undefined) refuse("overwrite", "load returned undefined after the second commit");
      same(loaded.memory.steps, STEPS_B, "overwrite");
    },
  },
  {
    mode: "isolation",
    check: async (store) => {
      await write(store, "run-c", STEPS_A);
      await write(store, "run-d", STEPS_B);
      const first = await read(store, "run-c");
      const second = await read(store, "run-d");
      if (first === undefined || second === undefined) {
        refuse("isolation", "a written run came back undefined");
      }
      same(first.memory.steps, STEPS_A, "isolation");
      same(second.memory.steps, STEPS_B, "isolation");
    },
  },
  {
    mode: "keys",
    check: async (store) => {
      const empty = steps("empty key");
      const spaced = steps("spaced key");
      const unicode = steps("unicode key");
      await write(store, "", empty);
      await write(store, " spaced ", spaced);
      await write(store, "ключ-🙂", unicode);
      for (const [runId, expected] of [
        ["", empty],
        [" spaced ", spaced],
        ["ключ-🙂", unicode],
      ] as const) {
        const loaded = await read(store, runId);
        if (loaded === undefined) refuse("keys", "run id " + JSON.stringify(runId) + " was not preserved");
        same(loaded.memory.steps, expected, "keys");
      }
    },
  },
  {
    mode: "repeatable",
    check: async (store) => {
      await write(store, "run-e", STEPS_A);
      const first = await read(store, "run-e");
      const second = await read(store, "run-e");
      if (first === undefined || second === undefined) {
        refuse("repeatable", "the second load returned undefined");
      }
      same(second.memory.steps, STEPS_A, "repeatable");
    },
  },
  {
    mode: "copy",
    check: async (store) => {
      const saved = steps("first", "second");
      const expected = JSON.parse(JSON.stringify(saved)) as StepJSON[];
      await write(store, "run-f", saved);
      const first = await read(store, "run-f");
      if (first === undefined) refuse("copy", "load returned undefined after commit");
      (first.memory.steps as StepJSON[]).push(...STEPS_B);
      const second = await read(store, "run-f");
      if (second === undefined) refuse("copy", "the second load returned undefined");
      same(second.memory.steps, expected, "copy");
    },
  },
  {
    mode: "visible",
    check: async (store) => {
      await write(store, "run-g", STEPS_A);
      const loaded = await read(store, "run-g");
      if (loaded === undefined) refuse("visible", "a resolved commit was not visible to the next load");
      same(loaded.memory.steps, STEPS_A, "visible");
    },
  },
  {
    mode: "concurrent",
    check: async (store) => {
      await Promise.all([write(store, "run-h", STEPS_A), write(store, "run-i", STEPS_B)]);
      const first = await read(store, "run-h");
      const second = await read(store, "run-i");
      if (first === undefined || second === undefined) {
        refuse("concurrent", "a concurrently written run came back undefined");
      }
      same(first.memory.steps, STEPS_A, "concurrent");
      same(second.memory.steps, STEPS_B, "concurrent");
    },
  },
];

type Memory = Map<string, StoredRun>;

/** One deliberately broken store per mode: the suite must reject each of them. */
const COUNTEREXAMPLES: Readonly<Record<Mode, () => RunStore>> = {
  unknown: () => ({
    commit: () => undefined,
    load: () => record("x", []),
  }),
  roundTrip: () => ({
    commit: () => undefined,
    load: () => record("x", []),
  }),
  empty: () => {
    const memory: Memory = new Map();
    return {
      commit: (runId, saved) => {
        if (saved.memory.steps.length === 0) memory.delete(runId);
        else memory.set(runId, saved);
      },
      load: (runId) => memory.get(runId),
    };
  },
  overwrite: () => {
    const memory: Memory = new Map();
    return {
      commit: (runId, saved) => {
        const existing = memory.get(runId);
        const previousSteps =
          existing !== undefined && !Array.isArray(existing) && "memory" in existing
            ? existing.memory.steps
            : [];
        memory.set(runId, record(runId, [...previousSteps, ...saved.memory.steps]));
      },
      load: (runId) => memory.get(runId),
    };
  },
  isolation: () => {
    let only: RunRecord | undefined;
    return {
      commit: (_runId, saved) => {
        only = saved;
      },
      load: () => only,
    };
  },
  keys: () => {
    const memory: Memory = new Map();
    return {
      commit: (runId, saved) => {
        if (runId === "") return;
        memory.set(runId, saved);
      },
      load: (runId) => memory.get(runId),
    };
  },
  repeatable: () => {
    const memory: Memory = new Map();
    return {
      commit: (runId, saved) => void memory.set(runId, saved),
      load: (runId) => {
        const value = memory.get(runId);
        memory.delete(runId);
        return value;
      },
    };
  },
  copy: () => {
    const memory: Memory = new Map();
    return {
      commit: (runId, saved) => void memory.set(runId, saved),
      load: (runId) => memory.get(runId),
    };
  },
  visible: () => {
    const memory: Memory = new Map();
    return {
      commit: (runId, saved) => {
        setTimeout(() => memory.set(runId, saved), 0);
        return Promise.resolve();
      },
      load: (runId) => memory.get(runId),
    };
  },
  concurrent: () => {
    const memory: Memory = new Map();
    return {
      commit: (_runId, saved) => void memory.set("only", saved),
      load: (_runId) => memory.get("only"),
    };
  },
};

export type RunStoreFactory = () => RunStore | Promise<RunStore>;

/**
 * Register the contract for one implementation. Every check runs against a fresh store, and its
 * counterexample must fail the same check — a suite that cannot reject a broken store proves
 * nothing about the good one.
 */
export function runStoreContract(name: string, makeStore: RunStoreFactory): void {
  describe(name + " (RunStore contract)", () => {
    for (const entry of RUN_STORE_CHECKS) {
      it(MODE[entry.mode], async () => {
        const store = await makeStore();
        await expect(entry.check(store)).resolves.toBeUndefined();
      });

      it("rejects a counterexample: " + MODE[entry.mode], async () => {
        await expect(entry.check(COUNTEREXAMPLES[entry.mode]())).rejects.toThrow(/^contract: /);
      });
    }
  });
}
