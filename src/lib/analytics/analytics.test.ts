import type { MixpanelEvent } from "@/lib/mixpanel/types";
import { buildSessions, toPageViews } from "./sessions";
import { pageVisitStats } from "./pageVisits";
import { timeOnPageStats } from "./timeOnPage";
import { loginModeStats, topJourneyPaths } from "./journeys";
import { buildEventsPage } from "./dashboard";

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

describe("journeys", () => {
  const sessions = buildSessions(toPageViews(events));
  it("collapses consecutive repeats and filters by capability", () => {
    const paths = topJourneyPaths(sessions, "Policy Viewing");
    expect(paths).toEqual([{ path: ["Home", "Policy"], sessions: 1, percent: 100 }]);
  });
  it("counts login modes, skipping sessions without one", () => {
    const modes = loginModeStats(sessions);
    expect(modes.map((m) => m.mode).sort()).toEqual(["PRUServices", "Singpass"]);
    expect(modes[0].percent).toBe(50);
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
});
