import { NextResponse } from "next/server";
import { buildDashboard } from "@/lib/analytics/dashboard";
import { errorResponse, loadScopedEvents, MAX_DURATION_SECONDS, unauthorizedResponse } from "@/lib/dashboardRequest";
import { getCurrentConfig } from "@/lib/session/requireSession";
import { validateDashboardQuery } from "@/lib/validation";

/** Upper bound for the handler (see MAX_DURATION_SECONDS). */
export const maxDuration = MAX_DURATION_SECONDS;

/**
 * GET /api/dashboard?window=1h|24h|day[&date=YYYY-MM-DD, required for day]&capability=...&page=1&pageSize=10|25|50
 * Environment and LBU come from the x-environment and x-lbu headers (defaults UAT, PACS).
 * @param request - Incoming request.
 * @returns Dashboard JSON, or a JSON error with an appropriate status.
 */
export async function GET(request: Request) {
  const config = await getCurrentConfig();
  if (!config) return unauthorizedResponse();
  const parsed = validateDashboardQuery(new URL(request.url).searchParams, request.headers);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { window, capability, page, pageSize } = parsed.value;

  try {
    const { events, since } = await loadScopedEvents(parsed.value, Math.floor(Date.now() / 1000), config);
    return NextResponse.json(buildDashboard(events, window, since, capability, page, pageSize));
  } catch (error) {
    return errorResponse(error, "/api/dashboard", window);
  }
}
