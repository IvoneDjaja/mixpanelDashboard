import { toDateString, validateDashboardQuery, validateLogin, validateUserId } from "./validation";

const q = (s: string, headers: Record<string, string> = {}) =>
  validateDashboardQuery(new URLSearchParams(s), new Headers(headers));

describe("validateDashboardQuery", () => {
  it("defaults to 24h", () => {
    expect(q("")).toMatchObject({ ok: true, value: { window: "24h", capability: undefined } });
  });
  it("accepts 30d and a capability", () => {
    expect(q("window=30d&capability=Onboarding")).toMatchObject({ ok: true, value: { window: "30d", capability: "Onboarding" } });
  });
  it("accepts 1h", () => {
    expect(q("window=1h")).toMatchObject({ ok: true, value: { window: "1h", capability: undefined } });
  });
  it("rejects an invalid window", () => {
    expect(q("window=7d")).toEqual({ ok: false, error: "window must be 1h, 24h or 30d" });
  });
  it("rejects overlong or control-character capabilities", () => {
    expect(q(`capability=${"a".repeat(101)}`).ok).toBe(false);
    expect(q("capability=a%00b").ok).toBe(false);
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
