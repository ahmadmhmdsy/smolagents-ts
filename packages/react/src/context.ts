import { createContext, useContext, type ComponentType } from "react";
import type {
  AgentSessionSnapshot,
  MultiStepAgent,
  PlanningView,
  StepView,
} from "@smolagents-ts/core";

/** The override map the design's `components` prop carries: one slot per step kind. */
export interface AgentRunComponents {
  readonly action?: ComponentType<{ readonly step: StepView }>;
  readonly planning?: ComponentType<{ readonly planning: PlanningView }>;
  readonly finalAnswer?: ComponentType<{ readonly step: StepView }>;
}

export interface AgentRunContextValue {
  readonly agent: MultiStepAgent;
  readonly snapshot: AgentSessionSnapshot;
  readonly components: AgentRunComponents;
  readonly cancel: () => void;
}

const AgentRunContext = createContext<AgentRunContextValue | null>(null);
export const AgentRunProvider = AgentRunContext.Provider;

export function useAgentRunContext(): AgentRunContextValue {
  const value = useContext(AgentRunContext);
  if (value === null) {
    throw new Error("This component must be rendered inside <AgentRun>.");
  }
  return value;
}

/** The snapshot of the run this component sits in, for a custom composition. */
export function useAgentRunSnapshot(): AgentSessionSnapshot {
  return useAgentRunContext().snapshot;
}

const StepContext = createContext<StepView | null>(null);
export const StepProvider = StepContext.Provider;

export function useStepContext(): StepView {
  const value = useContext(StepContext);
  if (value === null) {
    throw new Error(
      "This component must be rendered inside an <AgentStep.Action> or <AgentStep.FinalAnswer>.",
    );
  }
  return value;
}
