import type { ReactNode } from "react";
import type { PlanningView, StepView } from "@smolagents-ts/core";
import { CodeBlock } from "./code-block.js";
import { StepProvider, useAgentRunContext, useStepContext } from "./context.js";
import { FinalAnswer } from "./final-answer.js";
import { ToolCall } from "./tool-call.js";

export interface AgentStepProps {
  readonly step: StepView;
  readonly children?: ReactNode;
}

/** An action step. Provides the step to its leaves, or hands over to an override. */
function AgentStepAction({ step, children }: AgentStepProps) {
  const Override = useAgentRunContext().components.action;
  if (Override !== undefined) return <Override step={step} />;
  return (
    <StepProvider value={step}>
      <section
        className="agent-step-action"
        data-step-index={step.stepIndex}
        data-status={step.status}
      >
        {children}
      </section>
    </StepProvider>
  );
}

export interface AgentStepPlanningProps {
  readonly planning: PlanningView;
  readonly children?: ReactNode;
}

/** A planning step. Planning is a lane of its own in the store, not an action step. */
function AgentStepPlanning({ planning, children }: AgentStepPlanningProps) {
  const Override = useAgentRunContext().components.planning;
  if (Override !== undefined) return <Override planning={planning} />;
  return (
    <section className="agent-step-planning" data-status={planning.status}>
      <pre className="agent-step-planning-text">{planning.text}</pre>
      {children}
    </section>
  );
}

function AgentStepFinalAnswer({ step, children }: AgentStepProps) {
  const Override = useAgentRunContext().components.finalAnswer;
  if (Override !== undefined) return <Override step={step} />;
  return (
    <StepProvider value={step}>
      <section className="agent-step-final-answer" data-step-index={step.stepIndex}>
        {step.observation === null ? null : <FinalAnswer value={step.observation} />}
        {children}
      </section>
    </StepProvider>
  );
}

function AgentStepCode() {
  const step = useStepContext();
  return step.code === null ? null : <CodeBlock code={step.code} />;
}

/** Appended output, announced politely. Nothing to append means nothing rendered. */
function AgentStepLogs() {
  const step = useStepContext();
  return step.logs === "" ? null : (
    <pre className="agent-step-logs" aria-live="polite" aria-label="Run output">
      {step.logs}
    </pre>
  );
}

function AgentStepObservation() {
  const step = useStepContext();
  return step.observation === null || step.observation === "" ? null : (
    <div className="agent-step-observation">{step.observation}</div>
  );
}

function AgentStepToolCalls() {
  const step = useStepContext();
  if (step.toolCalls.length === 0) return null;
  return (
    <ul className="agent-step-tool-calls">
      {step.toolCalls.map((call) => (
        <li key={call.id}>
          <ToolCall call={call} />
        </li>
      ))}
    </ul>
  );
}

export const AgentStep = Object.assign(AgentStepAction, {
  Action: AgentStepAction,
  Planning: AgentStepPlanning,
  FinalAnswer: AgentStepFinalAnswer,
  Code: AgentStepCode,
  ToolCalls: AgentStepToolCalls,
  Logs: AgentStepLogs,
  Observation: AgentStepObservation,
});
