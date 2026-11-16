/** @jest-environment node */
import { errorResponse } from "./dashboardRequest";
import { MixpanelError } from "./mixpanel/client";

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
