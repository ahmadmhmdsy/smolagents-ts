import { RunInspector, type RunInspectorProps } from "@smolagents-ts/react";

/** The caller's class composes with the wrapper's own; undefined and "" add nothing. */
function withClassName(base: string, className: string | undefined): string {
  return className === undefined || className === "" ? base : base + " " + className;
}

export interface StyledRunInspectorProps extends RunInspectorProps {
  readonly className?: string;
}

/**
 * The styled inspector: one `.smol-run-inspector` element around `RunInspector`.
 * It adds a class and forwards every prop, including the caller's `className`,
 * so the two compose.
 *
 * It authors no accessibility of its own. The status role, `aria-live` and
 * `aria-busy` belong to the primitives inside, and a wrapper that re-authored
 * them could drift from the primitive it wraps.
 */
export function StyledRunInspector({ className, ...props }: StyledRunInspectorProps) {
  return (
    <div className={withClassName("smol-run-inspector", className)}>
      <RunInspector {...props} />
    </div>
  );
}
