import type { ReactNode } from "react";

/** A value as text: strings verbatim, everything else as JSON when it can be serialised. */
export function renderValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export interface FinalAnswerProps {
  readonly value: unknown;
  readonly children?: ReactNode;
}

/** The run's answer. Renders nothing until there is one. */
export function FinalAnswer({ value, children }: FinalAnswerProps) {
  if (value === undefined) return null;
  return (
    <div className="agent-final-answer">
      <span>{renderValue(value)}</span>
      {children}
    </div>
  );
}
