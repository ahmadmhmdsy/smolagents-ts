/**
 * The conformance suite for the \`RunStore\` seam. A new store implementation is certified by
 * running this file against it: one describe block per implementation, the same ten checks.
 *
 * The suite is written against the interface alone — no store internals — and each check ships
 * with a rejecting counterexample, so the file proves it can fail as well as pass.
 */
import { describe, expect, it } from "vitest";
import type { StepJSON } from "../../src/memory/steps.js";
import {
  RUN_SNAPSHOT_VERSION,
  translateSnapshot,
  type RunSnapshot,
  type RunStore,
} from "../../src/session/run-store.js";

const MODE = {
  unknown: "loads an unknown checkpoint as undefined",
  roundTrip: "round-trips a non-empty step list exactly",
  empty: "round-trips an empty step list",
  overwrite: "replaces a checkpoint on a second save",
  isolation: "keeps checkpoints apart",
  keys: "treats a checkpoint key as opaque text",
  repeatable: "lets the same checkpoint be loaded twice",
  copy: "returns data a caller cannot mutate behind its back",
  visible: "makes a resolved save visible to the next load",
  concurrent: "keeps concurrent saves to different keys apart",
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

const SNAPSHOT_A = steps("first", "second");
const SNAPSHOT_B = steps("replacement");

function envelope(list: readonly StepJSON[]): RunSnapshot {
  return { formatVersion: RUN_SNAPSHOT_VERSION, steps: list };
}

async function write(store: RunStore, key: string, list: readonly StepJSON[]): Promise<void> {
  await store.save(key, envelope(list));
}

/** Read through the same translation the agent applies, so the check tests what callers see. */
async function read(store: RunStore, key: string): Promise<RunSnapshot | undefined> {
  const stored = await store.load(key);
  return stored === undefined ? undefined : translateSnapshot(stored);
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
      await write(store, "run-a", SNAPSHOT_A);
      const loaded = await read(store, "run-a");
      if (loaded === undefined) refuse("roundTrip", "load returned undefined after save");
      if (loaded.formatVersion !== RUN_SNAPSHOT_VERSION) {
        refuse("roundTrip", "formatVersion " + String(loaded.formatVersion) + " was not translated");
      }
      same(loaded.steps, SNAPSHOT_A, "roundTrip");
    },
  },
  {
    mode: "empty",
    check: async (store) => {
      await write(store, "run-empty", []);
      const loaded = await read(store, "run-empty");
      if (loaded === undefined) refuse("empty", "an empty step list came back undefined");
      same(loaded.steps, [], "empty");
    },
  },
  {
    mode: "overwrite",
    check: async (store) => {
      await write(store, "run-b", SNAPSHOT_A);
      await write(store, "run-b", SNAPSHOT_B);
      const loaded = await read(store, "run-b");
      if (loaded === undefined) refuse("overwrite", "load returned undefined after the second save");
      same(loaded.steps, SNAPSHOT_B, "overwrite");
    },
  },
  {
    mode: "isolation",
    check: async (store) => {
      await write(store, "run-c", SNAPSHOT_A);
      await write(store, "run-d", SNAPSHOT_B);
      const first = await read(store, "run-c");
      const second = await read(store, "run-d");
      if (first === undefined || second === undefined) {
        refuse("isolation", "a written checkpoint came back undefined");
      }
      same(first.steps, SNAPSHOT_A, "isolation");
      same(second.steps, SNAPSHOT_B, "isolation");
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
      for (const [key, expected] of [
        ["", empty],
        [" spaced ", spaced],
        ["ключ-🙂", unicode],
      ] as const) {
        const loaded = await read(store, key);
        if (loaded === undefined) refuse("keys", "checkpoint " + JSON.stringify(key) + " was not preserved");
        same(loaded.steps, expected, "keys");
      }
    },
  },
  {
    mode: "repeatable",
    check: async (store) => {
      await write(store, "run-e", SNAPSHOT_A);
      const first = await read(store, "run-e");
      const second = await read(store, "run-e");
      if (first === undefined || second === undefined) {
        refuse("repeatable", "the second load returned undefined");
      }
      same(second.steps, SNAPSHOT_A, "repeatable");
    },
  },
  {
    mode: "copy",
    check: async (store) => {
      const saved = steps("first", "second");
      const expected = JSON.parse(JSON.stringify(saved)) as StepJSON[];
      await write(store, "run-f", saved);
      const first = await read(store, "run-f");
      if (first === undefined) refuse("copy", "load returned undefined after save");
      (first.steps as StepJSON[]).push(...SNAPSHOT_B);
      const second = await read(store, "run-f");
      if (second === undefined) refuse("copy", "the second load returned undefined");
      same(second.steps, expected, "copy");
    },
  },
  {
    mode: "visible",
    check: async (store) => {
      await write(store, "run-g", SNAPSHOT_A);
      const loaded = await read(store, "run-g");
      if (loaded === undefined) refuse("visible", "a resolved save was not visible to the next load");
      same(loaded.steps, SNAPSHOT_A, "visible");
    },
  },
  {
    mode: "concurrent",
    check: async (store) => {
      await Promise.all([write(store, "run-h", SNAPSHOT_A), write(store, "run-i", SNAPSHOT_B)]);
      const first = await read(store, "run-h");
      const second = await read(store, "run-i");
      if (first === undefined || second === undefined) {
        refuse("concurrent", "a concurrently written checkpoint came back undefined");
      }
      same(first.steps, SNAPSHOT_A, "concurrent");
      same(second.steps, SNAPSHOT_B, "concurrent");
    },
  },
];

type Memory = Map<string, RunSnapshot>;

/** One deliberately broken store per mode: the suite must reject each of them. */
const COUNTEREXAMPLES: Readonly<Record<Mode, () => RunStore>> = {
  unknown: () => ({
    save: () => undefined,
    load: () => envelope([]),
  }),
  roundTrip: () => ({
    save: () => undefined,
    load: () => envelope([]),
  }),
  empty: () => {
    const memory: Memory = new Map();
    return {
      save: (key, snapshot) => {
        if (snapshot.steps.length === 0) memory.delete(key);
        else memory.set(key, snapshot);
      },
      load: (key) => memory.get(key),
    };
  },
  overwrite: () => {
    const memory: Memory = new Map();
    return {
      save: (key, snapshot) => {
        const existing = memory.get(key);
        memory.set(key, envelope([...(existing?.steps ?? []), ...snapshot.steps]));
      },
      load: (key) => memory.get(key),
    };
  },
  isolation: () => {
    let only: RunSnapshot | undefined;
    return {
      save: (_key, snapshot) => {
        only = snapshot;
      },
      load: () => only,
    };
  },
  keys: () => {
    const memory: Memory = new Map();
    return {
      save: (key, snapshot) => {
        if (key === "") return;
        memory.set(key, snapshot);
      },
      load: (key) => memory.get(key),
    };
  },
  repeatable: () => {
    const memory: Memory = new Map();
    return {
      save: (key, snapshot) => void memory.set(key, snapshot),
      load: (key) => {
        const value = memory.get(key);
        memory.delete(key);
        return value;
      },
    };
  },
  copy: () => {
    const memory: Memory = new Map();
    return {
      save: (key, snapshot) => void memory.set(key, snapshot),
      load: (key) => memory.get(key),
    };
  },
  visible: () => {
    const memory: Memory = new Map();
    return {
      save: (key, snapshot) => {
        setTimeout(() => memory.set(key, snapshot), 0);
        return Promise.resolve();
      },
      load: (key) => memory.get(key),
    };
  },
  concurrent: () => {
    const memory: Memory = new Map();
    return {
      save: (_key, snapshot) => void memory.set("only", snapshot),
      load: (_key) => memory.get("only"),
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
