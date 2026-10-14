import type { ReactNode } from "react";
import type { MultiStepAgent } from "@smolagents-ts/core";
import { AgentRun } from "./agent-run.js";
import { AgentStep } from "./agent-step.js";
import { useAgentRunSnapshot, type AgentRunComponents } from "./context.js";

export interface RunInspectorProps {
  readonly agent: MultiStepAgent;
  readonly task: string;
  readonly components?: AgentRunComponents;
  readonly children?: ReactNode;
}

/**
 * The body sits inside the provider `AgentRun` creates, so it reads the same snapshot the
 * primitives render: planning is a lane of its own in the store, never an entry in `steps`.
 */
function RunInspectorBody({ children }: { readonly children?: ReactNode }) {
  const snapshot = useAgentRunSnapshot();
  return (
    <>
      <AgentRun.Status />
      <AgentRun.Cancel />
      <AgentRun.Steps>
        {(step) => (
          <AgentStep.Action step={step}>
            <AgentStep.Code />
            <AgentStep.ToolCalls />
            <AgentStep.Logs />
            <AgentStep.Observation />
          </AgentStep.Action>
        )}
      </AgentRun.Steps>
      {snapshot.planning.map((planning) => (
        <AgentStep.Planning key={planning.stepIndex} planning={planning} />
      ))}
      <AgentRun.FinalAnswer />
      {children}
    </>
  );
}

/**
 * The opinionated full timeline: one run, the status and its cancellation, the action steps
 * with all four leaves, the planning lane and the run's answer. It composes the L3
 * primitives and holds no state, so a caller still chooses every override the primitives
 * already accept.
 */
export function RunInspector({ agent, task, components, children }: RunInspectorProps) {
  const overrideProps = components === undefined ? {} : { components };
  return (
    <AgentRun agent={agent} task={task} {...overrideProps}>
      <RunInspectorBody>{children}</RunInspectorBody>
    </AgentRun>
  );
}
