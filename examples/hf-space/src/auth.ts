import { oauthHandleRedirectIfPresent, oauthLoginUrl } from "@huggingface/hub";

/** A signed-in visitor: their own token, so a run spends their Inference credits, not ours. */
export interface HfSession {
  readonly accessToken: string;
  /** Milliseconds since the epoch. A session past this is dropped, not refreshed. */
  readonly expiresAt: number;
  readonly username: string;
}

/** What a static Space injects when its README sets `hf_oauth: true`. */
interface SpaceGlobals {
  huggingface?: { variables?: Record<string, string | undefined> };
}

/**
 * True inside a static Space with OAuth enabled. Anywhere else (the dev server, GitHub Pages)
 * there is no client id, so the page offers the scripted run only and says why.
 */
export function spaceOAuthAvailable(scope: SpaceGlobals = globalThis as SpaceGlobals): boolean {
  const id = scope.huggingface?.variables?.["OAUTH_CLIENT_ID"];
  return typeof id === "string" && id !== "";
}

const STORAGE_KEY = "smolagents-ts.hf-session";

/**
 * Session storage, so the token dies with the tab. Every access is guarded: storage can be
 * missing or throw (a private window, blocked site data), and the page must still work.
 */
function storage(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

export function readSession(now: number = Date.now()): HfSession | null {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as Partial<HfSession>;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.username !== "string" ||
      parsed.expiresAt <= now
    ) {
      storage()?.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed as HfSession;
  } catch {
    return null;
  }
}

export function saveSession(session: HfSession): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Not kept across a reload, which only means signing in again.
  }
}

export function clearSession(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was kept.
  }
}

/**
 * Finish a sign-in when the page is the OAuth redirect target, otherwise return the stored
 * session. The scopes come from the Space's README (`hf_oauth_scopes`), not from here.
 */
export async function restoreSession(): Promise<HfSession | null> {
  if (spaceOAuthAvailable()) {
    const result = await oauthHandleRedirectIfPresent();
    if (result) {
      const session: HfSession = {
        accessToken: result.accessToken,
        expiresAt: result.accessTokenExpiresAt.getTime(),
        username: result.userInfo.preferred_username,
      };
      saveSession(session);
      // Drop ?code=&state= so a reload does not try to redeem a used code.
      window.history.replaceState(null, "", window.location.pathname);
      return session;
    }
  }
  return readSession();
}

/** Send the visitor to the Hub's consent page; it redirects back to this page. */
export async function signIn(): Promise<void> {
  window.location.href = await oauthLoginUrl();
}
