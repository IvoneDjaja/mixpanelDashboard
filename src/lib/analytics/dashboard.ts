import type { MixpanelEvent } from "@/lib/mixpanel/types";
import { buildSessions, toPageViews } from "./sessions";
import { pageVisitStats, type PageVisitStat } from "./pageVisits";
import { timeOnPageStats, viewDurations, viewKey, type TimeOnPageStat } from "./timeOnPage";
import { DEFAULT_PAGE_SIZE, paginate, type Page } from "@/lib/pagination";
import { loginModeStats, topJourneyPaths, type JourneyPath, type LoginModeStat } from "./journeys";

/** One raw event, reduced to the fields the events table shows. */
export interface EventRow {
  time: number;
  event: string;
  page?: string;
  capability?: string;
  signInType?: string;
  userId?: string;
  /** Seconds until the user's next page view in the same session; absent for a session's last view. */
  durationSeconds?: number;
  /** Every property Mixpanel returned for the event, shown when the row is expanded. */
  properties: Record<string, unknown>;
}

/**
 * Builds one page of raw events in the window, newest first.
 * @param events - Raw Mixpanel events.
 * @param sinceEpochSeconds - Start of the window.
 * @param capability - Optional capability filter.
 * @param page - Requested 1-based page.
 * @param pageSize - Rows per page.
 * @param userId - Optional user (`distinct_id`) to restrict the events to.
 * @returns A page of reduced event rows plus paging metadata.
 */
export function buildEventsPage(
  events: MixpanelEvent[],
  sinceEpochSeconds: number,
  capability: string | undefined,
  page: number,
  pageSize: number,
  userId?: string,
): Page<EventRow> {
  // Durations come from all events so filtering by user or capability never cuts a gap short.
  const durations = viewDurations(buildSessions(toPageViews(events)));
  const rows = events
    .filter((e) => typeof e.properties.time === "number" && e.properties.time >= sinceEpochSeconds)
    .filter((e) => !capability || e.properties.capability === capability)
    .filter((e) => userId === undefined || e.properties.distinct_id === userId)
    .sort((a, b) => b.properties.time - a.properties.time)
    .map((e) => ({
      time: e.properties.time,
      event: e.event,
      page: e.properties.page_name,
      capability: e.properties.capability,
      signInType: e.properties.sign_in_type || undefined,
      userId: e.properties.distinct_id,
      durationSeconds:
        e.event === "page_viewed" && e.properties.distinct_id && e.properties.page_name
          ? durations.get(viewKey(e.properties.distinct_id, e.properties.time, e.properties.page_name))
          : undefined,
      properties: e.properties,
    }));
  return paginate(rows, page, pageSize);
}

/** What the page shows after a user is selected. */
export interface UserEventsData {
  /** Server-paginated events of the user, newest first. */
  events: Page<EventRow>;
  /** The user's pages by views, most first. */
  mostVisited: PageVisitStat[];
  /** The same pages, least visited first. */
  leastVisited: PageVisitStat[];
}

/**
 * Builds one user's events plus their most and least visited pages.
 * @param events - Raw Mixpanel events.
 * @param sinceEpochSeconds - Start of the window.
 * @param capability - Optional capability filter for the events list.
 * @param page - Requested 1-based page of events.
 * @param pageSize - Events per page.
 * @param userId - The user (`distinct_id`) to report on.
 * @returns The user's events page and page-visit rankings.
 */
export function buildUserEvents(
  events: MixpanelEvent[],
  sinceEpochSeconds: number,
  capability: string | undefined,
  page: number,
  pageSize: number,
  userId: string,
): UserEventsData {
  const views = toPageViews(events).filter((v) => v.userId === userId);
  const visits = pageVisitStats(views, sinceEpochSeconds);
  return {
    events: buildEventsPage(events, sinceEpochSeconds, capability, page, pageSize, userId),
    mostVisited: visits,
    leastVisited: [...visits].reverse(),
  };
}

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
  /** Server-paginated raw events table. */
  events: Page<EventRow>;
  /** Page latency is not captured by the current events. */
  latencyAvailable: false;
}

/**
 * Builds all dashboard aggregates from raw events.
 * @param events - Raw Mixpanel events covering the window.
 * @param windowKey - Label of the window (for display).
 * @param sinceEpochSeconds - Start of the window.
 * @param capability - Optional capability filter for journey paths.
 * @param page - 1-based page of the events table.
 * @param pageSize - Rows per page of the events table.
 * @returns Dashboard data.
 */
export function buildDashboard(
  events: MixpanelEvent[],
  windowKey: string,
  sinceEpochSeconds: number,
  capability?: string,
  page = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
): DashboardData {
  const views = toPageViews(events).filter((v) => v.time >= sinceEpochSeconds);
  const sessions = buildSessions(views);
  const visits = pageVisitStats(views, sinceEpochSeconds);
  return {
    window: windowKey,
    totalViews: views.length,
    totalSessions: sessions.length,
    capabilities: [...new Set(views.map((v) => v.capability))].sort(),
    mostVisited: visits,
    leastVisited: [...visits].reverse(),
    timeOnPage: timeOnPageStats(sessions),
    paths: topJourneyPaths(sessions, capability),
    loginModes: loginModeStats(sessions),
    events: buildEventsPage(events, sinceEpochSeconds, capability, page, pageSize),
    latencyAvailable: false,
  };
}
