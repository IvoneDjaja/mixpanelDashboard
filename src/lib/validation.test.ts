import { dayStartEpoch, isValidDate, toDateString, validateDashboardQuery, validateLogin, validateUserId } from "./validation";

/** 2026-11-18T12:00:00Z, the "now" used by the day-window tests. */
const NOW = Date.parse("2026-11-18T12:00:00Z") / 1000;

const q = (s: string, headers: Record<string, string> = {}) =>
  validateDashboardQuery(new URLSearchParams(s), new Headers(headers), NOW);

describe("validateDashboardQuery", () => {
  it("defaults to 24h", () => {
    expect(q("")).toMatchObject({ ok: true, value: { window: "24h", capability: undefined } });
  });
  it("accepts a capability", () => {
    expect(q("window=24h&capability=Onboarding")).toMatchObject({ ok: true, value: { window: "24h", capability: "Onboarding" } });
  });
  it("rejects the removed 30d window", () => {
    expect(q("window=30d")).toEqual({ ok: false, error: "window must be 1h, 24h or day" });
  });
  it("accepts 1h", () => {
    expect(q("window=1h")).toMatchObject({ ok: true, value: { window: "1h", capability: undefined } });
  });
  it("rejects an invalid window", () => {
    expect(q("window=7d")).toEqual({ ok: false, error: "window must be 1h, 24h or day" });
  });
  it("rejects overlong or control-character capabilities", () => {
    expect(q(`capability=${"a".repeat(101)}`).ok).toBe(false);
    expect(q("capability=a%00b").ok).toBe(false);
  });
});

describe("validateDashboardQuery day window", () => {
  it("accepts a past day and today", () => {
    expect(q("window=day&date=2026-11-17")).toMatchObject({ ok: true, value: { window: "day", date: "2026-11-17" } });
    expect(q("window=day&date=2026-11-18")).toMatchObject({ ok: true, value: { window: "day", date: "2026-11-18" } });
  });
  it("requires a date", () => {
    expect(q("window=day").ok).toBe(false);
  });
  it("rejects malformed and impossible dates", () => {
    expect(q("window=day&date=17-11-2026").ok).toBe(false);
    expect(q("window=day&date=2026-11-1").ok).toBe(false);
    expect(q("window=day&date=2026-02-30").ok).toBe(false);
    expect(q("window=day&date=2026-13-01").ok).toBe(false);
  });
  it("rejects a future date", () => {
    expect(q("window=day&date=2026-11-19")).toEqual({ ok: false, error: "date must not be in the future" });
  });
  it("ignores date for rolling windows", () => {
    expect(q("window=24h&date=garbage")).toMatchObject({ ok: true, value: { window: "24h", date: undefined } });
  });
});

describe("validateDashboardQuery refresh", () => {
  it("is true only for refresh=1", () => {
    expect(q("refresh=1")).toMatchObject({ ok: true, value: { refresh: true } });
    expect(q("")).toMatchObject({ ok: true, value: { refresh: false } });
    expect(q("refresh=true")).toMatchObject({ ok: true, value: { refresh: false } });
    expect(q("refresh=0")).toMatchObject({ ok: true, value: { refresh: false } });
  });
});

describe("isValidDate and dayStartEpoch", () => {
  it("validates real calendar days only", () => {
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });
  it("returns midnight UTC in epoch seconds", () => {
    expect(dayStartEpoch("1970-01-02")).toBe(86400);
    expect(toDateString(dayStartEpoch("2026-11-18"))).toBe("2026-11-18");
  });
});

describe("validateDashboardQuery environment and lbu", () => {
  it("defaults to UAT and PACS", () => {
    expect(q("")).toMatchObject({ ok: true, value: { environment: "UAT", lbu: "PACS" } });
  });
  it("accepts every listed environment and LBU", () => {
    for (const environment of ["DEV", "SIT", "UAT", "PROD"]) {
      expect(q("", { "x-environment": environment })).toMatchObject({ ok: true, value: { environment } });
    }
    for (const lbu of ["PACS", "PAMB", "PBTB"]) {
      expect(q("", { "x-lbu": lbu })).toMatchObject({ ok: true, value: { lbu } });
    }
  });
  it("ignores environment and lbu in the URL", () => {
    expect(q("environment=PROD&lbu=PBTB")).toMatchObject({ ok: true, value: { environment: "UAT", lbu: "PACS" } });
  });
  it("rejects unknown or wrongly cased values", () => {
    expect(q("", { "x-environment": "uat" })).toEqual({ ok: false, error: "environment must be one of DEV, SIT, UAT, PROD" });
    expect(q("", { "x-lbu": "XYZ" })).toEqual({ ok: false, error: "lbu must be one of PACS, PAMB, PBTB" });
  });
});

describe("toDateString", () => {
  it("formats UTC dates", () => {
    expect(toDateString(1793693398)).toBe("2026-11-03");
  });
});

describe("validateDashboardQuery paging", () => {
  it("defaults to page 1 of 10", () => {
    expect(q("")).toMatchObject({ ok: true, value: { page: 1, pageSize: 10 } });
  });
  it("accepts valid page and pageSize", () => {
    expect(q("page=3&pageSize=50")).toMatchObject({ ok: true, value: { page: 3, pageSize: 50 } });
  });
  it("rejects bad page values", () => {
    for (const p of ["0", "-1", "abc", "1.5"]) expect(q(`page=${p}`).ok).toBe(false);
  });
  it("rejects unsupported page sizes", () => {
    for (const p of ["7", "100", "x"]) expect(q(`pageSize=${p}`).ok).toBe(false);
  });
});

describe("validateUserId", () => {
  it("returns the trimmed user id", () => {
    expect(validateUserId(new URLSearchParams({ userId: " u1 " }))).toEqual({ ok: true, value: "u1" });
  });
  it("rejects missing, blank, too long and control-character ids", () => {
    expect(validateUserId(new URLSearchParams()).ok).toBe(false);
    expect(validateUserId(new URLSearchParams({ userId: "  " })).ok).toBe(false);
    expect(validateUserId(new URLSearchParams({ userId: "x".repeat(101) })).ok).toBe(false);
    expect(validateUserId(new URLSearchParams({ userId: "a\u0001b" })).ok).toBe(false);
  });
});

describe("validateLogin", () => {
  const valid = { user: " svc ", secret: "s3cret", projectId: "123", region: "eu" };

  it("accepts and trims valid input", () => {
    expect(validateLogin(valid)).toEqual({ ok: true, value: { ...valid, user: "svc" } });
  });

  it.each([
    [{ ...valid, user: "" }, "user"],
    [{ ...valid, secret: "" }, "secret"],
    [{ ...valid, projectId: "" }, "Project ID is required"],
    [{ ...valid, projectId: "abc" }, "numeric"],
    [{ ...valid, region: "xx" }, "Region"],
    [{ ...valid, secret: "a\nb" }, "invalid"],
    [null, "user"],
  ])("rejects %j", (body, fragment) => {
    const result = validateLogin(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(fragment);
  });

  it("never echoes the secret in an error", () => {
    const result = validateLogin({ ...valid, secret: "x".repeat(300) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toContain("xxx");
  });
});
