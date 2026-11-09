import { useId, useMemo, type FormEvent, type ReactNode } from "react";
import {
  encodeBase64,
  mediaParts,
  messageText,
  type AudioPart,
  type ChatMessage,
  type ContentPart,
  type ImagePart,
} from "@smolagents-ts/core";
import { useAgentRunSnapshot } from "./context.js";

export interface ChatSurfaceProps {
  /**
   * The transcript to render. Omitted, the surface renders the snapshot's conversation (decision
   * 0031) -- the same projection the run view does not show. That list is per run unless the
   * session names a checkpoint, so a caller that wants a chat across turns passes a checkpoint
   * to `AgentSession`; passing messages explicitly still wins.
   */
  readonly messages?: readonly ChatMessage[];
  readonly onSubmit?: (text: string) => void;
  readonly disabledReason?: string;
  readonly children?: ReactNode;
}

/** A data URI, so there is no object URL to revoke and a server can render it too. */
function useDataUri(part: ImagePart | AudioPart): string {
  return useMemo(() => "data:" + part.mediaType + ";base64," + encodeBase64(part.bytes), [part]);
}

/** An image is never left with an empty `alt`: with none given, the page says so. */
function TranscriptImage({ part }: { readonly part: ImagePart }) {
  const src = useDataUri(part);
  const alt = part.alt?.trim() ?? "";
  return (
    <figure>
      <img src={src} alt={alt === "" ? "Image" : alt} />
      {alt === "" ? <figcaption>No description given.</figcaption> : null}
    </figure>
  );
}

function TranscriptAudio({ part }: { readonly part: AudioPart }) {
  return <audio controls aria-label="Audio clip" src={useDataUri(part)} />;
}

function TranscriptPart({ part }: { readonly part: ContentPart }) {
  if (part.type === "image") return <TranscriptImage part={part} />;
  if (part.type === "audio") return <TranscriptAudio part={part} />;
  return <p>{part.text}</p>;
}

/** Text stays one span; only a message that carries media takes the block form. */
function MessageBody({ message }: { readonly message: ChatMessage }) {
  const parts = mediaParts(message.content);
  if (parts === undefined) return <span>{messageText(message)}</span>;
  return (
    <div>
      {parts.map((part, index) => (
        <TranscriptPart key={index} part={part} />
      ))}
    </div>
  );
}

/**
 * The transcript and its composer over the run's snapshot. The store owns the run, so the
 * composer can only hand text to the caller: it cannot `send` anything itself. While a run
 * is in flight the store's own reason wins, so a caller's `disabledReason` is only used
 * when there is no handler to submit to.
 */
export function ChatSurface({ messages, onSubmit, disabledReason, children }: ChatSurfaceProps) {
  const snapshot = useAgentRunSnapshot();
  const transcript = messages ?? snapshot.messages;
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
        {transcript.map((message, index) => (
          <li key={index} data-role={message.role}>
            <span>{message.role}</span>
            <MessageBody message={message} />
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
