/** The host functions the executor installs in the guest realm. */
export const LOG_GLOBAL = "__log";
export const CALL_TOOL_GLOBAL = "__callTool";
export const FINAL_ANSWER_GLOBAL = "__finalAnswer";
export const CAPTURE_GLOBAL = "__capture";

export interface BuildGuestSourceOptions {
  /** The code the model wrote, verbatim. */
  code: string;
  /** Every tool name in the registry; each becomes a guest global function. */
  toolNames: readonly string[];
}

/**
 * The shapes a declaration can take. The scan is deliberately over-inclusive: a name it finds
 * that is not actually in scope at the end of the step is dropped by the `typeof` guard in the
 * epilogue, so a false positive costs nothing, and a string or comment that looks like a
 * declaration cannot capture anything. A name the scan misses is the only real loss.
 */
const SIMPLE_DECLARATION = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
const FUNCTION_DECLARATION = /\b(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g;
const CLASS_DECLARATION = /\bclass\s+([A-Za-z_$][\w$]*)/g;
const DESTRUCTURED_DECLARATION = /\b(?:const|let|var)\s*([[{][\s\S]*?[\]}])\s*=/g;
const IDENTIFIER = /[A-Za-z_$][\w$]*/g;

/**
 * Names that cannot be a captured binding. Keywords would make the epilogue a syntax error,
 * and the last group is either not a variable or a global whose assignment is a no-op.
 */
const NOT_A_BINDING = new Set([
  "arguments", "await", "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "eval", "export", "extends", "false", "finally",
  "for", "function", "globalThis", "if", "implements", "import", "in", "Infinity", "instanceof",
  "interface", "let", "NaN", "new", "null", "package", "private", "protected", "public",
  "return", "static", "super", "switch", "this", "throw", "true", "try", "typeof", "undefined",
  "var", "void", "while", "with", "yield",
]);

/**
 * Every name the step's code may declare, in source order and without duplicates. Destructured
 * patterns contribute each identifier they name, including property keys, which is safe for the
 * same reason a false positive is.
 */
export function collectDeclaredNames(code: string): string[] {
  const names = new Set<string>();
  const add = (name: string | undefined): void => {
    if (name !== undefined && !NOT_A_BINDING.has(name)) names.add(name);
  };
  for (const match of code.matchAll(SIMPLE_DECLARATION)) add(match[1]);
  for (const match of code.matchAll(FUNCTION_DECLARATION)) add(match[1]);
  for (const match of code.matchAll(CLASS_DECLARATION)) add(match[1]);
  for (const match of code.matchAll(DESTRUCTURED_DECLARATION)) {
    const pattern = match[1];
    if (pattern === undefined) continue;
    for (const token of pattern.matchAll(IDENTIFIER)) add(token[0]);
  }
  return [...names];
}

/**
 * The guest program: the shims the model's code may call, then the code itself inside an async
 * IIFE, then the capture epilogue.
 *
 * The wrapper is not cosmetic. The system prompt's examples await a tool at the top level of the
 * block, which a classic script eval rejects as a syntax error, and the wrapper also makes the
 * eval result a promise in every case, so a synchronous block is observable through the same path
 * as an asynchronous one.
 *
 * The epilogue is what keeps the prompt's rule 10 true: a declaration made inside the wrapper dies
 * with the wrapper, so each one is copied onto the global object at the end of the step and the
 * next step reads it through the global scope (decision D-21). A name that a `typeof` check does
 * not find is skipped, and the assignment is guarded because a model that writes `"use strict"`
 * would otherwise turn a write to a frozen global into a thrown TypeError.
 *
 * The shims are `var` and the tool names are bracket assignments because this source is evaluated
 * again on every step in one realm: a second top-level `const` in the same realm is a
 * redeclaration error, measured against the engine rather than assumed.
 */
export function buildGuestSource(options: BuildGuestSourceOptions): string {
  const lines: string[] = [
    "var render = (v) => (typeof v === 'string' ? v : (JSON.stringify(v) ?? String(v)));",
    "var emit = (...args) => { " + LOG_GLOBAL + "(args.map(render).join(' ')); };",
    // One sink for every console method, so a model that reaches for console.error is still
    // observed rather than silently ignored.
    "globalThis.console = { log: emit, info: emit, warn: emit, error: emit };",
    // The argument object crosses as a JSON string; the guest parses the result back. An absent
    // argument becomes null rather than the JavaScript value undefined, which has no JSON form
    // and would reach the host as a handle it cannot read.
    "var callTool = async (name, args) => JSON.parse(await " +
      CALL_TOOL_GLOBAL +
      "(name, JSON.stringify(args === undefined ? null : args)));",
    "globalThis.final_answer = (value) => { " + FINAL_ANSWER_GLOBAL + "(value); };",
    "var " +
      CAPTURE_GLOBAL +
      " = (name, value) => { try { globalThis[name] = value; } catch (error) {} };",
  ];
  for (const name of options.toolNames) {
    // Bracket assignment, not a declaration: a tool name is a registry fact, and the registry is
    // what rejects a name that is not a JavaScript identifier.
    const quoted = JSON.stringify(name);
    lines.push("globalThis[" + quoted + "] = (args) => callTool(" + quoted + ", args);");
  }
  lines.push("(async () => {");
  lines.push(options.code);
  for (const name of collectDeclaredNames(options.code)) {
    const quoted = JSON.stringify(name);
    lines.push(
      "if (typeof " + name + " !== 'undefined') " + CAPTURE_GLOBAL + "(" + quoted + ", " + name + ");",
    );
  }
  lines.push("})()");
  return lines.join("\n");
}
