import type { MixpanelEvent } from "@/lib/mixpanel/types";

/** A page view reduced to the fields the analytics need. */
export interface PageView {
  userId: string;
  time: number;
  page: string;
  capability: string;
  signInType?: string;
}

/** Default inactivity gap (seconds) that ends a session. */
export const SESSION_GAP_SECONDS = 30 * 60;

/**
 * Converts raw `page_viewed` events into sorted PageViews; other events and
 * rows without a user or page are dropped.
 * @param events - Raw Mixpanel events.
 * @returns Page views ordered by time.
 */
export function toPageViews(events: MixpanelEvent[]): PageView[] {
  return events
    .filter((e) => e.event === "page_viewed")
    .flatMap((e) => {
      const p = e.properties;
      if (!p.distinct_id || !p.page_name || typeof p.time !== "number") return [];
      return [
        {
          userId: p.distinct_id,
          time: p.time,
          page: p.page_name,
          capability: p.capability ?? "Unknown",
          signInType: p.sign_in_type || undefined,
        },
      ];
    })
    .sort((a, b) => a.time - b.time);
}

/**
 * Splits page views into sessions: same user, no gap longer than `gapSeconds`.
 * @param views - Page views sorted by time.
 * @param gapSeconds - Inactivity gap that starts a new session.
 * @returns Sessions, each an ordered list of page views.
 */
export function buildSessions(
  views: PageView[],
  gapSeconds: number = SESSION_GAP_SECONDS,
): PageView[][] {
  const open = new Map<string, PageView[]>();
  const sessions: PageView[][] = [];
  for (const view of views) {
    const current = open.get(view.userId);
    const last = current?.[current.length - 1];
    if (current && last && view.time - last.time <= gapSeconds) {
      current.push(view);
    } else {
      const next = [view];
      sessions.push(next);
      open.set(view.userId, next);
    }
  }
  return sessions;
}
