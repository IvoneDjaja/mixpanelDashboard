/** @jest-environment node */
import { errorResponse, loadScopedEvents } from "./dashboardRequest";
import { fetchEventsWithMeta, MixpanelError } from "./mixpanel/client";
import type { DashboardQuery } from "./validation";

jest.mock("./mixpanel/client", () => ({
  ...jest.requireActual("./mixpanel/client"),
  fetchEventsWithMeta: jest.fn(),
}));

const config = { user: "u", secret: "s", projectId: "1", region: "us" } as never;
const NOW = Date.parse("2026-11-18T12:00:00Z") / 1000;
const base: DashboardQuery = { window: "24h", refresh: false, environment: "UAT", lbu: "PACS", page: 1, pageSize: 10 };

describe("loadScopedEvents", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    (fetchEventsWithMeta as jest.Mock).mockReset().mockResolvedValue({ events: [], fetchedAt: 1234 });
    delete process.env.MIXPANEL_DATA_SOURCE;
  });
  afterEach(() => jest.restoreAllMocks());

  it("fetches exactly one day for the day window and starts at its midnight UTC", async () => {
    const { since } = await loadScopedEvents({ ...base, window: "day", date: "2026-11-10" }, NOW, config);
    expect(fetchEventsWithMeta).toHaveBeenCalledTimes(1);
    expect((fetchEventsWithMeta as jest.Mock).mock.calls[0][0]).toEqual({ from: "2026-11-10", to: "2026-11-10" });
    expect(since).toBe(Date.parse("2026-11-10T00:00:00Z") / 1000);
  });

  it("keeps the rolling 24h range ending today", async () => {
    const { since } = await loadScopedEvents(base, NOW, config);
    expect((fetchEventsWithMeta as jest.Mock).mock.calls[0][0]).toEqual({ from: "2026-11-17", to: "2026-11-18" });
    expect(since).toBe(NOW - 24 * 3600);
  });

  it("returns fetchedAt from the data source", async () => {
    const result = await loadScopedEvents(base, NOW, config);
    expect(result.fetchedAt).toBe(1234);
  });

  it("passes refresh through as force, and defaults to not forcing", async () => {
    await loadScopedEvents(base, NOW, config);
    expect((fetchEventsWithMeta as jest.Mock).mock.calls[0][2]).toEqual({ force: false });
    await loadScopedEvents({ ...base, refresh: true }, NOW, config);
    expect((fetchEventsWithMeta as jest.Mock).mock.calls[1][2]).toEqual({ force: true });
  });
});

describe("errorResponse", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ["config", 500],
    ["auth", 502],
    ["rate_limit", 429],
    ["no_access", 502],
    ["timeout", 504],
    ["upstream", 502],
  ] as const)("maps %s to %i", async (kind, status) => {
    const res = errorResponse(new MixpanelError(kind, "boom", "secret upstream detail"), "/api/x", "24h");
    expect(res.status).toBe(status);
    expect(JSON.stringify(await res.json())).not.toContain("secret upstream detail");
  });

  it("returns a generic 500 for unexpected errors", async () => {
    const res = errorResponse(new Error("oops"), "/api/x", "24h");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Unexpected error" });
  });
});
