import {
  CodeBlock,
  type CodeBlockProps,
  ToolCall,
  type ToolCallProps,
} from "@smolagents-ts/react";

/** The caller's class composes with the wrapper's own; undefined and "" add nothing. */
function withClassName(base: string, className: string | undefined): string {
  return className === undefined || className === "" ? base : base + " " + className;
}

export interface StyledToolCallProps extends ToolCallProps {
  readonly className?: string;
}

/**
 * The styled tool call: one `.smol-tool-call` element around `ToolCall`. It adds
 * a class and forwards every prop, including the caller's `className`. The
 * call's own polite live region is the primitive's, forwarded untouched.
 */
export function StyledToolCall({ className, ...props }: StyledToolCallProps) {
  return (
    <div className={withClassName("smol-tool-call", className)}>
      <ToolCall {...props} />
    </div>
  );
}

export interface StyledCodeBlockProps extends CodeBlockProps {
  readonly className?: string;
}

/**
 * The styled code block: one `.smol-code-block` element around `CodeBlock`. It
 * adds a class and forwards every prop, including the caller's `className`.
 */
export function StyledCodeBlock({ className, ...props }: StyledCodeBlockProps) {
  return (
    <div className={withClassName("smol-code-block", className)}>
      <CodeBlock {...props} />
    </div>
  );
}
