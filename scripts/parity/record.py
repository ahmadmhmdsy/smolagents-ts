"""Replays the shared scenario corpus through the installed upstream smolagents.

Usage:
    python scripts/parity/record.py

Writes one normalized trace per scenario to scripts/parity/recordings/<id>.json.
The upstream package is a third-party release this repository does not depend
on; docs/10-runbooks/record-parity-traces.md owns the procedure.
"""

from __future__ import annotations

import contextlib
import glob
import io
import json
import platform
import sys
from datetime import datetime
from importlib.metadata import version
from pathlib import Path

from smolagents import CodeAgent, Model, Tool, ToolCallingAgent
from smolagents.models import ChatMessage, ChatMessageToolCall, ChatMessageToolCallDefinition, MessageRole

ROOT = Path(__file__).resolve().parents[2]
SCENARIOS = ROOT / "scripts" / "parity" / "scenarios"
RECORDINGS = ROOT / "scripts" / "parity" / "recordings"

CODE_CALL = "python_interpreter"
CODE_LABEL = "code"

# The canonical vocabulary. tool-call folds into the assistant turn it belongs
# to; tool-response is the observation turn.
ROLE_MAP = {"system": "system", "user": "user", "assistant": "assistant", "tool-response": "observation"}

REQUIRED = ("id", "task", "tools", "planningInterval", "maxSteps", "turns", "expect")

AGENTS = ("code", "tool-calling")


class EchoTool(Tool):
    """The shared stub (decision 0032): the TypeScript reader defines the same tool."""

    name = "echo"
    description = "Returns the text it is given."
    inputs = {"text": {"type": "string", "description": "The text to return."}}
    output_type = "string"

    def forward(self, text: str) -> str:
        return text


# The stubs a tool-calling scenario may name, keyed by name.
STUBS = {"echo": EchoTool}


def role_name(value: object) -> str:
    return str(getattr(value, "value", value))


def normalize_roles(raw: list[str]) -> list[str]:
    out: list[str] = []
    for role in raw:
        canonical = ROLE_MAP.get(role)
        if canonical is None:
            continue
        if out and out[-1] == canonical:
            continue
        out.append(canonical)
    return out


def normalize_steps(memory_steps: list[object]) -> list[str]:
    kinds = []
    for step in memory_steps:
        name = type(step).__name__
        if name == "ActionStep":
            kinds.append("action")
        elif name == "PlanningStep":
            kinds.append("planning")
    return kinds


def normalize_actions(memory_steps: list[object]) -> list[dict]:
    actions = []
    for step in memory_steps:
        if type(step).__name__ != "ActionStep":
            continue
        names = []
        for call in getattr(step, "tool_calls", None) or []:
            name = getattr(call, "name", None)
            names.append(CODE_LABEL if name == CODE_CALL else name)
        actions.append({"toolCalls": names, "error": getattr(step, "error", None) is not None})
    return actions


def jsonable(value: object) -> object:
    try:
        json.dumps(value)
        return value
    except TypeError:
        return {"unserializable": type(value).__name__}


class ScriptedModel(Model):
    """A model whose every call returns the next scripted turn."""

    def __init__(self, contents: list[object]) -> None:
        super().__init__()
        self._contents = list(contents)
        self.roles: list[list[str]] = []

    def __call__(self, messages, stop_sequences=None, grammar=None, tools_to_call_from=None, **kwargs):
        self.roles.append([role_name(message["role"]) for message in messages])
        if not self._contents:
            raise RuntimeError("the scenario script is shorter than the model calls upstream makes")
        reply = self._contents.pop(0)
        if isinstance(reply, str):
            return ChatMessage(role=MessageRole.ASSISTANT, content=reply)
        calls = [
            ChatMessageToolCall(
                id="call_" + str(index),
                type="function",
                function=ChatMessageToolCallDefinition(name=call["name"], arguments=call["arguments"]),
            )
            for index, call in enumerate(reply)
        ]
        return ChatMessage(role=MessageRole.ASSISTANT, content="", tool_calls=calls)


def turn_reply(scenario: dict, turn: dict) -> object:
    """A code turn replies with text; a tool-calling turn with its calls, arguments as a mapping."""
    if scenario.get("agent", "code") == "tool-calling":
        return turn["calls"]
    return turn["py"]


def scripted_contents(scenario: dict) -> list[object]:
    """The scripted replies in call order: a plan before each turn the cadence plans at.

    Upstream plans before the first action and again every planning_interval steps. The
    scenario lists plans separately from turns so both readers interleave them the same way.
    """
    plans = scenario.get("plans") or []
    interval = scenario.get("planningInterval") or 0
    contents: list[object] = []
    plan_index = 0
    for index, turn in enumerate(scenario["turns"]):
        if interval > 0 and index % interval == 0 and plan_index < len(plans):
            contents.append(plans[plan_index]["py"])
            plan_index += 1
        contents.append(turn_reply(scenario, turn))
    if plan_index < len(plans):
        raise SystemExit(
            scenario["id"] + " declares " + str(len(plans) - plan_index) + " plan(s) the"
            + " declared cadence never asks for; raise planningInterval's run or drop them"
        )
    return contents


def read_scenarios() -> list[dict]:
    files = sorted(glob.glob(str(SCENARIOS / "*.json")))
    if not files:
        raise SystemExit("no scenarios under " + str(SCENARIOS))
    scenarios = []
    for path in files:
        with open(path, encoding="utf-8") as handle:
            scenario = json.load(handle)
        for field in REQUIRED:
            if field not in scenario:
                raise SystemExit(path + " is missing the field " + field)
        agent = scenario.get("agent", "code")
        if agent not in AGENTS:
            raise SystemExit(path + " declares the unknown agent " + str(agent))
        if agent == "code" and scenario["tools"]:
            raise SystemExit(
                path
                + " is a code scenario that declares tools; a tool called from code changes"
                + " no compared field, so both runs would compare equal while ignoring it"
            )
        unknown = [name for name in scenario["tools"] if name not in STUBS]
        if unknown:
            raise SystemExit(path + " names tools with no registered stub: " + ", ".join(unknown))
        if agent == "tool-calling":
            for index, turn in enumerate(scenario["turns"]):
                calls = turn.get("calls")
                if not isinstance(calls, list) or not calls:
                    raise SystemExit(path + " turn " + str(index) + " declares no calls")
                for call in calls:
                    if not isinstance(call.get("name"), str) or not isinstance(call.get("arguments"), dict):
                        raise SystemExit(path + " turn " + str(index) + " has a call without a name and arguments")
        for plan in scenario.get("plans") or []:
            if not isinstance(plan.get("py"), str) or not isinstance(plan.get("ts"), str):
                raise SystemExit(path + " declares a plan without a Python and a TypeScript reply")
        scenarios.append(scenario)
    return scenarios


def record(scenario: dict) -> dict:
    model = ScriptedModel(scripted_contents(scenario))
    tools = [STUBS[name]() for name in scenario["tools"]]
    options = {"tools": tools, "model": model, "max_steps": scenario["maxSteps"]}
    if scenario.get("planningInterval"):
        options["planning_interval"] = scenario["planningInterval"]
    if scenario.get("agent", "code") == "tool-calling":
        agent = ToolCallingAgent(**options)
    else:
        agent = CodeAgent(**options)

    final_answer = None
    saw_final = False
    outcome = None
    with contextlib.redirect_stdout(io.StringIO()):
        try:
            for step in agent.run(scenario["task"], stream=True):
                if type(step).__name__ == "FinalAnswerStep":
                    saw_final = True
                    final_answer = step.final_answer
        except Exception as error:  # noqa: BLE001 - the outcome is the measurement
            outcome = "error"
            final_answer = {"raised": type(error).__name__}

    if outcome is None:
        outcome = "final-answer" if saw_final else "error"

    trace = {
        "scenario": scenario["id"],
        "outcome": outcome,
        "finalAnswer": jsonable(final_answer),
        "steps": normalize_steps(list(agent.memory.steps)),
        "actions": normalize_actions(list(agent.memory.steps)),
        "modelCalls": [normalize_roles(roles) for roles in model.roles],
    }
    return {
        "scenario": scenario["id"],
        "meta": {
            "upstreamVersion": version("smolagents"),
            "pythonVersion": platform.python_version(),
            "recordedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
            "recorder": "scripts/parity/record.py",
        },
        "trace": trace,
    }


def main() -> int:
    RECORDINGS.mkdir(parents=True, exist_ok=True)
    for scenario in read_scenarios():
        payload = record(scenario)
        path = RECORDINGS / (scenario["id"] + ".json")
        path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n")
        meta = payload["meta"]
        print("wrote " + str(path.relative_to(ROOT)).replace("\\", "/")
              + " (upstream " + meta["upstreamVersion"] + ", python " + meta["pythonVersion"] + ")")
    return 0


if __name__ == "__main__":
    sys.exit(main())
