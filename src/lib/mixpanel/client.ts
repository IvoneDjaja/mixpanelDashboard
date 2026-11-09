import "server-only";
import type { MixpanelConfig, MixpanelEvent, MixpanelRegion } from "./types";

const EXPORT_HOSTS: Record<MixpanelRegion, string> = {
  us: "https://data.mixpanel.com",
  eu: "https://data-eu.mixpanel.com",
  in: "https://data-in.mixpanel.com",
};

const REQUEST_TIMEOUT_MS = 30_000;

/** Failure categories so callers can map errors to HTTP responses. */
export type MixpanelErrorKind =
  | "config"
  | "auth"
  | "rate_limit"
  | "no_access"
  | "timeout"
  | "upstream";

/** Error raised by the Mixpanel client. Messages never contain credentials. */
export class MixpanelError extends Error {
  constructor(
    public readonly kind: MixpanelErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "MixpanelError";
  }
}

/**
 * Reads Mixpanel settings from environment variables.
 * Uses a service account (MIXPANEL_SERVICE_ACCOUNT_USER/SECRET + MIXPANEL_PROJECT_ID)
 * when configured, otherwise falls back to the legacy project API Secret (MIXPANEL_API_SECRET).
 * @param env - Environment to read from (defaults to process.env).
 * @returns Validated configuration.
 * @throws MixpanelError of kind "config" when a variable is missing or invalid.
 */
export function getMixpanelConfig(
  env: Record<string, string | undefined> = process.env,
): MixpanelConfig {
  const user = env.MIXPANEL_SERVICE_ACCOUNT_USER;
  const secret = env.MIXPANEL_SERVICE_ACCOUNT_SECRET;
  const apiSecret = env.MIXPANEL_API_SECRET;
  const projectId = env.MIXPANEL_PROJECT_ID;
  const region = (env.MIXPANEL_REGION ?? "us") as MixpanelRegion;

  if (!(region in EXPORT_HOSTS)) {
    throw new MixpanelError("config", "MIXPANEL_REGION must be us, eu or in");
  }

  if (!user && !secret && apiSecret) {
    return { secret: apiSecret, projectId: projectId || undefined, region };
  }

  const missing = [
    !user && "MIXPANEL_SERVICE_ACCOUNT_USER",
    !secret && "MIXPANEL_SERVICE_ACCOUNT_SECRET",
    !projectId && "MIXPANEL_PROJECT_ID",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new MixpanelError("config", `Missing env: ${missing.join(", ")} (or set MIXPANEL_API_SECRET)`);
  }
  return { user: user!, secret: secret!, projectId: projectId!, region };
}

/**
 * Parses newline-delimited JSON from the export endpoint, skipping blank lines.
 * @param body - Raw response text.
 * @returns Parsed events.
 */
export function parseExportLines(body: string): MixpanelEvent[] {
  return body
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as MixpanelEvent);
}

/**
 * Fetches raw events for a date range from the Mixpanel Export API.
 * @param range - Inclusive dates in YYYY-MM-DD format.
 * @param config - Mixpanel settings (defaults to environment).
 * @param fetchImpl - Fetch implementation, injectable for tests.
 * @returns Events in the range.
 * @throws MixpanelError on configuration, auth, rate limit, timeout or upstream failures.
 */
export async function fetchEvents(
  range: { from: string; to: string },
  config: MixpanelConfig = getMixpanelConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<MixpanelEvent[]> {
  const url = new URL("/api/2.0/export", EXPORT_HOSTS[config.region]);
  if (config.projectId) url.searchParams.set("project_id", config.projectId);
  url.searchParams.set("from_date", range.from);
  url.searchParams.set("to_date", range.to);

  // Service account: user:secret. Legacy API Secret: secret as username, empty password.
  const credentials = config.user ? `${config.user}:${config.secret}` : `${config.secret}:`;
  const authorization = `Basic ${Buffer.from(credentials).toString("base64")}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: authorization, Accept: "text/plain" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new MixpanelError("timeout", "Mixpanel request timed out");
    }
    throw new MixpanelError("upstream", "Could not reach Mixpanel");
  }

  if (response.status === 401 || response.status === 403) {
    throw new MixpanelError("auth", "Mixpanel rejected the credentials");
  }
  if (response.status === 429) {
    throw new MixpanelError("rate_limit", "Mixpanel rate limit reached");
  }
  if (!response.ok) {
    throw new MixpanelError("upstream", `Mixpanel returned ${response.status}`);
  }

  const body = await response.text();
  // Mixpanel answers 200 with this plain-text body when the plan or project
  // does not allow API/export access.
  if (body.trim().toLowerCase().startsWith("terminated early")) {
    throw new MixpanelError("no_access", "Mixpanel project does not allow export API access");
  }

  try {
    return parseExportLines(body);
  } catch {
    throw new MixpanelError("upstream", "Mixpanel returned malformed data");
  }
}
