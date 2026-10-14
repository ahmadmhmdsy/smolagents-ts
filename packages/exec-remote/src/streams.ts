/**
 * The log buffer and upstream's truncation, shared by every backend. The marker and the
 * head-and-tail shape match the Pyodide executor's module of the same name, but here the cap
 * bounds the whole result: the notice is counted inside `maxLength`, so the marker's own claim
 * stays true instead of the result overshooting the cap by the length of the notice.
 */

/** Upstream's `DEFAULT_MAX_LEN_OUTPUT`, the cap the print buffer is clipped to. */
export const MAX_PRINT_OUTPUT_LENGTH = 50_000;

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
