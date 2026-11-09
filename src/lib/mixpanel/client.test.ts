/** @jest-environment node */
import { fetchEvents, getMixpanelConfig, MixpanelError, parseExportLines } from "./client";

const config = { user: "u", secret: "s", projectId: "1", region: "eu" as const };
const range = { from: "2026-01-01", to: "2026-01-02" };

/** Builds a fake fetch resolving to the given status and body. */
const fakeFetch = (status: number, body = "") =>
  jest.fn().mockResolvedValue(new Response(body, { status })) as unknown as typeof fetch;

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
  it("maps network failures and never exposes the secret", async () => {
    const f = jest.fn().mockRejectedValue(new Error("boom s")) as unknown as typeof fetch;
    const err = await fetchEvents(range, config, f).catch((e) => e);
    expect(err.kind).toBe("upstream");
    expect(err.message).not.toContain("s:");
  });
});
