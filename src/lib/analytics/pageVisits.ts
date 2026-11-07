import type { PageView } from "./sessions";

/** Visit totals for one page. */
export interface PageVisitStat {
  page: string;
  views: number;
  uniqueVisitors: number;
}

/**
 * Counts views and unique visitors per page since a cutoff time.
 * @param views - Page views.
 * @param sinceEpochSeconds - Only views at or after this time count.
 * @returns Stats sorted by views descending, then page name ascending.
 */
export function pageVisitStats(
  views: PageView[],
  sinceEpochSeconds: number,
): PageVisitStat[] {
  const byPage = new Map<string, { views: number; users: Set<string> }>();
  for (const v of views) {
    if (v.time < sinceEpochSeconds) continue;
    const entry = byPage.get(v.page) ?? { views: 0, users: new Set() };
    entry.views += 1;
    entry.users.add(v.userId);
    byPage.set(v.page, entry);
  }
  return [...byPage].map(([page, e]) => ({
    page,
    views: e.views,
    uniqueVisitors: e.users.size,
  })).sort((a, b) => b.views - a.views || a.page.localeCompare(b.page));
}
