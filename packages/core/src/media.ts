import { ContentTooLargeError, UnsupportedContentError } from "./errors.js";
import type { ModelCapabilities } from "./model.js";
import type {
  AudioMediaType,
  ChatMessage,
  ContentPart,
  ImageMediaType,
  MessageContent,
} from "./types.js";

/** The media types a part may declare. Anything else is refused before a model sees it. */
export const MEDIA_TYPES: readonly (ImageMediaType | AudioMediaType)[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "audio/wav",
  "audio/mpeg",
];

/**
 * The size limits on media. Both count base64-encoded bytes, because that is what a request
 * carries: a raw cap would pass a part the provider then refuses for its encoded size.
 */
export interface MediaLimits {
  maxPartBytes: number;
  maxRunBytes: number;
}

export const DEFAULT_MEDIA_LIMITS: MediaLimits = {
  maxPartBytes: 5 * 1024 * 1024,
  maxRunBytes: 20 * 1024 * 1024,
};

/** A message's text, with any media left out. A string comes back as it is. */
export function messageText(message: Pick<ChatMessage, "content">): string {
  if (typeof message.content === "string") return message.content;
  const texts: string[] = [];
  for (const part of message.content) {
    if (part.type === "text") texts.push(part.text);
  }
  return texts.join("\n");
}

/** Whether a message carries an image or a clip. */
export function hasMedia(message: Pick<ChatMessage, "content">): boolean {
  if (typeof message.content === "string") return false;
  return message.content.some((part) => part.type !== "text");
}

/** The parts of content that carries media, or undefined for content that is text however held. */
export function mediaParts(content: MessageContent): readonly ContentPart[] | undefined {
  return typeof content !== "string" && hasMedia({ content }) ? content : undefined;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const WAVE = [0x57, 0x41, 0x56, 0x45];

/** The allowed media type the bytes themselves show, or undefined when they show none. */
export function sniffMediaType(bytes: Uint8Array): ImageMediaType | AudioMediaType | undefined {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "image/webp";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WAVE, 8)) return "audio/wav";
  if (startsWith(bytes, [0x49, 0x44, 0x33])) return "audio/mpeg";
  // An MPEG frame sync. A zero layer field is AAC in ADTS framing, which is not on the list.
  const second = bytes[1] ?? 0;
  if (bytes[0] === 0xff && (second & 0xe0) === 0xe0 && (second & 0x06) !== 0) return "audio/mpeg";
  return undefined;
}

function encodedLength(byteLength: number): number {
  return 4 * Math.ceil(byteLength / 3);
}

const FROM_CHAR_CODE_CHUNK = 0x8000;

/** Base64 with no Buffer, for a browser. Spreading a whole clip into one call overflows the stack. */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let start = 0; start < bytes.length; start += FROM_CHAR_CODE_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(start, start + FROM_CHAR_CODE_CHUNK));
  }
  return btoa(binary);
}

function refuseUnsupported(part: Exclude<ContentPart, { type: "text" }>, capabilities: Pick<ModelCapabilities, "images" | "audio">): void {
  const declared = part.mediaType;
  const refuse = (message: string): never => {
    throw new UnsupportedContentError(message, { mediaType: declared });
  };
  if (part.type === "image" && !capabilities.images) refuse("This model does not declare image input");
  if (part.type === "audio" && !capabilities.audio) refuse("This model does not declare audio input");
  if (!MEDIA_TYPES.includes(declared) || !declared.startsWith(part.type + "/")) {
    refuse("A " + part.type + " part cannot carry the media type " + String(declared));
  }
  if (part.type === "audio" && (part.format === "wav") !== (declared === "audio/wav")) {
    refuse("The audio format " + String(part.format) + " does not match " + declared);
  }
  const shown = sniffMediaType(part.bytes);
  if (shown !== declared) {
    refuse("A part declared " + declared + " but its bytes show " + (shown ?? "no allowed type"));
  }
}

/**
 * Refuses what a model cannot take, before it costs a call: an undeclared modality, a media type
 * off the list, bytes that do not match their declared type, and a part or a run over its limit.
 * `spent` is the encoded size already admitted to this run; the result is the new running total.
 */
export function checkContentParts(
  parts: readonly ContentPart[],
  capabilities: Pick<ModelCapabilities, "images" | "audio">,
  limits: MediaLimits = DEFAULT_MEDIA_LIMITS,
  spent = 0,
): number {
  let total = spent;
  for (const part of parts) {
    if (part.type === "text") continue;
    refuseUnsupported(part, capabilities);
    const size = encodedLength(part.bytes.byteLength);
    if (size > limits.maxPartBytes) {
      throw new ContentTooLargeError(
        "A part encodes to " + String(size) + " bytes, over the limit of " + String(limits.maxPartBytes),
        { byteLength: size, limit: limits.maxPartBytes },
      );
    }
    total += size;
    if (total > limits.maxRunBytes) {
      throw new ContentTooLargeError(
        "The run's media encodes to " + String(total) + " bytes, over the limit of " + String(limits.maxRunBytes),
        { byteLength: total, limit: limits.maxRunBytes },
      );
    }
  }
  return total;
}

const NO_SIZE_LIMIT: MediaLimits = { maxPartBytes: Infinity, maxRunBytes: Infinity };

/**
 * What an adapter runs before it builds a request, so a model called directly gets the same
 * refusals as one called by the agent. Media belongs on a user turn: `messageText` would drop it
 * from any other role without a word. The size limits stay with the caller that owns the run.
 */
export function checkMessageMedia(
  messages: readonly ChatMessage[],
  capabilities: Pick<ModelCapabilities, "images" | "audio">,
): void {
  for (const message of messages) {
    if (typeof message.content === "string") continue;
    for (const part of message.content) {
      if (part.type !== "text" && message.role !== "user") {
        throw new UnsupportedContentError("A " + message.role + " message cannot carry media", {
          mediaType: part.mediaType,
        });
      }
    }
    checkContentParts(message.content, capabilities, NO_SIZE_LIMIT);
  }
}
