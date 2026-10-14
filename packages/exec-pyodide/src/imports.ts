import type { PyodideRuntime } from "./loader.js";

/**
 * The modules upstream's Python executor allows by default, in upstream's order. This is the
 * fidelity target, not a policy: the string is copied from BASE_BUILTIN_MODULES in
 * smolagents/utils.py so an agent that worked under the upstream interpreter keeps working
 * here even though this guest is real CPython.
 */
export const DEFAULT_AUTHORIZED_IMPORTS = [
  "collections",
  "datetime",
  "itertools",
  "math",
  "queue",
  "random",
  "re",
  "stat",
  "statistics",
  "time",
  "unicodedata",
] as const;

/** A prefix tree keyed by module part, where the key * authorizes everything below. */
export type ImportTree = { [part: string]: ImportTree };

/**
 * The tree upstream builds from an authorized list. "numpy.*" becomes { numpy: { "*": {} } },
 * which is what makes the wildcard mean "this package and everything under it".
 */
export function buildImportTree(authorized: readonly string[]): ImportTree {
  const tree: ImportTree = {};
  for (const path of authorized) {
    const parts = path.split(".");
    let current = tree;
    for (const part of parts) {
      const next = current[part] ?? (current[part] = {});
      current = next;
    }
  }
  return tree;
}

/**
 * Upstream's check_import_authorized: walk the requested dotted name through the tree; a *
 * key authorizes the rest, and running out of tree refuses. A name that merely starts with an
 * authorized word is not authorized, so os does not ride in on itertools.
 */
export function checkImportAuthorized(importToCheck: string, authorized: readonly string[]): boolean {
  let current: ImportTree | undefined = buildImportTree(authorized);
  for (const part of importToCheck.split(".")) {
    if (current === undefined) {
      return false;
    }
    if ("*" in current) {
      return true;
    }
    current = current[part];
  }
  return current !== undefined;
}

function toPythonLiteral(tree: ImportTree): string {
  const entries = Object.keys(tree).map(
    (key) => JSON.stringify(key) + ": " + toPythonLiteral(tree[key] as ImportTree),
  );
  return "{" + entries.join(", ") + "}";
}

function toPythonList(values: readonly string[]): string {
  return "[" + values.map((value) => JSON.stringify(value)).join(", ") + "]";
}

/**
 * Replace builtins.__import__ with the guard. Call this after the prelude's own imports have
 * run: the prelude keeps its try/except NameError bootstrap so a later run does not ask the
 * guard for json.
 *
 * The check is scoped to the guest. A real interpreter routes every module's own import
 * statements through builtins.__import__, so a guard that refused every unauthorized name
 * would also refuse the internal imports of an authorized module and break the default list
 * itself: datetime, queue and statistics each reach for _io while loading. The guard
 * therefore compares the caller globals against the guest's, which is the boundary upstream
 * draws when it checks the AST of the guest's code and lets the real import system handle
 * everything the imported module does. Guest code keeps its refusal; a library's imports pass
 * through.
 *
 * The guard raises ImportError with upstream's wording. It is a fidelity guard, not a
 * sandbox: guest code that reaches the saved __original_import__, or calls __import__ with an
 * explicit non-guest globals, bypasses it, and the decision record says so.
 */
export function installImportGuard(runtime: PyodideRuntime, authorized: readonly string[]): void {
  const source = [
    "_TS_AUTHORIZED = " + toPythonList(authorized),
    "_TS_IMPORT_TREE = " + toPythonLiteral(buildImportTree(authorized)),
    "_TS_GUEST_GLOBALS = globals()",
    "",
    "def _ts_import_authorized(import_to_check):",
    "    current_node = _TS_IMPORT_TREE",
    "    for part in import_to_check.split('.'):",
    "        if '*' in current_node:",
    "            return True",
    "        if part not in current_node:",
    "            return False",
    "        current_node = current_node[part]",
    "    return True",
    "",
    "def _ts_import(name, globals=None, locals=None, fromlist=(), level=0):",
    "    if globals is _TS_GUEST_GLOBALS and (level != 0 or not _ts_import_authorized(name)):",
    "        raise ImportError(",
    "            'Import of ' + name + ' is not allowed. Authorized imports are: ' + str(_TS_AUTHORIZED)",
    "        )",
    "    return __original_import__(name, globals, locals, fromlist, level)",
    "",
    "_builtins.__import__ = _ts_import",
  ].join("\n");
  runtime.runPython(source);
}
