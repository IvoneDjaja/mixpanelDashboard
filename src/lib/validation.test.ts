import { toDateString, validateDashboardQuery } from "./validation";

const q = (s: string) => validateDashboardQuery(new URLSearchParams(s));

describe("validateDashboardQuery", () => {
  it("defaults to 24h", () => {
    expect(q("")).toEqual({ ok: true, value: { window: "24h", capability: undefined } });
  });
  it("accepts 30d and a capability", () => {
    expect(q("window=30d&capability=Onboarding")).toEqual({ ok: true, value: { window: "30d", capability: "Onboarding" } });
  });
  it("rejects an invalid window", () => {
    expect(q("window=7d")).toEqual({ ok: false, error: "window must be 24h or 30d" });
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
