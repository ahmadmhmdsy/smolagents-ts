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

from smolagents import CodeAgent, Model
from smolagents.models import ChatMessage, MessageRole

ROOT = Path(__file__).resolve().parents[2]
SCENARIOS = ROOT / "scripts" / "parity" / "scenarios"
RECORDINGS = ROOT / "scripts" / "parity" / "recordings"

CODE_CALL = "python_interpreter"
CODE_LABEL = "code"

# The canonical vocabulary. tool-call folds into the assistant turn it belongs
# to; tool-response is the observation turn.
ROLE_MAP = {"system": "system", "user": "user", "assistant": "assistant", "tool-response": "observation"}

REQUIRED = ("id", "task", "tools", "planningInterval", "maxSteps", "turns", "expect")


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

    def __init__(self, contents: list[str]) -> None:
        super().__init__()
        self._contents = list(contents)
        self.roles: list[list[str]] = []

    def __call__(self, messages, stop_sequences=None, grammar=None, tools_to_call_from=None, **kwargs):
        self.roles.append([role_name(message["role"]) for message in messages])
        if not self._contents:
            raise RuntimeError("the scenario script is shorter than the model calls upstream makes")
        return ChatMessage(role=MessageRole.ASSISTANT, content=self._contents.pop(0))


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
        scenarios.append(scenario)
    return scenarios


def record(scenario: dict) -> dict:
    model = ScriptedModel([turn["py"] for turn in scenario["turns"]])
    options = {"tools": [], "model": model, "max_steps": scenario["maxSteps"]}
    if scenario.get("planningInterval"):
        options["planning_interval"] = scenario["planningInterval"]
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
        path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        meta = payload["meta"]
        print("wrote " + str(path.relative_to(ROOT)).replace("\\", "/")
              + " (upstream " + meta["upstreamVersion"] + ", python " + meta["pythonVersion"] + ")")
    return 0


if __name__ == "__main__":
    sys.exit(main())
