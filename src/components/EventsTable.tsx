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
}

/**
 * Server-paginated table of raw events, newest first.
 * @param props - The events page and paging handlers.
 * @returns The events table with a pagination bar, or an empty-state message.
 */
export function EventsTable({ events, pageSize, onPageChange, onPageSizeChange, showUser = true }: EventsTableProps) {
  if (events.total === 0) return <StateMessage kind="empty" message="No events in this window." />;
  return (
    <>
      <table>
        <thead><tr><th>Time</th><th>Event</th><th>Page</th>{showUser && <th>User</th>}</tr></thead>
        <tbody>
          {events.rows.map((e, i) => (
            <tr key={`${e.time}-${e.userId ?? ""}-${i}`}>
              <td>{new Date(e.time * 1000).toLocaleString()}</td><td>{e.event}</td><td>{e.page ?? "—"}</td>
              {showUser && <td>{e.userId ?? "—"}</td>}
            </tr>
          ))}
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
