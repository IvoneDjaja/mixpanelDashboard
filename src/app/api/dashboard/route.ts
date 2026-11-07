import { NextResponse } from "next/server";
import { fetchEvents, MixpanelError } from "@/lib/mixpanel/client";
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
 * GET /api/dashboard?window=24h|30d&capability=...
 * @param request - Incoming request.
 * @returns Dashboard JSON, or a JSON error with an appropriate status.
 */
export async function GET(request: Request) {
  const parsed = validateDashboardQuery(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { window, capability } = parsed.value;
  const now = Math.floor(Date.now() / 1000);
  const since = now - WINDOWS[window];

  try {
    const events = await fetchEvents({ from: toDateString(since), to: toDateString(now) });
    return NextResponse.json(buildDashboard(events, window, since, capability));
  } catch (error) {
    if (error instanceof MixpanelError) {
      return NextResponse.json({ error: PUBLIC_MESSAGE[error.kind] }, { status: HTTP_STATUS[error.kind] });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
