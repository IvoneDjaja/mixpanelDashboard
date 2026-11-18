import type { MixpanelEvent } from "@/lib/mixpanel/types";
import { buildSessions, toPageViews } from "./sessions";
import { pageVisitStats } from "./pageVisits";
import { timeOnPageStats } from "./timeOnPage";
import { buildEventsPage, buildUserEvents } from "./dashboard";

/** Creates a synthetic page_viewed event. */
const ev = (user: string, time: number, page: string, capability = "Dashboard", signIn?: string): MixpanelEvent => ({
  event: "page_viewed",
  properties: { time, distinct_id: user, page_name: page, capability, ...(signIn ? { sign_in_type: signIn } : {}) },
});

const events = [
  ev("a", 100, "Home", "Dashboard", "PRUServices"),
  ev("a", 160, "Policy", "Policy Viewing"),
  ev("a", 100 + 3600, "Home"), // new session (gap > 30 min)
  ev("b", 200, "Home", "Dashboard", "Singpass"),
  ev("b", 230, "Home"),
  { event: "other", properties: { time: 1, distinct_id: "z", page_name: "X" } },
  { event: "page_viewed", properties: { time: 5 } }, // no user/page
];

describe("toPageViews / buildSessions", () => {
  it("drops non page_viewed and incomplete rows, sorted by time", () => {
    const views = toPageViews(events);
    expect(views).toHaveLength(5);
    expect(views.map((v) => v.time)).toEqual([...views.map((v) => v.time)].sort((x, y) => x - y));
  });
  it("splits sessions on the inactivity gap", () => {
    expect(buildSessions(toPageViews(events))).toHaveLength(3);
  });
  it("handles empty input", () => {
    expect(buildSessions([])).toEqual([]);
  });
});

describe("pageVisitStats", () => {
  const views = toPageViews(events);
  it("ranks by views with unique visitors and ties alphabetical", () => {
    const stats = pageVisitStats(views, 0);
    expect(stats[0]).toEqual({ page: "Home", views: 4, uniqueVisitors: 2 });
    expect(stats[1].page).toBe("Policy");
  });
  it("applies the time window and returns empty when nothing matches", () => {
    expect(pageVisitStats(views, 1_000_000)).toEqual([]);
    expect(pageVisitStats(views, 3000).map((s) => s.page)).toEqual(["Home"]);
  });
});

describe("timeOnPageStats", () => {
  it("uses the next view gap and excludes last pages", () => {
    const stats = timeOnPageStats(buildSessions(toPageViews(events)));
    const home = stats.find((s) => s.page === "Home")!;
    expect(home.samples).toBe(2); // a:Home->Policy (60s), b:Home->Home (30s)
    expect(home.averageSeconds).toBe(45);
    expect(home.medianSeconds).toBe(45);
    expect(stats.find((s) => s.page === "Policy")).toBeUndefined();
  });
  it("returns nothing for single-view sessions", () => {
    expect(timeOnPageStats(buildSessions(toPageViews([ev("a", 1, "Home")])))).toEqual([]);
  });
});

describe("buildEventsPage", () => {
  it("sorts newest first and applies the window", () => {
    const page = buildEventsPage(events, 150, undefined, 1, 10);
    expect(page.rows.map((r) => r.time)).toEqual([3700, 230, 200, 160]);
    expect(page.total).toBe(4);
  });
  it("filters by capability", () => {
    const page = buildEventsPage(events, 0, "Policy Viewing", 1, 10);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({ page: "Policy", userId: "a" });
  });
  it("pages and clamps", () => {
    const first = buildEventsPage(events, 0, undefined, 1, 10);
    expect(first.totalPages).toBe(1);
    const clamped = buildEventsPage(events, 0, undefined, 9, 10);
    expect(clamped.page).toBe(1);
  });
  it("filters by user, newest first", () => {
    const page = buildEventsPage(events, 0, undefined, 1, 10, "a");
    expect(page.rows.map((r) => r.time)).toEqual([3700, 160, 100]);
    expect(page.rows.every((r) => r.userId === "a")).toBe(true);
  });
  it("returns an empty page for an unknown user", () => {
    const page = buildEventsPage(events, 0, undefined, 1, 10, "nobody");
    expect(page.total).toBe(0);
    expect(page.rows).toEqual([]);
  });
  it("adds the time until the user's next view in the same session", () => {
    const rows = buildEventsPage(events, 0, undefined, 1, 10, "a").rows;
    const byTime = Object.fromEntries(rows.map((r) => [r.time, r.durationSeconds]));
    expect(byTime[100]).toBe(60); // Home -> Policy
    expect(byTime[160]).toBeUndefined(); // last view of its session (next view is > 30 min later)
    expect(byTime[3700]).toBeUndefined(); // only view of its session
  });
  it("keeps durations when filtering by capability", () => {
    const rows = buildEventsPage(events, 0, "Dashboard", 1, 10).rows;
    expect(rows.find((r) => r.time === 100)?.durationSeconds).toBe(60);
  });
  it("gives no duration to non page_viewed events", () => {
    const other: MixpanelEvent[] = [...events, { event: "other", properties: { time: 120, distinct_id: "a", page_name: "Home" } }];
    expect(buildEventsPage(other, 0, undefined, 1, 10, "a").rows.find((r) => r.event === "other")?.durationSeconds).toBeUndefined();
  });
});

describe("buildUserEvents", () => {
  it("ranks only the user's pages and returns their events", () => {
    const data = buildUserEvents(events, 0, undefined, 1, 10, "a");
    expect(data.events.total).toBe(3);
    expect(data.mostVisited).toEqual([
      { page: "Home", views: 2, uniqueVisitors: 1 },
      { page: "Policy", views: 1, uniqueVisitors: 1 },
    ]);
    expect(data.leastVisited.map((p) => p.page)).toEqual(["Policy", "Home"]);
  });
  it("is empty for an unknown user", () => {
    const data = buildUserEvents(events, 0, undefined, 1, 10, "nobody");
    expect(data.events.total).toBe(0);
    expect(data.mostVisited).toEqual([]);
  });
});
