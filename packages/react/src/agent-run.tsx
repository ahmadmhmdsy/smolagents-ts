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

/** The task the root last started, and a promise that settles once that run has. */
interface StartedRun {
  readonly session: AgentSession;
  readonly task: string;
  done: Promise<void>;
}

function AgentRunRoot({ agent, task, components, children }: AgentRunProps) {
  const { session, snapshot, run, cancel } = useAgentRun(agent);
  const started = useRef<StartedRun | null>(null);
  const pendingCancel = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // A cancel scheduled by the previous cleanup is withdrawn: the component is still
    // mounted, either because a prop changed or because StrictMode re-ran the effect.
    if (pendingCancel.current !== null) {
      clearTimeout(pendingCancel.current);
      pendingCancel.current = null;
    }
    const previous = started.current;
    if (previous === null || previous.session !== session || previous.task !== task) {
      // A session runs one task at a time, so a new task cancels the one in flight and
      // starts once that run has settled, rather than being refused and dropped.
      const waitFor =
        previous !== null && previous.session === session && session.isRunning
          ? previous.done
          : undefined;
      if (previous !== null) previous.session.cancel();
      const entry: StartedRun = { session, task, done: Promise.resolve() };
      const start = (): Promise<void> =>
        started.current === entry
          ? run(task).then(
              () => undefined,
              () => {
                // The store recorded the failure; this only stops an unhandled rejection.
              },
            )
          : Promise.resolve();
      started.current = entry;
      entry.done = waitFor === undefined ? start() : waitFor.then(start);
    }
    return () => {
      // Deferred, so StrictMode's simulated unmount, which re-runs the effect at once,
      // cancels nothing. A real unmount lets the timer fire and stops the run.
      pendingCancel.current = setTimeout(() => {
        pendingCancel.current = null;
        started.current = null;
        session.cancel();
      }, 0);
    };
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
