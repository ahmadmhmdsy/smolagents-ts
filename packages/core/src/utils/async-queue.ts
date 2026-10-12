/**
 * A minimal single-consumer async queue.
 *
 * Executors report progress through synchronous callbacks (onLog, onToolCall), but an
 * agent must yield events as they happen. This is the bridge: callbacks push, the agent
 * iterates, and neither side blocks the other.
 */
export interface AsyncQueue<T> extends AsyncIterable<T> {
  push(value: T): void;
  close(): void;
  fail(error: unknown): void;
}

export function createAsyncQueue<T>(): AsyncQueue<T> {
  const buffered: T[] = [];
  let waiting: ((result: IteratorResult<T>) => void) | undefined;
  let rejectWaiting: ((error: unknown) => void) | undefined;
  let closed = false;
  let failure: unknown;

  const resolveWaiting = (result: IteratorResult<T>): void => {
    const resolve = waiting;
    waiting = undefined;
    rejectWaiting = undefined;
    resolve?.(result);
  };

  return {
    push(value: T): void {
      if (closed) return;
      if (waiting !== undefined) {
        resolveWaiting({ value, done: false });
        return;
      }
      buffered.push(value);
    },

    close(): void {
      if (closed) return;
      closed = true;
      resolveWaiting({ value: undefined as never, done: true });
    },

    fail(error: unknown): void {
      if (closed) return;
      failure = error;
      closed = true;
      const reject = rejectWaiting;
      waiting = undefined;
      rejectWaiting = undefined;
      if (reject !== undefined) reject(error);
      else resolveWaiting({ value: undefined as never, done: true });
    },

    [Symbol.asyncIterator](): AsyncIterator<T> {
      return {
        next(): Promise<IteratorResult<T>> {
          const bufferedValue = buffered.shift();
          if (bufferedValue !== undefined) {
            return Promise.resolve({ value: bufferedValue, done: false });
          }
          if (failure !== undefined) return Promise.reject(failure);
          if (closed) {
            return Promise.resolve({ value: undefined as never, done: true });
          }
          return new Promise<IteratorResult<T>>((resolve, reject) => {
            waiting = resolve;
            rejectWaiting = reject;
          });
        },
        return(): Promise<IteratorResult<T>> {
          closed = true;
          buffered.length = 0;
          return Promise.resolve({ value: undefined as never, done: true });
        },
      };
    },
  };
}
