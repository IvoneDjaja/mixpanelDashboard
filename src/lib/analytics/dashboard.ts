import type { MixpanelEvent } from "@/lib/mixpanel/types";
import { buildSessions, toPageViews } from "./sessions";
import { pageVisitStats, type PageVisitStat } from "./pageVisits";
import { timeOnPageStats, type TimeOnPageStat } from "./timeOnPage";
import { loginModeStats, topJourneyPaths, type JourneyPath, type LoginModeStat } from "./journeys";

/** Everything the dashboard page displays. */
export interface DashboardData {
  window: string;
  totalViews: number;
  totalSessions: number;
  capabilities: string[];
  mostVisited: PageVisitStat[];
  leastVisited: PageVisitStat[];
  timeOnPage: TimeOnPageStat[];
  paths: JourneyPath[];
  loginModes: LoginModeStat[];
  /** Page latency is not captured by the current events. */
  latencyAvailable: false;
}

/**
 * Builds all dashboard aggregates from raw events.
 * @param events - Raw Mixpanel events covering the window.
 * @param windowKey - Label of the window (for display).
 * @param sinceEpochSeconds - Start of the window.
 * @param capability - Optional capability filter for journey paths.
 * @returns Dashboard data.
 */
export function buildDashboard(
  events: MixpanelEvent[],
  windowKey: string,
  sinceEpochSeconds: number,
  capability?: string,
): DashboardData {
  const views = toPageViews(events).filter((v) => v.time >= sinceEpochSeconds);
  const sessions = buildSessions(views);
  const visits = pageVisitStats(views, sinceEpochSeconds);
  return {
    window: windowKey,
    totalViews: views.length,
    totalSessions: sessions.length,
    capabilities: [...new Set(views.map((v) => v.capability))].sort(),
    mostVisited: visits.slice(0, 10),
    leastVisited: [...visits].reverse().slice(0, 10),
    timeOnPage: timeOnPageStats(sessions),
    paths: topJourneyPaths(sessions, capability),
    loginModes: loginModeStats(sessions),
    latencyAvailable: false,
  };
}
