/**
 * The log buffer and upstream's truncation, shared by every backend. Mirrors the Pyodide
 * executor's module of the same name so the two Python executors report logs identically.
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

/** One run's output. `write` forwards a line live; `text` is the truncated join. */
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
