import "server-only";
import type { MixpanelConfig } from "@/lib/mixpanel/types";

/** Name of the httpOnly cookie carrying the session id. */
export const SESSION_COOKIE = "mp_session";

/** Idle time after which a session expires; refreshed on every use. */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

interface Session {
  config: MixpanelConfig;
  expiresAt: number;
}

// Held on globalThis so route handlers, server components and Next dev hot
// reloads all see the same store.
const globalStore = globalThis as unknown as { __mpSessions?: Map<string, Session> };
const sessions = (globalStore.__mpSessions ??= new Map<string, Session>());

/** Removes every expired session so abandoned logins do not accumulate. */
function purgeExpired(now: number): void {
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}

/**
 * Stores credentials server-side under a new random session id.
 * @param config - Verified Mixpanel settings for this session.
 * @param now - Current time in epoch milliseconds (injectable for tests).
 * @returns The new session id, to be set as the session cookie.
 */
export function createSession(config: MixpanelConfig, now: number = Date.now()): string {
  purgeExpired(now);
  const id = crypto.randomUUID();
  sessions.set(id, { config, expiresAt: now + SESSION_TTL_MS });
  return id;
}

/**
 * Looks up a session's Mixpanel settings and extends its idle expiry.
 * @param id - Session id from the cookie, if any.
 * @param now - Current time in epoch milliseconds (injectable for tests).
 * @returns The settings, or null when the id is missing, unknown or expired.
 */
export function getSessionConfig(
  id: string | undefined,
  now: number = Date.now(),
): MixpanelConfig | null {
  if (!id) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (session.expiresAt <= now) {
    sessions.delete(id);
    return null;
  }
  session.expiresAt = now + SESSION_TTL_MS;
  return session.config;
}

/**
 * Ends a session, discarding its credentials.
 * @param id - Session id from the cookie, if any.
 */
export function destroySession(id: string | undefined): void {
  if (id) sessions.delete(id);
}
