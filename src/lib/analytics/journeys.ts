import type { PageView } from "./sessions";

/** A page sequence and how many sessions followed it. */
export interface JourneyPath {
  path: string[];
  sessions: number;
  percent: number;
}

/** Count of sessions per login mode. */
export interface LoginModeStat {
  mode: string;
  sessions: number;
  percent: number;
}

/**
 * Finds the most common ordered page sequences, optionally for one capability.
 * Consecutive repeats of the same page are collapsed.
 * @param sessions - Sessions from buildSessions.
 * @param capability - Keep only sessions touching this capability.
 * @param limit - Maximum paths to return.
 * @returns Paths sorted by session count descending.
 */
export function topJourneyPaths(
  sessions: PageView[][],
  capability?: string,
  limit = 10,
): JourneyPath[] {
  const relevant = capability
    ? sessions.filter((s) => s.some((v) => v.capability === capability))
    : sessions;
  const counts = new Map<string, { path: string[]; n: number }>();
  for (const session of relevant) {
    const path = session
      .map((v) => v.page)
      .filter((page, i, all) => i === 0 || page !== all[i - 1]);
    const key = JSON.stringify(path);
    const entry = counts.get(key) ?? { path, n: 0 };
    entry.n += 1;
    counts.set(key, entry);
  }
  return [...counts.values()]
    .map(({ path, n }) => ({
      path,
      sessions: n,
      percent: relevant.length ? (n / relevant.length) * 100 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, limit);
}

/**
 * Splits sessions by login mode (`sign_in_type` of the first view that has one).
 * @param sessions - Sessions from buildSessions.
 * @returns Login modes sorted by session count; sessions with none are skipped.
 */
export function loginModeStats(sessions: PageView[][]): LoginModeStat[] {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    const mode = session.find((v) => v.signInType)?.signInType;
    if (mode) counts.set(mode, (counts.get(mode) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  return [...counts]
    .map(([mode, n]) => ({ mode, sessions: n, percent: total ? (n / total) * 100 : 0 }))
    .sort((a, b) => b.sessions - a.sessions);
}
