import { describe, expect, it } from "vitest";
import { createAsyncQueue } from "../src/utils/async-queue.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createAsyncQueue", () => {
  it("buffers values pushed before anyone iterates", async () => {
    const queue = createAsyncQueue<number>();
    queue.push(1);
    queue.push(2);
    queue.close();
    const seen: number[] = [];
    for await (const value of queue) seen.push(value);
    expect(seen).toEqual([1, 2]);
  });

  it("delivers a value pushed while the consumer is already waiting", async () => {
    const queue = createAsyncQueue<number>();
    const seen: number[] = [];
    const consumer = (async () => {
      for await (const value of queue) seen.push(value);
    })();
    await tick();
    queue.push(1);
    await tick();
    expect(seen).toEqual([1]);
    queue.push(2);
    queue.close();
    await consumer;
    expect(seen).toEqual([1, 2]);
  });

  it("ends the loop when closed", async () => {
    const queue = createAsyncQueue<string>();
    queue.close();
    const seen: string[] = [];
    for await (const value of queue) seen.push(value);
    expect(seen).toEqual([]);
  });

  it("rejects the loop when failed", async () => {
    const queue = createAsyncQueue<number>();
    queue.fail(new Error("guest exploded"));
    await expect(
      (async () => {
        for await (const _value of queue) {
          // drain
        }
      })(),
    ).rejects.toThrow("guest exploded");
  });

  it("rejects a consumer that was already waiting when it failed", async () => {
    const queue = createAsyncQueue<number>();
    const consumer = (async () => {
      for await (const _value of queue) {
        // drain
      }
    })();
    await tick();
    queue.fail(new Error("late failure"));
    await expect(consumer).rejects.toThrow("late failure");
  });

  it("ignores pushes after close", async () => {
    const queue = createAsyncQueue<number>();
    queue.close();
    queue.push(1);
    const seen: number[] = [];
    for await (const value of queue) seen.push(value);
    expect(seen).toEqual([]);
  });

  it("stops early when the consumer breaks", async () => {
    const queue = createAsyncQueue<number>();
    queue.push(1);
    queue.push(2);
    const seen: number[] = [];
    for await (const value of queue) {
      seen.push(value);
      break;
    }
    expect(seen).toEqual([1]);
  });
});
