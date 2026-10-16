import type { ChatMessage } from "../types.js";
import {
  stepFromJSON,
  stepToJSON,
  type ActionStep,
  type AnyAgentStep,
  type FinalAnswerStep,
  type StepJSON,
  type SystemPromptStep,
  type TaskStep,
} from "./steps.js";

export interface ToMessagesOptions {
  /** Overrides the stored system prompt, for callers that render it themselves. */
  systemPrompt?: string;
  /**
   * The shape an executed action takes. "observation" is the turn both agents shared
   * before: the model output, then the Observation. "tool-messages" is what a
   * tool-calling provider expects: one assistant turn carrying tool_calls, then one
   * role "tool" message per result.
   */
  toolResults?: "observation" | "tool-messages";
}

/**
 * The agent's memory: an ordered list of typed steps, plus the views derived from it.
 * Ported from upstream smolagents memory.py.
 */
export class AgentMemory {
  private readonly items: AnyAgentStep[] = [];

  /**
   * A frozen snapshot, rebuilt on access, so callers can never mutate memory through it.
   * A run holds only a handful of steps, so the copy is cheap and the guarantee is real.
   */
  get steps(): readonly AnyAgentStep[] {
    return Object.freeze([...this.items]);
  }

  addStep(step: AnyAgentStep): void {
    this.items.push(step);
  }

  /** The steps as plain objects — the checkpoint a store persists and reads back. */
  toJSON(): StepJSON[] {
    return this.items.map((step) => stepToJSON(step));
  }

  /** Replace the memory with steps read back from a checkpoint. */
  restore(steps: readonly StepJSON[]): void {
    this.items.length = 0;
    for (const step of steps) this.items.push(stepFromJSON(step));
  }

  reset(): void {
    this.items.length = 0;
  }

  get systemPrompt(): string | undefined {
    return this.items.find((s): s is SystemPromptStep => s.kind === "system_prompt")?.systemPrompt;
  }

  get task(): string | undefined {
    return this.items.find((s): s is TaskStep => s.kind === "task")?.task;
  }

  get finalAnswerStep(): FinalAnswerStep | undefined {
    return this.items.find((s): s is FinalAnswerStep => s.kind === "final_answer");
  }

  get actionSteps(): readonly ActionStep[] {
    return this.items.filter((s): s is ActionStep => s.kind === "action");
  }

  /**
   * The transcript handed to the model. Mirrors upstream's to_messages() semantics:
   * the system prompt, the task, then one assistant turn plus one observation turn
   * per action, in order.
   */
  toMessages(options: ToMessagesOptions = {}): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const systemPrompt = options.systemPrompt ?? this.systemPrompt;
    if (systemPrompt !== undefined) {
      messages.push({ role: "system", content: systemPrompt });
    }
    for (const step of this.items) {
      switch (step.kind) {
        case "task":
          messages.push({ role: "user", content: step.task });
          break;
        case "planning":
          messages.push({ role: "assistant", content: "Plan:\n" + step.plan });
          messages.push({ role: "user", content: "Now proceed with the plan." });
          break;
        case "action": {
          const calls = step.toolCalls;
          if (options.toolResults === "tool-messages" && calls.length > 0) {
            messages.push({
              role: "assistant",
              content: step.modelOutput ?? "",
              toolCalls: calls.map((call) => ({
                id: call.id,
                name: call.name,
                arguments: JSON.stringify(call.arguments ?? {}),
              })),
            });
            for (const call of calls) {
              messages.push({
                role: "tool",
                toolCallId: call.id,
                name: call.name,
                content:
                  call.error === undefined ? stringifyOutput(call.result) : "Error: " + call.error,
              });
            }
            break;
          }
          if (step.modelOutput !== null) {
            messages.push({ role: "assistant", content: step.modelOutput });
          }
          if (step.observations !== null) {
            messages.push({ role: "user", content: "Observation:\n" + step.observations });
          }
          break;
        }
        case "final_answer":
        case "system_prompt":
          break;
        default:
          break;
      }
    }
    return messages;
  }

  /**
   * The derived chat view used by the React shell (design spec 5.3, layer L1).
   * Deliberately lossy: it is a conversation, not a run.
   */
  toChatMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const task = this.task;
    if (task !== undefined) {
      messages.push({ role: "user", content: task });
    }
    for (const step of this.items) {
      if (step.kind === "action" && step.modelOutput !== null) {
        messages.push({ role: "assistant", content: step.modelOutput });
      } else if (step.kind === "final_answer") {
        messages.push({ role: "assistant", content: stringifyOutput(step.output) });
      }
    }
    return messages;
  }
}

function stringifyOutput(output: unknown): string {
  if (typeof output === "string") return output;
  try {
    return JSON.stringify(output) ?? String(output);
  } catch {
    return String(output);
  }
}
