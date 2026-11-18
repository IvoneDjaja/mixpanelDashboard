/** @jest-environment node */
import {
  cachedDay,
  cachedDayWithMeta,
  clearDayCache,
  dayCacheKey,
  isPastDay,
  LIVE_DAY_TTL_MS,
  MAX_ENTRIES,
  PAST_DAY_TTL_MS,
} from "./dayCache";
import type { MixpanelConfig, MixpanelEvent } from "./types";

const config: MixpanelConfig = { user: "u", secret: "s", projectId: "1", region: "eu" };

/** Fixed clock: 10:00 UTC on 2026-06-15, so "today" and "yesterday" are stable. */
const NOW = Date.parse("2026-06-15T10:00:00Z");
const TODAY = "2026-06-15";
const PAST = "2026-06-14";

/** Builds a minimal event so tests can tell one loader result from another. */
const event = (time: number): MixpanelEvent => ({ event: "page_viewed", properties: { time } });

beforeEach(clearDayCache);

describe("dayCacheKey", () => {
  it("is stable for the same day and scope", () => {
    expect(dayCacheKey(PAST, config)).toBe(dayCacheKey(PAST, config));
  });
  it("ignores the order filters were declared in", () => {
    const a = dayCacheKey(PAST, { ...config, filters: { Environment: "UAT", LBU: "PACS" } });
    const b = dayCacheKey(PAST, { ...config, filters: { LBU: "PACS", Environment: "UAT" } });
    expect(a).toBe(b);
  });
  it("separates different days, filters, regions and projects", () => {
    const base = dayCacheKey(PAST, config);
    expect(dayCacheKey(TODAY, config)).not.toBe(base);
    expect(dayCacheKey(PAST, { ...config, filters: { LBU: "PACS" } })).not.toBe(base);
    expect(dayCacheKey(PAST, { ...config, region: "us" })).not.toBe(base);
    expect(dayCacheKey(PAST, { ...config, projectId: "2" })).not.toBe(base);
  });
  it("separates filters that differ only in value", () => {
    expect(dayCacheKey(PAST, { ...config, filters: { LBU: "PACS" } })).not.toBe(
      dayCacheKey(PAST, { ...config, filters: { LBU: "PAMB" } }),
    );
  });
  it("never embeds the credentials", () => {
    const key = dayCacheKey(PAST, { ...config, secret: "TOP-SECRET-VALUE" });
    expect(key).not.toContain("TOP-SECRET-VALUE");
    expect(key).toBe(dayCacheKey(PAST, { ...config, secret: "a-different-secret" }));
  });
});

describe("isPastDay", () => {
  it("is true only for a day that has already ended in UTC", () => {
    expect(isPastDay(PAST, NOW)).toBe(true);
    expect(isPastDay(TODAY, NOW)).toBe(false);
    expect(isPastDay("2026-06-16", NOW)).toBe(false);
  });
  it("treats the day as current right up to midnight UTC", () => {
    expect(isPastDay(TODAY, Date.parse("2026-06-15T23:59:59Z"))).toBe(false);
    expect(isPastDay(TODAY, Date.parse("2026-06-16T00:00:00Z"))).toBe(true);
  });
});

describe("cachedDay", () => {
  it("loads on a miss and serves the next call from cache", async () => {
    const loader = jest.fn().mockResolvedValue([event(1)]);
    const key = dayCacheKey(PAST, config);
    const first = await cachedDay(key, PAST, loader, NOW);
    const second = await cachedDay(key, PAST, loader, NOW);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("keeps a finished day past the live TTL and reloads it after the long one", async () => {
    const loader = jest.fn().mockResolvedValue([event(1)]);
    const key = dayCacheKey(PAST, config);
    await cachedDay(key, PAST, loader, NOW);
    await cachedDay(key, PAST, loader, NOW + LIVE_DAY_TTL_MS + 1);
    expect(loader).toHaveBeenCalledTimes(1);
    await cachedDay(key, PAST, loader, NOW + PAST_DAY_TTL_MS + 1);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("reloads the current day once the short TTL lapses", async () => {
    const loader = jest.fn().mockResolvedValue([event(1)]);
    const key = dayCacheKey(TODAY, config);
    await cachedDay(key, TODAY, loader, NOW);
    await cachedDay(key, TODAY, loader, NOW + LIVE_DAY_TTL_MS - 1);
    expect(loader).toHaveBeenCalledTimes(1);
    await cachedDay(key, TODAY, loader, NOW + LIVE_DAY_TTL_MS + 1);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("de-duplicates concurrent callers into one load", async () => {
    const loader = jest.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([event(1)]), 5)),
    );
    const key = dayCacheKey(PAST, config);
    const [a, b] = await Promise.all([
      cachedDay(key, PAST, loader, NOW),
      cachedDay(key, PAST, loader, NOW),
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("does not cache a failure, so the next call retries", async () => {
    const loader = jest
      .fn()
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValueOnce([event(1)]);
    const key = dayCacheKey(PAST, config);
    await expect(cachedDay(key, PAST, loader, NOW)).rejects.toThrow("rate limited");
    await expect(cachedDay(key, PAST, loader, NOW)).resolves.toHaveLength(1);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("rejects both callers when a shared in-flight load fails", async () => {
    const loader = jest.fn().mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error("boom")), 5)),
    );
    const key = dayCacheKey(PAST, config);
    const results = await Promise.allSettled([
      cachedDay(key, PAST, loader, NOW),
      cachedDay(key, PAST, loader, NOW),
    ]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("evicts the oldest entry once the cache is full", async () => {
    const loader = jest.fn().mockResolvedValue([]);
    for (let i = 0; i <= MAX_ENTRIES; i += 1) {
      await cachedDay(`key-${i}`, PAST, loader, NOW);
    }
    expect(loader).toHaveBeenCalledTimes(MAX_ENTRIES + 1);
    // The first key was pushed out, so it has to load again.
    await cachedDay("key-0", PAST, loader, NOW);
    expect(loader).toHaveBeenCalledTimes(MAX_ENTRIES + 2);
    // The most recent key is still cached.
    await cachedDay(`key-${MAX_ENTRIES}`, PAST, loader, NOW);
    expect(loader).toHaveBeenCalledTimes(MAX_ENTRIES + 2);
  });
});

describe("cachedDayWithMeta", () => {
  it("reports when the day was fetched, and keeps that time on cache hits", async () => {
    const loader = jest.fn().mockResolvedValue([event(1)]);
    const key = dayCacheKey(PAST, config);
    const first = await cachedDayWithMeta(key, PAST, loader, { now: NOW });
    const second = await cachedDayWithMeta(key, PAST, loader, { now: NOW + 5_000 });
    expect(first.fetchedAt).toBe(NOW);
    expect(second.fetchedAt).toBe(NOW);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("force bypasses a fresh entry, replaces it and moves fetchedAt forward", async () => {
    const loader = jest.fn().mockResolvedValueOnce([event(1)]).mockResolvedValueOnce([event(2)]);
    const key = dayCacheKey(PAST, config);
    await cachedDayWithMeta(key, PAST, loader, { now: NOW });
    const forced = await cachedDayWithMeta(key, PAST, loader, { now: NOW + 1_000, force: true });
    expect(loader).toHaveBeenCalledTimes(2);
    expect(forced).toEqual({ events: [event(2)], fetchedAt: NOW + 1_000 });
    // The next plain call is served from the replaced entry.
    const after = await cachedDayWithMeta(key, PAST, loader, { now: NOW + 2_000 });
    expect(after).toEqual({ events: [event(2)], fetchedAt: NOW + 1_000 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("keeps the previous entry when a forced reload fails", async () => {
    const loader = jest
      .fn()
      .mockResolvedValueOnce([event(1)])
      .mockRejectedValueOnce(new Error("rate limited"));
    const key = dayCacheKey(PAST, config);
    await cachedDayWithMeta(key, PAST, loader, { now: NOW });
    await expect(cachedDayWithMeta(key, PAST, loader, { now: NOW + 1_000, force: true })).rejects.toThrow("rate limited");
    const after = await cachedDayWithMeta(key, PAST, loader, { now: NOW + 2_000 });
    expect(after).toEqual({ events: [event(1)], fetchedAt: NOW });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed forced load when there was no previous entry", async () => {
    const loader = jest.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce([event(1)]);
    const key = dayCacheKey(PAST, config);
    await expect(cachedDayWithMeta(key, PAST, loader, { now: NOW, force: true })).rejects.toThrow("boom");
    await expect(cachedDayWithMeta(key, PAST, loader, { now: NOW })).resolves.toMatchObject({ events: [event(1)] });
  });
});
