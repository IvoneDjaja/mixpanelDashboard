import type { MixpanelEvent } from "@/lib/mixpanel/types";
import { buildUsersData } from "./users";

/** Creates a synthetic event for a user. */
const ev = (user: string | undefined, time: number, page: string, capability = "Dashboard", signIn?: string): MixpanelEvent => ({
  event: "page_viewed",
  properties: { time, ...(user ? { distinct_id: user } : {}), page_name: page, capability, ...(signIn ? { sign_in_type: signIn } : {}) },
});

const events = [
  ev("a", 100, "Home", "Dashboard", "Singpass"),
  ev("a", 300, "Policy", "Policy Viewing", "PRUServices"),
  ev("b", 200, "Home"),
  ev("c", 50, "Home"), // before the window
  ev(undefined, 400, "Home"), // no user
  { event: "page_viewed", properties: { distinct_id: "d", page_name: "X" } as MixpanelEvent["properties"] }, // no time
];

describe("buildUsersData", () => {
  it("lists one row per user, most recently seen first", () => {
    const { users } = buildUsersData(events, "24h", 100);
    expect(users.rows.map((r) => r.userId)).toEqual(["a", "b"]);
    expect(users.total).toBe(2);
  });

  it("uses each user's latest event for the last-* fields and counts events", () => {
    const [a] = buildUsersData(events, "24h", 100).users.rows;
    expect(a).toEqual({
      userId: "a",
      lastSeen: 300,
      events: 2,
      lastPage: "Policy",
      capability: "Policy Viewing",
      signInType: "PRUServices",
    });
  });

  it("is independent of input order", () => {
    const [a] = buildUsersData([...events].reverse(), "24h", 100).users.rows;
    expect(a).toMatchObject({ lastSeen: 300, events: 2, lastPage: "Policy" });
  });

  it("excludes events before the window, with no user, or with no time", () => {
    const ids = buildUsersData(events, "24h", 100).users.rows.map((r) => r.userId);
    expect(ids).not.toContain("c");
    expect(ids).not.toContain("d");
    expect(ids).toHaveLength(2);
  });

  it("filters by capability but still lists every capability for the dropdown", () => {
    const data = buildUsersData(events, "24h", 100, "Policy Viewing");
    expect(data.users.rows.map((r) => r.userId)).toEqual(["a"]);
    expect(data.users.rows[0].events).toBe(1);
    expect(data.capabilities).toEqual(["Dashboard", "Policy Viewing"]);
  });

  it("pages the users", () => {
    const many = Array.from({ length: 25 }, (_, i) => ev(`u${i}`, 1000 + i, "Home"));
    const data = buildUsersData(many, "24h", 0, undefined, 2, 10);
    expect(data.users).toMatchObject({ page: 2, pageSize: 10, total: 25, totalPages: 3 });
    expect(data.users.rows[0].userId).toBe("u14");
  });

  it("returns one empty page when nothing matches", () => {
    expect(buildUsersData([], "24h", 0).users).toMatchObject({ rows: [], total: 0, totalPages: 1 });
  });
});
