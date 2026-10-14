import { useId, type FormEvent, type ReactNode } from "react";
import type { ChatMessage } from "@smolagents-ts/core";
import { useAgentRunSnapshot } from "./context.js";

export interface ChatSurfaceProps {
  readonly messages: readonly ChatMessage[];
  readonly onSubmit?: (text: string) => void;
  readonly disabledReason?: string;
  readonly children?: ReactNode;
}

/**
 * The transcript and its composer over the run's snapshot. The store owns the run, so the
 * composer can only hand text to the caller: it cannot `send` anything itself. While a run
 * is in flight the store's own reason wins, so a caller's `disabledReason` is only used
 * when there is no handler to submit to.
 */
export function ChatSurface({ messages, onSubmit, disabledReason, children }: ChatSurfaceProps) {
  const snapshot = useAgentRunSnapshot();
  const running = snapshot.isRunning;
  const hasHandler = onSubmit !== undefined;
  const disabled = running || !hasHandler;
  const reason = running
    ? "A run is already in flight."
    : hasHandler
      ? null
      : (disabledReason ?? "Sending is not available.");
  const inputId = useId();
  const reasonId = inputId + "-reason";

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (disabled || onSubmit === undefined) return;
    const text = String(new FormData(form).get("message") ?? "").trim();
    if (text === "") return;
    onSubmit(text);
    form.reset();
  }

  return (
    <section>
      <ol>
        {messages.map((message, index) => (
          <li key={index} data-role={message.role}>
            <span>{message.role}</span>
            <span>{message.content}</span>
          </li>
        ))}
      </ol>
      {children}
      <form onSubmit={handleSubmit}>
        <label htmlFor={inputId}>Message</label>
        <input
          id={inputId}
          name="message"
          disabled={disabled}
          aria-describedby={reason === null ? undefined : reasonId}
        />
        <button type="submit" disabled={disabled}>
          Send
        </button>
        {reason === null ? null : <p id={reasonId}>{reason}</p>}
      </form>
    </section>
  );
}
