export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
  }
}

const OPEN = "{{";
const CLOSE = "}}";
const VALID_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Replaces a *subset* of upstream smolagents' populate_template. Upstream delegates to Jinja2 and so has
 * loops, conditionals, filters and dotted paths; this scanner handles flat identifier placeholders only and
 * passes anything else through untouched, which is the only sane behaviour for JavaScript source embedded in
 * a template string. The parts of upstream's templates that needed a loop (the tool list and the
 * managed-agent list) are pre-rendered by the caller instead.
 *
 * An unknown *identifier* still throws, so a genuine template typo is loud rather than silent. Names inherited from
 * Object.prototype count as unknown, so `{{toString}}` throws instead of substituting a native function.
 *
 * Deliberately not built on String.prototype.replace: a value containing "$&" or "$1"
 * must be inserted literally, and a hand-written scanner guarantees that.
 */
export function populateTemplate(
  template: string,
  variables: Record<string, string | number>,
): string {
  let out = "";
  let cursor = 0;

  for (;;) {
    const start = template.indexOf(OPEN, cursor);
    if (start === -1) {
      out += template.slice(cursor);
      return out;
    }
    const end = template.indexOf(CLOSE, start + OPEN.length);
    if (end === -1) {
      out += template.slice(cursor);
      return out;
    }
    const name = template.slice(start + OPEN.length, end).trim();
    if (!VALID_NAME.test(name)) {
      // Not a placeholder we own; copy it through untouched.
      out += template.slice(cursor, end + CLOSE.length);
      cursor = end + CLOSE.length;
      continue;
    }
    const value = Object.hasOwn(variables, name) ? variables[name] : undefined;
    if (value === undefined) {
      throw new TemplateError("Missing value for template variable: " + name);
    }
    out += template.slice(cursor, start) + String(value);
    cursor = end + CLOSE.length;
  }
}

/** The placeholders a template declares, in order of first appearance. */
export function templateVariables(template: string): string[] {
  const found: string[] = [];
  let cursor = 0;
  for (;;) {
    const start = template.indexOf(OPEN, cursor);
    if (start === -1) return found;
    const end = template.indexOf(CLOSE, start + OPEN.length);
    if (end === -1) return found;
    const name = template.slice(start + OPEN.length, end).trim();
    if (VALID_NAME.test(name) && !found.includes(name)) found.push(name);
    cursor = end + CLOSE.length;
  }
}
