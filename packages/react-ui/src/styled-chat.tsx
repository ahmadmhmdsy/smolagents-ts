import { ChatSurface, type ChatSurfaceProps } from "@smolagents-ts/react";

/** The caller's class composes with the wrapper's own; undefined and "" add nothing. */
function withClassName(base: string, className: string | undefined): string {
  return className === undefined || className === "" ? base : base + " " + className;
}

export interface StyledChatSurfaceProps extends ChatSurfaceProps {
  readonly className?: string;
}

/**
 * The styled chat surface: one `.smol-chat-surface` element around `ChatSurface`.
 * It adds a class and forwards every prop, including the caller's `className`.
 * The composer's `aria-describedby` and the disabled state belong to the
 * primitive, so the wrapper never re-authors them.
 */
export function StyledChatSurface({ className, ...props }: StyledChatSurfaceProps) {
  return (
    <div className={withClassName("smol-chat-surface", className)}>
      <ChatSurface {...props} />
    </div>
  );
}
