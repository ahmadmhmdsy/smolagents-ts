/**
 * The log buffer and upstream's truncation.
 *
 * Pyodide's batched stdout/stderr handlers receive whole lines without their terminator, so
 * the buffer rejoins them with a newline; the joined string is what the core's `logs` field
 * carries. Truncation is upstream's `truncate_content` applied with the executor's
 * `max_print_outputs_length`, so a run that prints megabytes reports the head and the tail
 * with the same marker upstream uses.
 */

/** Upstream's `DEFAULT_MAX_LEN_OUTPUT`, the cap the print buffer is clipped to. */
export const MAX_PRINT_OUTPUT_LENGTH = 50_000;

/** Upstream's head-and-tail clip. */
export function truncateContent(content: string, maxLength: number = MAX_PRINT_OUTPUT_LENGTH): string {
  if (content.length <= maxLength) {
    return content;
  }
  const half = Math.floor(maxLength / 2);
  return (
    content.slice(0, half) +
    "\n..._This content has been truncated to stay below " +
    String(maxLength) +
    " characters_...\n" +
    content.slice(content.length - half)
  );
}

/**
 * One run's output. `write` is called once per line by the runtime's batched handlers and
 * forwards the line live; `text` is the truncated join read back into the result.
 */
export class LogStream {
  private readonly lines: string[] = [];

  constructor(private readonly onLine?: (line: string) => void) {}

  write(text: string): void {
    this.lines.push(text);
    this.onLine?.(text);
  }

  get lineCount(): number {
    return this.lines.length;
  }

  get text(): string {
    return truncateContent(this.lines.join("\n"));
  }
}
