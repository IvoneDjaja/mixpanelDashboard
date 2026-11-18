import { Fragment, useState } from "react";
import { fmtSeconds } from "@/lib/formatDuration";
import type { EventRow } from "@/lib/analytics/dashboard";
import type { Page, PageSize } from "@/lib/pagination";
import { Pagination } from "./Pagination";
import { StateMessage } from "./StateMessage";

interface EventsTableProps {
  events: Page<EventRow>;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  /** Whether to show the User column; hidden when every row belongs to one user. Defaults to true. */
  showUser?: boolean;
  /** When provided, the User cell is a button that calls this with the user's id. */
  onSelectUser?: (userId: string) => void;
}

/**
 * Formats a property value for display.
 * @param value - Any JSON value from an event's properties.
 * @returns The value as text; objects and arrays are pretty-printed JSON.
 */
function formatValue(value: unknown): string {
  if (value !== null && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * Server-paginated table of raw events, newest first. Clicking a row expands it
 * to show all of the event's properties.
 * @param props - The events page and paging handlers.
 * @returns The events table with a pagination bar, or an empty-state message.
 */
export function EventsTable({ events, pageSize, onPageChange, onPageSizeChange, showUser = true, onSelectUser }: EventsTableProps) {
  // Remembers which row of which page is open; a different page of rows shows nothing expanded.
  const [expanded, setExpanded] = useState<{ rows: EventRow[]; index: number } | null>(null);
  if (events.total === 0) return <StateMessage kind="empty" message="No events in this window." />;
  const expandedIndex = expanded && expanded.rows === events.rows ? expanded.index : null;
  const columns = showUser ? 5 : 4;
  /** Expands row `i`, or collapses it when already open. */
  const toggle = (i: number) => setExpanded(expandedIndex === i ? null : { rows: events.rows, index: i });
  return (
    <>
      <table>
        <thead><tr><th>Time</th><th>Event</th><th>Page</th><th>Time spent</th>{showUser && <th>User</th>}</tr></thead>
        <tbody>
          {events.rows.map((e, i) => {
            const open = expandedIndex === i;
            return (
              <Fragment key={`${e.time}-${e.userId ?? ""}-${i}`}>
                <tr
                  className="event-row"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => toggle(i)}
                  onKeyDown={(k) => {
                    if (k.key === "Enter" || k.key === " ") {
                      k.preventDefault();
                      toggle(i);
                    }
                  }}
                >
                  <td>{new Date(e.time * 1000).toLocaleString()}</td><td>{e.event}</td><td>{e.page ?? "—"}</td>
                  <td>{e.durationSeconds === undefined ? "—" : fmtSeconds(e.durationSeconds)}</td>
                  {showUser && (
                    <td>
                      {e.userId && onSelectUser ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={(c) => {
                            c.stopPropagation();
                            onSelectUser(e.userId as string);
                          }}
                          onKeyDown={(k) => k.stopPropagation()}
                        >
                          {e.userId}
                        </button>
                      ) : (
                        (e.userId ?? "—")
                      )}
                    </td>
                  )}
                </tr>
                {open && (
                  <tr className="event-details">
                    <td colSpan={columns}>
                      <dl>
                        {Object.entries(e.properties).map(([key, value]) => (
                          <Fragment key={key}>
                            <dt>{key}</dt>
                            <dd>{formatValue(value)}</dd>
                          </Fragment>
                        ))}
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <Pagination
        page={events.page}
        totalPages={events.totalPages}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </>
  );
}
