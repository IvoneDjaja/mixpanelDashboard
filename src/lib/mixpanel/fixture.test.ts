/** @jest-environment node */
import { MixpanelError } from "./client";
import { loadEventsFromFile, parseEventsFile } from "./fixture";

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
