import type { MCPMessage } from "./json-rpc.js";

/** One progress update a server sent for a request the client is waiting on. */
export interface MCPProgress {
  readonly progress: number;
  readonly total?: number;
}

/**
 * A server message that is not a response, in the shape the client understands it.
 * Anything this port does not read stays reachable as `other`, so a new notification
 * kind reaches a listener instead of being dropped.
 */
export type MCPNotification =
  | {
      readonly type: "progress";
      readonly progressToken: string | number;
      readonly progress: number;
      readonly total?: number;
    }
  | { readonly type: "cancelled"; readonly requestId: string | number; readonly reason?: string }
  | { readonly type: "toolsListChanged" }
  | { readonly type: "resourcesListChanged" }
  | { readonly type: "promptsListChanged" }
  | {
      readonly type: "other";
      readonly method: string;
      readonly params?: Record<string, unknown>;
    };

/** Receives every typed notification the client sees. */
export type MCPNotificationListener = (notification: MCPNotification) => void;

/** What a request may carry beyond its params. */
export interface MCPRequestOptions {
  /** Stops the wait; an abort also sends `notifications/cancelled` when the transport is live. */
  readonly signal?: AbortSignal;
  /** Receives the progress updates whose token this request owns. */
  readonly onProgress?: (progress: MCPProgress) => void;
  /** The token the server should quote in its progress notifications. */
  readonly progressToken?: string | number;
}

/** Maps one message to the typed notification it is, when it is one. */
export function toNotification(message: MCPMessage): MCPNotification | undefined {
  if (!("method" in message) || "id" in message) return undefined;
  const params = message.params ?? {};
  switch (message.method) {
    case "notifications/progress": {
      const progressToken = params["progressToken"];
      const progress = params["progress"];
      if (
        (typeof progressToken !== "string" && typeof progressToken !== "number") ||
        typeof progress !== "number"
      ) {
        return undefined;
      }
      const total = params["total"];
      return {
        type: "progress",
        progressToken,
        progress,
        ...(typeof total === "number" ? { total } : {}),
      };
    }
    case "notifications/cancelled": {
      const requestId = params["requestId"];
      if (typeof requestId !== "string" && typeof requestId !== "number") return undefined;
      const reason = params["reason"];
      return {
        type: "cancelled",
        requestId,
        ...(typeof reason === "string" ? { reason } : {}),
      };
    }
    case "notifications/tools/list_changed":
      return { type: "toolsListChanged" };
    case "notifications/resources/list_changed":
      return { type: "resourcesListChanged" };
    case "notifications/prompts/list_changed":
      return { type: "promptsListChanged" };
    default:
      return {
        type: "other",
        method: message.method,
        ...(message.params === undefined ? {} : { params: message.params }),
      };
  }
}
