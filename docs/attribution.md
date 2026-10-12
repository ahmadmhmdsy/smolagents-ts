# Attribution

smolagents-ts is derived from [smolagents](https://github.com/huggingface/smolagents),
commit 96f33faaf028479119ec8d34507b47694cf14e34 (v1.27.0.dev0, 2026-10-06), Apache-2.0.

The table records, per upstream file, what this project does with it. It is kept current as modules are
ported; a module is not "done" until its row is accurate.

| upstream file | disposition | this project |
|---|---|---|
| src/smolagents/agents.py | port | packages/core/src/agent/* |
| src/smolagents/memory.py | port | packages/core/src/memory/* |
| src/smolagents/monitoring.py | port | packages/core/src/monitoring/* |
| src/smolagents/models.py | split (interface vs adapters) | packages/core/src/model.ts, packages/models/src/* |
| src/smolagents/tools.py | port | packages/core/src/tool/*, packages/tools/src/index.ts |
| src/smolagents/default_tools.py | port subset | packages/tools/src/defaults/* |
| src/smolagents/utils.py | port subset | packages/core/src/utils/* |
| src/smolagents/agent_types.py | port subset | packages/core/src/types.ts |
| src/smolagents/prompts/*.yaml | port, translated to the JS dialect | packages/core/src/prompts/* |
| src/smolagents/local_python_executor.py | replace | packages/exec-quickjs |
| src/smolagents/gradio_ui.py | replace | packages/react |
| src/smolagents/_function_type_hints_utils.py | drop (replaced by Zod) | — |
| src/smolagents/tool_validation.py | drop (replaced by Zod + guards) | — |
| src/smolagents/serialization.py | defer to v1.5 | planned packages/core/src/serialization |
| src/smolagents/mcp_client.py | defer to v1.5 | planned packages/mcp |
| src/smolagents/remote_executors.py | defer to v1.5 | planned packages/exec-remote |
| src/smolagents/cli.py | defer to v1.5 | planned packages/cli |
| src/smolagents/vision_web_browser.py | defer to v2 | — |
