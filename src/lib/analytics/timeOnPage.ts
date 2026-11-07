import type { PageView } from "./sessions";

/** Time-on-page summary for one page, in seconds. */
export interface TimeOnPageStat {
  page: string;
  samples: number;
  averageSeconds: number;
  medianSeconds: number;
}

/**
 * Computes time on page as the gap to the next view in the same session.
 * The last page of a session has no duration and is excluded.
 * @param sessions - Sessions from buildSessions.
 * @returns Stats sorted by average time descending.
 */
export function timeOnPageStats(sessions: PageView[][]): TimeOnPageStat[] {
  const durations = new Map<string, number[]>();
  for (const session of sessions) {
    for (let i = 0; i < session.length - 1; i++) {
      const list = durations.get(session[i].page) ?? [];
      list.push(session[i + 1].time - session[i].time);
      durations.set(session[i].page, list);
    }
  }
  return [...durations].map(([page, list]) => {
    const sorted = [...list].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const average = sorted.reduce((s, n) => s + n, 0) / sorted.length;
    return { page, samples: sorted.length, averageSeconds: average, medianSeconds: median };
  }).sort((a, b) => b.averageSeconds - a.averageSeconds);
}
