/**
 * The Python side of the seam, emitted as one string per run.
 *
 * Everything here is a fidelity guard, never a security boundary: the guest runs real Python
 * in this process, and a determined guest restores the original `__import__` (the imports
 * module records that bypass as a known one).
 */

/** The host dispatcher the emitted tool wrappers await. */
export const TOOL_CALL_GLOBAL = "__call_tool";

/** The value `final_answer` stores before it raises. */
export const FINAL_ANSWER_VALUE_GLOBAL = "_final_answer_value";

/** The flag that says the run called `final_answer`, whether or not the signal was caught. */
export const FINAL_ANSWER_RAISED_GLOBAL = "_final_answer_raised";

/**
 * The names of the module-level definitions, kept out of the guest's way by a leading
 * underscore, and read back through `PyodideGlobals`.
 */
export const FINAL_ANSWER_GLOBAL = "final_answer";

export interface BuildGuestSourceOptions {
  /**
   * The guest's code, run at module level, so top-level `await` works. Omit it to emit only
   * the prelude; the executor seeds a fresh runtime with that before it installs the guard.
   */
  readonly code?: string;
  /** The tool names to bind this run; each becomes an async callable in the guest's globals. */
  readonly toolNames: readonly string[];
}

/**
 * The import block. It is written to be re-runnable: after the first pass the names exist and
 * the `except NameError` branch is skipped, which matters because the import guard replaces
 * `builtins.__import__` and would otherwise refuse the prelude's own imports on a later run.
 */
const BOOTSTRAP = [
  "try:",
  "    _builtins",
  "    _json",
  "except NameError:",
  "    import builtins as _builtins",
  "    import json as _json",
  "    __original_import__ = _builtins.__import__",
];

/**
 * The answer signal. `BaseException` is deliberate: guest code that wraps a step in
 * `except Exception` must not swallow a `final_answer` call, and the host reads the flag
 * rather than relying on the signal surviving.
 */
const SIGNAL = [
  "",
  "class _FinalAnswerSignal(BaseException):",
  "    pass",
  "",
  "",
  "def " + FINAL_ANSWER_GLOBAL + "(*args):",
  "    global " + FINAL_ANSWER_VALUE_GLOBAL + ", " + FINAL_ANSWER_RAISED_GLOBAL,
  "    if len(args) == 1:",
  "        " + FINAL_ANSWER_VALUE_GLOBAL + " = args[0]",
  "    elif len(args) == 0:",
  "        " + FINAL_ANSWER_VALUE_GLOBAL + " = None",
  "    else:",
  "        " + FINAL_ANSWER_VALUE_GLOBAL + " = list(args)",
  "    " + FINAL_ANSWER_RAISED_GLOBAL + " = True",
  "    raise _FinalAnswerSignal()",
  "",
  "",
  "def _make_tool(name):",
  "    # Bind the step's dispatcher now: a coroutine this step leaves behind must not",
  "    # reach the next step's bridge by looking the global up at call time.",
  "    _dispatch = " + TOOL_CALL_GLOBAL,
  "    async def _tool(*args, **kwargs):",
  "        if args:",
  "            raise TypeError(name + '() accepts keyword arguments only')",
  "        _raw = await _dispatch(name, _json.dumps(kwargs))",
  "        _envelope = _json.loads(_raw)",
  "        if not _envelope['ok']:",
  "            raise RuntimeError(_envelope['error'])",
  "        return _envelope['value']",
  "    return _tool",
].join("\n");

/** Build the full source for one run: prelude, this run's tools, then the guest's code. */
export function buildGuestSource(options: BuildGuestSourceOptions): string {
  const lines = [...BOOTSTRAP, "", ...SIGNAL.split("\n")];
  lines.push(
    "",
    "# This run starts with no answer recorded.",
    FINAL_ANSWER_VALUE_GLOBAL + " = None",
    FINAL_ANSWER_RAISED_GLOBAL + " = False",
  );
  if (options.toolNames.length > 0) {
    lines.push("", "# This run's host tools.");
    for (const name of options.toolNames) {
      const literal = JSON.stringify(name);
      lines.push("globals()[" + literal + "] = _make_tool(" + literal + ")");
    }
  }
  if (options.code !== undefined && options.code !== "") {
    lines.push("", "# The step's code.");
    lines.push(options.code);
  }
  return lines.join("\n") + "\n";
}
