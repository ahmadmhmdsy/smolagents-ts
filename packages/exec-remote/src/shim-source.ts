import type { ToolSpec } from "@smolagents-ts/core";
import { SerializationError } from "./errors.js";
import type { SandboxFrame } from "./sandbox.js";
import { decodeValue, encodeValue } from "./serialize.js";

/** The host-owned sentinel that turns one stdout line into a frame. */
export const FRAME_PREFIX = "@@SMOLAGENTS_FRAME@@";

export interface ShimOptions {
  readonly tools: readonly ToolSpec[];
  /** false installs the refusing stub, for a backend with no mid-run call channel (E2B). */
  readonly allowToolCalls: boolean;
  /**
   * Values bound as Python globals before step 0. A name Python could not take is refused here,
   * with `SerializationError`, rather than producing a prelude that fails on import.
   */
  readonly variables?: Readonly<Record<string, unknown>>;
}

/** The identifier subset the wire accepts: Python is wider, and a narrower promise is honest. */
const PYTHON_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface DecodeFrameOptions {
  /** Accept a `pickle:` final answer as raw bytes instead of refusing it. */
  readonly allowPickle?: boolean;
}

/** The Python prelude: the answer sentinel, the blocking tool helper and the host's counterpart. */
export function buildShimSource(options: ShimOptions): string {
  const lines = PYTHON_PRELUDE.map((line) =>
    line.replace("__TOOL_CALLS_ENABLED__", options.allowToolCalls ? "True" : "False"),
  );
  for (const [name, value] of Object.entries(options.variables ?? {})) {
    if (!PYTHON_IDENTIFIER.test(name)) {
      throw new SerializationError(
        'Cannot bind "' + name + '" as a guest variable: the name is not a Python identifier.',
      );
    }
    lines.push(
      "globals()[" + JSON.stringify(name) + "] = _decode(" + JSON.stringify(encodeValue(value)) + ")",
    );
  }
  for (const spec of options.tools) {
    const properties = (spec.inputSchema["properties"] ?? {}) as Record<string, unknown>;
    const argNames = JSON.stringify(Object.keys(properties));
    lines.push(
      "globals()[" + JSON.stringify(spec.name) + "] = _make_tool(" + JSON.stringify(spec.name) + ", " + argNames + ")",
    );
  }
  return lines.join("\n") + "\n";
}

/**
 * The step loop a stdio transport appends to the prelude: the interpreter runs it as
 * `python -u -c <prelude+loop>`, so each step arrives as one JSON line on stdin and the
 * interpreter stays alive between steps. A backend whose Python is already a REPL (kernel) or
 * one-shot (E2B) does not use it.
 */
export function buildStepLoopSource(): string {
  return STEP_LOOP.join("\n") + "\n";
}

/**
 * One step, wrapped so a guest handler for `Exception` cannot swallow the answer signal and
 * so the step ends with exactly one `step_end` frame, success or failure. This is the
 * one-shot form a backend with no REPL runs as a whole program.
 */
export function buildStepSource(code: string): string {
  // The guest code is embedded as one Python string literal and executed. Indenting it line by
  // line would silently change the interior of a multi-line string literal.
  return (
    "try:\n" +
    "    exec(compile(" +
    JSON.stringify(code) +
    ', "<smolagent-step>", "exec"), globals())\n' +
    "except _FinalAnswerSignal:\n" +
    "    pass\n" +
    "except BaseException as _exc:\n" +
    '    _emit({"type": "error", "name": type(_exc).__name__, "message": str(_exc), "traceback": _traceback.format_exc()})\n' +
    "finally:\n" +
    '    _emit({"type": "step_end"})\n'
  );
}

/** Parse one line of guest output. A line without the sentinel is output, not a frame. */
export function parseFrameLine(line: string, options: DecodeFrameOptions = {}): SandboxFrame | undefined {
  if (!line.startsWith(FRAME_PREFIX)) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(line.slice(FRAME_PREFIX.length));
  } catch {
    throw new SerializationError("The guest emitted a frame line that is not valid JSON.");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new SerializationError("The guest emitted a frame that is not an object.");
  }
  const record = raw as Record<string, unknown>;
  const type = record["type"];
  switch (type) {
    case "final_answer":
      return { type: "final_answer", value: decodeValue(record["value"], options) };
    case "tool_call":
      return {
        type: "tool_call",
        callId: String(record["callId"]),
        name: String(record["name"]),
        args: decodeValue(record["args"], { allowPickle: false }),
      };
    case "error": {
      const frame: { type: "error"; name: string; message: string; traceback?: string } = {
        type: "error",
        name: typeof record["name"] === "string" ? record["name"] : "Exception",
        message: typeof record["message"] === "string" ? record["message"] : "",
      };
      if (typeof record["traceback"] === "string") frame.traceback = record["traceback"];
      return frame;
    }
    case "ready":
      return { type: "ready" };
    case "step_end":
      return { type: "step_end" };
    default:
      throw new SerializationError('Unknown sentinel frame type "' + String(type) + '".');
  }
}

const PYTHON_PRELUDE: readonly string[] = [
  "# Generated by @smolagents-ts/exec-remote. Do not edit: the shim is rebuilt for every run.",
  "import sys as _sys",
  "import json as _json",
  "import base64 as _base64",
  "import traceback as _traceback",
  "",
  "_FRAME_PREFIX = \"@@SMOLAGENTS_FRAME@@\"",
  "_TOOL_CALLS_ENABLED = __TOOL_CALLS_ENABLED__",
  "_CALL_COUNTER = [0]",
  "",
  "",
  "class _FinalAnswerSignal(BaseException):",
  "    \"\"\"Raised by final_answer(). A BaseException, so a guest `except Exception` cannot swallow it.\"\"\"",
  "",
  "    def __init__(self, value):",
  "        super().__init__(\"final_answer\")",
  "        self.value = value",
  "",
  "",
  "def _emit(_frame):",
  "    _sys.stdout.write(_FRAME_PREFIX + _json.dumps(_frame) + \"\\n\")",
  "    _sys.stdout.flush()",
  "",
  "",
  "def _encode(_value):",
  "    if _value is None or isinstance(_value, (bool, int, float, str)):",
  "        return _value",
  "    if isinstance(_value, (bytes, bytearray)):",
  "        return {\"__t\": \"bytes\", \"v\": _base64.b64encode(bytes(_value)).decode(\"ascii\")}",
  "    if isinstance(_value, tuple):",
  "        return {\"__t\": \"tuple\", \"v\": [_encode(_item) for _item in _value]}",
  "    if isinstance(_value, (set, frozenset)):",
  "        _tag = \"frozenset\" if isinstance(_value, frozenset) else \"set\"",
  "        return {\"__t\": _tag, \"v\": [_encode(_item) for _item in _value]}",
  "    if isinstance(_value, list):",
  "        return [_encode(_item) for _item in _value]",
  "    if isinstance(_value, dict):",
  "        if all(isinstance(_key, str) for _key in _value):",
  "            return {_key: _encode(_item) for _key, _item in _value.items()}",
  "        return {\"__t\": \"dict\", \"v\": [[_encode(_key), _encode(_item)] for _key, _item in _value.items()]}",
  "    if isinstance(_value, complex):",
  "        return {\"__t\": \"complex\", \"re\": _value.real, \"im\": _value.imag}",
  "    import datetime as _datetime",
  "    if isinstance(_value, _datetime.datetime):",
  "        return {\"__t\": \"datetime\", \"v\": _value.isoformat()}",
  "    if isinstance(_value, _datetime.date):",
  "        return {\"__t\": \"date\", \"v\": _value.isoformat()}",
  "    if isinstance(_value, _datetime.time):",
  "        return {\"__t\": \"time\", \"v\": _value.isoformat()}",
  "    if isinstance(_value, _datetime.timedelta):",
  "        return {\"__t\": \"timedelta\", \"v\": _value.total_seconds()}",
  "    import decimal as _decimal",
  "    if isinstance(_value, _decimal.Decimal):",
  "        return {\"__t\": \"decimal\", \"v\": str(_value)}",
  "    import pathlib as _pathlib",
  "    if isinstance(_value, _pathlib.PurePath):",
  "        return {\"__t\": \"path\", \"v\": str(_value)}",
  "    import dataclasses as _dataclasses",
  "    if _dataclasses.is_dataclass(_value) and not isinstance(_value, type):",
  "        return {",
  "            \"__t\": \"dataclass\",",
  "            \"name\": type(_value).__name__,",
  "            \"fields\": {_field.name: _encode(getattr(_value, _field.name)) for _field in _dataclasses.fields(_value)},",
  "        }",
  "    raise TypeError(\"smolagents: cannot serialize a value of type \" + type(_value).__name__)",
  "",
  "",
  "def _decode(_value):",
  "    if isinstance(_value, list):",
  "        return [_decode(_item) for _item in _value]",
  "    if isinstance(_value, dict):",
  "        _tag = _value.get(\"__t\")",
  "        if _tag == \"tuple\":",
  "            return tuple(_decode(_item) for _item in _value[\"v\"])",
  "        if _tag == \"set\":",
  "            return set(_decode(_item) for _item in _value[\"v\"])",
  "        if _tag == \"frozenset\":",
  "            return frozenset(_decode(_item) for _item in _value[\"v\"])",
  "        if _tag == \"bytes\":",
  "            return _base64.b64decode(_value[\"v\"])",
  "        if _tag == \"complex\":",
  "            return complex(_value[\"re\"], _value[\"im\"])",
  "        if _tag == \"datetime\":",
  "            import datetime as _datetime",
  "            return _datetime.datetime.fromisoformat(_value[\"v\"])",
  "        if _tag == \"date\":",
  "            import datetime as _datetime",
  "            return _datetime.date.fromisoformat(_value[\"v\"])",
  "        if _tag == \"time\":",
  "            import datetime as _datetime",
  "            return _datetime.time.fromisoformat(_value[\"v\"])",
  "        if _tag == \"timedelta\":",
  "            import datetime as _datetime",
  "            return _datetime.timedelta(seconds=_value[\"v\"])",
  "        if _tag == \"decimal\":",
  "            import decimal as _decimal",
  "            return _decimal.Decimal(_value[\"v\"])",
  "        if _tag == \"bigint\":",
  "            return int(_value[\"v\"])",
  "        if _tag == \"path\":",
  "            import pathlib as _pathlib",
  "            return _pathlib.Path(_value[\"v\"])",
  "        if _tag == \"dict\":",
  "            return {_decode(_pair[0]): _decode(_pair[1]) for _pair in _value[\"v\"]}",
  "        if _tag == \"dataclass\":",
  "            return {_key: _decode(_item) for _key, _item in _value[\"fields\"].items()}",
  "        return {_key: _decode(_item) for _key, _item in _value.items()}",
  "    return _value",
  "",
  "",
  "def final_answer(_value=None):",
  "    _emit({\"type\": \"final_answer\", \"value\": _encode(_value)})",
  "    raise _FinalAnswerSignal(_value)",
  "",
  "",
  "def _next_call_id():",
  "    _CALL_COUNTER[0] += 1",
  "    return \"call-\" + str(_CALL_COUNTER[0])",
  "",
  "",
  "def _request_tool(_name, _args):",
  "    # Emit the request frame first: a backend with no channel refuses it with its typed",
  "    # error, and a backend with a channel answers it below.",
  "    _emit({\"type\": \"tool_call\", \"callId\": _next_call_id(), \"name\": _name, \"args\": _encode(_args)})",
  "    if not _TOOL_CALLS_ENABLED:",
  "        raise RuntimeError(",
  "            \"smolagents: this backend has no mid-run call channel, so the tool '\" + _name + \"' cannot be called; call final_answer() instead\"",
  "        )",
  "    try:",
  "        _line = input()",
  "    except EOFError:",
  "        raise RuntimeError(\"smolagents: the tool channel closed while waiting for '\" + _name + \"'\")",
  "    _reply = _json.loads(_line)",
  "    if not _reply.get(\"ok\", False):",
  "        raise RuntimeError(\"smolagents: tool '\" + _name + \"' failed: \" + str(_reply.get(\"error\", \"unknown error\")))",
  "    return _decode(_reply.get(\"value\"))",
  "",
  "",
  "def _make_tool(_name, _arg_names):",
  "    def _tool(*_args, **_kwargs):",
  "        _bound = {}",
  "        for _index, _value in enumerate(_args):",
  "            if _index >= len(_arg_names):",
  "                raise TypeError(\"smolagents: too many positional arguments for '\" + _name + \"'\")",
  "            _bound[_arg_names[_index]] = _value",
  "        for _key, _value in _kwargs.items():",
  "            if _key not in _arg_names:",
  "                raise TypeError(\"smolagents: unexpected keyword argument '\" + _key + \"' for '\" + _name + \"'\")",
  "            _bound[_key] = _value",
  "        for _key in _arg_names:",
  "            if _key not in _bound:",
  "                raise TypeError(\"smolagents: missing argument '\" + _key + \"' for '\" + _name + \"'\")",
  "        return _request_tool(_name, _bound)",
  "",
  "    _tool.__name__ = _name",
  "    return _tool",
];

const STEP_LOOP: readonly string[] = [
  "",
  "",
  "def _step_loop():",
  "    while True:",
  "        _line = _sys.stdin.readline()",
  "        if _line == \"\":",
  "            return",
  "        try:",
  "            _request = _json.loads(_line)",
  "        except ValueError:",
  "            continue",
  "        if not isinstance(_request, dict) or _request.get(\"type\") != \"step\":",
  "            continue",
  "        try:",
  "            exec(compile(str(_request.get(\"code\", \"\")), \"<smolagent-step>\", \"exec\"), globals())",
  "        except _FinalAnswerSignal:",
  "            pass",
  "        except BaseException as _exc:",
  "            _emit({\"type\": \"error\", \"name\": type(_exc).__name__, \"message\": str(_exc), \"traceback\": _traceback.format_exc()})",
  "        finally:",
  "            _emit({\"type\": \"step_end\"})",
  "",
  "",
  "# Announce readiness before the first read, so a host that has no readiness poll waits on this.",
  "_emit({\"type\": \"ready\"})",
  "_step_loop()",
];
