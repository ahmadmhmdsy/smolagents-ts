/**
 * The log buffer and upstream's truncation for the QuickJS executor.
 *
 * The guest's `console.log` shim hands over one line at a time; the buffer rejoins them with a
 * newline and that joined string becomes the result's `logs`. Truncation is upstream's
 * `truncate_content`, with the notice counted inside the cap so the marker's own claim stays
 * true rather than the result overshooting by the length of the notice.
 *
 * The buffer is bounded at write time: a guest that logs for a long time keeps only
 * `MAX_LOG_BUFFER_LENGTH` characters — the head and the tail — so this process's memory does
 * not grow with the guest's output, and the 50,000-character read clip is applied on top.
 */

/** Upstream's `DEFAULT_MAX_LEN_OUTPUT`, the cap the print buffer is clipped to. */
export const MAX_PRINT_OUTPUT_LENGTH = 50_000;

/** The most log text one run keeps in memory, split evenly between the head and the tail. */
export const MAX_LOG_BUFFER_LENGTH = 1024 * 1024;

/** Upstream's head-and-tail clip, with the notice counted inside the cap. */
export function truncateContent(content: string, maxLength: number = MAX_PRINT_OUTPUT_LENGTH): string {
  if (content.length <= maxLength) {
    return content;
  }
  const notice =
    "\n..._This content has been truncated to stay below " + String(maxLength) + " characters_...\n";
  const half = Math.floor((maxLength - notice.length) / 2);
  if (half <= 0) return content.slice(0, maxLength);
  return content.slice(0, half) + notice + content.slice(content.length - half);
}

/** The marker the buffer leaves where it dropped the middle of the run's output. */
function bufferNotice(maxBufferLength: number): string {
  return (
    "\n..._This content has been truncated to stay below " +
    String(maxBufferLength) +
    " characters_...\n"
  );
}

/**
 * One run's output. `write` forwards a line live and appends it to a buffer bounded at
 * `maxBufferLength`; `text` is the truncated join read back into the result.
 */
export class LogStream {
  private readonly head: string[] = [];
  private tail: string[] = [];
  private headLength = 0;
  private tailLength = 0;
  private tailStart = 0;
  private lines = 0;
  private dropped = false;

  constructor(
    private readonly onLine?: (line: string) => void,
    private readonly maxBufferLength: number = MAX_LOG_BUFFER_LENGTH,
  ) {}

  write(text: string): void {
    this.lines += 1;
    this.onLine?.(text);
    this.append(text + "\n");
  }

  get lineCount(): number {
    return this.lines;
  }

  /** The character count the buffer still holds; never more than `maxBufferLength`. */
  get bufferedLength(): number {
    return this.headLength + this.tailLength;
  }

  get text(): string {
    const tailText = this.tail.slice(this.tailStart).join("");
    const body = this.dropped
      ? this.head.join("") + bufferNotice(this.maxBufferLength) + tailText
      : this.head.join("") + tailText;
    const joined = body.endsWith("\n") ? body.slice(0, -1) : body;
    return truncateContent(joined);
  }

  private append(chunk: string): void {
    const half = Math.floor(this.maxBufferLength / 2);
    if (!this.dropped) {
      if (this.headLength + chunk.length <= half) {
        this.head.push(chunk);
        this.headLength += chunk.length;
        return;
      }
      const room = Math.max(0, half - this.headLength);
      if (room > 0) {
        this.head.push(chunk.slice(0, room));
        this.headLength += room;
      }
      this.dropped = true;
      this.appendTail(chunk.slice(room), half);
      return;
    }
    this.appendTail(chunk, half);
  }

  /**
   * Keep the last `half` characters, dropping whole chunks from the front. Trimming an index
   * rather than copying the retained tail keeps a guest that keeps printing O(output) instead
   * of O(output × buffer), and the array is compacted so the index cannot grow without bound.
   */
  private appendTail(chunk: string, half: number): void {
    if (chunk === "") return;
    this.tail.push(chunk);
    this.tailLength += chunk.length;
    while (this.tailLength > half) {
      const first = this.tail[this.tailStart];
      if (first === undefined) break;
      const excess = this.tailLength - half;
      if (first.length <= excess) {
        this.tailStart += 1;
        this.tailLength -= first.length;
      } else {
        this.tail[this.tailStart] = first.slice(excess);
        this.tailLength -= excess;
      }
    }
    if (this.tailStart > 1_024 && this.tailStart * 2 > this.tail.length) {
      this.tail = this.tail.slice(this.tailStart);
      this.tailStart = 0;
    }
  }
}
