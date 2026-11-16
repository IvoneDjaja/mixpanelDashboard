import type { MixpanelEvent } from "@/lib/mixpanel/types";
import { DEFAULT_PAGE_SIZE, paginate, type Page } from "@/lib/pagination";

/** One user, summarised from their events in the window. */
export interface UserRow {
  userId: string;
  /** Time of the user's latest event, in epoch seconds. */
  lastSeen: number;
  /** Number of the user's events in the window. */
  events: number;
  /** Page, function and login mode of the user's latest event. */
  lastPage?: string;
  capability?: string;
  signInType?: string;
}

/** Everything the users view displays. */
export interface UsersData {
  window: string;
  /** Functions seen in the window, before the capability filter, for the dropdown. */
  capabilities: string[];
  /** Server-paginated users, most recently seen first. */
  users: Page<UserRow>;
}

/**
 * Builds one page of users in the window, most recently seen first. Events with
 * no `distinct_id` or time are skipped.
 * @param events - Raw Mixpanel events.
 * @param windowKey - Label of the window (for display).
 * @param sinceEpochSeconds - Start of the window.
 * @param capability - Optional capability filter.
 * @param page - Requested 1-based page.
 * @param pageSize - Rows per page.
 * @returns Users page plus the capabilities available for filtering.
 */
export function buildUsersData(
  events: MixpanelEvent[],
  windowKey: string,
  sinceEpochSeconds: number,
  capability?: string,
  page = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
): UsersData {
  const inWindow = events.filter(
    (e) =>
      typeof e.properties.time === "number" &&
      e.properties.time >= sinceEpochSeconds &&
      !!e.properties.distinct_id,
  );
  const capabilities = [
    ...new Set(inWindow.map((e) => e.properties.capability).filter((c): c is string => !!c)),
  ].sort();

  const byUser = new Map<string, UserRow>();
  for (const e of inWindow) {
    if (capability && e.properties.capability !== capability) continue;
    const userId = e.properties.distinct_id!;
    const existing = byUser.get(userId);
    if (!existing) {
      byUser.set(userId, toRow(userId, e, 1));
    } else if (e.properties.time > existing.lastSeen) {
      byUser.set(userId, toRow(userId, e, existing.events + 1));
    } else {
      existing.events += 1;
    }
  }

  const rows = [...byUser.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  return { window: windowKey, capabilities, users: paginate(rows, page, pageSize) };
}

/**
 * Builds a user row from the user's latest event.
 * @param userId - The user's distinct id.
 * @param e - The user's latest event so far.
 * @param events - Number of events counted for the user.
 * @returns The user row.
 */
function toRow(userId: string, e: MixpanelEvent, events: number): UserRow {
  return {
    userId,
    lastSeen: e.properties.time,
    events,
    lastPage: e.properties.page_name,
    capability: e.properties.capability,
    signInType: e.properties.sign_in_type || undefined,
  };
}
