import { toDateString, validateDashboardQuery } from "./validation";

const q = (s: string) => validateDashboardQuery(new URLSearchParams(s));

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
