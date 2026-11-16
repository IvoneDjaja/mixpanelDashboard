import { NextResponse } from "next/server";
import { fetchEvents, filterByProperties, getMixpanelConfig, MixpanelError } from "@/lib/mixpanel/client";
import { loadEventsFromFile, resolveDataSource } from "@/lib/mixpanel/fixture";
import type { MixpanelEvent } from "@/lib/mixpanel/types";
import { toDateString, WINDOWS, type DashboardQuery } from "@/lib/validation";

const HTTP_STATUS: Record<MixpanelError["kind"], number> = {
  config: 500,
  auth: 502,
  rate_limit: 429,
  no_access: 502,
  timeout: 504,
  upstream: 502,
};

/** Short, safe messages; never include upstream or credential details. */
const PUBLIC_MESSAGE: Record<MixpanelError["kind"], string> = {
  config: "Server is not configured for Mixpanel",
  auth: "Mixpanel rejected the server credentials",
  rate_limit: "Mixpanel rate limit reached, try again shortly",
  no_access: "This Mixpanel project does not allow API access (check the plan or use the UAT project)",
  timeout: "Mixpanel took too long to respond",
  upstream: "Could not load data from Mixpanel",
};

/**
 * Upper bound for the handlers. fetchEvents issues one export request per day with
 * its own 60s budget, three at a time, so a wide window can legitimately run for
 * minutes even though no single upstream call does.
 */
export const MAX_DURATION_SECONDS = 300;

/**
 * Loads the events for a validated query, scoped to its Environment and LBU.
 * MIXPANEL_DATA_SOURCE picks local files (UAT/dev) or the Mixpanel API.
 * @param query - Validated dashboard query.
 * @param nowEpochSeconds - Current time in epoch seconds.
 * @returns The scoped events and the start of the window.
 * @throws MixpanelError on configuration, auth, rate limit, timeout or upstream failures.
 */
export async function loadScopedEvents(
  query: DashboardQuery,
  nowEpochSeconds: number,
): Promise<{ events: MixpanelEvent[]; since: number }> {
  const filters = { Environment: query.environment, LBU: query.lbu };
  const since = nowEpochSeconds - WINDOWS[query.window];
  const loaded = resolveDataSource() === "file"
    ? await loadEventsFromFile(process.env.MIXPANEL_EVENTS_FILE!)
    : await fetchEvents(
        { from: toDateString(since), to: toDateString(nowEpochSeconds) },
        { ...getMixpanelConfig(), filters },
      );
  // The API path is already filtered server-side; this covers the file path and
  // keeps both sources scoped identically (PRD section 4).
  return { events: filterByProperties(loaded, filters), since };
}

/**
 * Maps a failure to a JSON error response, logging the real cause server-side.
 * The public body is deliberately generic and never includes upstream details.
 * @param error - The thrown value.
 * @param route - Route label for the log line, e.g. "/api/dashboard".
 * @param window - The requested window, for the log line.
 * @returns A JSON error response with an appropriate status.
 */
export function errorResponse(error: unknown, route: string, window: string): NextResponse {
  if (error instanceof MixpanelError) {
    // Log the real cause server-side: without it 502s and 504s have no diagnosable trace.
    console.error(
      `${route} Mixpanel error [${error.kind}] window=${window}: ${error.message}` +
        (error.detail ? ` | upstream: ${error.detail}` : ""),
    );
    return NextResponse.json({ error: PUBLIC_MESSAGE[error.kind] }, { status: HTTP_STATUS[error.kind] });
  }
  console.error(`Unexpected ${route} error:`, error);
  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}
