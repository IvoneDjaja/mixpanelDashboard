import { NextResponse } from "next/server";
import { buildUserEvents } from "@/lib/analytics/dashboard";
import { errorResponse, loadScopedEvents, MAX_DURATION_SECONDS, unauthorizedResponse } from "@/lib/dashboardRequest";
import { getCurrentConfig } from "@/lib/session/requireSession";
import { validateDashboardQuery, validateUserId } from "@/lib/validation";

/** Upper bound for the handler (see MAX_DURATION_SECONDS). */
export const maxDuration = MAX_DURATION_SECONDS;

/**
 * GET /api/users/events?userId=...&window=1h|24h|day[&date=YYYY-MM-DD, required for day]&refresh=1&capability=...&eventType=...&page=1&pageSize=10|25|50
 * Environment and LBU come from the x-environment and x-lbu headers (defaults UAT, PACS).
 * @param request - Incoming request.
 * @returns The given user's events page and most/least visited pages as JSON, or a JSON error with an appropriate status.
 */
export async function GET(request: Request) {
  const config = await getCurrentConfig();
  if (!config) return unauthorizedResponse();
  const searchParams = new URL(request.url).searchParams;
  const parsed = validateDashboardQuery(searchParams, request.headers);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const user = validateUserId(searchParams);
  if (!user.ok) {
    return NextResponse.json({ error: user.error }, { status: 400 });
  }
  const { window, capability, eventType, page, pageSize } = parsed.value;

  try {
    const { events, since, fetchedAt } = await loadScopedEvents(parsed.value, Math.floor(Date.now() / 1000), config);
    return NextResponse.json({ ...buildUserEvents(events, since, capability, page, pageSize, user.value, eventType), fetchedAt });
  } catch (error) {
    return errorResponse(error, "/api/users/events", window);
  }
}
