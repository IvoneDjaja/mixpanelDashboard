import "server-only";
import { cookies } from "next/headers";
import type { MixpanelConfig } from "@/lib/mixpanel/types";
import { getSessionConfig, SESSION_COOKIE } from "./sessionStore";

/**
 * Reads the current request's session cookie and resolves its Mixpanel settings.
 * @returns The signed-in user's settings, or null when not signed in.
 */
export async function getCurrentConfig(): Promise<MixpanelConfig | null> {
  const store = await cookies();
  return getSessionConfig(store.get(SESSION_COOKIE)?.value);
}
