/** @jest-environment node */
import { MixpanelError } from "./client";
import { loadEventsFromFile, parseEventsFile, resolveDataSource } from "./fixture";

describe("parseEventsFile", () => {
  it("parses a JSON array", () => {
    expect(parseEventsFile('[{"event":"a","properties":{"time":1}}]')).toHaveLength(1);
  });
  it("parses JSONL", () => {
    expect(parseEventsFile('{"event":"a","properties":{"time":1}}\n{"event":"b","properties":{"time":2}}\n')).toHaveLength(2);
  });
  it("rejects malformed text", () => {
    expect(() => parseEventsFile("nope")).toThrow(MixpanelError);
  });
  it("rejects events without a numeric time", () => {
    expect(() => parseEventsFile('[{"event":"a","properties":{}}]')).toThrow(/properties\.time/);
  });
});

describe("loadEventsFromFile", () => {
  it("raises a config error for an unreadable file in a list", async () => {
    await expect(loadEventsFromFile("package.json, nope.json")).rejects.toBeDefined();
  });
  it("raises a config error for a missing file", async () => {
    await expect(loadEventsFromFile("does-not-exist.json")).rejects.toMatchObject({ kind: "config" });
  });
});

describe("resolveDataSource", () => {
  it("defaults to api without an events file", () => {
    expect(resolveDataSource({})).toBe("api");
  });
  it("defaults to file when an events file is set", () => {
    expect(resolveDataSource({ MIXPANEL_EVENTS_FILE: "a.json" })).toBe("file");
  });
  it("lets api override a configured events file", () => {
    expect(resolveDataSource({ MIXPANEL_DATA_SOURCE: "api", MIXPANEL_EVENTS_FILE: "a.json" })).toBe("api");
  });
  it("rejects file without an events file", () => {
    expect(() => resolveDataSource({ MIXPANEL_DATA_SOURCE: "file" })).toThrow(/MIXPANEL_EVENTS_FILE/);
  });
  it("rejects unknown values", () => {
    expect(() => resolveDataSource({ MIXPANEL_DATA_SOURCE: "csv" })).toThrow(/api or file/);
  });
});
