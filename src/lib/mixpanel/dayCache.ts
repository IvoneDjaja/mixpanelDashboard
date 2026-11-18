import "server-only";
import type { MixpanelConfig, MixpanelEvent } from "./types";

/**
 * TTL for a day that is still accumulating events (today, UTC). Short, because
 * the export for today changes continuously.
 */
export const LIVE_DAY_TTL_MS = 60_000;

/**
 * TTL for a day that has already finished. Its export is effectively immutable,
 * so it is held long; the bound only exists so that events Mixpanel backfills
 * late are eventually picked up.
 */
export const PAST_DAY_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Days retained before the oldest are evicted. Entries hold whole days of raw
 * events, so the cache has to stay bounded in a long-running server.
 */
export const MAX_ENTRIES = 120;

/** One cached day. The promise is stored, not the resolved value, so that
 * concurrent callers share a single in-flight export request. */
interface CacheEntry {
  events: Promise<MixpanelEvent[]>;
  expiresAt: number;
  /** When the loader was started, in epoch milliseconds: the "data as of" time. */
  fetchedAt: number;
}

/** A day's events and when they were fetched from Mixpanel. */
export interface CachedDay {
  events: MixpanelEvent[];
  /** Epoch milliseconds at which the events were requested from Mixpanel. */
  fetchedAt: number;
}

/** Options for cachedDayWithMeta. */
export interface CachedDayOptions {
  /** Skip a fresh cached entry and reload the day, replacing the entry. */
  force?: boolean;
  /** Current time in epoch milliseconds (defaults to Date.now()). */
  now?: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Builds the cache key for one exported day. Everything that changes which
 * events Mixpanel returns is part of the key: region, project and the property
 * filters, as well as the day itself. Filters are serialised from sorted
 * entries so that key order cannot produce two keys for one scope. Credentials
 * are deliberately excluded.
 * @param day - The exported day, YYYY-MM-DD.
 * @param config - Mixpanel settings the export was made with.
 * @returns A key unique to that day and scope.
 */
export function dayCacheKey(day: string, config: MixpanelConfig): string {
  const filters = Object.entries(config.filters ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return [config.region, config.projectId ?? "", JSON.stringify(filters), day].join("|");
}

/**
 * Reports whether a day has already finished in UTC, and so is safe to cache
 * for longer. YYYY-MM-DD strings order correctly under plain comparison.
 * @param day - The day in question, YYYY-MM-DD.
 * @param now - Current time in epoch milliseconds (defaults to Date.now()).
 * @returns True when the day ended before the UTC day `now` falls in.
 */
export function isPastDay(day: string, now: number = Date.now()): boolean {
  return day < new Date(now).toISOString().slice(0, 10);
}

/** Drops the oldest entries until the cache is back within MAX_ENTRIES. A Map
 * iterates in insertion order, so the front is the oldest write. */
function evictOldest(): void {
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) return;
    cache.delete(oldest.value);
  }
}

/**
 * Returns a day's events and fetch time from cache, loading them when absent,
 * stale or forced.
 *
 * The entry stores the pending promise, which de-duplicates concurrent requests
 * for the same day: a second caller awaits the first caller's export rather than
 * issuing its own. A forced call always starts its own loader. Failures are never
 * cached, so a rate-limited or timed-out day is retried on the next request; a
 * failed forced reload puts the previous entry back, so a rate-limited refresh
 * does not empty the cache.
 *
 * The expiry is fixed when the entry is written, so a day cached just before
 * midnight keeps its short TTL and is reloaded once afterwards, then held for
 * the longer past-day TTL.
 * @param key - Cache key from dayCacheKey.
 * @param day - The day being loaded, YYYY-MM-DD; selects the TTL.
 * @param loader - Fetches the day when the cache cannot serve it.
 * @param options - `force` to bypass a fresh entry; `now` to inject the clock.
 * @returns The day's events and when they were fetched.
 * @throws Whatever `loader` rejects with, after dropping (or restoring) the entry.
 */
export async function cachedDayWithMeta(
  key: string,
  day: string,
  loader: () => Promise<MixpanelEvent[]>,
  options: CachedDayOptions = {},
): Promise<CachedDay> {
  const now = options.now ?? Date.now();
  const existing = cache.get(key);
  if (!options.force && existing && existing.expiresAt > now) {
    return { events: await existing.events, fetchedAt: existing.fetchedAt };
  }

  const events = loader();
  const ttl = isPastDay(day, now) ? PAST_DAY_TTL_MS : LIVE_DAY_TTL_MS;
  const entry: CacheEntry = { events, expiresAt: now + ttl, fetchedAt: now };
  // Delete first so a refreshed entry moves to the back of the eviction order.
  cache.delete(key);
  cache.set(key, entry);
  evictOldest();

  try {
    return { events: await events, fetchedAt: entry.fetchedAt };
  } catch (error) {
    // Only touch our own entry: a later refresh may already have replaced it.
    if (cache.get(key) === entry) {
      cache.delete(key);
      if (options.force && existing) cache.set(key, existing);
    }
    throw error;
  }
}

/**
 * Returns a day's events from cache, loading them when absent or stale.
 * See cachedDayWithMeta for the caching rules.
 * @param key - Cache key from dayCacheKey.
 * @param day - The day being loaded, YYYY-MM-DD; selects the TTL.
 * @param loader - Fetches the day when the cache cannot serve it.
 * @param now - Current time in epoch milliseconds (defaults to Date.now()).
 * @returns The day's events.
 * @throws Whatever `loader` rejects with.
 */
export async function cachedDay(
  key: string,
  day: string,
  loader: () => Promise<MixpanelEvent[]>,
  now: number = Date.now(),
): Promise<MixpanelEvent[]> {
  return (await cachedDayWithMeta(key, day, loader, { now })).events;
}

/** Empties the cache. Used by tests to keep cases isolated. */
export function clearDayCache(): void {
  cache.clear();
}
