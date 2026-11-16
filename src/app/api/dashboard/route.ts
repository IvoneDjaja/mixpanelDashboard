import { NextResponse } from "next/server";
import {
  fetchEvents,
  filterByProperties,
  getMixpanelConfig,
  MixpanelError,
} from "@/lib/mixpanel/client";
import { loadEventsFromFile, resolveDataSource } from "@/lib/mixpanel/fixture";
import { buildDashboard } from "@/lib/analytics/dashboard";
import { toDateString, validateDashboardQuery, WINDOWS } from "@/lib/validation";

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
 * Upper bound for the handler. fetchEvents issues one export request per day with
 * its own 60s budget, three at a time, so a wide window can legitimately run for
 * minutes even though no single upstream call does.
 */
export const maxDuration = 300;

/**
 * GET /api/dashboard?window=1h|24h|30d&capability=...&environment=DEV|SIT|UAT|PROD&lbu=PACS|PAMB|PBTB&page=1&pageSize=10|25|50
 * @param request - Incoming request.
 * @returns Dashboard JSON, or a JSON error with an appropriate status.
 */
export async function GET(request: Request) {
  const parsed = validateDashboardQuery(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { window, capability, environment, lbu, page, pageSize } = parsed.value;
  const filters = { Environment: environment, LBU: lbu };
  const now = Math.floor(Date.now() / 1000);
  const since = now - WINDOWS[window];

  try {
    // MIXPANEL_DATA_SOURCE picks local files (UAT/dev) or the Mixpanel API.
    const loaded = resolveDataSource() === "file"
      ? await loadEventsFromFile(process.env.MIXPANEL_EVENTS_FILE!)
      : await fetchEvents(
          { from: toDateString(since), to: toDateString(now) },
          { ...getMixpanelConfig(), filters },
        );
    // The API path is already filtered server-side; this covers the file path and
    // keeps both sources scoped identically (PRD section 4).
    const events = filterByProperties(loaded, filters);
    return NextResponse.json(buildDashboard(events, window, since, capability, page, pageSize));
  } catch (error) {
    if (error instanceof MixpanelError) {
      // Log the real cause server-side: the public body is deliberately generic,
      // which previously left 502s and 504s with no diagnosable trace anywhere.
      console.error(
        `/api/dashboard Mixpanel error [${error.kind}] window=${window}: ${error.message}` +
          (error.detail ? ` | upstream: ${error.detail}` : ""),
      );
      return NextResponse.json({ error: PUBLIC_MESSAGE[error.kind] }, { status: HTTP_STATUS[error.kind] });
    }
    // Log server-side only (the response stays generic) so the cause is diagnosable.
    console.error("Unexpected /api/dashboard error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
