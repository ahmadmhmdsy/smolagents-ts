import type { ReactNode } from "react";

export interface CodeBlockProps {
  readonly code: string;
  readonly children?: ReactNode;
}

/** The one place a code block is written, so every primitive renders code the same way. */
export function CodeBlock({ code, children }: CodeBlockProps) {
  return (
    <pre className="agent-code-block">
      <code>{code}</code>
      {children}
    </pre>
  );
}
