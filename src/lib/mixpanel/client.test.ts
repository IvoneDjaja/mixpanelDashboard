/** @jest-environment node */
import {
  daysInRange,
  eachDay,
  filterByProperties,
  propertyWhereClause,
  readPropertyFilters,
  fetchEvents,
  getMixpanelConfig,
  MixpanelError,
  parseExportLines,
} from "./client";
import { clearDayCache } from "./dayCache";

const config = { user: "u", secret: "s", projectId: "1", region: "eu" as const };
const range = { from: "2026-01-01", to: "2026-01-01" };

/**
 * Builds a fake fetch resolving to the given status and body. A fresh Response is
 * minted per call because a body can only be read once, and fetchEvents now issues
 * one request per day.
 */
const fakeFetch = (status: number, body = "") =>
  jest.fn().mockImplementation(() =>
    Promise.resolve(new Response(body, { status })),
  ) as unknown as typeof fetch;

// fetchEvents now caches each exported day. These cases share dates and configs,
// so without this every case after the first would read another case's events.
beforeEach(clearDayCache);

describe("getMixpanelConfig", () => {
  it("throws listing missing variables without leaking values", () => {
    expect(() => getMixpanelConfig({ MIXPANEL_PROJECT_ID: "1" })).toThrow(
      /MIXPANEL_SERVICE_ACCOUNT_USER, MIXPANEL_SERVICE_ACCOUNT_SECRET/,
    );
  });
  it("falls back to the project API Secret when no service account is set", () => {
    expect(getMixpanelConfig({ MIXPANEL_API_SECRET: "k", MIXPANEL_REGION: "eu" })).toEqual({
      secret: "k",
      projectId: undefined,
      region: "eu",
      filters: {},
    });
  });
  it("prefers the service account when both are configured", () => {
    const cfg = getMixpanelConfig({
      MIXPANEL_SERVICE_ACCOUNT_USER: "u",
      MIXPANEL_SERVICE_ACCOUNT_SECRET: "s",
      MIXPANEL_PROJECT_ID: "1",
      MIXPANEL_API_SECRET: "k",
    });
    expect(cfg.user).toBe("u");
  });
  it("rejects an unknown region", () => {
    expect(() =>
      getMixpanelConfig({
        MIXPANEL_SERVICE_ACCOUNT_USER: "u",
        MIXPANEL_SERVICE_ACCOUNT_SECRET: "s",
        MIXPANEL_PROJECT_ID: "1",
        MIXPANEL_REGION: "mars",
      }),
    ).toThrow(/REGION/);
  });
});

describe("parseExportLines", () => {
  it("parses JSONL and skips blank lines", () => {
    const out = parseExportLines('{"event":"a","properties":{"time":1}}\n\n{"event":"b","properties":{"time":2}}\n');
    expect(out.map((e) => e.event)).toEqual(["a", "b"]);
  });
});

describe("fetchEvents", () => {
  it("calls the EU host with basic auth and returns events", async () => {
    const f = fakeFetch(200, '{"event":"page_viewed","properties":{"time":1}}');
    const events = await fetchEvents(range, config, f);
    const [url, init] = (f as jest.Mock).mock.calls[0];
    expect(String(url)).toContain("https://data-eu.mixpanel.com/api/2.0/export");
    expect(String(url)).toContain("project_id=1");
    expect(new URL(String(url)).searchParams.get("event")).toBe('["page_viewed"]');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("u:s").toString("base64")}`);
    expect(events).toHaveLength(1);
  });
  it("authenticates with the API Secret as username and empty password", async () => {
    const f = fakeFetch(200, '{"event":"a","properties":{"time":1}}');
    await fetchEvents(range, { secret: "k", region: "eu" }, f);
    const [url, init] = (f as jest.Mock).mock.calls[0];
    expect(String(url)).not.toContain("project_id");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("k:").toString("base64")}`);
  });
  it.each([
    [401, "auth"],
    [403, "auth"],
    [429, "rate_limit"],
    [500, "upstream"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    await expect(fetchEvents(range, config, fakeFetch(status))).rejects.toMatchObject({ kind });
  });
  it("maps the 'terminated early' body to no_access", async () => {
    await expect(fetchEvents(range, config, fakeFetch(200, "terminated early"))).rejects.toMatchObject({ kind: "no_access" });
  });
  it("maps malformed bodies to upstream", async () => {
    await expect(fetchEvents(range, config, fakeFetch(200, "not json"))).rejects.toBeInstanceOf(MixpanelError);
  });
  it("maps a timeout during the request to timeout", async () => {
    const f = jest.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")) as unknown as typeof fetch;
    await expect(fetchEvents(range, config, f)).rejects.toMatchObject({ kind: "timeout" });
  });
  it("maps a timeout while reading the body to timeout", async () => {
    const response = {
      status: 200,
      ok: true,
      text: () => Promise.reject(new DOMException("timed out", "TimeoutError")),
    } as unknown as Response;
    const f = jest.fn().mockResolvedValue(response) as unknown as typeof fetch;
    await expect(fetchEvents(range, config, f)).rejects.toMatchObject({ kind: "timeout" });
  });
  it("maps network failures and never exposes the secret", async () => {
    const f = jest.fn().mockRejectedValue(new Error("boom s")) as unknown as typeof fetch;
    const err = await fetchEvents(range, config, f).catch((e) => e);
    expect(err.kind).toBe("upstream");
    expect(err.message).not.toContain("s:");
  });
});

describe("daysInRange", () => {
  it("counts an inclusive range", () => {
    expect(daysInRange({ from: "2026-01-01", to: "2026-01-01" })).toBe(1);
    expect(daysInRange({ from: "2026-01-01", to: "2026-01-02" })).toBe(2);
    expect(daysInRange({ from: "2026-01-01", to: "2026-01-31" })).toBe(31);
  });
  it("falls back to one day for unparseable dates", () => {
    expect(daysInRange({ from: "nonsense", to: "2026-01-02" })).toBe(1);
  });
});

describe("eachDay", () => {
  it("expands an inclusive range into days", () => {
    expect(eachDay({ from: "2026-01-01", to: "2026-01-03" })).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
  });
  it("returns a single day for a one-day range", () => {
    expect(eachDay({ from: "2026-01-01", to: "2026-01-01" })).toEqual(["2026-01-01"]);
  });
  it("crosses a month boundary", () => {
    expect(eachDay({ from: "2026-01-31", to: "2026-02-01" })).toEqual(["2026-01-31", "2026-02-01"]);
  });
});

describe("fetchEvents day chunking", () => {
  it("issues one request per day, each scoped to that single day", async () => {
    const f = fakeFetch(200, '{"event":"page_viewed","properties":{"time":1}}');
    const events = await fetchEvents({ from: "2026-01-01", to: "2026-01-03" }, config, f);
    const calls = (f as jest.Mock).mock.calls;
    expect(calls).toHaveLength(3);
    const ranges = calls.map(([url]) => {
      const p = new URL(String(url)).searchParams;
      return [p.get("from_date"), p.get("to_date")];
    });
    expect(ranges).toEqual([
      ["2026-01-01", "2026-01-01"],
      ["2026-01-02", "2026-01-02"],
      ["2026-01-03", "2026-01-03"],
    ]);
    expect(events).toHaveLength(3);
  });
  it("concatenates days in order regardless of completion order", async () => {
    const f = jest.fn().mockImplementation((url: URL) => {
      const day = new URL(String(url)).searchParams.get("from_date")!;
      const delay = day === "2026-01-01" ? 20 : 0;
      const row = JSON.stringify({ event: "page_viewed", properties: { time: 1, day } });
      return new Promise((resolve) =>
        setTimeout(() => resolve(new Response(row, { status: 200 })), delay),
      );
    }) as unknown as typeof fetch;
    const events = await fetchEvents({ from: "2026-01-01", to: "2026-01-03" }, config, f);
    expect(events.map((e) => e.properties.day)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });
  it("never runs more than three requests at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const f = jest.fn().mockImplementation(() => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      return new Promise((resolve) =>
        setTimeout(() => {
          inFlight -= 1;
          resolve(new Response("", { status: 200 }));
        }, 5),
      );
    }) as unknown as typeof fetch;
    await fetchEvents({ from: "2026-01-01", to: "2026-01-10" }, config, f);
    expect((f as jest.Mock).mock.calls).toHaveLength(10);
    expect(peak).toBeLessThanOrEqual(3);
  });
  it("surfaces a failing day and names it in the detail", async () => {
    const f = fakeFetch(403, "Not authorized");
    await expect(fetchEvents({ from: "2026-01-01", to: "2026-01-03" }, config, f)).rejects.toMatchObject({
      kind: "auth",
      detail: "Not authorized",
    });
  });
});

describe("fetchEvents plain-text and empty responses", () => {
  it("maps the documented plan-rejection body to no_access", async () => {
    const body = "Your plan does not support raw data export";
    const err = await fetchEvents(range, config, fakeFetch(200, body)).catch((e) => e);
    expect(err).toBeInstanceOf(MixpanelError);
    expect(err.kind).toBe("no_access");
    expect(err.detail).toContain("does not support");
  });
  it("still maps the 'terminated early' body to no_access", async () => {
    await expect(fetchEvents(range, config, fakeFetch(200, "terminated early"))).rejects.toMatchObject({
      kind: "no_access",
    });
  });
  it("reports an unrecognised plain-text body as upstream and keeps the snippet", async () => {
    const err = await fetchEvents(range, config, fakeFetch(200, "Something went wrong")).catch((e) => e);
    expect(err.kind).toBe("upstream");
    expect(err.detail).toBe("Something went wrong");
  });
  it("treats an empty body as no events rather than an error", async () => {
    await expect(fetchEvents(range, config, fakeFetch(200, "   "))).resolves.toEqual([]);
  });
  it("keeps event data out of the detail when a JSON line is malformed", async () => {
    const err = await fetchEvents(range, config, fakeFetch(200, '{"event":"page_viewed"')).catch((e) => e);
    expect(err.kind).toBe("upstream");
    expect(err.detail).toBeUndefined();
  });
  it("carries the upstream body on an auth failure for server-side logging", async () => {
    const err = await fetchEvents(range, config, fakeFetch(403, "Not authorized")).catch((e) => e);
    expect(err.kind).toBe("auth");
    expect(err.detail).toBe("Not authorized");
    expect(err.message).not.toContain("u:s");
  });
  it("reports the budget that was exceeded on a timeout", async () => {
    const f = jest.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")) as unknown as typeof fetch;
    const err = await fetchEvents(range, config, f).catch((e) => e);
    expect(err.kind).toBe("timeout");
    expect(err.detail).toMatch(/budget/);
  });
});

describe("transport error diagnostics", () => {
  it("records the cause chain when the connection dies mid-body", async () => {
    const cause = Object.assign(new Error("other side closed"), {
      name: "SocketError",
      code: "UND_ERR_SOCKET",
    });
    const response = {
      status: 200,
      ok: true,
      text: () => Promise.reject(Object.assign(new TypeError("terminated"), { cause })),
    } as unknown as Response;
    const f = jest.fn().mockResolvedValue(response) as unknown as typeof fetch;
    const err = await fetchEvents(range, config, f).catch((e) => e);
    expect(err.kind).toBe("upstream");
    expect(err.detail).toContain("TypeError: terminated");
    expect(err.detail).toContain("UND_ERR_SOCKET");
  });
  it("never puts credentials in the detail", async () => {
    const f = jest.fn().mockRejectedValue(new Error("boom")) as unknown as typeof fetch;
    const err = await fetchEvents(range, config, f).catch((e) => e);
    expect(err.detail).not.toContain("u:s");
    expect(err.detail).not.toContain(Buffer.from("u:s").toString("base64"));
  });
});

describe("property filters", () => {
  const account = {
    MIXPANEL_SERVICE_ACCOUNT_USER: "u",
    MIXPANEL_SERVICE_ACCOUNT_SECRET: "s",
    MIXPANEL_PROJECT_ID: "1",
  };

  it("reads Environment and Lbu from the environment, trimming values", () => {
    expect(readPropertyFilters({ MIXPANEL_ENVIRONMENT: " UAT ", MIXPANEL_LBU: " SG " })).toEqual({
      Environment: "UAT",
      Lbu: "SG",
    });
  });
  it("omits variables that are absent or blank", () => {
    expect(readPropertyFilters({ MIXPANEL_ENVIRONMENT: "UAT", MIXPANEL_LBU: "   " })).toEqual({
      Environment: "UAT",
    });
    expect(readPropertyFilters({})).toEqual({});
  });
  it("supports either filter on its own", () => {
    expect(getMixpanelConfig({ ...account, MIXPANEL_LBU: "SG" }).filters).toEqual({ Lbu: "SG" });
    expect(getMixpanelConfig({ ...account, MIXPANEL_ENVIRONMENT: "UAT" }).filters).toEqual({
      Environment: "UAT",
    });
  });

  it("builds a single-property expression", () => {
    expect(propertyWhereClause({ Environment: "UAT" })).toBe(
      '(properties["Environment"] == "UAT")',
    );
  });
  it("joins multiple properties with and", () => {
    expect(propertyWhereClause({ Environment: "UAT", Lbu: "SG" })).toBe(
      '(properties["Environment"] == "UAT") and (properties["Lbu"] == "SG")',
    );
  });
  it("returns undefined when there is nothing to filter", () => {
    expect(propertyWhereClause({})).toBeUndefined();
  });
  it("escapes quotes and backslashes so the expression cannot be broken", () => {
    expect(propertyWhereClause({ Lbu: 'S"G' })).toBe('(properties["Lbu"] == "S\\"G")');
    expect(propertyWhereClause({ Lbu: "S\\G" })).toBe('(properties["Lbu"] == "S\\\\G")');
  });

  it("sends the combined where clause to Mixpanel", async () => {
    const f = fakeFetch(200, "");
    await fetchEvents(range, { ...config, filters: { Environment: "UAT", Lbu: "SG" } }, f);
    const [url] = (f as jest.Mock).mock.calls[0];
    expect(new URL(String(url)).searchParams.get("where")).toBe(
      '(properties["Environment"] == "UAT") and (properties["Lbu"] == "SG")',
    );
  });
  it("omits the where clause when no filters are configured", async () => {
    const f = fakeFetch(200, "");
    await fetchEvents(range, config, f);
    const [url] = (f as jest.Mock).mock.calls[0];
    expect(new URL(String(url)).searchParams.has("where")).toBe(false);
  });
});

describe("filterByProperties", () => {
  const events = [
    { event: "page_viewed", properties: { time: 1, Environment: "UAT", Lbu: "SG" } },
    { event: "page_viewed", properties: { time: 2, Environment: "UAT", Lbu: "MY" } },
    { event: "page_viewed", properties: { time: 3, Environment: "PROD", Lbu: "SG" } },
    { event: "page_viewed", properties: { time: 4 } },
  ];
  const times = (out: { properties: { time: number } }[]) => out.map((e) => e.properties.time);

  it("requires every filter to match", () => {
    expect(times(filterByProperties(events, { Environment: "UAT", Lbu: "SG" }))).toEqual([1]);
  });
  it("filters on one property alone", () => {
    expect(times(filterByProperties(events, { Lbu: "SG" }))).toEqual([1, 3]);
  });
  it("drops events missing a filtered property rather than guessing", () => {
    expect(times(filterByProperties(events, { Lbu: "SG" }))).not.toContain(4);
  });
  it("returns everything when no filters are configured", () => {
    expect(filterByProperties(events, {})).toHaveLength(4);
  });
});

describe("fetchEvents caching", () => {
  it("serves a repeated range from cache instead of re-querying Mixpanel", async () => {
    const f = fakeFetch(200, '{"event":"page_viewed","properties":{"time":1}}');
    const wide = { from: "2026-01-01", to: "2026-01-03" };
    const first = await fetchEvents(wide, config, f);
    const second = await fetchEvents(wide, config, f);
    // Three days, fetched once: the second load costs no export queries at all.
    expect((f as jest.Mock).mock.calls).toHaveLength(3);
    expect(second).toEqual(first);
  });

  it("keeps different property filters on separate cache entries", async () => {
    const f = fakeFetch(200, "");
    await fetchEvents(range, { ...config, filters: { Lbu: "SG" } }, f);
    await fetchEvents(range, { ...config, filters: { Lbu: "MY" } }, f);
    expect((f as jest.Mock).mock.calls).toHaveLength(2);
  });

  it("retries a rate-limited day rather than caching the failure", async () => {
    const f = jest
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("", { status: 200 })) as unknown as typeof fetch;
    await expect(fetchEvents(range, config, f)).rejects.toMatchObject({ kind: "rate_limit" });
    await expect(fetchEvents(range, config, f)).resolves.toEqual([]);
    expect((f as jest.Mock).mock.calls).toHaveLength(2);
  });
});
