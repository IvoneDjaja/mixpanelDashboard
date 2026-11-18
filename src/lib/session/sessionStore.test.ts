import { createSession, destroySession, getSessionConfig, SESSION_TTL_MS } from "./sessionStore";

const config = { user: "u", secret: "s", projectId: "1", region: "eu" as const };

describe("sessionStore", () => {
  it("returns the stored config for a created session", () => {
    const id = createSession(config, 1000);
    expect(getSessionConfig(id, 1001)).toEqual(config);
  });

  it("returns null for a missing or unknown id", () => {
    expect(getSessionConfig(undefined)).toBeNull();
    expect(getSessionConfig("nope")).toBeNull();
  });

  it("expires after the idle TTL and extends it on use", () => {
    const id = createSession(config, 0);
    expect(getSessionConfig(id, SESSION_TTL_MS - 1)).toEqual(config);
    // Use at TTL-1 pushed expiry out, so this is still valid.
    expect(getSessionConfig(id, SESSION_TTL_MS * 1.5)).toEqual(config);
    expect(getSessionConfig(id, SESSION_TTL_MS * 1.5 + SESSION_TTL_MS)).toBeNull();
  });

  it("destroys a session", () => {
    const id = createSession(config, 0);
    destroySession(id);
    expect(getSessionConfig(id, 1)).toBeNull();
  });
});
