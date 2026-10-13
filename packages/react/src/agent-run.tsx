import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { AgentSession, MultiStepAgent, SessionStatus, StepView } from "@smolagents-ts/core";
import { AgentRunProvider, useAgentRunContext, type AgentRunComponents } from "./context.js";
import { FinalAnswer } from "./final-answer.js";
import { useAgentRun } from "./use-agent-run.js";

const STATUS_TEXT: Record<SessionStatus, string> = {
  idle: "Idle",
  running: "Running",
  success: "Finished",
  failed: "Failed",
  cancelled: "Cancelled",
  max_steps: "Stopped at the step limit",
};

export interface AgentRunProps {
  readonly agent: MultiStepAgent;
  readonly task: string;
  readonly components?: AgentRunComponents;
  readonly children?: ReactNode;
}

function AgentRunRoot({ agent, task, components, children }: AgentRunProps) {
  const { session, snapshot, run, cancel } = useAgentRun(agent);
  const started = useRef<{ session: AgentSession; task: string } | null>(null);
  useEffect(() => {
    const previous = started.current;
    if (previous !== null && previous.session === session && previous.task === task) return;
    started.current = { session, task };
    void run(task).catch(() => {
      // The store recorded the failure; this only stops it becoming an unhandled rejection.
    });
  }, [session, run, task]);
  const value = useMemo(
    () => ({ agent, snapshot, components: components ?? {}, cancel }),
    [agent, snapshot, components, cancel],
  );
  return (
    <AgentRunProvider value={value}>
      <div className="agent-run" data-status={snapshot.status} data-running={snapshot.isRunning}>
        {children}
      </div>
    </AgentRunProvider>
  );
}

/** The run's status: announced politely, and busy while the run is in flight. */
function AgentRunStatus() {
  const { snapshot } = useAgentRunContext();
  return (
    <p role="status" aria-live="polite" aria-busy={snapshot.isRunning}>
      {snapshot.isRunning
        ? "Running, step " + String(snapshot.steps.length)
        : STATUS_TEXT[snapshot.status]}
    </p>
  );
}

export interface AgentRunStepsProps {
  readonly children?: ReactNode | ((step: StepView) => ReactNode);
}

/** The step list: an ordered list, one focusable item per step. */
function AgentRunSteps({ children }: AgentRunStepsProps) {
  const { snapshot } = useAgentRunContext();
  return (
    <ol className="agent-run-steps">
      {snapshot.steps.map((step) => (
        <li
          key={step.stepIndex}
          data-step-index={step.stepIndex}
          data-status={step.status}
          tabIndex={0}
        >
          {typeof children === "function" ? children(step) : children}
        </li>
      ))}
    </ol>
  );
}

/** Cancellation as a real button, disabled when there is nothing to cancel. */
function AgentRunCancel() {
  const { snapshot, cancel } = useAgentRunContext();
  return (
    <button type="button" onClick={cancel} disabled={!snapshot.isRunning}>
      Cancel run
    </button>
  );
}

function AgentRunFinalAnswer() {
  const { snapshot } = useAgentRunContext();
  return snapshot.status === "success" ? <FinalAnswer value={snapshot.output} /> : null;
}

export const AgentRun = Object.assign(AgentRunRoot, {
  Status: AgentRunStatus,
  Steps: AgentRunSteps,
  Cancel: AgentRunCancel,
  FinalAnswer: AgentRunFinalAnswer,
});
